// 展示用サーバーを起動する：npm run serve
// ・展示PC のブラウザーで http://localhost:8000/ を開く（カメラは localhost でだけ使える）
// ・レシートの QR は、同じ Wi-Fi のスマホから http://<このPCのLANアドレス>:8001/r/<番号> で開ける
// 環境変数：PORT（展示画面、標準 8000）、LAN_PORT（スマホ用、標準 8001）、
//           RECEIPT_HOST（QR に入れるアドレスを手で決める時。例 192.168.0.5）
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createLanServer, createLocalServer, createReceiptStore, findLanAddress, RECEIPT_DEFAULTS } from './receipt-server.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'project-chrome');
const port = Number(process.env.PORT ?? 8000);
const lanPort = Number(process.env.LAN_PORT ?? 8001);
const log = (msg) => console.log(`[${new Date().toLocaleTimeString('ja-JP')}] ${msg}`);

const store = createReceiptStore();
const sweeper = setInterval(store.sweep, RECEIPT_DEFAULTS.sweepMs);
sweeper.unref();

// Wi-Fi が付け替わってもよいよう、毎回アドレスを調べる
const lanHost = () => process.env.RECEIPT_HOST || findLanAddress();
const receiptBase = () => {
  const host = lanHost();
  return host ? `http://${host.includes(':') ? `[${host}]` : host}:${lanPort}` : null;
};

const local = createLocalServer({ root, store, receiptBase, log });
const lan = createLanServer({ store, log });

local.on('error', (e) => { console.error(`展示画面のサーバーを起動できません（ポート ${port}）：${e.message}`); process.exit(1); });
lan.on('error', (e) => { console.error(`スマホ用のサーバーを起動できません（ポート ${lanPort}）：${e.message}`); process.exit(1); });

local.listen(port, '127.0.0.1', () => {
  lan.listen(lanPort, '0.0.0.0', () => {
    log(`展示画面：http://localhost:${port}/`);
    log(`QR 受取テスト：http://localhost:${port}/dev/qr-test.html`);
    const base = receiptBase();
    log(base ? `スマホ用（同じ Wi-Fi）：${base}/r/<番号>`
      : 'この PC に LAN の IPv4 アドレスがありません（Wi-Fi 未接続、または IPv6 だけの回線）。この状態ではスマホから受け取れません。');
    log(`画像はメモリーにだけ置き、${RECEIPT_DEFAULTS.ttlMs / 60000} 分で消えます。止める時は Ctrl+C。`);
  });
});

const stop = () => {
  store.clear();
  local.close();
  lan.close();
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
