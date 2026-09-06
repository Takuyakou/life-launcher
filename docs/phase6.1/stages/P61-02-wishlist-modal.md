# P61-02 — Wishlist登録モーダルと作成対象の明確化

前提: P61-01承認済み。
branch案: `feature/p61-02-wishlist-modal`。
参照: SPECIFICATION§9〜10、TEST-MATRIXのFORM。

## 実装範囲

1. Wishlist headerの＋追加からmodalを開く。
2. 行内入力/行内追加button/×の旧登録UIを撤去する。
3. 既存の本文field・validator・ID・保存処理を使用し、新fieldを増やさない。
4. NextStep詳細dialogの良い操作文法を再利用。
   初期focus、footer、キャンセル/保存、Esc、validation、保存中/失敗時、focus returnを揃える。
5. 入力は必要最小限。NextStepのProject項目をWishlistへコピーしない。
6. NextStepの追加handlerがProject作成と確定した場合、title/名前label/補足を調整。
   詳細Project登録、任意の北極星・重点・手順書・起動actionの設定能力を削らない。
7. Guide更新に渡すラベル差分を記録し、current-specの該当箇所を更新。

## 共通化の範囲

共有できるdialog shellだけ小さく再利用。
WishlistとProjectに巨大なunion schemaを作ったり、全アプリのdialogを再設計しない。
既存のcontext-menu編集が同じフォームを利用する場合は、追加/編集でIDが変わらないようにする。
対象外のmodal挙動を変更しない。

ui-ux-pro-max-skillが作業環境に既にある場合は、登録modalの密度/focus/ボタン階層の
補助レビューへ使ってよい。使用した実体・採否を記録。利用できない場合は未使用と明記し、
自動ダウンロードやUI framework導入はしない。skill提案は製品の判断より下位。

## 検証

日本語IME、Enter/Esc、空/長文、二重click、保存失敗と再試行、focus return、
Wishlist登録→Builder反映→今日へ、既存Project編集を自動確認する。
860/1366/1440/1920pxでmodalの重なり・縦overflow・button見切れを確認。
NextStepの大きいdialogの高さをWishlistへ機械的に合わせない。

## 完了報告

modal入力項目、再利用部分、実際の作成先、確定したラベル、失敗時UI、
Guideへの申し送り、検証結果、代表Before/Afterを記録。

PR作成後STOP。Guideの本更新はP61-03で実際のUIを確認して行う。
