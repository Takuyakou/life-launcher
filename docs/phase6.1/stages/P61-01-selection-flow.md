# P61-01 — 登録経路とBuilder参照ビューの整理

前提: P61-00の正確なheadと提案仕様が人間承認済み。
branch案: `feature/p61-01-selection-flow`。baseはWORKFLOWに従う。
参照: SPECIFICATION§1〜8、TEST-MATRIXのFLOW/DATA/KEEP。

## 実装範囲

1. Today3/Builderの新規登録の＋追加を削除。
   headerだけでなく重複のbody、empty-state、keyboard/menu導線を確認。
   勝利条件/NextStep/Wishlist/Quickの必要な追加・編集は残す。
2. Builderの勝利条件等を選ぶ送付先selectを削り、採用操作は`今日へ`にする。
   既存の採用処理へ接続し、勝利条件データを変更しない。
3. 既存candidate derivationを最小修正し、承認したsource型だけを表示。
   第二の候補保存配列やstaging DBを作らない。
4. Builderの削除/dismiss操作を除去し、旧dismissによる不可視候補が残らないようにする。
   旧データを消さない。旧dismissがあるconfigの互換テストを追加。
5. 5件pagination、全候補表示、page clamp、出所・stable keyを維持。
6. Today3/source側/Builder側の今日へが同じduplicate/上限/rollback契約を持つことを確認。
   元項目を削除しない。既存Today3のsnapshotやSessionを不意に更新しない。
7. Today3が空なら候補ビューへ案内。sourceが0なら登録元へ案内。
8. 次batch開始後はBuilderを展開/focus。削除した登録dialogへ遷移しない。
9. 変わった動作だけcurrent-specへ追記し、旧Phase6の履歴は書き換えない。

## UI条件

- 「今日の3件」は3列カードのまま、補助headerと同化させない。
- タイトル/追加/件数/説明の好きな近接配置は維持。
- 上位sectionに空の＋追加スペースやdisabledの旧buttonを残さない。
- `今日へ`の意味はどこからでもToday3への採用。Builderへの登録と混同させない。
- sourceの常設編集buttonは増やさず、既存のcontext-menu編集を残す。
- 登録後・ページ移動で勝手にtimer開始、勝利条件確定、候補自動補充をしない。

## 検証

関連browser試験、lint/build/public checkを実行。
schema/Rust側を変更した場合は関連Rust試験も実行。
Timerの終了確定・manual stop・次batch・旧データ・save failureを含む基準回帰を通す。
廃止される「Builder＋追加」等の旧assertionは、削除と新導線の試験へ置換して対応を記録。

## 完了報告

削除した入口、維持した入口、selectの旧役割、source型、dismiss互換、
今日へ経路、空状態、次batch遷移、保存失敗、Before/After、テスト結果を記録。

PR作成後STOP。Wishlist modalとGuide全文更新をこのStageへ混ぜない。
