# Phase 8.1 / Stage 07 作業報告（内部ID: P81-07）

## 結果

明示的なToday完了後にsource種別で整理する実装が、現在のPhase 8.1作業ツリーに存在することを確認した。完了Reward自体は既実装を再利用し、アニメーションを新規設計していない。

状態: `COMPLETE_AWAITING_REVIEW`

## 実装済みの内容

- 満了終了または早期終了で「完了」を選んだ経路は、Session確定、Today3/config保存、既存Reward、必要なfollow-upの順で処理する。
- 未完了の早期停止ではfollow-upを出さない。1分未満Session契約は既存の記録経路を利用する。
- NextStep由来ではProjectと完了済みToday3 snapshotを残し、現在NextStepを空にしてsource completion snapshotを追加する。
- 同ProjectにWishlistがある場合だけ、Reward後に候補選択、新規入力、「今は決めない」を提示する。
- Wishlist選択はStage 05昇格経路を再利用し、新規入力はNextStep設定画面へ進む。
- Wishlist由来ではToday3だけを先に完了し、Reward後に「完了にする」「まだやりたい」を確認する。
- Wishlist sourceはユーザーが「完了にする」を選んで保存成功した場合だけstable IDで除去し、Today3とSessionを維持する。
- 完了済みカードへの重複処理を避け、follow-upは完了eventからのみ生成する。reload/loadでは再生成しない。

## identity・replacement保護

source種別はcanonical stable source keyで解決し、同一Project内のNextStep世代は`generationId`とToday側の`sourceGenerationId`で照合する。本文一致をsourceまたは世代identityとして使わない。

両generation field欠落はv2由来のlegacy同世代として扱う。新規設定・置換・昇格は新しいgenerationを持ち、編集は既存generationを保持する。古いToday snapshotとreplacementのgenerationが異なる場合、本文が同じでも古い完了はreplacementを空にせず、再snapshotや直接Do Now対応付け、replacement向けfollow-upも行わない。

## 保存失敗

Today3/source更新失敗時はconfigをrollbackし、Reward/follow-upを成功扱いで出さない。先に確定したSessionは削除しない。Wishlist follow-up保存失敗では確認UIを残して再試行する。

## 実装根拠

- `src/completionFollowup.ts`
- `src/App.tsx`
- `tests/visual/phase81-source-followup.spec.ts`
- `tests/visual/phase62-source-lifecycle.spec.ts`
- `tests/visual/phase72-completion-feedback.spec.ts`

## 検証状態

generation境界追加後の最終full gateで、source種別、stable identity、replacement、Reward順、reload非再演、Wishlist保持・完了・保存失敗、未完了早期停止を含むPlaywright 246件がPASSした。
