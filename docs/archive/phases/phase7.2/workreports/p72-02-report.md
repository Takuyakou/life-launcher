# P72-02 作業報告

日付: 2026-09-10。対象: 右下Warm Rich Toast、Today選択Undo、編集同期通知。

## 実装

- 既存Toastを右下のWarm Rich表示へ統一した。accent、icon、タイトル、補足、action、閉じる、残時間railを持ち、狭幅ではviewport内へ収める。
- 通常通知は4秒、Undo付きは8秒。pointer、focus、document hiddenをOR条件で停止し、残時間から再開する。同時表示は3件までで、待機中Undoの寿命は表示開始時から数える。
- 「今日の3件から外す」「今日の候補から外す」に確認なしのUndoを追加した。初回保存成功後だけactionable Toastを表示し、Undo失敗は再試行可能なまま保持する。
- Rust commandは保存lock内で最新configを読み直し、operation token、日付、source snapshot、重複、満杯を検証して対象だけを復元する。古い全Today配列や全configは保存しない。
- 元位置は次のstable source、前のstable source、末尾の順で決定する。別項目の並べ替え、後続設定、Session、source、完了履歴を保持する。
- selection mutation tokenは後続の採用・除外・完了・削除で更新または破棄し、日付切替で消去する。旧configでは空mapとして読み込む。
- Project/Wishlistの編集成功通知を、操作元と実際のToday snapshot同期有無に応じた1件の通知へ統合した。

## テスト

- `tests/visual/phase72-toast-undo.spec.ts` を追加し、対象差分復元、後続順序・設定保持、候補除外のみのUndo、満杯競合、再試行、二重実行防止、hover/focus OR、document hidden、最大3件とqueue、Builder/source編集通知を確認した。
- Rust unit testで旧config互換、日付切替token破棄、対象だけの隣接復元、stale token/source edit拒否、除外のみUndoを確認した。
- 対象Playwright: 8/8 PASS。
- 全Visual QA: 185/185 PASS（1.4分）。
- public:check: 270 files / 0 blockers PASS。
- lint / build: PASS。
- Rust fmt / check / clippy / 103 unit + 2 integration: PASS。
- npm audit全依存 / production: 0 vulnerabilities。
- git diff --check: PASS（既存ファイルの改行警告のみ）。

## 残存事項

- multi-window全体の汎用revision管理は導入していない。Undo対象はcommand実行時の最新configと対象token/snapshotを再検証し、前提が変わった場合は拒否する。
- Native Tauri/DPIの手動確認はP72-06の最終報告で明示する。
- リスト閾値とToday timer幅はP72-03、cross-section D&DはP72-04、完了演出はP72-05で扱う。

PR・CI・merge commitはGitHub確認後に本報告と実行台帳へ追記する。
