import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { request } from 'node:http';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import {
  createLanServer, createLocalServer, createReceiptStore, findLanAddress, isPng, resolveStatic, TOKEN_RE,
} from '../scripts/receipt-server.mjs';
import { makeQrMatrix, registerReceipt } from '../project-chrome/js/receipt-client.js';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('dummy-png-body')]);

const listen = (server, host) => new Promise((resolve) => server.listen(0, host, () => resolve(server.address().port)));
const close = (server) => new Promise((resolve) => server.close(resolve));

async function setup(t, { receiptBase = () => 'http://192.168.0.5:8001', maxBytes } = {}) {
  const root = await mkdtemp(path.join(tmpdir(), 'pc-serve-'));
  await writeFile(path.join(root, 'index.html'), '<h1>top</h1>');
  await mkdir(path.join(root, 'js'));
  await writeFile(path.join(root, 'js', 'a.js'), 'export {}');
  await writeFile(path.join(root, '.secret'), 'x');
  const store = createReceiptStore();
  const local = createLocalServer({ root, store, receiptBase, ...(maxBytes ? { maxBytes } : {}) });
  const lan = createLanServer({ store });
  const lp = await listen(local, '127.0.0.1');
  const np = await listen(lan, '127.0.0.1');
  t.after(async () => { await close(local); await close(lan); await rm(root, { recursive: true, force: true }); });
  return { store, local: `http://127.0.0.1:${lp}`, lan: `http://127.0.0.1:${np}`, lp };
}

const post = (url, body, headers = {}) => fetch(url, { method: 'POST', body, headers: { 'Content-Type': 'image/png', ...headers } });

test('受取番号は推測できない長さで、期限が過ぎると消える', () => {
  let now = 1000;
  const store = createReceiptStore({ ttlMs: 500, now: () => now });
  const { token, expiresAt } = store.add(PNG);
  assert.match(token, TOKEN_RE);
  assert.equal(expiresAt, 1500);
  assert.equal(store.get(token).png, PNG);
  assert.equal(store.get('../etc/passwd'), null);
  now = 1500;
  assert.equal(store.get(token), null);
  assert.equal(store.size, 0);
});

test('置いておける数を超えたら古い物から消す', () => {
  const store = createReceiptStore({ maxItems: 2 });
  const a = store.add(PNG).token, b = store.add(PNG).token, c = store.add(PNG).token;
  assert.equal(store.size, 2);
  assert.equal(store.get(a), null);
  assert.ok(store.get(b) && store.get(c));
  assert.equal(new Set([a, b, c]).size, 3);
});

test('PNG かどうかを先頭で見分ける', () => {
  assert.ok(isPng(PNG));
  assert.ok(!isPng(Buffer.from('GIF89a........')));
  assert.ok(!isPng(PNG.subarray(0, 8)));
});

test('配信フォルダーの外・隠しファイルは開けない', () => {
  const root = path.resolve('/srv/pc');
  assert.equal(resolveStatic(root, '/'), path.join(root, 'index.html'));
  assert.equal(resolveStatic(root, '/js/a.js?v=1'), path.join(root, 'js', 'a.js'));
  assert.equal(resolveStatic(root, '/../package.json'), path.join(root, 'package.json'));
  assert.equal(resolveStatic(root, '/%2e%2e/%2e%2e/etc/passwd'), path.join(root, 'etc', 'passwd'));
  assert.equal(resolveStatic(root, '/..%5c..%5cwin.ini'), null);
  assert.equal(resolveStatic(root, '/.git/config'), null);
  assert.equal(resolveStatic(root, '/%E0%A4%A'), null);
  assert.equal(resolveStatic(root, '/a%00.js'), null);
});

test('LAN のアドレス：Wi-Fi（en0）を優先し、仮想マシン・VPN・macOS 内部の物は使わない', () => {
  const v4 = (address, internal = false) => ({ family: 'IPv4', address, internal });
  assert.equal(findLanAddress({
    lo0: [v4('127.0.0.1', true)],
    bridge100: [v4('192.168.64.1')],                 // 仮想マシン
    utun4: [v4('10.8.0.2')],                         // VPN
    en5: [v4('192.0.0.2')],                          // IPv6 だけの回線で macOS が作る物
    en0: [{ family: 'IPv6', address: 'fe80::1', internal: false }, v4('10.128.65.4')],
  }), '10.128.65.4');
  assert.equal(findLanAddress({ en1: [v4('169.254.3.4')], eth0: [v4('172.20.10.3')] }), '172.20.10.3');
  assert.equal(findLanAddress({ lo0: [v4('127.0.0.1', true)], en0: [v4('192.0.0.2')], bridge100: [v4('192.168.64.1')] }), null);
});

test('展示PC用：画面を配信し、フォルダーの一覧は出さない', async (t) => {
  const s = await setup(t);
  let res = await fetch(`${s.local}/`);
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '<h1>top</h1>');
  res = await fetch(`${s.local}/js/a.js`);
  assert.match(res.headers.get('content-type'), /javascript/);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  res = await fetch(`${s.local}/js/`);
  assert.equal(res.status, 404);
  res = await fetch(`${s.local}/js`, { redirect: 'manual' });
  assert.equal(res.status, 301);
  assert.equal((await fetch(`${s.local}/.secret`)).status, 404);
  assert.equal((await fetch(`${s.local}/missing.js`)).status, 404);
  assert.equal((await fetch(`${s.local}/index.html`, { method: 'DELETE' })).status, 405);
});

test('展示PC用：PNG を登録すると受取 URL を返し、スマホ用で同じ画像を受け取れる', async (t) => {
  const s = await setup(t);
  const res = await post(`${s.local}/api/receipts`, PNG, { Origin: s.local });
  assert.equal(res.status, 201);
  const data = await res.json();
  const token = data.url.split('/r/')[1];
  assert.match(token, TOKEN_RE);
  assert.ok(data.url.startsWith('http://192.168.0.5:8001/r/'));
  assert.ok(data.expiresAt > Date.now());

  const page = await fetch(`${s.lan}/r/${token}`);
  assert.equal(page.status, 200);
  assert.equal(page.headers.get('cache-control'), 'no-store');
  assert.match(page.headers.get('content-security-policy'), /default-src 'none'/);
  const html = await page.text();
  assert.match(html, new RegExp(`/r/${token}/receipt\\.png`));
  assert.match(html, /決済は発生しません/);

  const img = await fetch(`${s.lan}/r/${token}/receipt.png`);
  assert.equal(img.headers.get('content-type'), 'image/png');
  const got = Buffer.from(await img.arrayBuffer());
  assert.equal(createHash('sha256').update(got).digest('hex'), createHash('sha256').update(PNG).digest('hex'));
});

test('展示PC用：PNG 以外・大きすぎる物・他のサイトからの送信は受け付けない', async (t) => {
  const s = await setup(t, { maxBytes: 64 });
  assert.equal((await post(`${s.local}/api/receipts`, 'hello', { 'Content-Type': 'text/plain' })).status, 415);
  assert.equal((await post(`${s.local}/api/receipts`, Buffer.from('not a png at all'))).status, 400);
  assert.equal((await post(`${s.local}/api/receipts`, Buffer.concat([PNG, Buffer.alloc(100)]))).status, 413);
  assert.equal((await post(`${s.local}/api/receipts`, PNG, { Origin: 'https://evil.example' })).status, 403);
  // 別の名前（DNS の付け替え）で届いた送信も断る。fetch は Host を変えられないため http.request で送る
  const status = await new Promise((resolve, reject) => {
    const req = request({ host: '127.0.0.1', port: s.lp, path: '/api/receipts', method: 'POST',
      headers: { Host: `evil.example:${s.lp}`, 'Content-Type': 'image/png' } }, (res) => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
    req.end(PNG);
  });
  assert.equal(status, 403);
  assert.equal((await fetch(`${s.local}/api/receipts`)).status, 405);
  assert.equal(s.store.size, 0);
});

test('展示PC用：LAN が無い時は QR を発行しない', async (t) => {
  const s = await setup(t, { receiptBase: () => null });
  const res = await post(`${s.local}/api/receipts`, PNG);
  assert.equal(res.status, 503);
  assert.match((await res.json()).error, /LAN/);
  assert.equal(s.store.size, 0);
});

test('スマホ用：受取ページと画像以外は返さない', async (t) => {
  const s = await setup(t);
  for (const p of ['/', '/index.html', '/api/receipts', '/r/', '/r/short', '/js/a.js', '/r/../index.html']) {
    assert.equal((await fetch(`${s.lan}${p}`)).status, 404, p);
  }
  const { token } = s.store.add(PNG);
  assert.equal((await fetch(`${s.lan}/r/${token}`, { method: 'POST' })).status, 405);
  assert.equal((await fetch(`${s.lan}/r/${token}/other.png`)).status, 404);
});

test('QR：URL から正しい大きさの白黒を作り、位置合わせの印がある', async () => {
  const m = await makeQrMatrix('http://192.168.0.5:8001/r/AAAAAAAAAAAAAAAAAAAAAA');
  assert.equal(m.length, m[0].length);
  assert.equal((m.length - 17) % 4, 0);
  // 左上の位置合わせの印（7×7 の外枠が黒、その内側が白）
  for (let i = 0; i < 7; i++) {
    assert.ok(m[0][i] && m[6][i] && m[i][0] && m[i][6]);
  }
  assert.ok(!m[1][1] && m[3][3]);
});

test('受取の登録：サーバーが無い・失敗した時は理由つきのエラーになる', async () => {
  await assert.rejects(registerReceipt(new Blob([PNG]), { fetchImpl: async () => { throw new TypeError('fail'); } }), /npm run serve/);
  await assert.rejects(registerReceipt(new Blob([PNG]), { fetchImpl: async () => new Response('', { status: 501 }) }), /npm run serve/);
  await assert.rejects(registerReceipt(new Blob([PNG]), {
    fetchImpl: async () => Response.json({ error: 'LAN に接続されていません' }, { status: 503 }),
  }), /LAN/);
  const ok = await registerReceipt(new Blob([PNG]), {
    fetchImpl: async (url, opt) => {
      assert.equal(url, '/api/receipts');
      assert.equal(opt.headers['Content-Type'], 'image/png');
      return Response.json({ token: 't', url: 'http://x/r/t', expiresAt: 1 }, { status: 201 });
    },
  });
  assert.equal(ok.url, 'http://x/r/t');
});

test('同梱した QR ライブラリにライセンスと出どころが付いている', async () => {
  const dir = new URL('../project-chrome/vendor/qrcode-generator/', import.meta.url);
  assert.match(await readFile(new URL('LICENSE', dir), 'utf8'), /MIT License[\s\S]*Kazuhiko Arase/);
  assert.match(await readFile(new URL('README.md', dir), 'utf8'), /qrcode-generator.*2\.0\.4/);
  assert.match(await readFile(new URL('qrcode.mjs', dir), 'utf8'), /Licensed under the MIT license/);
});
