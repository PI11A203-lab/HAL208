import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  ARM_MATERIAL_SLOTS, ARM_PARTS, FINGER_BONES, assignHands, createRequestTracker, findMissingParts, handBackNormal, handTip,
  segmentPose,
} from '../project-chrome/js/arm-model.js';
import { readdir } from 'node:fs/promises';
import { ARM_MODELS, DESIGNS } from '../project-chrome/js/config.js';

const root = new URL('../project-chrome/', import.meta.url);
const part = { baseLength: 1, baseRadius: 0.2, radiusScale: 1 };
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-9, `${message}: ${actual}`);

// GLB（バイナリglTF）の先頭にあるJSONチャンクを読む
async function readGlbJson(url) {
  const data = await readFile(url);
  assert.equal(data.toString('ascii', 0, 4), 'glTF', 'GLB形式ではありません');
  const jsonLength = data.readUInt32LE(12);
  assert.equal(data.toString('ascii', 16, 20), 'JSON');
  return { size: data.length, json: JSON.parse(data.toString('utf8', 20, 20 + jsonLength)) };
}

test('必須ノードの不足を名前で返す', () => {
  assert.deepEqual(findMissingParts(['Scene', 'UpperArm', 'Forearm', 'Hand']), []);
  assert.deepEqual(findMissingParts(['UpperArm']), ['Forearm', 'Hand']);
  assert.deepEqual(findMissingParts([]), ARM_PARTS);
});

test('古い読込依頼はRESETや次の選択の後に無効になる', () => {
  const requests = createRequestTracker();
  const first = requests.next();
  assert.ok(requests.isCurrent(first));
  const second = requests.next();
  assert.ok(!requests.isCurrent(first) && requests.isCurrent(second));
  requests.cancel();
  assert.ok(!requests.isCurrent(second), 'RESET後に前の依頼が有効のままです');
});

test('部品の原点を関節に置き、+Yを次の関節へ向けて区間長で拡縮する', () => {
  const pose = segmentPose([100, 200, 0], [100, 50, 0], part, 30);
  assert.deepEqual(pose.position, [100, 200, 0]);
  assert.deepEqual(pose.yAxis.map((v) => v + 0), [0, -1, 0]);
  close(pose.scale[1], 150, '長さ方向の拡縮');
  close(pose.scale[0], 150, '太さ方向の拡縮'); // 30 / 0.2
  close(pose.scale[2], pose.scale[0], '太さは前後左右で同じ');
});

test('部品の向きは直交する右手系で、前面はカメラ側を向く', () => {
  const pose = segmentPose([0, 0, 0], [3, 4, -2], part, 10);
  const { xAxis: x, yAxis: y, zAxis: z } = pose;
  for (const v of [x, y, z]) close(Math.hypot(...v), 1, '単位ベクトル');
  close(dot(x, y), 0, 'x・y'); close(dot(y, z), 0, 'y・z'); close(dot(x, z), 0, 'x・z');
  const cross = [x[1] * y[2] - x[2] * y[1], x[2] * y[0] - x[0] * y[2], x[0] * y[1] - x[1] * y[0]];
  cross.forEach((v, i) => close(v, z[i], '右手系（x × y = z）'));
  assert.ok(z[2] > 0, '前面がカメラ側を向いていません');
});

test('関節が重なる・カメラ方向へ伸びる場合もNaNにならない', () => {
  for (const [a, b] of [[[5, 5, 5], [5, 5, 5]], [[0, 0, 0], [0, 0, 80]], [[0, 0, 0], [0, 0, -80]]]) {
    const pose = segmentPose(a, b, part, 12);
    for (const value of [...pose.xAxis, ...pose.yAxis, ...pose.zAxis, ...pose.scale]) {
      assert.ok(Number.isFinite(value), `${JSON.stringify([a, b])} で数値が壊れています`);
    }
    assert.ok(pose.scale[1] > 0, '長さ0でも拡縮は正の値にする');
  }
});

test('手の先端は前腕の延長線上に置く', () => {
  assert.deepEqual(handTip([0, 0, 0], [10, 0, 0], 0.5), [15, 0, 0]);
});

test('装備が参照する腕モデルが設定にあり、必須ノードを使っている', () => {
  for (const [key, design] of Object.entries(DESIGNS)) {
    if (design.model) assert.ok(ARM_MODELS[design.model], `${key} の model ${design.model} がありません`);
  }
  for (const [id, model] of Object.entries(ARM_MODELS)) {
    const nodes = Object.values(model.parts).map((p) => p.node);
    assert.deepEqual(findMissingParts(nodes), [], `${id} に必須ノードの設定がありません`);
    for (const p of Object.values(model.parts)) {
      assert.ok(['shoulder', 'elbow', 'wrist', 'handTip'].includes(p.from) && ['elbow', 'wrist', 'handTip'].includes(p.to));
      assert.ok(p.baseLength > 0 && p.baseRadius > 0, `${id}.${p.node} の基準寸法が不正です`);
    }
  }
});

test('同梱のGLBに必須ノード・マテリアルがあり、外部ファイルを参照しない', async () => {
  for (const [id, model] of Object.entries(ARM_MODELS)) {
    const { size, json } = await readGlbJson(new URL(model.url, root));
    const nodes = json.nodes.map((n) => n.name);
    assert.deepEqual(findMissingParts(nodes), [], `${id} のGLBにノードがありません`);
    const materials = new Set(json.materials.map((m) => m.name));
    for (const slot of ARM_MATERIAL_SLOTS) assert.ok(materials.has(slot), `${id} にマテリアル ${slot} がありません`);
    for (const entry of [...(json.buffers ?? []), ...(json.images ?? [])]) {
      assert.equal(entry.uri, undefined, `${id} が外部ファイル ${entry.uri} を参照しています`);
    }
    assert.ok(size < 2 * 1024 * 1024, `${id} のGLBが大きすぎます（${size} bytes）`);
  }
});

test('手の長さの比率と左右反転の設定が正しい型である', () => {
  for (const [id, model] of Object.entries(ARM_MODELS)) {
    if (model.handRatio !== undefined) {
      assert.ok(model.handRatio > 0 && model.handRatio <= 1.5, `${id} の handRatio が不正です`);
    }
    if (model.mirrorLeft !== undefined) assert.equal(typeof model.mirrorLeft, 'boolean');
  }
});

test('前面の向き（手の甲など）を指定すると、部品の +Z をその方向へ向ける', () => {
  const pose = segmentPose([0, 0, 0], [0, 10, 0], part, 5, [1, 0, 0]);
  assert.deepEqual(pose.zAxis.map((v) => Math.round(v * 1e9) / 1e9 + 0), [1, 0, 0]);
});

test('指の節は21点の正しい区間に対応している', () => {
  assert.equal(FINGER_BONES.length, 15);
  assert.equal(new Set(FINGER_BONES.map((b) => b.node)).size, 15);
  for (const b of FINGER_BONES) assert.ok(b.from >= 1 && b.to === b.from + 1 && b.to <= 20, b.node);
});

test('手のひらをカメラに向けた右手では、手の甲はカメラの反対を向く（左手も同じ）', () => {
  // 右手：指を上、手のひらをカメラへ → 人差し指の付け根が画面の右（+x）、小指が左
  const right = Array.from({ length: 21 }, () => [0, 0, 0]);
  right[5] = [1, 3, 0]; right[17] = [-1, 3, 0];
  assert.ok(handBackNormal(right, true)[2] < -0.99);
  const left = Array.from({ length: 21 }, () => [0, 0, 0]);
  left[5] = [-1, 3, 0]; left[17] = [1, 3, 0];
  assert.ok(handBackNormal(left, false)[2] < -0.99);
  assert.deepEqual(handBackNormal(Array.from({ length: 21 }, () => [0, 0, 0]), true), [0, 0, -1]);
});

test('検出した手を手首の近い腕へ1つずつ割り当て、遠い手は使わない', () => {
  const arms = [{ x: 100, y: 100 }, { x: 300, y: 100 }];
  assert.deepEqual(assignHands([{ x: 310, y: 110 }, { x: 95, y: 90 }], arms, 50), [1, 0]);
  assert.deepEqual(assignHands([{ x: 200, y: 100 }], arms, 50), [-1, -1]);
  assert.deepEqual(assignHands([{ x: 105, y: 100 }, { x: 110, y: 100 }], arms, 300), [0, 1]);
});

test('フォルダーにある腕モデルはすべて設定から使われている', async () => {
  const files = (await readdir(new URL('assets/models/', root))).filter((f) => /^arm-.*\.glb$/.test(f));
  const used = new Set(Object.values(ARM_MODELS).map((m) => m.url.split('/').pop()));
  for (const f of files) assert.ok(used.has(f), `${f} が ARM_MODELS にありません`);
  for (const [key, design] of Object.entries(DESIGNS)) assert.ok(design.model, `${key} に model がありません`);
});

test('同梱の腕GLBの手は指の節に分かれ、基準寸法を持つ', async () => {
  for (const [id, model] of Object.entries(ARM_MODELS)) {
    const { json } = await readGlbJson(new URL(model.url, root));
    const byName = new Map(json.nodes.map((n) => [n.name, n]));
    const hand = byName.get(model.parts.hand.node);
    assert.ok(hand?.extras?.trackLength > 0 && hand.extras.trackRadius > 0, `${id} の手に trackLength / trackRadius がありません`);
    for (const b of FINGER_BONES) {
      const n = byName.get(b.node);
      assert.ok(n, `${id} に ${b.node} がありません`);
      assert.ok(n.extras?.baseLength > 0 && n.extras?.baseRadius > 0, `${id} の ${b.node} に基準寸法がありません`);
      assert.ok(hand.children.includes(json.nodes.indexOf(n)), `${id} の ${b.node} が手の子ではありません`);
    }
  }
});
