> HAL208 Notionから2026-10-26に移した文書です。Notionは変更していません。
> 初期導入・認証待ち・CI成功などの記述は2026-10-20時点の記録で、現在の適用状況を保証しません。
> 実作業ではルートのAGENTS.md、CONTRIBUTING.md、実ファイルと最新のGitHub結果を確認してください。
> 文書の入口：[ローカル規則一覧](README.md)。

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

作業者は実装・検証・説明を担当。レビュアーは差分と実際の動作を確認。マージ担当は承認とCIを確認して統合。管理者は権限・Ruleset・CI設定を管理します。担当者はチームで決定し、該当Issue・PRに記録します。作者は自分のPRの承認者になりません。

## 毎回の手順

1. Issueを探して重複を防ぎ、なければテンプレートで作成。目的・対象外・完了条件・担当を決めます。
2. `作業前にAGENTS.md`と関連文書を読みます。AIにも同じ規則を渡します。
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
