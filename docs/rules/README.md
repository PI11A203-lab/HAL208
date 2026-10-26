# HAL208 ローカル規則の入口

このフォルダーはHAL208 Notionの共同開発ルールを、repoだけで読めるように移したものです。
Notionのログイン、接続、参考リポジトリへのアクセスは作業の前提にしません。文書は日本語です。

## AIが作業を始める順序
1. ルートの[AGENTS.md](../../AGENTS.md)と[CONTRIBUTING.md](../../CONTRIBUTING.md)を読む。
2. [メンバーAI共通規則](ai-instructions.md)を読み、今回の依頼・対象repo・branch・未commit差分を確認する。
3. 以下から作業に必要な文書と実ファイルだけを読む。全文保存記録を毎回読み込む必要はない。
4. 実コード・設定・Issue・PR・CIを確認して作業し、実行結果と未確認事項を区別して報告する。

## 作業別の文書
- 初参加・環境準備・初期導入：[初期設定](setup.md)。
- Issueから作業・レビュー・統合まで：[メンバーガイド](team-guide.md)。
- PR・Issue・レビュー返信の書き方：[テンプレートと記入例](templates.md)。
- mainの所有者限定・承認・必須CI：[管理者用Ruleset設計](repository-settings.md)。
- CIの目的・手動カメラ確認：[CIガイド](ci-guide.md)と[現在の検証手順](../../CI_SETUP.md)。
- 当時の説明と20ファイルの原文を含む全内容：[Notion本文保存記録](notion-export.md)。

## 使う実ファイル
PRは[PR Template](../../.github/pull_request_template.md)、Issueは[機能・改善](../../.github/ISSUE_TEMPLATE/feature.yml)・[不具合](../../.github/ISSUE_TEMPLATE/bug.yml)・[作業](../../.github/ISSUE_TEMPLATE/task.yml)を確認する。
CIは[ci.yml](../../.github/workflows/ci.yml)、コマンドは[package.json](../../package.json)、依存は[package-lock.json](../../package-lock.json)を使う。
保存記録の古いコードを現在のファイルへ上書きしない。

## 更新と適用範囲
2026-10-26に[HAL208 Notion](https://aide-market.notion.site/HAL208-3ff346d701f9814d8155efc1166cbfbd)から移した。Notionはそのまま保存している。
本文のCI成功・PR #3・本人認証待ち等は2026-10-20時点の記録で、現在の権限制御や進捗の証拠ではない。
現在の状態は実際のrepo・PR・Actions・Rulesetで確認し、未確認の設定を有効と扱わない。
以後の規則修正はrepoの該当文書・AGENTS.md・実Templateをまとめて整合させる。Notionの更新は依頼がある場合に行う。

## AIへの開始文
```text
このフォルダーのAGENTS.md、CONTRIBUTING.md、docs/rules/README.mdと
docs/rules/ai-instructions.mdを読み、今回の作業に必要な文書・実装・設定を確認してください。
Notionへのアクセスは不要です。未commit差分を保護し、通常のPR先はdevelopです。
mainの最終マージはPI11A203-lab所有者本人が行います。
今回の作業：〈目的・対象Issue/PR・完了条件〉
```
