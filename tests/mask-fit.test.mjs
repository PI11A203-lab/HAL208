import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fitMask, adjacentCategory, LOADOUT_CATEGORIES } from '../project-chrome/js/mask-fit.js';
import { MASK_MODEL } from '../project-chrome/js/config.js';
import { createLoadoutMenu } from '../project-chrome/js/loadout-menu.js';

const face = { left: [-100, 0, 0], right: [100, 0, 0], forehead: [0, 120, 0],
  chin: [0, -140, 0], nose: [0, 10, 30] };
const close = (a, b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);
test('マスクの鼻根と顎を独立した幅・高さで合わせる', () => {
  const fit = fitMask(face);
  assert.deepEqual(fit.right, [1,0,0]);
  assert.deepEqual(fit.up, [0,1,0]);
  assert.deepEqual(fit.forward, [0,0,1]);
  close(fit.scale[0] * 2.533, 216);
  close(fit.origin[1] + .61*fit.scale[1], face.nose[1]);
  close(fit.origin[1] - .94*fit.scale[1], face.chin[1]);
});
test('移動・距離・頭の回転を装着位置へ反映する', () => {
  const base = fitMask(face);
  const moved = Object.fromEntries(Object.entries(face).map(([key, p]) => [key, p.map((v,i) => v*2+[300,400,50][i])]));
  const fit = fitMask(moved);
  fit.origin.forEach((value,i) => close(value, base.origin[i]*2+[300,400,50][i]));
  const turn = p => [p[2], p[1], -p[0]];
  const rotated = fitMask(Object.fromEntries(Object.entries(face).map(([key,p]) => [key, turn(p)])));
  rotated.origin.forEach((v,i) => close(v, turn(base.origin)[i]));
  rotated.forward.forEach((value,i) => close(value, [1,0,0][i]));
});
test('位置調整と不正な追跡点を安全に扱う', () => {
  const base = fitMask(face), adjusted = fitMask(face, { lift: .1, depth: .1 });
  close(adjusted.origin[1] - base.origin[1], 20);
  close(adjusted.origin[2] - base.origin[2], 20);
  assert.equal(fitMask({...face, nose: [NaN,0,0]}), null);
  assert.equal(fitMask({...face, right: face.left}), null);
  assert.equal(fitMask({...face, forehead: face.chin}), null);
});
test('メニューは腕・目・マスク・耳の順で端を越えない', () => {
  assert.deepEqual(LOADOUT_CATEGORIES, ['arms','eyes','mask','head']);
  assert.equal(adjacentCategory('eyes', 1), 'mask');
  assert.equal(adjacentCategory('mask', 1), 'head');
  assert.equal(adjacentCategory('mask', -1), 'eyes');
  assert.equal(adjacentCategory('arms', -1), 'arms');
  assert.equal(adjacentCategory('head', 1), 'head');
});
test('カメラ待機中のカテゴリー移動と起動後の矢印状態を維持する', () => {
  const tabs = LOADOUT_CATEGORIES.map(category => ({
    dataset: { t: category }, disabled: true, attributes: {},
    classList: { toggle() {} }, scrollIntoView() {}, focus() {},
    setAttribute(name, value) { this.attributes[name] = value; },
  }));
  const elements = Object.fromEntries(['categoryPrev', 'categoryNext', ...LOADOUT_CATEGORIES.map(c => 'sec-'+c)]
    .map(id => [id, { disabled: true, hidden: false }]));
  const document = { getElementById: id => elements[id], querySelectorAll: () => tabs };
  const menu = createLoadoutMenu(document);
  assert.equal(elements.categoryPrev.disabled, true);
  assert.equal(elements.categoryNext.disabled, false);
  assert.ok(tabs.every(tab => !tab.disabled));
  elements.categoryNext.onclick(); elements.categoryNext.onclick();
  assert.equal(elements['sec-mask'].hidden, false);
  assert.equal(elements['sec-eyes'].hidden, true);
  // mainの初期化完了が全buttonを有効にしても選択と端の状態を復元する。
  menu.refresh();
  assert.equal(tabs[2].attributes['aria-selected'], 'true');
  menu.select('arms'); elements.categoryPrev.disabled = false; menu.refresh();
  assert.equal(elements.categoryPrev.disabled, true);
  assert.equal(elements['sec-mask'].hidden, true);
});
test('マスク配布GLBが自己完結し正しいrootと外殻材質を持つ', async () => {
  const bytes = await readFile(new URL(`../project-chrome/${MASK_MODEL.url}`, import.meta.url));
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  const gltf = JSON.parse(bytes.subarray(20, 20+bytes.readUInt32LE(12)).toString());
  assert.equal(gltf.nodes.filter(node => node.name === 'MaskRoot').length, 1);
  assert.ok(gltf.materials.some(material => material.name === 'MaskShell'));
  assert.ok(gltf.buffers.every(buffer => !buffer.uri));
  assert.ok(!gltf.cameras?.length);
});
