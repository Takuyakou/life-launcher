# P71-01 Source Edit Sync

Base: docs/p71-00-edit-sync-audit。監査PRをマージせずstackした。

- Today3編集はcanonical Project/Wishlist editorを開く。曖昧な旧alias/orphanは解決しない。
- sourceEdit.tsにidentity解決、Timer対応、実行field再snapshotを集約。現在のToday3だけ更新しsourceKey/done/orderを保持する。
- sourceとTodayを一つのconfigへまとめて保存。失敗時は既存rollbackを使い、draftを維持し成功後だけ閉じる。
- Wishlistはstable IDで保存時に再検索。同文別IDを区別する。
- UIとhandlerで同source running/paused/確認中の編集を拒否。保存中の同source開始も拒否。
- legacy aliasのcanonical解決が複数になる場合と重複Todayは保存しない。
- Session/history、D&D、早期完了の式、Release/versionは変更しない。

検証: build/lint PASS。P71テスト6件PASS (監査2、同期4)。初回2件の操作テスト失敗は入力/一時停止の既存アクセシブル名を修正して解消。
最終全回帰はP71-03で実施。既存保存のcrash atomic性・他windowの同時write問題は監査記載の制約を維持。
