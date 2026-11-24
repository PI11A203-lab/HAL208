// 待機画面（アトラクトモード）の進み方。画面には触れない純粋な処理（Node のテストで確認できるように）。
// 待機 → 人が来た（スキャン中） → 1秒続いたらようこそ → 体験中 → 人がいなくなって一定時間 → またのお越しを → リセットして待機へ。
// 時刻 now は秒。

export const ATTRACT = Object.freeze({
  IDLE: 'idle',          // 誰もいない：待機画面
  SCANNING: 'scanning',  // 人が来た：スキャン中（通りがかりで始まらないよう、少し待つ）
  ACTIVE: 'active',      // 体験中（通常の画面）
  LEAVING: 'leaving',    // いなくなった：またのお越しを（この後リセット）
});

export const ATTRACT_DEFAULTS = Object.freeze({
  minVis: 0.5,           // 肩がこれより見えにくい時は「いない」
  minShoulder: 0.1,      // 肩幅（映像の幅に対する割合）がこれより小さい＝遠すぎる人は数えない
  centerMargin: 0.15,    // 映像の左右の端（この割合）にいる人は数えない（横を通る人・スタッフ）
  enterSec: 1.0,         // この時間いたら始める
  leaveSec: 8,           // この時間いなかったら終わる
  holdLeaveSec: 30,      // QR を表示している時などは長めに待つ（スマホで読み取る間に少し離れても続ける）
  goodbyeSec: 2.5,       // 「またのお越しを」を出す時間
});

// カメラの前に体験する人がいるか（Pose の33点）。{ present, reason } を返す。
// reason：'none'（見つからない）| 'far'（遠すぎる）| 'edge'（画面の端）| 'ok'
// 肩が見えていれば肩幅で、肩が映らないほど近い時（PCの前に座っている時など）は顔（耳・目の間隔）で判断する
export function presence(lm, opts = ATTRACT_DEFAULTS) {
  const ok = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= opts.minVis;
  const dist = (p, q) => Math.hypot(p.x - q.x, p.y - q.y);
  let width = null, mid = null;
  if (ok(lm?.[11]) && ok(lm?.[12])) {
    width = dist(lm[11], lm[12]); mid = (lm[11].x + lm[12].x) / 2;
  } else if (ok(lm?.[0])) {
    // 顔から肩幅を見積もる（肩幅はおよそ耳の間隔の1.8倍、目の間隔の4.5倍）
    if (ok(lm[7]) && ok(lm[8])) width = dist(lm[7], lm[8]) * 1.8;
    else if (ok(lm[2]) && ok(lm[5])) width = dist(lm[2], lm[5]) * 4.5;
    mid = lm[0].x;
  }
  if (width === null) return { present: false, reason: 'none' };
  if (width < opts.minShoulder) return { present: false, reason: 'far' };
  if (mid < opts.centerMargin || mid > 1 - opts.centerMargin) return { present: false, reason: 'edge' };
  return { present: true, reason: 'ok' };
}

export const personPresent = (lm, opts = ATTRACT_DEFAULTS) => presence(lm, opts).present;

// 毎フレーム update({ present, hold }, now) を呼ぶ。
// 戻り値 { state, progress（スキャンの進み 0〜1）, event：'welcome'（始まった）| 'reset'（リセットする）| null }
// hold：長めに待つ時（QR の表示中など）
export function createAttract(options = {}) {
  const o = { ...ATTRACT_DEFAULTS, ...options };
  let state = ATTRACT.IDLE, since = 0, lastSeen = -Infinity;
  const go = (next, now) => { state = next; since = now; };
  return {
    update({ present, hold = false }, now) {
      let event = null;
      if (present) lastSeen = now;
      if (state === ATTRACT.IDLE) {
        if (present) go(ATTRACT.SCANNING, now);
      } else if (state === ATTRACT.SCANNING) {
        if (!present) go(ATTRACT.IDLE, now);
        else if (now - since >= o.enterSec) { go(ATTRACT.ACTIVE, now); event = 'welcome'; }
      } else if (state === ATTRACT.ACTIVE) {
        if (!present && now - lastSeen >= (hold ? o.holdLeaveSec : o.leaveSec)) go(ATTRACT.LEAVING, now);
      } else if (state === ATTRACT.LEAVING) {
        if (present) go(ATTRACT.ACTIVE, now);                 // 戻ってきたら続ける
        else if (now - since >= o.goodbyeSec) { go(ATTRACT.IDLE, now); event = 'reset'; }
      }
      const progress = state === ATTRACT.SCANNING ? Math.min(1, (now - since) / o.enterSec) : state === ATTRACT.IDLE ? 0 : 1;
      return { state, progress, event };
    },
    // スタッフ用：すぐに待機画面へ／すぐに体験中へ
    reset(now = 0) { go(ATTRACT.IDLE, now); lastSeen = -Infinity; },
    skip(now = 0) { go(ATTRACT.ACTIVE, now); lastSeen = now; },
    get state() { return state; },
  };
}

// 商品ショーケースで今出す商品の番号（cycleSec ごとに次へ）
export function showcaseIndex(now, count, cycleSec = 4) {
  if (!(count > 0)) return -1;
  return Math.floor(Math.max(0, now) / cycleSec) % count;
}
