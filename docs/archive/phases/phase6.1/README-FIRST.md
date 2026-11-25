# Life Launcher — Phase 6.1 追加改善

**候補の登録・選択・実行の分離／登録UI統一／Guide更新**

作成日: 2026-09-06
対象: `Takuyakou/life-launcher`（Windows本体のみ）
資料の基準: [Phase 6 総合作業報告書](reference/phase6-final-report.md)

## 最初にすること

このZIPを展開し、**フォルダ全体**をCodexから参照できる場所に置く。
[P61-CODEX-START.txt](P61-CODEX-START.txt)の内容を最初に一度だけ渡す。
Start文だけ渡して残りのファイルを参照できない状態にしない。

以後はStage完了の報告を確認し、`P61-00を承認。続行してください`のように返すだけ。
毎回別の長い開始プロンプトを貼り直す必要はない。各Stageの最後では必ず停止する。
承認・続行は**次Stageの作業許可**であり、mainへのマージ・Releaseの許可ではない。

## Phase番号の区別

- 本パッケージは、新しい追加工程 **Phase 6.1**。
- 旧Phase 6の実装Stage `P6.1`（PR #7）をやり直す指示ではない。
- 混同を避けるため、今回のタスクIDは **`P61-00`〜`P61-04`** とする。
- 旧`docs/phase6/`と旧execution-stateを上書きしない。
- 新しい管理場所は `docs/phase6.1/`。作業報告はその中の`workreports/`。

## 今回変えること

| 場所 | 追加改善 |
|---|---|
| 今日を組み立てる | 候補参照・選別に専念。新規登録の＋追加と勝利条件等への送付先選択を除く |
| 今日の3件 | 新規登録の＋追加を除く。下の候補から「今日へ」で入れる |
| Builder候補 | 次の一手・やりたいことを参照。独立リストは作らない。削除/dismiss UIを撤去 |
| やりたいこと | 行内追加をやめ、次の一手と同じ操作文法の小さな登録モーダルにする |
| 次の一手 | 詳細なProject設定を維持し、作成対象と見出しの食い違いを直す |
| Guide / 使い方 | 実装後の操作に合わせる。階層や「昇格」を覚えなくても使える説明にする |

維持するもの: Today3の3列カード、満了後の終了確定による完了、次の3件、
5件ページング、stable source identity、sourceを残す「今日へ」、保存失敗時の復元、
辞書・Quick・Explorer表示・キーボード操作・権限制約。

## 現在地の重要な注意

報告書の最終実装は `74f4a9608f3b5e2ef857f580db45dd0abbe270bf`、
ブランチは `chore/p6-03-v11-readiness`、PR #9は人間確認待ち。
**報告書は、この実装がmainへマージ済みとは言っていない。**
製品表示versionも`1.0.0`のまま。今回version変更やリリースは行わない。
まずP61-00が現物のGit状態を照合し、古いmainを基点にしないようにする。

## 実行順

| ID | 内容 | 終了時 |
|---|---|---|
| P61-00 | 報告書と現物の差分監査、ベース固定、変更対象の確定 | PR/報告 → STOP |
| P61-01 | 登録・選択導線とBuilderの整理、旧dismiss互換対応 | PR/報告 → STOP |
| P61-02 | Wishlist登録モーダル、Project作成見出し・登録UX調整 | PR/報告 → STOP |
| P61-03 | アプリ内Guideと現行仕様書の同期 | PR/報告 → STOP |
| P61-04 | 総合回帰・Visual QA・追加改善の完了判定 | PR/報告 → STOP |

仕様: [SPECIFICATION.md](SPECIFICATION.md)
差分と事実の区分: [SCOPE-AND-DELTA.md](SCOPE-AND-DELTA.md)
進行規則: [WORKFLOW.md](WORKFLOW.md)
使い方更新: [GUIDE-UPDATE.md](GUIDE-UPDATE.md)
検証: [TEST-MATRIX.md](TEST-MATRIX.md)

## 承認例

```text
P61-00の監査結果と提案仕様を承認。続行してください。
```

差し戻し時は修正点を伝える。Codexは同じStageを修正し、再報告する。
最後まで完了してもmainマージ・version変更・tag・Releaseには別の明示指示が必要。
Web Demo、Cloudflare、Zenn、公開済みv1.0.0の配布物には触らない。

このZIPは実装指示書であり、アプリの修正済みコードや実行済みテスト結果ではない。
