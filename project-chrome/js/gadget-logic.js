// 腕のギミック（射出・ロケットフィスト・指先の火）の動きの計算とジェスチャー判定。
// three.js・DOMに依存しない関数だけを置き、Nodeの自動テストから直接検査します。
// 参考にしたゲームの仕組み：ロックマンの「チャージショット」（溜めるほど大きな弾）、
// ロックマンV の「ロケットパンチ」、Overwatch の Doomfist（溜めて放つ）、Cyberpunk 2077 の腕の射出システム。

export const GADGET_KINDS = ['plasma', 'net', 'hook', 'fist'];

// AUTO（ジェスチャーで選ぶ）の時の、手の形・動きとギミックの対応。画面の操作ガイドにも使います。
//   point：人差し指だけを上へ立てる → 指先の火
//   open ：腕を上げて手を開く → PLASMA を溜め、拳を握るか腕を下ろすと発射
//   spider：人差し指と小指を立てる → NET（スパイダーマンのウェブ）
//   pistol：人差し指を横・前へ向け、親指を立てる（ピストル）→ HOOK
//   punch：拳を握って肘を勢いよく伸ばす → FIST（ロケットパンチ）
export const GESTURE_TO_GADGET = { spider: 'net', pistol: 'hook' };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => { const t = clamp01(x); return t * t * (3 - 2 * t); };

// 射出の各段階の長さ（秒）。power：溜めの強さ（0〜1）
export function shotTiming(kind, power = 1) {
  const p = clamp01(power);
  const base = { open: 0.25, extend: 0.2, fly: 0.3 + 0.15 * p, impact: 0.4, reel: 0, retract: 0.2, close: 0.25 };
  if (kind === 'net') return { ...base, impact: 0.9 };
  if (kind === 'hook') return { ...base, impact: 0.45, reel: 0.45 };
  if (kind === 'fist') return { ...base, open: 0, extend: 0, retract: 0, close: 0, impact: 0.25, reel: 0.5 };
  return { ...base, impact: 0.35 }; // plasma：命中で弾ける
}

// 発射からの経過秒数を、各部品の動き（0〜1）に変換する。
// opened：溜めている間にふたと砲身がすでに開いている時は true（開く段階を飛ばす）
// 戻り値：hatch（ふた）、barrel（砲身）、travel（飛距離の割合）、impact（命中後の広がり）、fade（消えていく割合）、
//         flying（弾が出ている間）、active（動作中）
export function shotPhase(elapsed, kind, power = 1, { opened = false } = {}) {
  const t = shotTiming(kind, power);
  const order = ['open', 'extend', 'fly', 'impact', 'reel', 'retract', 'close'];
  const start = {};
  let acc = opened ? -(t.open + t.extend) : 0;
  for (const s of order) { start[s] = acc; acc += t[s]; }
  const total = acc;
  const idle = { hatch: 0, barrel: 0, travel: 0, impact: 0, fade: 0, flying: false, active: false };
  if (!(elapsed >= 0) || elapsed >= total) return idle;
  const p = (s) => (t[s] === 0 ? (elapsed >= start[s] ? 1 : 0) : clamp01((elapsed - start[s]) / t[s]));
  const reel = t.reel > 0 ? p('reel') : 0;
  const returns = t.reel > 0;
  return {
    hatch: (opened ? 1 : ease(p('open'))) * (1 - ease(p('close'))),
    barrel: (opened ? 1 : ease(p('extend'))) * (1 - ease(p('retract'))),
    travel: (1 - (1 - p('fly')) ** 3) * (returns ? 1 - ease(reel) : 1),
    impact: ease(p('impact') * 3) * (returns ? 1 - ease(reel) : 1),
    fade: returns ? ease(reel) : ease(p('impact')),
    flying: elapsed >= start.fly && elapsed < start.retract,
    active: true,
  };
}

export function shotDuration(kind, power = 1, opened = false) {
  const t = shotTiming(kind, power);
  return Object.values(t).reduce((a, b) => a + b, 0) - (opened ? t.open + t.extend : 0);
}

// 構え：肘をまっすぐ伸ばし、手首を肩の高さ付近より上に向けている
// sh, el, wr：ピクセル座標 { x, y }（y は下向き）
export function isAimPose(sh, el, wr, { minAngle = 150, below = 0.25 } = {}) {
  const angle = elbowAngle(sh, el, wr);
  return angle !== null && angle >= minAngle && wr.y <= sh.y + Math.hypot(sh.x - el.x, sh.y - el.y) * below;
}

// 肘の角度（度）。180＝まっすぐ。腕の長さが0の時は null
export function elbowAngle(sh, el, wr) {
  const ux = sh.x - el.x, uy = sh.y - el.y, vx = wr.x - el.x, vy = wr.y - el.y;
  const lu = Math.hypot(ux, uy), lv = Math.hypot(vx, vy);
  if (lu < 1 || lv < 1) return null;
  const cos = (ux * vx + uy * vy) / (lu * lv);
  return Math.acos(Math.min(1, Math.max(-1, cos))) * 180 / Math.PI;
}

/* ---------------- 手のジェスチャー（21点、各点は [x, y, z]） ---------------- */
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
// 3点 a-b-c の b での角度（度）。180＝まっすぐ
function jointAngle(a, b, c) {
  const u = [0, 1, 2].map((k) => a[k] - b[k]), v = [0, 1, 2].map((k) => c[k] - b[k]);
  const lu = Math.hypot(...u), lv = Math.hypot(...v);
  if (lu < 1e-6 || lv < 1e-6) return 180;
  const cos = (u[0] * v[0] + u[1] * v[1] + u[2] * v[2]) / (lu * lv);
  return Math.acos(Math.min(1, Math.max(-1, cos))) * 180 / Math.PI;
}
// 指の状態：1＝伸びている、0＝曲がっている、0.5＝どちらとも言えない（形の途中・判定が不安定）。
// 指先が第2関節より手首から十分遠く、第2関節でまっすぐな時だけ「伸びている」とし、
// はっきり曲がっている時だけ「曲がっている」とする。その間は迷いとして扱い、似た形を取り違えないようにする。
export function fingerState(pts, mcp, pip, tip) {
  const ratio = dist(pts[tip], pts[0]) / Math.max(1e-6, dist(pts[pip], pts[0]));
  const bend = jointAngle(pts[mcp], pts[pip], pts[tip]);
  if (ratio > 1.12 && bend > 140) return 1;
  if (ratio < 1.0 || bend < 110) return 0;
  return 0.5;
}
export function fingerExtended(pts, tip, pip) {
  return fingerState(pts, pip - 1, pip, tip) === 1;
}
const fingers = (pts) => [[5, 6, 8], [9, 10, 12], [13, 14, 16], [17, 18, 20]].map(([m, p, t]) => fingerState(pts, m, p, t));
const palmWidth = (pts) => Math.max(1e-6, dist(pts[5], pts[17]));
// 親指の状態：1＝横に立てている、0＝たたんでいる、0.5＝どちらとも言えない
export function thumbState(pts) {
  const w = palmWidth(pts);
  const toIndex = dist(pts[4], pts[5]) / w, toMiddle = dist(pts[4], pts[9]) / w;
  if (toIndex > 0.75 && toMiddle > 0.95) return 1;
  if (toIndex < 0.6 || toMiddle < 0.7) return 0;
  return 0.5;
}
export const isThumbOut = (pts) => thumbState(pts) === 1;
// 人差し指の向き（画面上で上向きなら 1、真横なら 0、下向きなら -1）。指が短く見える（カメラへ向けている）時は null
export function indexUpness(pts) {
  const dx = pts[8][0] - pts[5][0], dy = pts[8][1] - pts[5][1];
  const len = Math.hypot(dx, dy);
  if (len < palmWidth(pts) * 0.5) return null;
  return dy / len;
}
// 手の形を1つに分類する：'open' | 'fist' | 'point' | 'pistol' | 'spider' | null（どれでもない・迷っている）
// ・point（火）：人差し指だけを「上へ」立てる
// ・pistol（HOOK）：人差し指を「横・前へ」向け、親指を立てる
// 火とピストルは指の向きで分けるので、親指の形が少しあいまいでも取り違えない。
// 点の y は上向き（シーン座標）を前提にする。
export function classifyHand(pts) {
  const f = fingers(pts);
  const [i, m, r, s] = f;
  if (f.every((x) => x === 1)) return 'open';
  if (f.every((x) => x === 0)) return 'fist';
  if (i === 1 && m === 0 && r === 0 && s === 1) return 'spider';
  if (i === 1 && m === 0 && r === 0 && s === 0) {
    const up = indexUpness(pts);
    if (up === null) return null;
    if (up > 0.7) return 'point';                               // 上へ（45°以内）
    if (up < 0.5 && thumbState(pts) === 1) return 'pistol';     // 横・前へ（60°以上傾く）＋親指
    return null;
  }
  return null;
}
export const isPointing = (pts) => classifyHand(pts) === 'point';
export const isFist = (pts) => fingers(pts).every((e) => e === 0);
export const isOpenHand = (pts) => fingers(pts).every((e) => e === 1);

// 手の形のゆれを抑える：直近 window フレームのうち need 回以上同じ形の時だけ、その形を返す
export function createStableLabel({ window = 6, need = 4 } = {}) {
  const history = [];
  return {
    update(label) {
      history.push(label);
      if (history.length > window) history.shift();
      const counts = new Map();
      for (const l of history) if (l !== null) counts.set(l, (counts.get(l) ?? 0) + 1);
      for (const [l, n] of counts) if (n >= need) return l;
      return null;
    },
    reset() { history.length = 0; },
  };
}

// 同じ手の形を hold 秒続けた時に1回だけ、その形を返す。形を変えるまで次は返さない
export function createGestureTrigger({ hold = 0.2 } = {}) {
  let label = null, since = 0, fired = false;
  return {
    update(now, next) {
      if (next !== label) { label = next; since = now; fired = false; }
      if (label === null || fired || now - since < hold) return null;
      fired = true;
      return label;
    },
    reset() { label = null; fired = false; },
  };
}

// パンチ：肘が bent 度より曲がった状態から、window 秒以内に straight 度以上まで伸びたら true
// allowed：拳を握っている（手を追跡していない時は腕の動きだけで判定）
export function createPunchDetector({ bent = 110, straight = 150, window = 0.35 } = {}) {
  let lastBent = -Infinity;
  return {
    update(now, angle, allowed = true) {
      if (angle === null) return false;
      if (angle < bent) { lastBent = now; return false; }
      if (angle >= straight && now - lastBent <= window && allowed) { lastBent = -Infinity; return true; }
      return false;
    },
    reset() { lastBent = -Infinity; },
  };
}

// 溜めと発射の制御（1本の腕につき1つ）。
// ・構えると溜め始め、溜めている間 charge が 0→1 に増える
// ・構えを解く、または（手を追跡していて）握った拳を開くと発射。溜めが短すぎる時は何もしない
// ・満タンのまま autoFire 秒続けると自動で発射
// ・発射後は動作が終わり、いったん構えを解くまで次を溜めない
export function createChargeController({ minHold = 0.15, fullCharge = 1.0, autoFire = 0.8 } = {}) {
  let mode = 'idle', start = 0, fullAt = null, sawFist = false, busyUntil = -Infinity, armed = true;
  const self = {
    charge: 0,
    held: 0, // 溜め始めてからの秒数（ふたを開く動きに使う）
    get mode() { return mode; },
    // input：{ aiming, fist, open, tracked }。発射する時は { power } を返す
    update(now, { aiming = false, fist = false, open = false, tracked = false } = {}) {
      if (now < busyUntil) { self.charge = 0; self.held = 0; if (!aiming) armed = true; return null; }
      if (mode === 'idle') {
        self.held = 0;
        if (!aiming) { armed = true; return null; }
        if (!armed) return null;
        mode = 'charging'; start = now; fullAt = null; sawFist = false;
      }
      const held = now - start;
      self.held = held;
      self.charge = clamp01((held - minHold) / fullCharge);
      if (self.charge >= 1 && fullAt === null) fullAt = now;
      if (fist) sawFist = true;
      const release = !aiming || (tracked && sawFist && open);
      const auto = fullAt !== null && now - fullAt >= autoFire;
      if (!release && !auto) return null;
      mode = 'idle';
      armed = !aiming;
      const power = self.charge;
      self.charge = 0;
      self.held = 0;
      return held >= minHold ? { power } : null;
    },
    // 動作が終わるまで新しい溜めを受け付けない
    busy(untilTime) { busyUntil = untilTime; mode = 'idle'; self.charge = 0; self.held = 0; },
    reset() { mode = 'idle'; busyUntil = -Infinity; armed = true; self.charge = 0; self.held = 0; },
  };
  return self;
}
