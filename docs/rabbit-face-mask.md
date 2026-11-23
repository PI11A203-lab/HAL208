# RABBIT 04 顔マスク

ユーザー提供の2026-11-24の4面図を基に、新規作成した編集用Blender原本。
既存のウサギ耳・ONIとは別のモデルです。WebのMASK選択から`RABBIT 04 / ウサギ`を選び、ONで試着できます。

## 原本と部品

- 原本：[mask-rabbit-04.blend](../project-chrome/assets/models/mask-rabbit-04.blend)
- Web配布：[mask-rabbit-04.glb](../project-chrome/assets/models/mask-rabbit-04.glb)
- 生成スクリプト：[create_rabbit_mask.py](../scripts/blender/create_rabbit_mask.py)
- `MaskRoot`配下に、左右のアイボリ頬・ピンクの鼻・左右の前歯・フレーム・ヒンジ・LEDを分離。
- 頬は厚みと膨らみを持つ閉じたメッシュ。左右各3本の短いひげ溝はBooleanで実際に切削。
- 前歯は別メッシュで、中央に細い隙間を残し、根元を中央のアイボリ部品へ埋め込む。
- 頬下のLEDは発光面より手前に溝の縁がある構造。上・下の側面レール間は実際の開口。
- フレームはチャコール、頬と歯は暖色アイボリ、鼻とLEDは淡いピンク。

## Blenderで編集

1. 原本を開き、Outlinerの`RABBIT`コレクションを展開する。
2. `Left/Right ivory cheek`、`Soft pink triangular nose`、`Left/Right short front tooth`等を選ぶ。
3. Tabでメッシュを編集する。口線と細いリングはCurveの制御点を編集できる。
4. 鼻のSubdivision、装甲のBevelは残してあり、Modifierから調整できる。

## 再生成とレンダー

Blender 5.3、repoルートから実行。`<出力先>`はrepo外の作業用フォルダーを指定する。

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe' --background --python-exit-code 1 --python scripts/blender/create_rabbit_mask.py -- --render-dir '<出力先>'
```

既存の原本を再生成する場合だけ`--replace`を付ける。手編集を上書きするため、編集済み原本は別名保存してから実行する。
正面・左側面・右側面・45度を同じ正投影縮尺、1500×1300、Cyclesで出力する。
正面の表情と45度の頬の量感を優先している。参考図の側面は斜めの視点を含むため、厳密な製造図面の復元ではない。

## 検証

```powershell
& 'C:/Program Files/Blender Foundation/Blender 5.3/blender.exe' --background --python-exit-code 1 --python scripts/blender/validate_rabbit_face_mask.py
```

頬の閉じた形状、部品分離、歯の隙間、モデル寸法、LEDと溝の深さを検証する。
Web書き出しは`export_rabbit_face_mask.py`を同じBlenderコマンドの`--python`へ指定する。
原本を保存し直さず、CurveをMeshに変換し、手続きBumpを外してGLBへ出力する。
Webでは材質単位で8 Meshにまとめ、アイボリ・鼻・LEDは装甲色変更の対象外とする。
既存の顎基準の顔追従を共用し、鼻〜顎の制作寸法1.30、横幅係数1.02で初期配置する。
実カメラでの見え方には個人差があるため、必要ならサイズ・高さ・奥行きを調整する。

2026-11-24の確認：Blender 5.3で生成・4方向レンダー・上記形状検証が成功。
モデル外形は幅2.758、奥行き1.848、高さ1.950（制作単位）。
`npm run lint`と`npm test`（114件成功）、`git diff --check`も実行。
WindowsのブラウザーでMASK選択肢、実GLBのWebGL描画、ONIとの切替、OFF/RESET、
装甲色変更時の頬・鼻・LEDの色維持を確認した。検証ページのconsoleにerror/warnなし。
実カメラは`Device in use`で取得できず、顔追従の見た目と実撮影は未確認。
追従数式と顎の支点は自動テストで確認した。カメラ不要の検証ページは作業後に削除済み。
