// 展示PCの起動・終了ツールと運用ガイドの検査（#21）。
// PowerShell がある環境（Windows の powershell.exe、または pwsh）では、日本語・空白を含むパスへコピーして
// 起動 → 配信確認 → 終了、ポート競合時に他のアプリを止めないこと、を実際に確認する。
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { copyFile, mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import http from 'node:http';
import net from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../', import.meta.url));
const read = (path) => readFile(join(root, path), 'utf8');
const SCRIPTS = ['exhibition-common.ps1', 'start-exhibition.ps1', 'stop-exhibition.ps1'];

test('PowerShellスクリプトはWindows PowerShell 5.1で日本語が化けないようBOM付きUTF-8', async () => {
  for (const name of SCRIPTS) {
    const bytes = await readFile(join(root, 'scripts', name));
    assert.deepEqual([...bytes.subarray(0, 3)], [0xef, 0xbb, 0xbf], `${name} にBOMがありません`);
    const text = bytes.toString('utf8');
    // 5.1 の StrictMode で未定義になる PowerShell 7 専用の自動変数を使わない
    assert.doesNotMatch(text, /\$Is(Windows|Linux|MacOS)\b/, `${name} は $IsWindows 等を使えません`);
  }
});

test('利用者向けの.cmdはASCIIのみで、同じrepoのスクリプトを呼ぶ', async () => {
  for (const [cmd, ps1] of [['start-exhibition.cmd', 'start-exhibition.ps1'], ['stop-exhibition.cmd', 'stop-exhibition.ps1']]) {
    const text = await read(cmd);
    assert.ok([...text].every((c) => c === '\t' || c === '\n' || c === '\r' || (c >= ' ' && c <= '~')),
      `${cmd} は文字コードの影響を受けないようASCIIだけで書きます`);
    assert.ok(text.includes(`"%~dp0scripts\\${ps1}"`), `${cmd} が scripts\\${ps1} を引用符付きで呼んでいません`);
    assert.match(text, /-ExecutionPolicy Bypass/, `${cmd} はPCの実行ポリシーを変えずに実行します`);
    assert.ok((await stat(join(root, 'scripts', ps1))).isFile());
  }
});

test('実行時の記録・ログはcommit対象外', async () => {
  assert.match(await read('.gitignore'), /^\.exhibition\/$/m);
});

// 運用ガイドに書いた操作が実装と食い違ったら失敗させ、文書の更新を促す。
test('運用ガイドの操作名・キーが実装に存在する', async () => {
  const doc = await read('docs/exhibition-operations.md');
  const html = await read('project-chrome/index.html');
  const main = await read('project-chrome/js/main.js');
  const intro = await read('project-chrome/js/intro.js');
  // 受取ページ（スマホ側）は serve.mjs が返すので、その文言も画面の一部として扱う
  const screens = html + await read('scripts/receipt-server.mjs');
  const client = await read('project-chrome/js/receipt-client.js') + await read('scripts/receipt-server.mjs');
  const labels = ['SKIP SEQUENCE', '装着して体験する', '? GUIDE', '写真を撮る', '← BACK TO SELECT', 'RESET',
    'スタッフ用設定 / SYSTEM', 'Volume', 'Effects quality', 'Room reflections', '計測情報を表示', 'ARM CONTROL',
    'MASK', '🛒 この装備を購入（体験）', '撮影へ進む', 'この写真で購入', '撮り直す', 'やめる', '画像を保存'];
  for (const label of labels) {
    assert.ok(doc.includes(label), `ガイドに「${label}」がありません`);
    assert.ok(screens.includes(label), `画面に「${label}」がありません。ガイドを更新してください`);
  }
  for (const gesture of ['FLAME', 'PLASMA', 'NET', 'HOOK', 'FIST']) {
    assert.match(html, new RegExp(`<em>${gesture}</em>`), `ARM CONTROL に ${gesture} がありません`);
    assert.ok(doc.includes(gesture), `ガイドに ${gesture} がありません`);
  }
  for (const message of ['モデルを読み込めませんでした', 'カメラにアクセスできませんでした', 'カメラの準備ができていません', '装着中…']) {
    assert.ok(main.includes(message), `main.js に「${message}」がありません。ガイドを更新してください`);
    assert.ok(doc.includes(message), `ガイドに「${message}」がありません`);
  }
  for (const message of ['レシートのサーバーに接続できません', 'レシートのサーバーが起動していません',
    'LAN に接続されていないため、QR を発行できません。', '受取期限が過ぎたか、番号が正しくありません。']) {
    assert.ok(client.includes(message), `受取の処理に「${message}」がありません。ガイドを更新してください`);
    assert.ok(doc.includes(message), `ガイドに「${message}」がありません`);
  }
  const timing = await read('project-chrome/js/purchase-session.js');
  for (const [key, sec] of [['noticeSec', 30], ['previewSec', 45], ['qrSec', 120]]) {
    assert.match(timing, new RegExp(`${key}: ${sec},`), `${key} が ${sec} 秒ではありません。ガイドを更新してください`);
    assert.ok(doc.includes(`${sec}秒`), `ガイドに ${sec}秒 がありません`);
  }
  assert.match(await read('scripts/receipt-server.mjs'), /ttlMs: 10 \* 60 \* 1000/, '受取期限が10分ではありません。ガイドを更新してください');
  assert.ok(doc.includes('10分'));
  assert.match(main, /e\.ctrlKey && e\.shiftKey && \(e\.key === "R"/, 'スタッフ用リセット（Ctrl+Shift+R）が見つかりません');
  assert.match(main, /e\.key === "Enter"[\s\S]{0,120}doReset\(\)/, 'スタッフ用リセットのEnter実行が見つかりません');
  assert.match(main, /toLowerCase\(\) === "m"/, 'Mキーの消音が見つかりません');
  assert.match(main, /toLowerCase\(\) === "g"/, 'Gキーのテスト発射が見つかりません');
  assert.match(intro, /e\.key === 'Escape'/, '入店演出のEscが見つかりません');
  for (const key of ['`Ctrl` + `Shift` + `R`', '`Enter`', '`Esc`', '`M` キー', '`G` キー']) {
    assert.ok(doc.includes(key), `ガイドに ${key} がありません`);
  }
});

// ---- PowerShell での実行確認 ----
function findPowerShell() {
  const candidates = process.platform === 'win32' ? ['powershell.exe', 'pwsh'] : ['pwsh'];
  for (const exe of candidates) {
    const r = spawnSync(exe, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.Major'], { encoding: 'utf8', timeout: 30000 });
    if (r.status === 0) return exe;
  }
  return null;
}
const shell = findPowerShell();
const python = ['py', 'python', 'python3'].some((exe) =>
  spawnSync(exe, exe === 'py' ? ['-3', '--version'] : ['--version'], { encoding: 'utf8', timeout: 30000 }).status === 0);

function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

// 標準出力を待たずに終了コードだけ見る（起動したサーバーが出力先を引き継いでも止まらないように）
function runScript(script, args = []) {
  return new Promise((resolve, reject) => {
    const child = spawn(shell, ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
      { stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    child.stdout.on('data', (d) => { output += d; });
    child.stderr.on('data', (d) => { output += d; });
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${script} がタイムアウトしました\n${output}`)); }, 60000);
    child.once('error', reject);
    child.once('exit', (code) => { clearTimeout(timer); resolve({ code, output }); });
  });
}

function get(port, path) {
  return new Promise((resolve, reject) => {
    const req = http.get({ host: '127.0.0.1', port, path, agent: false }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { body += d; });
      res.on('end', () => resolve({ status: res.statusCode, type: res.headers['content-type'], body }));
    });
    req.setTimeout(3000, () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}

async function makeCopy(t) {
  const base = await mkdtemp(join(tmpdir(), 'hal208-'));
  const repo = join(base, '展示 テスト', 'HAL208 コピー');
  await mkdir(join(repo, 'scripts'), { recursive: true });
  await mkdir(join(repo, 'project-chrome', 'js'), { recursive: true });
  for (const name of [...SCRIPTS, 'serve.mjs', 'receipt-server.mjs']) await copyFile(join(root, 'scripts', name), join(repo, 'scripts', name));
  await writeFile(join(repo, 'project-chrome', 'index.html'), '<!DOCTYPE html><title>test</title>');
  await writeFile(join(repo, 'project-chrome', 'js', 'main.js'), 'export {};');
  const stop = join(repo, 'scripts', 'stop-exhibition.ps1');
  // 失敗時もサーバーを残さないよう、先に終了ツールを実行してから一時フォルダーを消す
  t.after(async () => {
    await runScript(stop).catch(() => {});
    await rm(base, { recursive: true, force: true });
  });
  return {
    start: join(repo, 'scripts', 'start-exhibition.ps1'),
    stop: join(repo, 'scripts', 'stop-exhibition.ps1'),
    state: join(repo, '.exhibition', 'server.json'),
  };
}

const exists = (path) => stat(path).then(() => true, () => false);

test('日本語・空白を含むパスから展示用サーバー（serve.mjs）を起動し、自分のサーバーだけを終了できる', { skip: !shell && 'PowerShellがありません', timeout: 180000 }, async (t) => {
  const copy = await makeCopy(t);
  const port = await freePort();
  const lanPort = await freePort();
  const args = ['-NoBrowser', '-SkipNetCheck', '-Port', String(port), '-LanPort', String(lanPort)];

  const started = await runScript(copy.start, args);
  assert.equal(started.code, 0, started.output);
  assert.ok(await exists(copy.state), '起動したサーバーの記録がありません');
  assert.equal(JSON.parse((await readFile(copy.state, 'utf8')).replace(/^\uFEFF/, '')).mode, 'node');
  assert.equal((await get(port, '/')).status, 200);
  const info = await get(port, '/api/server-info');
  assert.equal(info.status, 200, 'QR 受取の API がありません（serve.mjs で起動していません）');
  assert.match(info.body, /"receipts":true/);

  const again = await runScript(copy.start, args);
  assert.equal(again.code, 0, '起動中にもう一度実行しても失敗しない');

  const stopped = await runScript(copy.stop);
  assert.equal(stopped.code, 0, stopped.output);
  assert.equal(await exists(copy.state), false, '終了後に記録が残っています');
  await assert.rejects(get(port, '/'), '終了後もサーバーが応答しています');

  const restarted = await runScript(copy.start, args);
  assert.equal(restarted.code, 0, `終了後に再起動できません\n${restarted.output}`);
  assert.equal((await runScript(copy.stop)).code, 0);
});

test('Pythonでも起動でき、JavaScriptをES Modulesで読める形式で配信する', { skip: (!shell && 'PowerShellがありません') || (!python && 'Pythonがありません'), timeout: 120000 }, async (t) => {
  const copy = await makeCopy(t);
  const port = await freePort();
  const started = await runScript(copy.start, ['-Python', '-NoBrowser', '-SkipNetCheck', '-Port', String(port)]);
  assert.equal(started.code, 0, started.output);
  const js = await get(port, '/js/main.js');
  assert.match(js.type ?? '', /javascript/, 'ES Modules に必要な MIME 型で配信されていません');
  assert.equal((await runScript(copy.stop)).code, 0);
  await assert.rejects(get(port, '/'));
});

test('ポートを他のアプリが使っていたら起動せず、そのアプリも止めない', { skip: !shell && 'PowerShellがありません', timeout: 120000 }, async (t) => {
  const copy = await makeCopy(t);
  const other = http.createServer((req, res) => res.end('other app'));
  await new Promise((resolve) => other.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise((resolve) => other.close(resolve)));
  const { port } = other.address();

  const result = await runScript(copy.start, ['-NoBrowser', '-SkipNetCheck', '-Port', String(port), '-LanPort', String(await freePort())]);
  assert.equal(result.code, 1, result.output);
  assert.equal(await exists(copy.state), false);
  assert.equal((await get(port, '/')).status, 200, '他のアプリが止められています');

  const stop = await runScript(copy.stop);
  assert.equal(stop.code, 0, stop.output);
  assert.equal((await get(port, '/')).status, 200, '終了ツールが他のアプリを止めています');
});
