# HAL208 チーム開発ガイド

## 毎回の流れ
1. Issueで目的、対象外、完了条件、担当者を決める。重複するIssueがあれば再利用する。
2. git statusで未commit差分を確認し、最新developから作業ブランチを作る。
3. 目的に必要な変更だけを実装し、検証してcommit・pushする。
4. develop向けDraft PRを作成し、Template、適切な既存ラベル、担当者を設定する。
5. 自分で全差分を確認し、CI成功後にReady for reviewへ変更して他のメンバーへ依頼する。
6. 指摘の妥当性を確認して修正・再検証し、対応commit付きで各スレッドへ返信する。
7. 他者承認と必須CIを満たしたらdevelopへSquash mergeする。
8. 完了条件を確認してIssueを閉じ、各自のdevelopを更新する。

## 作業コマンド
未保存の変更がある場合は、無断で破棄・stashせず保護してください。
```bash
git clone https://github.com/PI11A203-lab/HAL208.git
cd HAL208
git switch develop
git pull --ff-only origin develop
git switch -c feat/12-title-screen
```
ブランチ種類はfeat・feature・fix・docs・refactor・test・chore。概要は英小文字・数字・ハイフンです。
人ごとに固定ブランチを作らず、作業単位に分けます。対象ファイルを指定してstageしてください。

## レビューと履歴
- GitHubに書く文章は原則日本語。commit・PRタイトル例：`feat: タイトル画面を追加`。
- commitは意味のある単位。無関係な変更を混ぜず、同じ目的のCI修正で不要な履歴を増やしません。
- 全差分・commit履歴・目的・Issue・関連実装・呼び出し元・CI・テスト・仕様を確認します。
- 契約不整合、既存機能への影響、混入差分、重複、性能、保守性、必要なテスト不足を確認します。
- 根拠を確認してから指摘に対応します。修正返信には原則実commit SHAを付け、個別スレッドへ返信します。
- 全体コメントで直接返信できない内容は引用して回答します。明示指示なしにスレッドをResolveしません。
- main・developへの直接push、force push、無断の共有履歴書換えは禁止です。
- 競合時は双方の意図を確認して解消し再検証。理解できない変更を推測で削除しません。
- 統合後の不具合は履歴を消さずrevert用PRで戻すことを基本とします。

## PR・Issue
repo内の最新Templateを必ず使用します。関連Issue・差分・commit履歴を見て作成し、既存の適切なラベルを付けます。
Issueは機能・改善、不具合、作業タスクの3種類。PRには再現手順、実結果、UI証拠、影響、AI使用を記載します。
default branchはmainなので、develop向けPRは `Refs #番号` を基本とし、developへのmergeで自動closeすると想定しません。
完了条件を確認して手動closeし、main取り込み時に閉じる場合だけClosesを使います。

## 最終確認版
mainはローカルで完成確認した版です。base=main、head=developのPRを作り、他者承認とCIを確認した後、
**PI11A203-lab所有者だけがmerge commitで最終マージします。AIは代行しません。**
mainとdevelopは削除しません。デプロイは行いません。

## 検証と最低限の保護
検証コマンド・手動カメラ確認は [CI_SETUP.md](CI_SETUP.md) を参照してください。
不具合には必要な回帰テストを追加し、未実行を成功と書きません。CIはJob・Step・ログから原因を確認します。
秘密情報、.env実値、ログ、node_modules、作業用画像は追加しません。画像や映像に個人情報を含めません。
API・描画・カメラの実動作を静的テストだけで保証しません。

## 文書の管理
repoの規約・Templateを実作業の正本とします。Notionでまとめた詳細は[ローカル規則一覧](docs/rules/README.md)から参照できます。
AIはAGENTS.md、このファイル、規則一覧、[メンバーAI共通規則](docs/rules/ai-instructions.md)を読み、作業に必要な詳細だけを追加で確認します。
[HAL208 Notion](https://aide-market.notion.site/HAL208-3ff346d701f9814d8155efc1166cbfbd)はそのまま保存し、更新依頼がある場合だけ変更します。Notionへの接続は不要です。
