import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createCaptureController, composeFrame, canvasToPngBlob, makeFileName, downloadBlob,
} from '../project-chrome/js/capture.js';

function mockCtx() {
  const calls = [];
  const record = (name) => (...args) => calls.push([name, ...args]);
  return {
    calls,
    save: record('save'), restore: record('restore'), clearRect: record('clearRect'),
    translate: record('translate'), scale: record('scale'), drawImage: record('drawImage'),
  };
}

test('video→eyec→glの順に同じサイズで描き、反転は一回だけ', () => {
  const ctx = mockCtx();
  composeFrame(ctx, ['video', 'eyec', 'gl'], 640, 480);
  const names = ctx.calls.map((c) => c[0]);
  assert.deepEqual(names, ['save', 'clearRect', 'translate', 'scale', 'drawImage', 'drawImage', 'drawImage', 'restore']);
  assert.deepEqual(ctx.calls.filter((c) => c[0] === 'scale'), [['scale', -1, 1]]);
  assert.deepEqual(ctx.calls.find((c) => c[0] === 'translate'), ['translate', 640, 0]);
  assert.deepEqual(ctx.calls.filter((c) => c[0] === 'drawImage').map((c) => c[1]), ['video', 'eyec', 'gl']);
  for (const c of ctx.calls.filter((c) => c[0] === 'drawImage')) assert.deepEqual(c.slice(2), [0, 0, 640, 480]);
});

test('サイズが0や不正なら描画せずエラーにする', () => {
  for (const [w, h] of [[0, 480], [640, 0], [NaN, 480]]) {
    const ctx = mockCtx();
    assert.throws(() => composeFrame(ctx, ['video'], w, h));
    assert.equal(ctx.calls.length, 0);
  }
});

test('描画中に例外が出てもrestoreする', () => {
  const ctx = mockCtx();
  ctx.drawImage = () => { throw new Error('draw failed'); };
  assert.throws(() => composeFrame(ctx, ['video'], 640, 480));
  assert.equal(ctx.calls.at(-1)[0], 'restore');
});

test('未準備・処理中・要求済みでは撮影要求を受け付けない', () => {
  let ready = false;
  const c = createCaptureController({ isReady: () => ready });
  assert.equal(c.request(), false);
  ready = true;
  assert.equal(c.request(), true);
  assert.equal(c.request(), false); // 連打
  assert.equal(c.take(), true);
  assert.equal(c.busy, true);
  assert.equal(c.request(), false); // 処理中
  assert.equal(c.take(), false);
  c.finish();
  assert.equal(c.busy, false);
  assert.equal(c.request(), true);
});

test('cancelは未実行の要求だけを取り消す', () => {
  const c = createCaptureController({ isReady: () => true });
  c.request();
  c.cancel();
  assert.equal(c.take(), false);
  c.request();
  c.take();
  c.cancel();
  assert.equal(c.busy, true); // 処理中の1枚は続行
});

test('toBlobの成功・null・例外を区別する', async () => {
  const blob = { type: 'image/png' };
  await assert.doesNotReject(async () => {
    const result = await canvasToPngBlob({ toBlob: (cb, type) => { assert.equal(type, 'image/png'); cb(blob); } });
    assert.equal(result, blob);
  });
  await assert.rejects(canvasToPngBlob({ toBlob: (cb) => cb(null) }));
  await assert.rejects(canvasToPngBlob({ toBlob: () => { throw new Error('SecurityError'); } }));
});

test('ファイル名は日時のみで個人情報を含まない', () => {
  assert.equal(makeFileName(new Date(2026, 10, 9, 8, 5, 3)), 'project-chrome-20261109-080503.png');
});

test('ダウンロード後にaを片付け、URLは開始後にrevokeする', () => {
  const log = [];
  let scheduled = null;
  const a = { click: () => log.push('click'), remove: () => log.push('remove') };
  const doc = { createElement: () => a, body: { appendChild: () => log.push('append') } };
  const urlApi = { createObjectURL: () => 'blob:x', revokeObjectURL: (u) => log.push(`revoke:${u}`) };
  downloadBlob({}, 'a.png', { doc, urlApi, schedule: (fn) => { scheduled = fn; } });
  assert.equal(a.download, 'a.png');
  assert.deepEqual(log, ['append', 'click', 'remove']); // まだrevokeしない
  scheduled();
  assert.deepEqual(log.at(-1), 'revoke:blob:x');
});

test('click失敗でもaを片付ける', () => {
  const log = [];
  const a = { click: () => { throw new Error('blocked'); }, remove: () => log.push('remove') };
  const doc = { createElement: () => a, body: { appendChild: () => {} } };
  const urlApi = { createObjectURL: () => 'blob:y', revokeObjectURL: () => log.push('revoke') };
  assert.throws(() => downloadBlob({}, 'a.png', { doc, urlApi, schedule: (fn) => fn() }));
  assert.deepEqual(log, ['remove', 'revoke']);
});
