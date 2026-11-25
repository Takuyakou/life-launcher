# Phase 8.1 / Stage 03 作業報告（内部ID: P81-03）

## 結果

Wishlistへ任意のProject所属を追加し、stable identityを維持する実装が、現在のPhase 8.1作業ツリーに存在することを確認した。

状態: `COMPLETE_AWAITING_REVIEW`

## 実装済みの内容

- Wishlistは未所属、または1 Project所属として`projectId`を持てる。
- Wishlist追加画面に「プロジェクト（任意）」を表示する。
- Wishlistセクションからの追加は「プロジェクトなし」で開始する。
- Project領域の「やりたいことを追加」から開いた場合は、そのProjectを初期選択する。
- 保存前にProject選択を変更できる。
- 一覧とToday Builderでは、所属済み項目に小さなProject色・名称を表示する。
- 追加時はstable IDを発行し、編集時は既存IDを保持する。同じ本文をidentityとして扱わない。

## 保存・snapshot契約

Wishlist追加・編集は既存config保存とrollbackを利用する。Today3への採用はWishlist stable IDを含むsource keyで判定し、採用時snapshotと元Wishlistを分離して保持する。

## 実装根拠

- `src/types.ts`
- `src/App.tsx`
- `tests/visual/phase61-wishlist-modal.spec.ts`
- `tests/visual/phase6-main.spec.ts`
- `tests/visual/phase71-edit-sync.spec.ts`

## 検証状態

Phase 8.1の最終full gateで、任意Project所属、stable ID、同文面分離を含む関連回帰がPASSした。
