# P62-02 Source Lifecycle & Completion History 作業報告書

## 状態

- Stage: P62-02
- 判定: `COMPLETE — APPROVED FOR CONTINUATION`
- Base branch / SHA: `main` / `c476772a1040d37a469d6a3383e5ee0736b73f55`
- Implementation commit: `7d541ef45f3c9bda1623899ca8c8b2c9bfcc3a3b`
- Branch: `feat/p62-02-source-lifecycle`
- Product version: `1.0.0`（変更なし）

## 実施内容

- Today3完了とsource完了を分離した。Timer満了後の確定はToday3だけを完了し、sourceはactiveのまま残る。
- NextStep / Wishlistの右クリックへ`完了にする`を追加した。
- NextStep完了ではProjectを残し、nextStepとtrigger/freshness metadataを非active化した。
- Wishlist完了では対象Wishlist sourceをactive一覧から外した。
- 完了時は同sourceのToday3と当日除外keyを解除し、Session / Today Activityへは触れない。
- `sourceCompletions`を後方互換fieldとして追加し、source type / identity / text / Project / completedAtのimmutable snapshotを保存した。
- Recordsへ`完了した項目`を追加し、source削除後もsnapshotを表示できるようにした。
- 削除は完了と別操作のまま、Today3/除外を解除するがcompletion historyを作らない。
- 完了・削除dialogを対象表示、キャンセル初期focus、Esc、処理中disabled、rollback対応にした。
- active timer sourceの完了・削除をUIとhandlerの両方で拒否した。

## 追加test

- Today3 planned completionがsource completionを作らないこと。
- NextStep完了でProject保持、Today3解除、履歴snapshot作成。
- Wishlist完了でsource解除、Project snapshot作成。
- source削除後も既存completion historyが残ること。
- deleteがcompletion historyを作らないこと。
- confirmのcancel/Esc/default focus/double-submit。
- save failure時にsource / Today3 / historyが一体でrollbackすること。
- active timer中のcomplete/delete disabled。
- 旧configに`sourceCompletions`がなくても空配列として読めること。
- reload後も履歴を表示できること。

## 検証

| コマンド | 結果 |
|---|---|
| `npm.cmd run public:check` | PASS（184 files / blocker 0） |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | PASS（85 / 85） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS（98 unit + 2 capability contract） |
| `git diff --check` | PASS |

## 残存事項

- Quick/Dictionary移動とStart Environment PickerはP62-03で実装する。
- Records説明文、Guide、current-specの最終同期はP62-04で行う。
- 実Tauri smokeはP62-06 Final Gateで実施する。
- version、tag、Release、binaryは変更していない。

`P62-02 COMPLETE — CONTINUING UNDER USER APPROVAL`
