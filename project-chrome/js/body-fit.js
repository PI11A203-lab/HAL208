// 体格に合わせた腕の太さ：人物の切り抜きマスクから、上腕・前腕の実際の幅を測ります。
// three.js・DOMに依存しない関数だけを置き、Nodeの自動テストから直接検査します。

// mask：0〜1 の値（人物らしさ）が並んだ配列（幅 width × 高さ height、行ごと）
// a, b：区間の両端（ピクセル { x, y }）。区間の途中（at の位置）で、区間に垂直な方向へ人物の端まで測る。
// 両側とも端が見つからない時や、測れた値が少ない時は null を返す
export function measureWidth(mask, width, height, a, b, { at = [0.35, 0.5, 0.65], maxHalf = 120, threshold = 0.5 } = {}) {
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  if (len < 4) return null;
  const nx = -dy / len, ny = dx / len;
  const inside = (x, y) => {
    const ix = Math.round(x), iy = Math.round(y);
    if (ix < 0 || iy < 0 || ix >= width || iy >= height) return false;
    return mask[iy * width + ix] >= threshold;
  };
  const widths = [];
  for (const t of at) {
    const cx = a.x + dx * t, cy = a.y + dy * t;
    if (!inside(cx, cy)) continue;
    let left = 0, right = 0;
    while (left < maxHalf && inside(cx + nx * (left + 1), cy + ny * (left + 1))) left++;
    while (right < maxHalf && inside(cx - nx * (right + 1), cy - ny * (right + 1))) right++;
    const lc = left >= maxHalf, rc = right >= maxHalf;
    if (lc && rc) continue;                               // 両側とも端が見つからない
    // 片側が胴体とつながっている（腕を体の横に下ろした時など）：追跡点は腕の中心なので、見えている側の2倍とする
    if (lc || rc) { widths.push(2 * Math.min(left, right) + 1); continue; }
    // 両側に端があっても左右の差が大きい時は、胴体の端まで測っているとみなし、近い側の2倍とする
    widths.push(Math.abs(left - right) <= 0.35 * (left + right) ? left + right + 1 : 2 * Math.min(left, right) + 1);
  }
  if (widths.length < 2) return null;
  widths.sort((p, q) => p - q);
  return widths[Math.floor(widths.length / 2)];
}

// 測った幅をなめらかにする（急な変化・測れなかったフレームの影響を抑える）
export function createSmoother(alpha = 0.2) {
  let value = null;
  return {
    update(sample) {
      if (sample === null || !Number.isFinite(sample)) return value;
      value = value === null ? sample : value + (sample - value) * alpha;
      return value;
    },
    get value() { return value; },
    reset() { value = null; },
  };
}
