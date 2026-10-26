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
