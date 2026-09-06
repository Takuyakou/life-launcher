# P62-00 Current Main Gap Audit 作業報告書

> この文書はPhase 6.2 P62-00の監査・仕様固定記録である。製品コードの現行仕様は`docs/spec/current-spec.md`、Phase 6.2で固定した差分は同ディレクトリの4つの監査文書を参照する。

## 状態

- Stage: P62-00
- 判定: `COMPLETE — STOPPED FOR HUMAN REVIEW`
- Base branch / SHA: `main` / `a6d17d1f0b29a533764c168aeac6a93ea137c722`
- Audit commit: `49b3fc543f1ce308232a48c4c5f97c7a526e6afb`
- Branch: `docs/p62-00-gap-audit`
- PR: [#17](https://github.com/Takuyakou/life-launcher/pull/17)
- Product version: `1.0.0`（変更なし）

## 実施内容

| Deliverable | 内容 |
|---|---|
| `00-gap-audit.md` | merged mainとPhase 6.2要求の差分、現行データ・UIの事実、固定判断 |
| `00-data-lifecycle.md` | source identity、日次候補除外、Today3完了、source完了、削除、履歴、timer guard |
| `00-ui-action-map.md` | Surface別操作、Builder layout、confirm、Quick/Dictionary移動、開始環境Picker、Records説明 |
| `00-web-demo-gap.md` | Web Demo current mainとの差分、MUST/optional/native-only、deploy gate |

このStageでは製品コード、test、permission、dependencyを変更していない。

## 主要監査結果

- NextStep/Wishlist/Builderの3か所に`今日へ`が存在する。Phase 6.2ではBuilderだけに残す。
- Builderはsource-only、stable identity、5件/page、D&D drop-only保存を実装済みだが、source別groupと日次候補除外は未実装。
- 旧dismiss localStorageは保持されるが、候補filterと新規書込には使われていない。
- Today3は採用時snapshotを持つ。active TimerはDo NowではProject ID、Today3では`today:{sourceKey}`を使うため、source操作前に共通identityへ正規化する必要がある。
- RecordsはSession履歴、前週集計、今週の重点、鮮度レビューを持つが、source completion historyはない。
- Quick/Dictionaryは2つの表示boolで管理され、Dictionaryの「サイドバーに追加」だけが存在する。
- Start Environmentの`buttonIds`は配列順がlaunch order。現行schemaには件数上限がない。
- current-specとGuideはPhase 6.1契約のため、P62-01〜03実装後に同期が必要。
- Web DemoはBuilderをToday3 previewとして表示し、固定候補をToday3へ直接追加するため、本体Phase 6.2の中心導線と不一致。

## 固定した判断

- 日次除外は`today.candidateExcludedSourceKeys`へstable identityで保存し、次の日付keyでclearする。
- 旧dismiss値は新しい日次除外へ移行しない。
- source完了履歴はconfigの後方互換`sourceCompletions`へimmutable snapshotとして保存し、Sessionと分離する。
- NextStep完了はProjectを残してnextStepを非active化する。NextStep削除は現行互換でProject登録削除とする。
- active Timer対象の候補除外・完了・削除はUIとhandlerの両方で拒否する。
- Start Environment Pickerの新規選択上限は2件。既存3件以上はtruncateせず、保存順と起動順を維持する。
- Records説明は実ロジックに合わせ、manual sessionとnextStep更新/確認時刻の境界を誤記しない。

## Visual QA

- 製品UI差分はないため、新規Before/After画像は作成していない。
- 既存の全Visual QAを再実行し、71/71 PASSを確認した。
- Visual実行で再生成された既存画像はrestoreし、監査PRへ混入していない。

## 検証

| コマンド | 結果 | 備考 |
|---|---|---|
| `npm.cmd run public:check` | PASS | 179 files / blocker 0（監査4文書配置時） |
| `npm.cmd run lint` | PASS | warning 0 |
| `npm.cmd run build` | PASS | TypeScript + Vite production build |
| `npm.cmd run test:visual` | PASS | 71 / 71 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS | formatting差分なし |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS | dev profile |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS | warning 0 |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS | 95 unit + 2 capability contract |
| `git diff --check` | PASS | whitespace errorなし |

## Web Demo read-only監査

- 対象SHA: `aaf4638d289780abf0cf1f5b9d8e8b3a2e984a52`
- working treeとmainは変更していない。
- Web実装・PR・merge・Cloudflare deployはP62-05まで行わない。

## 残存事項

- P62-01以降の製品実装と追加testは未着手。
- 実Tauri GUI smokeは製品差分がないため未実行。browser-level Visual 71件とRust 95+2件でbaselineを確認した。
- version、tag、Release、binaryは変更していない。

## 停止確認

- P62-01へ進んでいない。
- mainへmergeしていない。
- human approval後にP62-00 PRをmergeし、merge後validationを行ってからP62-01を開始する。

`P62-00 COMPLETE — STOPPED FOR HUMAN REVIEW`
