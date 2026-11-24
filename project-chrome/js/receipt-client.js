// レシート画像をサーバー（npm run serve）に登録し、スマホで受け取るための QR を描く。
// QR の作成には qrcode-generator（MIT、vendor/qrcode-generator）を使う。
// QR が要る時（購入の最後）にだけ読み込む。
const loadQrcode = () => import('../vendor/qrcode-generator/qrcode.mjs').then((m) => m.default);

// 登録のたびに付ける番号。購入を取り消した時に、この番号でサーバーのレシートを消す（cancelReceipt）
export function newRequestId(random = (n) => crypto.getRandomValues(new Uint8Array(n))) {
  return btoa(String.fromCharCode(...random(16))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// PNG を登録して { token, url, expiresAt } を返す。
// signal で途中で止められる（止めた時は name が AbortError のエラー）。
// サーバーが無い（python の http.server で開いている等）・LAN が無い時は理由つきのエラーにする
export async function registerReceipt(blob, { fetchImpl = fetch, endpoint = '/api/receipts', signal, requestId } = {}) {
  const headers = { 'Content-Type': 'image/png' };
  if (requestId) headers['X-Receipt-Request'] = requestId;
  let res;
  try {
    res = await fetchImpl(endpoint, { method: 'POST', headers, body: blob, signal });
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error('レシートのサーバーに接続できません（npm run serve で起動してください）。', { cause: e });
  }
  if (res.status === 404 || res.status === 405 || res.status === 501) {
    throw new Error('レシートのサーバーが起動していません（npm run serve で起動してください）。');
  }
  let data = null;
  try { data = await res.json(); } catch (e) { if (signal?.aborted) throw e; /* 本文が JSON でない */ }
  if (!res.ok || !data?.url) throw new Error(data?.error ?? `レシートを登録できませんでした（${res.status}）。`);
  return data;
}

// 購入を取り消した時：その登録番号のレシートをサーバーから消す（まだ届いていない登録も保存させない）。
// 失敗しても画面は止めない（サーバー側でも有効期限で消える）
export async function cancelReceipt(requestId, { fetchImpl = fetch, endpoint = '/api/receipts' } = {}) {
  if (!requestId) return false;
  try {
    const res = await fetchImpl(endpoint, { method: 'DELETE', headers: { 'X-Receipt-Request': requestId }, keepalive: true });
    return res.ok;
  } catch {
    return false;
  }
}

// text の QR の白黒（true が黒）。誤り訂正は M（少し汚れても読める）
export async function makeQrMatrix(text, level = 'M') {
  const qrcode = await loadQrcode();
  const qr = qrcode(0, level);
  qr.addData(text);
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => qr.isDark(r, c)));
}

// canvas に QR を描く（周りに 4 マスの白い余白。読み取りに必要）
export async function drawQr(canvas, text, { size = 256, margin = 4, dark = '#000', light = '#fff' } = {}) {
  const m = await makeQrMatrix(text);
  const cells = m.length + margin * 2;
  const cell = Math.max(1, Math.floor(size / cells));
  canvas.width = canvas.height = cell * cells;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = dark;
  m.forEach((row, r) => row.forEach((on, c) => {
    if (on) ctx.fillRect((c + margin) * cell, (r + margin) * cell, cell, cell);
  }));
  return canvas;
}
