// デザイン一覧と初期設定（日本語コメント）
// 新しいアームのデザインは DESIGNS に追加します。
export const DEFAULTS = { smooth: 0.5, depth: 0.5, thick: 1, showArm: true, showSkel: false };

export const DESIGNS = {
  mk1:   { name: "MK-I", desc: "ミニマルな産業用義手。", long: "強度と耐久性を高めた基本的な機械式アーム。信頼性が高く汎用的な標準モデル。",
           model: "arm-mk1",
           metal: 0xaab2ba, rough: 0.28, joint: 0x1a1e24, neon: 0x00e5ff, glow: 1.2, thick: 1.0, stats: [50, 45, 60], css: ["#aab2ba", "#1a1e24", "#00e5ff"] },
  neon:  { name: "NEON EDGE", desc: "発光するシアンのラインを備えたスリムな設計。", long: "漆黒のクロームフレームに発光ラインと高度なセンサーを統合したスリムモデル。",
           model: "arm-neon",
           metal: 0x0b0f13, rough: 0.12, joint: 0x05080a, neon: 0x00e5ff, glow: 3.2, thick: 0.85, stats: [35, 85, 45], css: ["#0b0f13", "#05080a", "#00e5ff"] },
  titan: { name: "TITAN FRAME", desc: "重作業向けの産業用エグゾスケルトン。", long: "最大出力と積載能力を重視した重作業向けの産業用アーム。",
           model: "arm-titan",
           metal: 0x8c9097, rough: 0.42, joint: 0x18191c, neon: 0xffb300, glow: 1.6, thick: 1.3, stats: [90, 30, 85], css: ["#4a4e55", "#18191c", "#ffb300"] },
};

// 展示用のGLB腕モデル（Issue #7）。DESIGNS の model から id で参照します。
// node：GLB内のノード名、from/to：合わせる関節、baseLength：モデル上の部品の長さ、
// baseRadius：モデル上の部品の半径、radiusScale：腕の太さに対する倍率（簡易形状と同じ比率）。
// handRatio：手の長さ（前腕の長さに対する比率）、mirrorLeft：右腕として作ったモデルを左腕では左右反転する。
// 詳細は project-chrome/assets/models/README.md を参照してください。
export const ARM_MODELS = {
  "arm-mk1": {
    url: "./assets/models/arm-mk1.glb",
    handRatio: 0.7,
    mirrorLeft: true,
    parts: {
      upper: { node: "UpperArm", from: "shoulder", to: "elbow", baseLength: 1, baseRadius: 0.17, radiusScale: 1 },
      fore:  { node: "Forearm", from: "elbow", to: "wrist", baseLength: 1, baseRadius: 0.13, radiusScale: 0.85 },
      hand:  { node: "Hand", from: "wrist", to: "handTip", baseLength: 0.9, baseRadius: 0.15, radiusScale: 0.8 },
    },
  },
  "arm-neon": {
    url: "./assets/models/arm-neon.glb",
    handRatio: 0.7,
    mirrorLeft: true,
    parts: {
      upper: { node: "UpperArm", from: "shoulder", to: "elbow", baseLength: 1, baseRadius: 0.14, radiusScale: 1 },
      fore:  { node: "Forearm", from: "elbow", to: "wrist", baseLength: 1, baseRadius: 0.11, radiusScale: 0.85 },
      hand:  { node: "Hand", from: "wrist", to: "handTip", baseLength: 0.9, baseRadius: 0.13, radiusScale: 0.8 },
    },
  },
  "arm-titan": {
    url: "./assets/models/arm-titan.glb",
    handRatio: 0.7,
    mirrorLeft: true,
    parts: {
      upper: { node: "UpperArm", from: "shoulder", to: "elbow", baseLength: 1, baseRadius: 0.19, radiusScale: 1 },
      fore:  { node: "Forearm", from: "elbow", to: "wrist", baseLength: 1, baseRadius: 0.155, radiusScale: 0.85 },
      hand:  { node: "Hand", from: "wrist", to: "handTip", baseLength: 0.9, baseRadius: 0.17, radiusScale: 0.8 },
    },
  },
};

// 体格に合わせた腕の太さ（人物の切り抜きマスクから測る）
// cover：実際の腕より少し太くして覆う倍率、everyFrames：何フレームごとに測るか、smoothing：なめらかさ（小さいほどゆっくり変化）
export const BODY_FIT = { cover: 1.12, everyFrames: 5, smoothing: 0.2 };

// 腕のギミック（射出装置・弾）。長さ・大きさは前腕の太さ・長さに対する比率です。
// along：肘から取付位置までの距離（前腕長に対する割合）、out：腕の中心からの高さ（太さに対する倍率）、
// scale：モデル1単位の大きさ（太さに対する倍率）、barrelTravel：砲身が伸びる量・muzzle：砲身の後端から砲口まで（モデル単位）、
// range：飛距離（前腕長に対する倍率。溜めるほど伸びる）、netRadius：ネットの半径（太さに対する倍率）、
// projectileScale：フック・ネット弾の拡大率、fullCharge：満タンまで溜める秒数
export const GADGET = {
  url: "./assets/models/gadget-launcher.glb",
  along: 0.4, out: 0.95, scale: 7, barrelTravel: 0.14, muzzle: 0.27, range: 2.4, netRadius: 3, projectileScale: 1.6, fullCharge: 1.0,
};

// 指先の火：人差し指だけを立てて holdSec 秒で点く。size：手のひらの幅に対する炎の大きさ
export const FLAME = { holdSec: 0.2, size: 1.1 };

// 炎の連番画像（流体シミュレーションで作成。assets/fx/README.md）。cols×rows コマ、fps：再生速度、base：画像の下から炎の付け根までの割合
export const FIRE_FLIPBOOK = { url: "./assets/fx/fire-flipbook.jpg", cols: 8, rows: 8, fps: 30, base: 0.07 };

// 効果音（assets/sfx/。make-sfx.py で合成したオリジナル）。volume：全体の音量、gain：音ごとの音量の補正
export const SFX = {
  dir: "./assets/sfx/",
  volume: 0.8,
  files: {
    "charge-loop": "charge-loop.wav", "charge-full": "charge-full.mp3",
    "plasma-fire": "plasma-fire.mp3", "plasma-hit": "plasma-hit.mp3",
    "net-fire": "net-fire.mp3", "net-open": "net-open.mp3",
    "hook-fire": "hook-fire.mp3", "hook-reel": "hook-reel.mp3", "hook-hit": "hook-hit.mp3",
    "fist-launch": "fist-launch.mp3", "thrust-loop": "thrust-loop.wav", "fist-hit": "fist-hit.mp3",
    "flame-ignite": "flame-ignite.mp3", "flame-loop": "flame-loop.wav",
    "assemble-whir": "assemble-whir.mp3", "assemble-lock": "assemble-lock.mp3", "assemble-done": "assemble-done.mp3",
  },
  gain: { "assemble-whir": 0.35, "charge-loop": 0.6, "flame-loop": 1.4, "net-open": 1.3, "thrust-loop": 0.8 },
};
