// カメラ入力（camera-input.js）の単体テスト。
// 実際のカメラ・ブラウザーは使わず、合成 stream・合成 video・手動で完了させられる Promise で確認する。
import assert from 'node:assert/strict';
import test from 'node:test';
import { createCameraInput, classifyCameraError } from '../project-chrome/js/camera-input.js';
/* ---------------- 合成部品 ---------------- */
// 手動で完了させられる Promise
function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
// 監視（addEventListener）の登録数と停止（stop）を確認できる track
function fakeTrack() {
  const listeners = new Map();
  return {
    stopped: false,
    stop() { this.stopped = true; },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type) { for (const fn of [...(listeners.get(type) ?? [])]) fn({ type }); },
    listenerCount(type) { return listeners.get(type)?.size ?? 0; },
  };
}
// 解像度つきの合成 stream
function fakeStream(width = 1280, height = 720) {
  const tracks = [fakeTrack()];
  return { width, height, tracks, getTracks: () => tracks, getVideoTracks: () => tracks };
}
// 合成 video。play() は srcObject の解像度を videoWidth/videoHeight に入れ、playError があれば失敗する
function fakeVideo() {
  const listeners = new Map();
  const video = {
    srcObject: null, videoWidth: 0, videoHeight: 0, readyState: 0, playError: null,
    play() {
      if (video.playError) return Promise.reject(video.playError);
      if (video.srcObject) {
        video.videoWidth = video.srcObject.width;
        video.videoHeight = video.srcObject.height;
        video.readyState = 4;
      }
      return Promise.resolve();
    },
    pause() {},
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    emit(type) { for (const fn of [...(listeners.get(type) ?? [])]) fn({ type }); },
    listenerCount(type) { return listeners.get(type)?.size ?? 0; },
  };
  return video;
}
// getUserMedia の呼び出しを記録し、各要求を pending に積む（テストが順番に完了させる）
function fakeMedia() {
  const calls = [];
  const pending = [];
  return {
    calls,
    pending,
    getUserMedia(constraints) {
      calls.push(constraints);
      const d = deferred();
      pending.push(d);
      return d.promise;
    },
  };
}
function domError(name) {
  return Object.assign(new Error(name + ' のテスト'), { name });
}
function setup() {
  const media = fakeMedia();
  const video = fakeVideo();
  const events = [];
  const cam = createCameraInput({ mediaDevices: media, video, onChange: (s) => events.push(s) });
  return { media, video, events, cam };
}
// 非同期の完了をすべて進める
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
/* ---------------- 成功 ---------------- */
test('成功：準備中から使用可能になり、解像度は video の実際の値を使う', async () => {
  const { media, video, events, cam } = setup();
  cam.start();
  assert.equal(cam.state, 'starting');
  const s = fakeStream(1920, 1080);
  media.pending[0].resolve(s);
  await flush();
  assert.equal(cam.state, 'ready');
  assert.equal(video.videoWidth, 1920);
  assert.equal(video.videoHeight, 1080);
  const last = events.at(-1);
  assert.equal(last.state, 'ready');
  assert.equal(last.width, 1920);
  assert.equal(last.height, 1080);
  assert.equal(cam.stream, s);
});
test('要求する解像度と音声なしの制約を getUserMedia に渡す', () => {
  const { media, cam } = setup();
  cam.start();
  assert.deepEqual(media.calls[0], { video: { width: 1280, height: 720 }, audio: false });
});
/* ---------------- 失敗（理由ごとの分類） ---------------- */
test('権限の拒否は denied。stream は無いので停止対象も無い', async () => {
  const { media, events, cam } = setup();
  cam.start();
  media.pending[0].reject(domError('NotAllowedError'));
  await flush();
  assert.equal(cam.state, 'error');
  assert.equal(events.at(-1).reason, 'denied');
  assert.equal(cam.stream, null);
});
test('カメラがない（NotFoundError）は notFound として error になる', async () => {
  const { media, events, cam } = setup();
  cam.start();
  media.pending[0].reject(domError('NotFoundError'));
  await flush();
  assert.equal(cam.state, 'error');
  assert.equal(events.at(-1).reason, 'notFound');
});
test('他のアプリが占有（NotReadableError）は busy として error になる', async () => {
  const { media, events, cam } = setup();
  cam.start();
  media.pending[0].reject(domError('NotReadableError'));
  await flush();
  assert.equal(cam.state, 'error');
  assert.equal(events.at(-1).reason, 'busy');
});
test('play() が失敗したら取得済みの track をすべて停止し、video の参照も外す', async () => {
  const { media, video, events, cam } = setup();
  video.playError = new Error('再生できません');
  cam.start();
  const s = fakeStream();
  media.pending[0].resolve(s);
  await flush();
  assert.equal(cam.state, 'error');
  assert.equal(events.at(-1).reason, 'playback');
  assert.ok(s.tracks.every((t) => t.stopped), '取得した track は必ず停止する');
  assert.equal(video.srcObject, null);
  assert.equal(cam.stream, null);
});
test('stream の取得に成功しても、途中で失敗すれば track を残さない', async () => {
  const { media, video, cam } = setup();
  video.playError = new Error('再生できません');
  cam.start();
  const s = fakeStream();
  media.pending[0].resolve(s);
  await flush();
  assert.equal(s.tracks[0].listenerCount('ended'), 0, '監視も残さない');
});
test('分類：ブラウザーのエラー名を理由に変換する', () => {
  assert.equal(classifyCameraError({ name: 'NotAllowedError' }), 'denied');
  assert.equal(classifyCameraError({ name: 'SecurityError' }), 'denied');
  assert.equal(classifyCameraError({ name: 'NotFoundError' }), 'notFound');
  assert.equal(classifyCameraError({ name: 'NotReadableError' }), 'busy');
  assert.equal(classifyCameraError({ name: 'OverconstrainedError' }), 'unsupported');
  assert.equal(classifyCameraError({ name: 'TypeError' }), 'unknown');
  assert.equal(classifyCameraError(undefined), 'unknown');
});
/* ---------------- 古い要求・連打 ---------------- */
test('stop の後に届いた古い要求の stream は採用せず、停止する', async () => {
  const { media, events, cam } = setup();
  cam.start();              // 要求1
  cam.stop();               // 要求1を取り消す
  cam.start();              // 要求2
  const s2 = fakeStream(640, 480);
  media.pending[1].resolve(s2);
  await flush();
  assert.equal(cam.state, 'ready');
  assert.equal(cam.stream, s2);
  const s1 = fakeStream(1280, 720);
  media.pending[0].resolve(s1);   // 古い完了が遅れて届く
  await flush();
  assert.ok(s1.tracks[0].stopped, '古い stream は解放する');
  assert.equal(cam.stream, s2, '最新の状態を上書きしない');
  assert.equal(cam.state, 'ready');
  assert.equal(events.at(-1).width, 640);
});
test('進行中に start・retry を連打しても getUserMedia は1回だけ', () => {
  const { media, cam } = setup();
  cam.start();
  cam.start();
  cam.retry();
  cam.start();
  assert.equal(media.calls.length, 1);
});
test('エラー後の再試行の連打でも、要求は1つだけ', async () => {
  const { media, cam } = setup();
  cam.start();
  media.pending[0].reject(domError('NotReadableError'));
  await flush();
  cam.retry();
  cam.retry();
  cam.retry();
  assert.equal(media.calls.length, 2, '最初の失敗の後の再試行は1回だけ');
});
/* ---------------- 切断・映像停止 ---------------- */
test('track が ended になると lost になり、stream を停止して監視を解除する', async () => {
  const { media, events, cam } = setup();
  cam.start();
  const s = fakeStream();
  media.pending[0].resolve(s);
  await flush();
  const track = s.tracks[0];
  assert.equal(track.listenerCount('ended'), 1);
  track.emit('ended');
  assert.equal(cam.state, 'lost');
  assert.equal(events.at(-1).reason, 'trackEnded');
  assert.ok(track.stopped);
  assert.equal(track.listenerCount('ended'), 0, '監視は解除する');
});
test('video が emptied になったら lost になる（映像の停止を検知）', async () => {
  const { media, video, events, cam } = setup();
  cam.start();
  media.pending[0].resolve(fakeStream());
  await flush();
  video.emit('emptied');
  assert.equal(cam.state, 'lost');
  assert.equal(events.at(-1).reason, 'videoStopped');
});
test('stop で現在の track を停止し、監視も解除する', async () => {
  const { media, cam } = setup();
  cam.start();
  const s = fakeStream();
  media.pending[0].resolve(s);
  await flush();
  cam.stop();
  assert.ok(s.tracks[0].stopped);
  assert.equal(s.tracks[0].listenerCount('ended'), 0);
  assert.equal(cam.state, 'idle');
  assert.equal(cam.stream, null);
});
/* ---------------- 復旧（再試行） ---------------- */
test('lost からの再試行で新しい stream に入れ替わり、古い監視は残らない', async () => {
  const { media, cam } = setup();
  cam.start();
  const s1 = fakeStream();
  media.pending[0].resolve(s1);
  await flush();
  s1.tracks[0].emit('ended');
  cam.retry();
  assert.equal(media.calls.length, 2);
  assert.equal(cam.state, 'starting');
  const s2 = fakeStream();
  media.pending[1].resolve(s2);
  await flush();
  assert.equal(cam.state, 'ready');
  assert.equal(s2.tracks[0].listenerCount('ended'), 1, '新しい track の監視は1つだけ');
  assert.equal(s1.tracks[0].listenerCount('ended'), 0, '古い track の監視は残らない');
});
test('異なる解像度で再接続すると、新しい解像度を通知する', async () => {
  const { media, video, events, cam } = setup();
  cam.start();
  const s1 = fakeStream(1280, 720);
  media.pending[0].resolve(s1);
  await flush();
  s1.tracks[0].emit('ended');
  cam.retry();
  media.pending[1].resolve(fakeStream(640, 480));
  await flush();
  assert.equal(video.videoWidth, 640);
  assert.equal(video.videoHeight, 480);
  assert.equal(events.at(-1).width, 640);
  assert.equal(events.at(-1).height, 480);
});
test('再試行中（starting）は retrying を true として通知する', async () => {
  const { media, events, cam } = setup();
  cam.start();
  media.pending[0].resolve(fakeStream());
  await flush();
  events.length = 0;
  cam.stop();
  cam.retry();
  const retrying = events.find((e) => e.state === 'starting');
  assert.ok(retrying, '再試行の開始を通知する');
  assert.equal(retrying.retrying, true);
});
/* ---------------- 破棄 ---------------- */
test('dispose 後に届いた完了は stream を停止し、状態も通知も変えない', async () => {
  const { media, events, cam } = setup();
  cam.start();
  const before = events.length;
  cam.dispose();
  const s = fakeStream();
  media.pending[0].resolve(s);
  await flush();
  assert.ok(s.tracks[0].stopped);
  assert.notEqual(cam.state, 'ready');
  assert.equal(events.length, before, '破棄後は通知しない');
});
test('dispose は現在の track の監視も解除する', async () => {
  const { media, cam } = setup();
  cam.start();
  const s = fakeStream();
  media.pending[0].resolve(s);
  await flush();
  cam.dispose();
  assert.ok(s.tracks[0].stopped);
  assert.equal(s.tracks[0].listenerCount('ended'), 0);
});
