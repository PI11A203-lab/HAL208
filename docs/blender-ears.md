# Blenderで耳を作り始める（#23）

最初から手で全て作る必要はありません。このrepoのスクリプトで左右の基本形を作り、
Blenderではその形を編集するところから始めます。作品の起動用Pythonとは別の作業です。

## 1. Blenderを用意する

[公式ダウンロード](https://www.blender.org/download/)からWindows版を入れ、Blenderを起動します。
公式の[Windows導入手順](https://docs.blender.org/manual/en/latest/getting_started/installing/windows.html)も参照できます。
この作業で追加addonや有料素材は不要です。

## 2. まず原本を開く（生成済み）

このrepoには初期モデルが入っています。Blenderの`File > Open`から
`project-chrome/assets/models/ears-prototype-04.blend`を開いて、そのまま編集を始められます。
生成スクリプトの再実行は不要です。正面表示はテンキー1、全体表示はHome、
色の確認は右上のMaterial Previewを使います。

以下はモデルがない新規環境で、一度だけ生成する場合の手順です。

1. 他の制作中ファイルを保存してから、`File > New > General`で新規ファイルを開く。
2. 上部の`Scripting`ワークスペースへ移動する。
3. Text Editorの`Open`で、このrepoの **scripts/blender/create_ears.py** を開く。
4. Text Editorの **Run Script（▶）** を押す。通常のPythonやブラウザーのConsoleでは実行しない。
5. `HAL208 Ears`というsceneに左右の耳ができ、次の二つが生成される。
   - `project-chrome/assets/models/ears-prototype-04.blend`（編集する原本）
   - `project-chrome/assets/models/ears-prototype-04.glb`（作品が読むモデル）
6. 既に出力ファイルがある場合は生成を停止する。再実行で作品を消さず、原本を開いて編集する。

スクリプトは他のscene/objectを削除しません。初期化済みの新規ファイルで実行してください。
最新版PROTOTYPE 04は修正済み正面参考図に合わせた、幅広い密閉外殻・三角パネル・外周クランプ・横軸ヒンジ・下部装着板です。
前面のPROTOTYPE / 04と下部の04はBlenderのTextで編集できます。GLBではMeshに変換されます。
内側も背板で塞ぎ、貫通穴は作っていません。黒い線は奥が塞がった溝です。
内部の三角板`InnerArmor`は奥に入り、`PanelRim`の傾斜内壁と外周レールが周囲を包みます。
内板の奥行きを変更する場合は、内壁の底・文字・内板のネジ・溝も合わせて動かしてください。
背板を内板の手前へ動かすと内板が隠れます。正面と斜めの両方から確認します。
リポジトリには最新版の原本とGLBだけを同梱します。旧試作が必要な場合は制作担当者のローカル控えを参照します。
2026-11-19にWindows / Blender 5.3.0で生成・GLB export・原本の再読込と材質表示を確認しました。
失敗時はエラー内容を残し、出力が完成したと扱わないでください。

## 3. 最初に触る操作

- 中ボタンドラッグ：視点を回す。ホイール：拡大/縮小。Shift+中ボタン：視点移動。
- Outlinerで`EarLeft`を開き、`LeftShell`等の部品を選ぶ。
- **G**：移動、**R**：回転、**S**：拡縮。X/Y/Zで軸を限定し、Enterで確定、Escで取消。
- **Tab**：選択したMeshのEdit Modeへ。頂点を動かして形を変える。再度TabでObject Modeへ。
- まず内側パネルや発光帯の形を少し変える。root（EarLeft/EarRight）の原点は動かさない。
- 根元pivotと幅/高さの規格を保つ。大きなサイズ変更はアプリのEar sizeで確認する。
- Material Propertiesで外殻等を編集する。`EarShell`という名前を変えるとアプリの色変更が接続しなくなる。
- 左右は別Meshなので片側だけ編集したらもう片側も揃える。初回は自動ミラーや骨を追加する必要はない。

「形を一箇所変える → 保存 → GLB export → 作品で確認」を小さく繰り返します。

## 4. 編集結果をGLBへ書き出す

1. `ears-prototype-04.blend`を開いて編集し、Ctrl+Sで原本を保存する。
2. `HAL208 Ears` sceneのObject ModeでAを押し、左右rootと子Meshを全選択する。
3. `File > Export > glTF 2.0`を選ぶ。
4. Formatを **glTF Binary (.glb)**、**Selected Objects**、**Active Scene**と**+Y Up**を有効にする。他のsceneの初期Cube等を含めない。
5. modifierを使う場合はApply Modifiersを有効にする。
6. `project-chrome/assets/models/ears-prototype-04.glb`へexportする。自分の編集結果で置き換える場合だけ上書き確認を行う。

Blenderの上方向はZ、glTFの上方向はYです。先端が横へ倒れた場合は規格とexport設定を確認し、
追跡コードへ場当たり的な回転補正を足さないでください。

## 5. 作品で確認する

repoルートで検証：
```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm test
```

起動：
```bash
cd project-chrome
python -m http.server 8000 --bind 127.0.0.1
```

1. http://localhost:8000 を開き、カメラを許可する。
2. **HEAD → Ear model → PROTOTYPE 04 (Blender) → Cat ears ON**。
3. 位置、左右、頭の傾き、色、サイズ、OFF/ON、RESETを確認する。
   PROTOTYPE 04は額の角ではなく、髪maskの頭頂付近の左右輪郭へ装着する。
   頭頂から顔幅の約0.22下の高さで輪郭を取り、装着板が側頭部の外側へ来るよう配置する。
   `横位置（＋で外側）`・`高さ（＋で上）`で髪型に合わせて調整でき、RESETで0に戻る。
   髪が見つからない場合・読込失敗時は顔から頭の外側を推定して配置する。状態表示を確認する。
4. 腕/目と同時に使い、PNGにも同じ耳が入るか確認する。
5. 変更が見えない場合はブラウザーの再読込と、GLBをexportした場所を確認する。

GLBがまだない/壊れている場合は案内を表示してCLASSICを使います。
配置を直したら耳をOFF→ONにして再試行します。正常読込後の再exportはページを再読込してください。
制作中の個人画像をGitHubへ添付する必要はありません。

髪検出は[MediaPipe HairSegmenter](https://ai.google.dev/edge/mediapipe/solutions/vision/image_segmenter)を
GLB耳の使用時だけ読み込み、最大約2.5回/秒で処理する。映像・maskはブラウザー内だけで処理し、保存・送信しない。
頭の移動・傾きは既存の顔追跡で毎フレーム更新する。照明、帽子、極端な横顔では推定配置になる場合がある。

## 公式参考

- [Text Editor / Run Script](https://docs.blender.org/manual/en/5.3/editors/text_editor.html)
- [glTF export](https://docs.blender.org/manual/en/5.2/addons/scene_gltf2.html)
- [耳モデルの規格と確認状況](../project-chrome/assets/models/README.md)
