import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEarController, findEarNodes, createEarMaterialControls } from '../project-chrome/js/ear-state.js';

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function asset() { return { disposed: 0, dispose() { this.disposed++; } }; }
function tree(name, children = [], isMesh = false) {
  const node = { name, children, isMesh, parent: null, traverse(fn) {
    fn(this); children.forEach(child => child.traverse(fn));
  } };
  children.forEach(child => { child.parent = node; });
  return node;
}
const ear = name => tree(name, [tree('shell', [], true)]);

test('LEDの色と消灯は外殻・内板へ伝播せず、猫耳にLEDを要求しない', () => {
  const mat = name => ({ name, color: { value: 'original', set(v) { this.value = v; } },
    emissive: { value: 'original', set(v) { this.value = v; } }, emissiveIntensity: 0 });
  const shell = mat('EarShell'), led = mat('EarLED'), inner = mat('EarInner');
  const root = { traverse(fn) { fn({ material: [shell, led, inner] }); } };
  const controls = createEarMaterialControls(root, { led: true });
  controls.applyLED('#00e5ff', true);
  assert.equal(led.emissive.value, '#00e5ff');
  assert.equal(led.emissiveIntensity, 1.25);
  assert.equal(shell.color.value, 'original');
  assert.equal(inner.color.value, 'original');
  controls.applyColor('#112233');
  assert.equal(shell.color.value, '#112233');
  assert.equal(led.color.value, '#00e5ff');
  controls.applyLED('#ff9fc9', false);
  assert.equal(led.emissiveIntensity, 0);
  assert.equal(inner.color.value, 'original');
  const cat = { traverse(fn) { fn({ material: shell }); } };
  assert.doesNotThrow(() => createEarMaterialControls(cat));
  assert.throws(() => createEarMaterialControls(cat, { led: true }), /EarLED/);
});

test('異なるモデルの遅延完了を破棄し、切替済み資産を一度だけ解放する', async () => {
  const cat = deferred(), rabbit = deferred();
  const oldModel = asset(), newModel = asset();
  const calls = [];
  const controller = createEarController({ load: id => {
    calls.push(id); return id === 'glb' ? cat.promise : rabbit.promise;
  } });
  const first = controller.setEnabled(true, 'glb');
  const second = controller.setEnabled(true, 'rabbit');
  rabbit.resolve(newModel); await second;
  cat.resolve(oldModel); await first;
  assert.deepEqual(calls, ['glb', 'rabbit']);
  assert.equal(controller.asset, newModel);
  assert.equal(oldModel.disposed, 1);
  controller.setEnabled(false, 'classic');
  assert.equal(newModel.disposed, 1);
  assert.equal(controller.asset, null);
  controller.dispose();
  assert.equal(newModel.disposed, 1);
});

test('左右の名前付きnodeを順序に依存せず取得する', () => {
  const left = ear('EarLeft'), right = ear('EarRight');
  assert.deepEqual(findEarNodes(tree('scene', [right, left])), [left, right]);
});
test('node不足・同名重複・空node・左右の入れ子を拒否する', () => {
  assert.throws(() => findEarNodes(tree('scene', [ear('EarLeft')])), /EarRight/);
  assert.throws(() => findEarNodes(tree('scene', [ear('EarLeft'), ear('EarLeft'), ear('EarRight')])), /EarLeft/);
  assert.throws(() => findEarNodes(tree('scene', [tree('EarLeft'), ear('EarRight')])), /Mesh/);
  assert.throws(() => findEarNodes(tree('EarLeft', [ear('EarRight')])), /独立/);
});
test('読込中のON連打は重複読込せず、準備済み資産は再利用する', async () => {
  const request = deferred(), model = asset();
  let calls = 0;
  const controller = createEarController({ load: () => { calls++; return request.promise; } });
  const done = controller.setEnabled(true);
  controller.setEnabled(true);
  await Promise.resolve();
  assert.equal(calls, 1);
  request.resolve(model); await done;
  assert.equal(controller.asset, model);
  controller.reset();
  await controller.setEnabled(true);
  assert.equal(calls, 1);
  assert.equal(controller.enabled, true);
});
test('RESET前の完了は表示資産にせず解放する', async () => {
  const request = deferred(), model = asset();
  const controller = createEarController({ load: () => request.promise });
  const done = controller.setEnabled(true);
  controller.reset();
  request.resolve(model); await done;
  assert.equal(controller.asset, null);
  assert.equal(controller.enabled, false);
  assert.equal(model.disposed, 1);
});
test('OFF→ON後、古い成功が最新の結果を上書きしない', async () => {
  const old = deferred(), latest = deferred();
  const firstModel = asset(), latestModel = asset();
  let count = 0, errors = 0;
  const controller = createEarController({ load: () => (++count === 1 ? old.promise : latest.promise), onError: () => errors++ });
  const first = controller.setEnabled(true);
  await Promise.resolve();
  controller.setEnabled(false);
  const second = controller.setEnabled(true);
  latest.resolve(latestModel); await second;
  old.resolve(firstModel); await first;
  assert.equal(controller.asset, latestModel);
  assert.equal(firstModel.disposed, 1);
  assert.equal(errors, 0);
});
test('RESET前の失敗を通知せず、最新の読込状態を維持する', async () => {
  const old = deferred(), latest = deferred();
  let count = 0, errors = 0;
  const controller = createEarController({ load: () => (++count === 1 ? old.promise : latest.promise), onError: () => errors++ });
  const first = controller.setEnabled(true);
  await Promise.resolve();
  controller.reset();
  const second = controller.setEnabled(true);
  old.reject(new Error('遅い404')); await first;
  assert.equal(controller.loading, true);
  assert.equal(errors, 0);
  const model = asset();
  latest.resolve(model); await second;
  assert.equal(controller.asset, model);
});
test('失敗を通知し、再試行で回復する', async () => {
  let errors = 0, count = 0;
  const model = asset();
  const controller = createEarController({ load: () => ++count === 1 ? Promise.reject(new Error('404')) : model,
    onError: () => errors++ });
  await controller.setEnabled(true);
  assert.equal(controller.loading, false);
  assert.equal(controller.asset, null);
  assert.equal(errors, 1);
  controller.setEnabled(false);
  await controller.setEnabled(true);
  assert.equal(controller.asset, model);
});
test('破棄は資産を一度だけ解放し、未完了資産も後から解放する', async () => {
  const model = asset();
  const controller = createEarController({ load: () => model });
  await controller.setEnabled(true);
  controller.dispose(); controller.dispose();
  assert.equal(model.disposed, 1);
  const request = deferred(), lateModel = asset();
  const loading = createEarController({ load: () => request.promise });
  const done = loading.setEnabled(true);
  loading.dispose();
  request.resolve(lateModel); await done;
  assert.equal(lateModel.disposed, 1);
  assert.equal(loading.asset, null);
});
