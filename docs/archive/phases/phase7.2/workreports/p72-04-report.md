# P72-04 作業報告

日付: 2026-09-10。対象: cross-section D&D、専用preview、Today Builder v2.1誘導。

## 実装

- Today Builder候補からToday3へD&D採用できるようにした。3/2/1列の実カード矩形を使って先頭・カード間・末尾の挿入位置を求め、黄色線で示す。
- 当日明示的に除外したNextStep/WishlistだけをBuilderへD&D復帰できるようにした。元sourceを残し、Today3へは採用しない。
- 復帰可能なsourceを閉じたBuilderへ500ms重ねると一時展開する。v2.1の金色枠、淡い背景、直下の「↓ ここにドロップして今日の候補に戻す」を有効時だけ表示する。
- payloadはsource stable identity、origin、開始日のみに寄せた。BuilderとWishlistの配列indexは表示用に限定し、pointermoveとdrop時にstable identityから最新項目を引き直す。
- drop直前に当日、source存在、3件上限、重複、active Timerを再確認する。Builder以外からToday3への直通は追加していない。
- 専用previewはProject識別と本文だけにし、Timer・今日へ・操作menuを除外した。メイン領域端のauto-scrollと、Escape、pointercancel、window blurのcleanupを追加した。
- pointermove、一時展開、無効dropではconfig保存0回。採用・復帰の成功dropだけ既存commandで1回保存し、失敗時はToday3、除外、元sourceを維持する。

## テスト

- `tests/visual/phase72-cross-dnd.spec.ts` を追加した。
- Builder→Today3の1920/1000/860px、実座標挿入、狭幅auto-scroll、preview内容、pointermove保存0回、drop保存1回を確認した。
- 閉じたBuilderの500ms一時展開、全page候補membership、既存候補の無強調、Wishlist保存失敗、source保持、3件満杯、active Timer、日付変更、操作button非drag、Escape、pointercancelを確認した。
- 対象D&D・MENU・SEL・LIST・UNDO回帰: 65/65 PASS。P72-04単体は全page testを含む12/12 PASS。
- 全Visual QA: 222/222 PASS（1.5分）。
- public:check: 275 files / 0 blockers PASS。
- lint / build: PASS。
- Rust fmt / check / clippy / 103 unit + 2 integration: PASS。
- npm audit全依存 / production: 0 vulnerabilities。
- git diff --check: PASS（既存ファイルの改行警告のみ）。

## Visual QA

- 1920pxは3列、1000pxは2列、860pxは1列相当で挿入線と専用previewを自動確認した。
- 閉じたBuilderのtarget外/内、500ms展開、金色drop zone、狭幅screen edge scrollを確認した。
- 実Windows DPI 125% / 150%は未実施。CSS viewport相当の確認であり、P72-06最終報告へ残す。

## 残存事項

- 完了成功後の一時演出はP72-05で実装する。
- Guide、全回帰、Native smoke、Web Demo差分整理はP72-06で扱う。
- PR・CI・merge commitはGitHub送信承認後に本報告と実行台帳へ追記する。
