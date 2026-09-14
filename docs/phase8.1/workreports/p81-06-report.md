# Phase 8.1 / Stage 06 作業報告（内部ID: P81-06）

## 結果

Today3からToday Builderへの逆D&DはPhase 8.1開始前に実装済みである。現行コードの経路を監査し、Phase 8.1では再実装・再設計せず、回帰対象として維持する。

状態: `COMPLETE_AWAITING_REVIEW`

## 維持する既存動作

- Today3 dragが既存thresholdへ達した時点で、解除可能なToday Builderを黄色で誘導する。
- Builderバーの通常説明を維持し、バー直下に「↓ ここにドロップして今日の3件から外す」を表示する。
- Builderへのdropはsource移動ではなくToday3採用解除であり、既存の「今日の3件から外す」handlerを再利用する。
- source Project/Wishlist、Builder候補、Session、source completionを残す。
- 同source Timerがrunning/pausedの場合は解除先として誘導せず、handlerでも解除を拒否する。
- 完了済みToday3カードは解除できる。
- Today3内へ戻った場合は既存insert markerによる並べ替えを維持する。
- 解除成功後は既存右下Toast「今日の3件から外しました」と「元に戻す」を使用する。
- Undoは最新configへの対象単位の逆差分であり、保存失敗はrollbackする。
- 採用済みToday snapshotのoptional `sourceGenerationId`は解除・Undoで保持し、sourceや過去Sessionへ遡及生成しない。

## 実装根拠

- `src/App.tsx`のToday3 pointer drag、Builder解除target、採用解除handler
- `src/styles.css`のBuilder誘導と挿入線
- `tests/visual/phase72-cross-dnd.spec.ts`
- `tests/visual/today3-remove.spec.ts`
- `tests/visual/phase6-main.spec.ts`

## 検証状態

Phase 8.1 schema移行後の最終full gateで、逆D&D、Timer guard、Undo、保存失敗、Today3並べ替えの関連回帰がPASSした。
