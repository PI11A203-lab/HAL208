# ONI装甲改修版：別名保存と4方向確認

ユーザー指定の現状レンダーと目標3面図を比較し、2026-11-23にBlender 5.3で改修。
`mask-oni-04.blend`を実際に開いて外殻・鼻・歯・頬パネルのmesh dataを編集し、
`project-chrome/assets/models/mask-oni-04-refined.blend`へ別名保存した。
元ファイルは保存せず保全した。2026-11-24の追加依頼で、WebのONI参照先を改修版GLBへ切り替えた。

## 改修内容

- 太い円形の口枠・口ひげチューブを除去。広い面、急な内壁、裏面を持つ閉じた上下装甲へ変更。
- 上装甲は鼻下から頬へ巻き上げ、下装甲は下牙の根元を覆って顎装甲へ重ねる。
- 大きな4本の牙は独立した閉じたmesh。軸自体を3次元Bezierで曲げ、根元を太くし先端を内側へ向けた。
- 下牙を延長し、上牙と交差しない位置へ配置。根元は装甲面より奥に入れる。
- 金網を縦に縮め、後方へ移動。黒い口腔壁も新しい口の輪郭へ合わせる。
- 鼻梁と突出した鼻先を再造形。斜めに広がる鼻孔と閉じた内部空間を追加。
- 頬の落ち込みと隆起、下顎の絞りを外殻の実形状で表現。
- 頬モジュール一式を外向きへ回し、特に下段を装甲へ埋める。
- LEDの位置に本体を貫く開口を切り、狭い溝の奥へ発光面を置く。
- 中央フィルターを顎装甲の間に埋め、ケーブルを装甲の隙間へ寄せる。
- 無光沢チャコール材質へ微細なNoise/Bumpを加える（Blenderの手続き材質）。

## 比較・確認結果

目標画像は中央を正面輪郭の基準にし、側面は鼻・牙・顎の前後差の参考にした。
全高を揃えた比較で口の縦寸法を減らし、歯と装甲が占める割合を増やした。
改修版の寸法は幅2.536、奥行き1.241、高さ2.26。幅/高さは約1.12。
口開口部の上下差は全高の38.5%。
45度で、装甲の内壁、装甲に入る牙の根元、牙の背後にある金網、下顎装甲との段差を確認。
左右の真横では鼻と牙の曲がり、装甲の厚み、モジュールの外向き角度を確認した。

`validate_refined_oni_mask.py`で次を検査：4本の牙の閉鎖・外向き法線、上下牙同士が交差しないこと、
根元が装甲面より奥にあること、グリルが牙より後方にあること、有限座標と開口比率。
元原本のSHA256が改修前後で同一であることも確認。
`npm run lint`、`npm test`（113件）、`git diff --check`も成功。
これらのNode検査はBlender形状の検査とは別工程。

## 再実行

```powershell
blender --background --python-exit-code 1 --python scripts/blender/refine_oni_mask.py -- --render-dir <作業用出力先>
blender --background --python-exit-code 1 --python scripts/blender/validate_refined_oni_mask.py
```

同名の改修版が存在する場合、再作成には`--replace`が必要。
検証器は今回の元原本のハッシュを固定している。元原本を意図して変更する場合は比較基準も更新する。
レンダーは`oni-refined-front.png`、`oni-refined-left.png`、`oni-refined-right.png`、
`oni-refined-45deg.png`（1600×1400）。

## Webへの反映（2026-11-24）

`export_refined_oni_mask.py`が幅調整済みの`mask-oni-04-fit.blend`を開き、原本をsaveせずに
`mask-oni-04-fit.glb`をexportする。`MASK_MODELS.oni`はこの別GLBを参照する。
旧原本・旧GLBは保管。新版の高さに合わせて追従の`heightSpan`を2.22へ調整し、顎基準と初期高さ-0.05は維持。
mainとconfigの読込URLを更新し、ブラウザーに残った旧モデル設定を使用しないようにした。
Webでは色、金属感、粗さ、赤色発光を維持。Blender専用の手続きBumpはexport時だけ外す。
微細な粒子の凹凸を完全に再現する場合は、法線textureのbakeが別途必要。

```powershell
blender --background --python-exit-code 1 --python scripts/blender/export_refined_oni_mask.py
blender --background --python-exit-code 1 --python scripts/blender/validate_oni_mask.py
```

新版GLBの再importは成功。幅2.536・奥行き1.241・高さ2.26、367,236三角形、約10.5MB。
ブラウザーで実際の新版URLを読み、9描画呼出し・367,236三角形のWebGL描画を確認。
最初はキャッシュされた旧URLの読込を検出し、configのversion更新後に新版URLで再検証した。
カメラ付きメイン画面では初期化完了を確認できず、この交換後の実カメラ追従は未確認。
lint・113テスト・diff checkに成功。

### 頬・ストラップ側の幅とハイライト

`tune_oni_cheeks.py`で改修原本を保全しながら、外側だけを広げた`mask-oni-04-fit.blend`を保存。
中央の口・牙を伸ばさず、頬・ラグは片側最大0.12外へ移動する。丸い機構は変形せず一式で移動。
幅は2.536から2.758へ約8.8%増加し、奥行き1.241・高さ2.26を維持。
装甲のroughnessを外殻0.46・重ね板0.43へ少し下げ、clearcoat 0.08で弱い反射を追加。
歯・網・赤色LEDの材質は変更しない。
基準幅と`widthScale`は維持し、形状を広げた分が実際の表示へ反映されるようにする。
ブラウザーでfit版URL、幅2.758、9描画呼出し、両装甲のroughnessとclearcoatを実測して描画を確認。
最新GLBは365,828三角形。再import・lint・113テストに成功。実カメラでの幅の適合は確認待ち。
