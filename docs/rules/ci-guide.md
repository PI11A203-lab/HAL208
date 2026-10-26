> HAL208 Notionから2026-10-26に移した文書です。Notionは変更していません。
> 初期導入・認証待ち・CI成功などの記述は2026-10-20時点の記録で、現在の適用状況を保証しません。
> 実作業ではルートのAGENTS.md、CONTRIBUTING.md、実ファイルと最新のGitHub結果を確認してください。
> 文書の入口：[ローカル規則一覧](README.md)。

# 5 Project ChromeのCI

## 対象と現在の状態

対象は、ローカルフォルダーからHAL208のルートへPR #3で追加したProject Chromeです。HTML・CSS・JavaScriptの静的アプリで、Three.jsとMediaPipeをCDNから読み込み、カメラはブラウザー内で使用します。

**CI設定・検査コード・lockfileはPR #3へpush済み。Actionsの3件が成功済み。Rulesetの保存はGitHubの本人認証待ちです。**

## 追加したファイル

- `.github/workflows/ci.yml`：develop・main向けPR、両ブランチへのpush、手動実行。
- `package.json`・`package-lock.json`：検査用ツールを固定。
- `eslint.config.mjs`：JavaScriptの実行エラーにつながる違反を優先。
- `scripts/check-pr.mjs`：PRの向きを検査。
- `tests/tracking.test.mjs`：One Euroフィルターの動作。
- `tests/assets.test.mjs`：HTML、ローカルファイル、import/export、固定DOM ID。
- `tests/pr-policy.test.mjs`：通常PR、最終PR、飛び越し・fork等の拒否条件。
- `CI_SETUP.md`：導入手順・必須check・カメラ手動確認。
- `.gitignore`：node\_modules、ログ、環境変数、作業用画像を除外。
- 作品README：検査手順への案内を追加。

アプリ本体のJavaScript・CSS・HTMLの動作は変更していません。

## 自動で確認すること

- JavaScriptの構文、未定義変数、到達不能コードなど。
- 最初の追跡座標、一定入力、急変の平滑化、平滑化の強さ、同時刻入力、追跡再開時のreset。
- HTMLから読むローカルCSS・JSの存在。
- 相対import先と名前付きexportの対応、importmapの定義。
- 固定ID参照とHTML要素の対応、ID重複。
- 作業ブランチ → develop。
- 同じリポジトリのdevelop → main。
- 作業ブランチ → main、forkのdevelop → main、逆向き・不明baseは拒否。

PR本文・ラベル・Issue内容の自動検査は今回未実装です。既存設計の今後の項目として残し、現段階はテンプレートと人のレビューで確認します。

## 必須checkに登録する候補

- `policy`
- `quality (ubuntu-latest)`
- `quality (windows-latest)`

Node.js 22でWindows・Linuxの両方を実行する設定です。実際のGitHub実行後、画面に表示されたcheck名と発行元を確認してRulesetへ登録します。ファイル追加だけでは失敗時のマージ禁止になりません。mainの更新者制限は引き続きRuleset側で行います。

## ローカルで実行

Node.js 22を推奨、最低20.19。リポジトリのルートで実行します。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm test
```

検査対象を作品と検査用ファイルへ絞り、既存のメンバー別練習ファイルを巻き込みません。CI用依存は開発用だけです。作品のローカル起動は従来のPython HTTPサーバーを使えます。

独立したformat・型チェック・build工程は現在ありません。静的アプリに不要なビルドを追加したり、未実装の検査を成功扱いしたりしません。大規模な整形も行っていません。

## 目視・手動で確認すること

CIに実カメラはありません。実映像、GPU描画、追跡精度、カメラ許可、画面操作、外部CDN・モデルの実稼働は自動テスト成功に含まれません。UI・カメラ関連のPRでは以下を実際に確認して結果を記載します。

- OS・Chrome/Edgeの版・commitを記録。
- `project-chrome/` で `python -m http.server 8000 --bind 127.0.0.1` を実行。
- [localhost:8000](http://localhost:8000)でカメラを許可し、映像と追跡を確認。
- ARMSの選択・APPLY・RESET。
- EYES・HEADの切替、目のモード、猫耳ON/OFF。
- 新しいコンソールエラーがない。
- 起動処理変更時は権限拒否・モデル読込失敗時の表示も確認。

## セキュリティは最小限

デプロイや公開環境の設定、重い監査、毎PRのnpm auditは追加しません。CIはcontentsのreadのみ、認証情報をcheckout後に残さず、依存のライフサイクルスクリプトを実行しません。秘密情報をCIに渡しません。CIや検査コードの変更は人がレビューします。

## アップロード時の注意

`project-chrome-split/` の外側フォルダーごと入れず、中身をrepoルートへ置きます。`.github/workflows/ci.yml` がrepoルート直下の構造になる必要があります。node\_modules、ログ、作業用画像は含めません。既存READMEや同名の設定は上書きせず統合します。

## 実行結果

ローカルWindows、Node.js 20.19.5でlockfileからのクリーンインストール、lint、自動テスト12件が成功しました。

GitHub ActionsのNode.js 22でLinux・Windowsともlintと自動テスト12件が成功しました。カメラ画面は未確認です。

## 公式資料

- [GitHub ActionsでNode.jsを検査する](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [ESLint設定](https://eslint.org/docs/latest/use/configure/configuration-files)
