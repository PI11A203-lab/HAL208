# LEDウサギ耳（#25）

## 起動・操作
`project-chrome/`で`python -m http.server 8000 --bind 127.0.0.1`を実行し、
http://127.0.0.1:8000/ を開く。カメラを許可してHEAD → RABBIT LED (Blender) → EarsをON。
LED colorで内周の色、Inner LEDで点灯/消灯を変更する。Ear colorは外殻だけに適用する。
横位置・高さ・サイズは猫耳と共通。長い耳の上に余白が必要なので、カメラから少し離れて調整する。
猫耳との切替では手動位置・サイズ・LED設定を維持する。RESETはCLASSIC・未装着・既定色へ戻る。

## 立体構造
2026-11-19 20:22:19のユーザー提供4面デザインを参考に作成した独自モデル。
原図は依頼チャット内にある。画像そのもの・顔写真はrepoに含めない。

- 外枠前面：glTF Z=+0.17。傾斜した内壁の底：Z=-0.01。実際の凹みは0.18。
- 内板は厚さ0.035の閉じた板。背板・背面カバーを別に置き、内部は貫通させない。
- 内周LED中心：Z=+0.035、半径0.012。前縁より奥で、内板より手前に配置。
- 左右とも高さ約3.39、幅約0.96。原点は根元ヒンジ付近。glTF +Yが上、+Zが正面。
- EarLeft/EarRightは本人の左右。負scaleは使わず、別Meshとして左右を生成する。
- EarShell / EarInner / EarLED / EarHardware / EarGasket / EarMarkingsを分離。
- 初期LEDは淡いピンク #ff9fc9。emissiveIntensity=1.25、消灯時=0。
  emissiveだけで周辺を実照明する仕組みではない。bloomは追加していない。
- GLB：1,181,496 bytes。LED曲線の過剰な分割を減らして軽量化した。
  表示倍率はEAR_MODELS.rabbit.faceWidthScale=0.30。
  猫耳の倍率0.42とは別に設定する。

## Blenderで編集・再生成
原本：`project-chrome/assets/models/ears-rabbit-led.blend`。
生成手順：Blender 5.3の新規ファイルで`scripts/blender/create_rabbit_ears.py`を実行する。
コマンド例（repoルート）：

```powershell
& 'C:\Program Files\Blender Foundation\Blender 5.3\blender.exe' --background --factory-startup --python scripts/blender/create_rabbit_ears.py
```

既存の.blend/GLBは上書きしない。再生成する場合は原本を安全な場所へ退避してから行う。
手編集後は左右rootと材質名を維持し、左右root以下だけをGLBへexportする。
正面だけでなく斜め・側面、LED消灯時にも内壁と段差を確認する。

## アプリの契約
`EAR_MODELS`がURL・表示名・モデルid・倍率・LED対応を管理する。
既存猫耳のid `cyber-ears`は維持。UIの値`glb`も変更しない。
ウサギ耳のidは`rabbit-led`、UIの値は`rabbit`。
モデル切替で旧資産を解放し、遅延した旧読込結果は表示せず解放する。
同じモデルのOFF/ONでは準備済み資産を再利用する。RESETは資産も破棄する。
猫耳はEarLED不要、ウサギ耳はEarLED必須。読込・契約不備はCLASSIC表示へfallbackする。

描画は既存の同一Three.js canvasに含むため、既存PNG合成へ参加する。
#22の装備明細へ渡す項目案：`id`、`name`、`ledColor`、`ledEnabled`。
購入・QR自体は本変更に含めない。

## 作業基点と検証
`feat/25-rabbit-led-ears`は最新origin/develop（97f44b6）から作成し、ローカル試験用に
未統合の猫耳PR #24（ae3df24）をfast-forwardで取り込んだ依存ブランチ。
main/developやPR #24へウサギ耳の変更をpushしない。
develop向けPRを出す際は、先行PR統合後の差分とcommit履歴を再確認する。

- Blender 5.3：原本生成・GLB出力・斜めレンダーで内壁/LEDを確認。
- 自動検査：左右root、配布GLBの実奥行き、LEDの奥行き/材質、色の分離、
  モデル切替時の古い非同期結果の破棄、RESET/解放、既存機能のテスト。
- `npm ci --ignore-scripts --no-audit --no-fund`、`npm run lint`、`npm test`を実行。
  Windows / Node.js 20.19.5、自動テスト47件成功。
- 一時検証ページで実際のThree.jsローダーを使用し、ウサギ耳の描画、
  ピンク→シアン→LED消灯、猫耳→ウサギ耳の切替を確認。コンソールerrorなし。
  一時ページ・確認用レンダーはrepoに残さない。
- 実カメラはブラウザーの許可待ち。実カメラの位置・長時間FPS・腕/目同時使用・
  PNG最終見た目は別途手動確認が必要。
  自動テストやBlenderレンダーだけで成功済みとは扱わない。
