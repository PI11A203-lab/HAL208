# HAL208 Notion本文の保存記録

取得元：[HAL208 Notion](https://aide-market.notion.site/HAL208-3ff346d701f9814d8155efc1166cbfbd)。取得日：2026-10-26。
これは全文保存用の資料です。毎回の作業では[規則一覧](README.md)と必要な主題の文書を読んでください。
本文中の更新状況と20ファイルの原文は取得元の過去記録です。実ファイルを上書きする指示には使わず、現在のrepoとの差分を確認します。
Notionの元ページは移動・削除・編集していません。

---

## HAL208 公開リンク

[HAL208 公開ページ](https://app.notion.com/p/3ff346d701f9814d8155efc1166cbfbd)

## AIへ渡す最短の開始文

```txt
https://aide-market.notion.site/HAL208-3ff346d701f9814d8155efc1166cbfbd
このHAL208の本文を読み、HAL208の初期設定を進めてください。
まず共通規則と初期設定手順、末尾の20ファイル原文を確認し、既存設定と未commit差分を保護してください。
ローカル編集・検証まで実施し、GitHub投稿・merge・権限変更は実行せず、差分と結果を報告してください。
ページを取得できなければ読んだと装わず、その旨を伝えてください。必要なら私が本文を貼り付けます。
```

HAL208のチーム開発用ルール・テンプレート・AI初期設定ガイドです。本文だけで規則、PR・Issue原稿、CI導入方法とファイル原文を読めるように集約しています。別の参考リポジトリや元の個人用Notionページへのアクセスは不要です。

対象：[PI11A203-lab/HAL208](https://github.com/PI11A203-lab/HAL208)

作品：Project Chrome。ローカル起動。デプロイなし。

ブランチ：作業ブランチ → develop → main。main最終マージはPI11A203-lab所有者だけ。

文書・GitHub上の文章：原則日本語。

版：HAL208 v1。

<b>2026-10-20の状態：作品・規約・CI・テンプレートを</b>[<b>PR #3</b>](https://github.com/PI11A203-lab/HAL208/pull/3)<b>へpush済み。GitHub Actionsでpolicy・Linux品質検査・Windows品質検査の3件が成功し、各OSで自動テスト12件が成功しました。develop・mainへのマージと他者レビューは未実施です。Rulesetの保存はGitHubの本人認証待ちで、強制はまだ有効になっていません。他メンバーのAIからの取得・実カメラは未確認です。</b>

<table-of-contents />

# まずメンバーがすること

1. このページを自分のAIに読み込ませます。リンクが読めなければ「メンバーAI用共通指示」のコードブロックをコピーします。
2. 自分の個人GitHubアカウントでHAL208へアクセスできることを確認します。
3. AIには対象コードと、必要に応じてファイル編集・シェル実行ができる作業環境も渡します。
4. 下の開始文を貼り付けます。リンクを貼っただけ、ページを公開しただけでは、PCやrepoへ自動で設定が適用されるわけではありません。
5. 新しいAIチャットでは、このページの最新版をあらためて渡します。

## 初期設定を依頼する開始文

```txt
HAL208の本文を読み、初期設定モードで作業してください。
対象は https://github.com/PI11A203-lab/HAL208 です。
この文書の「AI用の初期設定手順」「メンバーAI用共通指示」「初期設定ファイル原文」を使い、
既存の規約・ファイル・未commit差分を確認してから、chore/hal208-setupで初期設定を整えてください。
アプリ本体と既存設定を保持し、設定済みの内容は重複作成しないでください。メンバー名の練習フォルダー9件の削除は所有者依頼に基づきPR #3で準備済みです。
ローカルで検査し、依頼範囲に沿って差分と結果を報告してください。
この依頼ではGitHubへのpush・PR投稿・コメント送信・merge・権限変更は実行せず、必要な原稿と差分を準備してください。
mainへの最終マージはPI11A203-lab所有者が行います。
コードやシェルにアクセスできない場合は、設定済みと装わず、実行できる担当者向けに完成したファイルとコマンドを返してください。
```

# AI用の初期設定手順

この章は人間から「初期設定を進めて」と依頼されたときに適用します。公開ページを読んだだけで作業開始・投稿の許可があるとは扱いません。

1. この本文の共通規則を読み、対象repo・個人アカウント・OS・作業モードを確認する。repo、シェル、ファイル編集、ブラウザー、Notionへのアクセス可否を区別する。
2. ローカルrepoがあるならgit status、remote、現在branch、[AGENTS.md](http://AGENTS.md)と関連規約を読む。未commit差分は保持する。repoがなければ既存フォルダーを無理にgit化せず、依頼された作業場所へ別途cloneする。
3. developを取得して最新化し、chore/hal208-setupで作業する。既存の同目的branch・Issue・PRがあれば内容を確認して再利用する。
4. project-chromeの配置を確認。作品コードが未導入なら勝手な代替作品を生成せず、作品フォルダーが必要であることを報告する。node\_modules、ログ、作業用画像を取り込まない。
5. 初期設定ファイル原文を使い、repoルートへCIと検査用ファイルを配置する。既存ファイルがあれば差分を読み、上書きせず必要な内容だけ統合する。package.jsonやlockfileが既存の場合、依存関係を壊さない。
6. [本文のAGENTS.md](http://%E6%9C%AC%E6%96%87%E3%81%AEAGENTS.md)原稿、[メンバーガイドを元にしたCONTRIBUTING.md](http://%E3%83%A1%E3%83%B3%E3%83%90%E3%83%BC%E3%82%AC%E3%82%A4%E3%83%89%E3%82%92%E5%85%83%E3%81%AB%E3%81%97%E3%81%9FCONTRIBUTING.md)、PR原稿、3種類のIssue Formsとconfig.ymlを追加・統合する。Notionの全本文をrepoへ無駄に重複複製せず、実行に必要な規則を残す。ラベルは既存一覧を確認し、必要な新設は別の依頼として扱う。
7. Node.js 22でnpm ci --ignore-scripts --no-audit --no-fund、npm run lint、npm testを実行する。ツール・ネットワーク制限で実行不可なら理由を記載する。lockfileを改変せず整合することを確認し、実際に統合した依存が異なる場合は正しいlockfileを生成する。
8. 対象変更だけを確認。アプリの挙動や練習資料を無関係に変更しない。実行結果、未実施、残る問題を記載する。
9. GitHubへのpush・Issue投稿・Draft PR投稿・レビュー返信は、人間からその操作の依頼があるときに実行する。初期設定文のデフォルトは差分と原稿の準備まで。
10. mainのマージ者制限は責任者向け章のRulesetを用いる。メンバーのAIは変更しない。CIを追加しただけで強制済みと扱わない。
11. 再実行時は差分を点検し、同じ設定・Issue・PR・文書を増やさない。既に初期設定済みなら不足だけを直す。

## 公開・Notion接続・実行環境は別

NotionをWeb公開すると、リンクを知る人が本文を閲覧できる状態になります。編集権限やGitHub権限、PCの操作権限は付与されません。

Notion接続を使う場合は、各メンバーが自分の利用環境で接続し、このページを実際に取得できるか確認します。利用可能なプラグイン・操作はプランとワークスペースによって異なります。接続できない場合も本文コピーで規則を渡せます。

このページの公開は、全員のChatGPTへの連携設定を代行したことにはなりません。

[OpenAI公式：Plugins and skills](https://developers.openai.com/training/walkthroughs/plugins-and-skills)

# 情報の正本と更新

- 実際の動作はコード・テスト・実行結果で確認します。
- 承認済みrepo規約とTemplateを実作業に適用し、HAL208はチーム向けの説明と配布用本文を管理します。
- Issueが作業内容・担当・完了条件、PRが差分・レビュー・検証の根拠です。進捗をNotionとGitHubへ二重入力しません。
- 規則を変えるときは変更PRとHAL208を対応させて更新します。矛盾はAIが黙って解消せず差異を報告します。

# 1 メンバー用ガイド

## 適用先と基本方針

対象：[PI11A203-lab/HAL208](https://github.com/PI11A203-lab/HAL208)。default branchはmain、統合先としてdevelopの存在を確認済みです。規約ファイルはPR #3で導入中です。

- developは全員が使う統合ブランチ。直接pushせずPRを通します。
- 一つの目的につきIssue一つ・作業ブランチ一つ・PR一つを基本とします。大きい機能は完了条件ごとに分割します。
- ブランチは人別ではなく作業別。例：feat/12-title-screen、fix/23-save-error、docs/31-setup。
- 原則、一つのブランチの作業担当は一人。同じファイルを同時に編集しそうなら着手前に相談します。
- GitHubに書く文章は原則日本語。識別子・コマンド・既存ラベルは原文を使います。
- デプロイは行いません。作品の完成条件にローカル起動・操作確認を含めます。

## 用語を5つだけ覚える

- Issue：何を、なぜ、どこまで作るかを決める作業票。
- Branch：自分の作業を他の人の作業から分ける場所。
- Commit：自分のPCに変更を履歴として保存すること。
- Push：commitをGitHubへ送って共有すること。
- PR：変更をdevelopへ入れてよいか、他の人に確認してもらう依頼。

## 役割

作業者は実装・検証・説明を担当。レビュアーは差分と実際の動作を確認。マージ担当は承認とCIを確認して統合。管理者は権限・Ruleset・CI設定を管理します。担当者名はチームで決定し、Notionトップに記録します。作者は自分のPRの承認者になりません。

## 毎回の手順

1. Issueを探して重複を防ぎ、なければテンプレートで作成。目的・対象外・完了条件・担当を決めます。
2. <code>作業前にAGENTS.md</code>と関連文書を読みます。AIにも同じ規則を渡します。
3. 作業途中の変更がないかgit statusで確認。変更がある場合は切り替えず、保存方法を確認します。
4. developを最新化し、Issue番号付きブランチを作成します。
5. Issueの目的に必要な変更だけ実施。format・lint・test・buildはプロジェクトが定義したコマンドを使います。
6. 差分を確認し、対象ファイルを指定してcommit。秘密情報・生成物・他人の変更を混ぜません。
7. pushしてdevelop向けDraft PRを作成。関連Issue・ラベル・実作業者のアサインを設定します。
8. 目的・変更内容・手元での再現手順・実行した検証結果を記入。UI変更には画像または動画を付けます。
9. 自分で差分を確認し、検証が済んだらReady for reviewにして他のメンバーへレビュー依頼。
10. 指摘の妥当性を確認して修正。各スレッドへ対応commit付きで返信。レビュースレッドは明示指示なしにResolveしません。
11. 他者承認・必須CI・未解決の指摘を確認し、developへのPRをSquash and mergeします。作者による自己承認は不可です。
12. developを更新し、ローカル起動を確認。完了条件を満たしてからIssueを閉じます。完了していない作業は残します。

## 作業開始のコマンド例

Issue番号とブランチ名は実際の内容に合わせて変更してください。未保存の変更があるときはこのまま進めません。

```bash
git clone https://github.com/PI11A203-lab/HAL208.git
cd HAL208
git status
git switch develop
git pull --ff-only origin develop
git switch -c feat/12-title-screen
```

既にclone済みならcloneとcdの代わりに作業フォルダを開きます。

```bash
git status
git diff
git add path/to/changed-file
git diff --cached
git commit -m "feat: タイトル画面を追加"
git push -u origin feat/12-title-screen
```

path/to/changed-fileは例です。実ファイルへ置き換えます。コマンドが失敗したらエラーを読まずに次を実行しません。

## 履歴とマージ

- commitは意味のある単位。無関係な修正を同じcommitに入れません。
- 同じ目的のCI・format修正で不要な中間commitを増やしません。レビュー中に共有済みの履歴をむやみに書き換えず、必要なら担当者と相談します。
- 初心者チームの通常運用はSquash mergeを推奨。developにはPR単位の意図が残ります。commit数の別途指定がある場合は従います。
- main・developへforce pushしません。共有ブランチへのforce push・無断rebase・reset --hardを行いません。
- developの更新を作業ブランチへ取り込む必要がある場合は、作業をcommit後、git fetch origin、git merge origin/developで取り込みます。競合を理解できない場合は担当者と確認します。
- developへの取り込み後の不具合は、履歴を消すのではなくrevert用PRで戻すことを基本にします。

## ローカル実行の完成基準

READMEに対応OS、必要ソフトの版、依存関係の導入、設定ファイル作成、起動・停止、テスト、データ初期化の手順を記載します。DB等がある場合はテスト用データだけを使い、既存データを消す操作は明示します。

現在の作品はProject Chromeです。project-chromeでpython -m http.server 8000 --bind 127.0.0.1を実行して[localhost:8000](http://localhost:8000)を開きます。別メンバーのPCでも手順を確認します。毎PRは変更箇所に応じた確認、デモ前はクリーン取得から全体確認を行います。

## 練習ファイルと作品の整理

所有者の明示依頼により、メンバー名の練習ディレクトリ9件をPR #3で削除しました。作品はrepoルート直下のproject-chromeへ配置しています。develop・mainへの反映はPRのマージ後です。今後も依頼外の削除や履歴書換えは行いません。

## 困ったとき

- push拒否：対象ブランチ・権限・Ruleset・リモートの更新を確認。force pushで回避しません。
- 競合：対象ファイルを読み、両方の意図を確認。分からない部分をAIに推測で削除させません。取り込み後は再検証します。
- CI失敗：失敗Job・Step・ログを確認し、同じコマンドを可能ならローカル実行。
- 起動失敗：commit SHA、OS、ツール版、コマンド、秘密情報を除いたログをIssueに記載。
- 秘密情報のpush：削除だけで終わらずキーを失効・再発行。チームへ連絡し、履歴の対処は管理者が判断します。

## チーム練習の卒業条件

全員が小さいIssue作成、ブランチ作成、commit・push、PR作成、他者レビュー、指摘への返信、develop更新を一度経験します。練習は作品コードを壊さない文書変更で行います。

## 最終版をmainへ反映する手順

1. 取り込む機能のIssueとdevelopの差分を確認し、未完成機能や秘密情報がないことを確認します。
2. base=main、head=developの最終確認PRを作成します。タイトル例：chore: デモ確認版をmainへ反映。
3. 別のメンバーが差分とローカル起動を確認して承認。PI11A203-labの所有者がPR作成者の場合も、本人の承認では代用しません。
4. 必須CI、ローカル起動手順、既知の問題を確認します。
5. PI11A203-labの所有者だけがCreate a merge commitでマージします。Squashやrebaseは、長期間存続するmainとdevelopの履歴が繰り返し食い違うことを避けるため通常使いません。
6. mainとdevelopは削除しません。mainは完成確認済みの版、developは次の作業の統合先として維持します。

これはデプロイ作業ではありません。mainからローカル起動してデモ・提出に使います。緊急修正も原則develop経由とし、mainだけへ修正を入れる場合は本人が例外理由とdevelopへの反映方法を決めます。

# 2 PR・Issueテンプレート全文

## AIにまとめて渡す場合

PRと3種類のIssueひな形は、このページ内に全文を掲載済みです。参考リポジトリへのアクセスは不要です。共通ルールも含めて一度でコピーする場合は次を使います。

本文の関連章を参照してください。

## 使い方

GitHubに導入するための原稿です。Notion内に置くだけではGitHubのフォームに表示されません。導入時に既存Templateを再確認し、実ファイルをdefault branchのmainへPRで取り込みます。

最初のIssue分類は「機能・改善」「不具合」「その他作業」の3種類。調査、文書、リファクタリングはその他作業に含め、必要になってから分類を増やします。

## PR

通常PRはbase=develop、最終確認PRだけbase=main・head=developです。

配置先：.github/pull\_request\_<code>template.md</code>

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

# 3 責任者用：mainを本人だけに制限する

## 状態と前提

対象は公開・個人アカウント所有のPI11A203-lab/HAL208。mainとdevelopの存在を確認済み。Project Chrome・CIはPR #3へ導入し、Actionsの3件が成功済みです。以下のRuleset設計は保存時のGitHub本人認証待ちで、まだ未適用です。メンバーの拒否ケースは未検証です。

PI11A203-labの所有者は所有者アカウントPI11A203-labを管理している想定です。最終設定時は本人のログインと所有者を照合します。共有アカウント・共有トークンは使いません。本人の資格情報を他人が使える状態では「本人だけ」を保証できません。

## ブランチの役割

- 作業ブランチ：developから作成、PR先もdevelop。
- develop：チームの日常的な統合先。PR・他者承認・CIを通して取り込みます。
- main：ローカル起動で完成確認した版。developからのPRだけを受け、PI11A203-labの所有者だけが最終マージします。
- default branch：現状のmainを維持する案。GitHubの新規PRでbaseがmainになっていたら、通常作業はdevelopへ変更します。CIも間違ったbaseを検出します。

## 管理権限

個人所有リポジトリでは所有者とcollaboratorという権限構造です。名称が「lab」でも現在はOrganizationではありません。本人のみが所有者・管理者で、チーム員はcollaboratorとして作業します。所有者のトークンをbotやチーム員へ配布しません。

Rulesetは役割に対する例外になるため、将来Organizationへ移す場合は「管理者全員」が本人以外も含む可能性を再評価します。本人専用Team等へ限定し直します。

## Ruleset A：develop-quality

対象：refs/heads/develop。Enforcement：Active。Bypassなしを基本とします。

- PR必須。
- 他者承認1件以上。
- 差分が変わったら古い承認を無効化。
- 必須CI：導入後に実際に出たcheck名を登録。
- 最新のbaseを取り込んだ状態を要求。
- force push・削除禁止。
- 通常PRはSquash merge。全体設定ではmerge commitも残し、mainへの最終統合で利用します。

## Ruleset B：main-owner-gate

対象：refs/heads/main。Enforcement：Active。

- Restrict updatesを有効化。
- BypassはユーザーPI11A203-labだけを指定し、For pull requests onlyを選択。
- Write、Maintain、一般メンバー、GitHub Appsを例外に追加しません。

現状の個人所有構造で本人だけが管理者であることが成立条件です。通常メンバーはmainを更新する権限がないため、レビューが通っていてもmainへマージできません。PRを作成すること自体は最終マージ権限とは別です。

## Ruleset C：main-quality

対象：refs/heads/main。Enforcement：Active。<b>Bypassなし。</b>

- PR必須。
- 他者承認1件以上。本人がPR作者なら別のメンバーが承認。
- 古い承認の無効化。
- 必須CI、最新版との整合性確認。
- force push・削除禁止。
- merge commitを使用。mainではlinear historyを要求しません。

owner-gateとqualityを分け、本人がBの更新制限を越えてもCのPR・承認・CI条件は残る構成にします。管理者自身がRulesetを変更できる点は別の運用責任です。自動マージ・マージキューは使わず、最終操作の主体を本人に限定します。

## レビューのResolve

AIは明示指示なしにレビュースレッドをResolveしません。初期運用ではResolveの有無を必須条件にせず、未解決指摘の確認をマージ担当が行います。「会話をすべてResolve」を必須化する場合は、誰がいつResolveするかを合意し、明示指示の手順も追加します。

## CI設計

Project Chrome用CIはPR #3へpush済みです。[Actions実行](https://github.com/PI11A203-lab/HAL208/actions/runs/39387702265)で3件成功しました。Rulesetによる必須化は本人認証待ちです。

本文の関連章を参照してください。

現在作成した検査：

- <code>policy</code>：通常は作業ブランチ → develop、最終確認は同じrepoのdevelop → main。マージ権限はRulesetで制限します。
- <code>quality (ubuntu-latest)</code> と <code>quality (windows-latest)</code>：lockfileからの依存導入、JavaScript lint、自動テスト12件。
- Node.js 22を使用。develop・mainへのPRで実行し、品質検査は両ブランチへのpush・手動でも実行。
- PR編集、追加push、再オープン、Ready化でも再実行。

現在の作品は静的HTML・CSS・JavaScriptです。独立したformat・型チェック・build工程はなく、空の検査で成功を表示しません。実カメラ、GPU描画、追跡精度、外部CDNの稼働は手動確認です。

PR本文・ラベル・Issueの入力検査は未実装です。将来追加する場合はPR編集・ラベルの追加削除・API経由のIssue作成にも対応します。現段階はテンプレートと人のレビューを使います。

CIはcontentsのreadだけ、checkout時の認証情報を残さず、依存のライフサイクルスクリプトを実行しません。CIに秘密情報は渡しません。デプロイ、重いセキュリティ監査、毎PRのnpm auditは追加しません。CI・検査コード自身の差分は本人が確認します。

GitHub上で最初の成功を確認後、画面に表示された3つのcheck名と発行元をRulesetへ登録します。CIファイルの追加だけではマージをブロックできません。

## 必須ファイル

- <code>ルートのAGENTS.md</code>：AIの入口とdevelopへの作業先。
- <code>CONTRIBUTING.md</code>：人間向け手順、役割、レビュー方針。
- <code>README.md</code>：ローカル起動と検証方法。
- .github/pull\_request\_<code>template.md</code>：PR原稿。
- .github/ISSUE\_TEMPLATE/feature.yml、bug.yml、task.yml、config.yml：Issue Forms。
- .github/workflows/ci.yml：policyと2つの品質検査。
- .gitignore、必要なら.env.example：実値を含めない環境例。
- 規約・CI変更への本人レビューの仕組み。CODEOWNERSを使う場合は実ユーザー名とbase側の設定を確認し、本人が作者の場合も承認可能な設計にします。

## 導入順序

1. mainとdevelopの差分・既存PR・未完了練習を確認し、どの状態を作品の開始点にするか決める。既存ブランチをresetしない。
2. 規約、Issue Forms、policy検査を作業ブランチからdevelopへ導入。
3. 本人が初回develop → main PRで取り込み、default branch上にもテンプレートを置く。
4. 技術構成を決め、実際の検証コマンドとCIを導入。
5. checkが実際に成功・失敗することを確認後、3つのRulesetをActive化して実check名を必須指定。
6. 別メンバーのアカウントで拒否ケースを確認し、結果を記録。
7. Notionをチーム共有先へ移動し、全員の練習を行う。

テンプレートはdefault branchにも配置する必要があります。一方、通常作業PRのbaseはdevelopのままです。developを削除しないため、ブランチ自動削除は初期は無効とし、作業ブランチだけ手動削除する案です。

## 設定の受入試験

本番コードを壊すpushではなく、影響のない文書差分のPR等を使って確認します。

- [ ] メンバーのmainへの直接pushが拒否される。
- [ ] メンバーは承認・CI成功後でもmainへマージできない。
- [ ] 本人もPRなしのmain直接pushは拒否される。
- [ ] 本人も必須CI失敗・他者承認なしではmainへマージできない。
- [ ] 本人は条件を満たしたdevelop → main PRをマージできる。
- [ ] 作業ブランチ → main PRはpolicyで失敗する。
- [ ] 他repoのdevelop → main PRも失敗する。
- [ ] developへのPRは未承認・CI失敗時に拒否、条件達成時に成功する。
- [ ] main・developのforce pushと削除が拒否される。
- [ ] メンバーが必須条件を無効化できない。

## 出典と制約

[GitHubのRuleset作成・PR限定Bypass](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/creating-rulesets-for-a-repository)

[利用できるルール](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets)

[個人所有リポジトリの権限](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/repository-access-and-collaboration/permission-levels-for-a-personal-account-repository)

公開repoではFreeでもbranch Rulesetを利用可能です。非公開へ変更するとプラン条件を再確認します。画面表示・保存後の有効ルール・拒否テストまで確認して初めて「強制済み」と報告します。

# 4 メンバーAI用共通指示：一括コピー

## 使い方

これはメンバーがAIへ貼り付けるための、日本語の共通指示テンプレートです。別の参考リポジトリへのアクセスや、Notion連携を前提にしません。

1. 下の「一括コピー用」のコードブロック全体をコピーします。
2. 冒頭の依頼欄に作業モード・Issue/PR・目的・完了条件・担当アカウントを記入します。
3. 各自のAIの新しい作業チャットに貼り付けます。対象repoへのアクセスまたは手元のコードも渡します。
4. 出力だけで成功と判断せず、差分・コマンド結果・GitHubのCIを確認します。
5. 新しい作業・新しいAIチャットでは最新版をコピーし直します。以前渡した指示が別チャットにも適用されると想定しません。

このページをSkillとして保存しても、全員への配布・自動適用は行われません。コピーした文章もGitHubの権限制御の代わりにはなりません。このHAL208本文に必要な規則・ひな形・検査用ファイルを集約しています。公開と接続の設定は、それぞれ実際の画面で確認してください。

## 一括コピー用

依頼欄以外の共通ルールは、チーム合意なしにメンバーごとに変更しないでください。途中の参照リンクを開かなくても、規則とPR・Issueひな形がこのブロック内で完結します。

```txt
# HAL208 チーム共通作業指示 v1（2026-10-20）

## 毎回の依頼欄
- 作業モード：調査／実装／PR作成／レビュー／レビュー指摘への対応 から選ぶ
- 対象IssueまたはPR：実際のURL・番号（未作成なら未作成と書く）
- 作業内容：
- 完了条件：
- 今回やらないこと：
- 作業担当の個人GitHubアカウント：
- 使用環境・既知の制約：
空欄のまま目的を推測して実装しない。既存Issue等から明確に分かる情報は読み取って補い、判断に必要な情報だけ確認する。

## この指示だけで作業を開始する
対象リポジトリは https://github.com/PI11A203-lab/HAL208 。
作品はProject Chrome。HTML・CSS・JavaScript、Three.js・MediaPipeを使用するローカル実行のカメラアプリ。
この指示には共通ルールと記入様式を含む。別の参考リポジトリの閲覧は不要。
Notionに接続できないAIも、この文章の貼り付けで共通ルールを受け取ったものとして作業する。
未提示の参考資料を取得できないことを理由に、関係のない作業まで止めない。
ただし対象コード・必要な仕様・Issueを見られない場合は、その事実と影響範囲を説明し、未確認の実装を推測で作らない。

## 権限と言語
- GitHubに書くcommit・PR・Issue・レビュー・コメント・返信は原則日本語。
- 識別子・API・コマンド・既存ラベルは原文を使う。
- 作業は依頼された範囲で行う。この文章だけではPR投稿・コメント送信・merge・設定変更等の依頼にならない。
- 最終マージ担当は「リポジトリ所有者PI11A203-labを管理する責任者」。
  この文章を貼り付けたチームメンバー本人を意味しない。
- AIはmainへの最終マージを実行しない。責任者が最終操作を行う。
- 管理者のアカウント・トークンを共有して作業しない。

## ブランチ
- 通常作業は最新developから分岐し、PRのbaseもdevelop。
- mainがdefault branchでも、通常作業をmainへ向けない。
- 1つの目的につきIssue・作業ブランチ・PRを1つずつ基本とし、大きすぎる作業は完了条件ごとに分割する。
- 作業ブランチ：feat/12-title-screen、fix/23-camera、docs/setup等。
- 種類はfeat・feature・fix・docs・refactor・test・chore。概要は英小文字・数字・ハイフン。
- 人ごとに固定ブランチを使い続けず、作業ごとに分ける。
- main向けPRは同じrepoのdevelopからの最終確認だけ。作業ブランチから飛び越さない。
- main・developへの直接push、force push、削除を行わない。
- mainへの最終統合は責任者がmerge commitで実施。通常のdevelop向けPRはSquash mergeを基本とする。
- 他者の作業・共有履歴を無断で書き換えない。未完了の練習ブランチや個人別フォルダーを無断削除しない。

## 作業開始
1. 作業ディレクトリ、対象repo、ブランチ、git status、未commit差分を確認する。
2. repoと作業対象パスに適用されるAGENTS.mdを必ず確認。存在しなければ「なし」と報告する。
   CONTRIBUTING.md、README、参照先の関連文書、設定も必要な範囲で読む。
3. 最新のrepo規約・Templateを優先して適用する。この文章と矛盾する重要な規則は黙って選ばず報告する。
   人間の今回の明示指示を優先するが、必要な権限がない操作を許可されたものと扱わない。
4. Issueの目的・完了条件・対象外、既存実装と呼び出し元を確認する。
5. 他人の差分を触らず、既存設計・規約を尊重し、不要な抽象化・重複・無関係な修正を増やさない。
6. 作業ツリーが汚れている場合は無断でreset・stash・破棄せず、変更を保護する。
7. 更新したdevelopから作業ブランチを作り、依頼された作業を実施する。

## commit
- 意味のある作業単位に分割する。同じ目的のformat・CI修正で不要な中間commitを増やさない。
- commit数が指定されている場合は従う。必要な履歴整理は共有状況を確認してから行う。
- 例：feat: タイトル画面を追加、fix: カメラ起動時のエラーを修正。
- 差分を見て対象ファイルだけをstageする。秘密情報・個人情報・ログ・node_modules・不要な生成物を含めない。

## 検証とローカル起動
- 最初に実際のpackage.json・lockfile・CI設定を読み、存在するコマンドを確認する。
- 現在の検査設計はNode.js 22推奨、最低20.19。repoルートで以下を実行する。
  npm ci --ignore-scripts --no-audit --no-fund
  npm run lint
  npm test
- 検査用ファイルはローカル作成段階の可能性がある。repoにまだない場合、CI導入済みと想定しない。
  不足ファイルと未実行項目を報告し、依頼外に空の検査や架空の成功を作らない。
- formatter・linterで自動修正可能なら定義されたコマンドを実行する。自動修正後は差分を確認する。
- 独立したformat・型チェック・build工程は現在ない。将来追加されたら最新の設定に従う。
- 必要な自動テストを追加・更新し、不具合修正では意味のある回帰確認を含める。
- CI失敗時は失敗Job・Step・ログを読み、可能なら同じコマンドをローカル実行して原因を修正する。
- 実行していない検証を成功済みと書かない。CIだけを通す無関係な変更や条件緩和をしない。

作品の起動：
  cd project-chrome
  python -m http.server 8000 --bind 127.0.0.1
  ブラウザーで http://localhost:8000 を開く
Pythonコマンド名は環境に合わせる。file://で開かない。外部CDN・モデルの読込にはインターネットが必要。
カメラ・UIに関係する変更では、OS・ブラウザー版・commitを記録し、カメラ許可、映像・追跡、
ARMSの選択/APPLY/RESET、EYES/HEAD・猫耳の切替、コンソールを変更範囲に応じて確認する。
CIの静的検査は実カメラ・GPU描画・追跡精度の確認を代行しない。未確認なら理由を明記する。

## PR・Issue作成
- 作成前にrepo内の最新Templateを確認し、存在する場合は必ず使用する。
- ない場合は、後半のチーム用ひな形を使用する。参考repoの閲覧を要求しない。
- 関連Issue、全差分、commit履歴、既存ラベルを確認し、実在する適切なラベルと実作業者を設定する。
- アカウントと実作業者が違う場合、自動で@meを作業者にしない。
- PRは原則Draftで開始し、自己確認と検証後にReadyにする。
- develop向けはRefs #実番号を基本とする。defaultがmainの間、developへのmergeだけでIssueが自動closeすると期待しない。
- Issue完了条件を満たしたか確認して閉じる。main取り込み時に閉じるIssueだけClosesを使う。
- タイトルは「type: 日本語の概要」。作業内容、確認手順、実結果、影響、UIの証拠、AI使用を記載する。
- ひな形の例示番号・説明・空欄を、そのまま実内容として投稿しない。
- 他者承認と必須CIを満たしてからdevelopへ統合する。作者自身の承認やAIの意見で他者承認を代用しない。

## PRレビュー
- 目的・関連Issue、全差分・commit履歴、必要な呼び出し元と関連実装、CI、テスト、仕様との整合性を確認する。
- develop向けはbase developとの差分を確認。default mainとの差分も必要に応じて確認し、統合中の変更と混同しない。
- main向けは同じrepoのdevelop由来であることと最終確認範囲を確認する。
- 目的に対する妥当性、rebase/mergeミス、不要な差分、バグ・既存機能への影響を確認する。
- API・型・DB・UI等の契約不整合、重複、性能・保守性、必要なテスト不足を確認する。
- 指摘は実コード・仕様・呼び出し元の根拠、ファイルと条件を示す。好みの提案は任意と区別する。

## レビュー指摘への対応
- 指摘の妥当性を確認してから修正する。採用しない場合は根拠を示す。
- 修正した返信には原則として対応commitの実SHAを記載する。
- 返信可能なコメントには必ずそのコメントへ返信し、各スレッドへ個別に回答する。
- 直接返信できない全体コメントは、対象文をGitHubの > 引用形式で引用して回答する。
- ユーザーの明示指示なしにレビュースレッドをResolveしない。

## 最小限の保護
- デプロイ・公開サーバー構築・重い監査を依頼外に追加しない。
- パスワード、APIキー、秘密鍵、実環境の.env、個人情報をcommitしない。
- カメラ映像・背景に個人情報がある画像を無断添付しない。
- CIはreadの最小権限を基本とし、CI・検査コード自身の差分も人がレビューする。
- mainの更新者制限・承認・必須checkはGitHubの設定で行う。文章を渡しただけで強制済みと報告しない。

## 完了報告
変更内容と目的、Issue/PR/commitの実リンク、実行したコマンドと結果、未実行と理由、残る問題を報告する。
作成予定・ローカル作成済み・GitHub投稿済み・CI成功・権限制限適用済みを区別する。
自分にGitHubやNotionのアクセスがない場合は、投稿用の完成原稿と差分・実結果を返す。
アクセス権がない外部サービスへ実際に投稿したと装わない。

## PR本文ひな形（repoにTemplateがない場合）
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

## 機能・改善Issueひな形
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

## 不具合Issueひな形
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

## その他作業Issueひな形
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

## レビュー修正返信ひな形
該当条件で問題が起きることを確認し、〇〇を修正しました。
対応commit: 実際のSHA
確認: 実行したコマンドと実際の結果
未確認: ある場合は内容と理由

```

## 更新・正本

このページの版はv1です。repoへ承認済み規約を導入した後は、同じ変更PRに対応してこのページも更新します。古いコピーテンプレートとrepo規約が矛盾した場合は、差異を報告して最新規約を確認します。

フォームのYAML原稿と管理者設定の詳細は次のページにあります。通常の作業開始に追加の閲覧は必須ではありません。

本文の関連章を参照してください。

本文の関連章を参照してください。

本文の関連章を参照してください。

## 確認範囲

既存の共通規則、PR・Issue原稿、今回のCIコマンドに合わせて内容を点検しました。別メンバーのAIでの実行、Rulesetの有効化と拒否テストは未実施です。公開本文とGitHubのPRは準備済みです。

# 5 Project ChromeのCI

## 対象と現在の状態

対象は、ローカルフォルダーからHAL208のルートへPR #3で追加したProject Chromeです。HTML・CSS・JavaScriptの静的アプリで、Three.jsとMediaPipeをCDNから読み込み、カメラはブラウザー内で使用します。

<b>CI設定・検査コード・lockfileはPR #3へpush済み。Actionsの3件が成功済み。Rulesetの保存はGitHubの本人認証待ちです。</b>

## 追加したファイル

- <code>.github/workflows/ci.yml</code>：develop・main向けPR、両ブランチへのpush、手動実行。
- <code>package.json</code>・<code>package-lock.json</code>：検査用ツールを固定。
- <code>eslint.config.mjs</code>：JavaScriptの実行エラーにつながる違反を優先。
- <code>scripts/check-pr.mjs</code>：PRの向きを検査。
- <code>tests/tracking.test.mjs</code>：One Euroフィルターの動作。
- <code>tests/assets.test.mjs</code>：HTML、ローカルファイル、import/export、固定DOM ID。
- <code>tests/pr-policy.test.mjs</code>：通常PR、最終PR、飛び越し・fork等の拒否条件。
- <code>CI_SETUP.md</code>：導入手順・必須check・カメラ手動確認。
- <code>.gitignore</code>：node\_modules、ログ、環境変数、作業用画像を除外。
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

- <code>policy</code>
- <code>quality (ubuntu-latest)</code>
- <code>quality (windows-latest)</code>

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
- <code>project-chrome/</code> で <code>python -m http.server 8000 --bind 127.0.0.1</code> を実行。
- [localhost](http://localhost)でカメラを許可し、映像と追跡を確認。
- ARMSの選択・APPLY・RESET。
- EYES・HEADの切替、目のモード、猫耳ON/OFF。
- 新しいコンソールエラーがない。
- 起動処理変更時は権限拒否・モデル読込失敗時の表示も確認。

## セキュリティは最小限

デプロイや公開環境の設定、重い監査、毎PRのnpm auditは追加しません。CIはcontentsのreadのみ、認証情報をcheckout後に残さず、依存のライフサイクルスクリプトを実行しません。秘密情報をCIに渡しません。CIや検査コードの変更は人がレビューします。

## アップロード時の注意

<code>project-chrome-split/</code> の外側フォルダーごと入れず、中身をrepoルートへ置きます。<code>.github/workflows/ci.yml</code> がrepoルート直下の構造になる必要があります。node\_modules、ログ、作業用画像は含めません。既存READMEや同名の設定は上書きせず統合します。

## 実行結果

ローカルWindows、Node.js 20.19.5でlockfileからのクリーンインストール、lint、自動テスト12件が成功しました。

GitHub ActionsのNode.js 22でLinux・Windowsともlintと自動テスト12件が成功しました。カメラ画面は未確認です。

## 公式資料

- [GitHub ActionsでNode.jsを検査する](https://docs.github.com/en/actions/tutorials/build-and-test-code/nodejs)
- [ESLint設定](https://eslint.org/docs/latest/use/configure/configuration-files)

# 6 初期設定ファイル原文

以下の20ファイルはPR #3の実ファイル全文です。既存設定は差分を確認して統合します。package-lock.jsonを推測して再構成せず、作品本体は既存project-chromeを使用してください。

CI\_[SETUP.md](http://SETUP.md)末尾は初回commit時点の実施記録です。最新のCI成功・権限設定状況はこのページ冒頭とGitHubを確認します。

## <code>.gitattributes</code>

```txt
* text=auto eol=lf
*.png binary
*.jpg binary
*.jpeg binary
*.glb binary
```

## <code>.cursor/rules/hal208.mdc</code>

```txt
---
description: HAL208全体の共通作業規則
alwaysApply: true
---

作業開始時にルートのAGENTS.mdとCONTRIBUTING.mdを読み、遵守する。
通常のPR先はdevelop。mainの最終マージはPI11A203-lab所有者が行う。
```

## <code>README.md</code>

```markdown
# HAL208 — Project Chrome

Webカメラ映像に、姿勢・顔追跡を使って腕・猫耳・目のエフェクトを重ねるチーム作品です。
作品はブラウザーでローカル起動します。デプロイは行いません。

## 起動
Python 3、ChromeまたはEdge、Webカメラを用意してください。外部ライブラリ・モデルの読込にインターネットが必要です。
    git clone https://github.com/PI11A203-lab/HAL208.git
    cd HAL208
    git switch develop
    cd project-chrome
    python -m http.server 8000 --bind 127.0.0.1
http://localhost:8000 を開き、カメラを許可します。停止はターミナルでCtrl+C。
環境に応じてpythonをpython3またはpyに変更します。ES ModulesとカメラAPIを使うためfile://で開かないでください。

## 検証
Node.js 22推奨（最低20.19）。repoルートで実行します。
    npm ci --ignore-scripts --no-audit --no-fund
    npm run lint
    npm test
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
```

## <code>.github/ISSUE_TEMPLATE/bug.yml</code>

```yaml
name: 不具合報告
description: 再現条件と期待動作を記録
title: "fix: "
labels: [bug]
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

## <code>.github/ISSUE_TEMPLATE/config.yml</code>

```yaml
blank_issues_enabled: false
```

## <code>.github/ISSUE_TEMPLATE/feature.yml</code>

```yaml
name: 機能・改善
description: 追加機能と使いやすさの改善
title: "feat: "
labels: [enhancement]
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

## <code>.github/ISSUE_TEMPLATE/task.yml</code>

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

## <code>.github/pull_request_template.md</code>

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

## <code>.github/workflows/ci.yml</code>

```yaml
name: CI

on:
  pull_request:
    branches: [develop, main]
    types: [opened, synchronize, reopened, edited, ready_for_review]
  push:
    branches: [develop, main]
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ci-${{ github.event.pull_request.number || github.ref }}
  cancel-in-progress: true

jobs:
  policy:
    name: policy
    if: github.event_name == 'pull_request'
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
      - name: PRの向きを確認
        run: node scripts/check-pr.mjs

  quality:
    name: quality (${{ matrix.os }})
    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest]
    runs-on: ${{ matrix.os }}
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v6
        with:
          persist-credentials: false
      - uses: actions/setup-node@v7
        with:
          node-version: '22'
          cache: npm
      - name: 検査ツールをインストール
        run: npm ci --ignore-scripts --no-audit --no-fund
      - name: JavaScriptを検査
        run: npm run lint
      - name: 自動テスト
        run: npm test
```

## <code>.gitignore</code>

```txt
node_modules/
*.log
.env
.env.*
!.env.example
coverage/
test-results/
.DS_Store
Thumbs.db
/running.png
```

## <code>AGENTS.md</code>

```markdown
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
```

## <code>CI_SETUP.md</code>

```markdown
# Project Chrome のPR検証

`PI11A203-lab/HAL208` のrepoルートにCIと検査用ファイルを置き、作品は `project-chrome/` に配置します。
外側の `project-chrome-split/` を追加で挟むと `.github/workflows/` が見つからず、CIは起動しません。
メンバー名の練習フォルダーは初期設定で削除します。過去の履歴を書き換える操作は行いません。

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

## ローカルでCIと同じ検査をする

検査用のNode.jsは22系を推奨します（最低20.19）。作品の起動は従来どおりPythonのHTTPサーバーで行えます。
リポジトリのルートで実行します。

    npm ci --ignore-scripts --no-audit --no-fund
    npm run lint
    npm test

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
```

## <code>CONTRIBUTING.md</code>

```markdown
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
    git clone https://github.com/PI11A203-lab/HAL208.git
    cd HAL208
    git switch develop
    git pull --ff-only origin develop
    git switch -c feat/12-title-screen
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
repoの規約・Templateを実作業の正本とし、[HAL208 Notion](https://aide-market.notion.site/HAL208-3ff346d701f9814d8155efc1166cbfbd)にも変更を反映します。
Notionへ接続できないAIでも、このファイルとAGENTS.mdで作業できます。
```

## <code>eslint.config.mjs</code>

```javascript
import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'coverage/**', 'test-results/**'] },
  js.configs.recommended,
  {
    files: ['project-chrome/js/**/*.js'],
    languageOptions: { globals: globals.browser },
    // 試作中の補助関数・計測値は許容し、実行時エラーにつながる規則を優先する。
    rules: { 'no-unused-vars': 'off' },
  },
  {
    files: ['scripts/**/*.mjs', 'tests/**/*.mjs', '*.config.mjs'],
    languageOptions: { globals: globals.node },
  },
];
```

## <code>package.json</code>

```json
{
  "name": "hal208-project-chrome",
  "private": true,
  "type": "module",
  "engines": {
    "node": ">=20.19.0"
  },
  "scripts": {
    "lint": "eslint project-chrome/js scripts tests eslint.config.mjs",
    "lint:fix": "eslint project-chrome/js scripts tests eslint.config.mjs --fix",
    "test": "node --test tests/tracking.test.mjs tests/assets.test.mjs tests/pr-policy.test.mjs",
    "check:pr": "node scripts/check-pr.mjs"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "eslint": "10.13.0",
    "espree": "11.2.0",
    "globals": "17.13.0"
  }
}
```

## <code>scripts/check-pr.mjs</code>

```javascript
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

// マージできる人の制限はGitHub Ruleset側で行う。この検査はPRの向きだけを確認する。
export function validateBranch(pr) {
  const base = pr?.base?.ref;
  const head = pr?.head?.ref;
  if (base === 'main') {
    if (head !== 'develop' || !pr.base.repo?.full_name ||
        pr.head.repo?.full_name !== pr.base.repo.full_name) {
      return ['mainへのPRは同じリポジトリのdevelopから作成してください。'];
    }
    return [];
  }
  if (base === 'develop') {
    if (!/^(feat|feature|fix|docs|refactor|test|chore)\/[a-z0-9][a-z0-9-]*$/.test(head ?? '')) {
      return ['developへのPRはfeat/12-title-screen等の作業ブランチから作成してください。'];
    }
    return [];
  }
  return ['PR先はdevelop、最終確認時のみmainにしてください。'];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const eventPath = process.env.GITHUB_EVENT_PATH;
  if (!eventPath) {
    console.error('GitHub ActionsのPRイベントから実行してください。');
    process.exitCode = 1;
  } else {
    const errors = validateBranch(JSON.parse(readFileSync(eventPath, 'utf8')).pull_request);
    errors.forEach((error) => console.error(error));
    process.exitCode = errors.length ? 1 : 0;
    if (!errors.length) console.log('PRのブランチ構成を確認しました。');
  }
}
```

## <code>tests/assets.test.mjs</code>

```javascript
import assert from 'node:assert/strict';
import { readFile, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'espree';

const root = new URL('../project-chrome/', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const importMap = JSON.parse(html.match(/<script\s+type="importmap">([\s\S]*?)<\/script>/)[1]);
const files = (await readdir(new URL('js/', root))).filter((name) => name.endsWith('.js'));
const modules = new Map();
for (const name of files) {
  const url = new URL(`js/${name}`, root);
  const source = await readFile(url, 'utf8');
  modules.set(url.href, parse(source, { ecmaVersion: 'latest', sourceType: 'module' }));
}

test('HTMLから読み込むローカルCSS・スクリプトが存在する', async () => {
  const refs = [...html.matchAll(/<(?:script|link)\b[^>]*\b(?:src|href)="([^"]+)"/g)];
  assert.ok(refs.length >= 2, 'CSSとエントリースクリプトが必要です');
  for (const [, ref] of refs) {
    if (/^https?:/.test(ref)) continue;
    assert.ok((await stat(new URL(ref, root))).isFile(), `${ref} がありません`);
  }
});

test('モジュールのimport先と名前付きexportがつながっている', async () => {
  for (const [href, ast] of modules) {
    for (const node of ast.body.filter((node) => node.type === 'ImportDeclaration')) {
      const specifier = node.source.value;
      if (/^https?:/.test(specifier)) continue; // CDNの稼働は毎PRの必須検査にしない。
      if (!specifier.startsWith('.')) {
        assert.ok(Object.keys(importMap.imports).some((key) =>
          key.endsWith('/') ? specifier.startsWith(key) : specifier === key),
        `${specifier} のimportmapがありません`);
        continue;
      }
      const target = new URL(specifier, href);
      assert.ok((await stat(target)).isFile(), `${fileURLToPath(target)} がありません`);
      const targetAst = modules.get(target.href);
      assert.ok(targetAst, `${specifier} は検査対象のJSモジュールである必要があります`);
      const exports = new Set();
      for (const entry of targetAst.body) {
        if (entry.type !== 'ExportNamedDeclaration') continue;
        if (entry.declaration?.id) exports.add(entry.declaration.id.name);
        for (const declaration of entry.declaration?.declarations ?? []) exports.add(declaration.id.name);
        for (const spec of entry.specifiers ?? []) exports.add(spec.exported.name);
      }
      for (const spec of node.specifiers.filter((spec) => spec.type === 'ImportSpecifier')) {
        assert.ok(exports.has(spec.imported.name), `${specifier} に ${spec.imported.name} がありません`);
      }
    }
  }
});

function visit(node, callback) {
  if (!node || typeof node !== 'object') return;
  if (node.type) callback(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach((child) => visit(child, callback));
    else if (value && typeof value === 'object') visit(value, callback);
  }
}

test('固定IDで参照するUI要素がHTMLにあり、IDが重複しない', () => {
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(ids).size, ids.length, 'HTMLのIDが重複しています');
  for (const ast of modules.values()) {
    visit(ast, (node) => {
      if (node.type !== 'CallExpression') return;
      const isLookup = node.callee.name === '$' ||
        (node.callee.type === 'MemberExpression' && node.callee.object.name === 'document' &&
          node.callee.property.name === 'getElementById');
      const argument = node.arguments[0];
      if (isLookup && argument?.type === 'Literal' && typeof argument.value === 'string') {
        assert.ok(ids.includes(argument.value), `HTMLにID ${argument.value} がありません`);
      }
    });
  }
});
```

## <code>tests/pr-policy.test.mjs</code>

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { validateBranch } from '../scripts/check-pr.mjs';

function pr(base, head, headRepo = 'PI11A203-lab/HAL208') {
  return {
    base: { ref: base, repo: { full_name: 'PI11A203-lab/HAL208' } },
    head: { ref: head, repo: { full_name: headRepo } },
  };
}

test('通常の作業PRとdevelopからの最終PRを許可する', () => {
  assert.deepEqual(validateBranch(pr('develop', 'feat/12-title-screen')), []);
  assert.deepEqual(validateBranch(pr('develop', 'feature/title-screen')), []);
  assert.deepEqual(validateBranch(pr('main', 'develop')), []);
});

test('作業ブランチからmainへの飛び越しを拒否する', () => {
  assert.ok(validateBranch(pr('main', 'fix/23-camera')).length);
});

test('forkでdevelopと名付けてもmainへ直接入れない', () => {
  assert.ok(validateBranch(pr('main', 'develop', 'other/fork')).length);
  const missingRepo = pr('main', 'develop');
  missingRepo.head.repo = null;
  assert.ok(validateBranch(missingRepo).length);
});

test('統合ブランチの逆向きPR・不正な作業名・不明なbaseを拒否する', () => {
  for (const input of [pr('develop', 'main'), pr('develop', 'personal'), pr('other', 'fix/1-camera'), null]) {
    assert.ok(validateBranch(input).length);
  }
});
```

## <code>tests/tracking.test.mjs</code>

```javascript
import assert from 'node:assert/strict';
import test from 'node:test';
import { OneEuro } from '../project-chrome/js/tracking.js';

test('最初の座標をそのまま返し、一定入力で位置がずれない', () => {
  const filter = new OneEuro();
  assert.equal(filter.filter(120, 0, 1, 0.02), 120);
  for (let frame = 1; frame < 60; frame++) {
    assert.ok(Math.abs(filter.filter(120, frame / 30, 1, 0.02) - 120) < 1e-10);
  }
});

test('急な座標変化を平滑化し、繰り返し入力すると目標へ近づく', () => {
  const filter = new OneEuro();
  filter.filter(0, 0, 1, 0);
  let previous = filter.filter(100, 1 / 30, 1, 0);
  assert.ok(previous > 0 && previous < 100);
  for (let frame = 2; frame <= 120; frame++) {
    const next = filter.filter(100, frame / 30, 1, 0);
    assert.ok(next >= previous && next <= 100);
    previous = next;
  }
  assert.ok(Math.abs(100 - previous) < 0.01);
});

test('強い平滑化では座標の急変をより小さくする', () => {
  const strong = new OneEuro();
  const weak = new OneEuro();
  strong.filter(0, 0, 0.3, 0);
  weak.filter(0, 0, 3, 0);
  assert.ok(strong.filter(100, 1 / 30, 0.3, 0) < weak.filter(100, 1 / 30, 3, 0));
});

test('同じ時刻のフレームでもNaNやInfinityにならない', () => {
  const filter = new OneEuro();
  filter.filter(0, 1, 1, 0.02);
  const value = filter.filter(100, 1, 1, 0.02);
  assert.ok(Number.isFinite(value));
  assert.ok(value > 0 && value < 100);
});

test('追跡再開のreset後に古い座標を引きずらない', () => {
  const filter = new OneEuro();
  filter.filter(100, 0, 1, 0.02);
  filter.filter(200, 1 / 30, 1, 0.02);
  filter.reset();
  assert.equal(filter.filter(-50, 10, 1, 0.02), -50);
});
```

## <code>package-lock.json</code>

```json
{
  "name": "hal208-project-chrome",
  "lockfileVersion": 3,
  "requires": true,
  "packages": {
    "": {
      "name": "hal208-project-chrome",
      "devDependencies": {
        "@eslint/js": "10.0.1",
        "eslint": "10.13.0",
        "espree": "11.2.0",
        "globals": "17.13.0"
      },
      "engines": {
        "node": ">=20.19.0"
      }
    },
    "node_modules/@cacheable/memory": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/@cacheable/memory/-/memory-2.2.0.tgz",
      "integrity": "sha512-CTLKqLItRCEixEAewD3/j9DB3/o96gpTPD4eJ1v+DGOlxZRZncRQkGYqqnAGCscYd6RNeXfGeiuCphsPtqyIfQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@cacheable/utils": "^2.5.0",
        "@keyv/bigmap": "^1.3.1",
        "hookified": "^1.15.1",
        "keyv": "^5.6.0"
      }
    },
    "node_modules/@cacheable/utils": {
      "version": "2.5.0",
      "resolved": "https://registry.npmjs.org/@cacheable/utils/-/utils-2.5.0.tgz",
      "integrity": "sha512-buipgOVDkkPXNR5+xBpDw7Zk2n1EvU7qBJCNUcL7rhQ//kfpOXPAvQ511Os0vpLYJ1pZnvudNytkQt2hst3wqA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hashery": "^1.5.1",
        "keyv": "^5.6.0"
      }
    },
    "node_modules/@eslint-community/eslint-utils": {
      "version": "4.10.1",
      "resolved": "https://registry.npmjs.org/@eslint-community/eslint-utils/-/eslint-utils-4.10.1.tgz",
      "integrity": "sha512-cuadcxVFE8sDK6iWJbs8Sn0av2Nrh2QSGQhVlBW9AaAHqHwjWsZHT8LJ4hFGPh7ASBV2deFdM7H/DPjulmh8rg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "eslint-visitor-keys": "^3.4.3"
      },
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      },
      "peerDependencies": {
        "eslint": "^6.0.0 || ^7.0.0 || >=8.0.0"
      }
    },
    "node_modules/@eslint-community/eslint-utils/node_modules/eslint-visitor-keys": {
      "version": "3.4.3",
      "resolved": "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-3.4.3.tgz",
      "integrity": "sha512-wpc+LXeiyiisxPlEkUzU6svyS1frIO3Mgxj1fdy7Pm8Ygzguax2N3Fa/D/ag1WqbOprdI+uY6wMUl8/a2G+iag==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^12.22.0 || ^14.17.0 || >=16.0.0"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/@eslint-community/regexpp": {
      "version": "4.12.2",
      "resolved": "https://registry.npmjs.org/@eslint-community/regexpp/-/regexpp-4.12.2.tgz",
      "integrity": "sha512-EriSTlt5OC9/7SXkRSCAhfSxxoSUgBm33OH+IkwbdpgoqsSsUg7y3uh+IICI/Qg4BBWr3U2i39RpmycbxMq4ew==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^12.0.0 || ^14.0.0 || >=16.0.0"
      }
    },
    "node_modules/@eslint/config-array": {
      "version": "0.23.5",
      "resolved": "https://registry.npmjs.org/@eslint/config-array/-/config-array-0.23.5.tgz",
      "integrity": "sha512-Y3kKLvC1dvTOT+oGlqNQ1XLqK6D1HU2YXPc52NmAlJZbMMWDzGYXMiPRJ8TYD39muD/OTjlZmNJ4ib7dvSrMBA==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/object-schema": "^3.0.5",
        "debug": "^4.3.1",
        "minimatch": "^10.2.4"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      }
    },
    "node_modules/@eslint/config-helpers": {
      "version": "0.7.0",
      "resolved": "https://registry.npmjs.org/@eslint/config-helpers/-/config-helpers-0.7.0.tgz",
      "integrity": "sha512-DObd/KKUsU+FaFv4PLxSRenpXfQWmPXXP3pPZ6/K1PCrMu2vQpMDMuQe/BqYeoLcz8ro0bVDF1RxOJgfVEdhUw==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/core": "^1.2.1"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      }
    },
    "node_modules/@eslint/core": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/@eslint/core/-/core-1.2.1.tgz",
      "integrity": "sha512-MwcE1P+AZ4C6DWlpin/OmOA54mmIZ/+xZuJiQd4SyB29oAJjN30UW9wkKNptW2ctp4cEsvhlLY/CsQ1uoHDloQ==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@types/json-schema": "^7.0.15"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      }
    },
    "node_modules/@eslint/js": {
      "version": "10.0.1",
      "resolved": "https://registry.npmjs.org/@eslint/js/-/js-10.0.1.tgz",
      "integrity": "sha512-zeR9k5pd4gxjZ0abRoIaxdc7I3nDktoXZk2qOv9gCNWx3mVwEn32VRhyLaRsDiJjTs0xq/T8mfPtyuXu7GWBcA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      },
      "funding": {
        "url": "https://eslint.org/donate"
      },
      "peerDependencies": {
        "eslint": "^10.0.0"
      },
      "peerDependenciesMeta": {
        "eslint": {
          "optional": true
        }
      }
    },
    "node_modules/@eslint/object-schema": {
      "version": "3.0.5",
      "resolved": "https://registry.npmjs.org/@eslint/object-schema/-/object-schema-3.0.5.tgz",
      "integrity": "sha512-vqTaUEgxzm+YDSdElad6PiRoX4t8VGDjCtt05zn4nU810UIx/uNEV7/lZJ6KwFThKZOzOxzXy48da+No7HZaMw==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      }
    },
    "node_modules/@eslint/plugin-kit": {
      "version": "0.7.3",
      "resolved": "https://registry.npmjs.org/@eslint/plugin-kit/-/plugin-kit-0.7.3.tgz",
      "integrity": "sha512-IkO+/KEUvwbVpiURZg+P7zF74z5Jxe0UgJxVni+RtoHQ6IZieXaO02kmadomap/q+l6bc/jdPGGqTjhuZnuz1Q==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@eslint/core": "^1.2.1",
        "levn": "^0.4.1"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      }
    },
    "node_modules/@humanfs/core": {
      "version": "0.19.2",
      "resolved": "https://registry.npmjs.org/@humanfs/core/-/core-0.19.2.tgz",
      "integrity": "sha512-UhXNm+CFMWcbChXywFwkmhqjs3PRCmcSa/hfBgLIb7oQ5HNb1wS0icWsGtSAUNgefHeI+eBrA8I1fxmbHsGdvA==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@humanfs/types": "^0.15.0"
      },
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanfs/node": {
      "version": "0.16.8",
      "resolved": "https://registry.npmjs.org/@humanfs/node/-/node-0.16.8.tgz",
      "integrity": "sha512-gE1eQNZ3R++kTzFUpdGlpmy8kDZD/MLyHqDwqjkVQI0JMdI1D51sy1H958PNXYkM2rAac7e5/CnIKZrHtPh3BQ==",
      "dev": true,
      "license": "Apache-2.0",
      "dependencies": {
        "@humanfs/core": "^0.19.2",
        "@humanfs/types": "^0.15.0",
        "@humanwhocodes/retry": "^0.4.0"
      },
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanfs/types": {
      "version": "0.15.0",
      "resolved": "https://registry.npmjs.org/@humanfs/types/-/types-0.15.0.tgz",
      "integrity": "sha512-ZZ1w0aoQkwuUuC7Yf+7sdeaNfqQiiLcSRbfI08oAxqLtpXQr9AIVX7Ay7HLDuiLYAaFPu8oBYNq/QIi9URHJ3Q==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18.0"
      }
    },
    "node_modules/@humanwhocodes/module-importer": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/module-importer/-/module-importer-1.0.1.tgz",
      "integrity": "sha512-bxveV4V8v5Yb4ncFTT3rPSgZBOpCkjfK0y4oVVVJwIuDVBRMDXrPyXRL988i5ap9m9bnyEEjWfm5WkBmtffLfA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=12.22"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@humanwhocodes/retry": {
      "version": "0.4.3",
      "resolved": "https://registry.npmjs.org/@humanwhocodes/retry/-/retry-0.4.3.tgz",
      "integrity": "sha512-bV0Tgo9K4hfPCek+aMAn81RppFKv2ySDQeMoSZuvTASywNTnVJCArCZE2FWqpvIatKu7VMRLWlR1EazvVhDyhQ==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": ">=18.18"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/nzakas"
      }
    },
    "node_modules/@keyv/bigmap": {
      "version": "1.3.1",
      "resolved": "https://registry.npmjs.org/@keyv/bigmap/-/bigmap-1.3.1.tgz",
      "integrity": "sha512-WbzE9sdmQtKy8vrNPa9BRnwZh5UF4s1KTmSK0KUVLo3eff5BlQNNWDnFOouNpKfPKDnms9xynJjsMYjMaT/aFQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hashery": "^1.4.0",
        "hookified": "^1.15.0"
      },
      "engines": {
        "node": ">= 18"
      },
      "peerDependencies": {
        "keyv": "^5.6.0"
      }
    },
    "node_modules/@keyv/serialize": {
      "version": "1.1.1",
      "resolved": "https://registry.npmjs.org/@keyv/serialize/-/serialize-1.1.1.tgz",
      "integrity": "sha512-dXn3FZhPv0US+7dtJsIi2R+c7qWYiReoEh5zUntWCf4oSpMNib8FDhSoed6m3QyZdx5hK7iLFkYk3rNxwt8vTA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/esrecurse": {
      "version": "4.3.1",
      "resolved": "https://registry.npmjs.org/@types/esrecurse/-/esrecurse-4.3.1.tgz",
      "integrity": "sha512-xJBAbDifo5hpffDBuHl0Y8ywswbiAp/Wi7Y/GtAgSlZyIABppyurxVueOPE8LUQOxdlgi6Zqce7uoEpqNTeiUw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/estree": {
      "version": "1.0.9",
      "resolved": "https://registry.npmjs.org/@types/estree/-/estree-1.0.9.tgz",
      "integrity": "sha512-GhdPgy1el4/ImP05X05Uw4cw2/M93BCUmnEvWZNStlCzEKME4Fkk+YpoA5OiHNQmoS7Cafb8Xa3Pya8m1Qrzeg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/@types/json-schema": {
      "version": "7.0.15",
      "resolved": "https://registry.npmjs.org/@types/json-schema/-/json-schema-7.0.15.tgz",
      "integrity": "sha512-5+fP8P8MFNC+AyZCDxrB2pkZFPGzqQWUzpSeuuVLvm8VMcorNYavBqoFcxK8bQz4Qsbn4oUEEem4wDLfcysGHA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/acorn": {
      "version": "8.19.0",
      "resolved": "https://registry.npmjs.org/acorn/-/acorn-8.19.0.tgz",
      "integrity": "sha512-oJlA3XiRm7Cyk6qFD2Jn8ak9B7jSy0qy00ADO3+8dpT0LSjFihQYv4C02LFCSYJV3Q37xYwwRy5m+IpIiUzqWw==",
      "dev": true,
      "license": "MIT",
      "bin": {
        "acorn": "bin/acorn"
      },
      "engines": {
        "node": ">=0.4.0"
      }
    },
    "node_modules/acorn-jsx": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/acorn-jsx/-/acorn-jsx-5.3.2.tgz",
      "integrity": "sha512-rq9s+JNhf0IChjtDXxllJ7g41oZk5SlXtp0LHwyA5cejwn7vKmKp4pPri6YEePv2PU65sAsegbXtIinmDFDXgQ==",
      "dev": true,
      "license": "MIT",
      "peerDependencies": {
        "acorn": "^6.0.0 || ^7.0.0 || ^8.0.0"
      }
    },
    "node_modules/ajv": {
      "version": "6.15.0",
      "resolved": "https://registry.npmjs.org/ajv/-/ajv-6.15.0.tgz",
      "integrity": "sha512-fgFx7Hfoq60ytK2c7DhnF8jIvzYgOMxfugjLOSMHjLIPgenqa7S7oaagATUq99mV6IYvN2tRmC0wnTYX6iPbMw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "fast-deep-equal": "^3.1.1",
        "fast-json-stable-stringify": "^2.0.0",
        "json-schema-traverse": "^0.4.1",
        "uri-js": "^4.2.2"
      },
      "funding": {
        "type": "github",
        "url": "https://github.com/sponsors/epoberezkin"
      }
    },
    "node_modules/balanced-match": {
      "version": "4.0.4",
      "resolved": "https://registry.npmjs.org/balanced-match/-/balanced-match-4.0.4.tgz",
      "integrity": "sha512-BLrgEcRTwX2o6gGxGOCNyMvGSp35YofuYzw9h1IMTRmKqttAZZVU67bdb9Pr2vUHA8+j3i2tJfjO6C6+4myGTA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": "18 || 20 || >=22"
      }
    },
    "node_modules/brace-expansion": {
      "version": "5.0.12",
      "resolved": "https://registry.npmjs.org/brace-expansion/-/brace-expansion-5.0.12.tgz",
      "integrity": "sha512-YovQ3rzhaLMIrDjNDMkNS01tea93qhEhG5xy8f6+R0l+dw3Ki+5sCoIoI942iuLZTHWogWktgwVDhU09iNEimQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "balanced-match": "^4.0.2"
      },
      "engines": {
        "node": "20 || >=22"
      }
    },
    "node_modules/cacheable": {
      "version": "2.5.0",
      "resolved": "https://registry.npmjs.org/cacheable/-/cacheable-2.5.0.tgz",
      "integrity": "sha512-60cyAOytib/OzBw1JNSoSV/boK1AtHryDIjvVBk7XbN4ugfkM3+Sry7fEjNgPMGgOjuaZPAp8ruZ0Cxafwyq9g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@cacheable/memory": "^2.2.0",
        "@cacheable/utils": "^2.5.0",
        "hookified": "^1.15.0",
        "keyv": "^5.6.0",
        "qified": "^0.10.1"
      }
    },
    "node_modules/cross-spawn": {
      "version": "7.0.6",
      "resolved": "https://registry.npmjs.org/cross-spawn/-/cross-spawn-7.0.6.tgz",
      "integrity": "sha512-uV2QOWP2nWzsy2aMp8aRibhi9dlzF5Hgh5SHaB9OiTGEyDTiJJyx0uy51QXdyWbtAHNua4XJzUKca3OzKUd3vA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "path-key": "^3.1.0",
        "shebang-command": "^2.0.0",
        "which": "^2.0.1"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/debug": {
      "version": "4.4.3",
      "resolved": "https://registry.npmjs.org/debug/-/debug-4.4.3.tgz",
      "integrity": "sha512-RGwwWnwQvkVfavKVt22FGLw+xYSdzARwm0ru6DhTVA3umU5hZc28V3kO4stgYryrTlLpuvgI9GiijltAjNbcqA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "ms": "^2.1.3"
      },
      "engines": {
        "node": ">=6.0"
      },
      "peerDependenciesMeta": {
        "supports-color": {
          "optional": true
        }
      }
    },
    "node_modules/deep-is": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/deep-is/-/deep-is-0.1.4.tgz",
      "integrity": "sha512-oIPzksmTg4/MriiaYGO+okXDT7ztn/w3Eptv/+gSIdMdKsJo0u4CfYNFJPy+4SKMuCqGw2wxnA+URMg3t8a/bQ==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/escape-string-regexp": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/escape-string-regexp/-/escape-string-regexp-4.0.0.tgz",
      "integrity": "sha512-TtpcNJ3XAzx3Gq8sWRzJaVajRs0uVxA2YAkdb1jm2YkPz4G6egUFAyA3n5vtEIZefPk5Wa4UXbKuS5fKkJWdgA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/eslint": {
      "version": "10.13.0",
      "resolved": "https://registry.npmjs.org/eslint/-/eslint-10.13.0.tgz",
      "integrity": "sha512-UohDjD4zSzEwhf58M3O7vc/ycc8O1I7dNlhtD0WxE8Px8EHNJKtUwzBqrzeGhisRuv2ag4sAYswszCJRgKXYUg==",
      "dev": true,
      "license": "MIT",
      "workspaces": [
        "packages/*"
      ],
      "dependencies": {
        "@eslint-community/eslint-utils": "^4.8.0",
        "@eslint-community/regexpp": "^4.12.2",
        "@eslint/config-array": "^0.23.5",
        "@eslint/config-helpers": "^0.7.0",
        "@eslint/core": "^1.2.1",
        "@eslint/plugin-kit": "^0.7.3",
        "@humanfs/node": "^0.16.6",
        "@humanwhocodes/module-importer": "^1.0.1",
        "@humanwhocodes/retry": "^0.4.2",
        "@types/estree": "^1.0.6",
        "ajv": "^6.14.0",
        "cross-spawn": "^7.0.6",
        "debug": "^4.3.2",
        "escape-string-regexp": "^4.0.0",
        "eslint-scope": "^9.1.2",
        "eslint-visitor-keys": "^5.0.1",
        "espree": "^11.2.0",
        "esquery": "^1.7.0",
        "esutils": "^2.0.2",
        "fast-deep-equal": "^3.1.3",
        "file-entry-cache": "11.1.5 || >11.1.6 <12",
        "find-up": "^5.0.0",
        "glob-parent": "^6.0.2",
        "ignore": "^5.2.0",
        "imurmurhash": "^0.1.4",
        "is-glob": "^4.0.0",
        "json-stable-stringify-without-jsonify": "^1.0.1",
        "minimatch": "^10.2.5",
        "natural-compare": "^1.4.0",
        "optionator": "^0.9.3"
      },
      "bin": {
        "eslint": "bin/eslint.js"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      },
      "funding": {
        "url": "https://eslint.org/donate"
      },
      "peerDependencies": {
        "jiti": "*"
      },
      "peerDependenciesMeta": {
        "jiti": {
          "optional": true
        }
      }
    },
    "node_modules/eslint-scope": {
      "version": "9.1.2",
      "resolved": "https://registry.npmjs.org/eslint-scope/-/eslint-scope-9.1.2.tgz",
      "integrity": "sha512-xS90H51cKw0jltxmvmHy2Iai1LIqrfbw57b79w/J7MfvDfkIkFZ+kj6zC3BjtUwh150HsSSdxXZcsuv72miDFQ==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "@types/esrecurse": "^4.3.1",
        "@types/estree": "^1.0.8",
        "esrecurse": "^4.3.0",
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/eslint-visitor-keys": {
      "version": "5.0.1",
      "resolved": "https://registry.npmjs.org/eslint-visitor-keys/-/eslint-visitor-keys-5.0.1.tgz",
      "integrity": "sha512-tD40eHxA35h0PEIZNeIjkHoDR4YjjJp34biM0mDvplBe//mB+IHCqHDGV7pxF+7MklTvighcCPPZC7ynWyjdTA==",
      "dev": true,
      "license": "Apache-2.0",
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/espree": {
      "version": "11.2.0",
      "resolved": "https://registry.npmjs.org/espree/-/espree-11.2.0.tgz",
      "integrity": "sha512-7p3DrVEIopW1B1avAGLuCSh1jubc01H2JHc8B4qqGblmg5gI9yumBgACjWo4JlIc04ufug4xJ3SQI8HkS/Rgzw==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "acorn": "^8.16.0",
        "acorn-jsx": "^5.3.2",
        "eslint-visitor-keys": "^5.0.1"
      },
      "engines": {
        "node": "^20.19.0 || ^22.13.0 || >=24"
      },
      "funding": {
        "url": "https://opencollective.com/eslint"
      }
    },
    "node_modules/esquery": {
      "version": "1.7.0",
      "resolved": "https://registry.npmjs.org/esquery/-/esquery-1.7.0.tgz",
      "integrity": "sha512-Ap6G0WQwcU/LHsvLwON1fAQX9Zp0A2Y6Y/cJBl9r/JbW90Zyg4/zbG6zzKa2OTALELarYHmKu0GhpM5EO+7T0g==",
      "dev": true,
      "license": "BSD-3-Clause",
      "dependencies": {
        "estraverse": "^5.1.0"
      },
      "engines": {
        "node": ">=0.10"
      }
    },
    "node_modules/esrecurse": {
      "version": "4.3.0",
      "resolved": "https://registry.npmjs.org/esrecurse/-/esrecurse-4.3.0.tgz",
      "integrity": "sha512-KmfKL3b6G+RXvP8N1vr3Tq1kL/oCFgn2NYXEtqP8/L3pKapUA4G8cFVaoF3SU323CD4XypR/ffioHmkti6/Tag==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "estraverse": "^5.2.0"
      },
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/estraverse": {
      "version": "5.3.0",
      "resolved": "https://registry.npmjs.org/estraverse/-/estraverse-5.3.0.tgz",
      "integrity": "sha512-MMdARuVEQziNTeJD8DgMqmhwR11BRQ/cBP+pLtYdSTnf3MIO8fFeiINEbX36ZdNlfU/7A9f3gUw49B3oQsvwBA==",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=4.0"
      }
    },
    "node_modules/esutils": {
      "version": "2.0.3",
      "resolved": "https://registry.npmjs.org/esutils/-/esutils-2.0.3.tgz",
      "integrity": "sha512-kVscqXk4OCp68SZ0dkgEKVi6/8ij300KBWTJq32P/dYeWTSwK41WyTxalN1eRmA5Z9UU/LX9D7FWSmV9SAYx6g==",
      "dev": true,
      "license": "BSD-2-Clause",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/fast-deep-equal": {
      "version": "3.1.3",
      "resolved": "https://registry.npmjs.org/fast-deep-equal/-/fast-deep-equal-3.1.3.tgz",
      "integrity": "sha512-f3qQ9oQy9j2AhBe/H9VC91wLmKBCCU/gDOnKNAYG5hswO7BLKj09Hc5HYNz9cGI++xlpDCIgDaitVs03ATR84Q==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-json-stable-stringify": {
      "version": "2.1.0",
      "resolved": "https://registry.npmjs.org/fast-json-stable-stringify/-/fast-json-stable-stringify-2.1.0.tgz",
      "integrity": "sha512-lhd/wF+Lk98HZoTCtlVraHtfh5XYijIjalXck7saUtuanSDyLMxnHhSXEDJqHxD7msR8D0uCmqlkwjCV8xvwHw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/fast-levenshtein": {
      "version": "2.0.6",
      "resolved": "https://registry.npmjs.org/fast-levenshtein/-/fast-levenshtein-2.0.6.tgz",
      "integrity": "sha512-DCXu6Ifhqcks7TZKY3Hxp3y6qphY5SJZmrWMDrKcERSOXWQdMhU9Ig/PYrzyw/ul9jOIyh0N4M0tbC5hodg8dw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/file-entry-cache": {
      "version": "11.1.5",
      "resolved": "https://registry.npmjs.org/file-entry-cache/-/file-entry-cache-11.1.5.tgz",
      "integrity": "sha512-+PFTHITI08JIGhnNpGNI8T8inUpgZfk3GNEqfT9R2zZV2iFXg3CvqzSl/uEhs7TSGujYRELEANyDvS8Fj7+S7Q==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "flat-cache": "^6.1.23"
      }
    },
    "node_modules/find-up": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/find-up/-/find-up-5.0.0.tgz",
      "integrity": "sha512-78/PXT1wlLLDgTzDs7sjq9hzz0vXD+zn+7wypEe4fXQxCmdmqfGsEPQxmiCSQI3ajFV91bVSsvNtrJRiW6nGng==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "locate-path": "^6.0.0",
        "path-exists": "^4.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/flat-cache": {
      "version": "6.1.23",
      "resolved": "https://registry.npmjs.org/flat-cache/-/flat-cache-6.1.23.tgz",
      "integrity": "sha512-f++BY9pTk+983xK1FLzlLpmM0i0z+jHmx3QESGkURMXujQZz1k5wzwX6hjnQ8goaD0B+sYnDK1yZ6MTyZfUaqA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "cacheable": "^2.5.0",
        "flatted": "^3.4.2",
        "hookified": "^1.15.0"
      }
    },
    "node_modules/flatted": {
      "version": "3.4.4",
      "resolved": "https://registry.npmjs.org/flatted/-/flatted-3.4.4.tgz",
      "integrity": "sha512-5+ybhBZANEJxaH3X5evAFatUxLfEHSr7n6kYJ+1Qd0mUqr4eu9gIf6GDbWHf8RJijHrjjO8G+la14SlL2SeS1Q==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/glob-parent": {
      "version": "6.0.2",
      "resolved": "https://registry.npmjs.org/glob-parent/-/glob-parent-6.0.2.tgz",
      "integrity": "sha512-XxwI8EOhVQgWp6iDL+3b0r86f4d6AX6zSU55HfB4ydCEuXLXc5FcYeOu+nnGftS4TEju/11rt4KJPTMgbfmv4A==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "is-glob": "^4.0.3"
      },
      "engines": {
        "node": ">=10.13.0"
      }
    },
    "node_modules/globals": {
      "version": "17.13.0",
      "resolved": "https://registry.npmjs.org/globals/-/globals-17.13.0.tgz",
      "integrity": "sha512-RwMTC61u7hrG3ZJMkZQOK4JLJrKS8QtoTii63EmWvFXHqycY9FObBJQCbsLxSO8kjKhWE5kV1GC+Vb1g3RI0Zg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=18"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/hashery": {
      "version": "1.5.1",
      "resolved": "https://registry.npmjs.org/hashery/-/hashery-1.5.1.tgz",
      "integrity": "sha512-iZyKG96/JwPz1N55vj2Ie2vXbhu440zfUfJvSwEqEbeLluk7NnapfGqa7LH0mOsnDxTF85Mx8/dyR6HfqcbmbQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hookified": "^1.15.0"
      },
      "engines": {
        "node": ">=20"
      }
    },
    "node_modules/hookified": {
      "version": "1.15.1",
      "resolved": "https://registry.npmjs.org/hookified/-/hookified-1.15.1.tgz",
      "integrity": "sha512-MvG/clsADq1GPM2KGo2nyfaWVyn9naPiXrqIe4jYjXNZQt238kWyOGrsyc/DmRAQ+Re6yeo6yX/yoNCG5KAEVg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/ignore": {
      "version": "5.3.2",
      "resolved": "https://registry.npmjs.org/ignore/-/ignore-5.3.2.tgz",
      "integrity": "sha512-hsBTNUqQTDwkWtcdYI2i06Y/nUBEsNEDJKjWdigLvegy8kDuJAS8uRlpkkcQpyEXL0Z/pjDy5HBmMjRCJ2gq+g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 4"
      }
    },
    "node_modules/imurmurhash": {
      "version": "0.1.4",
      "resolved": "https://registry.npmjs.org/imurmurhash/-/imurmurhash-0.1.4.tgz",
      "integrity": "sha512-JmXMZ6wuvDmLiHEml9ykzqO6lwFbof0GG4IkcGaENdCRDDmMVnny7s5HsIgHCbaq0w2MyPhDqkhTUgS2LU2PHA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.8.19"
      }
    },
    "node_modules/is-extglob": {
      "version": "2.1.1",
      "resolved": "https://registry.npmjs.org/is-extglob/-/is-extglob-2.1.1.tgz",
      "integrity": "sha512-SbKbANkN603Vi4jEZv49LeVJMn4yGwsbzZworEoyEiutsN3nJYdbO36zfhGJ6QEDpOZIFkDtnq5JRxmvl3jsoQ==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/is-glob": {
      "version": "4.0.3",
      "resolved": "https://registry.npmjs.org/is-glob/-/is-glob-4.0.3.tgz",
      "integrity": "sha512-xelSayHH36ZgE7ZWhli7pW34hNbNl8Ojv5KVmkJD4hBdD3th8Tfk9vYasLM+mXWOZhFkgZfxhLSnrwRr4elSSg==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "is-extglob": "^2.1.1"
      },
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/isexe": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/isexe/-/isexe-2.0.0.tgz",
      "integrity": "sha512-RHxMLp9lnKHGHRng9QFhRCMbYAcVpn69smSGcq3f36xjgVVWThj4qqLbTLlq7Ssj8B+fIQ1EuCEGI2lKsyQeIw==",
      "dev": true,
      "license": "ISC"
    },
    "node_modules/json-schema-traverse": {
      "version": "0.4.1",
      "resolved": "https://registry.npmjs.org/json-schema-traverse/-/json-schema-traverse-0.4.1.tgz",
      "integrity": "sha512-xbbCH5dCYU5T8LcEhhuh7HJ88HXuW3qsI3Y0zOZFKfZEHcpWiHU/Jxzk629Brsab/mMiHQti9wMP+845RPe3Vg==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/json-stable-stringify-without-jsonify": {
      "version": "1.0.1",
      "resolved": "https://registry.npmjs.org/json-stable-stringify-without-jsonify/-/json-stable-stringify-without-jsonify-1.0.1.tgz",
      "integrity": "sha512-Bdboy+l7tA3OGW6FjyFHWkP5LuByj1Tk33Ljyq0axyzdk9//JSi2u3fP1QSmd1KNwq6VOKYGlAu87CisVir6Pw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/keyv": {
      "version": "5.6.0",
      "resolved": "https://registry.npmjs.org/keyv/-/keyv-5.6.0.tgz",
      "integrity": "sha512-CYDD3SOtsHtyXeEORYRx2qBtpDJFjRTGXUtmNEMGyzYOKj1TE3tycdlho7kA1Ufx9OYWZzg52QFBGALTirzDSw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "@keyv/serialize": "^1.1.1"
      }
    },
    "node_modules/levn": {
      "version": "0.4.1",
      "resolved": "https://registry.npmjs.org/levn/-/levn-0.4.1.tgz",
      "integrity": "sha512-+bT2uH4E5LGE7h/n3evcS/sQlJXCpIp6ym8OWJ5eV6+67Dsql/LaaT7qJBAt2rzfoa/5QBGBhxDix1dMt2kQKQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1",
        "type-check": "~0.4.0"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/locate-path": {
      "version": "6.0.0",
      "resolved": "https://registry.npmjs.org/locate-path/-/locate-path-6.0.0.tgz",
      "integrity": "sha512-iPZK6eYjbxRu3uB4/WZ3EsEIMJFMqAoopl3R+zuq0UjcAm/MO6KCweDgPfP3elTztoKP3KtnVHxTn2NHBSDVUw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-locate": "^5.0.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/minimatch": {
      "version": "10.2.6",
      "resolved": "https://registry.npmjs.org/minimatch/-/minimatch-10.2.6.tgz",
      "integrity": "sha512-vpLQEs+VLCr1nU0BXS07maYoFwlDAH0gngQuuttxIwutDFEMHq2blX+8vpgxDdK3J1PwjCJiep77OitTZ4Ll1A==",
      "dev": true,
      "license": "BlueOak-1.0.0",
      "dependencies": {
        "brace-expansion": "^5.0.8"
      },
      "engines": {
        "node": "18 || 20 || >=22"
      },
      "funding": {
        "url": "https://github.com/sponsors/isaacs"
      }
    },
    "node_modules/ms": {
      "version": "2.1.3",
      "resolved": "https://registry.npmjs.org/ms/-/ms-2.1.3.tgz",
      "integrity": "sha512-6FlzubTLZG3J2a/NVCAleEhjzq5oxgHyaCU9yYXvcLsvoVaHJq/s5xXI6/XXP6tz7R9xAOtHnSO/tXtF3WRTlA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/natural-compare": {
      "version": "1.4.0",
      "resolved": "https://registry.npmjs.org/natural-compare/-/natural-compare-1.4.0.tgz",
      "integrity": "sha512-OWND8ei3VtNC9h7V60qff3SVobHr996CTwgxubgyQYEpg290h9J0buyECNNJexkFm5sOajh5G116RYA1c8ZMSw==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/optionator": {
      "version": "0.9.4",
      "resolved": "https://registry.npmjs.org/optionator/-/optionator-0.9.4.tgz",
      "integrity": "sha512-6IpQ7mKUxRcZNLIObR0hz7lxsapSSIYNZJwXPGeF0mTVqGKFIXj1DQcMoT22S3ROcLyY/rz0PWaWZ9ayWmad9g==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "deep-is": "^0.1.3",
        "fast-levenshtein": "^2.0.6",
        "levn": "^0.4.1",
        "prelude-ls": "^1.2.1",
        "type-check": "^0.4.0",
        "word-wrap": "^1.2.5"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/p-limit": {
      "version": "3.1.0",
      "resolved": "https://registry.npmjs.org/p-limit/-/p-limit-3.1.0.tgz",
      "integrity": "sha512-TYOanM3wGwNGsZN2cVTYPArw454xnXj5qmWF1bEoAc4+cU/ol7GVh7odevjp1FNHduHc3KZMcFduxU5Xc6uJRQ==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "yocto-queue": "^0.1.0"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/p-locate": {
      "version": "5.0.0",
      "resolved": "https://registry.npmjs.org/p-locate/-/p-locate-5.0.0.tgz",
      "integrity": "sha512-LaNjtRWUBY++zB5nE/NwcaoMylSPk+S+ZHNB1TzdbMJMny6dynpAGt7X/tl/QYq3TIeE6nxHppbo2LGymrG5Pw==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "p-limit": "^3.0.2"
      },
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    },
    "node_modules/path-exists": {
      "version": "4.0.0",
      "resolved": "https://registry.npmjs.org/path-exists/-/path-exists-4.0.0.tgz",
      "integrity": "sha512-ak9Qy5Q7jYb2Wwcey5Fpvg2KoAc/ZIhLSLOSBmRmygPsGwkVVt0fZa0qrtMz+m6tJTAHfZQ8FnmB4MG4LWy7/w==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/path-key": {
      "version": "3.1.1",
      "resolved": "https://registry.npmjs.org/path-key/-/path-key-3.1.1.tgz",
      "integrity": "sha512-ojmeN0qd+y0jszEtoY48r0Peq5dwMEkIlCOu6Q5f41lfkswXuKtYrhgoTpLnyIcHm24Uhqx+5Tqm2InSwLhE6Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/prelude-ls": {
      "version": "1.2.1",
      "resolved": "https://registry.npmjs.org/prelude-ls/-/prelude-ls-1.2.1.tgz",
      "integrity": "sha512-vkcDPrRZo1QZLbn5RLGPpg/WmIQ65qoWWhcGKf/b5eplkkarX0m9z8ppCat4mlOqUsWpyNuYgO3VRyrYHSzX5g==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/punycode": {
      "version": "2.3.1",
      "resolved": "https://registry.npmjs.org/punycode/-/punycode-2.3.1.tgz",
      "integrity": "sha512-vYt7UD1U9Wg6138shLtLOvdAu+8DsC/ilFtEVHcH+wydcSpNE20AfSOduf6MkRFahL5FY7X1oU7nKVZFtfq8Fg==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=6"
      }
    },
    "node_modules/qified": {
      "version": "0.10.1",
      "resolved": "https://registry.npmjs.org/qified/-/qified-0.10.1.tgz",
      "integrity": "sha512-+Owyggi9IxT1ePKGafcI87ubSmxol6smwJ+RAHDQlx9+9cPwFWDiKFFCPuWhr9ignlGpZ9vDQLw67N4dcTVFEA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "hookified": "^2.1.1"
      },
      "engines": {
        "node": ">=20"
      }
    },
    "node_modules/qified/node_modules/hookified": {
      "version": "2.2.0",
      "resolved": "https://registry.npmjs.org/hookified/-/hookified-2.2.0.tgz",
      "integrity": "sha512-p/LgFzRN5FeoD3DLS6bkUapeye6E4SI6yJs6KetENd18S+FBthqYq2amJUWpt5z0EQwwHemidjY5OqJGEKm5uA==",
      "dev": true,
      "license": "MIT"
    },
    "node_modules/shebang-command": {
      "version": "2.0.0",
      "resolved": "https://registry.npmjs.org/shebang-command/-/shebang-command-2.0.0.tgz",
      "integrity": "sha512-kHxr2zZpYtdmrN1qDjrrX/Z1rR1kG8Dx+gkpK1G4eXmvXswmcE1hTWBWYUzlraYw1/yZp6YuDY77YtvbN0dmDA==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "shebang-regex": "^3.0.0"
      },
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/shebang-regex": {
      "version": "3.0.0",
      "resolved": "https://registry.npmjs.org/shebang-regex/-/shebang-regex-3.0.0.tgz",
      "integrity": "sha512-7++dFhtcx3353uBaq8DDR4NuxBetBzC7ZQOhmTQInHEd6bSrXdiEyzCvG07Z44UYdLShWUyXt5M/yhz8ekcb1A==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=8"
      }
    },
    "node_modules/type-check": {
      "version": "0.4.0",
      "resolved": "https://registry.npmjs.org/type-check/-/type-check-0.4.0.tgz",
      "integrity": "sha512-XleUoc9uwGXqjWwXaUTZAmzMcFZ5858QA2vvx1Ur5xIcixXIP+8LnFDgRplU30us6teqdlskFfu+ae4K79Ooew==",
      "dev": true,
      "license": "MIT",
      "dependencies": {
        "prelude-ls": "^1.2.1"
      },
      "engines": {
        "node": ">= 0.8.0"
      }
    },
    "node_modules/uri-js": {
      "version": "4.4.1",
      "resolved": "https://registry.npmjs.org/uri-js/-/uri-js-4.4.1.tgz",
      "integrity": "sha512-7rKUyy33Q1yc98pQ1DAmLtwX109F7TIfWlW1Ydo8Wl1ii1SeHieeh0HHfPeL2fMXK6z0s8ecKs9frCuLJvndBg==",
      "dev": true,
      "license": "BSD-2-Clause",
      "dependencies": {
        "punycode": "^2.1.0"
      }
    },
    "node_modules/which": {
      "version": "2.0.2",
      "resolved": "https://registry.npmjs.org/which/-/which-2.0.2.tgz",
      "integrity": "sha512-BLI3Tl1TW3Pvl70l3yq3Y64i+awpwXqsGBYWkkqMtnbXgrMD+yj7rhW0kuEDxzJaYXGjEW5ogapKNMEKNMjibA==",
      "dev": true,
      "license": "ISC",
      "dependencies": {
        "isexe": "^2.0.0"
      },
      "bin": {
        "node-which": "bin/node-which"
      },
      "engines": {
        "node": ">= 8"
      }
    },
    "node_modules/word-wrap": {
      "version": "1.2.5",
      "resolved": "https://registry.npmjs.org/word-wrap/-/word-wrap-1.2.5.tgz",
      "integrity": "sha512-BN22B5eaMMI9UMtjrGd5g5eCYPpCPDUy0FJXbYsaT5zYxjFOckS53SQDE3pWkVoWpHXVb3BrYcEN4Twa55B5cA==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=0.10.0"
      }
    },
    "node_modules/yocto-queue": {
      "version": "0.1.0",
      "resolved": "https://registry.npmjs.org/yocto-queue/-/yocto-queue-0.1.0.tgz",
      "integrity": "sha512-rVksvsnNCdJ/ohGc6xgPwyN8eheCxsiLM8mxuE/t/mOVqJewPuO1miLpTHQiRgTKCLexL4MeAFVagts7HmNZ2Q==",
      "dev": true,
      "license": "MIT",
      "engines": {
        "node": ">=10"
      },
      "funding": {
        "url": "https://github.com/sponsors/sindresorhus"
      }
    }
  }
}
```

# 公開とAI読込の確認記録

Notionの公開画面でHAL208のWeb公開と公開URLを確認しました。検索エンジンのインデックス登録はオフのままです。テンプレートとしての複製はオンです。

一般的なWeb取得ツールでは公開URLの本文取得に失敗したため、URLを渡すだけですべてのAIが読めるとは保証していません。Notion接続でこのページを取得する方法、または本文の共通指示をコピーする方法を使ってください。

他のメンバーのアカウントでの読込・連携は未確認です。認証情報やAPIキーをこの公開ページへ書き込まず、各自の接続設定で権限を確認します。
