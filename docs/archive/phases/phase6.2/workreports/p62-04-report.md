# P62-04 Records Explanations / Guide / Current Spec Sync 作業報告書

## 状態

- Stage: P62-04
- 判定: `COMPLETE — APPROVED FOR CONTINUATION`
- Base branch / SHA: `main` / `ccf2e9374c08889f646c67847d4905e8d641c733`
- Implementation commit: `b4f3c3ad88cce7e4aeb9da7c20ec82c32fa28209`
- Branch: `docs/p62-04-records-guide-sync`
- Product version: `1.0.0`（変更なし）

## 実施内容

- Recordsの`動かしたプロジェクト`へ、先週のSessionに記録されたProjectが対象である説明を追加した。
- `今週の重点`へ最大3件の選択である説明、`鮮度レビュー`へ次の一手を14日以上更新・確認していない条件を追加した。
- `完了した項目`へ、今後の候補から明示的に外した完了項目である説明を追加した。
- 見出しとmuted説明を横並び・自然なwrapにし、件数や操作より低い視覚優先度を維持した。
- GuideをBuilderだけが`今日へ`を持つ現行導線へ更新した。
- Guideへ当日候補除外、翌日復帰、active timer guard、Today3完了と登録完了の区別を反映した。
- Guideへ`完了にする`と`削除`の違い、Quick/Dictionary移動、Start Environment Picker、完了履歴を反映した。
- canonical `docs/spec/current-spec.md`へP62-01〜03のToday layer、source lifecycle、Quick/Dictionary、Picker、Records説明を同期した。
- 旧導線文言を自動テストで監査した。

## 追加test

- Recordsの4説明文が実画面へ表示されること。
- 鮮度レビューを含むRecordsが860pxでwrapし、horizontal overflowしないこと。
- GuideがPhase 6.2の候補除外、移動、完了、Pickerを説明すること。
- Guide 860pxのbounded layout。
- current-specに現行ラベルがあり、旧`サイドバーへ追加`と直接`今日へ`導線がないこと。
- freshness fixtureをVisual QA mockから設定可能にした。

## 検証

| コマンド | 結果 |
|---|---|
| `npm.cmd run public:check` | PASS（194 files / blocker 0） |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | PASS（94 / 94） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS（98 unit + 2 capability contract） |
| `git diff --check` | PASS |

## 残存事項

- Web Demoの中心導線同期はP62-05で別repositoryへ実装する。
- 実Tauri smokeと全体readiness判定はP62-06で行う。
- version、tag、Release、binaryは変更していない。

`P62-04 COMPLETE — CONTINUING UNDER USER APPROVAL`
