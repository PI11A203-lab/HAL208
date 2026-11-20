// カメラ入力の開始・停止・再試行と状態通知（#20）。
// DOM の表示は持たず、navigator.mediaDevices と video は引数で受け取る（Node のテストで確認できるようにするため）。
// 状態：idle（停止）/ starting（準備中・再試行中）/ ready（使用可能）/ error（失敗）/ lost（切断・映像停止）
const DEFAULT_CONSTRAINTS = { video: { width: 1280, height: 720 }, audio: false };
// ブラウザーのエラー名を、画面の案内に使う理由名へ変換する
export function classifyCameraError(err) {
  switch (err?.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return 'denied';        // 権限の拒否（再試行だけでは解除されない。設定の案内が必要）
    case 'NotFoundError':
      return 'notFound';      // カメラが見つからない
    case 'NotReadableError':
      return 'busy';          // 他のアプリが占有している・USB切断直後など
    case 'OverconstrainedError':
      return 'unsupported';   // 要求した解像度・条件に合わない
    default:
      return 'unknown';
  }
}
function stopStream(stream) {
  if (!stream || typeof stream.getTracks !== 'function') return;
  for (const track of stream.getTracks()) {
    try { track.stop(); } catch { /* 停止に失敗しても後始末は続ける */ }
  }
}
export function createCameraInput({ mediaDevices, video, constraints = DEFAULT_CONSTRAINTS, onChange }) {
  let state = 'idle';
  let current = null;          // 使用中の stream
  let trackListeners = [];     // [track, handler] の組。解除漏れを防ぐため必ず記録する
  let requestId = 0;           // 最新の要求だけを採用するための番号
  let disposed = false;
  function emit(nextState, extra = {}) {
    if (!onChange) return;
    onChange({ state: nextState, reason: null, width: null, height: null, retrying: false, ...extra });
  }
  function onTrackEnded() { handleLoss('trackEnded'); }
  function onVideoStopped() { handleLoss('videoStopped'); }
  // 使用中の stream・監視・video の参照を片付ける（何度呼んでも安全）
  function release() {
    for (const [track, handler] of trackListeners) track.removeEventListener('ended', handler);
    trackListeners = [];
    video.removeEventListener('emptied', onVideoStopped);
    const stream = current;
    current = null;
    stopStream(stream);
    try { video.pause(); } catch { /* 再生していない時は何もしない */ }
    if (video.srcObject) video.srcObject = null;
  }
  // ready の時だけ切断として扱う（release 中の emptied などで誤って lost にしない）
  function handleLoss(reason) {
    if (state !== 'ready') return;
    release();
    state = 'lost';
    emit('lost', { reason });
  }
  function attach(stream) {
    current = stream;
    state = 'ready';
    trackListeners = stream.getTracks().map((track) => {
      track.addEventListener('ended', onTrackEnded);
      return [track, onTrackEnded];
    });
    video.addEventListener('emptied', onVideoStopped);
    emit('ready', { width: video.videoWidth, height: video.videoHeight });
  }
  function fail(id, reason) {
    if (disposed || id !== requestId) return;
    state = 'error';
    emit('error', { reason });
  }
  function onStream(id, stream) {
    // 古い要求・破棄後の完了は採用せず、届いた stream だけ解放する
    if (disposed || id !== requestId) { stopStream(stream); return; }
    video.srcObject = stream;
    let playing;
    try {
      playing = Promise.resolve(video.play());
    } catch (err) {
      playing = Promise.reject(err);
    }
    playing.then(
      () => {
        if (disposed || id !== requestId) {
          stopStream(stream);
          if (video.srcObject === stream) video.srcObject = null;
          return;
        }
        attach(stream);
      },
      () => {
        stopStream(stream);
        if (video.srcObject === stream) video.srcObject = null;
        fail(id, 'playback');
      },
    );
  }
  function begin(retrying) {
    release();
    const id = ++requestId;
    state = 'starting';
    emit('starting', { retrying });
    let pending;
    try {
      pending = Promise.resolve(mediaDevices.getUserMedia(constraints));
    } catch (err) {
      pending = Promise.reject(err);
    }
    pending.then(
      (stream) => onStream(id, stream),
      (err) => fail(id, classifyCameraError(err)),
    );
  }
  return {
    // 停止中・失敗後に開始する。準備中・使用中は何もしない（連打で要求を重ねない）
    start() {
      if (disposed || state === 'starting' || state === 'ready') return;
      begin(false);
    },
    // 失敗・切断の後に再試行する。準備中・使用中は何もしない
    retry() {
      if (disposed || state === 'starting' || state === 'ready') return;
      begin(true);
    },
    // 停止する。進行中の要求も取り消す
    stop() {
      if (disposed) return;
      requestId++;
      release();
      state = 'idle';
      emit('idle');
    },
    // 破棄する。以後は通知しない（進行中の完了は受け取った stream を止めて捨てる）
    dispose() {
      if (disposed) return;
      disposed = true;
      requestId++;
      release();
      state = 'idle';
    },
    get state() { return state; },
    get stream() { return current; },
  };
}