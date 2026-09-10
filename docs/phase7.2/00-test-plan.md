# P72-00 テスト対応表

`qa/scenarios.json` は指示書の全89 ID・setup/action/expectedを保持した受入仕様。各IDに段階別の追加予定ファイルとtest名prefixを付けた。**P72製品要件のresultは全件NOT_RUN**。既存の部分的な契約検証を、そのまま新機能PASSへ読み替えない。

## 実在テストとの対応

すべて `tests/visual/` 配下。下表は再利用できる既存assertionであり、対応IDの全受入条件を満たすという意味ではない。

| Scenario群 | 実在テスト | 追加が必要な部分 |
| --- | --- | --- |
| SEL-01 | dashboard-disclosure-context.spec.ts:80 | 現行は下層「今日へ」ありを確認。P72-01で契約を反転 |
| SEL-02..07 | phase62-today-layer.spec.ts / phase62-source-lifecycle.spec.ts | source保持・除外・日付は既存。復帰command/再起動/別page/legacy拒否を追加 |
| EDIT-01..07 | phase71-edit-sync.spec.ts:120,156,211,248,285 | 1保存・両方向同期・失敗draft・paused/direct handlerは既存。Builder入口・保存待機start競合を追加 |
| MENU-01..03 | unified-source-layout.spec.ts / phase6-dictionary.spec.ts / ContextMenu.tsx | sourceのellipsisとkeyboardは既存。Today3/Builder/coarse/アンカー消失を追加 |
| EMPTY-01..03 | phase6-main.spec.ts / today3-remove.spec.ts:130 | 既存空状態/次batch。新CTA・候補0・Undo復帰を追加 |
| TOAST-01..09 | today3-remove.spec.ts:116 / phase71-edit-sync.spec.ts | 失敗時成功通知なしは既存。4秒/8秒/OR pause/queue/hidden/focus/正しい同期通知は新規 |
| UNDO-01..12 | today3-remove.spec.ts:40,71,116 / phase62-today-layer.spec.ts | remove/excludeの非破壊・rollbackは既存。Undo自体はすべて新規。並行更新・日付/batch・再除外・ABA拒否を追加 |
| LIST-000..100, EXPAND/BOUNDARY/LAST/ORDER | unified-source-layout.spec.ts / phase6-readiness.spec.ts | 下層件数modeは新規。各0/1/5/6/19/20/21/30/100、境界focus、全体順を検証 |
| LIST-BUILDER | phase6-readiness.spec.ts | 既存5件page/clampを維持。下層の10件化に巻き込まれないこと |
| SIZE-01..04 | phase72-audit.spec.ts / today3-remove.spec.ts:195 | 48x36のbefore証拠は取得。B2変更後の同属性比較・非Today3不変・通常135分開始の確認を追加 |
| DND-01..16 | phase6-main.spec.ts:113,151 / phase6-readiness.spec.ts / phase6-dictionary.spec.ts | 同一覧の保存0→1とrollbackは既存。cross経路、500ms、一時展開取消、page跨ぎ、storage失敗、scroll/DPRを追加 |
| REWARD-01..10 | phase7-early-completion.spec.ts / phase6-main.spec.ts:192,216,240 | 完了判定/Session保存は既存。演出success-only・dedup・3/3・新DoNow誤表示・motionを追加 |
| REG-01..04 | 全test:visual / phase7-copy.spec.ts / phase61-guide.spec.ts / readme-contract.spec.ts | 最終承認済みSHAで全gate・新Guide文言・scope監査を再実行 |

追加予定ファイル名は予定と明記し、実在コマンドは `npm.cmd run test:visual` に統一する。存在しない `npm test` / `test:e2e` を記載しない。

## 今回追加した監査

- phase72-public-safety.spec.ts: 許可された合成成果物だけ通し、未承認パスと許可パス内のダミートークン・個人パスを拒否する回帰1件。
- phase72-audit.spec.ts: 1920/1440/1366/1000/860 CSS px、DPR1、各高さ900。
- 日本語長文、135分、Projectなし・空本文disabledを合成fixtureで生成。
- title/aria-label、opacity、font/color、button/card rect、hover/focusでrect不変、実行中remove disabled、開始ボタン置換をassert。
- 5 JSONと20画像を `screenshots/baseline/` に生成。通常motionのnative tooltip遅延は検証していない。
- 既存today3-removeは短い/長い文面、3/2/1列、保存失敗、active/pausedのhandler直接実行、Session/source保持、reloadを検証する。

## 今後の失敗注入

Tauri mockのsave failure/delay・invokeCallsで保存回数と最新configをassert。localStorageのsetItem例外も別注入。Undoでは無関係field更新後に対象のみを戻し、Rust側競合チェックもunit/integration化する。Session appendとToday保存は別結果としてassertし、Session成功だけでToday完了PASSにしない。

## 実行範囲

今回の基準全自動テストは合成データ、Rust tempdirを使用。実ユーザーconfig/Session・確認用EXEを操作しない。Browser DPR/CSS zoomとWindows native DPIは別物であり、native smoke未実施を明記する。過去のQuickキーボードテストflakeは今回165件初回では再現しなかったが、解決宣言はしない。
