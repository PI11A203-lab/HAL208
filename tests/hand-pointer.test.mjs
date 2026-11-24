import test from 'node:test';
import assert from 'node:assert/strict';
import {
  HAND_POINTER_DEFAULTS, bothHandsUp, createDwell, createHandPointer, createMenuToggle, handModes, isRaised,
  pickPointingHand, pointerFromPose,
} from '../project-chrome/js/hand-pointer.js';

// 画像座標（0〜1、y は下向き）の Pose 33点を作る。肩幅 0.2、肩の高さ 0.5
function pose({ right = null, left = null, vis = 1 } = {}) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.9, visibility: 0.1 }));
  const set = (k, x, y) => { lm[k] = { x, y, visibility: vis }; };
  set(11, 0.6, 0.5); set(12, 0.4, 0.5);                            // 左肩（画像の右）・右肩（画像の左）
  set(13, 0.65, 0.7); set(15, 0.65, 0.9); set(19, 0.65, 0.95);     // 下ろした左腕
  set(14, 0.35, 0.7); set(16, 0.35, 0.9); set(20, 0.35, 0.95);     // 下ろした右腕
  // 上げた腕：肘は肩の少し上、手首は wristY、人差し指は (x, y)
  if (right) { set(14, 0.35, 0.45); set(16, 0.35, right.wristY ?? 0.3); set(20, right.x, right.y); }
  if (left) { set(13, 0.65, 0.45); set(15, 0.65, left.wristY ?? 0.3); set(19, left.x, left.y); }
  return lm;
}

test('手を上げている時だけ指していると判定する', () => {
  assert.equal(isRaised(pose(), 'right'), false);
  assert.equal(isRaised(pose({ right: { x: 0.35, y: 0.25 } }), 'right'), true);
  assert.equal(isRaised(pose({ right: { x: 0.35, y: 0.25 } }), 'left'), false);
  assert.equal(isRaised(pose({ right: { x: 0.35, y: 0.25 }, vis: 0.2 }), 'right'), false);   // 見えにくい
  assert.equal(isRaised(null, 'right'), false);
});

test('指す手：上げた方。両手なら高い方。今の手が上がっている間は切り替えない', () => {
  assert.equal(pickPointingHand(pose()), null);
  assert.equal(pickPointingHand(pose({ left: { x: 0.65, y: 0.25 } })), 'left');
  const both = pose({ right: { x: 0.35, y: 0.25, wristY: 0.35 }, left: { x: 0.65, y: 0.2, wristY: 0.25 } });
  assert.equal(pickPointingHand(both), 'left');
  assert.equal(pickPointingHand(both, 'right'), 'right');
});

test('人差し指の位置を画面へ：鏡映しで左右反転し、操作範囲の外は端に収める', () => {
  const b = HAND_POINTER_DEFAULTS.box, sw = 0.2;
  // 右手（画像の左側の肩 x=0.4）。中心は肩から外側（画像の左）へ outward
  const cx = 0.4 - b.outward * sw;
  const center = pointerFromPose(pose({ right: { x: cx, y: 0.5 - b.top * sw + (b.top + b.bottom) * sw / 2 } }), 'right');
  assert.ok(Math.abs(center.x - 0.5) < 1e-9 && Math.abs(center.y - 0.5) < 1e-9);
  // 画像で左へ動かす（本人は右へ動かす）と、鏡映しの画面では右へ
  const toRight = pointerFromPose(pose({ right: { x: cx - 0.1, y: 0.4 } }), 'right');
  assert.ok(toRight.x > 0.5);
  // 範囲外は 0〜1 に収める
  const far = pointerFromPose(pose({ right: { x: -1, y: -1 } }), 'right');
  assert.deepEqual(far, { x: 1, y: 0 });
  assert.equal(pointerFromPose(pose({ right: { x: 0.3, y: 0.3 }, vis: 0.1 }), 'right'), null);
});

test('カーソル：上げると出て、下ろして少したつと消え、再び上げた時に古い位置へ引っ張られない', () => {
  const ptr = createHandPointer();
  assert.equal(ptr.update(pose(), 0), null);
  const a = ptr.update(pose({ right: { x: 0.37, y: 0.4 } }), 1);
  assert.equal(a.hand, 'right');
  assert.ok(ptr.update(pose(), 1.1));                    // 一瞬見失っても保つ
  assert.equal(ptr.update(pose(), 1 + HAND_POINTER_DEFAULTS.lostSec + 0.05), null);
  const raw = pointerFromPose(pose({ right: { x: 0.2, y: 0.3 } }), 'right');
  const b = ptr.update(pose({ right: { x: 0.2, y: 0.3 } }), 5);
  assert.ok(Math.abs(b.x - raw.x) < 1e-9 && Math.abs(b.y - raw.y) < 1e-9);   // 平滑化をやり直す
  assert.equal(ptr.update(null, 9), null);
});

test('カーソル：小さな震えは抑える', () => {
  const ptr = createHandPointer();
  let t = 0, xs = [];
  for (let i = 0; i < 60; i++) {
    t += 1 / 30;
    const p = ptr.update(pose({ right: { x: 0.3 + (i % 2 ? 0.004 : -0.004), y: 0.4 } }), t);
    if (i > 10) xs.push(p.x);
  }
  const raw = [0.3 - 0.004, 0.3 + 0.004].map((x) => pointerFromPose(pose({ right: { x, y: 0.4 } }), 'right').x);
  const rawSpread = Math.abs(raw[0] - raw[1]);
  const spread = Math.max(...xs) - Math.min(...xs);
  assert.ok(spread < rawSpread * 0.5, `${spread} < ${rawSpread * 0.5}`);
});

test('ドウェル：同じ対象に1秒止まると一度だけ選ぶ', () => {
  const d = createDwell({ dwellSec: 1, cooldownSec: 0.5 });
  const A = {}, B = {};
  assert.deepEqual(d.update(A, 0), { target: A, progress: 0, fire: false });
  assert.equal(d.update(A, 0.5).progress, 0.5);
  assert.equal(d.update(A, 1).fire, true);
  assert.equal(d.update(A, 3).fire, false);              // 止まり続けても繰り返さない
  assert.equal(d.update(null, 3.1).progress, 0);
  assert.equal(d.update(A, 3.2).fire, false);             // 外れてから戻ると数え直す
  assert.equal(d.update(A, 4.2).fire, true);
  // 通り過ぎただけでは選ばない
  assert.equal(d.update(B, 5).fire, false);
  assert.equal(d.update(A, 5.4).fire, false);
  assert.equal(d.update(B, 5.8).fire, false);
});

test('ドウェル：選んだ直後は待ち時間の間、次を数えない', () => {
  const d = createDwell({ dwellSec: 1, cooldownSec: 0.5 });
  const A = {}, B = {};
  d.update(A, 0); assert.equal(d.update(A, 1).fire, true);
  assert.equal(d.update(B, 1.1).progress, 0);
  assert.equal(d.update(B, 1.4).progress, 0);
  assert.equal(d.update(B, 2.4).fire, false);             // 1.5（待ち終わり）から数える
  assert.equal(d.update(B, 2.5).fire, true);
});

/* ---- 体験中のメニュー切替（両手）とモード ---- */
test('両手を上げている（両手首が鼻より上）時だけ true', () => {
  const lm = pose({ right: { x: 0.35, y: 0.2, wristY: 0.25 }, left: { x: 0.65, y: 0.2, wristY: 0.25 } });
  lm[0] = { x: 0.5, y: 0.35, visibility: 1 };                    // 鼻
  assert.equal(bothHandsUp(lm), true);
  const one = pose({ right: { x: 0.35, y: 0.2, wristY: 0.25 } });
  one[0] = { x: 0.5, y: 0.35, visibility: 1 };
  assert.equal(bothHandsUp(one), false);                          // 片手（指すだけ）では切り替えない
  lm[0] = { x: 0.5, y: 0.35, visibility: 0.1 };
  assert.equal(bothHandsUp(lm), false);
  assert.equal(bothHandsUp(null), false);
});

test('メニュー切替：両手を1秒上げると ON、上げたままでは繰り返さず、もう一度で OFF', () => {
  const m = createMenuToggle({ holdSec: 1, idleSec: 6 });
  assert.equal(m.update({ bothUp: true }, 0).active, false);
  assert.equal(m.update({ bothUp: true }, 0.5).progress, 0.5);
  assert.equal(m.update({ bothUp: true }, 1).active, true);
  assert.equal(m.update({ bothUp: true }, 3).active, true);       // 上げたまま：繰り返さない
  assert.equal(m.update({ bothUp: false, pointing: true }, 3.5).active, true);
  m.update({ bothUp: true }, 4);
  assert.equal(m.update({ bothUp: true }, 5).active, false);
});

test('メニュー切替：カーソルを使わないまま時間がたつとギミックへ戻る', () => {
  const m = createMenuToggle({ holdSec: 1, idleSec: 6 });
  m.update({ bothUp: true }, 0); m.update({ bothUp: true }, 1);
  assert.equal(m.update({ bothUp: false, pointing: true }, 5).active, true);
  assert.equal(m.update({ bothUp: false, pointing: false }, 10.9).active, true);
  assert.equal(m.update({ bothUp: false, pointing: false }, 11).active, false);
  m.update({ bothUp: true }, 20); m.update({ bothUp: true }, 21);
  m.reset();
  assert.equal(m.active, false);
});

test('モード：選択画面はカーソル、体験中はギミック、メニュー中はカーソル、購入は画面に合わせる', () => {
  assert.deepEqual(handModes({ phase: 'select' }), { cursor: true, gimmicks: false, menuToggle: false });
  assert.deepEqual(handModes({ phase: 'equipping' }), { cursor: false, gimmicks: false, menuToggle: false });
  assert.deepEqual(handModes({ phase: 'action' }), { cursor: false, gimmicks: true, menuToggle: true });
  assert.deepEqual(handModes({ phase: 'action', menu: true }), { cursor: true, gimmicks: false, menuToggle: true });
  // 購入：カウントダウン中はギミックでポーズ、確認などの画面はカーソル、準備中は何もしない
  assert.deepEqual(handModes({ phase: 'action', purchase: 'countdown', menu: true }), { cursor: false, gimmicks: true, menuToggle: false });
  for (const p of ['notice', 'preview', 'qr', 'error']) {
    assert.deepEqual(handModes({ phase: 'action', purchase: p }), { cursor: true, gimmicks: false, menuToggle: false }, p);
  }
  assert.deepEqual(handModes({ phase: 'action', purchase: 'confirming' }), { cursor: false, gimmicks: false, menuToggle: false });
});
