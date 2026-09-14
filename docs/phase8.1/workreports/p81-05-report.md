# Phase 8.1 / Stage 05 作業報告（内部ID: P81-05）

## 結果

WishlistをNextStepへ明示的に昇格する実装が、現在のPhase 8.1作業ツリーに存在することを確認した。

状態: `COMPLETE_AWAITING_REVIEW`

## 実装済みの内容

- Wishlistのcontext menuから「次の一手にする」を選び、NextStep専用画面で確認してから保存する。
- Project所属Wishlistは所属Projectを固定する。
- 未所属WishlistはProject選択を必須とし、アプリがProjectを推測しない。
- 元Wishlistはstable IDで特定する。IDがない、元項目が消失した、所属Projectが見つからない場合は安全に拒否する。
- 既存NextStepがある場合は現在の本文と「現在の次の一手を置き換えます」を表示し、置換確認を保存条件とする。
- 開始環境・手順書・Timer overrideは旧Wishlistや旧NextStepから自動継承せず、Stage 02のreset契約を使う。
- 昇格で作るNextStepにはstableな新しい`generationId`を付け、同Projectの旧Today snapshotと分離する。`sourceKey`は`project:{id}`のまま変更しない。
- 移行pendingがある空Projectを選んだ場合だけ、Stage 02の明示的なinherit/discard選択を使う。

## 保存契約

対象ProjectのNextStep設定と、対象Wishlist stable IDの除去を1回のconfig保存で確定する。保存前・キャンセル時は元Wishlistを保持する。保存失敗時は両方をrollbackし、draftを維持する。

既存Today3 snapshot、Session、source completionを昇格に伴って書き換えない。Builder候補は保存後のcanonical sourcesから導出する。

## 実装根拠

- `src/App.tsx`のWishlist昇格、Project選択、置換確認、NextStep保存処理
- `src/types.ts`のProject/NextStep/Wishlist契約
- `src/sourceEdit.ts`のsource/snapshot境界

## 検証状態

Phase 8.1の最終full gateで、昇格、置換確認、キャンセル、保存失敗、既存Today3/Session保持の関連回帰がPASSした。
