// デザイン一覧と初期設定（日本語コメント）
// 新しいアームのデザインは DESIGNS に追加します。
export const DEFAULTS = { smooth: 0.5, depth: 0.5, thick: 1, showArm: true, showSkel: false };
export const MASK_MODEL = { id: 'mask-prototype-04', name: 'PROTOTYPE 04', url: './assets/models/mask-prototype-04.glb' };
export const MASK_MODELS = {
  prototype: MASK_MODEL,
  oni: { id: 'mask-oni-04', name: 'ONI 04', url: './assets/models/mask-oni-04-fit.glb',
    heightSpan: 2.22, widthScale: 1.02, color: '#24272b' },
  rabbit: { id: 'mask-rabbit-04', name: 'RABBIT 04', url: './assets/models/mask-rabbit-04.glb',
    heightSpan: 2.15, widthScale: 1.02, liftOffset: 0.10, color: '#ffffff', fixedColor: true },
};
// 顎基準から少し下げた試着位置。起動時とRESETで共通にする。
export const MASK_DEFAULTS = { model: 'prototype', enabled: false, size: 1, lift: -0.05, depth: 0, color: '#35383b' };

// 腕の配置・投影に関する補正係数の一元管理。
// 個人ごとの固定pxを埋めず、肩幅・区間長の比率で調整する（arm-tracking契約5）。
export const ARM_TUNING = {
  // カメラ方式：true=透視投影（遠近が効く・①）、false=正射影（従来挙動）。
  // 切り分け用に残す。既定は透視投影だが、問題切り分け時は false にして従来挙動へ戻せる。
  usePerspective: true,
  // 透視投影カメラ。被写体から camDist(px) だけ引き、z=0平面が正射影と同じ見え方になるFOVを使う。
  // これにより x=q.x*W / y=q.y*H のピクセル座標はそのまま画面位置に一致し、z≠0の点だけ遠近が効く。
  camDist: 1800,     // カメラ距離(px相当)。大きいほど遠近が弱い（正射影に近い）。
  near: 1,
  far: 6000,
  // シーンZのスケール。MediaPipeの相対zを過剰に増幅するとnearクリップで消えるため控えめに。
  // 従来の settings.depth(0..1) と掛け合わせて最終的なZスケールにする。
  zDepthScale: 0.6,
  thickBase: 0.14,   // 腕の太さ基準（肩幅に対する比率）
  foreThickRatio: 0.85,
  // Z（奥行き）の荒ぶり対策。単眼のZは腕が重なると急に跳ねるため、専用に強めに抑える。
  zSmoothFactor: 0.1,   // Zのカットオフ倍率（<1で x/y より強く平滑化）。小さいほど滑らか・追従遅い。
  zMaxStepRatio: 0.1,  // 1フレームのZ変化上限（肩幅に対する比率）。跳ねをこの範囲にクランプ。
  // visibility ゲート：点が隠れてvisが落ちるとzが大きく誤推定して飛ぶ
  // （実測：クロス時に手首が vis51〜65% で Δz 0.4〜1.5の飛び。肩はvis100%で安定）。
  // vis がこの値未満の点は z を更新せず直前値を凍結する（x/y は追従させる）。
  // 点が描画される下限は VIS_MIN=0.5。それより高く、飛びの帯(〜0.65)の上に置く。
  zVisFreeze: 0.7,
};

export const EAR_MODEL = {
  id: 'cyber-ears', name: 'PROTOTYPE 04',
  url: './assets/models/ears-prototype-04.glb', faceWidthScale: 0.42,
};
export const EAR_MODELS = {
  glb: EAR_MODEL,
  rabbit: { id: 'rabbit-led', name: 'RABBIT LED',
    url: './assets/models/ears-rabbit-led.glb', faceWidthScale: 0.28, led: true,
    anchorWidthScale: 0.58, anchorLift: 0.06 },
};

export const DESIGNS = {
  mk1:   { name: "MK-I", desc: "ミニマルな産業用義手。", long: "強度と耐久性を高めた基本的な機械式アーム。信頼性が高く汎用的な標準モデル。",
           model: "arm-mk1",
           metal: 0xaab2ba, rough: 0.38, joint: 0x1a1e24, neon: 0x00e5ff, glow: 1.2, thick: 1.0, stats: [50, 45, 60], css: ["#aab2ba", "#1a1e24", "#00e5ff"] },
  neon:  { name: "NEON EDGE", desc: "赤いLEDと重ね装甲を備えたスリムな設計。", long: "黒いサテン装甲に赤い発光ラインと円形センサーを統合。反射と明暗で機械の輪郭を見せるスリムモデル。",
           model: "arm-neon",
           metal: 0x0b0f13, rough: 0.32, joint: 0x05080a, neon: 0xc40307, ledLinear: [0.55, 0.001, 0.002], glow: 1.4, envIntensity: 1.8, thick: 0.85, stats: [35, 85, 45], css: ["#0b0f13", "#05080a", "#c40307"] },
  titan: { name: "TITAN FRAME", desc: "重作業向けの産業用エグゾスケルトン。", long: "最大出力と積載能力を重視した重作業向けの産業用アーム。",
           model: "arm-titan",
           metal: 0x8c9097, rough: 0.44, joint: 0x18191c, neon: 0xffb300, glow: 1.6, thick: 1.3, stats: [90, 30, 85], css: ["#4a4e55", "#18191c", "#ffb300"] },
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
export const FLAME = { holdSec: 0.3, size: 1.1 };

// 炎の連番画像（流体シミュレーションで作成。assets/fx/README.md）。cols×rows コマ、fps：再生速度、base：画像の下から炎の付け根までの割合
export const FIRE_FLIPBOOK = { url: "./assets/fx/fire-flipbook.jpg", cols: 8, rows: 8, fps: 30, base: 0.12 };

// 待機画面（アトラクトモード）：人がいない時は案内とショーケース、人が来たら開始、離れたらリセット。
// 値の意味は attract-state.js の ATTRACT_DEFAULTS
export const ATTRACT_MODE = {
  enabled: true,
  enterSec: 1.0,        // この時間カメラの前にいたら始める
  leaveSec: 8,          // この時間いなかったら終わってリセット
  holdLeaveSec: 30,     // 購入中（QR の読み取りなど）は長めに待つ
  goodbyeSec: 2.5,      // 「またのお越しを」の表示時間
  minShoulder: 0.1,     // 遠すぎる人は数えない（肩幅が映像の幅のこの割合より小さい）
  centerMargin: 0.15,   // 映像の左右の端にいる人は数えない
  cycleSec: 4,          // ショーケースの商品を切り替える間隔
};

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