import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createExperience, reduceExperience, armDisplayMode, EVENTS, PHASES,
} from "../project-chrome/js/experience.js";

test("初期状態は選択画面で、装着していない", () => {
  const s = createExperience();
  assert.equal(s.phase, PHASES.SELECT);
  assert.equal(s.appliedId, null);
  assert.equal(s.requestId, 0);
});

test("正常な流れ：選択 → 装着 → 体験", () => {
  let s = createExperience();
  s = reduceExperience(s, { type: EVENTS.SELECT, id: "mk2" });
  s = reduceExperience(s, { type: EVENTS.APPLY, now: 1 });
  assert.equal(s.phase, PHASES.EQUIPPING);
  assert.equal(s.appliedId, "mk2");
  s = reduceExperience(s, { type: EVENTS.FINISH_EQUIP, requestId: s.requestId });
  assert.equal(s.phase, PHASES.ACTION);
});

test("装着中の連打APPLYは無視し、requestIdが増えない", () => {
  let s = createExperience();
  s = reduceExperience(s, { type: EVENTS.APPLY, now: 1 });
  const before = s;
  s = reduceExperience(s, { type: EVENTS.APPLY, now: 2 });
  assert.equal(s, before);
});

test("古い requestId の完了は無視する", () => {
  let s = createExperience();
  s = reduceExperience(s, { type: EVENTS.APPLY, now: 1 });
  const oldId = s.requestId;
  s = reduceExperience(s, { type: EVENTS.RESET });
  s = reduceExperience(s, { type: EVENTS.APPLY, now: 2 });
  s = reduceExperience(s, { type: EVENTS.FINISH_EQUIP, requestId: oldId });
  assert.equal(s.phase, PHASES.EQUIPPING);
});

test("装着失敗では選択画面へ戻る", () => {
  let s = createExperience();
  s = reduceExperience(s, { type: EVENTS.APPLY, now: 1 });
  s = reduceExperience(s, { type: EVENTS.EQUIP_FAILED, requestId: s.requestId });
  assert.equal(s.phase, PHASES.SELECT);
  assert.equal(s.appliedId, null);
});

test("体験中のBACKで選択へ戻り、選択値は残る", () => {
  let s = createExperience();
  s = reduceExperience(s, { type: EVENTS.SELECT, id: "mk2" });
  s = reduceExperience(s, { type: EVENTS.APPLY, now: 1 });
  s = reduceExperience(s, { type: EVENTS.FINISH_EQUIP, requestId: s.requestId });
  s = reduceExperience(s, { type: EVENTS.BACK });
  assert.equal(s.phase, PHASES.SELECT);
  assert.equal(s.selectedId, "mk2");
});

test("装着途中のRESETで初期状態に戻り、遅れた完了は効かない", () => {
  let s = createExperience();
  s = reduceExperience(s, { type: EVENTS.APPLY, now: 1 });
  const oldId = s.requestId;
  s = reduceExperience(s, { type: EVENTS.RESET });
  assert.equal(s.phase, PHASES.SELECT);
  s = reduceExperience(s, { type: EVENTS.FINISH_EQUIP, requestId: oldId });
  assert.equal(s.phase, PHASES.SELECT);
});

test("RESETを繰り返しても結果が同じ（冪等）", () => {
  const once = reduceExperience(createExperience(), { type: EVENTS.RESET });
  const twice = reduceExperience(once, { type: EVENTS.RESET });
  assert.deepEqual(twice, once);
});

test("RESETはmuteを変えない", () => {
  let s = { ...createExperience(), muted: true };
  s = reduceExperience(s, { type: EVENTS.RESET });
  assert.equal(s.muted, true);
});

test("不明なイベントや無効な選択IDは状態を変えない", () => {
  const s = createExperience();
  assert.equal(reduceExperience(s, { type: "NOPE" }), s);
  assert.equal(reduceExperience(s, { type: EVENTS.SELECT, id: "" }), s);
});

test('カード選択で即座に試着し、別の腕へ切り替えてもアクションを開始しない', () => {
  let state = createExperience();
  assert.equal(armDisplayMode(state), 'none');
  for (const id of ['mk1', 'neon', 'titan']) {
    state = reduceExperience(state, { type: EVENTS.SELECT, id });
    assert.equal(state.previewId, id);
    assert.equal(state.selectedId, id);
    assert.equal(state.appliedId, null);
    assert.equal(armDisplayMode(state), 'preview');
  }
});

test('試着→装着→アクション→BACKで試着へ戻り、RESETで腕を消す', () => {
  let state = reduceExperience(createExperience(), { type: EVENTS.SELECT, id: 'neon' });
  state = reduceExperience(state, { type: EVENTS.APPLY });
  assert.equal(armDisplayMode(state), 'none');
  state = reduceExperience(state, { type: EVENTS.FINISH_EQUIP, requestId: state.requestId });
  assert.equal(armDisplayMode(state), 'action');
  state = reduceExperience(state, { type: EVENTS.BACK });
  assert.equal(armDisplayMode(state), 'preview');
  assert.equal(state.previewId, 'neon');
  state = reduceExperience(state, { type: EVENTS.RESET });
  assert.equal(armDisplayMode(state), 'none');
  assert.equal(state.previewId, null);
});
