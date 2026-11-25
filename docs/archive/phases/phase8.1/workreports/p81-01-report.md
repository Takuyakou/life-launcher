# Phase 8.1 / Stage 01 作業報告（内部ID: P81-01）

## 結果

Projectを継続テーマの入れ物へ分離する実装が、現在のPhase 8.1作業ツリーに存在することを確認した。Stage 00で承認されたconfig v3移行を前提とする。

状態: `COMPLETE_AWAITING_REVIEW`

## 実装済みの内容

- config v3のProjectは`id`、`name`、`northStar`、`weeklyFocus`、`colorId`をmetadataとして持つ。
- 現在のNextStepと移行保留設定は、それぞれoptionalな`nextStep`、`legacyNextStepSettings`へ分離した。
- Project追加・編集画面は「プロジェクト名」「目標（任意）」「今週の重点」「色」だけを扱う。
- NextStep本文、開始環境、手順書、TimerはProject画面から除外した。
- Project metadata編集は既存Projectを基礎に更新するため、現在のNextStepまたはlegacy pendingを保持する。
- 今週の重点は既存の最大件数guardを継続利用する。
- Phase 8.1対象UIでは旧称「取り組み」ではなく「プロジェクト」を使用する。

## 保存契約

Project追加・編集は既存の`persistConfig`を通す。保存成功時だけダイアログを閉じ、保存失敗時は現在configをrollbackしてdraftを維持する。version、tag、Release操作は含まない。

## 実装根拠

- `src/types.ts`
- `src-tauri/src/models.rs`
- `src/App.tsx`
- `tests/visual/phase8-entry-forms.spec.ts`
- `tests/visual/phase61-wishlist-modal.spec.ts`

## 検証状態

Phase 8.1の最終full gateで、関連回帰を含むPlaywright 246件とRust 112+2件がPASSした。
