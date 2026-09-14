# Phase 8.1 / Stage 00 作業報告（内部ID: P81-00）

> この報告はStage 00完了時点の監査snapshotである。その後、ユーザーがconfig v2→v3本番移行とP81-01〜P81-08の続行を承認した。現在状態は[Execution State](../execution-state.json)と[Phase 8.1作業まとめ](./phase8.1-final-summary.md)を参照する。

## 結果

2026-09-14、Phase 8.1のCurrent Main / Data Ownership / Migration Auditを完了した。製品コードの変更はない。P81-01以降は未着手であり、監査PRを人間のレビュー待ちとして停止する。

- 基準commit: `07904dd1c34b5f9bbc101a6dcae58a71a6bb4fd9`
- 作業branch: `docs/p81-00-data-migration-audit`
- Pull Request: https://github.com/Takuyakou/life-launcher/pull/69
- config current version: 2
- 推奨戦略: config v3 + Project配下のoptional NextStep object

## 成果物

- [Current Main Audit](../00-current-main-audit.md)
- [Data Ownership Map](../00-data-ownership-map.md)
- [Migration Matrix](../00-migration-matrix.md)
- [Schema Strategy](../00-schema-strategy.md)
- [Execution State](../execution-state.json)

## 主な監査結果

1. 現行NextStepは独立entityではなくProjectのflat field群で、stable identityは `project:{Project.id}`。
2. Today3は採用時snapshotであり、移行時にcanonical sourceから再構築してはならない。
3. Sessionとsource completionは別のimmutable履歴であり、現在のsourceから補完・更新しない。
4. v2ではNextStep完了後もProjectに実行環境・Timer・手順書設定が残る。移行で破棄せず、空候補も作らない保留設定が必要。
5. collection単位の現在のparse fallbackへv3を直接通すとProject全体を既定値へ戻す危険がある。専用v2 decoderとpure transformが必要。
6. Rust JSON Schemaとruntime modelでToday exclusion/mutation tokenの記述差がある。v3 validation開始前に整合が必要。
7. Windows保存fallbackには置換途中のcrash windowがあるため、migration前のraw backupと再読込検証が必須。

## 既実装として維持する項目

- Today3 / 今やる一手 / 3件完了 / 今日の勝利条件の完了feedback
- 今日の勝利条件を消して再入力した後の再演出
- reduced-motion対応
- Timer hover時の表示とアニメーション
- HTML手順書ビューワーの描画改善
- Today3からBuilderへの採用解除D&DとUndo

完了アニメーションは今回再実装していない。既存回帰テストを移行後も必須gateとして扱う。

## 自動検証

製品コードは基準mainと同一の状態で実行した。

| 検証 | 結果 |
| --- | --- |
| `npm.cmd run lint` | PASS |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | PASS: 208件、約1.8分 |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | PASS: unit 99件 + capability contract 2件 + doc 0件 |

最初の `test:visual` 起動要求は自動承認レビューのtimeoutでコマンド自体が開始されなかった。許可された1回の再実行が完走し、テスト失敗はない。

## 検証の限界

- P81-00はdocs-onlyのため、新しいmigration fixtureやUIはまだ存在しない。
- `test:visual`はPlaywright/ChromiumとTauri mockによる回帰であり、実OS上のmigration failure注入ではない。
- native EXE、Installer、version、tag、Release、Web Demoは変更していない。
- remote CIはPR上で別途確認する。ローカルPASSをCI PASSとはみなさない。

## レビュー判断

P81-01へ進む前に、[Schema Strategy](../00-schema-strategy.md)のStrategy Aと不変条件を承認すること。Wishlist promotionの消費/保持、未割当WishlistのProject選択、timer所有の最終仕様は指定された後続stageまで保留する。

`P81-00 COMPLETE — STOPPED FOR HUMAN REVIEW`
