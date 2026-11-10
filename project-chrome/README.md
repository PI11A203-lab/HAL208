# PROJECT CHROME — フェーズ5

Webカメラ映像に、姿勢追跡を使ってサイバネティックな腕・猫耳・目のエフェクトを重ねる試作版です。

## 起動方法

1. このフォルダーを展開します。
2. ターミナルで `project-chrome` フォルダーに移動します。
3. 次を実行します。

```bash
python3 -m http.server 8000
```

4. ブラウザーで `http://localhost:8000` を開きます。
5. カメラへのアクセスを許可します。

ES Modules とカメラ API を使用するため、`index.html` をダブルクリックして `file://` で開かず、ローカルサーバー経由で起動してください。MediaPipe と Three.js の読み込みにはインターネット接続が必要です。

## チーム開発・自動検査

通常のPR先は `develop`、`develop` から `main` への最終マージは管理者本人が行います。
検査はこのフォルダーの一つ上（リポジトリのルート）で実行します。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm test
```

CIの配置方法・必須check・手動カメラ確認は [CI_SETUP.md](../CI_SETUP.md) を参照してください。

## フォルダー構成

```text
project-chrome/
├── index.html       ページ構造
├── css/
│   └── style.css    見た目・レイアウト
├── js/
│   ├── main.js      起動、描画ループ、UIイベントの統合
│   ├── config.js    デザイン一覧と初期設定
│   ├── tracking.js  One Euro フィルター
│   ├── arms.js      GLB腕モデルの読込・表示
│   ├── arm-model.js 腕モデルの規格と姿勢計算（Nodeテスト対象）
│   ├── body-fit.js  人物マスクから腕の幅を測る（Nodeテスト対象）
│   ├── face.js      猫耳ジオメトリ
│   └── ui.js        UI共通ヘルパー（段階的な分離用）
└── assets/models/   GLBモデルと規格（README.md）
```

## 自作の猫耳・腕を追加する

### 1. Blenderでモデルを作る

- Blenderでパーツを作成します。
- `File > Export > glTF 2.0` を選び、`.glb` 形式で出力します。
- 出力したファイルを `models/` に置きます。
- モデルの原点、向き、スケールを確認します。腕は上腕・前腕・手を分けると追跡に合わせやすくなります。

### 2. GLB読み込みヘルパー

`js/arms.js` には Three.js の `GLTFLoader` を使う `loadGLB()` を用意しています。読み込んだモデルを既存の追跡グループに追加する処理は、モデルの原点・向き・スケールを確認してから接続してください。

APPLY すると、選んだ装備のGLBモデル（MK-I：`arm-mk1.glb`、NEON EDGE：`arm-neon.glb`、TITAN FRAME：`arm-titan.glb`）を読み込んで表示します。モデルが読み込めない場合は案内を出し、円柱・球体の腕で表示を続けます。
腕の太さは、カメラに映った人の腕の実際の幅に合わせて自動で変わります。GLBの腕では、手を追跡して指が1本ずつ動きます（初回は手の追跡モデルの読み込みに数秒かかります）。
腕モデルのノード名・原点・向き・縮尺・マテリアル名の規格は [assets/models/README.md](assets/models/README.md) を参照してください。

### 3. 猫耳の形をコードで調整する

`js/face.js` の `earShape()` で輪郭を編集できます。より複雑な造形にしたい場合はBlenderで作った `.glb` を使う方法がおすすめです。

## 注意

- カメラ映像と追跡処理はブラウザー内で動作します。
- MediaPipe/Three.js のライブラリとモデルファイルは外部URLから読み込むため、起動時にインターネット接続が必要です。
- この分割版は元の `faz5.html` の挙動をできるだけ維持する安全寄りの初回整理です。UIイベントや追跡処理の完全な独立化は、動作確認しながら段階的に進めてください。
