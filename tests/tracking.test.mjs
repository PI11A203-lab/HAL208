import assert from 'node:assert/strict';
import test from 'node:test';
import { OneEuro } from '../project-chrome/js/tracking.js';

test('最初の座標をそのまま返し、一定入力で位置がずれない', () => {
  const filter = new OneEuro();
  assert.equal(filter.filter(120, 0, 1, 0.02), 120);
  for (let frame = 1; frame < 60; frame++) {
    assert.ok(Math.abs(filter.filter(120, frame / 30, 1, 0.02) - 120) < 1e-10);
  }
});

test('急な座標変化を平滑化し、繰り返し入力すると目標へ近づく', () => {
  const filter = new OneEuro();
  filter.filter(0, 0, 1, 0);
  let previous = filter.filter(100, 1 / 30, 1, 0);
  assert.ok(previous > 0 && previous < 100);
  for (let frame = 2; frame <= 120; frame++) {
    const next = filter.filter(100, frame / 30, 1, 0);
    assert.ok(next >= previous && next <= 100);
    previous = next;
  }
  assert.ok(Math.abs(100 - previous) < 0.01);
});

test('強い平滑化では座標の急変をより小さくする', () => {
  const strong = new OneEuro();
  const weak = new OneEuro();
  strong.filter(0, 0, 0.3, 0);
  weak.filter(0, 0, 3, 0);
  assert.ok(strong.filter(100, 1 / 30, 0.3, 0) < weak.filter(100, 1 / 30, 3, 0));
});

test('同じ時刻のフレームでもNaNやInfinityにならない', () => {
  const filter = new OneEuro();
  filter.filter(0, 1, 1, 0.02);
  const value = filter.filter(100, 1, 1, 0.02);
  assert.ok(Number.isFinite(value));
  assert.ok(value > 0 && value < 100);
});

test('追跡再開のreset後に古い座標を引きずらない', () => {
  const filter = new OneEuro();
  filter.filter(100, 0, 1, 0.02);
  filter.filter(200, 1 / 30, 1, 0.02);
  filter.reset();
  assert.equal(filter.filter(-50, 10, 1, 0.02), -50);
});
