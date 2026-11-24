import test from 'node:test';
import assert from 'node:assert/strict';
import { createHandTips } from '../project-chrome/js/hand-tips.js';

test('WELCOME の後：表示が終わってから指の案内を出し、カーソルが出続けたら消す', () => {
  const t = createHandTips({ selectSec: 7, pointerSec: 0.6 });
  t.welcome(10, 1.4);
  assert.equal(t.update({}, 10.5), null);                       // WELCOME の表示中は出さない
  assert.equal(t.update({}, 11.4), 'select');
  assert.equal(t.update({ pointer: true }, 12), 'select');       // 一瞬カーソルが出ただけでは消さない
  assert.equal(t.update({ pointer: false }, 12.2), 'select');
  t.update({ pointer: true }, 13);
  assert.equal(t.update({ pointer: true }, 13.7), null);         // 分かった
});

test('指の案内：何もしなくても一定時間で消える', () => {
  const t = createHandTips({ selectSec: 7 });
  t.welcome(0);
  assert.equal(t.update({}, 6.9), 'select');
  assert.equal(t.update({}, 7), null);
});

test('体験の始め：メニューの案内。メニューを開いたら消える', () => {
  const t = createHandTips({ menuSec: 6 });
  t.action(20);
  assert.equal(t.update({}, 21), 'menu');
  assert.equal(t.update({ menu: true }, 22), null);
  const u = createHandTips({ menuSec: 6 });
  u.action(0);
  assert.equal(u.update({}, 6), null);                          // 時間でも消える
});

test('来場者ごとに1回だけ。リセットすると次の来場者に再び出す', () => {
  const t = createHandTips({ menuSec: 6 });
  t.action(0); t.update({}, 7);
  t.action(10);
  assert.equal(t.update({}, 11), null);                          // 同じ来場者にはもう出さない
  t.welcome(12);
  assert.equal(t.update({}, 12.5), 'select');
  t.reset();
  assert.equal(t.current, null);
  t.action(30);
  assert.equal(t.update({}, 31), 'menu');
});
