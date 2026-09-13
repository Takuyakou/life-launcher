# P8-05 作業報告

## 結果

2026-09-13、アプリ内ガイド、現行仕様書、薄いOVERVIEWをPhase 8候補の実装へ同期した。
作業branch: `docs/p8-05-guide-spec-sync`。stack base: `feature/p8-04-dictionary-state`（PR #58）。

## アプリ内ガイド

- 16章から、現在の日常操作に沿う10章へ再構成した。
- 最初に「今やる一手」「今日を組み立てる」「Timer終了と実行記録」の3stepを配置した。
- 表示語を「取り組み」「目標」「次にやること」「始めるきっかけ」「実行記録」へ統一した。内部のProject/Session schema名は変更していない。
- `他の一手`は候補2件以上でだけ表示し、button/右クリックが同一handlerで、優先順や保存データを変えないことを明記した。
- Today3のmax3、Builderの2source、`✓ 選択済み`、完了後の保持、3/3後の次batch、解除とUndoを同期した。
- 記録3tab、辞書のactive pageとkeyboard focus、再表示復元と検索resetを同期した。
- 旧ChatGPT coach promptや実装外の運用説明はガイドから除いた。

## 文書

- `docs/spec/current-spec.md`をv1.3候補へ更新し、P8-01〜P8-04の実装契約を反映した。
- `docs/OVERVIEW.md`は98行を維持し、5分で更新できる入口として画面tree、data配置、非目標、版履歴、関連文書を更新した。
- README、CHANGELOG、Release notes、version、tagは変更していない。

## 追加・更新テスト

- `tests/visual/phase8-guide-sync.spec.ts`を3件追加。
  - 10章の順序と最初の3step
  - 現行表示語、Phase 8状態契約、旧文言の不在
  - OVERVIEW 100行以下とcurrent specの同期
- `tests/visual/phase61-guide.spec.ts`の目次focus対象を新しい`今日を組み立てる`章へ追従した。

## 検証

| 検証 | 結果 |
| --- | --- |
| `npm.cmd run build` | PASS |
| `npm.cmd run lint` | PASS |
| Guide重点 | PASS: 6件 |
| `npm.cmd run public:check` | PASS: 292 files / 0 blockers |
| `npm.cmd run test:visual` | PASS: 197件 |
| `git diff --check` | PASS |

P8-04の初回CIで、削除通知反映前に再表示した新規テストが1回失敗した。製品実装は変更せず、削除済みDOMを待つ同期を追加し、対象を10回連続PASS、再CIもPASSした。

## 残存事項

- 実Tauri/Windows、Rust、audit、clean installを含む統合gateはP8-06で行う。
- P8-04/P8-05はstacked PRのため、mergeは下から行う。
- version bump、tag、Release、Installer/EXE、Web Demoは対象外。

`P8-05 COMPLETE — READY FOR PR`
