# P6.0 UI Action Inventory

## Timer start entries

| Surface                 | Current entry                   | Availability                              | Classification | Reason                                |
| ----------------------- | ------------------------------- | ----------------------------------------- | -------------- | ------------------------------------- |
| Do Now                  | short / normal                  | 推薦Projectがある時                       | KEEP           | Mainで最も強い実行導線                |
| Today3                  | short / normal per item         | textがある時                              | KEEP           | active execution setの実行導線        |
| NextStep                | short / normal per Project card | button actionまたは自動open手順書がある時 | REMOVE         | 再開地点の一覧へ責務を戻す            |
| Weekly freshness review | `短時間で試す`                  | 14日以上同じNextStepのreview時            | KEEP           | Main通常flow外の明示的recovery action |
| Timer completion dialog | `15分続ける`                    | 予定時間到達時                            | KEEP           | 同一Timerの延長で、新規startではない  |
| Sidebar timer panel     | なし                            | -                                         | KEEP           | status/pause/finish専用               |
| Mini timer              | なし                            | -                                         | KEEP           | status/pause/finish専用               |

Do Nowの14日以上空いたProjectは通常buttonが自動的に短時間化するのではなく、表示上のprimary/recommended actionが短時間になる。
normal action自体は残る。

## Add UX comparison

| Item              | NextStep                                             | Wishlist                                  | Today3                               | Today Builder                             |
| ----------------- | ---------------------------------------------------- | ----------------------------------------- | ------------------------------------ | ----------------------------------------- |
| Open              | header `追加`でProject modal                         | header iconまたはbody `追加`でinline form | header `追加`でinline form           | header iconまたはbody `追加`でinline form |
| Input             | Project名、NextStepほか多数                          | textのみ                                  | textのみ                             | textのみ、保存先はWishlist                |
| Project selection | 新規Projectそのもの                                  | add時なし                                 | add時なし                            | add時なし                                 |
| Confirm           | modal末尾`保存`                                      | `追加`                                    | `追加`                               | `追加`                                    |
| Cancel            | explicit button、Esc、backdrop                       | Esc                                       | Esc                                  | Esc                                       |
| Enter             | formではないためsubmitしない                         | form submit                               | form submit                          | form submit                               |
| Escape            | global modal dismiss                                 | draft clear + close                       | draft clear + close                  | draft clear + close                       |
| Initial focus     | focus trapの最初のcontrolへ移るが明示`autoFocus`なし | `autoFocus`                               | `autoFocus`                          | `autoFocus` + effect                      |
| Validation        | Project名必須、timer 1-240、toast                    | emptyでbutton disabled                    | empty disabled、最大3でopen disabled | empty disabled                            |
| Duplicate         | Project ID生成で衝突回避                             | text duplicate許可                        | text duplicate許可                   | Wishlistに同文があればno-op               |
| Error             | toast                                                | save失敗toast                             | save失敗toast                        | save失敗toast                             |

現行NextStep addはinteraction referenceとしてそのまま共通化できない。P6.1では「modal/formのfocus・Enter・Escape・validation grammar」を
共通化し、Project/Today/Wishlistの入力項目は別に保つ必要がある。

## Current context menus

| Surface       | Target                      | Menu items                                 | Keyboard access        | Explorer reveal now |
| ------------- | --------------------------- | ------------------------------------------ | ---------------------- | ------------------- |
| Quick sidebar | launcher button             | 上へ、下へ、編集、削除                     | Shift+F10 / Menu       | なし                |
| Quick sidebar | group/header                | グループ追加、上へ、下へ、名前変更、削除   | headerによってmenu起動 | なし                |
| Dictionary    | launcher tile/search result | 前へ、後ろへ、サイドバーに追加、編集、削除 | Shift+F10 / Menu       | なし                |
| Dictionary    | custom category             | 上へ、下へ、名前変更、ページ削除           | Shift+F10 / Menu       | 対象外              |
| NextStep      | Project card                | 上へ、下へ、編集、削除                     | Shift+F10 / Menu       | 対象外              |
| Wishlist      | item row                    | 上へ、下へ、編集、削除                     | Shift+F10 / Menu       | 対象外              |
| Today Builder | candidate row               | 上へ、下へ                                 | Shift+F10 / Menu       | 対象外              |

Mainのlauncher buttonとDictionary tileは同じ`LauncherButton.actions`を参照するが、menu実装は別である。
P6.2で共通の`reveal target`判定を純粋関数化し、両menuから同じ可否を使うのが安全である。

## Registered launcher item types

`LauncherButton`は単一typeではなく、0件以上のactionsを保持する。1 buttonに複数actionを登録できる。

| Action type          | Stored target                | Launch implementation                              | Reveal | Semantics                         |
| -------------------- | ---------------------------- | -------------------------------------------------- | ------ | --------------------------------- |
| `open_app`           | `payload.path`, `args[]`     | env展開、存在確認、`Command::new(path).args(args)` | YES    | executable fileをExplorerでselect |
| `open_file`          | `payload.path`               | env展開、存在確認、Rust側opener                    | YES    | fileをExplorerでselect            |
| `open_folder`        | `payload.path`               | env展開、存在確認、Rust側opener                    | YES    | folderをExplorerでopen            |
| `run_script`         | `payload.path`, `args[]`     | extension別にPowerShell/cmd/direct process         | YES    | script fileをExplorerでselect     |
| `open_url`           | `payload.url`                | Rust側opener                                       | NO     | menu非表示                        |
| `open_shell_special` | enum item、現在はRecycle Bin | Windows Shell API                                  | NO     | filesystem pathとして解決しない   |

### Shortcut and instruction notes

- `.lnk`は登録時に解決され、保存時はtargetに応じた`open_app` / `open_folder` / `open_file`になる。
  元shortcut pathはactionに残らないため、Revealは解決済みtargetを対象にする。
- `iconSource`はicon抽出元であり、Reveal targetには使わない。
- Project/Today/Wishlistの`instructionPath`はlauncher actionではなく別fieldで、今回のQuick/Dictionary対象外。
- schema外のunknown actionはTypeScript/Rust deserializeで正規itemとして扱えない。
- action 0件、local target 0件、local targetが複数で曖昧なbuttonではRevealを表示しない。

## Existing open actions outside context menus

- Launcher buttonの通常click: 全actionsを登録順に実行する。
- Project/Today/WishlistのTimer開始: 関連button actionsを実行し、設定時は手順書を開く。
- Instruction viewer: fileの既定editor、folder open、Explorer表示が既にある。
- Dictionary tile: click / Enterで通常起動。right clickは起動しない。

## P6.2 implementation boundary

Explorer revealは次の境界を維持する。

1. rendererで任意のshell commandを組み立てない。
2. action typeからlocal pathだけを抽出する。
3. Rustでenv展開、存在確認、canonicalization、file/folder判定を再確認する。
4. process argumentを分離し、shell interpolationをしない。
5. failureはResultで返し、短いtoastを出す。
6. URL、special、曖昧なmulti-targetは非表示とする。
