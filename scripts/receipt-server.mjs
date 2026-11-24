// 展示用のサーバー（追加の npm パッケージは使わない）。
// ・展示PC用（127.0.0.1 だけで待ち受け）：project-chrome の画面を配信し、レシート画像（PNG）を受け取って受取用の番号（トークン）を発行する。
// ・来場者のスマホ用（同じ Wi-Fi の LAN で待ち受け）：/r/<トークン> の受取ページと画像だけを返す。それ以外は 404。
// 画像はメモリーにだけ置き、有効期限（標準 10 分）が過ぎるか、サーバーを止めると消える（ファイルには保存しない）。
import { createServer } from 'node:http';
import { randomBytes } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { networkInterfaces } from 'node:os';
import path from 'node:path';

export const RECEIPT_DEFAULTS = Object.freeze({
  ttlMs: 10 * 60 * 1000,        // 受取できる時間
  maxItems: 30,                 // 同時に置いておく最大数（超えたら古い物から消す）
  maxBytes: 8 * 1024 * 1024,    // 1枚の最大サイズ
  sweepMs: 30 * 1000,           // 期限切れを消す間隔
});

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
export const isPng = (buf) => Buffer.isBuffer(buf) && buf.length > PNG_MAGIC.length && buf.subarray(0, 8).equals(PNG_MAGIC);

// 推測できない受取番号（16バイトの乱数 → URL に使える 22 文字）
export const newToken = () => randomBytes(16).toString('base64url');
export const TOKEN_RE = /^[A-Za-z0-9_-]{22}$/;
// 展示画面が登録のたびに付ける番号（X-Receipt-Request）。取り消す時にこの番号で消す
export const REQUEST_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

export function createReceiptStore({ ttlMs = RECEIPT_DEFAULTS.ttlMs, maxItems = RECEIPT_DEFAULTS.maxItems, now = Date.now } = {}) {
  const items = new Map();       // token → { png, expiresAt, requestId }（追加した順）
  const cancelled = new Map();   // 取り消された登録番号 → 覚えておく期限（登録より先に取り消しが届いた時のため）
  const sweep = () => {
    const t = now();
    for (const [token, item] of items) if (item.expiresAt <= t) items.delete(token);
    for (const [id, until] of cancelled) if (until <= t) cancelled.delete(id);
  };
  return {
    // 取り消し済みの登録番号なら保存せず null を返す
    add(png, { requestId = null } = {}) {
      sweep();
      if (requestId && cancelled.has(requestId)) return null;
      while (items.size >= maxItems) items.delete(items.keys().next().value);
      let token = newToken();
      while (items.has(token)) token = newToken();
      const expiresAt = now() + ttlMs;
      items.set(token, { png, expiresAt, requestId });
      return { token, expiresAt };
    },
    get(token) {
      if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
      const item = items.get(token);
      if (!item) return null;
      if (item.expiresAt <= now()) { items.delete(token); return null; }
      return item;
    },
    // 登録番号のレシートを消す。まだ届いていない登録も、後から届いた時に保存しない。消した数を返す
    cancelRequest(requestId) {
      if (typeof requestId !== 'string' || !REQUEST_ID_RE.test(requestId)) return 0;
      sweep();
      let removed = 0;
      for (const [token, item] of items) if (item.requestId === requestId) { items.delete(token); removed++; }
      cancelled.delete(requestId);
      cancelled.set(requestId, now() + ttlMs);
      while (cancelled.size > maxItems * 4) cancelled.delete(cancelled.keys().next().value);
      return removed;
    },
    sweep,
    clear: () => { items.clear(); cancelled.clear(); },
    get size() { return items.size; },
  };
}

// スマホから届くアドレス（LAN の IPv4）。
// Wi-Fi・有線（macOS の en0, en1…、Windows の Wi-Fi / Ethernet）を優先し、仮想マシン・VPN・macOS 内部の物は使わない。
const SKIP_IFACE = /^(lo|bridge|utun|vmnet|vboxnet|docker|veth|br-|llw|awdl|anpi|ap\d|gif|stf|tun|tap|ppp|ipsec|zt|tailscale|wg|vEthernet)/i;
export function findLanAddress(ifaces = networkInterfaces()) {
  const list = [];
  for (const [name, addrs] of Object.entries(ifaces)) {
    if (SKIP_IFACE.test(name)) continue;
    for (const a of addrs ?? []) {
      if (!a || !(a.family === 'IPv4' || a.family === 4) || a.internal) continue;
      // 192.0.0.x：IPv6 だけの回線で macOS が内部に作る物、169.254.x：自動割り当て（つながっていない）
      if (/^(192\.0\.0\.|169\.254\.|127\.)/.test(a.address)) continue;
      list.push({ name, address: a.address });
    }
  }
  const nameRank = (n) => (n === 'en0' ? 0 : /^(en|eth|wl|Wi-?Fi|Ethernet)/i.test(n) ? 1 : 2);
  const ipRank = (ip) => (/^(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip) ? 0 : 1);
  list.sort((a, b) => nameRank(a.name) - nameRank(b.name) || ipRank(a.address) - ipRank(b.address));
  return list[0]?.address ?? null;
}

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.glb': 'model/gltf-binary', '.gltf': 'model/gltf+json',
  '.mp3': 'audio/mpeg', '.wav': 'audio/wav', '.ogg': 'audio/ogg', '.wasm': 'application/wasm', '.task': 'application/octet-stream',
  '.txt': 'text/plain; charset=utf-8', '.md': 'text/plain; charset=utf-8', '.woff2': 'font/woff2',
};

// URL のパスを配信フォルダー内の実際のパスにする。フォルダーの外を指すもの・隠しファイルは null
export function resolveStatic(root, urlPath) {
  let p;
  try { p = decodeURIComponent(urlPath.split('?')[0].split('#')[0]); } catch { return null; }
  if (p.includes('\0') || p.includes('\\')) return null;
  if (p.endsWith('/')) p += 'index.html';
  const full = path.resolve(root, '.' + path.posix.normalize('/' + p));
  const base = path.resolve(root);
  if (full !== base && !full.startsWith(base + path.sep)) return null;
  if (path.relative(base, full).split(path.sep).some((s) => s.startsWith('.'))) return null;
  return full;
}

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
};

function send(res, status, body, headers = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Length': buf.length, ...headers });
  res.end(res.req.method === 'HEAD' ? undefined : buf);
}
const sendText = (res, status, text) => send(res, status, text, { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
const sendJson = (res, status, obj) => send(res, status, JSON.stringify(obj), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });

function readBody(req, maxBytes) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > maxBytes) { req.removeAllListeners('data'); req.pause(); reject(Object.assign(new Error('too large'), { status: 413 })); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

const isLoopback = (addr) => addr === '127.0.0.1' || addr === '::1' || addr === '::ffff:127.0.0.1';

// 展示PC用。host は 127.0.0.1 固定（LAN からは届かない）。
// receiptBase()：スマホ用 URL の先頭（例 http://192.168.0.5:8001）。LAN が無い時は null
export function createLocalServer({ root, store, receiptBase, maxBytes = RECEIPT_DEFAULTS.maxBytes, log = () => {} }) {
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      if (!isLoopback(req.socket.remoteAddress)) return sendText(res, 403, 'Forbidden');

      if (url.pathname === '/api/receipts') {
        if (req.method !== 'POST' && req.method !== 'DELETE') return sendText(res, 405, 'Method Not Allowed');
        // 他のサイトから勝手に送られないよう、同じ展示画面（localhost / 127.0.0.1）からの送信だけ受け付ける
        const origin = req.headers.origin;
        const host = req.headers.host ?? '';
        if (origin && origin !== `http://${host}`) return sendText(res, 403, 'Forbidden');
        if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(host)) return sendText(res, 403, 'Forbidden');
        const requestId = req.headers['x-receipt-request'];
        if (requestId !== undefined && !REQUEST_ID_RE.test(requestId)) return sendText(res, 400, 'Bad Request');
        if (req.method === 'DELETE') {
          // 購入の取り消し：登録済みなら消し、まだなら後から届いた登録を保存しない
          if (!requestId) return sendText(res, 400, 'Bad Request');
          const removed = store.cancelRequest(requestId);
          log(`購入が取り消されたため、レシートを${removed ? '削除しました' : '保存しないようにしました'}（残り ${store.size} 件）`);
          return send(res, 204, '', { 'Cache-Control': 'no-store' });
        }
        if ((req.headers['content-type'] ?? '').split(';')[0].trim() !== 'image/png') return sendText(res, 415, 'PNG only');
        if (Number(req.headers['content-length'] ?? 0) > maxBytes) throw Object.assign(new Error('too large'), { status: 413 });
        const body = await readBody(req, maxBytes);
        if (!isPng(body)) return sendText(res, 400, 'PNG only');
        const base = receiptBase();
        if (!base) return sendJson(res, 503, { error: 'LAN に接続されていないため、QR を発行できません。' });
        const added = store.add(body, { requestId: requestId ?? null });
        if (!added) return sendJson(res, 409, { error: '購入が取り消されたため、レシートは保存しませんでした。' });
        const { token, expiresAt } = added;
        log(`レシートを登録しました（${Math.round(body.length / 1024)} KB、残り ${store.size} 件）`);
        return sendJson(res, 201, { token, url: `${base}/r/${token}`, expiresAt });
      }
      if (url.pathname === '/api/server-info') {
        if (req.method !== 'GET') return sendText(res, 405, 'Method Not Allowed');
        return sendJson(res, 200, { receipts: true, lan: receiptBase() });
      }

      if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method Not Allowed');
      const file = resolveStatic(root, url.pathname);
      if (!file) return sendText(res, 404, 'Not Found');
      let st;
      try { st = await stat(file); } catch { return sendText(res, 404, 'Not Found'); }
      if (!st.isFile()) {
        // フォルダーは一覧を出さず、末尾に / を付けて index.html へ
        if (st.isDirectory() && !url.pathname.endsWith('/')) {
          return send(res, 301, '', { Location: url.pathname + '/' });
        }
        return sendText(res, 404, 'Not Found');
      }
      const type = MIME[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
      return send(res, 200, await readFile(file), { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    } catch (e) {
      if (e.status === 413) {
        // 残りの本文は読まずに接続を閉じる
        res.on('finish', () => req.destroy());
        if (!res.headersSent) send(res, 413, 'Request Too Large', { 'Content-Type': 'text/plain; charset=utf-8', Connection: 'close' });
        return;
      }
      if (!res.headersSent) sendText(res, 500, 'Server Error');
      log(`エラー：${e.message}`);
    }
  });
  return server;
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

function receiptPage(token, expiresAt) {
  const until = new Date(expiresAt).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Tokyo' });
  const img = `/r/${escapeHtml(token)}/receipt.png`;
  return `<!doctype html>
<html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex"><title>PROJECT CHROME レシート</title>
<style>
  body { margin: 0; background: #0b0d12; color: #e8ecf2; font: 16px/1.6 system-ui, sans-serif; text-align: center; }
  main { max-width: 480px; margin: 0 auto; padding: 20px 16px 40px; }
  h1 { font-size: 18px; letter-spacing: .08em; margin: 0 0 12px; }
  img { width: 100%; height: auto; border-radius: 8px; background: #fff; }
  a.btn { display: inline-block; margin-top: 16px; padding: 12px 24px; border-radius: 999px; background: #3dd6ff; color: #04121a; font-weight: 700; text-decoration: none; }
  p { color: #9aa6b8; font-size: 14px; }
</style></head>
<body><main>
  <h1>PROJECT CHROME</h1>
  <img src="${img}" alt="記念レシート">
  <a class="btn" href="${img}" download="project-chrome-receipt.png">画像を保存</a>
  <p>保存できない時は、画像を長押しして保存してください。<br>このページは ${until} ごろまで表示できます。<br>展示用のレシートです。決済は発生しません。</p>
</main></body></html>`;
}

// 来場者のスマホ用。/r/<トークン> と /r/<トークン>/receipt.png だけを返す
export function createLanServer({ store, log = () => {} }) {
  return createServer((req, res) => {
    try {
      if (req.method !== 'GET' && req.method !== 'HEAD') return sendText(res, 405, 'Method Not Allowed');
      const m = /^\/r\/([^/]+)(\/receipt\.png)?$/.exec(new URL(req.url, 'http://lan').pathname);
      const item = m && store.get(m[1]);
      const noStore = { 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex' };
      if (!item) {
        return send(res, 404, '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>受取期限切れ</title><body style="font-family:system-ui;text-align:center;padding:40px 16px">受取期限が過ぎたか、番号が正しくありません。</body></html>',
          { 'Content-Type': 'text/html; charset=utf-8', ...noStore });
      }
      if (m[2]) return send(res, 200, item.png, { 'Content-Type': 'image/png', ...noStore });
      log('レシートの受取ページが開かれました');
      return send(res, 200, receiptPage(m[1], item.expiresAt), {
        'Content-Type': 'text/html; charset=utf-8', ...noStore,
        'Content-Security-Policy': "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'",
      });
    } catch (e) {
      log(`エラー：${e.message}`);
      if (!res.headersSent) sendText(res, 500, 'Server Error');
    }
  });
}
