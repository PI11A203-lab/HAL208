# HAL208 ローカル初期設定

Notionの初期設定案内をrepo内で使える形に移しました。元の公開・接続案内と当時の手順は[全文保存記録](notion-export.md)に残しています。
既に導入済みの規約・CI・Templateは再作成せず、不足だけを確認します。

## メンバーが最初にすること
1. 個人GitHubアカウントでHAL208へアクセスできることを確認する。所有者のアカウント・トークンを共有しない。
2. 作業フォルダーをAIから読める環境で開く。[AGENTS.md](../../AGENTS.md)、[CONTRIBUTING.md](../../CONTRIBUTING.md)、[規則一覧](README.md)、[AI共通規則](ai-instructions.md)を読ませる。
3. Issue・目的・完了条件・担当アカウントを伝える。コード・シェルを使えない場合は未実行を報告する。
4. [README](../../README.md)に従って検査・ローカル起動する。新しいチャットでも同じ入口を読ませる。
Notion接続は不要です。フォルダーを渡しただけで、どのAIでも自動で全規則を読み込むとは想定しません。

## AIへ渡す開始文
```text
対象はPI11A203-lab/HAL208です。
AGENTS.md、CONTRIBUTING.md、docs/rules/README.md、
docs/rules/ai-instructions.mdを読み、初期設定の不足を確認してください。
git status・remote・現在branch・既存設定を確認し、未commit差分を保護してください。
作品と既存規則を保持し、同じ設定・Issue・PRを重複作成しないでください。
必要なローカル編集と検証を行い、実結果・未実施・残る問題を報告してください。
この依頼だけではpush・投稿・merge・権限変更は実行しません。
mainへの最終マージはPI11A203-lab所有者本人が行います。
```

## AIの確認手順
1. 作業場所、repo、アカウント、OS、branch、未commit差分と適用規約を確認する。既存差分をreset・stash・削除しない。
2. repoがなければ依頼された場所へcloneする。既存フォルダーを無理にgit化しない。
3. 変更が必要なら最新developから作業ブランチを作る。同目的のbranch・Issue・PRがあれば確認して再利用する。
4. 作品がproject-chromeにあることを確認する。欠けている場合は架空の代替作品を生成せず報告する。
5. repo内の規約・Template・CI・検査コードを確認する。保存記録の20ファイルを一括上書きしない。既存package.json・lockfileの依存を壊さない。
6. [PR Template](../../.github/pull_request_template.md)、[Issue Forms](../../.github/ISSUE_TEMPLATE/task.yml)、[CI](../../.github/workflows/ci.yml)、[検証手順](../../CI_SETUP.md)を確認し、不足だけ統合する。
7. Node.js 22推奨（最低20.19）で以下を実行する。制限・失敗は理由を報告し、未実行を成功と扱わない。依存を変更した場合は適切なnpm操作でlockfileを生成し再検証する。
8. 対象差分だけを確認する。node_modules、ログ、秘密情報、作業用画像を取り込まず、作品や練習資料を依頼外に変更しない。
9. push・Issue・Draft PR・返信は人間の依頼範囲に従う。初期設定の開始文だけでは外部投稿しない。
10. mainの所有者制限は[管理者用設計](repository-settings.md)と実際のGitHub設定を確認する。メンバーAIは勝手に変更しない。CI追加だけで強制済みと扱わない。

```bash
npm ci --ignore-scripts --no-audit --no-fund
npm run lint
npm test
```

## 正本と更新
- 動作はコード・テスト・実行結果、権限制御はGitHubの実設定で確認する。
- 実作業はrepo内の規約・Templateを使用する。Issueは目的・担当・完了条件、PRは差分・レビュー・検証の根拠とし、進捗の二重入力を避ける。
- 規則変更時は関連ローカル文書を整合させ、重要な矛盾を黙って解消しない。Notionは更新依頼がある場合だけ変更する。
- Notion・GitHub・PCの操作権限は別であり、文書を読んだだけでは付与されない。
