# P72-00 安全契約と最小実装案

これは実装済み仕様ではなく、監査で固定した現状と承認待ちの差分。

## 保存・identity・日付

| 領域 | 現状 | P72で守ること |
| --- | --- | --- |
| canonical source | Project ID / Wishlist stable ID。legacy文面aliasは限定fallback | 復帰はexact stable IDのみ。空NextStep/削除/完了sourceを復活させない |
| Today3 | sourceKey/text/done/開始環境・分数snapshot。独立batch IDなし | ID/done/順を維持。source編集は既存resnapshotSourceを使用 |
| 日付 | Rust models.rs:617 date_key_at、settings.dayStartHour。config.rs:1259で日付更新時除外clear | config.today.dateを操作receiptへ固定。別の午前0時基準を作らない |
| 同期 | 明示保存のみ。button IDsでありaction定義の独立コピーではない | 保存後だけ実際の同期先を通知。履歴は変更しない |
| persistConfig | App:2399。optimistic、参照が同じ時のみrollback。save後に設定再適用 | save成功と設定再適用失敗の境界を区別。後者はdisk保存済みでもfalseとなり得る |
| 外部更新 | config-changedから250ms後refresh。全config置換 | Undo待機中の外部更新を検出しreceiptを再検証/失効 |
| Rust保存 | config.rs:74 mutex→sanitize→backup→write。expected revisionなし | Mutexだけでstale writeを解決したとはしない |

## 操作行列

| 操作 | config差分 | guard / 成功 |
| --- | --- | --- |
| adoptToday | 対象snapshotを指定位置へ1件追加 | latestのmax3/重複/source有効性/同sourceTimer/保存中を再確認。sourceとBuilderを残す |
| restoreCandidate | 当日の対象除外keyを解除、承認後に対象順序のみ更新 | 非表示pageを除外と扱わない。Today3へ自動採用しない |
| editSource | 既存source + linked Today3を1configで保存 | 実行中/paused/確認待ちの同sourceは拒否。保存中のstart guardを維持 |
| removeToday | 対象Today3のみ解除 | 現行はtoday:sourceId一致guard。Project直接起動とのcanonical整合も新Undo経路で検証 |
| excludeCandidate | 除外key追加 + 対応Today3解除 | 同source実行中/paused拒否。保存成功後のみUndoを作る |
| undoRemoval | 対象receiptの逆差分のみ | 下記競合ルール。後続の無関係source・順序・Sessionを戻さない |

現行addCandidateToTodayは末尾追加のみ。closureを保持したまま新drop経路へ流用せず、drop直前にstable IDから再解決する。
sourceEditBlockedはactiveTimerRefを参照。終了処理はactiveTimerを停止後に解除するまで同sourceを保持するが、adopt/remove等すべてが共通guardを使っているわけではない。

## Undo receipt案（P72-02承認待ち）

- operationId、dayKey、runtime batch generation、exact source identity、対象sourceの比較値。
- 元Today3 snapshot（あった場合のみ）、対象除外値、元前後のsource IDs、対象操作generation。
- 古いconfig/Today配列全体は保持・再保存しない。Session/sourceCompletionsは対象外。
- 現行batch永続IDはないため、開始/次batch/日付変更/再読込でruntime generationを更新し旧receipt失効。Undoを再起動後へ持ち越さない。
- 復元位置は元の後続IDの直前、なければ元の先行IDの直後、両方なければ末尾。現在の他項目の相対順を保持。
- 満杯、同sourceTimer実行/paused、source編集/削除/完了、再除外、日付/batch変更は拒否。再採用済みを重複復元しない。
- 対象に対する後続操作generationも比較。同じ値へ戻っただけの再除外を古いUndoで打ち消さない。
- 初回保存失敗: rollback+error、Undo生成なし。Undo保存失敗: 直前状態へrollback、再試行可。二重実行不可。
- 外部window更新は最新fieldを読み、対象前提を再検証。読み直しと保存の間の競合対策として、既存config_write_lock内の対象差分処理/条件付き保存を提案。現行save_configのみなら安全要件はBLOCKED。
- 既存filesystem fallbackのcrash耐性、アプリ外からの直接ファイル書換えは別リスク。全基盤の解決を主張しない。

## Builder順序と一覧

現行 `rawTodayBuilderCandidates` はProject→Wishlistだが、保存された手動順は全候補へsortされ、種別を跨げる。見出しは表示中の種別の切替点に描画される。種別固定グループへ勝手に再編成しない。

現行 `saveTodayBuilderOrder` (App:6200) はlocalStorageにactive全候補keyを書き、例外catchなし。除外で保存順のkeyが消えた場合は復帰位置を保証できない。

提案: configにoptionalなBuilder順序を追加し既存localStorage順を初回だけ取り込む。既存順を保持し、汎用バーdropは全体末尾、候補行dropはそのstable ID前後へ挿入。別pageに復帰した場合は保存成功後に対象pageへ移動。未承認のmigrationは本PRで行わない。

下層は0=空、1-5=全件、6-19=5件/全展開、20以上=10件/page。各一覧別UI stateで永続保存0。19→20は先頭可視/フォーカスIDを含むpage、20→19は対象が先頭5件外なら展開。末尾削除はpageをclamp。保存する全体配列をsliceしない。
Builderは5件/pageのまま。D&D・上下移動は全体stable ID順を操作し、非表示の相対順を保持。

## D&D現状

| 一覧 | pointermove | drop | 不足 |
| --- | --- | --- | --- |
| Today3 | state previewのみ。実矩形hit-test | moveTodayItem→persistConfig | 新cross-target、cleanup統一、端scroll |
| NextStep | state preview + Project auto-scroll | moveProject→persistConfig | 復帰target、blur/lost captureを含む共通cleanup |
| Wishlist | state previewのみ | moveInboxItem→persistConfig | 復帰target、端scroll、indexからIDへの解決 |
| Builder | state previewのみ | moveTodayBuilderCandidate→localStorage | configとのatomic性、保存例外、cross-adoption |

既存開始thresholdは6px、button/input等から開始しない。同一覧D&Dは残す。新経路はBuilder→Today3採用、当日除外source→Builder復帰のみ。下層→Today3直通は禁止。
500ms一時展開はUIのみ。Esc/pointercancel/lost capture/blur/無効dropでtimer・capture・scroll・previewを解放し元開閉へ。drop成功だけ1保存。
v2.1の黄色枠/淡背景/直下案内1回。バー文言は不変。専用previewは操作ボタンなし、pointer-events:none、画面端clamp。挿入線は実矩形から縦横を選択。

## Toast / menu

現行Toastは右下18px、polite live region、textのみ、4200ms後退場開始・200ms後削除。pointer-events:none、pause/action/queue上限なし。
目標は同位置のWarm Rich B、通常4000ms/Undo8000ms、hover OR focus OR hiddenで残時間pause。最大表示3、Undoを通常通知で追い出さず待機中は減算しない。error/retryは別方針を維持。
メニューはContextMenuのrole/menuitem・矢印/Enter/Esc・viewport clampを再利用。現行dismissは生存openerのみfocus復帰、クリック後/アンカー消失時のfallbackを追加対象とする。

## 完了イベント

現行勝利条件: toggleVictoryDone→void persistConfig。Today3早期完了: resolveEarlyStopでSession保存後にdone保存。満了: finishCompletedTimer (App:5320) がToday3を保存してfinishTimerへ進む。ただしcompletionSave.thenはboolean結果を見ておらず、Today3保存falseでもSession終了へ進む。Session終了だけを根拠にToday3成功演出を発火してはいけない。3件すべてdoneだけ次batch可能、1/1や2/2は3/3にしない。
Do NowはrefreshDoNowCandidateによるbackend提案の更新で、独立done storageはない。新演出は終わったsnapshotへ紐付け、新候補にdoneを付けない。
保存結果のsuccess callbackに限定した小さいfeedback層を提案。false→trueだけ、同Session/operation/date/batchをdedup。3件目は節目優先。reload/Undo/編集/D&D/失敗/単に0秒で発火しない。
reduced-motionは静的check/色/文言のみ、overlayは非操作、focusや次操作を奪わない。完了判定・Session最小時間・次batch仕様は変更しない。
