// 腕装備の外観（色・素材・展示用プリセット）を扱う純粋ロジック。
// DOM / Three.js / カメラには依存しない（Nodeでテストできる）。
// 外観値: { shellColor, jointColor, emissionColor, metalness, roughness, glow }
// 色は "#rrggbb" 文字列で統一し、Three.js用の数値変換は描画側で行う。

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

export const LIMITS = Object.freeze({
  metalness: Object.freeze({ min: 0, max: 1 }),
  roughness: Object.freeze({ min: 0, max: 1 }),
  glow: Object.freeze({ min: 0, max: 5 }),
});

const COLOR_KEYS = ["shellColor", "jointColor", "emissionColor"];
const NUMBER_KEYS = ["metalness", "roughness", "glow"];
export const APPEARANCE_KEYS = Object.freeze([...COLOR_KEYS, ...NUMBER_KEYS]);

export function isValidColor(value) {
  return typeof value === "string" && HEX_COLOR.test(value);
}

function clamp(value, { min, max }) {
  return Math.min(max, Math.max(min, value));
}

function numberToHex(n) {
  return "#" + (n & 0xffffff).toString(16).padStart(6, "0");
}

// config.js の DESIGNS の1件（数値色）を外観値へ変換する。元の定数は変更しない。
export function designToAppearance(design) {
  return {
    shellColor: numberToHex(design.metal),
    jointColor: numberToHex(design.joint),
    emissionColor: numberToHex(design.neon),
    metalness: 0.9,
    roughness: design.rough,
    glow: design.glow,
  };
}

// 入力を検証して、安全な外観値を返す。不正な項目は base（既定値）のまま残し、errors に記録する。
export function sanitizeAppearance(input, base) {
  const result = { ...base };
  const errors = [];
  const source = input && typeof input === "object" ? input : {};
  for (const key of COLOR_KEYS) {
    if (!(key in source)) continue;
    if (isValidColor(source[key])) result[key] = source[key].toLowerCase();
    else errors.push(key);
  }
  for (const key of NUMBER_KEYS) {
    if (!(key in source)) continue;
    const v = source[key];
    if (typeof v === "number" && Number.isFinite(v)) result[key] = clamp(v, LIMITS[key]);
    else errors.push(key);
  }
  return { appearance: result, errors };
}

function sameAppearance(a, b) {
  return APPEARANCE_KEYS.every((k) => a[k] === b[k]);
}

// 状態:
//  designId : 装着中のデザイン（mk1 / neon / titan）
//  applied  : 装備に反映済みの外観
//  draft    : 編集中の外観（APPLYするまで装備に反映しない）
//  presetId : 画面に表示するプリセットID。個別に変えたら "custom"
//  basePresetId : 最後に選んだプリセットID（値を戻したときにプリセット表示へ戻すため覚えておく）
export function createAppearanceState(designs, demoPresets, defaultDesignId = "mk1") {
  const design = designs[defaultDesignId];
  if (!design) throw new Error(`unknown design: ${defaultDesignId}`);
  const base = designToAppearance(design);
  return Object.freeze({
    designs,
    demoPresets,
    defaultDesignId,
    designId: defaultDesignId,
    applied: base,
    draft: { ...base },
    presetId: null,
    basePresetId: null,
    errors: [],
  });
}

// プリセットを選ぶ。存在しない・不正なdesignIdのプリセットは無視してerrorsに記録する。
export function selectPreset(state, presetId) {
  const preset = state.demoPresets.find((p) => p.id === presetId);
  if (!preset || !state.designs[preset.designId]) {
    return { ...state, errors: ["unknown-preset"] };
  }
  const base = designToAppearance(state.designs[preset.designId]);
  const { appearance, errors } = sanitizeAppearance(preset.appearance, base);
  return { ...state, draft: appearance, presetId: preset.id, basePresetId: preset.id, pendingDesignId: preset.designId, errors };
}

// 個別編集（draftだけ変える）。プリセットと違う値になったら "custom"。
export function editDraft(state, patch) {
  const { appearance, errors } = sanitizeAppearance(patch, state.draft);
  const preset = state.demoPresets.find((p) => p.id === state.basePresetId);
  const presetBase = preset && state.designs[preset.designId]
    ? sanitizeAppearance(preset.appearance, designToAppearance(state.designs[preset.designId])).appearance
    : null;
  const stillPreset = presetBase && sameAppearance(appearance, presetBase);
  return { ...state, draft: appearance, presetId: stillPreset ? state.basePresetId : "custom", errors };
}

// APPLY：編集値を装備へ反映する。
export function applyDraft(state) {
  return {
    ...state,
    designId: state.pendingDesignId ?? state.designId,
    applied: { ...state.draft },
    pendingDesignId: undefined,
    errors: [],
  };
}

// 装備（デザイン）を切り替える。外観は新しいデザインの既定値になる。
export function switchDesign(state, designId) {
  if (!state.designs[designId]) return { ...state, errors: ["unknown-design"] };
  const base = designToAppearance(state.designs[designId]);
  return { ...state, designId, applied: base, draft: { ...base }, presetId: null, basePresetId: null, pendingDesignId: undefined, errors: [] };
}

// RESET：mk1の既定外観に戻す。
export function resetAppearance(state) {
  return createAppearanceState(state.designs, state.demoPresets, state.defaultDesignId);
}