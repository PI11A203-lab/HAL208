// デザイン一覧と初期設定（日本語コメント）
// 新しいアームのデザインは DESIGNS に追加します。
export const DEFAULTS = { smooth: 0.5, depth: 0.5, thick: 1, showArm: true, showSkel: false };

export const DESIGNS = {
  mk1:   { name: "MK-I", desc: "ミニマルな産業用義手。", long: "強度と耐久性を高めた基本的な機械式アーム。信頼性が高く汎用的な標準モデル。",
           metal: 0xaab2ba, rough: 0.28, joint: 0x1a1e24, neon: 0x00e5ff, glow: 1.2, thick: 1.0, stats: [50, 45, 60], css: ["#aab2ba", "#1a1e24", "#00e5ff"] },
  neon:  { name: "NEON EDGE", desc: "発光するシアンのラインを備えたスリムな設計。", long: "漆黒のクロームフレームに発光ラインと高度なセンサーを統合したスリムモデル。",
           metal: 0x0b0f13, rough: 0.12, joint: 0x05080a, neon: 0x00e5ff, glow: 3.2, thick: 0.85, stats: [35, 85, 45], css: ["#0b0f13", "#05080a", "#00e5ff"] },
  titan: { name: "TITAN FRAME", desc: "重作業向けの産業用エグゾスケルトン。", long: "最大出力と積載能力を重視した重作業向けの産業用アーム。",
           metal: 0x3a3d42, rough: 0.4, joint: 0x18191c, neon: 0xffb300, glow: 1.6, thick: 1.3, stats: [90, 30, 85], css: ["#4a4e55", "#18191c", "#ffb300"] },
};

// 素材の種類（金属 / マット）
export const MATERIAL_PRESETS = {
  metal: { label: "メタル", metalness: 0.9, roughness: 0.25 },
  matte: { label: "マット", metalness: 0.1, roughness: 0.85 },
};

// 展示用の固定プリセット（designId は上の DESIGNS に存在するものだけ）
export const DEMO_PRESETS = [
  { id: "demo-chrome", label: "クロームシルバー", designId: "mk1",
    appearance: { shellColor: "#aab2ba", jointColor: "#1a1e24", emissionColor: "#00e5ff", metalness: 0.9, roughness: 0.25, glow: 1.2 } },
  { id: "demo-night", label: "ナイトマット", designId: "neon",
    appearance: { shellColor: "#0b0f13", jointColor: "#05080a", emissionColor: "#00e5ff", metalness: 0.1, roughness: 0.85, glow: 3.2 } },
  { id: "demo-amber", label: "アンバーインダストリアル", designId: "titan",
    appearance: { shellColor: "#3a3d42", jointColor: "#18191c", emissionColor: "#ffb300", metalness: 0.8, roughness: 0.4, glow: 1.6 } },
];