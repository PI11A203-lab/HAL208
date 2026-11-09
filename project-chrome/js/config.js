// デザイン一覧と初期設定（日本語コメント）
// 新しいアームのデザインは DESIGNS に追加します。
export const DEFAULTS = { smooth: 0.5, depth: 0.5, thick: 1, showArm: true, showSkel: false };

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
};

export const DESIGNS = {
  mk1:   { name: "MK-I", desc: "ミニマルな産業用義手。", long: "強度と耐久性を高めた基本的な機械式アーム。信頼性が高く汎用的な標準モデル。",
           metal: 0xaab2ba, rough: 0.28, joint: 0x1a1e24, neon: 0x00e5ff, glow: 1.2, thick: 1.0, stats: [50, 45, 60], css: ["#aab2ba", "#1a1e24", "#00e5ff"] },
  neon:  { name: "NEON EDGE", desc: "発光するシアンのラインを備えたスリムな設計。", long: "漆黒のクロームフレームに発光ラインと高度なセンサーを統合したスリムモデル。",
           metal: 0x0b0f13, rough: 0.12, joint: 0x05080a, neon: 0x00e5ff, glow: 3.2, thick: 0.85, stats: [35, 85, 45], css: ["#0b0f13", "#05080a", "#00e5ff"] },
  titan: { name: "TITAN FRAME", desc: "重作業向けの産業用エグゾスケルトン。", long: "最大出力と積載能力を重視した重作業向けの産業用アーム。",
           metal: 0x3a3d42, rough: 0.4, joint: 0x18191c, neon: 0xffb300, glow: 1.6, thick: 1.3, stats: [90, 30, 85], css: ["#4a4e55", "#18191c", "#ffb300"] },
};
