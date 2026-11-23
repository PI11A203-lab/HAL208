// ピクセル空間（+Y=上、+Z=手前）の顔から装着姿勢を計算する。
const sub = (a, b) => a.map((v, i) => v - b[i]);
const length = a => Math.hypot(...a);
const unit = a => a.map(v => v / length(a));
const cross = (a, b) => [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]];

export function fitMask({ left, right, forehead, chin, nose }, { size = 1, lift = 0, depth = 0 } = {}) {
  const points = [left, right, forehead, chin, nose];
  if (!points.every(p => Array.isArray(p) && p.length === 3 && p.every(Number.isFinite))) return null;
  if (![size, lift, depth].every(Number.isFinite) || size <= 0) return null;
  const width = length(sub(right, left)), vertical = sub(forehead, chin);
  if (width < 1 || length(vertical) < 1) return null;
  const up = unit(vertical), forwardRaw = cross(sub(right, left), up);
  if (length(forwardRaw) < 1e-5) return null;
  const forward = unit(forwardRaw), horizontal = unit(cross(up, forward));
  const noseToChin = Math.abs(sub(nose, chin).reduce((sum, v, i) => sum + v * up[i], 0));
  if (noseToChin < 1) return null;
  const sx = width * 1.08 / 2.533 * size;
  const sy = noseToChin / 1.55 * size;
  // 短縮後モデルの顎下端Y=-.856を顔の顎152へ合わせる。
  // 鼻を高さの固定点にすると短縮分が上へ浮くため、顎を拡縮の支点にする。
  const noseDepth = sub(nose, chin).reduce((sum, v, i) => sum + v * forward[i], 0);
  const origin = chin.map((v, i) => v + up[i] * (.856 * sy + lift * width)
    + forward[i] * (noseDepth - .57 * sx + width * (.035 + depth)));
  return { origin, right: horizontal, up, forward, scale: [sx, sy, sx] };
}

export const LOADOUT_CATEGORIES = ['arms', 'eyes', 'mask', 'head'];
export function adjacentCategory(current, direction) {
  const index = Math.max(0, LOADOUT_CATEGORIES.indexOf(current));
  return LOADOUT_CATEGORIES[Math.max(0, Math.min(LOADOUT_CATEGORIES.length - 1, index + direction))];
}
