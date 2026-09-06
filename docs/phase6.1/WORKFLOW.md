# Phase 6.1 — Single Start / State / Human Gates

## 1. 1回のStartで継続できるようにする

ユーザーはパッケージを渡し、最初のStartを1回だけ送る。
以後は`P61-01承認。続行してください`などでよい。
**1回のStartは全Stageを自動実行する許可ではない。各境界で停止する。**

再開時は、state・最新workreport・実際のGit状態・次Stage文書を読む。
チャットだけから完了/承認を推定せず、データと食い違った場合は調査して停止する。

## 2. 正式配置と文書の役割

パッケージは初回に読み、P61-00の専用branchで公開安全性を確認して
`docs/phase6.1/`に導入する。以後その中の`execution-state.json`を唯一の進行状態とする。
外部のZIP展開フォルダは入力資料であり、実行中stateを二重更新しない。
同名ファイルが既にある場合は差分を調べ、初期stateで上書きしない。

```text
docs/phase6.1/
  README-FIRST.md
  WORKFLOW.md / SCOPE-AND-DELTA.md / SPECIFICATION.md
  GUIDE-UPDATE.md / TEST-MATRIX.md
  P61-CODEX-START.txt
  stages/
  reference/phase6-final-report.md
  templates/WORKREPORT.md
  execution-state.json
  workreports/P61-00-report.md … P61-04-report.md
```

- `docs/spec/current-spec.md`: 実装に対応する現行製品仕様。
- `docs/phase6.1/`: この追加開発の計画・判断・作業履歴。
- `docs/phase6/`: 旧Phase 6の履歴。改ざん・上書きしない。
- `.work/phase6.1/`等のgitignored領域: 試行ログ、大量スクリーンショット、trace。
- PR: 差分、テスト結果、workreportへのリンク。作業報告をPRだけに追い出さない。

作業ごとにmdを何枚も増やさず、原則**1Stageにつき報告1枚**。
大量の生成画像は非追跡とし、必要な匿名の代表画像だけ既存方針で扱う。
パッケージ配布用manifest/START-HERE/検証結果はrepoへ全コピーする必要はない。

## 3. ベースの選び方 — main決め打ち禁止

まずread-onlyで確認する。

```powershell
git status --short
git branch --show-current
git remote -v
git fetch origin --prune
git rev-parse HEAD
git rev-parse origin/main
git show --no-patch --format=fuller 74f4a9608f3b5e2ef857f580db45dd0abbe270bf
```

originは`Takuyakou/life-launcher`だけ。SSH/HTTPSの表記差は正規化して検証する。
`life-launcher-dev`・`life-launcher-web`へ書き込まない。既存dirty treeをclean/resetしない。
不足するrefは必要なものだけfetchしてよい。ユーザーの作業・稼働アプリを壊さない。

### ケースA: Phase 6最終実装が既にmainへ統合

祖先関係、差分、PRのmerge情報を確認し、報告の実装を含むことを確かめる。
squash mergeならSHA非一致だけで否定せず、対象コード・テスト差分も照合する。
追加変更を含む最新mainを固定し、報告からの差分を記録する。

### ケースB: PR #9の実装がまだmainへ統合されていない

`74f4a960…`を含む確認済みのPR #9 headを作業参照にする。
そのbranchから**別branch**を作り、P61-00の差分だけを載せたstacked PRを作る。
PR baseは実際のPR #9 head branchとし、古いmainへ全Phase 6を重複差分として出さない。
旧PR #9の状態は`WAITING_HUMAN_APPROVAL`のまま記録する。
今回のStartを、旧P6.3の承認・マージ許可に読み替えない。

### ケースC: ref不明、報告と異なる、大きな未承認変更

ベースを推測しない。可能なread-only照合まで行い、差分と必要な判断を報告して停止。
旧実装に既知のデータ破損・安全性blockerがある場合も黙って継承しない。

## 4. 次Stageとstacked PR

前Stageが承認済みでも未マージの場合、承認された**正確なhead SHA**から次branchを作る。
次PRはその前Stage branchをbaseにする。前Stageの内容を再実装しない。
前Stageがマージ済みなら、含有を確認したmainから開始する。

ユーザーによる承認後に前Stageへ別commitが追加されていたら、その追加分は未承認。
暗黙に承認を引き継がず、差分を明示する。force rebase/pushは行わない。
stackの取り込み順とbase調整案は最終報告に残し、自動mergeしない。

## 5. 状態機械

```text
READY → IN_PROGRESS → WAITING_HUMAN_APPROVAL → APPROVED
                 └→ BLOCKED
```

- 技術的なPASSと人間承認を分ける。
- Stage完了時は`WAITING_HUMAN_APPROVAL`。自分で`APPROVED`にしない。
- 人間が「承認・続行」と明示した場合だけ、引用できる承認文・時刻・対象SHAをstateへ記録。
- 単なる「確認した」「質問」「スクショ提出」を承認扱いにしない。
- 修正依頼なら同じStageへ戻し、承認対象SHAも更新する。
- 最終Stage承認後もReleaseは別指示。

state内で同じcommit自身のSHAを埋めるため無限にcommitを作らない。
実装・検証対象SHAと、後続の報告/state-only commitを分けて記録してよい。
report/承認の対象差分が分かることを優先する。

## 6. Scopeの解釈

「現在何が動くか」はコード・テストと報告書で確認する。
「今回何へ変えるか」はユーザーが合意した追加仕様で決める。
**古い実装があるから新要件を無視することも、新要件を実装済みと書くことも禁止。**

矛盾時は`SOURCE_FACT / APPROVED_CHANGE / PROPOSAL / NEEDS_CODE_CHECK`を分けて報告。
提案の詳細はP61-00で凍結し、人間承認後に実装する。
重要な未確定点は必要な判断だけまとめて示す。細かなCSS値まで承認項目を増やさない。

## 7. Safety

許可: 対象repo専用branch/worktree、通常commit/push、PR、匿名データの自動テスト。
禁止: mainへのpush/merge、force push、旧PR変更、remote設定変更、visibility、version、
tag、Release、署名鍵変更、Cloudflare、Web Demo、Zenn、実ユーザーデータの改変。

本体の起動テストは既存隔離方式を再利用。実ユーザーのtimerを止めない。
新しいネットワーク通信、権限追加、万能shell/opener許可、依存の無関係更新をしない。

## 8. 自動検証

報告書の実在入口は`npm.cmd run test:visual`。
`npm test`/`test:e2e`がないのは既知。存在しないコマンドで作業を止めたり、
帳尻合わせ用の空scriptを作らない。詳細はTEST-MATRIX.md。

Stageごとに必要なテストを実行し、最後に全回帰。skipや未検証をPASSに丸めない。
スクリーンショットの生成成功だけではUI品質の合格にならない。画像を確認する。
人間には代表のBefore/Afterと少数の判断点を渡し、全操作の手作業を要求しない。
