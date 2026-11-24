# P61-00 — 実装差分監査とベース固定

目的: 総合報告書の実装を正しく引き継ぎ、今回の追加差分だけを確定する。
**このStageでは製品UI・データ仕様を実装しない。**

必読: `../WORKFLOW.md`、`../SCOPE-AND-DELTA.md`、`../SPECIFICATION.md`、
`../GUIDE-UPDATE.md`、`../reference/phase6-final-report.md`。

branch案: `docs/p61-00-delta-audit`。
PR baseはWORKFLOWの規則で選ぶ。PR #9未マージならその確認済みhead branch。

## 手順

1. origin・dirty状態・実装commit・PR #9状態・main含有を確認する。
   旧Stage承認とmergeを混同しない。結果をexecution-stateのbaselineへ記録。
2. 現行のAGENTS、current-spec、既存Phase6報告、package scripts/CIを読む。
3. NextStep、Wishlist、Builder、Today3の追加button/empty-state/keyboard/menuを全件棚卸し。
   どのhandlerがどのmodelを新規作成・更新するか記録。
4. Builder候補のsource型・Session由来・順番・8件打切り撤廃・5件paginationを確認。
5. Builderのselectを調べ、選択肢と送付先/用途を明確にする。
   「source dropdown」と思い込まない。勝利条件の独立設定が別に残ることを確認。
6. dismissのkey・保存先・filterへの適用・日付境界を調査する。
   SPECIFICATION§5の非破壊な扱いが可能か確認。
7. Today3の安定identity、元データsnapshot、duplicateの範囲、legacy/manual/Session由来項目、
   Timer満了後終了確定、次batchの遷移先を確認する。
8. Do Nowの実候補条件を記録。今回の案内文が実装を超えていないか確認。
9. Wishlistのschema/文字数/保存エラー/inline formを確認。
   NextStepが本当にProject新規作成かを確定し、title調整の最小案を出す。
10. アプリ内Guideの入口・ファイル・翻訳・旧説明・テストを特定する。
11. 既存の匿名fixtureでBefore撮影・基準testを実行する。
12. 原則1枚のworkreportで事実・採用差分・未決事項・テストcoverageを整理しSTOP。

## このStageで固定する提案

- Builder源泉をNextStep/Wishlistに限定し、Session-only候補を外す範囲。
- 旧dismissは残すが新Builderで適用しない方針と、候補再表示の説明。
- per-row今日へ継続、multi-select新設なし。
- Wishlistは本文のみmodal、NextStepは詳細Projectの能力を維持。
- Today3/Builderの空状態リンクと次batchの遷移先。
- Guideの更新箇所と、Do Nowを再設計しない境界。

報告書にない関数名/データfieldはこのStageで初めて確定する。
大きな意味論の不一致があれば、推測で仕様を足さず、必要な判断をまとめて提示する。

## 成果物

- `docs/phase6.1/workreports/P61-00-report.md`
- `docs/phase6.1/execution-state.json`のbaseline/設計決定欄
- 本パッケージの安全な導入と、必要なら小さい契約テストの案
- Before画像は既存の非追跡QA出力（合成データのみ）

generic test/test:e2eがないことは既知の前提であり、それ自体はblockerではない。
P61-00で基準テストの失敗を発見したら、環境/既存bug/報告との差に分類する。

完了: `WAITING_HUMAN_APPROVAL`。P61-01へ進まない。
