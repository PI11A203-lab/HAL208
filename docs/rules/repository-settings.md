> HAL208 Notionから2026-10-26に移した文書です。Notionは変更していません。
> 初期導入・認証待ち・CI成功などの記述は2026-10-20時点の記録で、現在の適用状況を保証しません。
> 実作業ではルートのAGENTS.md、CONTRIBUTING.md、実ファイルと最新のGitHub結果を確認してください。
> 文書の入口：[ローカル規則一覧](README.md)。

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

対象：refs/heads/main。Enforcement：Active。**Bypassなし。**

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

- `policy`：通常は作業ブランチ → develop、最終確認は同じrepoのdevelop → main。マージ権限はRulesetで制限します。
- `quality (ubuntu-latest)` と `quality (windows-latest)`：lockfileからの依存導入、JavaScript lint、自動テスト12件。
- Node.js 22を使用。develop・mainへのPRで実行し、品質検査は両ブランチへのpush・手動でも実行。
- PR編集、追加push、再オープン、Ready化でも再実行。

現在の作品は静的HTML・CSS・JavaScriptです。独立したformat・型チェック・build工程はなく、空の検査で成功を表示しません。実カメラ、GPU描画、追跡精度、外部CDNの稼働は手動確認です。

PR本文・ラベル・Issueの入力検査は未実装です。将来追加する場合はPR編集・ラベルの追加削除・API経由のIssue作成にも対応します。現段階はテンプレートと人のレビューを使います。

CIはcontentsのreadだけ、checkout時の認証情報を残さず、依存のライフサイクルスクリプトを実行しません。CIに秘密情報は渡しません。デプロイ、重いセキュリティ監査、毎PRのnpm auditは追加しません。CI・検査コード自身の差分は本人が確認します。

GitHub上で最初の成功を確認後、画面に表示された3つのcheck名と発行元をRulesetへ登録します。CIファイルの追加だけではマージをブロックできません。

## 必須ファイル

- `ルートのAGENTS.md`：AIの入口とdevelopへの作業先。
- `CONTRIBUTING.md`：人間向け手順、役割、レビュー方針。
- `README.md`：ローカル起動と検証方法。
- .github/pull\_request\_`template.md`：PR原稿。
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
7. repo内の規則一覧を全員に案内し、練習を行う。元のNotionはそのまま保存する。

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
