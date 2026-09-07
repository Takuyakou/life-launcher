# P62-01 Today-layer Flow & Today Builder Layout 作業報告書

## 状態

- Stage: P62-01
- 判定: `COMPLETE — APPROVED FOR CONTINUATION`
- Base branch / SHA: `main` / `e6898f508622ddf44272458371b1367effd34a7e`
- Implementation commit: `8a8ff759efc8b436d4550286848cd42960effdfe`
- Branch: `feat/p62-01-today-layer-flow`
- Product version: `1.0.0`（変更なし）

## 実施内容

- NextStepとWishlist下段の常設`今日へ`を削除し、Today Builderを唯一の採用面にした。
- Builderをsource別見出し、Project色・名称、compact row、5件/pageで構成した。
- `today.candidateExcludedSourceKeys`を後方互換fieldとして追加した。
- Builder右クリックへ`今日の候補から外す`を追加した。
- 候補除外時はsourceを保持し、同sourceのToday3 snapshotだけを同じ保存で解除する。
- active timer sourceの除外をdisabledにし、停止が必要であることをtitleで示した。
- 保存失敗時は既存`persistConfig`のrollbackにより、候補とToday3の表示を復元する。
- 除外は同一Today date内でreload後も維持し、Rust sanitizeの日付切替時にclearする。
- 旧`life-launcher-today-builder-dismissed`値は移行・削除せず、引き続き新filterでは使用しない。

## 追加・更新test

- Builderだけに`今日へ`が存在すること。
- NextStep / Wishlistのgroup headingとProject identity。
- source保持、Today3解除、reload後の同日除外維持。
- 保存失敗時の候補・Today3 rollback。
- active Today timer中の除外disabled。
- 860 / 1366 / 1440 / 1920pxでlong Japanese textとhorizontal overflow 0。
- 旧configで除外fieldがなくても読めること。
- 除外keyのtrim / empty除去 / duplicate除去。
- Today date切替で除外がclearされること。
- 既存の採用snapshot、最大3件、duplicate identity、pagination、D&D drop-only保存を新導線で再検証。

## 検証

| コマンド | 結果 |
|---|---|
| `npm.cmd run public:check` | PASS（182 files / blocker 0） |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | PASS（79 / 79） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS（97 unit + 2 capability contract） |
| `git diff --check` | PASS |

## 残存事項

- source完了・削除・immutable completion historyはP62-02で実装する。
- Recordsの完了履歴表示と説明文、Guide/current-spec同期はP62-04で行う。
- 実Tauri smokeはP62-06 Final Gateで実施する。
- tag、Release、binaryは作成していない。

`P62-01 COMPLETE — CONTINUING UNDER USER APPROVAL`
