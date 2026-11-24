// 仮想購入（#22）の進み方。画面・カメラ・通信には触れず、状態だけを決める（Node のテストで確認できるように）。
// 待機 → 案内 → 3・2・1 → 写真の確認 → レシートの準備 → QR 表示 →（終了で待機へ）
// 途中で失敗したらエラー表示、BACK・スタッフ用リセットではいつでも待機へ戻る。
// 時刻 now は秒（performance.now() / 1000 など）。

export const PURCHASE = Object.freeze({
  IDLE: 'idle',
  NOTICE: 'notice',            // 「展示用・決済は発生しません」の案内
  COUNTDOWN: 'countdown',      // 3・2・1 → 撮影
  PREVIEW: 'preview',          // 撮り直す / この写真で購入
  CONFIRMING: 'confirming',    // レシートを作ってサーバーへ登録中
  QR: 'qr',                    // 受取用 QR を表示中
  ERROR: 'error',
});

export const PURCHASE_EVENTS = Object.freeze({
  BUY: 'BUY',
  START_COUNTDOWN: 'START_COUNTDOWN',
  SHOOT: 'SHOOT',                    // カウントダウンが 0 になり撮影を頼んだ
  CAPTURED: 'CAPTURED',
  CAPTURE_FAILED: 'CAPTURE_FAILED',
  RETAKE: 'RETAKE',
  CONFIRM: 'CONFIRM',
  READY: 'READY',                    // QR の URL ができた
  FAILED: 'FAILED',
  CANCEL: 'CANCEL',
  RESET: 'RESET',
});

// 秒。案内・確認画面で操作が無い時は自動で待機へ戻す（次の来場者のため）
export const PURCHASE_TIMING = Object.freeze({
  countdownSec: 3,
  noticeSec: 30,
  previewSec: 45,
  qrSec: 120,
  errorSec: 10,
});

export function createPurchase() {
  return {
    phase: PURCHASE.IDLE,
    session: 0,        // BUY ごとに増える。前の回の撮影・通信の結果を取り違えないため
    request: 0,        // CONFIRM ごとに増える
    since: null,       // 今の段階に入った時刻
    shooting: false,
    url: null,
    error: null,
  };
}

const enter = (state, phase, now, extra = {}) => ({ ...state, phase, since: now ?? null, ...extra });

export function reducePurchase(state, event) {
  const E = PURCHASE_EVENTS;
  switch (event.type) {
    case E.BUY:
      if (state.phase !== PURCHASE.IDLE) return state;
      return enter(state, PURCHASE.NOTICE, event.now, { session: state.session + 1, url: null, error: null, shooting: false });

    case E.START_COUNTDOWN:
      if (state.phase !== PURCHASE.NOTICE) return state;
      return enter(state, PURCHASE.COUNTDOWN, event.now, { shooting: false });

    case E.SHOOT:
      if (state.phase !== PURCHASE.COUNTDOWN || state.shooting) return state;
      return { ...state, shooting: true };

    case E.CAPTURED:
      if (state.phase !== PURCHASE.COUNTDOWN || !state.shooting || event.session !== state.session) return state;
      return enter(state, PURCHASE.PREVIEW, event.now, { shooting: false });

    case E.CAPTURE_FAILED:
      if (state.phase !== PURCHASE.COUNTDOWN || event.session !== state.session) return state;
      return enter(state, PURCHASE.ERROR, event.now, { shooting: false, error: event.message ?? '撮影に失敗しました。' });

    case E.RETAKE:
      if (state.phase !== PURCHASE.PREVIEW) return state;
      return enter(state, PURCHASE.COUNTDOWN, event.now, { shooting: false });

    case E.CONFIRM:
      if (state.phase !== PURCHASE.PREVIEW) return state;
      return enter(state, PURCHASE.CONFIRMING, event.now, { request: state.request + 1 });

    case E.READY:
      if (state.phase !== PURCHASE.CONFIRMING || event.request !== state.request) return state;
      if (typeof event.url !== 'string' || event.url === '') return state;
      return enter(state, PURCHASE.QR, event.now, { url: event.url });

    case E.FAILED:
      if (state.phase !== PURCHASE.CONFIRMING || event.request !== state.request) return state;
      return enter(state, PURCHASE.ERROR, event.now, { error: event.message ?? 'レシートを準備できませんでした。' });

    case E.CANCEL:
      if (state.phase === PURCHASE.IDLE) return state;
      return enter(state, PURCHASE.IDLE, null, { shooting: false, url: null, error: null });

    case E.RESET:
      return { ...createPurchase(), session: state.session, request: state.request };

    default:
      return state;
  }
}

export const purchaseActive = (state) => state.phase !== PURCHASE.IDLE;

// カウントダウンの表示（3, 2, 1）。カウントダウン中でなければ null
export function countdownLeft(state, now, timing = PURCHASE_TIMING) {
  if (state.phase !== PURCHASE.COUNTDOWN || state.since === null) return null;
  return Math.max(0, Math.ceil(timing.countdownSec - (now - state.since)));
}

// 撮影を頼む時か（カウントダウンが終わり、まだ頼んでいない）
export function shouldShoot(state, now, timing = PURCHASE_TIMING) {
  return state.phase === PURCHASE.COUNTDOWN && !state.shooting && state.since !== null &&
    now - state.since >= timing.countdownSec;
}

// 操作が無いまま決めた時間が過ぎたか（過ぎたら CANCEL で待機へ戻す）
export function timedOut(state, now, timing = PURCHASE_TIMING) {
  if (state.since === null) return false;
  const limit = { [PURCHASE.NOTICE]: timing.noticeSec, [PURCHASE.PREVIEW]: timing.previewSec,
    [PURCHASE.QR]: timing.qrSec, [PURCHASE.ERROR]: timing.errorSec }[state.phase];
  return limit !== undefined && now - state.since >= limit;
}
