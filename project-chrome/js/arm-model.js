// 腕GLBモデルの契約と、追跡座標から部品の姿勢を求める計算（Issue #7）。
// three.js・DOMに依存しない関数だけを置き、Nodeの自動テストから直接検査します。
// 契約の詳細は project-chrome/assets/models/README.md を参照してください。

// 腕GLBに必要なノード名（関節ごとの独立した部品）
export const ARM_PARTS = ['UpperArm', 'Forearm', 'Hand'];
// 外観を変更するときに使うマテリアル名（#10 の色・素材変更と共有）
export const ARM_MATERIAL_SLOTS = ['shell', 'joint', 'emission'];

// モデル内のノード名一覧から、足りない必須ノードを返す
export function findMissingParts(nodeNames, required = ARM_PARTS) {
  const names = new Set(nodeNames);
  return required.filter((name) => !names.has(name));
}

// 非同期読込の「最新の依頼」だけを有効にする。
// 連続で装備を切り替えたりRESETした後に、古い読込完了でモデルが復活しないようにする。
export function createRequestTracker() {
  let current = 0;
  return {
    next() { current += 1; return current; },
    isCurrent(id) { return id === current; },
    cancel() { current += 1; },
  };
}

const EPS = 1e-6;
const length = (v) => Math.hypot(v[0], v[1], v[2]);
const scaleVec = (v, s) => [v[0] * s, v[1] * s, v[2] * s];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

// 軸 y に垂直で、ref にできるだけ近い単位ベクトル（ref が y と平行なら null）
function perpendicular(ref, y) {
  const v = [ref[0] - y[0] * dot(ref, y), ref[1] - y[1] * dot(ref, y), ref[2] - y[2] * dot(ref, y)];
  const len = length(v);
  return len < 1e-4 ? null : scaleVec(v, 1 / len);
}

// 点 a（関節）から点 b（次の関節）へ部品を合わせる姿勢を求める。
// ・原点を a に置き、部品の +Y を a→b に向ける
// ・部品の +Z（前面）はできるだけカメラ側（シーンの +Z）へ向ける
// ・Y方向は区間長／基準長、X・Z方向は太さ／基準半径で拡縮する
// part：{ baseLength, baseRadius, radiusScale }、thickness：腕の太さ（ピクセル）
// front：部品の +Z を向けたい方向（省略時はカメラ側。指では手の甲の向きを渡す）
export function segmentPose(a, b, part, thickness, front = [0, 0, 1]) {
  const d = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = length(d);
  const yAxis = len < EPS ? [0, 1, 0] : scaleVec(d, 1 / len);
  const zAxis = perpendicular(front, yAxis) ?? perpendicular([0, 0, 1], yAxis) ?? perpendicular([0, -1, 0], yAxis);
  const xAxis = cross(yAxis, zAxis); // 右手系（x = y × z）
  const radial = (thickness * (part.radiusScale ?? 1)) / part.baseRadius;
  return {
    position: [a[0], a[1], a[2]],
    xAxis, yAxis, zAxis,
    scale: [radial, Math.max(len, 1e-3) / part.baseLength, radial],
  };
}

// 手首から前腕の方向へ手の先端を伸ばした点（手の向きは追跡していないため前腕の延長とする）
export function handTip(elbow, wrist, ratio = 0.45) {
  return [0, 1, 2].map((i) => wrist[i] + (wrist[i] - elbow[i]) * ratio);
}

/* ---------------- 指の追跡（MediaPipe Hand Landmarker の21点） ---------------- */
// 0：手首、1〜4：親指、5〜8：人差し指、9〜12：中指、13〜16：薬指、17〜20：小指
// GLB の指の節（ノード名）と、合わせるランドマークの区間
export const FINGER_BONES = [
  { node: 'Thumb1', from: 1, to: 2 }, { node: 'Thumb2', from: 2, to: 3 }, { node: 'Thumb3', from: 3, to: 4 },
  { node: 'Index1', from: 5, to: 6 }, { node: 'Index2', from: 6, to: 7 }, { node: 'Index3', from: 7, to: 8 },
  { node: 'Middle1', from: 9, to: 10 }, { node: 'Middle2', from: 10, to: 11 }, { node: 'Middle3', from: 11, to: 12 },
  { node: 'Ring1', from: 13, to: 14 }, { node: 'Ring2', from: 14, to: 15 }, { node: 'Ring3', from: 15, to: 16 },
  { node: 'Pinky1', from: 17, to: 18 }, { node: 'Pinky2', from: 18, to: 19 }, { node: 'Pinky3', from: 19, to: 20 },
];

// 手の甲が向いている方向（シーン座標、y は上向き）。isRight：本人の右手か
// 右手では (人差し指の付け根 − 手首) × (小指の付け根 − 手首) が手のひら側を向くため、その逆が手の甲
export function handBackNormal(points, isRight) {
  const w = points[0], a = points[5], b = points[17];
  const u = [a[0] - w[0], a[1] - w[1], a[2] - w[2]], v = [b[0] - w[0], b[1] - w[1], b[2] - w[2]];
  const n = cross(u, v);
  const len = length(n);
  if (len < EPS) return [0, 0, -1];
  return scaleVec(n, (isRight ? -1 : 1) / len);
}

// 検出した手を、手首が近い腕に1つずつ割り当てる（遠すぎる手は使わない）
// handWrists・armWrists：{ x, y }（ピクセル）。戻り値：腕ごとの手の番号（なければ -1）
export function assignHands(handWrists, armWrists, maxDist) {
  const result = armWrists.map(() => -1);
  const pairs = [];
  handWrists.forEach((h, hi) => armWrists.forEach((a, ai) => {
    const d = Math.hypot(h.x - a.x, h.y - a.y);
    if (d <= maxDist) pairs.push([d, hi, ai]);
  }));
  pairs.sort((p, q) => p[0] - q[0]);
  const usedHands = new Set();
  for (const [, hi, ai] of pairs) {
    if (result[ai] !== -1 || usedHands.has(hi)) continue;
    result[ai] = hi;
    usedHands.add(hi);
  }
  return result;
}
