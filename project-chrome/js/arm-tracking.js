// 腕追従の純粋計算（DOM・カメラ・CDN importを持たない）。
// Three.js描画からは独立しており、Nodeで単体テストできる。
// 本人の左腕=11/13/15、右腕=12/14/16（MediaPipe Pose）。

// 追跡状態の境界（秒）。ここで一元管理し、main.js側に散らさない。
export const TRACK_SEC = 0.1;  // これ未満の経過で tracking
export const HOLD_SEC = 0.6;   // これ未満の経過で holding、以降 lost

// 値が有限な数値か（NaN・Infinity・非数を弾く）。
export function isFiniteNumber(v) {
  return typeof v === "number" && Number.isFinite(v);
}

// 点 {x,y,z} の全成分が有限か。
export function isFinitePoint(p) {
  return !!p && isFiniteNumber(p.x) && isFiniteNumber(p.y) && isFiniteNumber(p.z);
}

// MediaPipeの正規化ランドマーク(0..1系, zは相対)をピクセル空間へ。
// 契約：x=q.x*W, y=q.y*H, z=q.z*W。W/Hはvideo本来の解像度（CSS表示幅ではない）。
export function landmarkToPixel(q, W, H) {
  return { x: q.x * W, y: q.y * H, z: (q.z ?? 0) * W };
}

// ピクセル空間→Three.jsシーン座標。
// y軸は上向きにするため y = H - y_px。
// zDepth はシーンZのスケール係数（正射影時は見た目に出ないが、透視投影では遠近を生む）。
// 透視投影化後も「符号は -z」を維持（カメラ前方が負Z方向）。
export function pixelToScene(p, H, zDepth) {
  return { x: p.x, y: H - p.y, z: -p.z * zDepth };
}

// 経過時間から追跡状態を決める。age = now - lastSeen（秒）。
// 1箇所で境界を管理し、tracking/holding/lost を返す。
export function trackState(age) {
  if (!(age >= 0)) return "lost";          // NaN や負値も安全側（lost）へ
  if (age < TRACK_SEC) return "tracking";
  if (age < HOLD_SEC) return "holding";
  return "lost";
}

// 腕(3点)の最新さ。最も古い点の経過時間を代表値とする。
// lastSeenMap: id→lastSeen(秒)。ids: [肩,肘,手首]。
export function armAge(ids, lastSeenMap, now) {
  let maxAge = 0;
  for (const id of ids) {
    const seen = lastSeenMap[id];
    const age = now - (isFiniteNumber(seen) ? seen : -Infinity);
    if (age > maxAge) maxAge = age;
  }
  return maxAge;
}

// 2点から区間（中心・長さ・単位方向）を求める。
// ゼロ長（または非有限）の場合は dir=null を返し、呼び出し側でQuaternion生成を避けさせる。
export function segment(a, b) {
  if (!isFinitePoint(a) || !isFinitePoint(b)) return null;
  const dx = b.x - a.x, dy = b.y - a.y, dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  const center = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 };
  if (!(len > 1e-6)) return { center, len: 0, dir: null };
  return { center, len, dir: { x: dx / len, y: dy / len, z: dz / len } };
}

// Z（奥行き）のフレーム間変化を制限する。単眼のZは最も不安定で、腕が重なると急に跳ねる。
// prevZ から newZ への変化を maxDelta までに抑え、跳ねを緩和する（荒ぶり対策）。
// prevZ が非有限（初回）なら newZ をそのまま採用。maxDelta<=0 なら制限しない。
export function clampZStep(prevZ, newZ, maxDelta) {
  if (!isFiniteNumber(newZ)) return prevZ;          // 異常な新値は捨てて前回保持
  if (!isFiniteNumber(prevZ)) return newZ;          // 初回
  if (!(maxDelta > 0)) return newZ;                 // 制限なし
  const d = newZ - prevZ;
  if (d > maxDelta) return prevZ + maxDelta;
  if (d < -maxDelta) return prevZ - maxDelta;
  return newZ;
}

// ベクトルの外積（3D）。a×b を返す。
export function cross(a, b) {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

// ベクトルを正規化。長さ0または非有限なら null。
export function normalize(v) {
  if (!isFinitePoint(v)) return null;
  const len = Math.hypot(v.x, v.y, v.z);
  if (!(len > 1e-6)) return null;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

// 手の向き・ひねりを求める（設計書§3.3）。すべてシーン座標。
// wrist=手首, index=人差し指付け根, pinky=小指付け根。
// forward: 手首→(index/pinky中点) の単位ベクトル（手が指す向き）。
// normal: (index-wrist)×(pinky-wrist) の単位ベクトル（手の甲の法線＝ひねり）。
// 指が信頼できない（非有限・ゼロ長）場合は null を返し、呼び出し側で前腕方向にフォールバックさせる。
export function handOrientation(wrist, index, pinky) {
  if (!isFinitePoint(wrist) || !isFinitePoint(index) || !isFinitePoint(pinky)) return null;
  const mid = { x: (index.x + pinky.x) / 2, y: (index.y + pinky.y) / 2, z: (index.z + pinky.z) / 2 };
  const forward = normalize({ x: mid.x - wrist.x, y: mid.y - wrist.y, z: mid.z - wrist.z });
  const vIndex = { x: index.x - wrist.x, y: index.y - wrist.y, z: index.z - wrist.z };
  const vPinky = { x: pinky.x - wrist.x, y: pinky.y - wrist.y, z: pinky.z - wrist.z };
  const normal = normalize(cross(vIndex, vPinky));
  if (!forward || !normal) return null;
  return { forward, normal };
}

// 両肩(シーン座標)から肩幅を求める。x/y平面上の距離を使い、下限でクランプ。
// 異常に大きい値（maxFactor*W超）は無効として前回値を保持させるため null を返す。
export function shoulderWidth(leftShoulder, rightShoulder, W, prev) {
  if (!isFinitePoint(leftShoulder) || !isFinitePoint(rightShoulder)) return prev;
  const d = Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y);
  if (!(d > 0) || d > W) return prev;        // 0・非有限・画面幅超は異常として無視
  return Math.max(d, 0.1 * W);               // 下限：画面幅の10%
}
