# 機械式ハーフマスク：Blender制作

Refs #30。2026-11-23、Blender 5.3.0、Codexで制作を補助した初期モデル。
ユーザー提供の「ChatGPT 画像 2026年11月23日 18:51:34」の正面・側面図を参考に、
中央分割装甲、顎の通気口、頬のリンク機構とベルトの立体形状を制作した。
参照画像をtextureへ転用していない。寸法・背面は図面のない部分を補っている。

## ファイルと編集

- `project-chrome/assets/models/mask-prototype-04.blend`：編集用原本。
- `project-chrome/assets/models/mask-prototype-04.glb`：材質・文字を内包した配布候補。
- `scripts/blender/create_mask.py`：形状・材質・スタジオの生成。
- `scripts/blender/validate_mask.py`：GLB再importの確認。

Blenderで原本を開き、Outlinerの`MASK • editable armor and hardware`を展開する。
正面装甲、顎、内殻、頬、留め具、文字は個別オブジェクト。
装甲の`Real armor thickness`と`Machined edge radius`で厚み・角丸を調整する。
顎の通気口だけはBooleanを適用済み。再配置する場合は生成スクリプトを変更する。
テンキー1で正面、3で側面、マウス中ボタンドラッグで回転できる。
スタジオ照明とカメラは別collectionにあり、GLBには含めない。

上下面を塞ぐ中実の塊ではなく、曲げた薄い内殻と独立した装甲板で顔を囲む。
裏側に顔が入る空間があり、中央から頬の後方へ回り込む。
通気口の背後にも黒い内殻がある。ベルトの織り目はgeometryで表現。

## 軸と装着基準

BlenderはX=横、Z=上、-Y=正面。glTF標準変換後はX=横、Y=上、Z=正面。
`MaskRoot`は中央の継ぎ目付近、縦方向の中程。モデルの幅は約2.54単位。
鼻先を原点にしていないため、顔追従を実装する時はrootから鼻位置の補正が必要。
外殻の色は`MaskShell`、顎は`MaskLowerArmor`。
金具・ゴム・織りベルト・印字の材質は独立している。

## 再生成・検証

新規Blenderから次を実行する（`blender`は実行ファイルのパスに置き換え可）。

```powershell
blender --background --python scripts/blender/create_mask.py
blender --background --python scripts/blender/validate_mask.py
```

既存出力があれば生成を停止する。再生成は編集した原本を退避し、
`-- --replace`を明示する。開いている別のblendには実行しない。
`-- --preview-dir <出力フォルダー>`で正面・斜め・内面のPNGを生成できる。
プレビュー画像は作業確認用でありrepoには追加しない。

## アプリでの試着

ARMS → EYES → MASK → HEADの順。カテゴリー左右の矢印、横スクロール、
タブの左右キー・Home/Endで移動できる。カメラ準備中もメニュー移動は可能。
MASKの`PROTOTYPE 04 を装着`をONにするとGLBを読み込む。初期状態はOFF。
既存FaceLandmarkerの鼻根6、額10、顎152、頬234/454を使って姿勢と拡縮を合わせる。
サイズ・高さ・奥行き・装甲色を調整でき、他カテゴリーへ移っても装備は保持する。
目・耳・腕と併用できる。顔を見失うと既存の0.6秒保持後に隠し、再検出で復帰する。
RESETはOFFと全調整値を初期値へ戻す。RESET/OFF中に完了した古い読込は破棄する。
読込失敗はMASKのstatusへ表示し、OFF→ONで再試行する。

WebGLの共通sceneへ描画するため、既存PNG撮影の合成対象にもなる。
編集原本の207meshは維持し、ブラウザー読込時に材質ごとへ結合して7描画呼出しにする。
配布geometryは67,268三角形、GLBは約2.7MB。

## 確認結果と残る確認

Windows、2026-11-23、作業base `1e88f6d`（未commitの#30作業差分）。
Blender 5.3でGLB再import、構成・寸法・有限座標の検査に成功。
ブラウザーでGLB読込、材質単位の結合、Y-up寸法、色設定、装着計算、WebGL描画に成功。
実際のメニューで次へ2回→MASK、HEADへ進む→MASKへ戻る操作を確認。
`npm ci --ignore-scripts --no-audit --no-fund`、`npm run lint`、`npm test`（103件）に成功。
最初のsandbox内npm ciは失敗したため、通常環境で依存を復元してから再検証した。

In-app browserは`Device in use`でカメラを取得できず、カメラ使用中のEdgeにもローカルURLを開いた。
実カメラの装着位置、鼻・顎との干渉、追跡喪失/再検出、RESETの視覚確認、
他装備との併用、PNG実撮影、FPSは未確認。自動テストはこれらの代わりにはならない。
大きく横を向いた時の顔による遠側装甲の遮蔽も未実装。
Issue #30全体の完了判定は実カメラ確認後に行う。

### develop統合後の確認（2026-11-23）

最新develop `6473bbd`（#29）をマスク作業へmerge。package.json、index.html、main.jsの競合を解消し、
入店演出、カメラ枠、商品画像、腕の即時試着を維持したままMASKとカテゴリー矢印を統合した。
カテゴリー操作はカメラ待機中も有効にし、初期化完了時にも選択中カテゴリーと矢印の端判定を維持する。
ブラウザーのCAMERA ONLINE、マスクstatus「装着中：顔に追従しています。」、
色・サイズ・高さ・奥行き操作、MASK→HEAD→MASKで装備維持を確認。
コンソールにはMediaPipeのdelegate初期化INFOのみで、追加の実行時エラーはなかった。
依存復元・lint・全111テストに成功。RESET、顔喪失からの復帰、PNG保存、FPSの比較は引き続き未検証。
