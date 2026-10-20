# HAL208 作業規則

## 対象と基本方針
- 対象は `PI11A203-lab/HAL208`。作品は `project-chrome/`。ローカル実行のみで、デプロイは行わない。
- 作業前にこのファイル、[CONTRIBUTING.md](CONTRIBUTING.md)、関連README・設定を必要な範囲で読む。
- 最新のコード・テストを確認し、依頼範囲外の修正や他人の未commit差分に触れない。
- GitHub上のcommit、PR、Issue、レビュー、返信は原則日本語。技術用語は原文を使う。

## GitHub作業
- 最新developから作業ブランチを作り、通常PR先もdevelop。1つの目的を1つのIssue・PRにまとめる。
- ブランチは `feat/12-title-screen` 等。feat・feature・fix・docs・refactor・test・choreを使う。
- main向けPRは同じrepoのdevelopからのみ。最終マージはPI11A203-lab所有者が行い、AIは代行しない。
- main・developへの直接push、force push、無断の履歴書換え・削除を行わない。
- commitは意味のある単位。同じ目的のCI修正で不要な中間commitを増やさず、指定commit数に従う。
- PR・Issueの作成前に `.github/` のTemplateを確認し、既存の適切なラベル・実作業者を設定する。
- 原則Draft PRで開始。関連Issue、全差分、commit履歴を確認して説明する。
- レビューは目的・関連実装・呼び出し元・仕様・CI・テストを確認し、根拠を示す。
- 指摘の妥当性を確認して対応。修正返信には原則commit SHAを記載し、各スレッドへ個別に返信する。
- 直接返信できない全体コメントは対象文を引用して回答する。明示指示なしにResolveしない。

## 検証
- repoルートで `npm ci --ignore-scripts --no-audit --no-fund`、`npm run lint`、`npm test` を使う。
- 自動修正可能なlint違反は `npm run lint:fix` を実行し、差分を確認する。
- format・型チェック・buildの独立工程は現在ない。設定にない検査を成功済みと扱わない。
- 不具合修正には必要な回帰テストを含める。CI失敗はJob・Step・ログから原因を特定する。
- UI・カメラ変更は[CI_SETUP.md](CI_SETUP.md)の手動確認を行い、未確認箇所と理由を記載する。
- シークレット、実環境の.env、ログ、node_modules、不要な生成物・個人情報をcommitしない。
- 完了報告は変更、実行コマンドと結果、未検証・残る問題、実際のIssue/PR/commitリンクを示す。
- [HAL208 Notion](https://aide-market.notion.site/HAL208-3ff346d701f9814d8155efc1166cbfbd)は説明と配布用。取得できなくてもこのrepoの規則で作業できる。
