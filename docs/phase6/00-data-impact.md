# P6.0 Data Impact

## Current persistence map

| Data                     | Store                                             | Current shape / note                                         |
| ------------------------ | ------------------------------------------------- | ------------------------------------------------------------ |
| Victory                  | `config.json`                                     | `today.victory { text, done }`                               |
| Today3                   | `config.json`                                     | `today.items[]`、最大3へTS/Rust双方でtruncate                |
| Project / NextStep       | `config.json`                                     | `projects[]`内の`nextStep`ほか                               |
| Wishlist                 | `config.json`                                     | `inbox[]`                                                    |
| Today Builder candidates | 独立storeなし                                     | Project、Wishlist先頭、recent Session note等から毎render派生 |
| Today Builder order      | browser `localStorage`                            | candidate key配列                                            |
| Session / Today Activity | `sessions.jsonl`                                  | append log、Today Activityは当日filter                       |
| Section collapse         | React memory、一部sidebar groupのみ`localStorage` | Main accordionはrestartで初期化                              |

`config.json`はschema version 2。Rustはtemp fileへ書いた後renameする。Reactは保存前に表示を更新するため、Rust write失敗時の
on-disk atomicityはあるがUI rollbackはない。

## Today3 schema audit

Current item:

```text
text: string
done: boolean
trigger?: string
projectId?: string
buttonIds?: string[]
instructionPath?: string
instructionOpenOnStart?: boolean
```

不足する情報:

- stable item ID
- completion reason
- completed timestamp
- completed planned duration
- source identity（Project nextStep / Wishlist item等）

現在Timerの`sourceId`はToday indexから作る`today-0`等で、並べ替え・削除後に同じitemを指す保証がない。
completion-derived stateへ変更する前にstable IDが必要である。

## Current completion flow

1. checkbox changeが直接`done`を反転し`config.json`へ保存する。
2. Timer満了はcompletion dialogを開くだけで`done`を変更しない。
3. dialogで終了すると、経過分が1以上ならSessionを作る。
4. 手動停止とTimer切替も1分以上ならSessionを作る。
5. SessionにはToday item ID/source IDが保存されない。

したがってSession creationとToday completionは現在完全に独立している。

## P6.1 migration impact

第一候補:

```text
TodayItem
+ id: string
+ completedAt?: ISO datetime
+ completedTargetMinutes?: integer
  done: boolean (v2 read compatibility; write semanticsをderivedへ変更)
```

必要作業:

- config version migrationで既存Today itemへstable IDを付与する。
- active Timerのsource IDをindexからitem IDへ変更する。
- `reason === complete`かつ予定時間到達済みの時だけ該当itemをcompleteにする。
- manual / switch stopはSession policyだけ適用し、Today itemをcompleteにしない。
- checkboxをread-only statusへ置換する。
- 並べ替え・削除中のactive Timer参照をitem IDで維持する。
- 既存`done: true`はmigration時に完了として保持し、ユーザーデータを戻さない。

「満了dialogが開いた時」か「ユーザーが終了確定した時」かは現在後者でSessionが確定する。データ整合上、Today completionも
終了確定と同じtransaction順に寄せるのが安全。ただしPhase 6文言の解釈として人間確認対象にする。

## Today3 max and duplicate rules

- TypeScript `limitToday`が3件へsliceする。
- Rust config normalizeも3件へtruncateする。
- 直接addは3件を超えないが、同一text duplicateを拒否しない。
- Today BuilderからTodayへは同一textを拒否する。
- Wishlistの`今日へ`はduplicateを拒否せず、追加後sourceを削除する。
- NextStepには現在`今日へ`自体がない。

P6.1ではsource ID優先、legacy itemはnormalized textをfallbackにしたduplicate guardが必要。

## Today Builder limit root cause

監査で「5件上限」は再現しなかった。実際のpipeline:

```text
morning victory suggestion
+ all Project nextSteps
+ config.inbox[0] only
+ recent Session notes
-> trim / exact-text dedupe
-> first 8 only
-> localStorage order sort
-> all rows render
```

| Layer            | Limit found                    | Result                  |
| ---------------- | ------------------------------ | ----------------------- |
| UI input         | text max 120                   | item count上限なし      |
| Reducer/store    | 独立Builder storeなし          | 該当なし                |
| Rust persistence | Wishlist/Project count上限なし | 5件制限なし             |
| Serialization    | config v2 arrays               | 5件制限なし             |
| Migration        | Builder modelなし              | 該当なし                |
| Rendering        | derived候補を8件で打切り       | 実際のcount ceiling     |
| Wishlist source  | `config.inbox[0]`だけ          | 2件目以降が候補に出ない |

自動fixtureでは5件と8件を表示し、8件fixtureはpage reload後も8件へ復元した。ただしこれはsource dataからの再生成であり、
Builder itemそのものが保存されている証明ではない。

## Builder delete ambiguity

Phase 6はcandidateの右クリック削除を要求するが、candidateには複数sourceがある。

| Source                     | Destructive delete risk                                          |
| -------------------------- | ---------------------------------------------------------------- |
| Project nextStep           | Projectの再開地点を消してしまう                                  |
| Wishlist                   | Wishlist itemを消す意味なら理解可能だが、Builder固有削除ではない |
| Session note               | 履歴改変になるため不適切                                         |
| Morning victory suggestion | 前日由来の提案だけを隠す必要がある                               |

推奨はsourceを変更せず、日付単位のdismissed candidate keyを`config.json`へ保存する方式。
別案はBuilderを明示的な独立listへ変更する方式。P6.1開始前にどちらを採用するかhuman decisionが必要。

## Wishlist semantics impact

現在の`moveInboxItemToToday`はTodayへ追加すると同時に`inbox`から削除する。Phase 6のsource remainsへ変えると:

- config migrationは不要。
- handlerからsource削除を外す。
- duplicate guardを追加する。
- Todayが3/3なら既存どおり拒否する。
- 成功/duplicate/fullのfeedbackを統一する。

## Session compatibility

Session schemaはP6.1のToday completionに必須変更ではない。Today item completion metadataをconfig側へ保持すれば、
既存Session logとrecords表示を維持できる。

将来、Sessionから厳密にToday itemを追跡する必要が出た場合のみoptional `sourceId`追加を検討する。v1.1では範囲を広げない。

## Required tests for P6.1

- v2 Today item migrationでstable IDと既存doneを保持。
- 5分/normal満了確定だけcomplete。
- 途中停止、pause、switchは未完了のまま。
- 1分未満/以上のSession policyを維持。
- reorder/delete後もactive Timerが正しいitemを指す。
- Today3 3/3 guardとduplicate guard。
- 3件全完了時だけ次batch actionを表示。
- Builder 6件以上のadd/save/reload/restart restoreと5件pagination。
- Builder delete後のpage補正。
- Wishlist/NextStepの`今日へ`がsourceを残す。
- save failure時の表示整合性。
