import test from 'node:test';
import assert from 'node:assert/strict';
import { ATTRACT, ATTRACT_DEFAULTS, createAttract, personPresent, presence, showcaseIndex } from '../project-chrome/js/attract-state.js';

// 肩（11・12）だけを置いた Pose。x：肩の中心、w：肩幅（映像の幅に対する割合）
function pose(x = 0.5, w = 0.2, vis = 1) {
  const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0 }));
  lm[11] = { x: x + w / 2, y: 0.4, visibility: vis };
  lm[12] = { x: x - w / 2, y: 0.4, visibility: vis };
  return lm;
}

test('いる人：肩が見えていて、近く（肩幅が十分）、中央寄りの人だけ', () => {
  assert.equal(personPresent(pose()), true);
  assert.equal(personPresent(pose(0.5, 0.05)), false);   // 遠くを通る人
  assert.equal(personPresent(pose(0.08)), false);        // 画面の端（横を通る人・スタッフ）
  assert.equal(personPresent(pose(0.5, 0.2, 0.2)), false);
  assert.equal(personPresent(null), false);
  assert.equal(personPresent([]), false);
});

test('待機 → 1秒いたら開始（welcome）。途中でいなくなったら待機へ戻る', () => {
  const a = createAttract({ enterSec: 1 });
  assert.equal(a.update({ present: false }, 0).state, ATTRACT.IDLE);
  let r = a.update({ present: true }, 1);
  assert.equal(r.state, ATTRACT.SCANNING);
  assert.equal(a.update({ present: true }, 1.5).progress, 0.5);
  assert.equal(a.update({ present: false }, 1.6).state, ATTRACT.IDLE);   // 通りがかり
  a.update({ present: true }, 2);
  r = a.update({ present: true }, 3);
  assert.deepEqual(r, { state: ATTRACT.ACTIVE, progress: 1, event: 'welcome' });
  assert.equal(a.update({ present: true }, 3.1).event, null);           // 一度だけ
});

test('体験中：いなくなって leaveSec たったら「またのお越しを」→ goodbyeSec 後にリセットして待機', () => {
  const a = createAttract({ enterSec: 1, leaveSec: 8, goodbyeSec: 2 });
  a.update({ present: true }, 0); a.update({ present: true }, 1);
  assert.equal(a.update({ present: false }, 5).state, ATTRACT.ACTIVE);  // 少し見失っても続ける
  assert.equal(a.update({ present: false }, 8.9).state, ATTRACT.ACTIVE);
  assert.equal(a.update({ present: false }, 9).state, ATTRACT.LEAVING);
  assert.equal(a.update({ present: false }, 10).event, null);
  assert.deepEqual(a.update({ present: false }, 11), { state: ATTRACT.IDLE, progress: 0, event: 'reset' });
});

test('「またのお越しを」の間に戻ってきたら、リセットせずに続ける', () => {
  const a = createAttract({ enterSec: 1, leaveSec: 8, goodbyeSec: 2 });
  a.update({ present: true }, 0); a.update({ present: true }, 1);
  a.update({ present: false }, 9);
  const r = a.update({ present: true }, 10);
  assert.equal(r.state, ATTRACT.ACTIVE);
  assert.equal(r.event, null);
});

test('購入中（hold）は長めに待つ', () => {
  const a = createAttract({ enterSec: 1, leaveSec: 8, holdLeaveSec: 30 });
  a.update({ present: true }, 0); a.update({ present: true }, 1);
  assert.equal(a.update({ present: false, hold: true }, 20).state, ATTRACT.ACTIVE);
  assert.equal(a.update({ present: false, hold: true }, 31).state, ATTRACT.LEAVING);
});

test('スタッフ用：すぐに待機へ／すぐに体験中へ', () => {
  const a = createAttract();
  a.skip(5);
  assert.equal(a.state, ATTRACT.ACTIVE);
  assert.equal(a.update({ present: false }, 5 + ATTRACT_DEFAULTS.leaveSec - 0.1).state, ATTRACT.ACTIVE);
  a.reset(20);
  assert.equal(a.state, ATTRACT.IDLE);
});

test('ショーケース：一定時間ごとに次の商品へ、最後の次は最初へ', () => {
  assert.deepEqual([0, 3.9, 4, 8, 31.9, 32].map((t) => showcaseIndex(t, 8, 4)), [0, 0, 1, 2, 7, 0]);
  assert.equal(showcaseIndex(10, 0), -1);
});

test('近くて肩が映らない時（PCの前に座っている時など）は顔で判断し、理由を返す', () => {
  const face = (x = 0.5, earGap = 0.2, vis = 1) => {
    const lm = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.9, visibility: 0.1 }));
    lm[0] = { x, y: 0.4, visibility: vis };
    lm[7] = { x: x + earGap / 2, y: 0.38, visibility: vis }; lm[8] = { x: x - earGap / 2, y: 0.38, visibility: vis };
    return lm;
  };
  assert.deepEqual(presence(face()), { present: true, reason: 'ok' });
  assert.deepEqual(presence(face(0.5, 0.03)), { present: false, reason: 'far' });
  assert.deepEqual(presence(face(0.05)), { present: false, reason: 'edge' });
  assert.deepEqual(presence(null), { present: false, reason: 'none' });
  // 耳が見えない時は目の間隔で
  const eyes = face(); eyes[7].visibility = 0; eyes[2] = { x: 0.53, y: 0.36, visibility: 1 }; eyes[5] = { x: 0.47, y: 0.36, visibility: 1 };
  assert.equal(presence(eyes).present, true);
  assert.deepEqual(presence(pose()), { present: true, reason: 'ok' });
});
