import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  GADGET_KINDS, GESTURE_TO_GADGET, classifyHand, createChargeController, createGestureTrigger, createPunchDetector, elbowAngle,
  fingerExtended, isAimPose, isFist, isOpenHand, isPointing, shotDuration, shotPhase,
} from '../project-chrome/js/gadget-logic.js';
import { FLAME, GADGET } from '../project-chrome/js/config.js';

// 手首(0,0)から上に伸びる手。extended：人差し指・中指・薬指・小指が伸びているか、thumb：親指を横に立てるか
function hand(extended, thumb = false) {
  const pts = Array.from({ length: 21 }, () => [0, 0, 0]);
  pts[1] = [-12, 10, 0]; pts[2] = [-20, 20, 0]; pts[3] = thumb ? [-32, 28, 0] : [-12, 28, 0];
  pts[4] = thumb ? [-45, 35, 0] : [-5, 30, 0];
  [[5, 6, 7, 8], [9, 10, 11, 12], [13, 14, 15, 16], [17, 18, 19, 20]].forEach(([m, p, d, t], f) => {
    const x = -15 + f * 10;
    pts[m] = [x, 40, 0];
    pts[p] = [x, 55, 0];
    if (extended[f]) { pts[d] = [x, 65, 0]; pts[t] = [x, 75, 0]; } else { pts[d] = [x, 48, 0]; pts[t] = [x, 38, 0]; }
  });
  return pts;
}

test('発射前と動作終了後は何も動いていない（全種類）', () => {
  for (const kind of GADGET_KINDS) {
    for (const t of [-1, Number.NaN, shotDuration(kind, 1), shotDuration(kind, 1) + 5]) {
      const p = shotPhase(t, kind, 1);
      assert.equal(p.active, false, `${kind} ${t}`);
      assert.equal(p.hatch + p.barrel + p.travel + p.impact, 0);
    }
  }
});

test('ふたが開き、砲身が伸び、弾が飛んで命中する', () => {
  assert.ok(shotPhase(0.1, 'plasma', 1).hatch > 0 && shotPhase(0.1, 'plasma', 1).barrel === 0, 'ふたが先に開く');
  assert.ok(shotPhase(0.35, 'plasma', 1).barrel > 0, '次に砲身が伸びる');
  const flying = shotPhase(0.6, 'plasma', 1);
  assert.ok(flying.flying && flying.travel > 0 && flying.travel < 1, '弾が飛ぶ');
  assert.equal(shotPhase(0.98, 'plasma', 1).travel, 1, '命中点に届く');
});

test('溜めている間にふたが開いていれば、すぐに弾が出る', () => {
  const p = shotPhase(0.05, 'net', 1, { opened: true });
  assert.equal(p.hatch, 1);
  assert.ok(p.flying && p.travel > 0);
  assert.ok(shotDuration('net', 1, true) < shotDuration('net', 1, false));
});

test('フックとロケットフィストは戻ってくる。プラズマとネットは消える', () => {
  for (const kind of ['hook', 'fist']) {
    const end = shotDuration(kind, 1, true);
    const late = shotPhase(end - 0.05, kind, 1, { opened: true });
    assert.ok(late.travel < 0.5, `${kind} は巻き取られる`);
  }
  for (const kind of ['plasma', 'net']) {
    const t = shotPhase(0.3 + 0.15 + 0.3, kind, 1, { opened: true });
    assert.equal(t.travel, 1, `${kind} は戻らない`);
    assert.ok(t.fade > 0, `${kind} は消えていく`);
  }
});

test('溜めが強いほど長く飛ぶ（飛ぶ時間が長い）', () => {
  assert.ok(shotDuration('plasma', 1) > shotDuration('plasma', 0));
});

test('腕をまっすぐ肩の高さ以上に伸ばした時だけ構えとみなす', () => {
  assert.equal(isAimPose({ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 300, y: 100 }), true, '水平');
  assert.equal(isAimPose({ x: 100, y: 100 }, { x: 100, y: 200 }, { x: 100, y: 300 }), false, '下へ垂らした腕');
  assert.equal(isAimPose({ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 200, y: 0 }), false, '肘を曲げている');
  assert.equal(isAimPose({ x: 100, y: 100 }, { x: 100, y: 100 }, { x: 300, y: 100 }), false, '長さ0の腕');
});

test('指の形：人差し指だけ・拳・開いた手を見分ける', () => {
  assert.equal(fingerExtended(hand([1, 0, 0, 0]), 8, 6), true);
  assert.equal(isPointing(hand([1, 0, 0, 0])), true);
  assert.equal(isPointing(hand([1, 1, 0, 0])), false, 'ピース');
  assert.equal(isFist(hand([0, 0, 0, 0])), true);
  assert.equal(isOpenHand(hand([1, 1, 1, 1])), true);
  assert.equal(isOpenHand(hand([1, 1, 1, 0])), false);
});

test('手の形を5種類に分類する', () => {
  assert.equal(classifyHand(hand([1, 0, 0, 0])), 'point', '人差し指だけ（親指はたたむ）');
  assert.equal(classifyHand(hand([1, 0, 0, 0], true)), 'pistol', 'ピストル');
  assert.equal(classifyHand(hand([1, 0, 0, 1])), 'spider', '人差し指と小指');
  assert.equal(classifyHand(hand([1, 0, 0, 1], true)), 'spider', '親指を立てても NET');
  assert.equal(classifyHand(hand([0, 0, 0, 0])), 'fist');
  assert.equal(classifyHand(hand([1, 1, 1, 1], true)), 'open');
  assert.equal(classifyHand(hand([1, 1, 0, 0])), null, 'ピースは何もしない');
  assert.equal(isPointing(hand([1, 0, 0, 0], true)), false, 'ピストルでは火はつかない');
  assert.equal(GESTURE_TO_GADGET.spider, 'net');
  assert.equal(GESTURE_TO_GADGET.pistol, 'hook');
});

test('同じ手の形を保つと1回だけ発射し、形を変えるまで次を出さない', () => {
  const g = createGestureTrigger({ hold: 0.2 });
  assert.equal(g.update(0, 'spider'), null);
  assert.equal(g.update(0.1, 'spider'), null, '短すぎる');
  assert.equal(g.update(0.25, 'spider'), 'spider');
  assert.equal(g.update(1, 'spider'), null, '保ったままでは連射しない');
  g.update(1.1, null);
  g.update(1.2, 'spider');
  assert.equal(g.update(1.45, 'spider'), 'spider', '形を戻してから再び');
  assert.equal(g.update(2, null), null);
});

test('肘を素早く伸ばすとパンチ、ゆっくり伸ばした時や拳でない時は反応しない', () => {
  assert.equal(Math.round(elbowAngle({ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 })), 180);
  assert.equal(elbowAngle({ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 0 }), null);
  const p = createPunchDetector({ bent: 110, straight: 150, window: 0.35 });
  p.update(0, 80);
  assert.equal(p.update(0.2, 165), true, '素早く伸ばした');
  assert.equal(p.update(0.25, 170), false, '1回だけ');
  p.update(1, 80);
  assert.equal(p.update(1.6, 165), false, 'ゆっくり伸ばした');
  p.update(2, 80);
  assert.equal(p.update(2.1, 165, false), false, '拳を握っていない');
});

test('構えると溜まり、構えを解くと溜めた強さで発射する', () => {
  const c = createChargeController({ minHold: 0.1, fullCharge: 1, autoFire: 10 });
  assert.equal(c.update(0, { aiming: true }), null);
  assert.equal(c.mode, 'charging');
  c.update(0.6, { aiming: true });
  assert.ok(Math.abs(c.charge - 0.5) < 1e-9);
  const shot = c.update(0.7, { aiming: false });
  assert.ok(shot && Math.abs(shot.power - 0.6) < 1e-9, '構えを解いた時点までの溜め');
  assert.equal(c.mode, 'idle');
});

test('一瞬だけ構えた時は発射しない', () => {
  const c = createChargeController({ minHold: 0.15 });
  c.update(0, { aiming: true });
  assert.equal(c.update(0.05, { aiming: false }), null);
});

test('手を追跡している時は、握った拳を開くと構えたまま発射する', () => {
  const c = createChargeController({ minHold: 0.1, fullCharge: 1, autoFire: 10 });
  c.update(0, { aiming: true, tracked: true, open: true });
  assert.equal(c.update(0.5, { aiming: true, tracked: true, open: true }), null, '握る前に開いていても撃たない');
  c.update(0.8, { aiming: true, tracked: true, fist: true });
  const shot = c.update(1.2, { aiming: true, tracked: true, open: true });
  assert.ok(shot && shot.power > 0.9);
});

test('満タンのまま待つと自動で発射し、構え直すまで次を溜めない', () => {
  const c = createChargeController({ minHold: 0, fullCharge: 0.5, autoFire: 0.5 });
  c.update(0, { aiming: true });
  c.update(0.5, { aiming: true });
  const shot = c.update(1.1, { aiming: true });
  assert.ok(shot && shot.power === 1);
  assert.equal(c.update(1.2, { aiming: true }), null);
  assert.equal(c.mode, 'idle', '構えたままでは溜めない');
  c.update(1.3, { aiming: false });
  c.update(1.4, { aiming: true });
  assert.equal(c.mode, 'charging', '構え直すと溜め始める');
});

test('動作中は溜めを受け付けない', () => {
  const c = createChargeController();
  c.busy(5);
  c.update(1, { aiming: true });
  assert.equal(c.mode, 'idle');
  assert.equal(c.charge, 0);
});

test('同梱のギミックGLBに必要なノード・マテリアルがあり、外部ファイルを参照しない', async () => {
  const data = await readFile(new URL(GADGET.url, new URL('../project-chrome/', import.meta.url)));
  assert.equal(data.toString('ascii', 0, 4), 'glTF');
  const json = JSON.parse(data.toString('utf8', 20, 20 + data.readUInt32LE(12)));
  const nodes = new Set(json.nodes.map((n) => n.name));
  for (const name of ['LauncherBase', 'LauncherHatch', 'LauncherBarrel', 'HookHead', 'HookProng0', 'HookProng1', 'HookProng2', 'NetPod']) {
    assert.ok(nodes.has(name), `${name} がありません`);
  }
  const materials = new Set(json.materials.map((m) => m.name));
  for (const slot of ['shell', 'joint', 'emission']) assert.ok(materials.has(slot), `マテリアル ${slot} がありません`);
  for (const entry of [...(json.buffers ?? []), ...(json.images ?? [])]) assert.equal(entry.uri, undefined);
  assert.ok(data.length < 1024 * 1024);
});

test('ギミックと火の設定値が正の数である', () => {
  for (const key of ['along', 'out', 'scale', 'barrelTravel', 'muzzle', 'range', 'netRadius', 'projectileScale', 'fullCharge']) {
    assert.ok(GADGET[key] > 0, `GADGET.${key}`);
  }
  assert.ok(FLAME.holdSec >= 0 && FLAME.size > 0);
});

test('炎の連番画像があり、コマ数と画像の大きさが設定と合う', async () => {
  const { FIRE_FLIPBOOK } = await import('../project-chrome/js/config.js');
  const data = await readFile(new URL(FIRE_FLIPBOOK.url, new URL('../project-chrome/', import.meta.url)));
  assert.equal(data.readUInt16BE(0), 0xffd8, 'JPEG');
  // JPEG の SOF から幅・高さを読む
  let i = 2, size = null;
  while (i < data.length) {
    const marker = data.readUInt16BE(i);
    if (marker >= 0xffc0 && marker <= 0xffc2) { size = [data.readUInt16BE(i + 7), data.readUInt16BE(i + 5)]; break; }
    i += 2 + data.readUInt16BE(i + 2);
  }
  assert.ok(size, '大きさを読めません');
  assert.equal(size[0] % FIRE_FLIPBOOK.cols, 0);
  assert.equal(size[1] % FIRE_FLIPBOOK.rows, 0);
  assert.ok(data.length < 512 * 1024);
});
