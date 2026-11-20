import assert from 'node:assert/strict';
import test from 'node:test';
import { createSmoother, measureWidth } from '../project-chrome/js/body-fit.js';

// 幅 width の人物マスク（横向きの腕：y が top〜top+thick の帯）を作る
function bandMask(width, height, top, thick, extra = () => false) {
  const m = new Float32Array(width * height);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    if ((y >= top && y < top + thick) || extra(x, y)) m[y * width + x] = 1;
  }
  return m;
}

test('腕に垂直な方向で人物の幅を測る', () => {
  const m = bandMask(200, 100, 40, 21);
  assert.equal(measureWidth(m, 200, 100, { x: 20, y: 50 }, { x: 180, y: 50 }), 21);
});

test('斜めの腕でも、区間に垂直な幅を測る', () => {
  const W = 300, H = 300, half = 10;
  const m = new Float32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (Math.abs(x - y) / Math.SQRT2 <= half) m[y * W + x] = 1; // 45°の帯（幅約21）
  }
  const w = measureWidth(m, W, H, { x: 50, y: 50 }, { x: 250, y: 250 });
  assert.ok(w >= 19 && w <= 23, `幅 ${w}`);
});

test('片側が胴体とつながっている時は、見えている側の2倍を幅とする', () => {
  // 腕（y=40〜60）の下側が胴体（y>=60 で x<120）とつながっている
  const m = bandMask(200, 120, 40, 21, (x, y) => y >= 60 && x < 120);
  const w = measureWidth(m, 200, 120, { x: 20, y: 50 }, { x: 110, y: 50 }, { maxHalf: 40 });
  assert.equal(w, 21);
});

test('両側に端があっても左右の差が大きい時は近い側の2倍とする', () => {
  // 腕（y=40〜60）の下に胴体（y=60〜95）が続き、その先に背景がある
  const m = bandMask(200, 120, 40, 21, (x, y) => y >= 60 && y < 95);
  assert.equal(measureWidth(m, 200, 120, { x: 20, y: 50 }, { x: 180, y: 50 }, { maxHalf: 80 }), 21);
});

test('両側とも端が見つからない時は null', () => {
  const m = bandMask(200, 100, 0, 100);
  assert.equal(measureWidth(m, 200, 100, { x: 20, y: 50 }, { x: 180, y: 50 }, { maxHalf: 30 }), null);
});

test('腕が映っていない・区間が短すぎる時は null', () => {
  const empty = new Float32Array(200 * 100);
  assert.equal(measureWidth(empty, 200, 100, { x: 20, y: 50 }, { x: 180, y: 50 }), null);
  assert.equal(measureWidth(bandMask(200, 100, 40, 20), 200, 100, { x: 20, y: 50 }, { x: 21, y: 50 }), null);
});

test('なめらかにし、測れなかったフレームでは前の値を保つ', () => {
  const s = createSmoother(0.5);
  assert.equal(s.update(null), null);
  assert.equal(s.update(20), 20);
  assert.equal(s.update(40), 30);
  assert.equal(s.update(null), 30);
  assert.equal(s.update(Number.NaN), 30);
  s.reset();
  assert.equal(s.value, null);
});
