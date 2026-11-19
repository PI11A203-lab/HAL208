// 髪maskから頭頂付近の左右輪郭を求める。座標は反転前の動画pixel。
// 顔座標へ戻して保持し、低頻度の髪推論の間も頭の動きに追従させる。
export function findHairOffsets(mask, width, height, frame) {
  const { origin, right, up, faceWidth, imageWidth, imageHeight } = frame;
  const det = right.x * up.y - right.y * up.x;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0 ||
      mask.length !== width * height || ![faceWidth, imageWidth, imageHeight].every(n => Number.isFinite(n) && n > 0) ||
      !Number.isFinite(det) || Math.abs(det) < 0.2) return null;
  const points = [];
  const stride = Math.max(1, Math.floor(width / 256));
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      if (mask[y * width + x] !== 1) continue; // HairSegmenter: 0=背景、1=髪。
      const dx = (x + 0.5) / width * imageWidth - origin.x;
      const dy = (y + 0.5) / height * imageHeight - origin.y;
      const u = (dx * up.y - dy * up.x) / det / faceWidth;
      const v = (right.x * dy - right.y * dx) / det / faceWidth;
      // 長い髪・肩・画面の別人物を、頭頂の配置に混ぜない。
      if (Math.abs(u) <= 0.85 && v >= -0.12 && v <= 1.1) points.push({ u, v });
    }
  }
  if (points.length < 25) return null;
  const quantile = (values, q) => {
    values.sort((a, b) => a - b);
    return values[Math.floor((values.length - 1) * q)];
  };
  const crown = quantile(points.map(p => p.v), 0.97);
  const level = Math.max(-0.1, Math.min(0.65, crown - 0.22));
  const band = points.filter(p => Math.abs(p.v - level) < 0.065).map(p => p.u);
  if (band.length < 12) return null;
  const left = quantile([...band], 0.03), rightEdge = quantile(band, 0.97);
  if (left > -0.12 || rightEdge < 0.12 || rightEdge - left < 0.45) return null;
  return [
    { u: Math.max(-0.80, Math.min(-0.38, left - 0.03)), v: level },
    { u: Math.min(0.80, Math.max(0.38, rightEdge + 0.03)), v: level },
  ];
}
