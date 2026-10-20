# HAL208 — Project Chrome

Webカメラ映像に、姿勢・顔追跡を使って腕・猫耳・目のエフェクトを重ねるチーム作品です。
作品はブラウザーでローカル起動します。デプロイは行いません。

## 起動
Python 3、ChromeまたはEdge、Webカメラを用意してください。外部ライブラリ・モデルの読込にインターネットが必要です。
```bash
git clone https://github.com/PI11A203-lab/HAL208.git
cd HAL208
git switch develop
cd project-chrome
python -m http.server 8000 --bind 127.0.0.1
```
http://localhost:8000 を開き、カメラを許可します。停止はターミナルでCtrl+C。
環境に応じてpythonをpython3またはpyに変更します。ES ModulesとカメラAPIを使うためfile://で開かないでください。

## 検証
Node.js 22推奨（最低20.19）。repoルートで実行します。
```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm test
```
CIはWindows・Linuxでlintと自動テスト、PR方向を確認します。
実カメラ、GPU描画、追跡精度は変更に応じて手動確認します。

## チームの作業先
- 作業ブランチ → develop：通常の開発・レビュー・統合。
- develop → main：最終確認版。**PI11A203-lab所有者だけが最終マージします。**
- main・developへの直接pushは行わずPRを使います。
- メンバー名の練習フォルダーを廃止し、作品の役割に応じてファイルを配置します。

## 構成と文書
- `project-chrome/`：作品のHTML・CSS・JavaScript。
- `tests/`・`scripts/`：自動テストとPR検査。
- `.github/`：CI、PR・IssueのTemplate。
- [AGENTS.md](AGENTS.md)：AIが最初に読む規則。
- [CONTRIBUTING.md](CONTRIBUTING.md)：メンバー用作業手順。
- [CI_SETUP.md](CI_SETUP.md)：自動検査、手動確認、GitHub設定。
- [作品README](project-chrome/README.md)：パーツ構成とGLBモデル追加。
- [HAL208 Notion](https://aide-market.notion.site/HAL208-3ff346d701f9814d8155efc1166cbfbd)：配布用規則・AI初期設定ガイド。
