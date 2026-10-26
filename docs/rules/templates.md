> HAL208 Notionから2026-10-26に移した文書です。Notionは変更していません。
> 初期導入・認証待ち・CI成功などの記述は2026-10-20時点の記録で、現在の適用状況を保証しません。
> 実作業ではルートのAGENTS.md、CONTRIBUTING.md、実ファイルと最新のGitHub結果を確認してください。
> 文書の入口：[ローカル規則一覧](README.md)。

# 2 PR・Issueテンプレート全文

## AIにまとめて渡す場合

PRと3種類のIssueひな形は、このページ内に全文を掲載済みです。参考リポジトリへのアクセスは不要です。共通ルールも含めて一度でコピーする場合は次を使います。

本文の関連章を参照してください。

## 使い方

GitHubに導入するための原稿です。Notion内に置くだけではGitHubのフォームに表示されません。導入時に既存Templateを再確認し、実ファイルをdefault branchのmainへPRで取り込みます。

最初のIssue分類は「機能・改善」「不具合」「その他作業」の3種類。調査、文書、リファクタリングはその他作業に含め、必要になってから分類を増やします。

## PR

通常PRはbase=develop、最終確認PRだけbase=main・head=developです。

配置先：.github/pull\_request\_`template.md`

タイトル形式：feat: タイトル画面を追加、fix: 保存時のエラーを修正、docs: 起動手順を追加。

```markdown
## このPRで良くなること
誰が何をできるようになるかを1〜2文で記載。

## 変更内容
変更前と変更後を記載。

## 関連 Issue
Refs #123
default branchがmainのため、develop向けPRではRefsを使い、developへのマージ後に完了条件を確認して手動でIssueを閉じる。最終PRでmainに取り込む際に閉じるIssueだけClosesを使う。

## ローカル確認手順
- 対象commit：
- OS・必要ツールの版：
- 前提・設定・テストデータ：
1. 実行コマンド：
2. 操作：
3. 期待結果：
4. 実際の結果：

## 検証結果
- format：コマンド／成功・失敗・未実行
- lint・型チェック：コマンド／結果
- test：コマンド／結果
- build：コマンド／結果
- 適用しない検証：理由
- CI：実行URLと結果

## UI確認
画像・動画、または変更なしの理由。

## 影響範囲・残る問題
互換性、保存データ、他画面への影響。なければ「なし」。

## AI使用
使用有無、使用したツール・モデル（分かる範囲）、人が確認した内容。

## マージ前チェック
- [ ] Issueと変更目的が一致し、無関係な差分がない
- [ ] 秘密情報・個人情報・不要な生成物を含まない
- [ ] 検証結果を実行事実に基づいて記載した
- [ ] 関連文書・起動手順を必要に応じて更新した
- [ ] 必須CIが成功した
- [ ] 他のメンバーのレビューを受けた
```

## 機能・改善Issue

推奨タイトル：feat: タイトル画面を追加。既存の適切なラベルを使い、候補はenhancement。

```markdown
## 目的・利用場面
誰が、何のために使うか。

## 実現したい動作
操作と、その結果を記載。

## 今回やらないこと
対象外を記載。

## 完了条件
- [ ] 操作Aで結果Bになる
- [ ] 失敗時に結果Cになる
- [ ] 必要な検証・文書更新ができている

## 確認方法
実行環境、操作、期待結果。

## 担当・依存
担当者、先に必要なIssue。未定は未定と記載。
```

## 不具合Issue

推奨タイトル：fix: 保存時に画面が停止する。ラベル候補はbug。

```markdown
## 不具合の概要
何が起きて困っているか。

## 再現環境
OS、ツール版、commit SHA、必要な前提。

## 再現手順
1. 起動する
2. 対象操作を行う
3. 問題を確認する

## 期待される動作
本来どうなるか。

## 実際の動作
エラー、画面、秘密情報を除いたログ。

## 影響・頻度
影響する機能と再現頻度。

## 完了条件
- [ ] 再現手順で問題が起きない
- [ ] 必要な回帰テストを追加した
- [ ] 関連機能を確認した

## 担当・関連Issue
担当者、関連する変更。
```

## その他作業Issue

推奨タイトル：docs: ローカル起動手順を整備。ラベル候補はdocumentation、chore、test、refactor。実在するものを使います。

```markdown
## 目的・背景
なぜ必要か。

## 作業内容
- [ ] 実施する内容

## 対象外
今回扱わないこと。

## 完了条件
- [ ] 誰が見ても確認できる成果と判定条件

## 確認方法
成果をどう検証するか。

## 担当・依存
担当者、関連Issue。
```

## Issue Formsで必須入力にする実装例

Markdown版は記入案内です。GitHub画面で入力を必須にするにはIssue FormsのYAMLを使います。以下はその他作業の実ファイル案です。

配置先：.github/ISSUE\_TEMPLATE/task.yml

```yaml
name: 作業タスク
description: 文書・調査・環境整備などの作業
title: "chore: "
body:
  - type: textarea
    id: purpose
    attributes:
      label: 目的・背景
      description: なぜ必要かを記載してください
    validations:
      required: true
  - type: textarea
    id: scope
    attributes:
      label: 作業内容・対象外
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: 完了条件
      description: 第三者が確認できる条件を記載してください
    validations:
      required: true
  - type: textarea
    id: verification
    attributes:
      label: 確認方法
    validations:
      required: true
  - type: textarea
    id: dependencies
    attributes:
      label: 担当・依存
      description: 担当者は作成後にAssigneesにも設定してください
    validations:
      required: true
```

残り2種類は上の項目をfeature.yml、bug.ymlに同様の構造で定義します。機能は目的・動作・完了条件・確認方法、不具合は再現環境・手順・期待結果・実際の結果・完了条件を必須にします。ラベルは実際に作成・確認してからYAMLに指定します。

配置先：.github/ISSUE\_TEMPLATE/config.yml

```yaml
blank_issues_enabled: false
```

これはWebの空白Issue作成導線を抑える設定です。API・CLI経由のIssue本文まで必須項目を保証するものではありません。作成後の本文検査も別に設計します。

## 記入の良い例

「ログインを作る」では範囲が不明です。「登録済みのテストアカウントでログインできる。認証失敗時は理由を表示する。新規登録は今回の対象外。第三者が記載した手順で確認できる」のように完了を判断できる形にします。これは記入例であり、作品にログイン機能を追加する決定ではありません。

## レビューコメント・返信

指摘は該当箇所、起きる問題、再現条件、修正の方向を記載。好みの提案は「任意」と区別します。AIの指摘もコードと仕様で妥当性を確認します。

```markdown
ご指摘ありがとうございます。入力が空の場合に例外となることを確認し、
空入力を処理するよう修正しました。対応commit: <実際のSHA>
確認: <実際に実行したコマンドと結果>
```

SHAや結果は実データへ置き換えます。個別コメントは各スレッドへ返信。直接返信できない全体コメントは対象文をGitHub引用形式で引用して回答します。明示指示なしにResolveしません。

## 参照

- [GitHub Issue Forms構文](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)
- [PRテンプレートの配置方法](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/creating-a-pull-request-template-for-your-repository)

## 機能・不具合フォームの実ファイル案

以下もtask.ymlと同じく、GitHubへの導入前の原稿です。実在ラベルの確認前なのでlabels指定は省略しています。

### feature.yml

配置先：.github/ISSUE\_TEMPLATE/feature.yml

```yaml
name: 機能・改善
description: 追加機能と使いやすさの改善
title: "feat: "
body:
  - type: textarea
    id: purpose
    attributes:
      label: 目的・利用場面
    validations:
      required: true
  - type: textarea
    id: behavior
    attributes:
      label: 実現したい動作
    validations:
      required: true
  - type: textarea
    id: scope
    attributes:
      label: 今回やらないこと
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: 完了条件
    validations:
      required: true
  - type: textarea
    id: verification
    attributes:
      label: 確認方法
    validations:
      required: true
  - type: textarea
    id: dependencies
    attributes:
      label: 担当・依存
    validations:
      required: true
```

### bug.yml

配置先：.github/ISSUE\_TEMPLATE/bug.yml

```yaml
name: 不具合報告
description: 再現条件と期待動作を記録
title: "fix: "
body:
  - type: textarea
    id: summary
    attributes:
      label: 不具合の概要
    validations:
      required: true
  - type: textarea
    id: environment
    attributes:
      label: 再現環境
    validations:
      required: true
  - type: textarea
    id: steps
    attributes:
      label: 再現手順
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: 期待される動作
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: 実際の動作
    validations:
      required: true
  - type: textarea
    id: impact
    attributes:
      label: 影響・頻度
    validations:
      required: true
  - type: textarea
    id: acceptance
    attributes:
      label: 完了条件
    validations:
      required: true
  - type: textarea
    id: related
    attributes:
      label: 担当・関連Issue
    validations:
      required: true
```
