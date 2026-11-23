import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  HAND_CONFIG, GESTURES, EFFECTS, classifyHand, selectHand, createGestureTracker, validPoints,
} from '../project-chrome/js/gestures.js';
import { shapeHandResult } from '../project-chrome/js/hand-input.js';

// 合成手：手首が原点、指は +y 方向。curl=0で伸展、1で握り（指先が手首側へ戻る）。
function makeHand(curl) {
  const pts = Array.from({ length: 21 }, () => ({ x: 0, y: 0, z: 0 }));
  const mcpY = 100;
  [5, 9, 13, 17].forEach((mcp, i) => {
    const x = [-30, -10, 10, 30][i];
    const ys = curl ? [mcpY, mcpY + 20, mcpY + 5, mcpY - 15] : [mcpY, mcpY + 40, mcpY + 70, mcpY + 95];
    ys.forEach((y, k) => { pts[mcp + k] = { x, y, z: 0 }; });
  });
  [[-30, 20], [-40, 40], [-45, 60], [-50, 75]].forEach(([x, y], k) => { pts[1 + k] = { x, y, z: 0 }; });
  return pts;
}
const FIST = makeHand(1);
const OPEN = makeHand(0);
const transform = (pts, { s = 1, dx = 0, dy = 0, rot = 0 } = {}) => pts.map((p) => ({
  x: (p.x * Math.cos(rot) - p.y * Math.sin(rot)) * s + dx,
  y: (p.x * Math.sin(rot) + p.y * Math.cos(rot)) * s + dy,
  z: p.z * s,
}));

test('拳・開いた手・中間姿勢を分類する', () => {
  assert.equal(classifyHand(FIST), GESTURES.FIST);
  assert.equal(classifyHand(OPEN), GESTURES.OPEN);
  const half = makeHand(1); // 人差し指だけ伸ばす
  half[6] = { x: -30, y: 140, z: 0 }; half[7] = { x: -30, y: 170, z: 0 }; half[8] = { x: -30, y: 200, z: 0 };
  assert.equal(classifyHand(half), GESTURES.UNKNOWN);
});

test('平行移動・拡縮・回転でも分類が変わらない', () => {
  for (const t of [{ dx: 300, dy: -80 }, { s: 0.3 }, { s: 3 }, { rot: 1.2 }, { rot: -2.5, s: 0.7, dx: 10 }]) {
    assert.equal(classifyHand(transform(FIST, t)), GESTURES.FIST, JSON.stringify(t));
    assert.equal(classifyHand(transform(OPEN, t)), GESTURES.OPEN, JSON.stringify(t));
  }
});

test('欠損・非有限・不足した点はunknown', () => {
  assert.equal(classifyHand(null), GESTURES.UNKNOWN);
  assert.equal(classifyHand(FIST.slice(0, 10)), GESTURES.UNKNOWN);
  const nan = FIST.map((p) => ({ ...p })); nan[8].x = NaN;
  assert.equal(classifyHand(nan), GESTURES.UNKNOWN);
  assert.equal(validPoints(nan), false);
  const flat = FIST.map(() => ({ x: 1, y: 1, z: 0 }));
  assert.equal(classifyHand(flat), GESTURES.UNKNOWN);
});

const sample = (points, handId = 'A', score = 0.9) => ({ points, handId, score });
const { holdMs, cooldownMs, maxActiveMs, graceMs } = HAND_CONFIG;

test('保持時間の境界：holdMs未満は発動せず、holdMsで一度だけ発動', () => {
  const t = createGestureTracker();
  let r = t.update(sample(FIST), 1000);
  assert.equal(r.state, 'candidate');
  r = t.update(sample(FIST), 1000 + holdMs - 1);
  assert.equal(r.effect, EFFECTS.NONE);
  r = t.update(sample(FIST), 1000 + holdMs);
  assert.equal(r.effect, EFFECTS.CHARGING);
  assert.equal(r.fired, true);
  r = t.update(sample(FIST), 1000 + holdMs + 16);
  assert.equal(r.fired, false);
  assert.equal(r.effect, EFFECTS.CHARGING);
});

test('開いた手はshield', () => {
  const t = createGestureTracker();
  t.update(sample(OPEN), 0);
  assert.equal(t.update(sample(OPEN), holdMs).effect, EFFECTS.SHIELD);
});

test('保持中の途中でunknownが挟まっても保持時間をやり直す', () => {
  const t = createGestureTracker();
  t.update(sample(FIST), 0);
  t.update(sample(transform(FIST).map((p, i) => (i === 8 ? { ...p, y: 300 } : p))), 100);
  const r = t.update(sample(FIST), 120);
  assert.equal(r.effect, EFFECTS.NONE);
  assert.equal(t.update(sample(FIST), 120 + holdMs).effect, EFFECTS.CHARGING);
});

test('長押し：maxActiveMsで止まり、姿勢を解くまで連続発動しない', () => {
  const t = createGestureTracker();
  let fired = 0, now = 0;
  for (; now < 20000; now += 16) if (t.update(sample(FIST), now).fired) fired++;
  assert.equal(fired, 1);
  const r = t.update(sample(FIST), now);
  assert.equal(r.effect, EFFECTS.NONE);
});

test('解除後はクールダウン中に再発動せず、経過後は再発動できる', () => {
  const t = createGestureTracker();
  t.update(sample(FIST), 0); t.update(sample(FIST), holdMs);
  t.update(null, 500); // 認識喪失で解除
  let r = t.update(sample(FIST), 510);
  assert.equal(r.state, 'cooldown');
  r = t.update(sample(FIST), 500 + cooldownMs - 1);
  assert.equal(r.effect, EFFECTS.NONE);
  t.update(sample(FIST), 500 + cooldownMs);           // クールダウン明け→候補
  r = t.update(sample(FIST), 500 + cooldownMs + holdMs);
  assert.equal(r.effect, EFFECTS.CHARGING);
});

test('認識喪失（欠落・低信頼度・非有限点）で即座に効果を止める', () => {
  for (const bad of [null, sample(FIST, 'A', 0.2), sample(FIST.map((p) => ({ ...p, x: NaN })))]) {
    const t = createGestureTracker();
    t.update(sample(FIST), 0); t.update(sample(FIST), holdMs);
    const r = t.update(bad, holdMs + 16);
    assert.equal(r.effect, EFFECTS.NONE);
    assert.equal(r.strength, 0);
  }
});

test('候補中の喪失で保持時間が持ち越されない', () => {
  const t = createGestureTracker();
  t.update(sample(FIST), 0); t.update(null, 100);
  t.update(sample(FIST), 110);
  assert.equal(t.update(sample(FIST), 110 + holdMs - 1).effect, EFFECTS.NONE);
});

test('左右（手）の切替でリセットされる', () => {
  const t = createGestureTracker();
  t.update(sample(FIST, 'Left'), 0); t.update(sample(FIST, 'Left'), holdMs);
  const r = t.update(sample(FIST, 'Right'), holdMs + 16);
  assert.equal(r.effect, EFFECTS.NONE);
});

test('拳⇄開の素早い切替は一度解除し、すぐには発動しない', () => {
  const t = createGestureTracker();
  t.update(sample(FIST), 0); t.update(sample(FIST), holdMs);
  const r = t.update(sample(OPEN), holdMs + 16);
  assert.equal(r.effect, EFFECTS.NONE);
  assert.notEqual(t.update(sample(OPEN), holdMs + 16 + holdMs).effect, EFFECTS.SHIELD); // クールダウン中
});

test('短いunknown(graceMs以内)は許容し、超えると解除', () => {
  const half = FIST.map((p, i) => (i === 8 ? { ...p, y: 300 } : p));
  let t = createGestureTracker();
  t.update(sample(FIST), 0); t.update(sample(FIST), holdMs);
  assert.equal(t.update(sample(half), holdMs + graceMs).effect, EFFECTS.CHARGING);
  t = createGestureTracker();
  t.update(sample(FIST), 0); t.update(sample(FIST), holdMs);
  t.update(sample(half), holdMs + 10);
  assert.equal(t.update(sample(half), holdMs + 10 + graceMs + 1).effect, EFFECTS.NONE);
});

test('enabled=false（phase変更・追跡無効）で全状態を解除し、クールダウンも残さない', () => {
  const t = createGestureTracker();
  t.update(sample(FIST), 0); t.update(sample(FIST), holdMs);
  const r = t.update(sample(FIST), holdMs + 16, false);
  assert.equal(r.effect, EFFECTS.NONE);
  assert.equal(r.state, 'none');
});

test('reset()で候補・効果・クールダウンを初期化', () => {
  const t = createGestureTracker();
  t.update(sample(FIST), 0); t.update(sample(FIST), holdMs); t.update(null, 400);
  t.reset();
  assert.equal(t.snapshot.state, 'none');
  t.update(sample(FIST), 410);
  assert.equal(t.update(sample(FIST), 410 + holdMs).effect, EFFECTS.CHARGING);
});

test('強さは発動直後0から立ち上がる', () => {
  const t = createGestureTracker();
  t.update(sample(FIST), 0);
  const a = t.update(sample(FIST), holdMs);
  const b = t.update(sample(FIST), holdMs + HAND_CONFIG.rampMs);
  assert.equal(a.strength, 0);
  assert.equal(b.strength, 1);
});

test('ボタン：同じ状態機械で発動し、手の喪失では止まらず期限で終了、連打はクールダウンで抑止', () => {
  const t = createGestureTracker();
  assert.equal(t.force(EFFECTS.SHIELD, 0).effect, EFFECTS.SHIELD);
  assert.equal(t.update(null, 100).effect, EFFECTS.SHIELD);
  const end = t.update(null, maxActiveMs);
  assert.equal(end.effect, EFFECTS.NONE);
  assert.equal(t.force(EFFECTS.CHARGING, maxActiveMs + 10), null); // クールダウン中
  assert.equal(t.force(EFFECTS.CHARGING, maxActiveMs + cooldownMs).effect, EFFECTS.CHARGING);
});

test('ボタンもenabled=false・RESETで止まり、無効時は発動しない', () => {
  const t = createGestureTracker();
  assert.equal(t.force(EFFECTS.CHARGING, 0, false), null);
  t.force(EFFECTS.CHARGING, 0);
  assert.equal(t.update(null, 10, false).effect, EFFECTS.NONE);
  t.force(EFFECTS.SHIELD, 20);
  t.reset();
  assert.equal(t.update(null, 30).effect, EFFECTS.NONE);
});

test('selectHand：Pose手首に近い手を選び、遠い別人の手は除外', () => {
  const near = { points: transform(FIST, { dx: 500, dy: 400 }), score: 0.8 };
  const far = { points: transform(FIST, { dx: 100, dy: 100 }), score: 0.99 };
  assert.equal(selectHand([far, near], [{ x: 510, y: 410 }], 300), near);
  assert.equal(selectHand([far], [{ x: 510, y: 410 }], 300), null);
});

test('selectHand：Pose手首がなければ信頼度最大、低信頼度は除外', () => {
  const a = { points: FIST, score: 0.7 }, b = { points: OPEN, score: 0.95 };
  assert.equal(selectHand([a, b], [null, null], 0), b);
  assert.equal(selectHand([{ points: FIST, score: 0.3 }], [], 0), null);
  assert.equal(selectHand([], [], 0), null);
});

test('shapeHandResult：正規化座標をピクセル空間へ変換し、handednessを取り込む', () => {
  const lm = Array.from({ length: 21 }, (_, i) => ({ x: 0.5, y: 0.25, z: 0.1 + i * 0 }));
  const [h] = shapeHandResult({ landmarks: [lm], handedness: [[{ score: 0.9, categoryName: 'Left' }]] }, 1280, 720);
  assert.deepEqual(h.points[0], { x: 640, y: 180, z: 128 });
  assert.equal(h.score, 0.9);
  assert.equal(h.handId, 'Left');
  assert.deepEqual(shapeHandResult(null, 1280, 720), []);
  assert.equal(shapeHandResult({ landmarks: [lm] }, 1, 1)[0].score, 0);
});
