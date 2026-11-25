# P71-00 Edit Sync Contract

## Baseline / Status

監査基準: origin/main `d2b52739c82e3934174f54aafa29f6f9e30b27ac`。
製品コード変更なし。以下の「設計」はP71-01の実装契約であり、実装済みではない。
P7.2 Guide同期PR #32は未マージ。P71は独立したPhase 7.1であり、旧P7.1とは別の番号体系。

## Identity

| Source | Canonical | Today sourceKey | 現行editor |
| --- | --- | --- | --- |
| NextStep | projects[].id / nextStep | project:{id} | openProjectEditDialog / saveProjectEdit |
| Wishlist | inbox[].id | wishlist:{id} | beginInboxEdit / commitInboxEdit |

根拠: src/App.tsx:608-680, 5615-5660, 5922-6030; src/types.ts:100-151。
Today3自体に独立idやbatchIdはない。sourceKeyをReact key/Timer identityに使い、配列位置がorder、today.dateと現在のitems集合が当日の採用枠を表す。
Wishlist editorは現在indexを保持している。保存時はstable IDで最新configから対象を引き直す設計に変更する。項目が消えた場合は別indexへ保存しない。

### Legacy / Ambiguity

- sourceKeyなしTodayはRust読込時にproject:{projectId}またはlegacy:{date}:{index}へ補完され、重複は末尾:2等で区別される (config.rs:2070)。文字列のsuffixを除いてsourceへ結び直してはならない。
- Wishlist IDなしはlegacy-Nへ補完される。旧text-based alias `wishlist:{projectId|none}:{text}` は存在し、同文項目も許される。
- 解決順はexact stable identity優先。一意な旧aliasのみ後方互換対応を検討し、曖昧・orphan・manual/legacy不明は編集不可。text/projectId一致だけで推測しない。
- canonicalが一意でも、複数Todayが同じcanonicalへ解決される異常状態は保存を拒否し通知する。通常採用は同source重複禁止・max3 (App.tsx:5820)。IDを作り直して修復しない。

## Resnapshot Design

NextStep/Wishlistがcanonical、Today3はactive execution snapshot。Today右クリックはsource editorを開く。
明示的なsource編集保存時に、新しいsourceから候補を生成し、現在のlinked Todayへ実行関連fieldだけを置換する。常時live bindingはしない。
同期対象は現在のtoday.items。完了済みでも現在枠内なら対象に含み、doneは保持する。過去Session/historyは対象外。
Project編集はproject:{id}採用を同期する。単に同projectIdを持つWishlistは別sourceなので巻き込まない。Wishlist自身の保存時に、その時点の関連Project/default設定から分数を再解決する。
空のnextStepへの編集もsource編集として扱い、source削除/完了に読み替えない。空Todayの開始不可という既存制約を維持し、done/orderを変えない。
外部config再読込・global設定変更・button action編集は今回のsource editor保存ではなく、全Today resnapshotを起動しない。
満了ダイアログのupdateCompletionNextStep (App.tsx:5350) も別mutation経路。タイマーがまだactiveの間の直接更新を放置しない。P71-01で共通guardへ接続し、終了確定前の編集は拒否する。

## Timer Guard Design

現行isTimerActiveForSourceはsource完了/削除で使用されるが、編集開始/保存には未適用。
activeTimerRef.currentのsourceIdを使い、Today経由 `today:{sourceKey}` とDoNowのprojectIdをcanonical identityへ解決する。単にtimer.projectIdが同じだけではWishlistまでblockしない。
running、paused、満了確認待ち、早期終了確認待ち、Session確定中を含め、対象sourceが解放されるまで編集不可。
UI disabled理由は「タイマーを停止してから編集してください」。Today/NextStep/Wishlistの各入口とmutation handlerで同じ判定を使う。
editorを開いた後に同source Timerが始まった場合もsave時に拒否する。別source Timerは許可。保存中は同source開始も競合させないため、source単位の同期busy guardを設ける。
running Timerのlabel/note/targetMinutes/開始済みactionsを変更しない。開始時のtargetMinutes等はActiveTimerに保持される (App.tsx:137, 5185)。

## Save Transaction

- source + linked Todayを最新configRefから一つのnextConfigに組み立て、一回だけpersistConfigへ渡せる。Session APIは呼ばない。
- 現行persistConfigはoptimistic更新し、失敗時は自分の更新が最新の場合だけpreviousConfigへ戻す (App.tsx:2395)。全writerの競合制御やversion/CASはない。
- 設計: submit同期guard、await保存、成功後だけclose/成功toast。失敗時はsource/Todayをまとめてrollbackし、draftを残して再試行。同sourceの二重submit・開始との競合を拒否する。
- 現行Projectは保存前close+成功toast、Wishlistは保存前draft破棄。いずれも変更が必要。
- Rust save_configはmutex→sanitize→backup→write_config (config.rs:74)。一config文書としての更新は可能だが、複数writerの古いconfig上書きはmutexだけで防げない。
- write_configはtemp→rename、失敗時は旧file削除→rename (config.rs:610)。Windowsの後者はcrash-atomicではない。単一IPCの論理的一括更新と完全な耐障害transactionを混同しない。既存backupはあるが自動rollbackを保証しない。

## Regression Requirements

両sourceの編集→linked Todayだけ更新、Todayから同じeditor、削除した任意fieldが残らない、stable ID/order/date/done保持、Session/history不変、同文Wishlist分離、orphan/重複拒否、paused/DoNow/早期確認中guard、直接handler拒否、save failure/retry/二重submit、開始との競合、reload、D&D rollback、source完了/削除、no refillをP71-01以降で検証する。

既存snapshot固定の外部再読込テストは維持する。明示編集保存のみ再snapshotする新テストを別に追加し、従来テストの期待値を一律変更しない。
