import { ImageSegmenter } from 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14';
import { findHairOffsets } from './hair-fit.js';

export function createHairTracker(vision) {
  let segmenter = null, loading = false, failed = false;
  let lastRun = -Infinity, lastMatch = -Infinity, offsets = null;
  return {
    sample(video, timestamp, frame) {
      if (failed) return;
      if (!segmenter) {
        if (!loading) {
          loading = true;
          ImageSegmenter.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/image_segmenter/hair_segmenter/float32/1/hair_segmenter.tflite',
              delegate: 'GPU',
            },
            runningMode: 'VIDEO', outputCategoryMask: true, outputConfidenceMasks: false,
          }).then(value => { segmenter = value; }).catch(() => { failed = true; })
            .finally(() => { loading = false; });
        }
        return;
      }
      if (timestamp - lastRun < 400) return; // 毎フレームの推論を増やさない。
      lastRun = timestamp;
      try {
        segmenter.segmentForVideo(video, timestamp, result => {
          const mask = result.categoryMask;
          if (!mask) return;
          const next = findHairOffsets(mask.getAsUint8Array(), mask.width, mask.height, frame);
          if (!next) return;
          offsets = next.map((p, i) => offsets && timestamp - lastMatch < 800
            ? { u: offsets[i].u * 0.65 + p.u * 0.35, v: offsets[i].v * 0.65 + p.v * 0.35 } : p);
          lastMatch = timestamp;
          // maskはcallback内だけで利用し、画像を保持しない。
        });
      } catch {
        failed = true;
        segmenter.close(); segmenter = null;
        offsets = null;
      }
    },
    getOffsets(timestamp) { return timestamp - lastMatch < 800 ? offsets : null; },
    reset() { offsets = null; lastMatch = -Infinity; },
    get loading() { return loading; },
    get failed() { return failed; },
  };
}
