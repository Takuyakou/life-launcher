# P71-00 Snapshot / Edit Contract Audit

## Result

監査完了。製品機能の実装は行っていない。指示書の初回監査ゲートに従い、PRレビュー待ちで停止する。

Baseline main: `d2b52739c82e3934174f54aafa29f6f9e30b27ac`。
Branch: `docs/p71-00-edit-sync-audit`。P7.2 PR #32の文書変更は含めず、mainへ適用済みの早期完了実装を監査した。

## Findings

1. Today3に編集メニューがない。Project/Wishlist編集はsourceだけ更新し、採用済みToday3を再snapshotしない。
2. 編集開始と保存に同一source Timer guardがない。既存の完了/削除guardだけでは不足する。
3. Project編集は保存前にclose・成功toast、Wishlist編集は保存前にdraft破棄。失敗時の再試行を改善する必要がある。
4. Wishlist editorはindexを保持する。stable IDに基づく再解決が必要。
5. Today3独立ID/batch ID、Project名/色、action本体のsnapshotは現schemaにない。sourceKey、配列順、done、当日枠を維持する設計とした。
6. source+Today3を単一config保存へまとめられるが、既存Windows file replacementは完全なcrash atomicではなく、複数writerの古いconfig上書きも未解決。論理的一括保存と分けて記載した。
7. 満了画面からnextStepを直接更新する別handlerもあるため、編集ガードの対象漏れに注意する。

## Deliverables

- [契約](../00-edit-sync-contract.md): stable identity、legacy、Timer guard、保存・競合・retry。
- [Field matrix](../00-field-sync-matrix.md): Today3の全fieldと不変データ。
- [UI inventory](../00-ui-inventory.md): 現在配置と変更対象。
- [Execution state](../execution-state.json): P71-00レビュー待ち、後続stageは未着手。
- tests/visual/phase71-audit.spec.ts: 1440/860pxのToday menu・Project editorを再現、画像生成、横溢れ検査。

## Validation

| Check | Result |
| --- | --- |
| current-main全test:visual | 149 PASS |
| 追加監査test:visual | 2 PASS |
| lint / build | PASS |
| public:check | PASS |
| git diff --check | PASS |

Visual: 860px Project editor画像を目視確認。左右の現行配置と横溢れなしを確認。画像はテスト出力であり、過去Phaseのスクリーンショットを今回PRに含めない。
Rustコード変更なし。Rust tests/実Tauri smokeはこの監査で再実行していない。Timer編集guardや保存失敗retryは未実装のためPASSとはしていない。

## Remaining / Stop

P71-01で編集・resnapshot・guard、P71-02でfooter/Timer配置、P71-03でGuide同期と最終回帰を実装する。
既存P7.2 PR #32とWeb PR #10はこの作業ではマージしない。Web変更、EXE更新、version/tag/Releaseも行わない。
既存未コミット画像とPhase6.2報告書は保全し、ステージしない。

P71-00 COMPLETE — STOPPED FOR HUMAN REVIEW
