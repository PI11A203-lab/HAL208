// タッチレス操作（#36）：体の追跡（Pose）の人差し指の点から画面上のカーソル位置を求め、
// ボタンの上で一定時間止まったかを判定する。画面（DOM）には触れない純粋な処理（Node のテストで確認できるように）。
// 手の追跡（HandLandmarker）ではなく Pose を使う：毎フレームすでに動いていて負荷が増えず、
// 展示の距離（1.5〜2m）でも人差し指の位置が取れるため。
import { OneEuro } from './tracking.js';

// Pose の点の番号（MediaPipe）
const P = Object.freeze({
  left: { shoulder: 11, elbow: 13, wrist: 15, index: 19 },
  right: { shoulder: 12, elbow: 14, wrist: 16, index: 20 },
});

export const HAND_POINTER_DEFAULTS = Object.freeze({
  minVis: 0.5,          // これより見えにくい点は使わない
  raiseMargin: 0.02,    // 手首が肘よりこれだけ上なら「手を上げている」（画像の高さに対する割合）
  // 操作範囲（肩幅を 1 とした大きさ）：指す側の肩を中心に、この範囲を画面全体へ対応させる
  box: Object.freeze({ halfWidth: 1.1, top: 1.5, bottom: 0.3, outward: 0.15 }),
  minCutoff: 1.0,       // 平滑化（One Euro）：小さいほど震えを抑える
  beta: 4,              // 平滑化：速く動かした時の追従
  lostSec: 0.3,         // 手を下ろしてから消すまで
  dwellSec: 1.0,        // ボタンの上で止める時間
  cooldownSec: 0.6,     // 選んだ後、次を数え始めるまでの待ち
});

const visible = (p, minVis) => Boolean(p) && Number.isFinite(p.x) && Number.isFinite(p.y) && (p.visibility ?? 1) >= minVis;
const clamp01 = (v) => Math.min(1, Math.max(0, v));

// その手を上げて指しているか（手首が肘より上、人差し指・肩が見えている）
export function isRaised(lm, side, opts = HAND_POINTER_DEFAULTS) {
  const ids = P[side];
  if (!lm || !ids) return false;
  const [s, e, w, i] = [ids.shoulder, ids.elbow, ids.wrist, ids.index].map((k) => lm[k]);
  if (![s, e, w, i].every((p) => visible(p, opts.minVis))) return false;
  return w.y < e.y - opts.raiseMargin;
}

// 指す手を決める。今の手が上がっている間は切り替えない（左右がぱたぱた変わらないように）。
// 両手が上がっていて今の手が無い時は、より高く上げている手
export function pickPointingHand(lm, current = null, opts = HAND_POINTER_DEFAULTS) {
  if (current && isRaised(lm, current, opts)) return current;
  const raised = ['right', 'left'].filter((side) => isRaised(lm, side, opts));
  if (raised.length === 0) return null;
  return raised.reduce((a, b) => (lm[P[b].wrist].y < lm[P[a].wrist].y ? b : a));
}

// 人差し指の点 → 画面の位置（0〜1、左上が 0）。映像は鏡映しで表示しているので左右を反転する
export function pointerFromPose(lm, side, opts = HAND_POINTER_DEFAULTS) {
  const ids = P[side];
  if (!lm || !ids) return null;
  const l = lm[P.left.shoulder], r = lm[P.right.shoulder], s = lm[ids.shoulder], i = lm[ids.index];
  if (![l, r, s, i].every((p) => visible(p, opts.minVis))) return null;
  const sw = Math.hypot(l.x - r.x, l.y - r.y);
  if (!(sw > 0.01)) return null;
  const b = opts.box;
  // 指す側の肩から少し外側を中心にする（体の外へ腕を伸ばす方が楽なため）
  const outwardSign = Math.sign(s.x - (l.x + r.x) / 2) || 1;
  const cx = s.x + outwardSign * b.outward * sw;
  const left = cx - b.halfWidth * sw, width = 2 * b.halfWidth * sw;
  const top = s.y - b.top * sw, height = (b.top + b.bottom) * sw;
  return { x: clamp01(1 - (i.x - left) / width), y: clamp01((i.y - top) / height) };
}

// Pose の結果（1人分の33点）を毎フレーム渡すと、平滑化したカーソル位置 { x, y, hand } か null を返す
export function createHandPointer(options = {}) {
  const opts = { ...HAND_POINTER_DEFAULTS, ...options, box: { ...HAND_POINTER_DEFAULTS.box, ...options.box } };
  const fx = new OneEuro(), fy = new OneEuro();
  let hand = null, lastSeen = -Infinity, last = null;
  return {
    update(lm, now) {
      const next = lm ? pickPointingHand(lm, hand, opts) : null;
      const raw = next ? pointerFromPose(lm, next, opts) : null;
      if (!raw) {
        // 少しの間は最後の位置を保つ（一瞬見失っても消えない）。それ以上は消して平滑化も最初から
        if (now - lastSeen > opts.lostSec) { hand = null; last = null; fx.reset(); fy.reset(); }
        return last;
      }
      if (next !== hand || now - lastSeen > opts.lostSec) { fx.reset(); fy.reset(); }
      hand = next;
      lastSeen = now;
      last = { x: fx.filter(raw.x, now, opts.minCutoff, opts.beta), y: fy.filter(raw.y, now, opts.minCutoff, opts.beta), hand };
      return last;
    },
    reset() { hand = null; last = null; lastSeen = -Infinity; fx.reset(); fy.reset(); },
  };
}

// ドウェル選択：同じ対象の上に dwellSec 止まると一度だけ fire。
// 選んだ後は、対象から外れるまで同じ対象を選び直さない（押しっぱなしで何度も切り替わらないように）
export function createDwell({ dwellSec = HAND_POINTER_DEFAULTS.dwellSec, cooldownSec = HAND_POINTER_DEFAULTS.cooldownSec } = {}) {
  let target = null, start = 0, fired = false, coolUntil = -Infinity;
  return {
    update(next, now) {
      if (next !== target) { target = next; start = Math.max(now, coolUntil); fired = false; }
      if (!target || fired) return { target, progress: fired ? 1 : 0, fire: false };
      if (now < coolUntil) return { target, progress: 0, fire: false };
      const progress = Math.min(1, (now - start) / dwellSec);
      if (progress >= 1) { fired = true; coolUntil = now + cooldownSec; return { target, progress: 1, fire: true }; }
      return { target, progress, fire: false };
    },
    reset() { target = null; fired = false; },
  };
}

/* ---- 体験中のメニュー切替（両手を上げる）と、カーソル／ギミックの使い分け ---- */

// 両手を上げているか（両手首が鼻より上）。体験中にメニューへ切り替える合図。ギミックでは使わない形
export function bothHandsUp(lm, opts = HAND_POINTER_DEFAULTS) {
  if (!lm) return false;
  const nose = lm[0], lw = lm[P.left.wrist], rw = lm[P.right.wrist];
  if (![nose, lw, rw].every((p) => visible(p, opts.minVis))) return false;
  return lw.y < nose.y && rw.y < nose.y;
}

// 両手を holdSec 上げ続けるとメニュー ON／OFF を切り替える。上げたままでは繰り返さない。
// メニュー中にカーソルを idleSec 使わなければ自動で戻る（ギミックへ）
export function createMenuToggle({ holdSec = 1.0, idleSec = 6 } = {}) {
  let active = false, upSince = null, latched = false, lastUse = -Infinity;
  return {
    update({ bothUp, pointing }, now) {
      if (bothUp) {
        if (upSince === null) upSince = now;
        if (!latched && now - upSince >= holdSec) { active = !active; latched = true; lastUse = now; }
      } else { upSince = null; latched = false; }
      if (active && pointing) lastUse = now;
      if (active && !bothUp && now - lastUse >= idleSec) active = false;
      const progress = bothUp && !latched && upSince !== null ? Math.min(1, (now - upSince) / holdSec) : 0;
      return { active, progress };
    },
    reset() { active = false; upSince = null; latched = false; lastUse = -Infinity; },
    get active() { return active; },
  };
}

// その時に手で何を操作するか：{ cursor：カーソルを出すか, gimmicks：ギミックを動かすか, menuToggle：両手でメニュー切替できるか }
// phase：体験の段階（select / equipping / action）、purchase：仮想購入の段階（idle など）、menu：体験中のメニューが ON か
export function handModes({ phase, purchase = 'idle', menu = false }) {
  if (phase === 'select') return { cursor: true, gimmicks: false, menuToggle: false };
  if (phase !== 'action') return { cursor: false, gimmicks: false, menuToggle: false };
  // 購入中：カウントダウンの間はギミックでポーズ、案内・確認・QR・エラーの画面ではカーソル
  if (purchase === 'countdown') return { cursor: false, gimmicks: true, menuToggle: false };
  if (purchase !== 'idle') return { cursor: purchase !== 'confirming', gimmicks: false, menuToggle: false };
  return { cursor: menu, gimmicks: !menu, menuToggle: true };
}
