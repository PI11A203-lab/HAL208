import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fitMask, adjacentCategory, LOADOUT_CATEGORIES } from '../project-chrome/js/mask-fit.js';
import { MASK_MODEL, MASK_MODELS } from '../project-chrome/js/config.js';
import { createLoadoutMenu } from '../project-chrome/js/loadout-menu.js';

const face = { left: [-100, 0, 0], right: [100, 0, 0], forehead: [0, 120, 0],
  chin: [0, -140, 0], nose: [0, 10, 30] };
const close = (a, b) => assert.ok(Math.abs(a-b) < 1e-8, `${a} != ${b}`);
test('短縮したマスクの下端を顎先に合わせる', () => {
  const fit = fitMask(face);
  assert.deepEqual(fit.right, [1,0,0]);
  assert.deepEqual(fit.up, [0,1,0]);
  assert.deepEqual(fit.forward, [0,0,1]);
  close(fit.scale[0] * 2.533, 216);
  close(fit.origin[1] - .856*fit.scale[1], face.chin[1]);
});
test('サイズ変更や頭の傾きでも顎を支点にし、高さ調整だけ指定分ずらす', () => {
  const pitch = p => [p[0], p[1]*Math.cos(.35)-p[2]*Math.sin(.35), p[1]*Math.sin(.35)+p[2]*Math.cos(.35)];
  const tilted = Object.fromEntries(Object.entries(face).map(([key, p]) => [key, pitch(p)]));
  for (const points of [face, tilted]) {
    for (const size of [.8, 1, 1.3]) {
      for (const lift of [0, .1]) {
        const fit = fitMask(points, {size, lift});
        const bottom = fit.origin.map((v,i) => v - fit.up[i] * .856 * fit.scale[1]);
        const offset = bottom.map((v,i) => v - points.chin[i]);
        close(offset.reduce((sum,v,i) => sum + v * fit.up[i], 0), 200 * lift);
        close(offset.reduce((sum,v,i) => sum + v * fit.right[i], 0), 0);
      }
    }
  }
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
test('ONIは牙・六角網・赤色LEDを持ち、専用比率でも顎を支点にする', async () => {
  const definition = MASK_MODELS.oni;
  const bytes = await readFile(new URL(`../project-chrome/${definition.url}`, import.meta.url));
  const gltf = JSON.parse(bytes.subarray(20, 20+bytes.readUInt32LE(12)).toString());
  assert.equal(bytes.readUInt32LE(0), 0x46546c67);
  assert.equal(bytes.readUInt32LE(8), bytes.length);
  assert.equal(gltf.nodes.filter(node => node.name === 'MaskRoot').length, 1);
  for (const name of ['Left Upper canine','Right Upper canine','Left Lower canine','Right Lower canine']) {
    assert.ok(gltf.nodes.some(node => node.name === name));
  }
  for (const name of ['Upper wraparound facial armor','Lower overlapping fang armor']) {
    assert.ok(gltf.nodes.some(node => node.name === name), '改修版の装甲が必要');
  }
  assert.ok(gltf.nodes.filter(node => node.name?.startsWith('Honeycomb wire')).length > 100);
  assert.ok(gltf.materials.some(mat => mat.name === 'OniCeramicTeeth'));
  const led = gltf.materials.find(mat => mat.name === 'MaskLED');
  assert.ok(led.emissiveFactor[0] > led.emissiveFactor[1]*10);
  assert.ok(gltf.buffers.every(buffer => !buffer.uri));
  const fit = fitMask(face, {}, definition);
  close(fit.origin[1] - .856*fit.scale[1], face.chin[1]);
  close(fit.scale[1]*definition.heightSpan, 150);
});
