// MediaPipe HandLandmarker の初期化・推論・結果整形。
// CDNのクラスは main.js から注入する（Nodeテストでこのファイルをimportできるようにするため）。
// 失敗しても例外を外へ出さず、ボタン代替へ切り替えられるよう状態だけ返す。
import { HAND_CONFIG } from './gestures.js';

export const HAND_MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

// 結果を [{points(ピクセル空間), score, handId}] へ整形する。
// handIdは「手の切替検出」用の識別子。映像は未反転で入力するため左右ラベルは実際と逆になり得る。
// 意味の左右には使わず、同一性の判定だけに使う。
export function shapeHandResult(result, W, H) {
  const lms = result?.landmarks ?? [];
  return lms.map((lm, i) => {
    const cat = result.handedness?.[i]?.[0] ?? result.handednesses?.[i]?.[0];
    return {
      points: lm.map((q) => ({ x: q.x * W, y: q.y * H, z: (q.z ?? 0) * W })),
      score: cat?.score ?? 0,
      handId: cat?.categoryName ?? 'hand',
    };
  });
}

export function createHandInput({ HandLandmarker, vision, W, H, cfg = HAND_CONFIG }) {
  let landmarker = null, lastInferAt = -Infinity, lastTs = -1;
  const api = {
    status: 'idle', // idle | loading | ready | failed
    error: '',
    async init() {
      if (api.status !== 'idle') return api.status === 'ready';
      api.status = 'loading';
      for (const delegate of ['GPU', 'CPU']) {
        try {
          landmarker = await HandLandmarker.createFromOptions(vision, {
            baseOptions: { modelAssetPath: HAND_MODEL_URL, delegate },
            runningMode: 'VIDEO',
            numHands: 2,
          });
          api.status = 'ready';
          return true;
        } catch (e) { api.error = e?.message ?? String(e); }
      }
      api.status = 'failed';
      return false;
    },
    // 間引き付きの推論。新しい結果がなければ null（呼び出し側は前回値を使う）。
    detect(video, nowMs) {
      if (api.status !== 'ready' || nowMs - lastInferAt < cfg.inferIntervalMs) return null;
      const ts = Math.max(nowMs, lastTs + 1); // timestampは単調増加が必須
      try {
        const res = landmarker.detectForVideo(video, ts);
        lastInferAt = nowMs; lastTs = ts;
        return shapeHandResult(res, W, H);
      } catch (e) {
        api.error = e?.message ?? String(e);
        api.status = 'failed'; // 推論失敗は以降停止し、Pose/カメラには影響させない
        return null;
      }
    },
    close() { try { landmarker?.close(); } catch (e) { /* 無視 */ } landmarker = null; api.status = 'idle'; },
  };
  return api;
}
