# ONI 04：機械式鬼面

2026-11-23、Blender 5.3.0。ユーザー提供「ChatGPT 画像 2026年11月23日 20:23:45」の
正面・左右参考図から、Codexの補助で新規モデリングしたマスク。
既存PROTOTYPE 04の原本・GLBは変更していない。外部3D資産や画像textureは使用しない。
参考図に寸法がないため、曲面、鼻孔内部、裏面は制作時に補っている。

## 形状とファイル

- `project-chrome/assets/models/mask-oni-04.blend`：編集原本。
- `project-chrome/assets/models/mask-oni-04.glb`：texture不要の配布モデル。
- `scripts/blender/create_oni_mask.py`：生成・スタジオレンダー。
- `scripts/blender/validate_oni_mask.py`：配布ファイルの再import検査。

前へ張り出す鼻梁と鼻先、Booleanで開けた鼻孔、二重の波形口枠、口の奥の六角金網、
黒い内壁、4本の曲がった犬歯、上下14本の小さい歯を別部品で制作している。
頬の3連機構は同心円の金属ベゼル・黒い溝・赤いレンズ・発光部・小ねじに分割。
下顎には二重のケーブルと蛇腹の稜線、中央フィルターを追加。
赤いスリットは暗い受け皿と高い縁の内側へ配置している。
口枠と網は約0.2モデル単位の深さ差があり、平面画像を貼った構造ではない。

Outlinerの`ONI • shell teeth grille mechanisms`から部品を選んで編集する。
歯は先細りの断面を重ねた閉じたmesh。鼻孔・タブ穴のBooleanは適用済み。
原本の679部品は編集用に分かれており、Web読込時だけ共通ローダーで材質単位へ結合する。
装甲色は`MaskShell`・`OniRaisedArmor`。赤い`MaskLED`と象牙色の`OniCeramicTeeth`は独立。
歯のアニメーション、口の開閉、可動ギミックは今回実装していない。

## 座標とアプリ

Blender X=横、Z=上、-Y=正面。glTF標準変換後はX=横、Y=上、Z=正面。
共通rootは`MaskRoot`。配布寸法は幅2.536・高さ2.05・奥行き約1.087。
顎下端はglTFのY=-.856に揃える。原本rootのscale/locationはこの正規化のために使う。
PROTOTYPEと異なる縦横比は`MASK_MODELS.oni`の`heightSpan`・`widthScale`で追従へ渡す。

MASK → Mask model → `ONI 04 / 鬼面`、`マスクを装着`をONで読み込む。
モデルを変更すると前のモデルを破棄し、装甲色を選択モデルの初期色へ戻す。
サイズ・高さ・奥行きは保持し、RESETでPROTOTYPE・OFF・高さ-0.05などの共通初期値へ戻る。
顔推論は既存FaceLandmarkerを利用し、新しい推論器は追加しない。

## 生成と検証

```powershell
blender --background --python-exit-code 1 --python scripts/blender/create_oni_mask.py
blender --background --python-exit-code 1 --python scripts/blender/validate_oni_mask.py
```

再生成は原本の手編集を退避してから`-- --replace`を付ける。
`-- --preview-dir <作業用フォルダー>`で正面・斜め・側面を出力できる。
共通装甲ヘルパーの`create_mask.py`をimportするが、既存マスクを生成・上書きしない。
スタジオのカメラ・照明はGLBに含まれない。

Blender再importで部品・有限座標・寸法・顎位置・上下の犬歯が交差しないことを確認。
GLBは約6.9MB、225,310三角形。モデルの歯・金網・発光材質と顎基準の追従比率をNodeテストでも確認。
依存復元、lint、全113テストに成功。
ローカルIn-app browserでCAMERA ONLINE、ONIの読込と顔追従status、実映像への描画を確認。
PROTOTYPEへの切替とONIへの再切替も確認した。
コンソールはMediaPipeのdelegate初期化INFOのみで、新しい実行時エラーはなかった。

複数PCでのFPS、長時間運転、遠側の顔遮蔽、PNG保存、歯の実寸感は未検証。
カメラ写真や個人の背景はrepoへ保存していない。
