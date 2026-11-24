// 仮想購入（#22）の画面。状態は purchase-session.js が決め、ここでは表示とボタンをつなぐ。
// 撮影（requestShot）・登録（register）・QR 描画（drawQr）は外から受け取る（main.js とテストページで差し替えられるように）。
// 写真はこのブラウザーのメモリーにだけ置き、待機に戻ると捨てる。
import {
  PURCHASE, PURCHASE_EVENTS as E, PURCHASE_TIMING, createPurchase, reducePurchase, purchaseActive,
  countdownLeft, shouldShoot, timedOut,
} from './purchase-session.js';

export function createPurchaseFlow({
  $, requestShot, register, drawQr,
  clock = () => performance.now() / 1000, urlApi = URL, timing = PURCHASE_TIMING, onChange = () => {},
}) {
  let state = createPurchase();
  let photo = null, photoUrl = null;
  let shownPhase = null;

  const sections = {
    [PURCHASE.NOTICE]: 'pNotice', [PURCHASE.COUNTDOWN]: 'pCount', [PURCHASE.PREVIEW]: 'pPreview',
    [PURCHASE.CONFIRMING]: 'pBusy', [PURCHASE.QR]: 'pQr', [PURCHASE.ERROR]: 'pError',
  };

  function dropPhoto() {
    if (photoUrl) urlApi.revokeObjectURL(photoUrl);
    photo = null; photoUrl = null;
    $('pImg').removeAttribute('src');
  }

  function render(now) {
    const phase = state.phase;
    if (phase !== shownPhase) {
      $('purchase').hidden = phase === PURCHASE.IDLE;
      $('purchase').dataset.phase = phase;
      for (const [p, id] of Object.entries(sections)) $(id).hidden = p !== phase;
      if (phase === PURCHASE.ERROR) $('pErrorMsg').textContent = state.error;
      shownPhase = phase;
      onChange(phase);
    }
    if (phase === PURCHASE.COUNTDOWN) {
      const left = countdownLeft(state, now, timing);
      $('pCountNum').textContent = state.shooting || left === 0 ? '📸' : String(left);
    }
    if (phase === PURCHASE.QR) {
      const left = Math.max(0, Math.ceil(timing.qrSec - (now - state.since)));
      $('pQrTime').textContent = `この画面はあと ${left} 秒で閉じます`;
    }
  }

  function dispatch(event) {
    const now = clock();
    const before = state;
    state = reducePurchase(state, { now, ...event });
    if (before.phase !== PURCHASE.IDLE && state.phase === PURCHASE.IDLE) dropPhoto();
    render(now);
    return state !== before;
  }

  function shoot() {
    const session = state.session;
    dispatch({ type: E.SHOOT });
    Promise.resolve()
      .then(() => requestShot())
      .then((blob) => {
        if (state.session !== session || state.phase !== PURCHASE.COUNTDOWN) return;   // 取り消された回の写真は使わない
        dropPhoto();
        photo = blob;
        photoUrl = urlApi.createObjectURL(blob);
        $('pImg').src = photoUrl;
        dispatch({ type: E.CAPTURED, session });
      })
      .catch((e) => dispatch({ type: E.CAPTURE_FAILED, session, message: e?.message }));
  }

  async function confirm() {
    if (!dispatch({ type: E.CONFIRM })) return;
    const request = state.request;
    try {
      const { url } = await register(photo);
      if (state.request !== request || state.phase !== PURCHASE.CONFIRMING) return;
      await drawQr($('pQrCanvas'), url, { size: 280 });
      dispatch({ type: E.READY, request, url });
    } catch (e) {
      dispatch({ type: E.FAILED, request, message: e?.message });
    }
  }

  // 一定間隔（例 0.1 秒）で呼ぶ：カウントダウン表示・撮影・自動で閉じる
  function tick() {
    const now = clock();
    if (shouldShoot(state, now, timing)) shoot();
    else if (timedOut(state, now, timing)) dispatch({ type: E.CANCEL });
    else render(now);
  }

  $('pStart').onclick = () => dispatch({ type: E.START_COUNTDOWN });
  $('pRetake').onclick = () => { dropPhoto(); dispatch({ type: E.RETAKE }); };
  $('pConfirm').onclick = () => { confirm(); };
  for (const id of ['pNoticeCancel', 'pPreviewCancel', 'pDone', 'pErrorClose']) $(id).onclick = () => dispatch({ type: E.CANCEL });
  render(clock());

  return {
    buy: () => dispatch({ type: E.BUY }),
    cancel: () => dispatch({ type: E.CANCEL }),
    reset: () => { dispatch({ type: E.RESET }); dropPhoto(); },
    tick,
    get phase() { return state.phase; },
    get active() { return purchaseActive(state); },
    get state() { return state; },
  };
}
