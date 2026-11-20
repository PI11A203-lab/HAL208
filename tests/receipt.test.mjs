import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECEIPT_STYLE, decorBars, drawReceipt, fitPhoto, formatReceiptDate, makeReceiptNo, receiptItems,
} from '../project-chrome/js/receipt.js';

const DATE = new Date(2026, 10, 20, 9, 5);

test('記念番号：日時とランダムな4文字。見間違えやすい文字は使わない', () => {
  assert.equal(makeReceiptNo(DATE, () => new Uint8Array([0, 1, 31, 32])), 'PC-261120-0905-AB9A');
  for (let i = 0; i < 50; i++) assert.match(makeReceiptNo(DATE), /^PC-261120-0905-[A-HJ-NP-Z2-9]{4}$/);
  assert.equal(formatReceiptDate(DATE), '2026/11/20 09:05');
});

test('品目：装着している物だけを載せる', () => {
  assert.deepEqual(receiptItems({ arm: 'MK-I', eyes: 'off', ears: null }), [{ label: 'ARMS', name: 'MK-I' }]);
  assert.deepEqual(receiptItems({ arm: 'NEON EDGE', eyes: 'lens', eyeColor: '#ffb300', ears: 'RABBIT LED' }).map((i) => i.name),
    ['NEON EDGE', 'COLOR LENS #FFB300', 'RABBIT LED']);
  assert.equal(receiptItems({ eyes: 'cyber', eyeColor: '#00e5ff' })[0].name, 'CYBER EYE #00E5FF');
  assert.deepEqual(receiptItems(), []);
});

test('写真は枠に収まる大きさにする', () => {
  assert.deepEqual(fitPhoto(1280, 720, 680, 520), { w: 680, h: 383 });
  assert.deepEqual(fitPhoto(720, 1280, 680, 520), { w: 293, h: 520 });
  assert.deepEqual(fitPhoto(0, 0, 640, 520), { w: 640, h: 360 });
});

test('飾りのバーコードは番号ごとに決まり、紙の幅に収まる', () => {
  const a = decorBars('PC-261120-0905-AB9A');
  assert.deepEqual(a, decorBars('PC-261120-0905-AB9A'));
  assert.notDeepEqual(a, decorBars('PC-261120-0905-XYZW'));
  assert.ok(a.every((b) => b >= 1 && b <= 3));
});

// 描画命令を記録する入れ物（canvas の代わり）
function recorder(height) {
  const calls = [];
  const ctx = { canvas: { height }, setLineDash() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() {}, strokeRect() {} };
  for (const name of ['fillText', 'fillRect', 'drawImage']) ctx[name] = (...args) => calls.push([name, ...args]);
  return { ctx, calls };
}

test('レシートの描画：写真・品目・合計 ¥0・「決済は発生しません」・記念番号が入り、すべて紙の中に収まる', () => {
  const data = { photo: 'PHOTO', photoW: 1280, photoH: 720, items: receiptItems({ arm: 'TITAN FRAME', ears: 'CLASSIC' }),
    no: 'PC-261120-0905-AB9A', date: DATE };
  const height = drawReceipt(null, data);
  const { ctx, calls } = recorder(height);
  assert.equal(drawReceipt(ctx, data), height);          // 測った高さと描いた高さが同じ
  const texts = calls.filter((c) => c[0] === 'fillText').map((c) => c[1]);
  for (const t of ['PROJECT CHROME', '記念レシート', 'TITAN FRAME', 'CLASSIC', '¥0', '展示用・決済は発生しません', 'PC-261120-0905-AB9A']) {
    assert.ok(texts.includes(t), t);
  }
  assert.ok(texts.some((t) => t.includes('2026/11/20 09:05')));
  const img = calls.find((c) => c[0] === 'drawImage');
  assert.equal(img[1], 'PHOTO');
  const W = RECEIPT_STYLE.width, pad = RECEIPT_STYLE.pad;
  assert.ok(img[2] >= pad && img[2] + img[4] <= W - pad, '写真が左右の余白に収まる');
  for (const [name, ...a] of calls) {
    if (name === 'fillText') assert.ok(a[2] > 0 && a[2] < height, `${a[0]} が紙の中`);
    if (name === 'fillRect' && a[3] !== height) assert.ok(a[0] >= pad / 2 && a[0] + a[2] <= W - pad / 2 && a[1] + a[3] < height, 'バーコードが紙の中');
  }
});
