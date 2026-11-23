// 手のジェスチャー判定（純粋ロジック）。DOM・Three.js・MediaPipeを参照しない。
// 入力の点は x/y/z が同じ縮尺の空間（hand-input.js がピクセル空間へ変換して渡す）。
// 時刻はすべてミリ秒。

export const HAND_CONFIG = Object.freeze({
  minScore: 0.6,          // handedness信頼度がこれ未満なら認識喪失扱い
  extendRatio: 1.5,       // 指先-手首 / MCP-手首 がこれ以上で「伸びている」候補
  curlRatio: 1.3,         // これ以下で「曲がっている」
  extendAngleDeg: 145,    // PIP関節角がこれ以上で伸展
  holdMs: 250,            // 同じ姿勢をこの時間保持すると発動
  graceMs: 120,           // 中間姿勢(unknown)を許容する時間。超えると解除
  maxActiveMs: 3000,      // 一度の発動が続く最長時間。超えたら一度姿勢を解く必要がある
  cooldownMs: 600,        // 解除後、次の発動までの待ち時間
  rampMs: 300,            // 発動後に効果が最大になるまでの時間
  staleMs: 250,           // この時間より古い手の結果は欠落扱い
  inferIntervalMs: 66,    // 手の推論間隔（約15Hz）
  wristMaxRatio: 0.9,     // 手首とPose手首の距離 / 肩幅 の上限（別人の手の排除）
});

export const GESTURES = Object.freeze({ NONE: 'none', FIST: 'fist', OPEN: 'open', UNKNOWN: 'unknown' });
export const EFFECTS = Object.freeze({ NONE: 'none', CHARGING: 'charging', SHIELD: 'shield' });

// 親指以外の4本。[MCP, PIP, DIP, TIP]
const FINGERS = [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]];

const finite = (p) => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z ?? 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0));

export function validPoints(points) {
  return Array.isArray(points) && points.length >= 21 && points.slice(0, 21).every(finite);
}

function angleDeg(a, b, c) { // bを頂点とする角度
  const v1 = [a.x - b.x, a.y - b.y, (a.z ?? 0) - (b.z ?? 0)];
  const v2 = [c.x - b.x, c.y - b.y, (c.z ?? 0) - (b.z ?? 0)];
  const n = Math.hypot(...v1) * Math.hypot(...v2);
  if (n < 1e-9) return 0;
  const cos = (v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]) / n;
  return Math.acos(Math.min(1, Math.max(-1, cos))) * 180 / Math.PI;
}

// 手掌サイズ（手首〜中指MCP）。平行移動・拡縮・回転に依存しない基準。
export function palmSize(points) { return dist(points[0], points[9]); }

// 各指を 'extended' / 'curled' / 'mid' に分類する。
export function fingerStates(points, cfg = HAND_CONFIG) {
  const wrist = points[0];
  return FINGERS.map(([mcp, pip, dip, tip]) => {
    const base = dist(points[mcp], wrist);
    if (base < 1e-9) return 'mid';
    const ratio = dist(points[tip], wrist) / base;
    const angle = angleDeg(points[mcp], points[pip], points[dip]);
    if (ratio >= cfg.extendRatio && angle >= cfg.extendAngleDeg) return 'extended';
    if (ratio <= cfg.curlRatio) return 'curled';
    return 'mid';
  });
}

// 21点から姿勢を分類する。親指は不安定なため必須条件にしない。
export function classifyHand(points, cfg = HAND_CONFIG) {
  if (!validPoints(points) || palmSize(points) < 1e-6) return GESTURES.UNKNOWN;
  const states = fingerStates(points, cfg);
  if (states.every((s) => s === 'curled')) return GESTURES.FIST;
  if (states.every((s) => s === 'extended')) return GESTURES.OPEN;
  return GESTURES.UNKNOWN;
}

const GESTURE_EFFECT = { [GESTURES.FIST]: EFFECTS.CHARGING, [GESTURES.OPEN]: EFFECTS.SHIELD };

// 複数の手から、Poseの手首に最も近い一つを選ぶ。
// poseWrists: [{x,y} | null]（ピクセル空間）。shoulderWidth: 肩幅（ピクセル）。
// Pose手首が一つも使えない時は信頼度最大の手を使う。
export function selectHand(hands, poseWrists, shoulderWidth, cfg = HAND_CONFIG) {
  const usable = (hands ?? []).filter((h) => validPoints(h.points) && h.score >= cfg.minScore);
  if (!usable.length) return null;
  const wrists = (poseWrists ?? []).filter(finite);
  if (!wrists.length || !(shoulderWidth > 0)) {
    return usable.reduce((a, b) => (b.score > a.score ? b : a));
  }
  let best = null, bestD = Infinity;
  for (const h of usable) {
    for (const w of wrists) {
      const d = Math.hypot(h.points[0].x - w.x, h.points[0].y - w.y);
      if (d < bestD) { bestD = d; best = h; }
    }
  }
  return bestD / shoulderWidth <= cfg.wristMaxRatio ? best : null;
}

export function createGestureTracker(cfg = HAND_CONFIG) {
  let s;
  const fresh = () => ({
    state: 'none',          // none | candidate | active | cooldown
    gesture: GESTURES.NONE, // 現在の姿勢（active中は発動した姿勢）
    effect: EFFECTS.NONE,
    source: null,           // 'hand' | 'button'
    handId: null,
    candidateSince: 0,
    activeSince: 0,
    unknownSince: null,
    cooldownUntil: 0,
    spent: false,           // maxActiveMsを使い切った。姿勢を解くまで再発動しない
    spentGesture: null,
  });
  s = fresh();

  const out = (now, fired = false) => {
    const active = s.state === 'active';
    const strength = active ? Math.min(1, (now - s.activeSince) / cfg.rampMs) : 0;
    const progress = s.state === 'candidate' ? Math.min(1, (now - s.candidateSince) / cfg.holdMs) : (active ? 1 : 0);
    return { state: s.state, gesture: s.gesture, effect: active ? s.effect : EFFECTS.NONE, strength, progress, fired, source: s.source };
  };
  const release = (now) => { // 発動・候補を解除してクールダウンへ
    const wasActive = s.state === 'active';
    const keep = { cooldownUntil: s.cooldownUntil, spent: false, spentGesture: null };
    s = { ...fresh(), ...keep };
    if (wasActive) s.cooldownUntil = now + cfg.cooldownMs;
    s.state = s.cooldownUntil > now ? 'cooldown' : 'none';
  };
  const clear = () => { s = fresh(); };

  return {
    // sample: {points, score, handId} | null。enabled: アクション体験中かつ追跡有効か。
    update(sample, now, enabled = true) {
      if (!enabled) { clear(); return out(now); }
      if (s.state === 'cooldown' && now >= s.cooldownUntil) s.state = 'none';

      // ボタン由来の効果：期限まで継続。手の入力では解除しない。
      if (s.source === 'button' && s.state === 'active') {
        if (now - s.activeSince >= cfg.maxActiveMs) release(now);
        return out(now);
      }

      const lost = !sample || !validPoints(sample.points) || !(sample.score >= cfg.minScore);
      if (lost) { // 認識喪失：即座に候補も効果も止める
        if (s.state === 'active') release(now);
        else s = { ...fresh(), cooldownUntil: s.cooldownUntil, state: s.state === 'cooldown' ? 'cooldown' : 'none' };
        return out(now);
      }
      if (s.handId !== null && sample.handId !== s.handId) { // 手が切り替わった
        release(now); s.gesture = GESTURES.NONE;
      }
      s.handId = sample.handId ?? null;

      const g = classifyHand(sample.points, cfg);
      const effect = GESTURE_EFFECT[g] ?? EFFECTS.NONE;

      if (s.spent) { // 使い切った後は、別の姿勢になるまで待つ
        if (g !== s.spentGesture) { s.spent = false; s.spentGesture = null; }
        else return out(now);
      }

      if (s.state === 'active') {
        if (g === s.gesture) {
          s.unknownSince = null;
          if (now - s.activeSince >= cfg.maxActiveMs) {
            const sg = s.gesture; release(now); s.spent = true; s.spentGesture = sg; s.handId = sample.handId ?? null;
            return out(now);
          }
        } else if (g === GESTURES.UNKNOWN) {
          s.unknownSince ??= now;
          if (now - s.unknownSince > cfg.graceMs) release(now);
        } else { release(now); } // 拳⇄開の素早い切替：解除してクールダウン
        return out(now);
      }

      if (effect === EFFECTS.NONE) { // 中間姿勢・どちらでもない
        if (s.state === 'candidate') s.state = 'none';
        s.gesture = g; return out(now);
      }
      if (s.state === 'cooldown') { s.gesture = g; return out(now); }

      if (s.state === 'candidate' && s.gesture === g) {
        if (now - s.candidateSince >= cfg.holdMs) {
          s.state = 'active'; s.effect = effect; s.activeSince = now; s.source = 'hand'; s.unknownSince = null;
          return out(now, true);
        }
        return out(now);
      }
      s.state = 'candidate'; s.gesture = g; s.candidateSince = now; // 新しい候補（保持時間をやり直す）
      return out(now);
    },

    // ボタン：手の判定と同じ状態機械・クールダウンを通す。
    force(effect, now, enabled = true) {
      if (!enabled || (effect !== EFFECTS.CHARGING && effect !== EFFECTS.SHIELD)) return null;
      if (s.state === 'cooldown' && now >= s.cooldownUntil) s.state = 'none';
      if (s.state === 'cooldown') return null;
      if (s.state === 'active') release(now); // 別の効果への切替は前を解除（クールダウンは無視して入替）
      s.cooldownUntil = 0;
      s = { ...fresh(), state: 'active', effect, gesture: GESTURES.UNKNOWN, source: 'button', activeSince: now };
      return out(now, true);
    },

    reset() { clear(); },
    get snapshot() { return { ...s }; },
  };
}
