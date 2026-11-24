import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  PURCHASE, PURCHASE_EVENTS as E, PURCHASE_TIMING, createPurchase, reducePurchase, countdownLeft, shouldShoot, timedOut,
} from '../project-chrome/js/purchase-session.js';
import { createPurchaseFlow } from '../project-chrome/js/purchase-ui.js';

const run = (events, state = createPurchase()) => events.reduce(reducePurchase, state);

test('購入の流れ：案内 → カウントダウン → 確認 → 準備 → QR → 終了で待機', () => {
  let s = run([{ type: E.BUY, now: 0 }]);
  assert.equal(s.phase, PURCHASE.NOTICE);
  assert.equal(s.session, 1);
  s = run([{ type: E.START_COUNTDOWN, now: 1 }, { type: E.SHOOT }, { type: E.CAPTURED, session: 1, now: 4 }], s);
  assert.equal(s.phase, PURCHASE.PREVIEW);
  s = run([{ type: E.CONFIRM, now: 5 }], s);
  assert.equal(s.phase, PURCHASE.CONFIRMING);
  s = run([{ type: E.READY, request: s.request, url: 'http://x/r/abc', now: 6 }], s);
  assert.equal(s.phase, PURCHASE.QR);
  assert.equal(s.url, 'http://x/r/abc');
  s = run([{ type: E.CANCEL }], s);
  assert.equal(s.phase, PURCHASE.IDLE);
  assert.equal(s.url, null);
});

test('撮り直すとカウントダウンからやり直す', () => {
  const s = run([{ type: E.BUY, now: 0 }, { type: E.START_COUNTDOWN, now: 1 }, { type: E.SHOOT },
    { type: E.CAPTURED, session: 1, now: 4 }, { type: E.RETAKE, now: 10 }]);
  assert.equal(s.phase, PURCHASE.COUNTDOWN);
  assert.equal(s.since, 10);
  assert.equal(s.shooting, false);
});

test('取り消した前の回の撮影結果・登録結果は使わない', () => {
  // 1回目の撮影中に BACK →もう一度購入。1回目の写真が後から届いても無視する
  let s = run([{ type: E.BUY, now: 0 }, { type: E.START_COUNTDOWN, now: 1 }, { type: E.SHOOT }, { type: E.CANCEL },
    { type: E.BUY, now: 5 }, { type: E.START_COUNTDOWN, now: 6 }, { type: E.SHOOT }]);
  assert.equal(run([{ type: E.CAPTURED, session: 1 }], s).phase, PURCHASE.COUNTDOWN);
  assert.equal(run([{ type: E.CAPTURE_FAILED, session: 1 }], s).phase, PURCHASE.COUNTDOWN);
  s = run([{ type: E.CAPTURED, session: 2, now: 9 }, { type: E.CONFIRM, now: 10 }], s);
  const old = s.request;
  s = run([{ type: E.CANCEL }, { type: E.BUY }, { type: E.START_COUNTDOWN }, { type: E.SHOOT },
    { type: E.CAPTURED, session: 3 }, { type: E.CONFIRM }], s);
  assert.equal(run([{ type: E.READY, request: old, url: 'http://old' }], s).phase, PURCHASE.CONFIRMING);
  assert.equal(run([{ type: E.FAILED, request: old }], s).phase, PURCHASE.CONFIRMING);
});

test('決まった順番以外の操作は無視する', () => {
  const idle = createPurchase();
  for (const type of [E.START_COUNTDOWN, E.SHOOT, E.RETAKE, E.CONFIRM, E.CANCEL]) assert.equal(reducePurchase(idle, { type }), idle, type);
  const notice = run([{ type: E.BUY }]);
  assert.equal(reducePurchase(notice, { type: E.BUY }), notice);
  assert.equal(reducePurchase(notice, { type: E.CONFIRM }), notice);
  const counting = run([{ type: E.START_COUNTDOWN }, { type: E.SHOOT }], notice);
  assert.equal(reducePurchase(counting, { type: E.SHOOT }), counting);
  // 空の URL では QR にしない
  const confirming = run([{ type: E.CAPTURED, session: 1 }, { type: E.CONFIRM }], counting);
  assert.equal(reducePurchase(confirming, { type: E.READY, request: confirming.request, url: '' }), confirming);
});

test('失敗するとエラー表示になり、理由を持つ', () => {
  const s = run([{ type: E.BUY }, { type: E.START_COUNTDOWN }, { type: E.SHOOT }, { type: E.CAPTURED, session: 1 }, { type: E.CONFIRM }]);
  const err = reducePurchase(s, { type: E.FAILED, request: s.request, message: 'サーバーが起動していません' });
  assert.equal(err.phase, PURCHASE.ERROR);
  assert.equal(err.error, 'サーバーが起動していません');
  const camErr = run([{ type: E.BUY }, { type: E.START_COUNTDOWN }, { type: E.CAPTURE_FAILED, session: 1 }]);
  assert.equal(camErr.phase, PURCHASE.ERROR);
  assert.match(camErr.error, /撮影/);
});

test('スタッフ用リセットは初期状態へ戻すが、回の番号は引き継ぐ', () => {
  const s = run([{ type: E.BUY }, { type: E.START_COUNTDOWN }, { type: E.RESET }]);
  assert.equal(s.phase, PURCHASE.IDLE);
  assert.equal(s.session, 1);
  assert.equal(run([{ type: E.BUY }], s).session, 2);
});

test('カウントダウンの表示・撮影の時・自動で閉じる時', () => {
  const T = PURCHASE_TIMING;
  const c = run([{ type: E.BUY, now: 0 }, { type: E.START_COUNTDOWN, now: 10 }]);
  assert.deepEqual([10, 10.5, 11.2, 12.9, 13].map((t) => countdownLeft(c, t)), [3, 3, 2, 1, 0]);
  assert.equal(shouldShoot(c, 12.9), false);
  assert.equal(shouldShoot(c, 13), true);
  assert.equal(shouldShoot(reducePurchase(c, { type: E.SHOOT }), 20), false);
  assert.equal(countdownLeft(createPurchase(), 0), null);
  const n = run([{ type: E.BUY, now: 0 }]);
  assert.equal(timedOut(n, T.noticeSec - 0.1), false);
  assert.equal(timedOut(n, T.noticeSec), true);
  assert.equal(timedOut(c, 1000), false);       // カウントダウン・準備中は時間切れにしない
  assert.equal(timedOut(createPurchase(), 1000), false);
});

/* ---- 画面（purchase-ui.js）：DOM の代わりに簡単な入れ物で確かめる ---- */
const IDS = ['purchase', 'pNotice', 'pCount', 'pCountNum', 'pPreview', 'pImg', 'pBusy', 'pQr', 'pQrCanvas', 'pQrTime',
  'pError', 'pErrorMsg', 'pStart', 'pNoticeCancel', 'pRetake', 'pConfirm', 'pPreviewCancel', 'pDone', 'pErrorClose'];

function makeFlow(opts = {}) {
  const els = Object.fromEntries(IDS.map((id) => [id, {
    hidden: true, textContent: '', dataset: {}, onclick: null, src: '',
    removeAttribute(name) { this[name] = ''; },
  }]));
  let now = 0;
  const urls = { made: 0, revoked: 0 };
  const phases = [];
  const flow = createPurchaseFlow({
    $: (id) => { assert.ok(els[id], `${id} が無い`); return els[id]; },
    requestShot: async () => 'PHOTO',
    register: async (photo) => ({ url: `http://192.168.0.5:8001/r/${photo}` }),
    drawQr: async (canvas, url) => { canvas.qr = url; },
    clock: () => now,
    urlApi: { createObjectURL: () => { urls.made++; return 'blob:1'; }, revokeObjectURL: () => { urls.revoked++; } },
    onChange: (p) => phases.push(p),
    ...opts,
  });
  return { flow, els, urls, phases, setNow: (t) => { now = t; } };
}
const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

test('画面：ボタン操作で最後まで進み、QR に受取 URL が入る', async () => {
  const { flow, els, urls, phases, setNow } = makeFlow();
  assert.equal(els.purchase.hidden, true);
  flow.buy();
  assert.equal(els.purchase.hidden, false);
  assert.equal(els.pNotice.hidden, false);
  els.pStart.onclick();
  assert.equal(els.pCount.hidden, false);
  setNow(1.2); flow.tick();
  assert.equal(els.pCountNum.textContent, '2');
  setNow(3); flow.tick();
  await settle();
  assert.equal(flow.phase, PURCHASE.PREVIEW);
  assert.equal(els.pImg.src, 'blob:1');
  els.pConfirm.onclick();
  assert.equal(els.pBusy.hidden, false);
  await settle();
  assert.equal(flow.phase, PURCHASE.QR);
  assert.equal(els.pQrCanvas.qr, 'http://192.168.0.5:8001/r/PHOTO');
  setNow(3 + 100); flow.tick();
  assert.match(els.pQrTime.textContent, /20 秒/);
  els.pDone.onclick();
  assert.equal(els.purchase.hidden, true);
  assert.equal(els.pImg.src, '');                 // 写真は捨てる
  assert.equal(urls.made, urls.revoked);
  assert.deepEqual(phases, ['idle', 'notice', 'countdown', 'preview', 'confirming', 'qr', 'idle']);
});

test('画面：サーバーが無い時はエラーを表示し、閉じると待機へ戻る', async () => {
  const { flow, els, setNow } = makeFlow({ register: async () => { throw new Error('レシートのサーバーが起動していません'); } });
  flow.buy(); els.pStart.onclick(); setNow(3); flow.tick(); await settle();
  els.pConfirm.onclick(); await settle();
  assert.equal(flow.phase, PURCHASE.ERROR);
  assert.match(els.pErrorMsg.textContent, /サーバー/);
  els.pErrorClose.onclick();
  assert.equal(flow.phase, PURCHASE.IDLE);
});

test('画面：撮影中に取り消すと、後から届いた写真は表示しない', async () => {
  let deliver;
  const { flow, els, setNow } = makeFlow({ requestShot: () => new Promise((r) => { deliver = r; }) });
  flow.buy(); els.pStart.onclick(); setNow(3); flow.tick(); await settle();
  flow.cancel();
  deliver('LATE'); await settle();
  assert.equal(flow.phase, PURCHASE.IDLE);
  assert.equal(els.pImg.src, '');
});

test('画面：操作が無ければ案内画面は自動で閉じる', () => {
  const { flow, setNow } = makeFlow();
  flow.buy();
  setNow(PURCHASE_TIMING.noticeSec + 1); flow.tick();
  assert.equal(flow.phase, PURCHASE.IDLE);
});

test('購入画面の要素が index.html にあり、案内に「決済は発生しません」がある', async () => {
  const html = await readFile(new URL('../project-chrome/index.html', import.meta.url), 'utf8');
  for (const id of [...IDS, 'buy']) assert.match(html, new RegExp(`id="${id}"`), id);
  assert.match(html, /決済は発生しません/);
});
