// APPLY した時の装着（組み立て）演出のタイミング計算。three.js・DOMに依存せず、Nodeの自動テストから検査します。
// 部品が 上腕 → 前腕 → 手 → 指 の順に画面の外から飛んできて、関節にはまる（Armored Core の組み立て画面を参考）。

export const ASSEMBLY_STAGES = [
  { key: 'upper', label: 'UPPER ARM', joint: 'shoulder' },
  { key: 'fore', label: 'FOREARM', joint: 'elbow' },
  { key: 'hand', label: 'HAND UNIT', joint: 'wrist' },
  { key: 'fingers', label: 'FINGER SERVOS ×15', joint: 'knuckles' },
];
// gap：次の部品が飛び始めるまでの秒数、dur：1つの部品が飛んできてはまるまでの秒数、hold：完了表示を残す秒数
export const ASSEMBLY_TIMING = { gap: 0.32, dur: 0.45, hold: 1.4 };

const clamp01 = (x) => Math.min(1, Math.max(0, x));
// 少し行き過ぎてから戻る（はまる手ごたえ）
export function easeOutBack(x) {
  const t = clamp01(x), c1 = 1.70158, c3 = c1 + 1;
  if (t === 0 || t === 1) return t;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

// 部品 i が関節にはまる時刻（演出の開始からの秒数）
export const lockTime = (i, { gap, dur } = ASSEMBLY_TIMING) => i * gap + dur;
// 演出全体の長さ（最後の部品がはまってから hold 秒まで）
export const assemblyDuration = (timing = ASSEMBLY_TIMING) => lockTime(ASSEMBLY_STAGES.length - 1, timing) + timing.hold;

// 経過 t 秒の時の部品 i の進み具合：0＝画面の外、1＝関節にはまった。t が null なら演出なし（1）
export function stageProgress(t, i, { gap, dur } = ASSEMBLY_TIMING) {
  if (t === null || t === undefined) return 1;
  return easeOutBack((t - i * gap) / dur);
}

// 前のフレーム prev から今のフレーム t までの間にはまった部品の番号
export function lockedBetween(prev, t, timing = ASSEMBLY_TIMING) {
  const out = [];
  ASSEMBLY_STAGES.forEach((_, i) => {
    const at = lockTime(i, timing);
    if (prev < at && t >= at) out.push(i);
  });
  return out;
}
