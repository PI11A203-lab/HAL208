import assert from 'node:assert/strict';
import test from 'node:test';
import { findHairOffsets } from '../project-chrome/js/hair-fit.js';

function fixture(angle = 0, scale = 80, origin = { x: 128, y: 125 }) {
  const frame = { origin, faceWidth: scale, imageWidth: 256, imageHeight: 256,
    right: { x: Math.cos(angle), y: Math.sin(angle) },
    up: { x: Math.sin(angle), y: -Math.cos(angle) } };
  const mask = new Uint8Array(256 * 256);
  for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
    const dx = x + 0.5 - origin.x, dy = y + 0.5 - origin.y;
    const u = (dx * frame.right.x + dy * frame.right.y) / scale;
    const v = (dx * frame.up.x + dy * frame.up.y) / scale;
    if (Math.abs(u) < 0.55 && v > -0.05 && v < 0.55) mask[y * 256 + x] = 1;
  }
  return { frame, mask };
}

test('額の内側ではなく頭頂付近の左右の髪輪郭を選ぶ', () => {
  const { mask, frame } = fixture();
  const anchors = findHairOffsets(mask, 256, 256, frame);
  assert.ok(anchors[0].u < -0.53 && anchors[1].u > 0.53);
  assert.ok(anchors.every(p => p.v > 0.28 && p.v < 0.35));
});

test('顔の移動・拡縮・傾きが変わっても頭座標の位置は同じ', () => {
  const base = fixture(), rotated = fixture(0.45, 105, { x: 140, y: 150 });
  const a = findHairOffsets(base.mask, 256, 256, base.frame);
  const b = findHairOffsets(rotated.mask, 256, 256, rotated.frame);
  for (let i = 0; i < 2; i++) for (const key of ['u', 'v']) {
    assert.ok(Math.abs(a[i][key] - b[i][key]) < 0.025);
  }
});

test('下へ伸びる長髪を頭頂・横幅の基準にしない', () => {
  const { mask, frame } = fixture();
  const expected = findHairOffsets(mask, 256, 256, frame);
  for (let y = 150; y < 250; y++) for (let x = 65; x < 195; x++) mask[y * 256 + x] = 1;
  const actual = findHairOffsets(mask, 256, 256, frame);
  for (let i = 0; i < 2; i++) {
    assert.ok(Math.abs(actual[i].u - expected[i].u) < 0.025);
    assert.ok(Math.abs(actual[i].v - expected[i].v) < 0.025);
  }
});

test('髪なし・不正mask・極端な横顔は推定配置へ戻す', () => {
  const { frame, mask } = fixture();
  assert.equal(findHairOffsets(new Uint8Array(256 * 256), 256, 256, frame), null);
  assert.equal(findHairOffsets(mask, 255, 256, frame), null);
  assert.equal(findHairOffsets(mask, 256, 256, { ...frame, faceWidth: 0 }), null);
  assert.equal(findHairOffsets(mask, 256, 256, { ...frame, right: { x: 0.01, y: 0 } }), null);
});

test('頭から離れたmaskの点を輪郭へ混ぜない', () => {
  const { mask, frame } = fixture();
  const expected = findHairOffsets(mask, 256, 256, frame);
  for (let y = 0; y < 40; y++) for (let x = 0; x < 40; x++) mask[y * 256 + x] = 1;
  assert.deepEqual(findHairOffsets(mask, 256, 256, frame), expected);
});
