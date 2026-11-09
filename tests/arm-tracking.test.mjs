import assert from 'node:assert/strict';
import test from 'node:test';
import {
  isFiniteNumber, isFinitePoint, landmarkToPixel, pixelToScene,
  trackState, armAge, segment, shoulderWidth, clampZStep,
  cross, normalize, handOrientation, TRACK_SEC, HOLD_SEC,
} from '../project-chrome/js/arm-tracking.js';

test('isFiniteNumber はNaN・Infinity・非数を弾く', () => {
  assert.equal(isFiniteNumber(0), true);
  assert.equal(isFiniteNumber(-3.5), true);
  assert.equal(isFiniteNumber(NaN), false);
  assert.equal(isFiniteNumber(Infinity), false);
  assert.equal(isFiniteNumber('1'), false);
  assert.equal(isFiniteNumber(undefined), false);
});

test('isFinitePoint は全成分が有限なときだけtrue', () => {
  assert.equal(isFinitePoint({ x: 1, y: 2, z: 3 }), true);
  assert.equal(isFinitePoint({ x: 1, y: NaN, z: 3 }), false);
  assert.equal(isFinitePoint({ x: 1, y: 2, z: Infinity }), false);
  assert.equal(isFinitePoint(null), false);
  assert.equal(isFinitePoint({ x: 1, y: 2 }), false);
});

test('landmarkToPixel は正規化点をW/Hでスケールする（W/Hの違いが反映される）', () => {
  const q = { x: 0.5, y: 0.25, z: 0.1 };
  const a = landmarkToPixel(q, 1280, 720);
  assert.equal(a.x, 640);
  assert.equal(a.y, 180);
  assert.ok(Math.abs(a.z - 128) < 1e-9); // z=q.z*W
  // W/Hが変われば結果も変わる
  const b = landmarkToPixel(q, 640, 480);
  assert.equal(b.x, 320);
  assert.equal(b.y, 120);
  assert.ok(Math.abs(b.z - 64) < 1e-9);
});

test('landmarkToPixel はz欠落を0扱いにする', () => {
  const a = landmarkToPixel({ x: 0.1, y: 0.2 }, 1000, 1000);
  assert.equal(a.z, 0);
});

test('pixelToScene はy軸を上向きに反転し、zにdepthを掛ける', () => {
  const s = pixelToScene({ x: 100, y: 200, z: 50 }, 720, 0.6);
  assert.equal(s.x, 100);
  assert.equal(s.y, 520);          // H - y = 720 - 200
  assert.ok(Math.abs(s.z - (-30)) < 1e-9); // -z*depth = -50*0.6
});

test('trackState は0.1秒未満tracking・0.6秒未満holding・以降lost（境界）', () => {
  assert.equal(trackState(0), 'tracking');
  assert.equal(trackState(0.05), 'tracking');
  assert.equal(trackState(TRACK_SEC), 'holding');   // ちょうど0.1はholding側
  assert.equal(trackState(0.3), 'holding');
  assert.equal(trackState(HOLD_SEC), 'lost');       // ちょうど0.6はlost側
  assert.equal(trackState(1.0), 'lost');
});

test('trackState は非有限・負値を安全側（lost）に倒す', () => {
  assert.equal(trackState(NaN), 'lost');
  assert.equal(trackState(-1), 'lost');
});

test('armAge は3点のうち最も古い点の経過時間を返す', () => {
  const now = 10;
  const lastSeen = { 11: 9.95, 13: 9.5, 15: 9.98 }; // 肘(13)が最も古い
  const age = armAge([11, 13, 15], lastSeen, now);
  assert.ok(Math.abs(age - 0.5) < 1e-9);
});

test('armAge は未観測（欠落）の点を大きな経過時間として扱う', () => {
  const age = armAge([11, 13, 15], { 11: 10, 13: 10 }, 10); // 15が欠落
  assert.ok(age === Infinity);
});

test('segment は中心・長さ・単位方向を求める', () => {
  const s = segment({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 });
  assert.deepEqual(s.center, { x: 1.5, y: 2, z: 0 });
  assert.ok(Math.abs(s.len - 5) < 1e-9);
  assert.ok(Math.abs(Math.hypot(s.dir.x, s.dir.y, s.dir.z) - 1) < 1e-9);
});

test('segment は同一点（ゼロ長）でdir=nullを返す（Quaternion生成を避ける）', () => {
  const s = segment({ x: 2, y: 2, z: 2 }, { x: 2, y: 2, z: 2 });
  assert.equal(s.len, 0);
  assert.equal(s.dir, null);
  assert.deepEqual(s.center, { x: 2, y: 2, z: 2 });
});

test('segment は非有限点でnullを返す', () => {
  assert.equal(segment({ x: NaN, y: 0, z: 0 }, { x: 1, y: 1, z: 1 }), null);
  assert.equal(segment({ x: 0, y: 0, z: 0 }, { x: Infinity, y: 1, z: 1 }), null);
});

test('clampZStep は変化量をmaxDeltaに制限する（跳ね抑制）', () => {
  assert.equal(clampZStep(100, 150, 20), 120);   // +50 を +20 に制限
  assert.equal(clampZStep(100, 50, 20), 80);     // -50 を -20 に制限
  assert.equal(clampZStep(100, 110, 20), 110);   // 制限内はそのまま
});

test('clampZStep は初回（prevZ非有限）と異常新値を安全に扱う', () => {
  assert.equal(clampZStep(NaN, 300, 20), 300);        // 初回はnewZ採用
  assert.equal(clampZStep(Infinity, 300, 20), 300);
  assert.equal(clampZStep(100, NaN, 20), 100);        // 異常新値は前回保持
  assert.equal(clampZStep(100, Infinity, 20), 100);
});

test('clampZStep は maxDelta<=0 で制限しない', () => {
  assert.equal(clampZStep(100, 999, 0), 999);
  assert.equal(clampZStep(100, 999, -5), 999);
});

test('cross は外積を正しく計算する', () => {
  assert.deepEqual(cross({ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }), { x: 0, y: 0, z: 1 });
  assert.deepEqual(cross({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }), { x: 1, y: 0, z: 0 });
});

test('normalize は単位ベクトルを返し、ゼロ長・非有限でnull', () => {
  const n = normalize({ x: 3, y: 4, z: 0 });
  assert.ok(Math.abs(n.x - 0.6) < 1e-9 && Math.abs(n.y - 0.8) < 1e-9);
  assert.equal(normalize({ x: 0, y: 0, z: 0 }), null);
  assert.equal(normalize({ x: NaN, y: 1, z: 1 }), null);
});

test('handOrientation は手の向き(forward)と法線(normal)を直交して返す', () => {
  // 手首を原点、人差し指=+x+y方向、小指=-x+y方向（手は+y方向を指す、手のひらは平面上）
  const ho = handOrientation(
    { x: 0, y: 0, z: 0 }, { x: 1, y: 2, z: 0 }, { x: -1, y: 2, z: 0 });
  assert.ok(ho !== null);
  // forward は中点方向 (0,2,0) → +y
  assert.ok(Math.abs(ho.forward.x) < 1e-9 && Math.abs(ho.forward.y - 1) < 1e-9);
  // normal は手のひら平面(xy)に垂直 → ±z
  assert.ok(Math.abs(Math.abs(ho.normal.z) - 1) < 1e-9);
  // forward と normal は直交
  const dot = ho.forward.x * ho.normal.x + ho.forward.y * ho.normal.y + ho.forward.z * ho.normal.z;
  assert.ok(Math.abs(dot) < 1e-9);
});

test('handOrientation は非有限・退化（指が重なる）でnullを返す', () => {
  assert.equal(handOrientation({ x: NaN, y: 0, z: 0 }, { x: 1, y: 1, z: 0 }, { x: -1, y: 1, z: 0 }), null);
  // index と pinky が手首と一直線（外積ゼロ）→ 法線が作れずnull
  assert.equal(handOrientation({ x: 0, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 2, z: 0 }), null);
});

test('shoulderWidth は両肩距離を下限クランプして返す', () => {
  const w = shoulderWidth({ x: 0, y: 0, z: 0 }, { x: 300, y: 0, z: 5 }, 1280, 100);
  assert.ok(Math.abs(w - 300) < 1e-9); // x/y平面距離=300、下限128を上回る
});

test('shoulderWidth は下限（画面幅の10%）を適用する', () => {
  const w = shoulderWidth({ x: 0, y: 0, z: 0 }, { x: 10, y: 0, z: 0 }, 1280, 500);
  assert.ok(Math.abs(w - 128) < 1e-9); // 距離10 < 下限128 → 128
});

test('shoulderWidth は異常値（画面幅超・非有限・ゼロ）で前回値を保持する', () => {
  assert.equal(shoulderWidth({ x: 0, y: 0, z: 0 }, { x: 5000, y: 0, z: 0 }, 1280, 777), 777); // 幅超
  assert.equal(shoulderWidth({ x: NaN, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, 1280, 777), 777);  // 非有限
  assert.equal(shoulderWidth({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, 1280, 777), 777);    // ゼロ距離
});

test('左右の腕で同じ計算が成り立つ（左11/13/15・右12/14/16）', () => {
  const left = armAge([11, 13, 15], { 11: 5, 13: 5, 15: 5 }, 5.05);
  const right = armAge([12, 14, 16], { 12: 5, 14: 5, 16: 5 }, 5.05);
  assert.ok(Math.abs(left - right) < 1e-9);
  assert.equal(trackState(left), 'tracking');
});

test('再取得：lost後に新しいlastSeenが来ればtrackingへ戻る', () => {
  const idsAge = (seen, now) => trackState(armAge([11, 13, 15], { 11: seen, 13: seen, 15: seen }, now));
  assert.equal(idsAge(0, 1.0), 'lost');     // 1秒経過 → lost
  assert.equal(idsAge(1.0, 1.02), 'tracking'); // 再取得直後 → tracking
});
