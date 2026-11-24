# P8-02 作業報告

## 結果

2026-09-13、Today3 / Today Builderの空状態・選択状態・追加入口を整理した。
基準main: `93b987647c1ec19d8774390f90051fe4cc2239d3`（PR #55 merge後）。
branch: `feature/p8-02-today3-builder`。

## 変更

- Today3の0件表示を実カード1行相当の144pxへ固定。初回採用前後のgrid高差は16px以内を自動確認する。
- 空状態へ `今日やるものを選びましょう`、`次の一手・やりたいことから選べます` と、＋icon付き `今日を組み立てる` CTAを配置した。
- Builderの採用済み項目は `✓ 選択済み` の弱いgreen statusとした。採用解除toggleではなく、操作buttonも出さない。
- Builder headerへ独立 `＋追加` を追加。登録先を無断で固定せず、既存ContextMenuで `取り組みを追加` / `やりたいことを追加` を選び、既存フォームを開く。
- 通常/早期Timer完了時のToday3保持、3/3判定、source lifecycleは既存実装を維持した。source自体の明示完了/削除は既存の非Today3完了操作として扱う。

## 保存契約

Today3のschema、stable source key、snapshot、max3、duplicate guard、D&D、Undo、Timer guard、save failure rollbackは変更していない。追加入口はsource作成のみで、Today3への直接自由入力モデルを作らない。

## テスト

`tests/visual/phase8-today3-builder.spec.ts` に4件追加。

- 0件copy、CTA、1行分min-height、0→1の高さ変化
- 完了3件のrender保持、Timer再開始不可、3/3次batch
- selectedはexact statusでbuttonではない
- Builder追加がaccordionをtoggleせず既存2種formへ接続

既存Today3 testのselectorを新DOMへ追従。既存Quick keyboard testはContextMenuのfocus-returnを待つ同期を追加し、操作の競合を解消した。製品Quick実装は変更していない。

| 検証 | 結果 |
| --- | --- |
| build / lint | PASS |
| Today3/Builder/D&D/Undo重点 | PASS（新規4件と既存回帰） |
| Quick focus同期10回連続 | PASS |
| 全 `npm.cmd run test:visual` | PASS: 182件、約1.8分 |
| git diff --check | PASS |

## Visual QAと制約

1440x900と860x900でDOM/geometry、focus、状態、horizontal overflowを自動確認した。画像目視はsandbox画像readerがACL errorのため未実施。実Tauri/OSの最終smokeはP8-06に残す。
version/tag/Release/EXE/Web Demoは変更していない。

`P8-02 COMPLETE — READY FOR PR`