# 腕3種のサテン仕上げとNEON EDGE装甲

2026-11-24、既存の`arm-mk1.blend`・`arm-neon.blend`・`arm-titan.blend`を開いて改修。
Webのシルバー／ブラック／グレーの外装色を維持し、耳・マスクと質感を揃えた。
追加調整でNEONのLEDは赤へ変更。MK-Iのシアン、TITANのアンバーは維持する。

## 変更

- 外装のmetallicを0.40、roughnessをMK-I=0.38、NEON=0.32、TITAN=0.44に調整。
- 外装に弱いClearcoatを付け、関節はmetallic=0.18、roughness=0.55とする。
- NEONのLEDはONIマスクの`MaskLED`と同じ色・発光量で固定。
  linear RGB=(0.55,0.001,0.002)、発光強度1.4、roughness=0.36。
  Webでも`ledLinear`を用いて同じlinear値を適用する（HEX近似は`#c40307`）。黒い外装は維持し、
  Clearcoatを0.25、Webの環境反射強度を1.8へ上げ、照明部分との明暗差を確保する。
- MK-IとNEONの指15節は幅1.25倍・厚み1.55倍。長さ・関節位置は変更しない。
  再実行時の累積拡大を防ぐ属性を付け、追従用の半径属性も更新する。
- NEONのみ手首を中心に手のひら・指・甲の追加装甲をさらに10%拡大。
  `Hand.handVisualScale=1.10`で累積拡大を防止し、追従基準の長さと手首の原点は維持する。
- NEON EDGEには肩〜上腕の重なった装甲、前腕と手の甲の装甲、外側の丸いセンサー、
  暗い座に埋めたシアンの細い発光スリット、放熱スリットと小さいボルトを追加。
- ONIの機械的な層・円形モジュールと共通性を持たせ、鬼の顔・角・牙は追加しない。

## 編集と再実行

各`arm-*.blend`が編集用原本。NEONの追加部品は`NEON`で始まる独立Meshとして各追従部品に親子付け。
既存の`UpperArm` / `Forearm` / `Hand`と15個の指ノード・原点・追従寸法は維持する。

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe' --background --python-exit-code 1 --python scripts/blender/arms/refine_arm_finish.py -- --render-dir '<repo外の確認画像フォルダー>'
& 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe' --background --python-exit-code 1 --python scripts/blender/arms/refine_arm_hands.py -- --render-dir '<repo外の確認画像フォルダー>'
```

最初のスクリプトで3種の共通仕上げ、次のスクリプトでMK-I/NEONの太い指と赤LEDを適用する。
順序を逆にするとNEONの反射設定が共通仕上げへ戻るため、必ず上記順で実行する。
最初のスクリプトは現在の原本を開き、専用属性を持つ追加部品だけを置換して再保存・GLB出力する。
手編集を残す場合は先に原本を別名保存する。確認ポーズと照明は保存・GLB出力の後に作成し、原本へ混入しない。
既存の新規生成スクリプトは初期形状用。通常の仕上げ直しには上記の改修スクリプトを使用する。

## 検証

- Blender 5.3で3原本の保存・GLB出力・各1枚の確認レンダーを実行。
- 原本の3材質のBase Colorが処理前後で一致することをスクリプト内で確認。
- `npm run lint`成功、`npm test`118件成功、`git diff --check`成功。
- GLBの必須ノード・指の属性・材質・2MB未満の容量・自己完結性を既存テストで確認。
- 配色、WebとGLBのroughness一致、Clearcoat、NEON追加部品を追加テストで確認。
- 実カメラでの腕・指追従、RESET、アクションとの同時表示は未確認。静的検査とBlenderレンダーで代用したとは扱わない。
