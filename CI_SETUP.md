# Project Chrome のPR検証

`PI11A203-lab/HAL208` のrepoルートにCIと検査用ファイルを置き、作品は `project-chrome/` に配置します。
外側の `project-chrome-split/` を追加で挟むと `.github/workflows/` が見つからず、CIは起動しません。
メンバー名の練習フォルダーは初期設定で削除します。過去の履歴を書き換える操作は行いません。

```text
HAL208/
├── .github/workflows/ci.yml
├── .gitignore
├── package.json
├── package-lock.json
├── eslint.config.mjs
├── scripts/check-pr.mjs
├── tests/
├── CI_SETUP.md
└── project-chrome/
    ├── index.html
    ├── css/
    └── js/
```

## ローカルでCIと同じ検査をする

検査用のNode.jsは22系を推奨します（最低20.19）。作品の起動は従来どおりPythonのHTTPサーバーで行えます。
リポジトリのルートで実行します。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm test
```

- `lint`：構文、未定義変数、到達不能コードなどのJavaScriptエラーをESLintで検査します。
- `lint:fix`：自動修正可能なlint違反を修正します。変更後に差分と検査結果を確認します。
- `test`：追跡フィルター、ローカルファイルとimport/export、HTMLの固定ID、PRブランチ規則を検査します。
- 検査対象は作品と検査用ファイルに限定しています。

現段階では独立したformat・型チェック・buildコマンドはありません。
ビルド工程のない静的アプリなので、架空のbuild成功を表示しません。見た目の変更を避けるため、既存ファイルへの一括整形も行いません。

## GitHubで実行する検査

`develop`・`main` 向けPRで、Draftの時点から実行します。PR編集・再オープン・追加push・Ready化でも再実行します。
`develop`・`main` へのpushと手動実行では品質検査を行います。

- `policy`：通常PRは作業ブランチからdevelopへ。main向けは同じrepoのdevelopからのみ許可します。
- `quality (ubuntu-latest)`：Linux上で依存導入、lint、自動テスト。
- `quality (windows-latest)`：Windows上で同じ検査。

許可する作業ブランチ例：`feat/12-title-screen`、`feature/title-screen`、`fix/23-camera`、`docs/setup`。
英小文字・数字・ハイフンを使い、種類はfeat・feature・fix・docs・refactor・test・choreから選びます。
初回導入PRにもこの名前を使い、developへ向けてください。

初回の実行成功後、GitHubのRulesetで上記3つを必須checkに設定します。画面に出た実際のcheck名・発行元も確認してください。
YAMLを追加するだけでは、失敗したPRのマージは禁止されません。

`main` の最終マージを本人だけにする設定は、Notionの「03 管理者用」のRulesetで行います。
PR検査では「向き」を確認するだけで、マージする人の権限を代用しません。
PR本文・ラベル・Issueの入力検査は今回のCIには含めず、テンプレートと人のレビューで確認します。
CI・検査コード自身の変更もレビュー対象です。

## カメラを使う手動確認

GitHubのCIでは実際のカメラ映像・人体追跡の品質・GPU描画・ブラウザーの権限操作は確認しません。
CDNやモデル配信先への疎通も必須テストにせず、外部サービスの一時的な停止で毎PRが失敗することを避けます。
カメラや画面に関係する変更では、PR本文に以下の実結果を記録します。

- OS、Chrome/Edgeの版、確認したcommit。
- `project-chrome/` で `python -m http.server 8000 --bind 127.0.0.1` を実行して起動できる。
- `http://localhost:8000` でカメラを許可し、映像・追跡が表示される。
- ARMSを選びAPPLYすると腕が表示され、RESETで戻る。
- EYES・HEADの切替、目のモード、猫耳のON/OFFが機能する。
- ブラウザーコンソールに新しいエラーがない。
- 起動・描画部分を変えた場合は、権限拒否や外部モデル読込失敗時の表示も確認する。

未実行の項目には「未確認」と理由を記載します。カメラ映像を証拠として添付する場合は、本人や背景の個人情報が映らないようにします。

## 最小限の保護

- CIは `contents: read`。checkout後に書き込み用の認証情報を残しません。
- CIに秘密情報を登録せず、依存導入でライフサイクルスクリプトを実行しません。
- `.env`、ログ、node_modules、作業用スクリーンショットを追加しません。
- デプロイ、公開サーバー設定、重いセキュリティ監査、毎PRのnpm auditは追加しません。

`.gitignore` は既に追跡されているファイルを履歴から消すものではありません。
依存関係の導入にはインターネットが必要です。作品も従来どおり外部CDNとモデルを読み込みます。

## 実施済みと未実施

ローカルWindows・Node.js 20.19.5でlintと12件の自動テストを確認しました。
GitHubへの追加、Actionsの実行、Linux・Node.js 22での実行、Rulesetの適用、カメラを使う画面確認は未実施です。
アップロード後、Actionsの結果を確認してから必須checkに登録してください。
