# Phase 8.1 / Stage 02 作業報告（内部ID: P81-02）

## 結果

NextStepをProjectごとの「今進める0〜1件」と実行設定のまとまりにする実装が、現在のPhase 8.1作業ツリーに存在することを確認した。

状態: `COMPLETE_AWAITING_REVIEW`

## 実装済みの内容

- `NextStepV3`は本文、始めるきっかけ、鮮度時刻、開始環境、開始メモ、手順書、手順書自動表示、短時間・通常Timer、optionalな`generationId`を所有する。
- NextStep専用画面はProject、次の一手、始めるきっかけ、開始環境、手順書、Timerを表示する。
- Project文脈から開いた場合は対象Projectを固定する。
- 開始環境と手順書は既存Pickerを利用し、Timerは1〜240分の範囲を検証する。
- 同じsourceのTimerがrunningまたはpausedのとき、編集入口と保存handlerの両方で拒否する。
- 既存NextStepの明示編集は既存source編集契約を使い、採用中の同source Today3だけを明示的に再snapshotする。
- 新規設定・置換・Wishlist昇格は古いToday3 snapshotを遡及更新しない。
- 最終レビューの世代境界拡張では、新規設定・置換・Wishlist昇格がstable generationを生成し、既存NextStep編集は同じgenerationを保持する。config versionと`project:{id}` source keyは変更しない。

## reset契約

新規設定または置換では、開始環境と手順書を空、手順書自動表示をOFF、Timer overrideを未設定として全体設定へ戻す。旧NextStepの実行設定を自動継承しない。

例外はv2移行で作られた`legacyNextStepSettings`だけである。NextStep未設定Projectにpendingがある場合、`引き継ぐ`または`破棄して全体設定を使う`の選択を必須とする。キャンセル・保存失敗ではpendingを保持し、保存成功時だけ新NextStepと同じconfig保存で削除する。

## 実装根拠

- `src/types.ts`
- `src-tauri/src/models.rs`
- `src/App.tsx`
- `src/sourceEdit.ts`
- `tests/visual/phase8-entry-forms.spec.ts`
- `tests/visual/phase71-edit-sync.spec.ts`

## 検証状態

Phase 8.1の最終full gateで、legacy pending、Timer guard、保存契約を含む関連回帰がPASSした。
