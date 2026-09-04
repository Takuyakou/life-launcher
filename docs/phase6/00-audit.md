# P6.0 Repository Audit

## Scope

Phase 6実装前の`main`を、source commit
`1b0459d3f0b637e2aad4143429a6ea304effe917`で監査した。製品挙動は変更していない。
詳細な操作一覧は[00-ui-action-inventory.md](./00-ui-action-inventory.md)、データ影響は
[00-data-impact.md](./00-data-impact.md)、撮影結果は
[00-visual-baseline.md](./00-visual-baseline.md)を参照する。

## Executive findings

1. Mainのsection順はPhase 6推奨順と一致している。
2. Today3の`done`は手動checkbox由来で、Timer満了とは連動していない。
3. Today Builderに「保存5件上限」はない。候補生成時の8件上限と、Wishlistを先頭1件しか参照しない制限がある。
4. NextStep cardは条件付きTimer開始を持ち、Phase 6の「再開地点であって実行場所ではない」と衝突する。
5. Wishlistの`今日へ`はsourceを残さず削除する。Phase 6のcopy semanticsと逆である。
6. Dictionaryの固定category（すべて・未分類）だけselected色を意図的に消すCSSがあり、custom categoryと意味が不統一である。
7. Quick/DictionaryのExplorer表示は実装可能だが、既存の手順書用commandはroot制約が異なるため直接流用できない。
8. window別Tauri capabilityは既に分離され、現行permissionはコード上すべて利用されている。P6.0では削除しない。

## Main section matrix

| Section        | Component / DOM              | State source                                                         | Persistence                              | Add                                 | Edit                                    | Delete                 | Timer                                     | Context menu           | Collapse     | Keyboard                          |
| -------------- | ---------------------------- | -------------------------------------------------------------------- | ---------------------------------------- | ----------------------------------- | --------------------------------------- | ---------------------- | ----------------------------------------- | ---------------------- | ------------ | --------------------------------- |
| Victory        | `App` / `.victoryBar`        | `config.today.victory`                                               | `config.json`                            | empty時inline入力、候補chip         | inline入力                              | textを空にする以外なし | なし                                      | なし                   | なし         | checkbox、入力Enter/Escapeでblur  |
| Do Now         | `App` / `.doNowBand`         | Rust `load_do_now_candidates` + `config.projects`、選択indexはmemory | Projectは`config.json`、選択候補は非永続 | なし                                | Project modalへの導線                   | なし                   | short / normal                            | なし                   | なし         | native button操作                 |
| Today3         | `App` / `.focusBand`         | `config.today.items`                                                 | `config.json`                            | inline form、最大3                  | text / triggerをinline編集              | context menu           | short / normal                            | 上へ、下へ、削除       | なし         | rowからShift+F10/Menu、各control  |
| Today Builder  | `App` / `.todayBuilderBand`  | Project nextStep、Wishlist先頭、recent Session note等の派生配列      | sourceは各保存先、並びだけ`localStorage` | inline formだが実体はWishlistへ追加 | なし                                    | なし                   | なし                                      | 上へ、下へ             | memory state | disclosure、rowからShift+F10/Menu |
| NextStep       | `App` / `.projectsBand`      | `config.projects`                                                    | `config.json`                            | Project全体のmodal                  | pencilまたはcontext menuでProject modal | context menu           | action/手順書があるcardだけshort / normal | 上へ、下へ、編集、削除 | なし         | cardからShift+F10/Menu、各control |
| Wishlist       | `App` / `.inboxBand`         | `config.inbox`                                                       | `config.json`                            | inline form                         | 専用modal                               | context menu           | なし                                      | 上へ、下へ、編集、削除 | memory state | disclosure、rowからShift+F10/Menu |
| Today Activity | `App` / `.todayActivityBand` | `sessions.jsonl`の当日filter                                         | `sessions.jsonl`                         | なし                                | なし                                    | なし                   | なし                                      | なし                   | memory state | disclosure button                 |

`persistConfig`はUIを先に更新してからRust保存を行うoptimistic updateで、保存失敗時に旧表示へrollbackしない。
これはP6.0では変更しないが、並べ替えを含む保存エラー設計の既存制約である。

## Main hierarchy and density

現在順は次の通りで、Phase 6の推奨順と一致する。

```text
今日の勝利条件
今やる一手
今日の3件
今日を組み立てる
次の一手
やりたいこと
今日の実行
```

責務の見え方には次のズレがある。

- Today3はlist rowであり、最大3件のactive execution setという強さが弱い。
- NextStepは大きなcardとTimerを持ち、Do Now/Today3と実行導線が競合する。
- Today Builderは全候補を展開し、件数が増えるほどMainを縦に押し下げる。
- NextStepだけaccordionではなく常時展開される。
- Wishlist / Today Activityは既にcompact accordionに近い。

## Session audit

| Case                  | Current behavior                                          | Phase 6との関係                          |
| --------------------- | --------------------------------------------------------- | ---------------------------------------- |
| 手動停止、経過1分未満 | `Math.floor`後に0分ならSessionを作らない                  | 一致                                     |
| 手動停止、経過1分以上 | 経過分を`record_session`へ送りSessionを作る               | 一致                                     |
| Timer予定時間到達     | 満了dialogを出し、ユーザーが終了確定した時にSessionを作る | 「満了」の判定点をP6.1で明示する必要あり |
| 別Timer開始           | 旧Timerを`switch`理由で終了し、1分以上ならSession化       | 既存挙動維持対象                         |
| 15分続ける            | 同じTimerのtargetを15分延長                               | 新規start entryではない                  |

Rust `record_session`自体は`minutes > 0`を受け入れる。1分未満を除外するpolicyはReact側にある。
Session日付とTodayの日付resetはいずれも`dayStartHour`を引いた共通`today_date`を使う。

## Tauri capability audit

| Window                      | Current permissions                                                                                                                                                | Required by current code                                                                        | Unused / candidate removal | P6.0 result |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------- | ----------- |
| `main`                      | `core:default`; webview create; window close/hide/position/size/focus/focusable/always-on-top/unminimize/show; window-state restore/save; autostart enable/disable | auxiliary window生成・配置・表示・復旧、失敗時close、mini切替、instruction pin、設定のautostart | なし                       | KEEP        |
| `dictionary`                | `core:default`; hide/focus/start-dragging/start-resize-dragging; window-state save                                                                                 | 自身のclose相当hide、focus lock、title drag、8方向resize、bounds保存                            | なし                       | KEEP        |
| `life-launcher-instruction` | `core:default`; destroy; set-always-on-top                                                                                                                         | viewer closeとpin toggle                                                                        | なし                       | KEEP        |
| `life-launcher-mini`        | `core:default`; start-dragging                                                                                                                                     | mini title/body drag                                                                            | なし                       | KEEP        |

`src-tauri/tests/capability_contract.rs`がwindow labelとpermission集合を完全一致で固定し、opener/global-shortcutの不要付与も拒否している。
Explorer revealをRust commandとして追加する場合、webviewへ`opener:*`を付与する必要はない。

## Explorer reveal feasibility

既存`reveal_instruction_in_explorer`は次を備える。

- configured instruction root内であることの検証
- `.md` / `.txt` / `.html`制限
- Windows限定分岐
- `Command::new("explorer.exe").arg(path)`による引数分離
- spawn errorの返却

ただしlauncher targetはinstruction root外が正常であり、このvalidatorは再利用できない。
P6.2ではlocal actionをRust側で型別に解決し、環境変数展開、存在確認、canonicalization後に扱う専用commandが妥当である。
fileはselect、folderはopen、URL/special/multiple ambiguous targetsはmenu非表示を第一候補とする。
shell文字列連結は不要であり、行わない。

## Dictionary keyboard audit

- Tileは`button`を`li`内に置き、選択tileだけ`tabIndex=0`のroving形を持つ。
- 実際のarrow処理はsearch inputのUp/Downにだけあり、tile focus時の四方向移動はない。
- searchのUp/Downは一次元indexを循環し、CSS gridの視覚列数を考慮しない。
- Categoryはselected tabだけ`tabIndex=0`で、Left/Right/Home/Endは実装済み。
- Category Downからtile、上端tile Upからcategoryへの移動はない。
- Enterは通常button clickで起動できる。
- Shift+F10/Menu keyはtileとcustom categoryでcontext menuへ到達できる。
- Escはdrag cancel、search clear、window hideの順で処理される。
- `ResizeObserver`はdrag previewの再計算に使うが、keyboard grid navigation計算は存在しない。
- Gridは`repeat(auto-fill, minmax(min(104px, 100%), 1fr))`なので、P6.2ではDOM矩形から上下の最近傍を選ぶ方式がresizeに強い。

推奨roving strategyは、tile IDをactive stateとして保持し、Left/Rightは同一視覚行、Up/Downは中心Xが最も近い隣接行を
`getBoundingClientRect()`で決める方式。categoryとtile間は明示的にfocusを移し、search選択indexとは分離する。

## Confirmed specification mismatches

| Topic             | Phase 6 premise       | Current code                                       | Gate for next stage                              |
| ----------------- | --------------------- | -------------------------------------------------- | ------------------------------------------------ |
| Today3 completion | planned Timer満了のみ | 手動checkboxのみ                                   | stable item identityとcompletion writeを設計する |
| Builder limit     | 5件以上登録不可       | 派生候補8件cap、Wishlist参照は先頭1件              | 「保存対象」と「候補source」の意味を決める       |
| NextStep timer    | REMOVE                | conditional short/normalあり                       | P6.1で削除                                       |
| Wishlist 今日へ   | source remains        | Today追加後にWishlistから削除                      | copyへ変更しduplicate guard追加                  |
| Add UX reference  | NextStep flowを基準   | Project全項目modal、initial focus/Enter submitなし | 共通interactionとdomain formを分離する           |
| Builder delete    | itemを削除            | menuは上下移動のみ。派生sourceの削除意味も不明     | source削除か候補dismissか決定する                |
| Category selected | 全category同一        | fixed categoryだけselected色を消す                 | P6.2でstate priority統一                         |

P6.1着手前に特に必要な判断は、Today Builderの永続対象とdelete semanticsである。その他はPhase 6本文から実装方向を確定できる。
