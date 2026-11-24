# P10-00:今のコードの調べ(UI/UX を作り直す前の地図)

- 調べた main のコミット: `d211daf`(2026-11-15)。作業ブランチ `chore/p10-00-investigation` はこのコミットから作った。
- 調べた日: 2026-11-15
- 報告のコミット: `docs: P10-00 今のコードの調べ`(このファイル 1 つだけを足したコミット)
- **コードもテストも 1 文字も変えていない。**足したのはこのファイル 1 つだけ。`git diff --name-only main` は `docs/phase10/00-investigation.md` の 1 行。

## この報告の読み方

- 事実だけを書く。意見・改善案は書かない。分からなかった所は「分からなかった」と書き、推測で埋めていない。一覧は最後の「分からなかった所」にある。
- 場所は `ファイル:行`。行の範囲は `src/App.tsx:10454-10620` の形で書く。
- クラス名・`aria-label`・`data-testid`・画面の文字は、コードにあるとおりに `` ` `` で囲んで写した。
- 行番号はすべて実際にそのファイルを開いて確認した(`src/App.tsx` は 15,989 行、`src/styles.css` は 13,074 行)。
- 見本は `handoff/mocks/` の HTML(`index.html` から開く 16 ファイル)、決まりは `handoff/decisions.md`(D1〜D31)。見本と決まりが食い違う所は、決まり(`decisions.md`)を上として読む。
- 表の「行」は、特に断りが無ければその表の直前に書いたファイルの行番号。

## やったこと(節ごと)

| 節 | やったこと |
|---|---|
| A | `src/App.tsx`・`src/components/`・`src/*.ts(x)`・`src/styles.css` を画面の部分ごとに区切り、行の範囲・state・関数・`@media`・表示サイズ・`prefers-reduced-motion` を調べた |
| B | `:root` の変数 67 個と使用回数、`font-family`、`border-radius`、プロジェクト色の線、始める 5 ボタンの状態、保存/キャンセル/閉じるの色とダイアログごとの並びを調べた |
| C | CSP の `font-src`、フォントの置き場所、`public:check` の拡張子の決まり、`dist/` の実測(1,035,336 バイト)、基準画像 17 枚を調べた |
| D | 上の段の部品の並び、サイドバー、キー操作の全部、手順書ビューアーの検索、WebView2 のキーを止めているかを調べた |
| E | メイン画面 6 節 + その他について、範囲・クラス・空の文・ボタン・十字キー・ドラッグを節ごとに調べた |
| F | タイマー中の見た目、拡大タイマー(同じ窓)とミニタイマー(別の窓)、上端の線、満了と途中終了の順番、分数の決まりを調べた |
| G | 今日の3件を選ぶ画面の形と候補の出し方、次の一手/やりたいこと/プロジェクトの欄の一覧を調べた |
| H | `ContextMenu` の 11 種のメニューの中身、トーストの色・時間・元に戻す・`aria-live`、ダイアログ 30 個の初期フォーカスと Esc を調べた |
| I | 辞書が別の窓であること、開き方、ページ、検索の有無、まとめて探す仕組みの有無を調べた |
| J | `RecordsView` のタブと節、`sessions.jsonl` の 1 行、鮮度に使える値、まとめて取り込みのコピーの中身を調べた |
| K | `config.json` が無い/空のときの画面と文、使い方が自動で開くかを調べた |
| L | 見本の要素 L1〜L25 の全部について、今ある/近い物がある/無い と場所・クラス・関数を対応づけた |
| M | 678 テスト/90 spec の一覧、テストが頼っている目印(クラス 296 種ほか)、基準画像 17 枚、`fixtures.ts` の偽データを調べた |
| N | 版の数字 5 か所(すべて `1.4.3`)、README・使い方・画面写真のうち作り直しで直す所を調べた |
| O | 設計レビューの 9 項目(型の突き合わせ、settings、`persistConfig` 52 か所、F1、鮮度、ピッカーの保存、次の一手のフォローアップ、テストの差し替え、行の十字キー)を調べた |

## 指示書どおりにできなかった所

無し。(実機は動かしていない。`npm.cmd run build` と `npx.cmd playwright test --list` だけを指示どおり回し、テスト本体は回していない。)

## 最後の確かめ

| コマンド | 結果 |
|---|---|
| `npm.cmd run public:check` | `Public safety check passed` (このファイルを足した後に回して確認) |
| `git diff --check` | 出力なし(空白の誤りなし) |
| `git diff --name-only main` | `docs/phase10/00-investigation.md` の 1 行だけ |

## 気づいたこと(直さずに書くだけ)

1. 見本は `handoff/mocks/index.html` に **16 ファイル**が並んでいる(`Fonts.html` を含む)。指示書の「15 画面」とは数が違う。`Review.html` は index に無く、D10 で不採用。
2. 見本 `Done.html` には「できたこと」の欄も「もう5分続ける」も無い(在るのは「次はどこから始まりますか」の 5 択と「決定」「閉じる」)。D13 は「できたことの欄は書かなくてよい」としている。今のコード側にも「できたこと」の欄は無い。
3. L12 の「タイマーだけ使う」は、見本 `Main.html` にもリポジトリにも字が見当たらない(0 件)。何を指すかは分からなかった(近い物は上の段の「ミニタイマーへ切り替え」と設定の「ミニタイマーを使う」)。
4. 上の段の「使い方」ボタンは今もある(`src/App.tsx:10547-10556`)。D5 は「ミニ・使い方は上の段に置かない」と決めているので、作り直しで動かす対象になる。
5. 今の自動起動ボタンに `aria-pressed` は無い(`aria-label` と `title` だけで状態を表している)。D9 は `aria-pressed` を使うと決めている。
6. `firstRun`・「はじめて」の印はリポジトリ全体で 0 件。D14 の「はじめての起動」と、その印(`settings.firstRunDoneAt` の仮の名前)は今は無い。
7. Ctrl+F の割り当ても、ページ内検索を止める設定も無い(`matchesHotkey` `src/App.tsx:1098-1115` と `src-tauri` のどちらにも無い)。D4 の「仮」のまま。
8. トーストの `neutral` は CSS では `var(--accent)`(黄色)だが、`docs/spec/current-spec.md:898` は「灰色」と書いている。トーストの幅も CSS は `min(390px, calc(100vw - 36px))`、仕様書は「約420px」で違う。
9. D15 の「失敗のトーストだけは自分で消えない」に対して、今の `error` は 8000ms で消える(`src/constants.ts:5-6`)。「元に戻す」の Ctrl+Z の割り当ても無い(`=== "z"` が 0 件)。
10. `sourceWishlistId` は TypeScript の `NextStepSchema` にだけあり(`src/types.ts:117`)、Rust の `NextStepV3` にも `config.schema.json` の `nextStep` にも無い。`save_config` が sanitize して書き出すため、保存の往復で消える読み(実機では確かめていない)。
11. テストの偽の `invoke` は `save_config` に渡された `config` をそのまま保存する(`tests/visual/tauriMock.ts:365-369`)ので、10. のような「Rust 側に項目が無い」種類の差はテストに出ない。
12. `src/styles.css` の `:root` に `--ok`・`--neutral` という変数は無い(`--good`・`--control-neutral-*` が実際の名前)。`src/App.tsx:10137` の `{false && launcherOverlayOpen && (` により、`aria-label="起動辞書"` のダイアログ(`src/App.tsx:10143`)は描画されない死んだコード。

## 目次

- A. 全体の地図
- B. 色・字・形の決まり
- C. フォントを同梱するための調べ
- D. 上の段とサイドバー
- E. メイン画面の節
- F. タイマーと終わり
- G. 今日の3件を選ぶ・次の一手を編集する
- H. メニュー・トースト・ダイアログ
- I. 辞書と検索
- J. 記録の画面と、記録のデータ
- K. 何も無いときと、はじめての起動
- L. 見本の要素ごとの対応表
- M. テストの地図
- N. 版と公開の物
- O. 設計のレビューを受けて足した調べ
- 分からなかった所

## A. 全体の地図

### A-1 `src/App.tsx` の画面の部分

`src/App.tsx` は 15,989 行。`App`（2057-2074）は画面を選ぶだけで、`isMiniModeView()` なら `MiniModeApp`（2058）、`isDictionaryView()` なら `DictionaryWindow`（2059-2065）、`isInstructionView()` なら `InstructionViewer`（2066-2072）、それ以外は `DashboardApp`（2073）を返す。メイン画面の本体は `function DashboardApp()`（2076-15989）で、描画の入口は 9714 行の `return (`、画面全体は 9715-15987 の `<main className="appShell appShell--dashboard">`。行の範囲は「その部分の JSX が始まって終わるまで」で、子要素の範囲は親の範囲に含まれる。

| 部分 | 行の範囲 | 主な state（宣言行） | 主な関数（定義行） |
| --- | --- | --- | --- |
| 描画前の分岐（ミニ / 辞書 / 手順書 / 本体） | 1933-2074 | `snapshot`（ミニ）1934 | `MiniModeApp` 1933、`lazy` 読み込み 2045-2055、`App` 2057（分岐 2058-2073）、`DashboardApp` 2076 |
| 読み込み中の画面 | 9281-9287 | `loading` 2088 | — |
| 設定を読めない画面 | 9289-9295 | `config` 2077 | — |
| 画面全体（`appShell`） | 9714-15987 | `config` 2077、`dragActive` 2312、`jsonDrop` 2313 | `handleDomDrop` 5275 |
| 窓の上端のタイマーの線 | 9725-9741 | `windowTimerLine`（算出値）2765 | — |
| JSON を落としたときの覆い | 9742-9764 | `jsonDrop` 2313 | — |
| メイン領域へ移動（スキップリンク） | 9765-9776 | `skipLinkBlocked`（算出値） | `focusSkipTarget` 9699 |
| 辞書の幕 | 9777-9779 | `dictionaryVisible` 2089 | — |
| サイドバー枠 `<aside className="sidebar">` | 9780-10134 | `collapsedGroups` 2237、`sidebarPointerDrag` 2301、`sidebarGroupPointerDrag` 2302 | `openContextMenu` 2560、`openContextMenuFromKeyboard` 2569 |
| サイドバー: ブランドとテスト印 | 9796-9826 | `testProfile` 2099、`shortcutRegistration` 2078 | — |
| サイドバー: 「辞書を開く」 | 9828-9846 | — | `openDictionaryManually` 3538 |
| サイドバー: クイック起動の一覧 | 9848-10013 | `collapsedGroups` 2237、`sidebarPointerDrag` 2301 | `toggleGroupCollapsed` 4852、`moveSidebarButtonByOffset` 5465、`moveSidebarGroupByOffset` 5493 |
| サイドバー: ドラッグ中の目印とゴースト | 9985-10028 | `sidebarPointerDrag` 2301、`sidebarGroupPointerDrag` 2302 | `startSidebarPointerDrag` 5568 |
| サイドバー: タイマー（待機・実行中） | 10029-10133 | `activeTimer` 2214、`defaultTimerDraft` 2149、`numberInputDragging` 2310、`completionPrompt` 2230 | `saveDefaultTimerMinutes` 3675、`togglePause` 7486、`finishActiveTimer` 7479、`startNumberInputDrag` 4227 |
| 旧・起動辞書のオーバーレイ（10137 行の `false &&` により描画されない） | 10136-10445 | `launcherOverlayOpen` 2188、`launcherSearch` 2189、`launcherSelectedIndex` 2190、`selectedOverlayPageKey` 2191 | `closeLauncherOverlay` 2550、`handleLauncherOverlayKeyDown` 9633 |
| メインの枠 `<section className="mainPanel">` | 10447-12523 | — | — |
| 上の段 `<header className="topBar">` | 10453-10570 | `activeView` 2090、`miniTransitioning` 2309、`topMenuLabelLevel` 2117 | `toggleAutoStart` 7558、`toggleMiniMode` 3508、`openInstructionsManually` 3524、`openSettingsCenter` 3792、`setHelpGuideOpen(true)` 10550 |
| 上の段: 窓のボタン | 10569 | `closeShortcutDisabled`（算出値） | `WindowControls`（`src/components/WindowControls.tsx`） |
| メインのスクロール領域 | 10572-12522 | — | `focusSkipTarget` 9699 |
| 知らせの帯（`banner`） | 10579-10592 | `banner` 2087、`backupPath` 2081 | `openBackupFolder` 3664 |
| 記録の画面（`RecordsView`） | 10594-10621 | `sessionEntries` 2204、`recordsWeekSessions` 2205、`recordsAllSessions` 2206、`notesHistory` 2212、`sessionSearch` 2209、`sessionProjectFilter` 2210、`sessionDateScope` 2211 | `openManualSessionDialog` 9029、`openSessionEditDialog` 9091、`openProjectEditDialog` 8354、`tryStaleNextStepForShortTime` 7370 |
| 今日の勝利条件 | 10624-10716 | `victoryEditing` 2150、`morningVictorySuggestion` 2086、`completionFeedback` 2231 | `toggleVictoryDone` 7628、`enterVictoryEditing` 7601、`updateVictoryText` 7584、`applyVictorySuggestion` 7612、`handleVictoryKeyDown` 7655 |
| 今やる一手 | 10718-10980 | `doNowResponse` 2200、`doNowPickedProjectId` 2203、`doNowCompletionHold` 2232、`doNowCompletionSaving` 2233、`doNowExcludedProjectId` 2234、`activeTimer` 2214 | `refreshDoNow` 3010、`showNextDoNowCandidate` 9572、`startDoNowProject` 9546、`acknowledgeDoNowCompletion` 9577、`openNextStepEditor` 8400 |
| 今日の3件 | 10982-11554 | `todayOpen` 2174、`todayPointerDrag` 2304、`todayTriggerEditingIndex` 2095、`todayTriggerDraft` 2096、`completionFeedback` 2231 | `removeTodayItem` 7711、`startTimer` 7234、`startTodayPointerDrag` 5708 |
| 今日の3件: 追加の入口・完了の表示・次の枠 | 11452-11551 | `todayPointerDrag` 2304 | `openTodayPicker` 3983、`startNextTodayBatch` 9040 |
| 次の一手 | 11557-11961 | `projectsOpen` 2173、`projectsListExpanded` 2175、`projectPointerDrag` 2305、`inboxPointerDrag` 2306 | `openProjectAddDialog` 8338、`openProjectEditDialog` 8354、`openNextStepEditor` 8400、`requestProjectDeletion` 8913、`startProjectPointerDrag` 5874 |
| やりたいこと | 11963-12457 | `inboxOpen` 2172、`wishlistGroupViews` 2176、`inboxPointerDrag` 2306、`wishlistGroupPointerDrag` 2307 | `openInboxAddDialog` 8324、`beginInboxEdit` 7890、`promoteInboxToNextStep` 8446、`completeInboxItem` 7989、`startInboxPointerDrag` 6020、`startWishlistGroupPointerDrag` 6216 |
| 今日の実行 | 12459-12518 | `todayActivityOpen` 2186、`todayActivityEntries` 2207、`todayActivityDate` 2208 | `refreshTodayActivity` 3043 |
| 並べ替えの読み上げ | 12525-12527 | `reorderAnnouncement` 2318 | — |
| 完了の粒の層 | 12529-12535 | `completionFeedback` 2231 | — |
| トースト | 12537-12597 | `toasts` 2092、`toastsRef` 2093 | `showToast` 2892、`dismissToast` 2808、`pauseToast` 2860、`runToastAction` 2932 |
| 右クリック / 「…」のメニュー | 12599-13032 | `contextMenu` 2317、`contextMenuReturnFocusRef` 2368 | `openContextMenu` 2560、`dismissContextMenu` 2431、`openContextMenuFromKeyboard` 2569 |
| ダイアログ: やりたいこと編集 | 13034-13146 | `inboxEditingIndex` 2156、`inboxEditDraft` 2167、`inboxEditProjectId` 2168、`inboxEditButtonIds` 2169 | `beginInboxEdit` 7890 |
| ダイアログ: 今日やるものを選ぶ | 13147-13376 | `todayPickerOpen` 2179、`todayPickerDraftItems` 2184、`todayPickerSource` 2183、`todayPickerSaving` 2185、`todayPickerWishlistCollapsed` 2180 | `openTodayPicker` 3983、`removeTodayPickerDraftItem` 8261 |
| ダイアログ: 辞書ページの追加・名前変更 | 13377-13439 | `overlayPageDraft` 2252 | `openOverlayPageDialog` 6640 |
| ダイアログ: グループ追加 | 13440-13495 | `groupDraft` 2247 | `openGroupDialog` 6425 |
| ダイアログ: グループ名変更 | 13496-13552 | `groupRenameDraft` 2248 | `openGroupRenameDialog` 6572 |
| 設定 | 13553-14160 | `settingsDraft` 2254、`settingsSection` 2280、`shortcutRecordingField` 2255 | `openSettingsCenter` 3792、`requestCloseSettings` 3849、`finishShortcutRecording` 3722 |
| 設定: 表示（メイン表示サイズ） | 13775-13799 | `settingsDraft.mainDisplaySize` | 保存は `persistConfig` 3289 |
| 設定: 今週の重点 | 13800-13856 | `settingsDraft.weeklyFocusProjectIds` | — |
| 設定: タブごとの中身 | 13607-14159（基本 13607、ショートカット 13857、手順書 13934、バックアップ 13976、メンテナンス 14037） | `settingsSection` 2280 | — |
| ダイアログ: 実行記録の追加 | 14161-14279 | `manualSessionDraft` 2287 | `openManualSessionDialog` 9029 |
| ダイアログ: 実行記録の編集 | 14280-14410 | `sessionEditDraft` 2288 | `openSessionEditDialog` 9091 |
| ダイアログ: ボタン編集 | 14411-14713 | `buttonEditDraft` 2289、`buttonEditInitialDraft` 2290、`actionDragId` 2311 | `openButtonEditDialog` 6795 |
| ダイアログ: やりたいこと追加 | 14714-14818 | `inboxAddOpen` 2153、`inboxDraft` 2151、`inboxAddProjectId` 2152、`inboxAddSaving` 2154、`inboxAddError` 2155 | `openInboxAddDialog` 8324 |
| ダイアログ: 次の一手の決め方（実行後） | 14819-14883 | `completionFollowup` 2235 | — |
| ダイアログ: 次の一手の編集 | 14884-15428 | `nextStepEditDraft` 2295、`projectNextStepSuggestions` 2213 | `openNextStepEditor` 8400、`refreshNextStepSuggestions` 3104 |
| ダイアログ: プロジェクトの追加・編集 | 15429-15573 | `projectEditDraft` 2293、`projectEditSaving` 2294 | `openProjectAddDialog` 8338、`openProjectEditDialog` 8354、`requestProjectDeletion` 8913 |
| タイマー: 拡大表示 | 15574-15599 | `expandedTimerOpen` 2215、`activeTimer` 2214 | `finishActiveTimer` 7479、`togglePause` 7486 |
| タイマー: 満了のダイアログ | 15601-15640 | `completionPrompt` 2230 | `continueCompletedTimer` 7386、`finishCompletedTimer` 7410 |
| タイマー: ミニ画面 | 1933-2043（`TimerPanel` の `variant="mini"` は 2010-2040） | `snapshot` 1934 | `sendCommand` 1958、`requestMainFromMini` 1967 |
| ダイアログ: ボタン登録（ドロップ） | 15642-15859 | `dropDraft` 2239、`builderKind` 2240、`builderSource` 2241、`builderLabelTouched` 2242、`builderBusy` 2246 | `openButtonBuilder` 6431 |
| ソフトウェアリセット: 選択 | 15860-15921 | `softwareResetChoiceOpen` 2282、`softwareResetChoiceBusy` 2283 | `continueSoftwareReset` 4525、`closeSoftwareResetChoice` 4516 |
| 確認ダイアログ | 15922 | `confirmDialog` 2281 | `requestConfirmation` 2383、`closeConfirmDialog` 2583 |
| ソフトウェアリセット: 実行中 | 15923-15948 | `softwareResetStage` 2284 | — |
| 使い方 | 15949-15961 | `helpGuideOpen` 2279 | — |
| 今日の分は完了にしますか？ | 15962-15977 | `earlyStop` 2228、`earlyStopSaving` 2229 | `resolveEarlyStop` 7143 |
| 取り込みダイアログ | 15978-15986 | `importDialogOpen` 2314、`importInitialText` 2315、`importInitialError` 2316 | `openImportDialog` 4942、`handleImported` 4960 |

補足（事実）:

- 右クリックと「…」のメニューは `ContextMenu`（12599-13032）1 つで、`kind` ごとに中身を出し分ける。`ContextMenuTarget` の種類は 528-571 行に `overlayPage` / `button` / `sidebar` / `project` / `nextStep` / `today` / `inbox` / `doNow` / `projects` / `inboxes` / `session` の 11 種類。
- 「…」ボタンは今日の3件の行（11132-11150、`title="操作メニュー"`）、次の一手の行（11621-11640、`title="次の一手の操作"`）、やりたいことの行（12020-12040、`title="やりたいことの操作"`）にあり、記録画面は `src/RecordsView.tsx:377`（`⋯`）。
- トーストは `role="status"`・`aria-live="polite"`（12538、12554）、1 件ずつ `data-toast-id`（12544）を持つ。
- ダイアログはすべて `modalBackdrop` + `dropDialog` の組で、`modalDragBand`（`data-tauri-drag-region`）を先頭に置く（例 13035-13036、13554-13555、15602-15603）。

### A-2 `src/components/` と `src/*.ts(x)` のファイル

行数は `(Get-Content <file>).Count` で数えた値。

`src/components/`

| ファイル | 行数 | 1 行の説明 |
| --- | --- | --- |
| `src/components/ConfirmDialog.tsx` | 219 | 確認ダイアログ本体と `ConfirmDialogRequest` 型（件名・本題・確認/取消/代替のボタン・処理中・初期フォーカス）。 |
| `src/components/ContextMenu.tsx` | 152 | 右クリックメニューの位置決め（画面端 8px 逃げ）と `ContextMenuItem`（`role="menuitem"`）。 |
| `src/components/DictionaryFeatureParity.tsx` | 906 | 辞書ウィンドウ側の操作ロジック（ページ移動・並べ替え・削除・ドロップ登録・保存）をまとめたコントローラ。 |
| `src/components/DictionaryFeatureParityUi.tsx` | 656 | その操作ロジックに対応する UI（ダイアログ・メニュー・フォーカス封じ込め）。 |
| `src/components/DictionaryWindow.tsx` | 2,097 | 辞書ウィンドウ全体（タブ・検索・タイル・ドラッグ並べ替え・ページ管理）。 |
| `src/components/ExpandedTimerOverlay.tsx` | 119 | 拡大タイマーの全面表示（時計・進捗・一時停止・終了・閉じる）。 |
| `src/components/GroupModeField.tsx` | 65 | グループの指定（既存から選ぶ / 新しく作る）の入力欄。 |
| `src/components/HelpGuideDialog.tsx` | 353 | 使い方ダイアログ（目次・節・コピー・目次開閉）。 |
| `src/components/ImportDialog.tsx` | 363 | 取り込みダイアログ（プロンプトのコピー・JSON の貼り付け・プレビュー・確定）。 |
| `src/components/InstructionTree.tsx` | 1,831 | 手順書のフォルダツリー（作成・改名・移動・検索・並べ替え・関連更新）。 |
| `src/components/InstructionUnsavedDialog.tsx` | 117 | 手順書の未保存確認（編集を続ける / 破棄 / 保存）。 |
| `src/components/InstructionViewer.tsx` | 1,046 | 手順書ビューアーのウィンドウ（Markdown / HTML / MHTML の表示・拡大・常時手前・編集）。 |
| `src/components/ProjectIdentity.tsx` | 28 | プロジェクトの色の点と名前を出す小さな表示（`compact` あり）。 |
| `src/components/ShortcutBadge.tsx` | 23 | ショートカットの文字を `kbd` で出す（未登録なら `shortcutBadge--unavailable`）。 |
| `src/components/TimerPanel.tsx` | 156 | タイマーのパネル（`sidebar` / `mini` の 2 種類、待機・実行中・一時停止・満了）。 |
| `src/components/UiIcon.tsx` | 211 | 画面で使うアイコンの一覧（`UiIconName`）と SVG の描画。 |
| `src/components/WindowControls.tsx` | 160 | 窓の右上の最小化・最大化・閉じる（`dashboard` / `instruction`）。 |

`src/*.ts(x)`

| ファイル | 行数 | 1 行の説明 |
| --- | --- | --- |
| `src/App.tsx` | 15,989 | `App`（2057-2074）が画面を選び、メイン画面の本体は `DashboardApp`（2076-15989）。設定・各ダイアログ・タイマー・ドラッグ操作もこのファイルに入る。 |
| `src/completionFollowup.ts` | 145 | 実行完了後の「次の一手」の引き継ぎ（現在の次の一手かどうかの判定を含む）。 |
| `src/constants.ts` | 11 | 今日の3件 3 件・週の重点 3 件・トースト 4000/8000ms・タイマー上限 240 分などの定数。 |
| `src/dictionaryTilePointer.ts` | 87 | 辞書タイルの押下・ドラッグ・ドロップの状態機械（しきい値 6px）。 |
| `src/dictionaryTileReorder.ts` | 49 | 辞書の並び順の計算（`moveIdToSlot` / `replaceVisibleOrder`）。 |
| `src/dictionaryWindow.ts` | 288 | 辞書ウィンドウの生成・表示・非表示・位置と大きさ・イベント名。 |
| `src/earlyCompletion.ts` | 36 | 早めの終了の判定（しきい値は 5 分と設定値の小さい方）。 |
| `src/hoverSuppression.ts` | 31 | 窓の大きさが変わった直後に `body` へ `hover-suppressed` を付けて乗せた色を止める。 |
| `src/importCurrentState.ts` | 27 | 取り込みプロンプトの `{CURRENT_STATE}` に入れる現在の状態の文面。 |
| `src/importJson.ts` | 83 | 貼り付けた文章から `lifeLauncherImport` を含む JSON を 1 つ抜き出す（上限 256KB）。 |
| `src/InstructionPicker.tsx` | 143 | 手順書の選択欄（検索・一覧・現在の設定が無いときの表示）。 |
| `src/instructionWindow.ts` | 365 | 手順書ウィンドウの生成・大きさの 4 段階・常時手前・最後に開いたパス。 |
| `src/keyboardNavigation.ts` | 224 | 矢印キーでのフォーカス移動と、設定ダイアログの入力欄の「移動 / 編集」の切り替え。 |
| `src/launcherReveal.ts` | 22 | 「エクスプローラーで表示する」が使えるボタンかの判定。 |
| `src/localDay.ts` | 7 | 日付の区切り時刻（`dayStartHour`）を考慮した 1 日のキー。 |
| `src/main.tsx` | 10 | `#root` に `App` を `StrictMode` で描画し、`styles.css` を読む入口。 |
| `src/markdown.ts` | 203 | Markdown / HTML を許可タグだけに浄化して表示する（DOMPurify + marked）。 |
| `src/nextStepWishlist.ts` | 253 | 次の一手とやりたいことの入れ替え・戻す・削除の判断と、やりたいことのまとまり分け。 |
| `src/overlayPages.ts` | 134 | 辞書のページ（すべて / 未分類 / 追加ページ）と並び順・検索。 |
| `src/projectDeletion.ts` | 154 | プロジェクト削除時の影響（次の一手・やりたいこと・今日の3件）の集計と後始末。 |
| `src/projectIdentity.ts` | 51 | プロジェクトの 12 色の定義と、色が無いときの自動割り当て。 |
| `src/RecordsView.tsx` | 412 | 記録の画面（週のレビュー・積み上げ・すべての履歴・メモ）。 |
| `src/shortcutConflicts.ts` | 31 | ショートカットの重複判定（修飾キーの順序を正規化）。 |
| `src/sourceEdit.ts` | 113 | 「今日の3件」に入っている間の元データ編集の禁止理由と判定。 |
| `src/StartEnvironmentPicker.tsx` | 285 | 開始環境（一緒に開くボタン）の選択（すべて / サイドバー / 辞書のタブ）。 |
| `src/tauri.ts` | 456 | Rust 側のコマンドの呼び出し（設定・記録・手順書・辞書・取り込み・リセット）。 |
| `src/timerRuntime.ts` | 42 | タイマーの経過と残りの計算（一時停止の累計を含む）。 |
| `src/timerSource.ts` | 69 | タイマーがどの「今日の3件」に対応するかの判定（`today:` の接頭辞と世代 ID）。 |
| `src/todayCandidates.ts` | 124 | 「今日やるものを選ぶ」の候補（次の一手・やりたいこと）の組み立てとキー。 |
| `src/topMenuLabels.ts` | 232 | 上部メニューの文字を実測して隠す段階（0/1/2）の計算と `useTopMenuLabelLevel`。 |
| `src/types.ts` | 600 | 設定・プロジェクト・ボタン・記録などの zod スキーマと型。 |
| `src/version.ts` | 4 | `package.json` の version を `__APP_VERSION__` として公開。 |

（参考）`src/content/` と `src/mhtml/`

| ファイル | 行数 | 1 行の説明 |
| --- | --- | --- |
| `src/content/helpGuide.ts` | 412 | 使い方ダイアログの本文（節・用語・例・取り込みプロンプト）。 |
| `src/content/importPrompt.ts` | 71 | 取り込み用プロンプトの文面（初回と 2 回目以降）。 |
| `src/mhtml/assembleMhtml.ts` | 166 | MHTML の部品を 1 つの HTML に組み立てる（画像は data URL、外部参照は残す）。 |
| `src/mhtml/limits.ts` | 47 | MHTML を読むときの上限（部品数・深さ・合計バイト・組み立て後・時間）。 |
| `src/mhtml/mhtmlWorker.ts` | 25 | MHTML の解析を Web Worker で行う入口。 |
| `src/mhtml/parseMhtml.ts` | 502 | MHTML の限定的なパーサ（Chrome / Edge の Single File 形式のみ、DOM 非依存）。 |
| `src/mhtml/renderMhtml.ts` | 64 | Worker で解析して安全な HTML として返す（時間切れ・失敗の扱いを含む）。 |

### A-3 `src/styles.css`（13,074 行）の節

`src/styles.css` は画面ごとにきれいに並んでおらず、後の Phase（P8 / P9 / P83 / P95 / P96 など）の上書きが末尾側にも追加されている。下の表はファイルの並び順で区切ったもの。範囲の末尾は次のまとまりの直前まで。

| 行の範囲 | 内容（主なセレクタ） |
| --- | --- |
| 1-76 | 全体の色・寸法の変数（`:root`、`--surface` / `--accent` / `--radius` など） |
| 78-117 | プロジェクトの色（`[data-project-color="amber"]` など 12 色） |
| 119-170 | スクロールバー（`.app-scrollbar` / `.modalBackdrop`） |
| 172-184 | `html` / `body` / `#root` |
| 186-1069 | 辞書ウィンドウ（`.dictionaryWindowLoading`, `.dictionaryResizeHandle*` ほか） |
| 1071-2215 | 手順書ウィンドウ（`.instructionShell`, `.instructionHeader`, `.instructionDocument` ほか。末尾 2200-2214 に `@media (max-width: 760px)`） |
| 2216-2343 | ミニタイマー（`.miniShell`, `.miniTopline`, `.miniExpandButton`, `.miniCloseButton`） |
| 2344-2362 | メイン領域へ移動（`.skipLink`） |
| 2363-2398 | 画面全体（`.appShell`） |
| 2399-2453 | サイドバー: ブランド（`.sidebar`, `.brandBlock`, `.brandIcon`, `.brandCopy`, `.testProfileBadge`, `.settingsNote`） |
| 2456-2474 | ブランド内の文字（`.brandCopy .eyebrow`, `.brandCopy .shortcutBadge`, `.eyebrow`） |
| 2476-2548 | 「辞書を開く」（`.launcherOpenButton*`） |
| 2549-2715 | クイック起動（`.quickList`, `.quickGroup`, `.quickButton`, `.quickIcon`） |
| 2716-2891 | サイドバーのタイマー（`.timerDock`, `.timerPanel*`, `.timerClock`, `.timerMeta`, `.projectIdentity*`） |
| 2892-3055 | 拡大タイマー（`.expandedTimer*`）と `@media (max-height: 430px)`（3051-3055） |
| 3057-3229 | タイマーの時計と分数の部品（`.timerClock`, `.numberDragInput`, `.numberDragAffordance`） |
| 3234-3245 | メインの枠（`.mainPanel`） |
| 3246-3265 | 窓の大きさ変更直後の乗せた色の抑止（`.hover-suppressed ...`） |
| 3266-3318 | ドラッグ用の上端の余白（`.panelDragStrip*`） |
| 3319-3332 | メインのスクロール領域（`.mainScrollArea`） |
| 3333-3450 | 上の段（`.topBar`, `.topPills`, `.topSummary`, `.topTitle`, `.viewToggleButton*`） |
| 3451-3482 | 知らせの帯（`.banner`, `.bannerButton`） |
| 3486-3574 | 記録の画面（`.recordsView*`） |
| 3574-3601 | 記録の目標と週の重点の一覧（`.weeklyReviewNorthStar`, `.weeklyFocusChecklist*`） |
| 3602-3637 | 設定の「今週の重点」（`.settingsWeeklyFocus*`） |
| 3639-3715 | 記録の見直しと統計（`.freshnessReview*`, `.recordsStats*`） |
| 3716-3745 | タイマーの状態の行（`.timerStateRow`, `.timerStateBadge*`） |
| 3747-3837 | 記録の絞り込み（`.recordsFilters`, `.filterGroup`, `.segment*`, `.filterChip*`, `.recordsSection`, `.recentSession*`, `.notesHistory*`） |
| 3838-3848 | 見出し（`.topTitle`, `.topTitle--records`） |
| 3849-3991 | 今日の勝利条件（`.victoryBar*`, `.victoryIcon`, `.victoryInput`, `.victoryTextButton*`, `.victoryBadge*`, `.suggestionChip`, `.suggestionRow`） |
| 3997-4369 | 今やる一手（`.doNowBand`, `.doNowContent`, `.doNowKicker`, `.doNowMeta`, `.doNowFooter`, `.doNowEmpty`, `.doNowActions` ほか） |
| 4379-4388 | `@container (max-width: 700px)`（`.doNowContent`） |
| 4389-4455 | 4 つの節の帯（`.focusBand`, `.projectsBand`, `.inboxBand`, `.todayActivityBand`） |
| 4456-4624 | 今日の3件の行（`.todayRow*`, `.todayTextButton`, `.todayTriggerInput`, `.todayProjectIdentity`） |
| 4629-4671 | チェックボックスと入力欄（`.check`, `.textInput`, 設定ダイアログの focus 表示） |
| 4672-4740 | ボタン共通とサイドバーのドラッグ表示（`.primaryButton` ほか、`.sidebarDropIndicator`, `.sidebarDragGhost`, `.sidebarGroupDragGhost`） |
| 4741-4832 | ボタンの見た目（`.primaryButton`, `.secondaryButton`, `.dangerButton`, `.iconButton`, numberDrag の入れ物） |
| 4837-4998 | 今日の3件のタイマー操作と節の見出し（`.todayTimerActions*`, `.todayStartButton*`, `.sectionHeading`, `.sectionAddButton`） |
| 5005-5178 | プロジェクトの格子・実行中の印・開始ボタン・乗せた色（`.projectGrid`, `.runningBadge*`, `.nextStepStartGlyph`, `.runningPauseButton`, `.doNowStartPrimary` ほか） |
| 5183-5243 | 停止ボタン・開閉のヘッダー・「自動」の印（`.runningStopButton`, `.disclosure`, `.disclosureHeader`, `.todayActivityAutoBadge`） |
| 5244-5263 | やりたいことの本体（`.inboxBody`, `.inboxList`, `.inboxRow`） |
| 5264-5292 | 空表示と読み上げ（`.quietText`, `.emptyState`, `.reorderAnnouncement`） |
| 5293-5553 | トースト（`.toastStack`, `.toast`, `.toastAccent`, `.toastLifetime`, `@keyframes toast-enter / toast-leave / toast-lifetime`, `@media (max-width: 520px)` 5537-5549） |
| 5554-5617 | 右クリックメニュー（`.contextMenu*`） |
| 5621-5824 | 辞書の幕と旧オーバーレイ（`.dictionaryMainScrim`, `.launcherOverlay*`, `.launcherSearch*`, `.launcherTab*`） |
| 5828-5886 | 辞書のタイル（`.launcherTile*`） |
| 5887-5898 | ダイアログの幕（`.modalBackdrop`） |
| 5899-5967 | ダイアログの枠（`.dropDialog`） |
| 5981-6310 | 使い方（`.helpGuide*`） |
| 6314-6402 | 使い方の幅と高さ（`@media` 3 つ） |
| 6409-6577 | 確認ダイアログ（`.confirmBackdrop`, `.confirmDialog*`, `.confirmDialogHeader`, `.confirmDialogBody`） |
| 6588-6636 | やりたいこと追加（`.wishlistAddDialog`） |
| 6637-6706 | 辞書の検索結果（`.launcherSearchResults*`） |
| 6711-6767 | 設定ダイアログの枠と保存/取消（`.settingsDialog`, `.settingsSaveButton`, `.settingsCancelButton`） |
| 6782-6829 | 設定のタブと節（`.settingsSection`, `.settingsTabs`, `.settingsTab*`, `.settingsGrid`） |
| 6830-6924 | ショートカットの入力（`.shortcutCapture*`, `.shortcutConflictWarning`） |
| 6919-7004 | プロジェクトごとのタイマー設定（`.projectTimerGrid`, `.projectTimerSetting`, `.projectTimerControl`, `.projectTimerFooter`） |
| 7005-7057 | 設定のトグルとボタン（`.settingsToggle*`, `.settingsButton--neutral`, `.settingsButton--danger`） |
| 7058-7095 | メンテナンス（`.maintenanceGroups`, `.maintenanceGroup*`, `.settingsVersion`） |
| 7096-7176 | ソフトウェアリセット（`.softwareReset*`, `@keyframes software-reset-spin` 7159, `@media (prefers-reduced-motion)` 7165, `@media (max-width: 620px)` 7172） |
| 7178-7203 | 長いダイアログのスクロール（`.modalLongForm*`） |
| 7204-7336 | ボタン編集（`.buttonEditDialog`, `.buttonEditSection*`, `.buttonEditActionRow`, `.buttonEditAddAction` ほか） |
| 7337-7449 | フォーム部品とプロジェクト編集（`.formSectionHeading`, `.editGrid`, `.fieldStack`, `.projectColorPalette`, `.projectDangerZone`, `.projectDeleteButton`, `.projectWeeklyFocusToggle`） |
| 7450-7477 | プロジェクトの色の見本（`.projectColorSwatch`） |
| 7478-7490 | 記録の行のプロジェクト表示（`.sessionProjectIdentity`） |
| 7491-7525 | 手順書フォルダの設定（`.instructionFolderSettings*`, `.instructionFolderAddButton`） |
| 7526-7633 | グループの指定と登録先（`.dropGroupMode`, `.displayTarget*`, `.dropSource`, `.dropRegisterActions`） |
| 7634-7692 | 別名とアクションの編集（`.aliasesInput`, `.visibilityWarning`, `.fieldError`, `.actionEditor`, `.actionRow*`） |
| 7693-7734 | タイマー満了ダイアログ・ダイアログの操作列・スピナー（`.timerCompleteDialog`, `.dialogActions`, `.spinner`, `.loadingMark`, `@keyframes spin` 7729） |
| 7735-7826 | 幅の調整と辞書タイル（`@media (max-width: 760px)` 7735-7819、`@media (prefers-reduced-motion)` 7821-7826） |
| 7829-8110 | メイン画面の文字サイズと密度（`.mainPanel` の `--dashboard-font-*`、`.topTitle`, `.topDateLabel` ほか） |
| 8118-8237 | 上部メニューの段階とやりたいこと編集（`@media (max-width: 760px)` 8118、`.inboxEditDialog`, `.inboxProjectChoices`, `.inboxItemText`） |
| 8251-8342 | ドラッグ中のゴーストとドロップ位置（`.projectDragGhost`, `.inboxDragGhost`, `.todayDragGhost`, `.projectDropIndicator`, `.inboxDropIndicator`） |
| 8344-8837 | 今日の3件の節バーとカード（`.focusBand`, `.todaySectionBar*`, `.todayGrid*`, `.todayRow*`, `.todayEmptyState*`, `.todayCardFooter` ほか） |
| 8839-8974 | 一覧のページ送り・節のヘッダー・空表示（`.sourceListControls`, `.sourceListPagination`, `.sectionEmptyState*`, `.todayEmptyStateContent`） |
| 8975-9516 | 今日やるものを選ぶ（`.todayPicker*`） |
| 9522-9639 | 帯のヘッダーと本文（`@media` 2 つ、`.nextStepBody`, `.projectGrid`, `.nextStepRow`, `.projectsBand .disclosureHeader` ほか） |
| 9642-9801 | 節のメニューボタンと行の操作（`.disclosureHeaderActions`, `.sectionMenuButton`, `.sourceRowMenu`, `.wishlistRowActions`, `.wishlistNextStep*`） |
| 9803-10247 | 次の一手のカード（`.nextStepRow*`, `.nextStepCard*`, `.nextStepProjectRegion`, `.nextStepActionRegion`, `.sourceLockBadge`, `.nextStepCardActions`, `@container` 10236/10242） |
| 10248-10475 | 次の一手の決定ダイアログ（`.nextStepEditDialog`, `.nextStepDecision*`, `.nextStepWishlist*`, `.nextStepSwapSummary`） |
| 10477-10522 | 実行後のフォロー（`.completionFollowup*`） |
| 10523-10691 | やりたいことのまとまり（`.nextStepFixedProject`, `.inboxGroups`, `.wishlistGroup*`, `.todayRow .todayRowMenu`, `.wishlistGroupDropIndicator`） |
| 10709-10753 | やりたいこと→次の一手のドロップ帯（`.sourceReturnBand*`, `.sourceReturnDropZone*`） |
| 10754-10879 | 旧選択・ドラッグ中の行・幅の調整（`.legacyNextStepChoice`, `.nextStepRow--dragging`, `@container`, `@media` 数個） |
| 10880-10905 | 実行記録の一覧（`.sourceCompletion*`） |
| 10906-11079 | 読み上げ専用と開始環境ピッカー（`.srOnly`, `.startEnvironmentPicker*`） |
| 11082-11175 | 開始環境ピッカーの検索と候補（`.startEnvironmentSearch`, `.startEnvironmentOption*`, `.startEnvironmentNoResults`） |
| 11177-11210 | 記録の見出し（`.recordsInlineHeading*`） |
| 11211-11497 | 完了時の演出（`.victoryBar--reward`, `.victoryRewardSweep`, `.completionParticle*`, `@keyframes completion-*`） |
| 11498-11538 | 完了演出の `@media (prefers-reduced-motion: reduce)` |
| 11547-11664 | ダイアログの操作列と手順書ピッカー（`.formDialogActions`, `.instructionPicker*`） |
| 11665-11988 | 記録画面の作り直し（`.recordsViewHeader`, `.recordsStats`, `.records*`） |
| 11989-12106 | メイン画面の明示的な操作（`@media (hover: hover) and (pointer: fine)` 12058、`@media (prefers-reduced-motion)` 12091-12105） |
| 12107-12235 | 表示サイズの設定とメインの整列（`.settingsDisplay*`、`.mainScrollContent[data-main-display-size="large"]` 12211、`="xlarge"` 12224） |
| 12237-12288 | 表示サイズ共通の寸法（帯・行・カード・ボタン・`.todayGrid` のすき間） |
| 12293-12336 | 上部メニューと窓のボタンの large / xlarge（`.mainPanel[data-main-display-size=...]`） |
| 12338-12416 | 実行中タイマーの表示（`.timerPanel--mini*`, `.expandedTimerBody .expandedTimerTask`） |
| 12418-12614 | 4 つの節バーの枠と文字、件数の位置（`.topPills`, `.doNowBand` ほか、`.todaySectionBar` の件数） |
| 12628-12651 | 上の段の右余白と測定用の複製（`.mainPanel > .topBar`, `.mainPanel[data-main-display-size=...] > .topBar`, `.layoutMeasure`） |
| 12653-12728 | 窓のボタン（`.windowControls*`, `.windowControlButton*`, `.windowControlsDivider`） |
| 12729-12822 | 窓のボタンの押せる範囲・乗せた色・ダイアログの × の位置 |
| 12823-12828 | 窓のボタンの `@media (prefers-reduced-motion: reduce)` |
| 12830-12874 | 窓の上端のタイマーの線（`.windowTimerLine*`、`@media (prefers-reduced-motion)` 12869） |
| 12875-12911 | ドラッグできる範囲とダイアログの幕の帯（`.brandBlock`, `.instructionHeader`, `.modalDragBand`、`@media` 3 つ） |
| 12913-13074 | 取り込みダイアログ（`.importDialog*`, `.importDropOverlay`, `.importDropZone*`） |

`@media` / `@container` の一覧（条件・行・その中身の先頭のセレクタ）

| 行 | 条件 | 中身の先頭 |
| --- | --- | --- |
| 1222 | `@container (max-width: 220px)` | `.instructionTreeTools` |
| 1780 | `@media (max-width: 480px)` | `.instructionProjectLinkDialog` |
| 2200 | `@media (max-width: 760px)` | `.instructionExternalBanner` |
| 3051 | `@media (max-height: 430px)` | `.expandedTimerBody` |
| 4379 | `@container (max-width: 700px)` | `.doNowContent` |
| 5469 | `@media (prefers-reduced-motion: reduce)` | `.toast` |
| 5537 | `@media (max-width: 520px)` | `.toastStack` |
| 5974 | `@media (max-width: 520px)` | `.builderSourceModes` |
| 6314 | `@media (min-width: 761px) and (max-width: 900px)` | `.helpGuideDialog` |
| 6330 | `@media (max-width: 760px)` | `.helpGuideDialog` |
| 6380 | `@media (max-width: 460px)` | `.helpGuideNav` |
| 6391 | `@media (max-height: 620px)` | `.helpGuideDialog` |
| 6403 | `@media (prefers-reduced-motion: reduce)` | `.helpGuideBody` |
| 6768 | `@media (max-height: 760px)` | `.modalBackdrop` |
| 6925 | `@media (max-width: 900px)` | `.projectTimerGrid` |
| 7165 | `@media (prefers-reduced-motion: reduce)` | `.softwareResetProgressIndicator` |
| 7172 | `@media (max-width: 620px)` | `.softwareResetChoiceActions` |
| 7314 | `@media (max-width: 560px)` | `.buttonEditDialog` |
| 7627 | `@media (max-width: 560px)` | `.dropGroupMode` |
| 7735 | `@media (max-width: 760px)` | `.appShell--dashboard` |
| 7821 | `@media (prefers-reduced-motion: reduce)` | `.dictionaryTileItem` |
| 8118 | `@media (max-width: 760px)` | `.topPillGroup .viewToggleButtonLabel` |
| 8245 | `@media (max-width: 760px)` | `.inboxProjectChoices` |
| 8678 | `@container today-card (max-width: 300px)` | `.todayCardFooter` |
| 8802 | `@container today-card (min-width: 301px) and (max-width: 370px)` | `.todayCardFooter` |
| 9522 | `@media (max-width: 560px)` | `.todayPickerActions > span` |
| 9575 | `@media (max-width: 620px)` | `.doNowEmptyContent` |
| 9795 | `@media (max-width: 620px)` | `.wishlistNextStepSlot` |
| 9803 | `@media (max-width: 520px)` | `.wishlistNextStepSlot` |
| 10236 | `@container (max-width: 900px)` | `.projectsBand .projectGrid` |
| 10242 | `@container (max-width: 680px)` | `.projectsBand .projectGrid` |
| 10790 | `@media (max-width: 620px)` | `.nextStepRow.sourceListRow` |
| 10818 | `@media (hover: none)` | `.sourceRowMenu` |
| 10843 | `@container (max-width: 820px)` | `.todayGrid` |
| 10849 | `@container (max-width: 520px)` | `.todayGrid` |
| 10855 | `@media (max-width: 900px)` | `.todayGrid` |
| 10866 | `@media (max-width: 820px)` | `.projectsBand .disclosureDescription` ほか |
| 10872 | `@media (max-width: 620px)` | `.todayNextBatch` |
| 11166 | `@media (max-width: 560px)` | `.startEnvironmentSelected` |
| 11204 | `@media (max-width: 920px)` | `.weeklyReviewBlockHeading` |
| 11498 | `@media (prefers-reduced-motion: reduce)` | `.victoryBar--reward` |
| 11657 | `@media (max-width: 620px)` | `.instructionPickerHeader` |
| 11918 | `@media (max-width: 860px)` | `.recordsViewHeader` |
| 11939 | `@media (max-width: 620px)` | `.recordsStats` |
| 12058 | `@media (hover: hover) and (pointer: fine)` | `.mainActionButton:hover:not(:disabled):not([aria-disabled="true"])` |
| 12091 | `@media (prefers-reduced-motion: reduce)` | `.mainActionButton` |
| 12284 | `@media (max-width: 700px)` | `.mainScrollContent:is([data-main-display-size="large"], [data-main-display-size="xlarge"]) .todayGrid` |
| 12301 | `@media (min-width: 1051px)` | `.mainPanel[data-main-display-size="large"] .topPills .viewToggleButton` |
| 12673 | `@media (min-width: 1051px)` | `.mainPanel[data-main-display-size="large"] .windowControls--dashboard` |
| 12685 | `@media (max-width: 760px)` | `.windowControls--dashboard` |
| 12823 | `@media (prefers-reduced-motion: reduce)` | `.windowControlsButtons` |
| 12869 | `@media (prefers-reduced-motion: reduce)` | `.windowTimerLineFill` |
| 12897 | `@media (max-width: 760px)` | `.modalDragBand` |
| 12903 | `@media (min-width: 1051px)` | `.appShell--dashboard[data-main-display-size="large"] .modalDragBand` |

### A-4 表示サイズ（標準・大・特大）の仕組み

| 項目 | 場所 |
| --- | --- |
| 設定の型 | `src/types.ts:202`（`mainDisplaySize: z.enum(["standard", "large", "xlarge"]).optional()`） |
| 設定ダイアログの下書きの型 | `src/App.tsx:422-423`（`SettingsCenterDraft.mainDisplaySize`） |
| 選択肢を出す場所 | `src/App.tsx:13775-13799`。`<section className="settingsDisplay" aria-labelledby="settings-display-title">` の中の `<legend>メイン表示サイズ</legend>`、`(["standard", "large", "xlarge"] as const).map(...)`（13780）、表示名は 13792 の `size === "standard" ? "標準" : size === "large" ? "大" : "特大"` |
| 選んだときの動き | `src/App.tsx:13785-13787`。`setSettingsDraft({ ...settingsDraft, mainDisplaySize: size })`（この時点では保存しない） |
| ダイアログを開くときの初期値 | `src/App.tsx:3801`（`config.settings.mainDisplaySize ?? "standard"`） |
| 変更ありの判定 | `src/App.tsx:3825` |
| 保存 | `src/App.tsx:4678-4680` で `settings: { ...config.settings, mainDisplaySize: settingsDraft.mainDisplaySize, ... }` を作り、`persistConfig`（3289）→ `saveConfig`（`src/tauri.ts:59-61`） |
| 保存後の再適用 | `persistConfig` 内の `await reapplyDashboardSettings()`（`src/App.tsx:3331`）、設定保存後 4705、ショートカット適用後 4788。実体は `src/tauri.ts:119-121` の `invoke("reapply_dashboard_settings")` → `src-tauri/src/startup.rs:15-18` → `apply_dashboard_settings` |
| Rust 側の扱い | `main_display_size` は `src-tauri/src/models.rs:379`（`Option<String>`）と 832（既定 `None`）、スキーマ `src-tauri/src/commands/config.rs:2169`（`"enum": ["standard", "large", "xlarge"], "default": "standard"`）にだけ現れる。Rust 側でこの値から窓の大きさを変える処理は見つからなかった。 |
| HTML への反映（1） | `src/App.tsx:9721`。`<main>` に `data-main-display-size={config.settings.mainDisplaySize ?? "standard"}` |
| HTML への反映（2） | `src/App.tsx:10449`。`<section className="mainPanel">` にも同じ属性 |
| HTML への反映（3） | `src/App.tsx:10575-10577`。`.mainScrollContent` には `activeView === "main"` のときだけ付く（記録画面では付かない） |
| 上部メニューの実測への影響 | `src/App.tsx:2119`（`measureKey: config ? (config.settings.mainDisplaySize ?? "standard") : "loading"`） |
| CSS: 標準の基準値 | `src/styles.css:7829-7836`（`.mainPanel` の `--dashboard-font-page: 22px` / `--dashboard-font-action: 17px` / `--dashboard-font-section: 14px` / `--dashboard-font-body: 13px` / `--dashboard-font-project: 14px` / `--dashboard-font-meta: 11px`） |
| CSS: 大 | `src/styles.css:12211-12222`（`.mainScrollContent[data-main-display-size="large"]`。`width: min(100%, 1298px)`、`--dashboard-font-action: 19px`、`--dashboard-font-section: 16px`、`--dashboard-font-body: 14px`、`--dashboard-font-project: 15px`、`--dashboard-font-meta: 12px`、`--main-control-height: 34px`、`--main-row-height: 53px`、`--main-band-spacing: 15px`、`--main-card-padding: 17px`） |
| CSS: 特大 | `src/styles.css:12224-12235`（`.mainScrollContent[data-main-display-size="xlarge"]`。`width: min(100%, 1400px)`、`--dashboard-font-action: 20px`、`--dashboard-font-section: 17px`、`--dashboard-font-body: 16px`、`--dashboard-font-project: 17px`、`--dashboard-font-meta: 13px`、`--main-control-height: 38px`、`--main-row-height: 57px`、`--main-band-spacing: 18px`、`--main-card-padding: 19px`） |
| CSS: 大・特大で共通に効く規則 | 12237-12240（帯の上下の余白）、12242-12245（節バーの高さ）、12247-12250（今やる一手の余白）、12252-12255（行の高さ）、12257-12260（やりたいことの行 40px）、12262-12267（`.mainActionButton`）、12269-12272、12274-12277、12279-12282（`.todayGrid` のすき間 12px）、12284-12288（幅 700px 以下では 8px） |
| CSS: 上の段の幅 | 12293-12299（`.mainPanel[data-main-display-size="large"] > .topBar { width: min(100%, 1298px) }`、xlarge は 1400px）、12633-12639（右余白の計算） |
| CSS: 上部メニューのボタン | 12301-12336（`@media (min-width: 1051px)` の中で、large は高さ 35px / 文字 12px、xlarge は高さ 40px / 文字 14px / アイコン 20px / `.topPills` の余白 3px / `.topPillGroup` のすき間 4px） |
| CSS: 窓のボタン | 12673-12683（`@media (min-width: 1051px)`。large は高さ 39px、xlarge は 46px） |
| CSS: ダイアログの幕の帯 | 12903-12911（large 61px、xlarge 68px） |
| 標準用のセレクタ | `[data-main-display-size="standard"]` に一致する規則は `src/styles.css` に無い（grep で 0 件）。標準は上記の基準値と、属性が付かないときの既定の見た目になる。 |

### A-5 `prefers-reduced-motion` の扱い

CSS（`src/styles.css`）

| 行 | 止めている物 |
| --- | --- |
| 5469-5475 | `.toast`, `.toast--leaving`, `.toastLifetime` の `animation-duration: 1ms`（トーストの出入りと寿命のバー） |
| 6403-6407 | `.helpGuideBody` の `scroll-behavior: auto`（使い方の滑らかなスクロール） |
| 7165-7170 | `.softwareResetProgressIndicator` の `animation: none` と `border-color: var(--accent)`（リセット中の回転） |
| 7821-7826 | `.dictionaryTileItem` の `animation: none !important` / `transition: none !important` |
| 11498-11538 | `.victoryBar--reward`, `.victoryRewardSweep`, `.victoryBadge--reward`, `.todayRow--justCompleted`, `.todayRow--justCompleted .todayCompletionStatus--complete`, `.todayGrid--allCompleteReward`, `.todayAllCompletionReward`, `.completionParticle` の `animation` と `transform` を止める。`.victoryRewardSweep` と `.completionParticleLayer` は `display: none`。`.doNowStartPrimary`, `.doNowStartSecondary`, `.todayStartButton`, `.timerStartHoverGlyph` と各 `::after` / `.nextStepStartGlyph` の `transition: none`。hover / focus-visible / active の `transform: none` |
| 12091-12105 | `.mainActionButton` の `transition` から `transform` を外した 4 種類だけにし、hover / focus-visible / active の `transform: none` |
| 12823-12828 | `.windowControlsButtons`, `.windowControlButton` の `transition-duration: 0s` |
| 12869-12873 | `.windowTimerLineFill` の `transition: none`（窓の上端のタイマーの線の伸び） |

JS

| ファイル:行 | 内容 |
| --- | --- |
| `src/components/HelpGuideDialog.tsx:16-18` | `prefersReducedMotion()`（`window.matchMedia("(prefers-reduced-motion: reduce)").matches`） |
| `src/components/HelpGuideDialog.tsx:200-217` | 目次の移動で `behavior: reducedMotion ? "auto" : "smooth"`、移動先の解除タイマーも `reducedMotion ? 0 : 900` |
| `src/components/DictionaryWindow.tsx:872-891` | 辞書タイルの並べ替えの FLIP アニメーション（`node.animate`）を、`prefers-reduced-motion: reduce` のときは行わない（875 行で早期 return） |

補足（事実）: `@keyframes spin` を使う `.spinner` / `.loadingMark`（`src/styles.css:7708-7733`）と、`@keyframes software-reset-spin` を使う回転（`src/styles.css:7150-7163`）のうち、`softwareResetProgressIndicator` 以外は reduced motion の規則が無い。

## B. 色・字・形の決まり

前提（実測）: `src/styles.css` は 13,074 行。CSS ファイルは `src/styles.css` の 1 つだけ（`src/` 配下に他の `.css` は無い）。`index.html` に `<style>`・`style=` 属性・`font-family` は 0 件。`src/*.tsx` に `fontFamily`・`var(--…)`・`borderRadius` の記述は 0 件（色・字・形はすべて CSS 側で決まっている）。

---

### B-1. `:root` の CSS 変数

`:root` は `src/styles.css:1` の 1 箇所だけ（`:root` の出現はファイル内で 1 件）。ブロックは `src/styles.css:1-76`。

`:root` 内のカスタムプロパティ以外の宣言:

| 行 | 宣言 |
|---|---|
| `src/styles.css:2` | `color: #f4f0e8;` |
| `src/styles.css:3` | `background: #161512;` |
| `src/styles.css:5` | `font-family: "Segoe UI", "Yu Gothic UI", "Meiryo", system-ui, sans-serif;` |
| `src/styles.css:6` | `font-synthesis: none;` |
| `src/styles.css:7` | `text-rendering: optimizeLegibility;` |
| `src/styles.css:8` | `-webkit-font-smoothing: antialiased;` |

変数 67 個。出現数は `var(--名前)` の**マッチ数**（`src/styles.css` 全体／`src/App.tsx`・他の `.tsx` は 0）。行数で数えた場合と差が出るのは `--radius` だけ（マッチ 144・行 142。1 行に 2 回出る行がある）。定義行の中に `var()` を含むものがあるため、その分（`--surface` 3、`--surface-strong` 1、`--surface-soft` 1、`--muted` 1）は出現数に定義行自身を含む。

| 変数名 | 値 | 行 | 出現数 |
|---|---|---|---|
| `--app-background` | `#161512` | `src/styles.css:4` | 2 |
| `--surface` | `#211f1a` | `src/styles.css:9` | 48 |
| `--surface-strong` | `#2b2922` | `src/styles.css:10` | 34 |
| `--surface-soft` | `#1b1a17` | `src/styles.css:11` | 61 |
| `--line` | `#4a4639` | `src/styles.css:12` | 121 |
| `--line-soft` | `#353126` | `src/styles.css:13` | 96 |
| `--text` | `#f4f0e8` | `src/styles.css:14` | 165 |
| `--muted` | `#b8b0a0` | `src/styles.css:15` | 146 |
| `--text-muted-readable` | `#a39c8e` | `src/styles.css:16` | 66 |
| `--accent` | `#e7b94d` | `src/styles.css:17` | 111 |
| `--accent-strong` | `#ffce5b` | `src/styles.css:18` | 86 |
| `--good` | `#6fcf97` | `src/styles.css:19` | 53 |
| `--warn` | `#f2a65a` | `src/styles.css:20` | 19 |
| `--error` | `#f06f68` | `src/styles.css:21` | 18 |
| `--control-primary-bg` | `#d8d1c3` | `src/styles.css:22` | 6 |
| `--control-primary-text` | `#181713` | `src/styles.css:23` | 4 |
| `--control-primary-hover-bg` | `#e9e1d2` | `src/styles.css:24` | 2 |
| `--control-primary-hover-border` | `#f4ecdd` | `src/styles.css:25` | 2 |
| `--control-primary-active-bg` | `#c8c0b2` | `src/styles.css:26` | 2 |
| `--control-primary-active-border` | `#c5bdaf` | `src/styles.css:27` | 2 |
| `--control-positive-bg` | `#27342b` | `src/styles.css:28` | 14 |
| `--control-positive-hover-bg` | `#304235` | `src/styles.css:29` | 15 |
| `--control-positive-active-bg` | `#223128` | `src/styles.css:30` | 8 |
| `--control-positive-hover-border` | `rgba(117, 196, 143, 0.7)` | `src/styles.css:31` | 13 |
| `--control-positive-active-border` | `rgba(117, 196, 143, 0.58)` | `src/styles.css:32` | 8 |
| `--control-short-bg` | `#252d38` | `src/styles.css:33` | 3 |
| `--control-short-hover-bg` | `#303b4a` | `src/styles.css:34` | 2 |
| `--control-short-active-bg` | `#202b38` | `src/styles.css:35` | 1 |
| `--control-short-hover-border` | `rgba(169, 208, 255, 0.7)` | `src/styles.css:36` | 2 |
| `--control-short-active-border` | `rgba(169, 208, 255, 0.58)` | `src/styles.css:37` | 1 |
| `--control-danger-bg` | `#3b2823` | `src/styles.css:38` | 6 |
| `--control-danger-hover-bg` | `#4a302a` | `src/styles.css:39` | 7 |
| `--control-danger-active-bg` | `#32231f` | `src/styles.css:40` | 5 |
| `--control-danger-hover-border` | `rgba(240, 111, 104, 0.72)` | `src/styles.css:41` | 5 |
| `--control-danger-active-border` | `rgba(240, 111, 104, 0.6)` | `src/styles.css:42` | 4 |
| `--control-neutral-bg` | `var(--surface)` | `src/styles.css:43` | 7 |
| `--control-neutral-hover-bg` | `var(--surface-strong)` | `src/styles.css:44` | 30 |
| `--control-neutral-active-bg` | `var(--surface-soft)` | `src/styles.css:45` | 5 |
| `--menu-surface` | `#29261f` | `src/styles.css:46` | 1 |
| `--menu-hover-bg` | `rgba(184, 176, 160, 0.12)` | `src/styles.css:47` | 2 |
| `--menu-active-bg` | `rgba(184, 176, 160, 0.2)` | `src/styles.css:48` | 1 |
| `--menu-danger-hover-bg` | `rgba(240, 111, 104, 0.12)` | `src/styles.css:49` | 4 |
| `--menu-danger-active-bg` | `rgba(240, 111, 104, 0.2)` | `src/styles.css:50` | 1 |
| `--dialog-surface` | `var(--surface)` | `src/styles.css:51` | 8 |
| `--dialog-shadow` | `0 24px 60px rgba(0, 0, 0, 0.42)` | `src/styles.css:52` | 3 |
| `--overlay-scrim` | `rgba(12, 11, 9, 0.68)` | `src/styles.css:53` | 2 |
| `--overlay-scrim-strong` | `rgba(12, 11, 9, 0.72)` | `src/styles.css:54` | 1 |
| `--dictionary-selected-bg` | `rgba(231, 185, 77, 0.08)` | `src/styles.css:55` | 11 |
| `--empty-state-text` | `var(--muted)` | `src/styles.css:56` | 2 |
| `--dashboard-action-surface` | `var(--surface)` | `src/styles.css:57` | 2 |
| `--dashboard-action-start-bg` | `#203126` | `src/styles.css:58` | 1 |
| `--control-primary-active-shadow` | `inset 0 1px 0 rgba(24, 23, 19, 0.16)` | `src/styles.css:59` | 2 |
| `--control-press-shadow` | `inset 0 1px 0 rgba(0, 0, 0, 0.2)` | `src/styles.css:60` | 7 |
| `--control-danger-press-shadow` | `inset 0 1px 0 rgba(0, 0, 0, 0.22)` | `src/styles.css:61` | 4 |
| `--control-neutral-press-shadow` | `inset 0 1px 0 rgba(0, 0, 0, 0.22)` | `src/styles.css:62` | 8 |
| `--control-warning-hover-bg` | `rgba(242, 166, 90, 0.2)` | `src/styles.css:63` | 1 |
| `--control-warning-active-bg` | `rgba(242, 166, 90, 0.1)` | `src/styles.css:64` | 1 |
| `--dialog-elevated-shadow` | `0 28px 70px rgba(0, 0, 0, 0.48)` | `src/styles.css:66` | 1 |
| `--menu-shadow` | `0 18px 40px rgba(0, 0, 0, 0.38)` | `src/styles.css:67` | 2 |
| `--radius` | `8px` | `src/styles.css:68` | 144 |
| `--scrollbar-size` | `8px` | `src/styles.css:69` | 4 |
| `--scrollbar-track` | `transparent` | `src/styles.css:70` | 2 |
| `--scrollbar-thumb` | `rgba(210, 205, 190, 0.24)` | `src/styles.css:71` | 2 |
| `--scrollbar-thumb-hover` | `rgba(210, 205, 190, 0.42)` | `src/styles.css:72` | 1 |
| `--scrollbar-thumb-active` | `rgba(210, 205, 190, 0.56)` | `src/styles.css:73` | 1 |
| `--scrollbar-radius` | `999px` | `src/styles.css:74` | 1 |
| `--scrollbar-thumb-border` | `2px` | `src/styles.css:75` | 1 |

上記 67 個はいずれも**定義は 1 箇所だけ**（ファイル内に再定義・メディアクエリ内での上書きは無い）。

`:root` の外で定義されているカスタムプロパティ（B-1 の対象外だが、色・字・形の決定に効くので記載）:

| 変数 | 定義行 | 値 |
|---|---|---|
| `--project-color` | `src/styles.css:83,86,89,92,95,98,101,104,107,110,113,116` | 12 色（B-4 参照） |
| `--dashboard-font-page` | `src/styles.css:7830` | `22px` |
| `--dashboard-font-action` | `src/styles.css:7831,12213,12226` | `17px` / `19px` / `20px` |
| `--dashboard-font-section` | `src/styles.css:7832,12214,12227` | `14px` / `16px` / `17px` |
| `--dashboard-font-body` | `src/styles.css:7833,12215,12228` | `13px` / `14px` / `16px` |
| `--dashboard-font-project` | `src/styles.css:7834,12216,12229` | `14px` / `15px` / `17px` |
| `--dashboard-font-meta` | `src/styles.css:7835,12217,12230` | `11px` / `12px` / `13px` |
| `--main-control-height` | `src/styles.css:12218,12231` | `34px` / `38px` |
| `--main-row-height` | `src/styles.css:12219,12232` | `53px` / `57px` |
| `--main-band-spacing` | `src/styles.css:12220,12233` | `15px` / `18px` |
| `--main-card-padding` | `src/styles.css:12221,12234` | `17px` / `19px` |
| `--main-action-bg` | `src/styles.css:10289,10300,11281,11991,12018,12029,12467` | 各所 |
| `--main-action-hover-bg` | `src/styles.css:9751,10189,10290,10301,11282,11992,12019,12030` | 各所 |
| `--main-action-hover-border` | `src/styles.css:9752,10190,10293,10304,11285,11995,12022,12033,12469` | 各所 |
| `--main-action-hover-color` | `src/styles.css:9753,10191,10296,10307,11288,11998,12025,12036,12471` | 各所 |
| `--main-action-border` | `src/styles.css:10292,10303,11284,11994,12021,12032,12468` | 各所 |
| `--main-action-active-bg` | `src/styles.css:10291,10302,11283,11993,12020,12031` | 各所 |
| `--main-action-active-border` | `src/styles.css:10294,10305,11286,11996,12023,12034,12470` | 各所 |
| `--main-action-color` | `src/styles.css:10295,10306,11287,11997,12024,12035` | 各所 |
| `--today-picker-font-body` | `src/styles.css:9026` | `13px` |
| `--today-picker-font-meta` | `src/styles.css:9027` | `11px` |
| `--today-activity-end-inset` | `src/styles.css:4393` | （`src/styles.css:4393` の 1 行のみ） |
| `--completion-x` / `--completion-y` | `src/styles.css:11382-11383, 11386-11387, 11391-11392, 11396-11397, 11401-11402, 11406-11407` | 完了演出の粒子の移動量 |
| `--window-controls-close-top-offset` | `src/styles.css:12662,12668,12675,12680,12688` | ウィンドウ操作ボタンの位置補正 |

`--ok` という変数、`--neutral` という変数は**存在しない**（`:root` にあるのは `--good`、中立色は `--control-neutral-*` 系）。名前に `--danger` を含むカスタムプロパティも存在せず、危険色は `--control-danger-*` 系。

---

### B-2. `font-family` を書いている所（全部）

`src/styles.css` に 8 件。`font-family` はこの 8 件以外に無い。

| 行 | セレクタ | 値 |
|---|---|---|
| `src/styles.css:5` | `:root` | `"Segoe UI", "Yu Gothic UI", "Meiryo", system-ui, sans-serif` |
| `src/styles.css:1959` | `.instructionEditorTextarea`（ブロックは `src/styles.css:1949-1963`） | `"Cascadia Mono", "Consolas", monospace` |
| `src/styles.css:2054` | `.instructionMarkdown code,` / `.instructionPlainText`（セレクタは `src/styles.css:2052-2053`） | `"Cascadia Mono", "Consolas", monospace` |
| `src/styles.css:2527` | `.shortcutBadge`（ブロックは `src/styles.css:2521-2530`） | `inherit` |
| `src/styles.css:3005` | `.expandedTimerClock`（ブロックは `src/styles.css:3002-3011`） | `Consolas, "Cascadia Mono", monospace` |
| `src/styles.css:6241` | `.helpGuideCodeBlock pre`（ブロックは `src/styles.css:6233-6245`） | `"Cascadia Mono", Consolas, monospace` |
| `src/styles.css:6877` | `.shortcutCaptureValue kbd`（ブロックは `src/styles.css:6873-6882`） | `inherit` |
| `src/styles.css:12950` | `.importTextarea`（ブロックは `src/styles.css:12947-12953`） | `ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace` |

関連する事実:
- `@font-face` は 0 件、`@import` は 0 件（フォントは OS のものだけを使う）。
- フォント指定を「継承させる」書き方（`font: inherit`）が 4 件: `src/styles.css:458`（`.dictionarySearchInput`）、`src/styles.css:2302`（`button, input, textarea`、ブロックは `src/styles.css:2299-2303`）、`src/styles.css:2867`（`.projectIdentityName`）、`src/styles.css:3160`（`.timerPresetInputWrap input`）。
- 等幅フォントの指定は 5 通りに分かれている（`"Cascadia Mono", "Consolas", monospace` 1959/2054、`Consolas, "Cascadia Mono", monospace` 3005、`"Cascadia Mono", Consolas, monospace` 6241、`ui-monospace, SFMono-Regular, Consolas, "Liberation Mono", monospace` 12950）。

---

### B-3. 角の丸み（`border-radius`）の値と回数

宣言は全部で 212 件（すべて 1 行で完結。複数行にまたがる `border-radius` は無い）。トークンは `--radius: 8px`（`src/styles.css:68`）と `--scrollbar-radius: 999px`（`src/styles.css:74`）。下の表の「行」はすべて `src/styles.css` の行番号。

| 値 | 回数 | 行 |
|---|---|---|
| `var(--radius)` | 139 | 多数（列挙省略） |
| `6px` | 13 | `1121, 1246, 1279, 1291, 1550, 2071, 2350, 2523, 2940, 3381, 3902, 5573, 10095` |
| `50%` | 11 | `1735, 2858, 4116, 4435, 5239, 7155, 7464, 7714, 10379, 10389, 10515` |
| `0` | 8 | `4468, 4614, 8140, 10348, 10495, 10612, 11746, 11857` |
| `999px` | 8 | `2439, 3091, 3725, 3966, 4126, 5014, 9115, 10131` |
| `4px` | 8 | `1368, 1490, 1561, 2061, 2810, 3021, 6210, 6261` |
| `5px` | 6 | `1523, 1801, 1911, 2251, 2271, 11064` |
| `2px` | 5 | `4693, 6006, 6044, 8329, 10651` |
| `8px` | 3 | `5936, 5964, 8495` |
| `inherit` | 2 | `3098, 9123` |
| `var(--scrollbar-radius)` | 1 | `141` |
| `3px` | 1 | `10104` |
| `1px` | 1 | `11375` |
| `7px` | 1 | `10456` |
| `11px` | 1 | `5327` |
| `calc(var(--radius) - 2px)` | 1 | `858` |
| `var(--radius) var(--radius) 0 0` | 1 | `11691` |
| `0 var(--radius) var(--radius) 0` | 1 | `1713` |
| `0 0 6px 6px !important` | 1 | `5596` |

`6px` を使っているセレクタ（13 件）: `.instructionIconButton`（1121）、`.instructionSearchField`（1246）、`.instructionTreeRefresh`（1279）、`.instructionTreeLoad`（1291）、`.instructionContextMenu`（1550）、`.instructionMarkdown pre`（2071）、`.skipLink`（2350）、`.shortcutBadge`（2523）、`.expandedTimerClose`（2940）、`.viewToggleButton`（3381）、`.victoryTextButton`（3902）、`.contextMenu button`（5573）、`.sourceLockBadge`（10095）。

`999px` を使っているセレクタ（8 件）: `.testProfileBadge`（2439）、`.timerProgress`（3091）、`.timerStateBadge`（3725）、`.suggestionChip`（3966）、`.doNowProjectChip`（4126）、`.runningBadge`（5014）、`.todayPickerProgress`（9115）、`.nextStepTodayStatus`（10131）。

---

### B-4. プロジェクト色の仕組み（`data-project-color` と `--project-color`）

#### 色の定義

`--project-color` は `:root` には無く、属性セレクタ 12 個で定義されている（`src/styles.css:82-117`）。

| `data-project-color` の値 | `--project-color` | 行 |
|---|---|---|
| `amber` | `#e7b94d` | `src/styles.css:82-83` |
| `blue` | `#70a7ff` | `src/styles.css:85-86` |
| `green` | `#6fcf97` | `src/styles.css:88-89` |
| `violet` | `#b58cff` | `src/styles.css:91-92` |
| `rose` | `#f184a7` | `src/styles.css:94-95` |
| `cyan` | `#56c9d8` | `src/styles.css:97-98` |
| `orange` | `#f2a65a` | `src/styles.css:100-101` |
| `slate` | `#a8b2c1` | `src/styles.css:103-104` |
| `lime` | `#b5d35c` | `src/styles.css:106-107` |
| `magenta` | `#e07ad6` | `src/styles.css:109-110` |
| `sand` | `#c9ab82` | `src/styles.css:112-113` |
| `coral` | `#ff8b78` | `src/styles.css:115-116` |

値の出どころ（JS 側）:
- `src/projectIdentity.ts:18-24` `PROJECT_COLOR_IDS` = 上記 12 色の並び。
- `src/projectIdentity.ts:7-16` `AUTO_PROJECT_COLOR_IDS` = 最初の 8 色（`amber`〜`slate`）。
- `src/projectIdentity.ts:41-51` `resolveProjectColorId(projectId, colorId)`: `colorId` があればそれを返し、無ければ `projectId` を `hash = (hash * 31 + charCode) >>> 0` で畳んで `AUTO_PROJECT_COLOR_IDS[hash % 8]` を返す。
- `src/projectIdentity.ts:26-39` `PROJECT_COLOR_LABELS`（`アンバー` / `ブルー` / `グリーン` / `バイオレット` / `ローズ` / `シアン` / `オレンジ` / `スレート` / `ライム` / `マゼンタ` / `サンド` / `コーラル`）。

#### どの部品の、どの辺に色の線が出るか

| 部品 | セレクタ | 行 | 辺 | 値 |
|---|---|---|---|---|
| 次の一手カード | `.doNowContent[data-project-color]` | `src/styles.css:4077-4080` | 左 | `border-left: 3px solid var(--project-color);` + `padding-left: 12px;` |
| 同上（後ろの上書き・余白だけ） | `.doNowContent[data-project-color]` | `src/styles.css:7935-7937` | 左の内側余白のみ | `padding-left: 10px;`（**最終値は 10px**。4079 の 12px を上書き） |
| 次の一手カード（保留中） | `.doNowContent--hold, .doNowContent--hold:hover` | `src/styles.css:11253-11260` | 左 | `border-left: 3px solid var(--good);`（**プロジェクト色ではなく緑**）+ `padding-left: 12px;` + `border-color: rgba(111, 207, 151, 0.58);` |
| 今日の3件カード | `.todayRow[data-project-color]` | `src/styles.css:8571-8573` | 上 | `border-top: 2px solid var(--project-color);`（基本の `border: 1px solid var(--line)` は `src/styles.css:8530`） |
| 今日の3件のドラッグ影 | `.todayDragGhost[data-project-color]` | `src/styles.css:8306-8308` | 上 | `border-top: 2px solid var(--project-color);` |
| 次の一手カード（プロジェクト一覧のタイル） | `.nextStepCard::before` | `src/styles.css:10031-10037` | 左（疑似要素） | `inset: 0 auto 0 0; width: 3px; background: var(--project-color);` |
| やりたいこと（プロジェクト別の行） | `.wishlistGroup .inboxRow.sourceListRow` | `src/styles.css:10607-10614` | 左 | `border-left: 3px solid var(--project-color, var(--line));` + `border-radius: 0;` + `padding-left: 12px;` |
| 同上（未割当グループ） | `.wishlistGroup--unassigned .inboxRow.sourceListRow` | `src/styles.css:10616-10618` | 左の色だけ | `border-left-color: var(--line);` |
| 記録ダイアログのプロジェクト表示 | `.sessionProjectIdentity` | `src/styles.css:7478-7483` | 左 | `border-left: 3px solid var(--project-color, var(--line));` |
| 手順書の「次の一手」プレビュー | `.instructionProjectLinkPreview` | `src/styles.css:1708-1716` | 左 | `border-left: 3px solid var(--project-color);` + `border-radius: 0 var(--radius) var(--radius) 0;` |
| プロジェクト識別の丸 | `.projectIdentityDot` | `src/styles.css:2854-2861` | 丸（9px） | `background: var(--project-color, var(--accent));` + `box-shadow: 0 0 0 2px color-mix(in srgb, var(--project-color, var(--accent)) 18%, transparent);` |
| プレビュー内の小丸 | `.instructionProjectLinkProject i` | `src/styles.css:1731-1737` | 丸（7px） | `background: var(--project-color);` |
| 次の一手の見出し文字 | `.doNowKicker h2` | `src/styles.css:4102-4110` | 文字色 | `color: var(--project-color, var(--good));` |
| 次の一手の状態点 | `.doNowStatusDot` | `src/styles.css:4112-4119` | 丸（8px） | `background: var(--project-color, var(--good));` + `box-shadow: 0 0 0 3px color-mix(... 18%, transparent);` |
| 色見本の丸 | `.projectColorSwatch > span` | `src/styles.css:7461-7466` | 丸（16px） | `background: var(--project-color);` |
| 色見本（選択中） | `.projectColorSwatch--selected` | `src/styles.css:7473-7476` | 枠 | `border-color: var(--project-color);` + `box-shadow: 0 0 0 1px var(--project-color);` |
| 次の一手の破線プレースホルダ | `.nextStepCard .nextStepActionRegion .projectNextStepPlaceholder` | `src/styles.css:10172-10186` | 破線枠 | `border: 1px dashed color-mix(in srgb, var(--project-color) 52%, var(--line));` + `background: color-mix(in srgb, var(--project-color) 5%, transparent);` |

`var(--project-color)` に **fallback が無い**箇所（すべて `src/styles.css`）: `src/styles.css:1712`（`border-left`）、`src/styles.css:4078`、`src/styles.css:4083`、`src/styles.css:4084`、`src/styles.css:7465`、`src/styles.css:7474`、`src/styles.css:7475`、`src/styles.css:8307`、`src/styles.css:8572`、`src/styles.css:10035`、`src/styles.css:10041`、`src/styles.css:10042`、`src/styles.css:10048`、`src/styles.css:10178`、`src/styles.css:10181`。**fallback がある**箇所: `src/styles.css:2859`・`src/styles.css:2860`（`var(--accent)`）、`src/styles.css:4107`・`src/styles.css:4117`・`src/styles.css:4118`（`var(--good)`）、`src/styles.css:7480`・`src/styles.css:10611`（`var(--line)`）。

#### 乗せたとき（hover / focus）の決まり

| セレクタ | 行 | 値 |
|---|---|---|
| `.doNowContent:hover` | `src/styles.css:4071-4075` | `border-color: var(--accent);` `background: var(--control-neutral-hover-bg);` `transform: translateY(-1px);` |
| `.doNowContent[data-project-color]:hover` | `src/styles.css:4082-4085` | `border-color: var(--project-color);` `background: color-mix(in srgb, var(--project-color) 7%, var(--dashboard-action-surface));` |
| `.todayRow:not(.todayRow--dragging):hover, :focus-within` | `src/styles.css:8540-8545` | `border-color: var(--accent);` `background: var(--control-neutral-hover-bg);` `transform: translateY(-1px);` |
| `.todayRow--running:not(.todayRow--dragging):hover, :focus-within` | `src/styles.css:8547-8550` | `border-color: var(--accent);` |
| `.todayRow--complete:not(.todayRow--dragging):hover, :focus-within` | `src/styles.css:8552-8555` | `border-color: rgba(117, 196, 143, 0.48);` |
| `.todayRow[data-project-color]:not(.todayRow--dragging):hover, :focus-within` | `src/styles.css:8557-8560` | `border-color: var(--project-color);`（特異性が上 3 つより高く、最後に効く） |
| `.nextStepCard.nextStepRow.sourceListRow:not(.nextStepRow--dragging):hover, :focus-within` | `src/styles.css:10039-10045` | `border-color: var(--project-color);` `border-bottom-color: var(--project-color);` `background: var(--control-neutral-hover-bg);` `transform: translateY(-1px);` |
| `.nextStepCard.nextStepRow.sourceListRow:focus-visible` | `src/styles.css:10047-10050` | `outline: 2px solid var(--project-color);` `outline-offset: 2px;` |
| `.sourceListRow:not(...):hover, :focus-within` | `src/styles.css:9702-9710` | `background: var(--control-neutral-hover-bg);` `border-bottom-color: var(--line);`（左の色線は変更しない） |
| `.projectColorSwatch:hover` | `src/styles.css:7468-7471` | `border-color: var(--muted);` `background: var(--surface-strong);` |
| `.nextStepRow.sourceListRow:hover, :focus-within` | `src/styles.css:9848-9852` | `background: transparent;` `border-bottom-color: var(--line-soft);` |

`data-main-display-size="large"` / `"xlarge"` のときは `src/styles.css:12247-12250` が `.doNowContent` の `padding` を `var(--main-card-padding)`（`17px` / `19px`）で上書きする（左の線 `3px` 自体は残る）。

#### `data-project-color` を付けている JSX（App.tsx と各コンポーネント）

| 行 | 要素（className） | 値 |
|---|---|---|
| `src/App.tsx:10757-10762` | `<div className="doNowContent">`（次の一手カード） | `resolveProjectColorId(doNowSelection.project.id, doNowSelection.project.colorId)` |
| `src/App.tsx:11089-11107` | `<article className="todayRow …">`（今日の3件） | `project ? resolveProjectColorId(project.id, project.colorId) : undefined` |
| `src/App.tsx:11481-11491` | `<div className="todayDragGhost">`（ドラッグ影） | `draggedProject ? resolveProjectColorId(...) : undefined` |
| `src/App.tsx:11696-11709` | `nextStepCard`（プロジェクト一覧の次の一手） | `resolveProjectColorId(project.id, project.colorId)` |
| `src/App.tsx:12089-12103` | `<section className="wishlistGroup …">` | `groupProject ? resolveProjectColorId(groupProject.id, groupProject.colorId) : undefined` |
| `src/App.tsx:14197-14202` | `<div className="sessionProjectIdentity">`（実行記録を追加） | `resolveProjectColorId(manualSessionDraft.projectId, projectsById.get(...)?.colorId)` |
| `src/App.tsx:14318-14323` | `<div className="sessionProjectIdentity">`（実行記録を編集） | `resolveProjectColorId(sessionEditDraft.projectId, …)` |
| `src/App.tsx:15505-15513` | `<button className="projectColorSwatch …">`（色見本） | `data-project-color={colorId}`（`PROJECT_COLOR_IDS` をそのまま） |
| `src/components/ProjectIdentity.tsx:19-22` | `<span className="projectIdentity …">` | `resolveProjectColorId(projectId, colorId)`（常に付く） |
| `src/components/InstructionTree.tsx:1762-1766` | `<div className="instructionProjectLinkPreview">` | `selectedProjectLinkTarget.colorId` |

---

### B-5. 始めるボタンの CSS

対象 5 クラスの DOM 上の持ち主:
- `.doNowStartPrimary` `src/App.tsx:10877`（`aria-label` は `` `短時間タイマー${doNowShortTimerMinutes}分で始める` ``）
- `.doNowStartSecondary` `src/App.tsx:10890`（`` `通常タイマー${doNowDefaultTimerMinutes}分で開始` ``）
- `.doNowMeasureButton` `src/App.tsx:10903`（`aria-label="時間を決めずに計測"`）
- `.todayStartButton` `src/App.tsx:11332`（`todayStartButton todayStartButton--short`）と `src/App.tsx:11373`（`todayStartButton todayStartButton--normal`）。どちらも `.todayTimerCluster`（`src/App.tsx:11247`）の中。
- `.todayMeasureButton` `src/App.tsx:11414`（`.todayTimerCluster` の中）

共通の前提（以下、各表の「行」は `src/styles.css` の行番号。`src/` を明記したものはそのファイル）:
- `.doNowActions` = `display: flex; flex-wrap: wrap; align-items: center; justify-content: flex-end; gap: 7px;`（`src/styles.css:4192-4198`）。
- `.doNowActions button, .doNowEmpty button` = `flex: 0 0 auto; min-height: 38px; white-space: nowrap; border: 1px solid var(--line); border-radius: var(--radius); padding: 7px 11px; font-weight: 850;`（`src/styles.css:4200-4209`）。のちに `src/styles.css:7972-7977` が `min-height: 36px; font-size: var(--dashboard-font-meta); font-weight: 650;` で上書き（同じ特異性の後勝ち。ただし `min-height` は下記の (0,2,0) 規則が優先）。
- グローバルの `:focus-visible` = `outline: 2px solid var(--accent-strong); outline-offset: 2px;`（`src/styles.css:2314-2317`）。
- グローバルの `button:disabled` = `cursor: not-allowed; opacity: 0.5;`（`src/styles.css:2309-2312`）。この 5 クラス専用の `:disabled` 規則は無い。
- ホバー規則は `@media (hover: hover)` で囲まれていない（`.mainActionButton` の `src/styles.css:12058` とは違い、タッチでも `:hover` が効く）。

#### `.doNowStartPrimary`

| 状態 | 値 | 行 |
|---|---|---|
| ふつう | `border: 1px solid rgba(111, 207, 151, 0.45);` `border-radius: var(--radius);`（= `8px`） `background: var(--dashboard-action-start-bg);`（= `#203126`） `color: var(--good);`（= `#6fcf97`） `font-size: 12px;` `font-weight: 650;` `width: 112px; min-width: 112px; height: 38px; min-height: 38px; overflow: hidden; padding: 0;` `position: relative;` | 枠太さ・種類 `4205`／枠色 `4212`／角 `4206`／背景 `4213`／文字色 `4214`／文字寸法 `4215`・`7976`／寸法 `4220-4226` |
| 乗せた | `border-color: var(--control-positive-hover-border);`（= `rgba(117, 196, 143, 0.7)`） `background: var(--control-positive-hover-bg);`（= `#304235`） `transform: none;` `box-shadow: none;` | 色 `5117-5120`／打ち消し `5183-5189` |
| キーで選んだ | `border-color: var(--control-positive-hover-border);` `background: var(--control-positive-hover-bg);` `transform: none;` `box-shadow: none;` + 輪 `outline: 2px solid var(--accent-strong); outline-offset: 2px;` | 色 `5139-5143`／打ち消し `5183-5189`／輪 `2314-2317` |
| 押した | `border-color: var(--control-positive-active-border);`（= `rgba(117, 196, 143, 0.58)`） `background: var(--control-positive-active-bg);`（= `#223128`） `box-shadow: 0 2px 5px rgba(0, 0, 0, 0.18);` `transform: translateY(0) scale(0.985);` | 色 `5122-5125`／影と変形 `5176-5181`（`box-shadow` は 5125 の `var(--control-press-shadow)` を上書き） |
| 使えない | `opacity: 0.5; cursor: not-allowed;`（グローバル `button:disabled` のみ） | `2309-2312` |

補足: `src/App.tsx:10875-10887` の `<button>` に `disabled` は付いていない（＝このボタンは実際には無効化されない）。

#### `.doNowStartSecondary`

| 状態 | 値 | 行 |
|---|---|---|
| ふつう | `border: 1px solid rgba(169, 208, 255, 0.38);` `border-radius: var(--radius);` `background: var(--control-short-bg);`（= `#252d38`） `color: #a9d0ff;` `font-size: 12px;` `width: 112px; height: 38px; padding: 0;` | 枠太さ `4205`／枠色 `4271`／角 `4206`／背景 `4272`／文字色 `4273`／文字寸法 `4274`／寸法 `4220-4226` |
| 乗せた | `border-color: var(--control-short-hover-border);`（= `rgba(169, 208, 255, 0.7)`） `background: var(--control-short-hover-bg);`（= `#303b4a`） `transform: none;` `box-shadow: none;` | `5128-5132`／`5183-5189` |
| キーで選んだ | `border-color: var(--control-short-hover-border);` `background: var(--control-short-hover-bg);` `transform: none;` `box-shadow: none;` + 輪 `2px solid var(--accent-strong)` | `5145-5149`／`5183-5189`／`2314-2317` |
| 押した | `border-color: var(--control-short-active-border);`（= `rgba(169, 208, 255, 0.58)`） `background: var(--control-short-active-bg);`（= `#202b38`） `box-shadow: 0 2px 5px rgba(0, 0, 0, 0.18);` `transform: translateY(0) scale(0.985);` | `5151-5156`／`5176-5181` |
| 使えない | `opacity: 0.5; cursor: not-allowed;` | `2309-2312` |

補足: `src/App.tsx:10888-10900` に `disabled` は無い。

#### `.doNowMeasureButton`

| 状態 | 値 | 行 |
|---|---|---|
| ふつう | `border: 1px solid rgba(190, 181, 164, 0.32);` `border-radius: var(--radius);` `background: rgba(190, 181, 164, 0.08);` `color: #d1c9bb;` `font-size: 12px;` `width: 82px; min-width: 82px; height: 38px; min-height: 38px; padding: 0 10px; gap: 5px; position: relative; display: inline-flex;` | 枠太さ `4205`／枠色・背景・色 `4286-4288`／角 `4206`／寸法 `4284-4285`・`4297-4300` |
| 乗せた | `border-color: rgba(209, 201, 187, 0.62);` `background: rgba(190, 181, 164, 0.14);` `color: var(--text);` `transform: translateY(-1px);` | `4303-4311` |
| キーで選んだ | 乗せたと同じ（`4303-4311` に `:focus-visible` が併記） + 輪 `2px solid var(--accent-strong)` | `4304`／`2314-2317` |
| 押した | **専用の `:active` 規則は無い**（`.doNowMeasureButton:active` の出現 0 件） | — |
| 使えない | `opacity: 0.5; cursor: not-allowed;` | `2309-2312` |

#### `.todayStartButton`（`.todayTimerCluster` 内）

| 状態 | `--short` の値 | `--normal` の値 | 行 |
|---|---|---|---|
| ふつう | `border: 1px solid rgba(117, 196, 143, 0.36);` `border-radius: var(--radius);` `background: var(--control-positive-bg);`（`#27342b`） `color: var(--good);`（`#6fcf97`） | `border: 1px solid var(--line);`（`#4a4639`） `border-radius: var(--radius);` `background: var(--control-short-bg);`（`#252d38`） `color: #a9d0ff;` | 基本 `4874-4889`／`--short` `4891-4895`／`--normal` `4897-4900`／寸法 `8703-8707` |
| 乗せた | `border-color: var(--control-positive-hover-border);` `background: var(--control-positive-hover-bg);` `transform: translateY(-1px);` `box-shadow: 0 7px 16px rgba(0, 0, 0, 0.22), inset 0 1px 0 rgba(255, 255, 255, 0.03);` | `border-color: var(--control-short-hover-border);` `background: var(--control-short-hover-bg);` `transform: translateY(-1px);` `box-shadow:` 同上 | `--short` `5134-5137`／`--normal` `5128-5132`／変形と影 `5164-5174`（`5183-5189` の打ち消しは `.doNowStart*` だけで、こちらには掛からない） |
| キーで選んだ | `border-color: var(--control-positive-hover-border);` `background: var(--control-positive-hover-bg);` `transform: translateY(-1px);` `box-shadow:` 同上 + 輪 | `border-color: var(--control-short-hover-border);` `background: var(--control-short-hover-bg);` 同上 | `--short` `5139-5143`／`--normal` `5145-5149`／`5164-5174`／輪 `2314-2317` |
| 押した | `border-color: var(--control-positive-active-border);` `background: var(--control-positive-active-bg);` `box-shadow: 0 2px 5px rgba(0, 0, 0, 0.18);` `transform: translateY(0) scale(0.985);` | `border-color: var(--control-short-active-border);` `background: var(--control-short-active-bg);` 影・変形は同じ | `--short` `5158-5162`／`--normal` `5151-5156`／`5176-5181` |
| 使えない | `opacity: 0.5; cursor: not-allowed;`（`disabled={!item.text.trim()}` が付く） | 同左 | 属性 `src/App.tsx:11333`・`11374`／CSS `2309-2312` |

寸法は `.todayTimerCluster .todayStartButton` = `width: 82px; height: 36px; min-height: 36px;`（`src/styles.css:8703-8707`。基本の `width: 100px; height: 38px;`（`4876-4877`）を上書き）。

#### `.todayMeasureButton`

| 状態 | 値 | 行 |
|---|---|---|
| ふつう | `border-color: rgba(190, 181, 164, 0.32);` `background: rgba(190, 181, 164, 0.08);` `color: var(--muted);` `box-shadow: none;` `width: 34px; min-width: 34px; height: 36px; min-height: 36px; padding: 0; gap: 5px; position: relative;` | 色 `4278-4293`・`8709-8718`／寸法 `4849-4853`・`8709-8713` |
| 乗せた | `border-color: rgba(209, 201, 187, 0.62);` `background: rgba(190, 181, 164, 0.14);` `box-shadow: none;` `color: #d1c9bb;` `transform: none;` | `8720-8727`（同内容が `4303-4311` にもあるが、`transform: translateY(-1px)`・`color: var(--text)` はこちらが上書き） |
| キーで選んだ | 乗せたと同じ + 輪 `2px solid var(--accent-strong)` | `8721`／`2314-2317` |
| 押した | **専用の `:active` 規則は無い** | — |
| 使えない | `opacity: 0.5; cursor: not-allowed;`（`disabled={!item.text.trim()}` が付く） | 属性 `src/App.tsx:11415`／CSS `2309-2312` |

注意（事実）: `.todayMeasureButton` には `border` の**幅・種類**を設定する規則が `src/styles.css` 内に 1 つも無い（`border-color` だけが `4277-4294`・`8709-8718` で指定されている）。`.todayStartButton` は `4879` で `border: 1px solid var(--line)` を持つ。

#### 下の線（`::after`）の決まり

| 対象 | 行 | 値 |
|---|---|---|
| 5 クラス共通の基本 | `src/styles.css:10657-10672` | `position: absolute; right: 12px; bottom: 0; left: 12px; height: 2px; background: currentColor; content: ""; transform: scaleX(0); transform-origin: center; transition: transform 150ms ease;` |
| 5 クラスの乗せた／キーで選んだ | `src/styles.css:10674-10685` | `transform: scaleX(1);`（`:hover:not(:disabled)` と `:focus-visible` の両方） |
| `.todayMeasureButton` だけの左右 | `src/styles.css:10687-10690` | `right: 6px; left: 6px;`（基本の 12px を上書き） |
| 押した | — | **`:active` 用の `::after` 規則は無い**（線は出たまま） |
| 使えない | — | **`:disabled` 用の `::after` 規則は無い**（線は出ない／`transform: scaleX(0)` のまま） |

`background: currentColor` なので、線の色はそのボタンの文字色（`.doNowStartPrimary` は `var(--good)`、`.doNowStartSecondary` は `#a9d0ff`、`.doNowMeasureButton` は `#d1c9bb`、`.todayStartButton--short` は `var(--good)`、`.todayStartButton--normal` は `#a9d0ff`、`.todayMeasureButton` は `var(--muted)`）になる。

#### 動きを減らす設定のとき

`@media (prefers-reduced-motion: reduce)`（`src/styles.css:11498-11538`）:
- `transition: none !important;` の対象 = `.doNowStartPrimary`, `.doNowStartSecondary`, `.todayStartButton`, `.timerStartHoverGlyph`, `.doNowStartPrimary::after`, `.doNowStartSecondary::after`, `.todayStartButton::after`, `.todayStartButton .nextStepStartGlyph`（`11516-11525`）。
- `transform: none;` の対象 = `.doNowStartPrimary` / `.doNowStartSecondary` / `.todayStartButton` の `:hover:not(:disabled)`・`:focus-visible`・`:active:not(:disabled)`（`11527-11537`）。
- `.doNowMeasureButton` と `.todayMeasureButton` はこのどちらの一覧にも入っていない。

---

### B-6. 保存・キャンセル・閉じるボタンの色の決まり

#### 使われるクラスと色

（この表の「行」は `src/styles.css` の行番号）

| クラス | 役割 | ふつう | 乗せた | 押した | 行 |
|---|---|---|---|---|---|
| `.primaryButton`（基本） | 保存・決定 | `border: 1px solid var(--line);` `border-radius: var(--radius);` `min-height: 42px;` `background: var(--control-primary-bg);`（`#d8d1c3`） `color: var(--control-primary-text);`（`#181713`） `font-weight: 800;` | `border-color: var(--control-primary-hover-border);` `background: var(--control-primary-hover-bg);` | `border-color: var(--control-primary-active-border);` `background: var(--control-primary-active-bg);` `box-shadow: var(--control-primary-active-shadow);` | 基本 `4672-4676`・`4741-4746`／hover `4747-4750`／active `4752-4756` |
| `.formDialogActions .primaryButton` | 保存（緑） | `border-color: var(--good);` `background: var(--control-positive-bg);` `color: var(--good);` | `border-color: var(--control-positive-hover-border);` `background: var(--control-positive-hover-bg);` | `border-color: var(--control-positive-active-border);` `background: var(--control-positive-active-bg);` `box-shadow: var(--control-press-shadow);` | `11547-11550`／`11553-11556`／`11558-11561` |
| `.secondaryButton`（基本） | キャンセル等 | `border: 1px solid var(--line);` `border-radius: var(--radius);` `min-height: 34px;` `background: var(--control-positive-bg);` `color: var(--good);` `font-size: 12px;` `font-weight: 800;` | `border-color: var(--control-positive-hover-border);` `background: var(--control-positive-hover-bg);` | `border-color: var(--control-positive-active-border);` `background: var(--control-positive-active-bg);` `box-shadow: var(--control-press-shadow);` | `4672-4676`・`4758-4764`／`4765-4768`／`4770-4773` |
| `.secondaryButton.dialogCancelButton`（`.formDialogActions` 内） | キャンセル（赤） | `border-color: rgba(255, 128, 120, 0.42);` `background: var(--control-danger-bg);`（`#3b2823`） `color: #ffb4ad;` | `border-color: var(--control-danger-hover-border);` `background: var(--control-danger-hover-bg);` `color: #ffb4ad;` | `border-color: var(--control-danger-active-border);` `background: var(--control-danger-active-bg);` `box-shadow: var(--control-danger-press-shadow);` | `11564-11567`／`11570-11573`／`11576-11579` |
| `.dialogCancelButton`（単独） | — | `src/styles.css` に単独規則は無い（`.formDialogActions` の中のときだけ色が付く） | — | — | （`11564` のみ） |
| `.secondaryButton.settingsButton--neutral` | キャンセル・閉じる（中立） | `background: var(--surface);`（`#211f1a`） `color: var(--muted);`（`#b8b0a0`） | `border-color: var(--muted);` `background: var(--control-neutral-hover-bg);` `color: var(--text);` `box-shadow: 0 5px 14px rgba(0, 0, 0, 0.22);` `filter: brightness(1.04);` `transform: translateY(-1px);` | （専用規則なし） | `7032-7035`／`7044-7052` |
| `.dangerButton` | キャンセル（赤） | `border: 1px solid var(--line);` `border-radius: var(--radius);` `min-height: 34px;` `background: var(--control-danger-bg);` `color: #ffb4ad;` `font-size: 12px;` `font-weight: 800;` | `border-color: var(--control-danger-hover-border);` `background: var(--control-danger-hover-bg);` | `border-color: var(--control-danger-active-border);` `background: var(--control-danger-active-bg);` `box-shadow: var(--control-danger-press-shadow);` | `4672-4676`・`4792-4797`／`4799-4802`／`4804-4808` |
| `.settingsSaveButton`（= `.importDialogCommitButton`） | 設定の保存 | `border-color: color-mix(in srgb, var(--good) 48%, var(--line));` `background: var(--control-positive-bg);` `color: var(--good);` | `border-color: var(--control-positive-hover-border);` `background: var(--control-positive-hover-bg);` | （専用規則なし） | `6741-6746`／`6748-6752` |
| `.settingsCancelButton`（= `.importDialogCancelButton`） | 設定のキャンセル | `border-color: color-mix(in srgb, var(--error) 48%, var(--line));` `background: color-mix(in srgb, var(--control-danger-bg) 62%, transparent);` `color: color-mix(in srgb, #ffb4ad 78%, var(--muted));` | `border-color: var(--control-danger-hover-border);` `background: var(--control-danger-hover-bg);` `color: #ffb4ad;` | （専用規則なし） | `6754-6759`／`6761-6766` |
| `.secondaryButton--finish` | 「終わる」 | `background: var(--control-danger-bg);` `color: #ffb4ad;` | `border-color: var(--control-danger-hover-border);` `background: var(--control-danger-hover-bg);` | `border-color: var(--control-danger-active-border);` `background: var(--control-danger-active-bg);` | `4810-4813`／`4814-4817`／`4819-4822` |
| `.confirmDialogButton` | 確認ダイアログの主ボタン | `min-height: 40px;` `border: 1px solid var(--line);` `border-radius: var(--radius);` `padding: 8px 12px;` `font-weight: 800;` | — | — | `6539-6545` |
| `.confirmDialogButton--normal` | 同上（標準） | `background: var(--control-primary-bg);` `color: var(--control-primary-text);` | `border-color: var(--control-primary-hover-border);` `background: var(--control-primary-hover-bg);` | `border-color: var(--control-primary-active-border);` `background: var(--control-primary-active-bg);` `box-shadow: var(--control-primary-active-shadow);` | `6553-6556`／`6463-6466`／`6468-6472` |
| `.confirmDialogButton--positive` | 同上（肯定） | `border-color: rgba(111, 207, 151, 0.45);` `background: var(--control-positive-bg);` `color: var(--good);` | `border-color: var(--control-positive-hover-border);` `background: var(--control-positive-hover-bg);` | `border-color: var(--control-positive-active-border);` `background: var(--control-positive-active-bg);` | `6474-6478`／`6480-6484`／`6486-6489` |
| `.confirmDialogButton--warning` | 同上（注意） | `border-color: var(--warn);` `background: rgba(242, 166, 90, 0.13);` `color: #ffd1a6;` | `background: var(--control-warning-hover-bg);` | `background: var(--control-warning-active-bg);` `box-shadow: var(--control-neutral-press-shadow);` | `6558-6562`／`6491-6493`／`6495-6498` |
| `.confirmDialogButton--danger` | 同上（危険） | `border-color: var(--error);` `background: var(--control-danger-bg);` `color: #ffb4ad;` | `background: var(--control-danger-hover-bg);` | `background: var(--control-danger-active-bg);` `box-shadow: var(--control-danger-press-shadow);` | `6564-6568`／`6500-6502`／`6504-6507` |
| `.dictionarySettingsActions .primaryButton` / `.dropRegisterActions .primaryButton` | 辞書設定・ボタン登録の主ボタン | `border-color: color-mix(in srgb, var(--good) 48%, var(--line));` `background: var(--control-positive-bg);` `color: var(--good);` | `border-color: var(--control-positive-hover-border);` `background: var(--control-positive-hover-bg);` `color: var(--good);` | `border-color: var(--control-positive-active-border);` `background: var(--control-positive-active-bg);` `box-shadow: var(--control-press-shadow);` | `979-984`／`986-993`／`995-1000` |
| `.todayPickerConfirmButton` | 今日ピッカーの「決定」 | `border-color: rgba(117, 196, 143, 0.45);` `background: var(--control-positive-bg);` `color: var(--good);` | `border-color: var(--good);` `background: var(--control-positive-hover-bg);` `color: #92e5ae;`（`:focus-visible` も同じ） | （専用規則なし） | `9493-9497`／`9499-9504` |
| `.instructionDiscardButton` | 「破棄して続ける」 | `color: #ffb4ad;` `border-color: rgba(255, 119, 110, 0.42);` | （専用規則なし） | （専用規則なし） | `2190-2193` |
| `.confirmDialogClose` | 閉じる（×） | `border: 1px solid transparent;` `border-radius: var(--radius);` `background: transparent;` `color: var(--muted);` `width/height: 32px;` | `border-color: var(--line);` `color: var(--text);` | `background: var(--surface-soft);` `box-shadow: var(--control-neutral-press-shadow);` | `6439-6451`／`6453-6457`／`6458-6461` |
| `.iconButton` | 閉じる（×） | `width/height: 36px;` `background: var(--control-neutral-bg);` `border: 1px solid var(--line);` `border-radius: var(--radius);` `color: var(--text);` | `background: var(--control-neutral-hover-bg);` | `background: var(--control-neutral-active-bg);` `box-shadow: var(--control-neutral-press-shadow);` | `4672-4676`・`4824-4831`／`5095-5106`／`5108-5115` |

補足:
- 確認ダイアログ内だけ輪の色が違う: `.confirmDialog button:focus-visible { outline: 2px solid var(--text); outline-offset: 2px; }`（`src/styles.css:6577-6580`）。他は `:focus-visible` の既定（`2px solid var(--accent-strong)`、`2314-2317`）。
- `.confirmDialogButton:disabled, .confirmDialogClose:disabled, .confirmDialogActions button:disabled` = `cursor: not-allowed; opacity: 0.58;`（`src/styles.css:6570-6575`）。グローバルの `button:disabled`（`opacity: 0.5`）より濃い。
- `.mainActionButton` 系の `:disabled` は `box-shadow: none; filter: none; transform: none;`（`src/styles.css:12077-12082`）。

#### ダイアログごとのボタン並び（左から順）

行の並びは `.dialogActions` = `display: grid; grid-template-columns: 1fr 1fr; gap: 8px;`（`src/styles.css:7702-7706`）で、DOM 順に左から入る。

| ダイアログ（見出し／aria-label） | 定義行 | 左 → 右 | 行のクラス |
|---|---|---|---|
| やりたいことを編集 | `src/App.tsx:13034-13145` | `保存`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`） | `dialogActions formDialogActions`（`13126`） |
| 今日やるものを選ぶ | `src/App.tsx:13147-13375` | （本文なし）→ `決定`（`.primaryButton todayPickerConfirmButton`） → `キャンセル`（`.dangerButton todayPickerCancelButton`）。行の先頭に説明文 `<span>`（`13351-13355`）、右上に閉じる `.iconButton`（`13163-13173`） | `dialogActions todayPickerActions`（`13350`） |
| ページを追加／名前を変更（辞書） | `src/App.tsx:13377-13438` | `キャンセル`（`.secondaryButton`） → `追加`／`保存`（`.primaryButton`） | `dialogActions`（`13421`、**`formDialogActions` 無し**） |
| グループを追加 | `src/App.tsx:13440-13494` | `追加`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`） | `dialogActions formDialogActions`（`13475`） |
| 名前を変更（グループ） | `src/App.tsx:13496-13551` | `保存`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`） | `dialogActions formDialogActions`（`13532`） |
| 設定 | `src/App.tsx:13553-14159` | `保存`（`.secondaryButton settingsSaveButton`） → `キャンセル`（`.dangerButton settingsCancelButton`）。右上に閉じる `.iconButton`（`13568-13576`） | `dialogActions settingsDialogActions`（`14140`） |
| 実行記録を追加 | `src/App.tsx:14161-14278` | `追加`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`） | `dialogActions formDialogActions`（`14264`） |
| 実行記録を編集 | `src/App.tsx:14280-14409` | `保存`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`） | `dialogActions formDialogActions`（`14395`） |
| ボタンを編集 | `src/App.tsx:14411-14712` | `保存`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`）。右上に閉じる `.iconButton`（`14426-14434`） | `dialogActions formDialogActions buttonEditDialogFooter`（`14698`） |
| やりたいことを追加 | `src/App.tsx:14714-14817` | `保存`（`.primaryButton`、`type="submit"`） → `キャンセル`（`.secondaryButton dialogCancelButton`）。右上に閉じる `.iconButton`（`14730-14739`） | `dialogActions formDialogActions`（`14797`） |
| 次の一手を決めますか？ | `src/App.tsx:14819-14882` | `今は決めない`（`.secondaryButton dialogCancelButton`）のみ | `dialogActions formDialogActions`（`14871`） |
| 次の一手を設定／編集／入れ替える（`dialogTitle`） | `src/App.tsx:14925-15427` | `保存`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`）。右上に閉じる `.iconButton`（`14955-14964`） | `dialogActions formDialogActions`（`15406`） |
| プロジェクトを追加／編集 | `src/App.tsx:15429-15572` | `保存`／`プロジェクトを追加`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`）。右上に閉じる `.iconButton`（`15447-15454`） | `dialogActions formDialogActions`（`15548`） |
| タイマー満了 | `src/App.tsx:15601-15640` | `続ける(+15分)`（`.secondaryButton`） → `終わる`（`.secondaryButton secondaryButton--finish`） | `dialogActions`（`15626`） |
| ボタンを追加／Button Builder | `src/App.tsx:15642-15858` | `追加`（`.primaryButton`） → `キャンセル`（`.dangerButton`） | `dialogActions dropRegisterActions`（`15835`） |
| リセット前にバックアップしますか？ | `src/App.tsx:15860-15921` | `バックアップして続行`（`.confirmDialogButton mainActionButton mainActionButton--gold`） → `バックアップせず続行`（`.dangerButton`） → `キャンセル`（`.secondaryButton settingsButton--neutral`）。右上に閉じる `.confirmDialogClose`（`15874-15883`） | `dialogActions softwareResetChoiceActions`（`15892`） |
| 変更を保存しますか？（手順書） | `src/components/InstructionUnsavedDialog.tsx:66-115` | `編集を続ける`（`.secondaryButton settingsButton--neutral`） → `破棄して続ける`（`.secondaryButton instructionDiscardButton`） → `保存して続ける`（`.primaryButton`）。右上に閉じる `.confirmDialogClose`（`78-86`） | `instructionUnsavedActions`（`92`） |
| ConfirmDialog（確認） | `src/components/ConfirmDialog.tsx:186-215` | `confirmLabel`（`.confirmDialogButton confirmDialogButton--{tone}`） → 任意で `alternateLabel`（`.confirmDialogButton--{alternateTone}`） → `cancelLabel`（`.secondaryButton settingsButton--neutral`）。`tone` の既定は `"normal"`、`alternateTone` の既定は `"warning"`、`cancelLabel` の既定は `キャンセル`、`initialFocus` の既定は `"cancel"`（`src/components/ConfirmDialog.tsx:36-42`） | `dialogActions confirmDialogActions`（`186`） |
| 取り込み（ImportDialog） | `src/components/ImportDialog.tsx:347-359` | `取り込む`（`.secondaryButton importDialogCommitButton`） → `キャンセル`（`.dangerButton importDialogCancelButton`）。本文側に `プレビュー`（`.secondaryButton`、`204-213`）、`はじめて用をコピー`／`今の内容を付けてコピー`（`180-202`） | `importDialogFooter`（`347`、flex / `justify-content: flex-end` = `src/styles.css:13024-13030`） |
| 開始環境を選ぶ | `src/StartEnvironmentPicker.tsx:264-279` | `選択`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`） | `dialogActions formDialogActions` |
| 手順書を選ぶ | `src/InstructionPicker.tsx:134-137` | `選択`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`） | `dialogActions formDialogActions` |
| 手順書のフォルダ操作（作成／変更） | `src/components/InstructionTree.tsx:1648-1668` | `作成`／`変更`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`） | `dialogActions formDialogActions` |
| 次の一手に手順書を紐づける | `src/components/InstructionTree.tsx:1794-1813` | `紐づける`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`） | `dialogActions formDialogActions instructionProjectLinkFooter` |
| 辞書の設定 | `src/components/DictionaryWindow.tsx:2068-2075` | `保存`（`.primaryButton`） → `キャンセル`（`.dangerButton`） | `dictionarySettingsActions`（flex / `justify-content: flex-end` = `src/styles.css:967-973`、ボタン `min-width: 92px` = `975-977`） |
| 辞書のボタン編集 | `src/components/DictionaryFeatureParityUi.tsx:634-645` | `保存`（`.primaryButton`） → `キャンセル`（`.secondaryButton dialogCancelButton`） | `dialogActions formDialogActions buttonEditDialogFooter` |
| 辞書のページ追加／名前変更 | `src/components/DictionaryFeatureParityUi.tsx:253-272` | `キャンセル`（`.secondaryButton`） → `追加`／`保存`（`.primaryButton`） | `dialogActions`（**`formDialogActions` 無し**） |
| 辞書のボタン登録 | `src/components/DictionaryFeatureParityUi.tsx:367-381` | `キャンセル`（`.secondaryButton`） → `登録`（`.primaryButton`） | `dialogActions`（**`formDialogActions` 無し**） |
| 使い方 | `src/components/HelpGuideDialog.tsx:258-350` | 右上に閉じる `.confirmDialogClose`（`274-282`）、本文上に `目次を開く`／`目次を閉じる`（`.secondaryButton helpGuideTocToggle`、`285-293`）、フッタに `閉じる`（`.secondaryButton secondaryButton--finish`、`346-348`） | `helpGuideFooter`（`344`）。`display` / `justify-content` の指定は無い（`src/styles.css:6299-6303`） |

ボタン行のレイアウト規則（色ではなく並びの決まり）:

| 行クラス | 行 | 値 |
|---|---|---|
| `.dialogActions` | `src/styles.css:7702-7706` | `display: grid; grid-template-columns: 1fr 1fr; gap: 8px;` |
| `.formDialogActions` | — | 専用のレイアウト規則は無い（色だけ `11547-11580`）。並びは `.dialogActions` の 2 列 |
| `.confirmDialogActions` | `src/styles.css:6547-6551` | レイアウト規則は無く `.dialogActions` の 2 列。ボタンは `min-height: 40px; font-size: 14px; font-weight: 800;` |
| `.instructionUnsavedActions` | `src/styles.css:2176-2188` | `display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px;`、ボタン `min-height: 40px; padding: 8px 10px; font-size: 13px;` |
| `.softwareResetChoiceActions` | `src/styles.css:7109-7120` | `display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(0, 1.2fr) minmax(100px, 0.8fr); gap: 8px;`、ボタン `min-height: 40px; font-size: 13px; font-weight: 800;` |
| `.todayPickerActions` | `src/styles.css:9484-9520` | `display: flex; align-items: center; justify-content: flex-end; gap: 12px;`、`> button` は `height: 30px; min-width: 94px; font-size: 11px;`、`> span` は `margin-right: auto;`（左寄せ） |
| `.settingsDialogActions > button` | `src/styles.css:6737-6739` | `min-height: 42px;` |
| `.dictionarySettingsActions` | `src/styles.css:967-977` | `display: flex; justify-content: flex-end; gap: 10px;`、ボタン `min-width: 92px;` |
| `.dropRegisterActions .primaryButton, .dropRegisterActions .dangerButton` | `src/styles.css:7622-7625` | `min-height: 40px;` |
| `.buttonEditDialogFooter` | `src/styles.css:7283-7288` | `margin: 0; border-top: 1px solid var(--line); padding: 12px 18px; background: var(--dialog-surface);` |
| `.importDialogFooter` | `src/styles.css:13024-13030` | `display: flex; justify-content: flex-end; gap: 8px; padding: 12px 20px 16px; border-top: 1px solid var(--line-soft);` |
| `:where(.dialogActions, .dictionarySettingsActions, .instructionUnsavedActions) .primaryButton` | `src/styles.css:12574-12576` | `font-size: 12px;`（dialog の主ボタンの文字をキャンセル側と揃える） |

ダイアログ本体の枠色（参考）: `.confirmDialog--warning` = `border-color: var(--warn);`（`src/styles.css:6418-6420`）、`.confirmDialog--danger` = `border-color: var(--error);`（`src/styles.css:6422-6424`）。

## C. フォントを同梱するための調べ

### C-1 `src-tauri/tauri.conf.json` の CSP の `font-src`

CSP は 1 行（`src-tauri/tauri.conf.json:29`）に全ディレクティブが入っている。`font-src` の部分は次のとおり。

```
font-src 'self' asset: http://asset.localhost data:;
```

| 項目 | 値 | 場所 |
| --- | --- | --- |
| `font-src` の許可元 | `'self'`、`asset:`、`http://asset.localhost`、`data:` | `src-tauri/tauri.conf.json:29` |
| 外部ホスト（`https:` や `fonts.gstatic.com` 等） | 列挙なし | `src-tauri/tauri.conf.json:29` |
| `assetProtocol.enable` | `true` | `src-tauri/tauri.conf.json:31` |
| `assetProtocol.scope` | `["$HOME/AppData/Roaming/life-launcher/icons/**/*"]` | `src-tauri/tauri.conf.json:32` |
| `app.security` の他のキー | `csp` と `assetProtocol` のみ（`devCsp` は無い） | `src-tauri/tauri.conf.json:28-34` |

- 同梱フォントをアプリと同じオリジン（`dist/assets/` 等）に置く場合、`'self'` があるため `font-src` では許可される。`data:` 埋め込みも許可される。
- 外部のフォント配信元は 1 つも列挙されていないため、外部 URL からのフォント取得は許可されない。
- `asset:` / `http://asset.localhost` は許可されているが、その scope はアイコン用フォルダに限定されている（`src-tauri/tauri.conf.json:32`）。
- アプリ本体とは別に、手順書ビューアーのサニタイズ済み HTML 用 CSP が `src/markdown.ts:33-46` にある。その `font-src` は `"font-src asset: http://asset.localhost data:"`（`src/markdown.ts:37`）で、`'self'` を含まない。`default-src` は `"default-src 'none'"`（`src/markdown.ts:34`）。この文字列は `<meta http-equiv="Content-Security-Policy">` として組み立てた HTML の head 先頭に入れている（`src/markdown.ts:182-188`）。
- したがって「アプリ画面の同梱フォント」は `font-src 'self'` で読める設定、「手順書 HTML iframe 内」は `'self'` が無いため同梱フォントは対象外、という差分がある。

### C-2 フォントを置く場所（今の作り）

| 場所 | 今の中身 | ビルド後の扱い（実測） | 参照 |
| --- | --- | --- | --- |
| `public/` | `public/life-launcher-icon.svg` の 1 ファイル（449 バイト）だけ | 名前そのままで `dist/life-launcher-icon.svg`（449 バイト、ハッシュ無し）に出る | `public/life-launcher-icon.svg`、`dist/life-launcher-icon.svg` |
| `src/assets/` | 存在しない（フォルダ自体が無い） | — | — |
| `src` からの import 資材 | 画像・フォントの import は 0 件 | `dist/assets/` にハッシュ付きで出る（`index-CeDUL5ra.css`、`index-DRTpabdM.js` 等） | `dist/assets/` |
| `src/styles.css` の `url()` | 0 件（`url(` の出現なし） | — | `src/styles.css`（全 13,074 行） |
| `@font-face` | 0 件（`src`・`tests`・`docs`・`scripts` に無し） | — | — |
| リポジトリ内のフォントファイル | `.woff2` / `.woff` / `.ttf` / `.otf` / `.eot` は 0 件（`node_modules/playwright-core` の `.ttf` 2 件を除く） | — | — |

今の静的な資材の使われ方は次のとおり。

| 事実 | 場所 |
| --- | --- |
| `vite.config.ts` は 31 行で、`publicDir`・`assetsInclude`・`build` の設定を持たない（`plugins`・`define`・`clearScreen`・`server` のみ） | `vite.config.ts:5-31` |
| 唯一の静的ファイル参照はルート絶対パス `/life-launcher-icon.svg` で、`<img>` の `src` に直接書いている | `src/App.tsx:9797-9804`（`src="/life-launcher-icon.svg"` は 9803 行） |
| テストも同じルート絶対パスを組み立てて使う | `tests/visual/post-v133a-additional-fixes.spec.ts:82` |
| `index.html` は 12 行で、`/src/main.tsx` 以外の資材参照が無い（favicon の `<link rel="icon">` も無い） | `index.html:1-12` |
| エントリは `./styles.css` を import する | `src/main.tsx:4` |
| Tauri の `frontendDist` は `../dist` | `src-tauri/tauri.conf.json:10` |
| `.gitignore` は `dist/` を除外し、`public/` は除外していない | `.gitignore:2` |

実測できた 2 つの扱いは「`public/` に置くと名前を保ったまま `dist/` 直下へ写る」「`src` から import すると `dist/assets/` にハッシュ付きで出る」であり、フォントについての実例はどちらにも無い（今のリポジトリにフォントが 1 つも無いため）。

### C-3 `scripts/check-public-safety.mjs` がフォントとライセンス文書を止めるか

拡張子の扱い（決まりの行をそのまま写す）。

```
const textExtensions = new Set([
  ".cjs", ".css", ".html", ".js", ".json", ".lock", ".md", ".mjs",
  ".ps1", ".rs", ".svg", ".toml", ".ts", ".tsx", ".txt", ".yml", ".yaml",
]);
const blockedArtifactExtensions = new Set([
  ".7z", ".exe", ".key", ".msi", ".p12", ".pdb", ".pem", ".pfx", ".rar", ".zip",
]);
```
（`scripts/check-public-safety.mjs:20-26`）

| 対象 | 判定 | 根拠 |
| --- | --- | --- |
| `.woff2` / `.woff` / `.ttf` / `.otf` | `blockedArtifactExtensions` に入っていないので「packaged artifact」では止まらない | `scripts/check-public-safety.mjs:24-26`、`:116` |
| フォントのファイル名・パス | `segments.includes(".git")`・runtime ファイル名・`backup`/`backups`/`logs` ディレクトリ・`.env` の検査は全ファイルに掛かる | `scripts/check-public-safety.mjs:115-131` |
| フォントのパス名 | `baseline` 等を含むと「internal report or historical artifact」で止まる（`allowedInternalArtifactPaths` の完全一致以外） | `scripts/check-public-safety.mjs:123-128` |
| フォントの本文 | `textExtensions` に無いので本文検査はしない（`readFileSync` の前に `continue`） | `scripts/check-public-safety.mjs:132` |
| ライセンス文書（`.md` / `.txt`） | `textExtensions` にあるので本文検査の対象 | `scripts/check-public-safety.mjs:20-23`、`:132-152` |
| ライセンス文書内のメールアドレス | `email address` として finding になる（`@` を含むアドレス形の正規表現） | `scripts/check-public-safety.mjs:142` |
| finding が 1 件でもあると | 一覧を stderr に出して `process.exit(1)` | `scripts/check-public-safety.mjs:155-159` |

補足の事実。

| 事実 | 場所 |
| --- | --- |
| 走査対象は作業ツリー全体（`walk(ROOT)`）で、git 追跡の有無では絞らない | `scripts/check-public-safety.mjs:97` |
| 走査から外れるディレクトリは `.git`・`node_modules`・`dist`・`target`・`release`・`release-candidate`・`.local-evaluation`・`test-results`・`playwright-report`・`blob-report` | `scripts/check-public-safety.mjs:8-19` |
| `public/` と `docs/` は除外されない（フォントやライセンスを置くと走査対象になる） | `scripts/check-public-safety.mjs:8-19` |
| 内部資料扱いの許可リストは完全一致の固定リスト（30 パス以上） | `scripts/check-public-safety.mjs:32-51` |
| 本文検査は 5 種類のパス／身元チェックと `findSecretFindings`（秘密情報の形 15 種） | `scripts/check-public-safety.mjs:138-152`、`scripts/public-safety-rules.mjs:1-22` |
| この検査は CI で `npm.cmd run public:check` として実行される | `.github/workflows/ci.yml:28`、`package.json:19` |
| 付随テスト（`check-public-safety.test.mjs`）は秘密情報と AI ツール設定パスの 11 件だけで、フォントやライセンス文書の拡張子を試すテストは無い | `scripts/check-public-safety.test.mjs:9-74` |

分からなかったこと: 実際のフォントファイルや実際のライセンス文書（例: OFL の本文）を置いて `public:check` を通した記録はリポジトリ内に無く、個別のライセンス文書がメールアドレス等を含むかどうかは、フォントを同梱していないため確認できなかった。`baseline` を含むパス名の禁止（`:123-128`）はフォントのファイル名にもそのまま当たる。

### C-4 今の成果物の大きさ

`npm.cmd run build`（`tsc && vite build`、`package.json:8`）を dist を消さずに実行し、終了コード 0 を確認した。ビルド後に `dist` は 7 ファイル、合計 `1,035,336` バイト（`0.99` MiB / `1.04` MB）。

| ファイル | バイト | MiB |
| --- | --- | --- |
| `dist/index.html` | 410 | 0.00 |
| `dist/life-launcher-icon.svg` | 449 | 0.00 |
| `dist/assets/index-CeDUL5ra.css` | 210,002 | 0.20 |
| `dist/assets/index-DRTpabdM.js` | 629,914 | 0.60 |
| `dist/assets/InstructionViewer-C3LsRU_q.js` | 128,394 | 0.12 |
| `dist/assets/DictionaryWindow-DXvQjCPk.js` | 59,848 | 0.06 |
| `dist/assets/mhtmlWorker-DpVEZ_X6.js` | 6,319 | 0.01 |
| 合計 | 1,035,336 | 0.99 |

- ビルド出力の値は `dist/index.html 0.41 kB`、`dist/assets/index-CeDUL5ra.css 210.00 kB`（gzip 34.46 kB）、`dist/assets/index-DRTpabdM.js 629.91 kB`（gzip 170.43 kB）、`dist/assets/InstructionViewer-C3LsRU_q.js 128.39 kB`（gzip 39.95 kB）、`dist/assets/DictionaryWindow-DXvQjCPk.js 59.84 kB`（gzip 17.18 kB）、`dist/assets/mhtmlWorker-DpVEZ_X6.js 6.31 kB`。
- ビルドは `(!) Some chunks are larger than 500 kB after minification.` の警告を出した（`dist/assets/index-DRTpabdM.js` が該当）。
- `dist` の 7 ファイルはビルドが報告した出力と一致し、前回ビルドの残骸は無かった。`dist` の `life-launcher-icon.svg` の更新時刻は `public/` 側と同じ（コピー）。
- Playwright の `outputDir` は `dist/visual-qa/test-results`（`playwright.config.ts:9`）だが、このビルド後には存在しない（`dist` は上記 7 ファイルのみ）。

`release-candidate/` の v1.4.3（`release-candidate/v1.4.3/`）には 3 つの成果物があった。

| ファイル | バイト | MiB | MB |
| --- | --- | --- | --- |
| `Life-Launcher-v1.4.3-windows-x64-portable.zip` | 5,143,775 | 4.91 | 5.14 |
| `Life-Launcher-v1.4.3-windows-x64-setup.exe` | 3,771,887 | 3.60 | 3.77 |
| `Life-Launcher-v1.4.3-windows-x64.exe` | 16,179,712 | 15.43 | 16.18 |
| 3 ファイル合計 | 25,095,374 | 23.93 | 25.10 |

同じフォルダには `release-notes.md`（8,790 バイト）と `SHA256SUMS.txt`（327 バイト）もある。この 3 ファイルが今の `dist` から作られたものかは、記録が無いため分からなかった。

### C-5 画面の比較テストの基準画像

基準画像は `tests/visual/**/*-snapshots/*.png` にあり、4 フォルダ・17 枚。

| フォルダ | 枚数 | ファイル名 |
| --- | --- | --- |
| `tests/visual/phase9-visual.spec.ts-snapshots/` | 13 | `main-standard-win32.png`、`main-large-win32.png`、`main-xlarge-win32.png`、`main-min-win32.png`、`main-running-win32.png`、`timer-expanded-win32.png`、`today-picker-win32.png`、`settings-basic-win32.png`、`mini-idle-win32.png`、`mini-running-win32.png`、`records-review-win32.png`、`records-week-win32.png`、`records-all-win32.png` |
| `tests/visual/phase97-colors.spec.ts-snapshots/` | 1 | `phase97-project-colors-win32.png` |
| `tests/visual/phase97-import.spec.ts-snapshots/` | 2 | `phase97-import-drop-main-win32.png`、`phase97-import-drop-sidebar-win32.png` |
| `tests/visual/phase97-wishlist-layout.spec.ts-snapshots/` | 1 | `phase97-wishlist-layout-win32.png` |
| 合計 | 17 | — |

比較を実行するテスト（`toHaveScreenshot` の呼び出し）。

| ファイル:行 | 出力名 | 渡しているオプション |
| --- | --- | --- |
| `tests/visual/phase9-visual.spec.ts:71` | `${name}.png`（`main-standard`〜`main-min` の 4 枚） | `SCREENSHOT_OPTIONS` |
| `tests/visual/phase9-visual.spec.ts:78` | `main-running.png` | `SCREENSHOT_OPTIONS` |
| `tests/visual/phase9-visual.spec.ts:86` | `timer-expanded.png` | `SCREENSHOT_OPTIONS` |
| `tests/visual/phase9-visual.spec.ts:93` | `today-picker.png` | `SCREENSHOT_OPTIONS` |
| `tests/visual/phase9-visual.spec.ts:101` | `settings-basic.png` | `SCREENSHOT_OPTIONS` |
| `tests/visual/phase9-visual.spec.ts:106` | `mini-idle.png` | `SCREENSHOT_OPTIONS` |
| `tests/visual/phase9-visual.spec.ts:127` | `mini-running.png` | `SCREENSHOT_OPTIONS` |
| `tests/visual/phase9-visual.spec.ts:141` | `${name}.png`（`records-review`/`records-week`/`records-all` の 3 枚） | `SCREENSHOT_OPTIONS` |
| `tests/visual/phase97-colors.spec.ts:81` | `phase97-project-colors.png` | 無し |
| `tests/visual/phase97-import.spec.ts:475` | `phase97-import-drop-main.png` | `{ maxDiffPixels: 12 }` |
| `tests/visual/phase97-import.spec.ts:481` | `phase97-import-drop-sidebar.png` | `{ maxDiffPixels: 12 }` |
| `tests/visual/phase97-wishlist-layout.spec.ts:148` | `phase97-wishlist-layout.png` | `{ maxDiffPixels: 12 }` |

`SCREENSHOT_OPTIONS` の定義と、その直前のコメント。

```
// Same-machine renders are pixel-identical; the ratio only absorbs font rasterization drift
// between this machine and the windows-latest CI runner.
const SCREENSHOT_OPTIONS = {
  maxDiffPixelRatio: 0.001,
  animations: "disabled",
  caret: "hide",
} as const;
```
（`tests/visual/phase9-visual.spec.ts:11-17`）

設定ファイル側。

| 項目 | 値 | 場所 |
| --- | --- | --- |
| `expect` キー（`expect.toHaveScreenshot` の全体設定） | 無い（設定ファイルは 31 行で `expect` を持たない） | `playwright.config.ts:1-31` |
| viewport | `{ width: 1366, height: 768 }` | `playwright.config.ts:17` |
| deviceScaleFactor | `1` | `playwright.config.ts:18` |
| colorScheme / locale / timezoneId | `"dark"` / `"ja-JP"` / `"Asia/Tokyo"` | `playwright.config.ts:19-21` |
| reducedMotion | `"reduce"` | `playwright.config.ts:22` |
| 基準画像名の接尾辞 | `-win32`（Playwright が付けるプラットフォーム接尾辞） | 上記フォルダのファイル名 |
| テスト総数（`npx.cmd playwright test --list`） | `Total: 678 tests in 90 files` | 実行結果 |

フォントへの依存について、コードから言える事実。

| 事実 | 場所 |
| --- | --- |
| `@font-face` が 0 件、フォントファイルも 0 件（同梱フォントは無い） | リポジトリ全体の検索結果 |
| 本文フォントは OS のフォント名の列挙（`"Segoe UI", "Yu Gothic UI", "Meiryo", system-ui, sans-serif`） | `src/styles.css:5` |
| 等幅も OS のフォント名の列挙（`"Cascadia Mono", "Consolas", monospace` など） | `src/styles.css:1959`、`:2054`、`:3005`、`:6241`、`:12950` |
| 比較テストは描画前に `document.fonts.ready` を待つ | `tests/visual/phase9-visual.spec.ts:41` |
| `document.fonts.ready` を待つ spec は 19 ファイル（`phase9-visual` を含む） | `tests/visual/*.spec.ts` の検索結果 |
| スクリーンショット比較を行う 4 spec のうち、`document.fonts.ready` を待つのは `phase9-visual.spec.ts` だけ。`phase97-colors`（`prepare` は 32-38 行）、`phase97-import`（92-100 行、`waitForTimeout(150)`）、`phase97-wishlist-layout`（15-30 行）は待たない | 各 spec の `prepare` |
| `maxDiffPixelRatio: 0.001` の意図はコメントで「フォントのラスタライズ差を吸収する」と書かれている | `tests/visual/phase9-visual.spec.ts:11-12` |

基準画像の中身は指示どおり開いておらず、何が写っているかは推測しない。参考として、テストから参照しない保存用の基準画像が別にある: `docs/phase9/baseline-v1.3.4/` 13 枚（`docs/phase9/00-baseline.md:13`、`:23` に「上記の保存用コピー(テストからは参照しない)」）、`docs/phase7.2/screenshots/baseline/` 20 枚。

## D. 上の段とサイドバー

### D-1. 上の段（`topBar`）

#### 置かれている場所

- ダッシュボードの `main.appShell.appShell--dashboard` の中の `section.mainPanel` の中（`src/App.tsx:9715-9724`、`src/App.tsx:10447-10450`）。
- 行そのものは `<header className="topBar" data-tauri-drag-region="" data-top-menu-labels={topMenuLabelLevel} ref={topMenuBarRef}>`（`src/App.tsx:10453-10458`）。
- 直前に、上端の余白だけを覆う `<div aria-hidden="true" className="panelDragStrip panelDragStrip--main" data-tauri-drag-region="" />`（`src/App.tsx:10452`）。
- 幅と余白: `.mainPanel > .topBar { width: min(100%, 1180px); margin-inline: auto; }`（`src/styles.css:3283-3288`）、`.topBar { display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:14px; }`（`src/styles.css:3333-3339`）。表示サイズ `large` は `min(100%, 1298px)`（`src/styles.css:12293-12295`）、`xlarge` は `min(100%, 1400px)`（`src/styles.css:12297-12299`）。
- 右余白は窓のボタンと重ならないように計算で確保する: `.mainPanel > .topBar { min-width: 0; padding-right: max(0px, 111px - max(0px, (100% - 1180px) / 2)); }`（`src/styles.css:12628-12631`、`large`/`xlarge` 版は `12633-12639`）。理由のコメントは `src/styles.css:12620-12627`。

#### 中の部品（左から順）

| # | 部品 | クラス | `aria-label` | `title` | 押したときの関数 | 行 |
|---|---|---|---|---|---|---|
| 1 | 見出しのまとまり（`div`） | `topSummary` | 無し | 無し | 無し（表示のみ） | `src/App.tsx:10459-10471` |
| 1a | 見出し（`h1`） | `topTitle`（記録画面は `topTitle topTitle--records`） | 無し | 無し | 無し。文字は `activeView === "records"` のとき `記録`、それ以外は `` `今日 ${displayedTodayMinutes}分` `` | `src/App.tsx:10460-10465` |
| 1b | 日付（`span`） | `topDateLabel` | 無し | 無し | 無し。`activeView === "main"` のときだけ出る。中身は `formatDateKeyForHeader(displayedDayKey)`（例: `11月15日 土曜日`、`src/App.tsx:1130-1147`） | `src/App.tsx:10466-10470` |
| 2 | ボタンの束（`div`） | `topPills` | 無し | 無し | 無し（入れ物） | `src/App.tsx:10472-10568` |
| 2-1 | 束1（`div`） | `topPillGroup topPillGroup--window`、`role="group"` | `自動起動 / ミニ`（英語UIでは `Startup / Mini`） | 無し | 無し | `src/App.tsx:10473-10477`（文言は `src/App.tsx:473-477`） |
| 2-1-a | 自動起動ボタン | `viewToggleButton`／オンのとき `viewToggleButton viewToggleButton--active` | `Windows自動起動: ON` または `Windows自動起動: OFF` | 同じ文字（`aria-label` と同文） | `void toggleAutoStart()` | `src/App.tsx:10478-10493` |
| 2-1-b | ミニタイマーボタン | `viewToggleButton`、`aria-busy={miniTransitioning}`、`disabled={!config.settings.miniMode \|\| miniTransitioning}` | `ミニタイマーへ切り替え` | `ミニタイマーを準備中` / `ミニタイマーへ切り替え` / `設定で「ミニタイマーを使う」をオンにしてください`（状態で3種） | `void toggleMiniMode()` | `src/App.tsx:10494-10511` |
| 2-2 | 束2（`div`） | `topPillGroup topPillGroup--work`、`role="group"` | `記録 / 手順書` | 無し | 無し | `src/App.tsx:10513-10517` |
| 2-2-a | 画面切替ボタン | `viewToggleButton`、`data-view-toggle=""` | `記録ビューを開く` または `メイン画面に戻る` | 同じ文字 | `setActiveView((view) => view === "records" ? "main" : "records")` | `src/App.tsx:10518-10530` |
| 2-2-b | 手順書ボタン | `viewToggleButton` | `手順書を開く` | `手順書を開く` | `void openInstructionsManually()`（`src/App.tsx:3524-3536`） | `src/App.tsx:10531-10540` |
| 2-3 | 束3（`div`） | `topPillGroup topPillGroup--support`、`role="group"` | `使い方 / 設定` | 無し | 無し | `src/App.tsx:10542-10546` |
| 2-3-a | 使い方ボタン | `viewToggleButton` | `使い方` | `使い方` | `setHelpGuideOpen(true)` | `src/App.tsx:10547-10556` |
| 2-3-b | 設定ボタン | `viewToggleButton` | `設定を開く` | `設定を開く` | `openSettingsCenter`（`src/App.tsx:3792-3820`） | `src/App.tsx:10557-10566` |
| 3 | 窓のボタン | `windowControls windowControls--dashboard` | 各ボタンは下の表 | 各ボタンは下の表 | 各ボタンは下の表 | `src/App.tsx:10569`（実体は `src/components/WindowControls.tsx:122-158`） |

- ボタンの文字（`span.viewToggleButtonLabel`）は `TOP_MENU_LABELS` から来る（`src/App.tsx:454-472`）。日本語時は `自動起動` / `ミニ` / `記録` / `メイン` / `手順書` / `使い方` / `設定`。
- 幅が足りないときは文字を段階的に隠す。段階は `data-top-menu-labels` の `0`/`1`/`2` で、`1` は `topPillGroup--window` と `topPillGroup--support` の文字だけ、`2` は全部の `.viewToggleButtonLabel` を `display:none` にする（`src/topMenuLabels.ts:34-44`、`src/styles.css:8110-8114`）。段階の決定は実測（`src/topMenuLabels.ts:182-199`、`src/styles.css:12643-12650` の `.layoutMeasure`）。

#### 窓のボタン（`WindowControls.tsx`）

| 部品 | クラス | `aria-label` | `title` | 押したときの関数 | 行 |
|---|---|---|---|---|---|
| 区切り線（`span`） | `windowControlsDivider` | 無し（`aria-hidden="true"`） | 無し | 無し | `src/components/WindowControls.tsx:128` |
| ボタンの束（`div`） | `windowControlsButtons` | 無し | 無し | 無し | `src/components/WindowControls.tsx:129` |
| 最小化 | `windowControlButton` | `最小化` | `最小化` | `getCurrentWindow().minimize()` | `src/components/WindowControls.tsx:130-138`、処理は `72-77` |
| 最大化／元に戻す | `windowControlButton` | `最大化` または `元に戻す` | 同じ文字 | `getCurrentWindow().toggleMaximize()` | `src/components/WindowControls.tsx:139-147`、処理は `79-84` |
| 閉じる | `windowControlButton windowControlButton--close` | `閉じる` | `閉じる` | `getCurrentWindow().close()` | `src/components/WindowControls.tsx:148-156`、処理は `86-93` |

- 位置は `position: fixed; right: 8px; z-index: 140;`（`src/styles.css:12653-12659`）。ダッシュボードは `top: 22px; height: 36px;`（`src/styles.css:12661-12665`）、手順書は `windowControls--instruction` で `top: 0; height: 58px;`（`src/styles.css:12667-12671`）。`@media (max-width: 760px)` では `top: 16px`（`src/styles.css:12685-12692`）。
- 最大化中は `windowControls--maximized`、非フォーカスは `windowControls--unfocused`、直後は `windowControls--hover-suppressed`（`src/components/WindowControls.tsx:124-126`）。乗せた色の抑止は `src/styles.css:3248-3261`。
- 状態は `isMaximized()` と `onResized` / `onFocusChanged` で取る（`src/components/WindowControls.tsx:23-58`）。
- 同じ部品を手順書ウィンドウも使う（`src/components/InstructionViewer.tsx:886`、`variant="instruction"`）。
- ブラウザ（`isTauri()` が偽）では各関数が即 `return` する（`src/components/WindowControls.tsx:73, 80, 87`）。

#### 窓を動かすためのドラッグの場所

- 属性を付けている場所（ダッシュボード）:

| 場所 | 行 |
|---|---|
| サイドバー上端の帯 `panelDragStrip panelDragStrip--sidebar`（`aria-hidden="true"`） | `src/App.tsx:9795` |
| ブランド表示 `brandBlock` とその中の `img.brandIcon` / `brandCopy` / `p.eyebrow` / `strong` | `src/App.tsx:9796, 9801, 9805, 9806, 9809` |
| メイン上端の帯 `panelDragStrip panelDragStrip--main`（`aria-hidden="true"`） | `src/App.tsx:10452` |
| `header.topBar` | `src/App.tsx:10455` |
| `topSummary` / `h1.topTitle` / `span.topDateLabel` / `topPills` | `src/App.tsx:10459, 10462, 10467, 10472` |

- 帯の高さ: `.panelDragStrip--main { height: 22px; }`、`.panelDragStrip--sidebar { height: 18px; }`（`src/styles.css:3274-3280`）。`.panelDragStrip` は `position:absolute; top:0; left:0; right:0; z-index:1;`（`src/styles.css:3266-3272`）。`.mainPanel` の `padding: 22px 24px 0` と対応する（`src/styles.css:3242`）。
- 設計意図のコメント: `.mainPanel` / `.sidebar` そのものに属性を付けると内側の余白や一覧のすき間まで動かせてしまうため、上端の余白だけを覆う要素を置く（`src/styles.css:3262-3265`、`src/App.tsx:9794`、`src/App.tsx:10451`）。
- ダイアログでは幕の上端に `modalDragBand`（`height: 58px`、`z-index: -1`、`src/styles.css:12885-12895`）を置いている。置き場所は `src/App.tsx:13036, 13149, 13379, 13442, 13498, 13555, 14163, 14282, 14413, 14716, 14821, 14941, 15431, 15603, 15644`、`src/components/ConfirmDialog.tsx:152`、`src/components/ExpandedTimerOverlay.tsx:68`、`src/components/HelpGuideDialog.tsx:259`。
- 手順書ウィンドウは `header.instructionHeader` と中の見出しに付けている（`src/components/InstructionViewer.tsx:817, 821, 822, 825`）。`@media (max-width: 760px)` では帯の高さが 52px（`src/styles.css:12897-12901`）、表示サイズ別は `12903-12911`。
- 辞書ウィンドウは属性（`data-tauri-drag-region`）に加えて自前で `startDragging()` を呼ぶ。`onPointerDown={startDragging}`（`src/components/DictionaryWindow.tsx:1596`）、処理は `1515-1538`（左ボタン以外と `button` の上では動かさない）。
- ミニタイマーは `miniWindow.startDragging()` を自前で呼ぶ（`src/App.tsx:1962-1965`、`onPointerDown={startMiniDrag}` は `src/App.tsx:1985`）。
- `src` の中で `data-tauri-drag-region` を読む処理は無い（複製を測るときに属性を外す処理だけがある: `src/topMenuLabels.ts:62-65`）。属性を付けるだけで、実際のドラッグは Tauri 側が行う。`src` に `getCurrentWindow().startDragging()` を呼ぶ箇所は、辞書ウィンドウ（`src/components/DictionaryWindow.tsx:1522`）とミニタイマー（`src/App.tsx:1964`）だけ。

### D-2. サイドバー

#### 全体

| 部品 | クラス | `aria-label` など | 行 |
|---|---|---|---|
| サイドバー | `sidebar`（`tabIndex={-1}`） | `aria-label` 無し。`onContextMenu` で `openContextMenu({ kind: "sidebar" }, ...)`、`onKeyDown` で `openContextMenuFromKeyboard(event, { kind: "sidebar" })` | `src/App.tsx:9780-9793` |
| 上端の帯 | `panelDragStrip panelDragStrip--sidebar`（`aria-hidden="true"`） | 無し | `src/App.tsx:9795` |
| ブランド | `brandBlock` / `brandIcon` / `brandCopy` / `eyebrow` / `strong` | 画像は `alt="" aria-hidden="true" src="/life-launcher-icon.svg"`。文字は `Life Launcher` と `Quick` | `src/App.tsx:9796-9826` |
| テスト用の印 | `testProfileBadge` | `title="テスト用の起動（普段のデータとは別）"`、文字は `テスト` | `src/App.tsx:9810-9817` |
| ショートカット表示 | `ShortcutBadge`（`kbd.shortcutBadge`） | `label="Life Launcherを表示/隠す"`、`shortcut={config?.settings.focusHotkey}` | `src/App.tsx:9818-9824`、実体は `src/components/ShortcutBadge.tsx:7-23`（`title`/`aria-label` は `` `${label}: ${value}` ``、未登録なら `` `${label}: ${value}（ショートカットを登録できていません）` ``） |
| タイマー | `TimerPanel`（`variant="sidebar"`） | サイドバーの最後 | `src/App.tsx:10029-10133` |

#### 辞書を開くボタン（`launcherOpenButton`）

| 項目 | 内容 | 行 |
|---|---|---|
| 要素 | `<button className="launcherOpenButton" type="button">` | `src/App.tsx:9828-9846` |
| クラス | `launcherOpenButton`（内側に `launcherOpenButtonLabel` / `launcherOpenButtonIcon`） | `src/App.tsx:9829, 9833, 9834` |
| `aria-label` | 無し | `src/App.tsx:9828-9846` |
| `title` | 無し | 同上 |
| 画面の文字 | `辞書を開く`（`span`） | `src/App.tsx:9837` |
| アイコン | `UiIcon name="search" size={24}`（`aria-hidden="true"` の `span` の中） | `src/App.tsx:9834-9836` |
| 押したときの関数 | `onClick={() => void openDictionaryManually()}` | `src/App.tsx:9830` |
| 関数の中身 | `openDictionaryWindow()` を呼ぶ。失敗時はトースト `` `辞書ウィンドウを開けません: ${message}` `` | `src/App.tsx:3538-3547` |
| ショートカット表示 | `ShortcutBadge label="辞書" shortcut={config?.settings.launcherHotkey} registered={shortcutRegistration.launcher}` | `src/App.tsx:9839-9845` |
| CSS | `min-height: 42px; display: grid; grid-template-columns: minmax(0,1fr) auto; ...` | `src/styles.css:2476-2484`、`2491-2532`、ホバー `5851` |

#### ボタンのグループと折りたたみ

| 部品 | クラス | 属性・文字 | 行 |
|---|---|---|---|
| 一覧の入れ物 | `quickList app-scrollbar` | `aria-label="クイック起動"` | `src/App.tsx:9848` |
| 空のときの文 | `quietText quietText--small` | `サイドバー表示の項目がありません。アプリ、ショートカット、URLをドラッグして追加できます。` | `src/App.tsx:9849-9852` |
| グループ | `quickGroup`（ドラッグ中 `quickGroup--dragging`、`quickGroup--drop-after` / `quickGroup--drop-before`、`quickGroup--item-drop-target`） | `data-sidebar-group-section={group.name}`、`onContextMenu` で `{ kind: "sidebar", groupName }` | `src/App.tsx:9857-9885` |
| 見出しボタン | `quickGroupHeader` | `aria-expanded={!collapsed}`、`data-sidebar-group-name`、`title={group.name}`、中身は `UiIcon`（`chevronRight`/`chevronDown`）＋ `strong`（グループ名）＋ `small`（件数） | `src/App.tsx:9886-9919` |
| 見出しクリック | — | `onClick` は `event.detail === 0`（キーボードで押したクリック）のときだけ `toggleGroupCollapsed(group.name)` | `src/App.tsx:9890-9892` |
| 見出しのドラッグ | — | `onPointerDown` → `startSidebarGroupPointerDrag`、`onPointerMove` → `updateSidebarGroupPointerDrag`、`onPointerUp` → `finishSidebarGroupPointerDrag`、`onPointerCancel` → `cancelSidebarGroupPointerDrag` | `src/App.tsx:9909-9912` |
| 中身 | `quickGroupItems` | `data-sidebar-group-name` | `src/App.tsx:9920-9921` |
| 空のグループ | `quickGroupEmpty` | `見出しを右クリックしてボタンを追加` | `src/App.tsx:9922-9924` |
| ボタン1個の入れ物 | `quickButtonDrag`（ドラッグ中 `quickButtonDrag--dragging`） | `data-sidebar-button-id`、`data-sidebar-group-name` | `src/App.tsx:9926-9935` |
| ボタン | `quickButton` | `title={button.label}`、中身はアイコン（`renderButtonIcon`）と `span`（ラベル）。`onClick` は `event.detail === 0` のときだけ `runActions(button.id, button.actions)` | `src/App.tsx:9936-9971` |
| ボタンのドラッグ | — | `onPointerDown` → `startSidebarPointerDrag`、`onPointerMove` → `updateSidebarPointerDrag`、`onPointerUp` → `finishSidebarPointerDrag(event, button)` | `src/App.tsx:9954-9959` |
| ドロップ位置の線 | `sidebarDropIndicator` | `aria-hidden="true"` | `src/App.tsx:9982-9992` |
| ドラッグ中の見本 | `sidebarDragGhost` / `sidebarGroupDragGhost` | `aria-hidden="true"` | `src/App.tsx:9994-10028` |

- 折りたたみの状態は `localStorage` のキー `life-launcher.sidebar-groups`（`src/constants.ts:10`、読み書きは `src/App.tsx:1160-1171`、切替は `src/App.tsx:4852-4858`）。
- グループの並びは `uniqueGroupNames(config)`（`config.groups` → ボタンの `group` → 既定グループ `その他` の順に重複を除いて並べる、`src/App.tsx:1209-1224`）。サイドバーに出すのは `visibleSidebarButtonGroups`（ボタンがある、または `config.groups` に入っているグループだけ。ボタンは `showInSidebar !== false` のものだけ、`src/App.tsx:2689-2698`）。
- サイドバーのボタンは常に `config.buttons` の配列順（グループ内の順）で並ぶ（`src/App.tsx:2630-2641`）。

#### 並べ替え

| 操作 | 受ける場所 | 何をするか | 行 |
|---|---|---|---|
| ボタンをドラッグ | ボタンの `onPointerDown/Move/Up` | 6px 動いたらドラッグ開始（`SIDEBAR_DRAG_THRESHOLD_PX = 6`、`src/App.tsx:813`）。離した位置の対象ボタン／グループから `moveButtonInSidebar` を呼び、`persistConfig` で保存 | `src/App.tsx:5568-5637`、`5310-5345` |
| グループ見出しをドラッグ | 見出しの `onPointerDown/Move/Up` | 6px 動いたら開始。離した位置の前後（`placement: "before" \| "after"`）から `moveGroupInSidebar` を呼び、`config.groups` を並べ替えて保存 | `src/App.tsx:5639-5706`、`5347-5363` |
| 動かさずに離した | `finishSidebarGroupPointerDrag` | グループの折りたたみを切り替える（`toggleGroupCollapsed`） | `src/App.tsx:5692-5696` |
| グループの右クリック | `ContextMenu` | `上へ移動` / `下へ移動`（`moveSidebarGroupByOffset`）、`名前を変更`、`{グループ名}を削除`、`グループを追加`、`ボタンを追加` | `src/App.tsx:12974-13030`、`5493-5513` |
| ボタンの右クリック | `ContextMenu` | `上へ移動` / `下へ移動`（`moveSidebarButtonByOffset`）、`編集`、`エクスプローラーで表示する`、`辞書に移動`、`削除` | `src/App.tsx:12644-12710` |
| 並べ替え後の通知 | `announceReorder` | 読み上げ用の文字（`reorderAnnouncement`） | `src/App.tsx:5484, 5506` |

- ボタン・グループとも、キーボードで並べ替える処理は無い（矢印キーはフォーカス移動のみ。`src/keyboardNavigation.ts:177-203`）。

#### ファイルを落として登録する所

| 部品 | クラス・文字 | 行 |
|---|---|---|
| ドロップ中の覆い | `importDropOverlay`（`aria-hidden="true"`） | `src/App.tsx:9742-9764`、CSS `src/styles.css:13032-13042` |
| サイドバー側の枠 | `importDropZone importDropZone--sidebar`（当該側なら `--active` 付き）、文字は `ボタンとして登録` | `src/App.tsx:9744-9752` |
| メイン側の枠 | `importDropZone importDropZone--main`、文字は `まとめて取り込む` と `プロジェクト・次の一手・やりたいこと` | `src/App.tsx:9753-9762` |
| 全画面の破線の覆い | `.appShell--dragging::after` の文字 `ここにドロップして登録` | `src/styles.css:2378-2392` |
| 対象側の判定 | `dropSideFromPosition`（`document.elementFromPoint` で `.sidebar` なら `"sidebar"`、`.mainPanel` なら `"main"`） | `src/App.tsx:4927-4935` |
| 出す条件 | ドラッグ中のパスが 1 件で拡張子が `.json`、かつモーダルが開いていないときだけ、`setJsonDrop(判定結果)` にする。それ以外は `setDragActive(true)` | `src/App.tsx:5059-5069`、`5120-5140` |
| 落としたとき（サイドバー側） | `.json` 以外・またはサイドバー側への `.json` は `handleDroppedPaths` → `openDropDialog({ kind: "path", value })`（1件だけ登録。複数は ``複数ドロップ時は先頭の1件だけ登録します`` のトースト） | `src/App.tsx:5077-5085`、`4915-4925` |
| 落としたとき（メイン側） | 1件の `.json` をメイン側に落としたときは `readImportJson` → `openImportDialog(text)`（まとめて取り込む） | `src/App.tsx:5000-5026` |
| OS からのドロップの受け口 | Rust の `main_shell_drop` がイベント `main-shell-drop-result` を出す（`stage`: `dragEnter`/`dragOver`/`dragLeave`/`drop`/`error`、`position`、`paths`、`url`、`shellSpecial`） | `src-tauri/src/commands/main_shell_drop.rs:101-121`、受ける側 `src/App.tsx:5048-5111` |
| ごみ箱のドロップ | `shellSpecial === "recycle_bin"` のとき `openRecycleBinDropDialog()` | `src/App.tsx:5090-5091`、`5028-5046` |
| WebView 側のドロップ | `getCurrentWebview().onDragDropEvent`（`enter`/`over`/`leave`/`drop`）でも同じ処理をする | `src/App.tsx:5113-5166` |

#### サイドバーの幅の決まり

- 幅はグリッドで固定: `.appShell--dashboard { grid-template-columns: 244px minmax(0, 1fr); }`（`src/styles.css:2369-2376`）。`244px` はこの 1 箇所だけ（他に上書きは無い）。
- `@media (max-width: 760px)` では 1 列になり、サイドバーは上に積まれる: `.appShell--dashboard { grid-template-columns: 1fr; }`、`.sidebar { position: static; height: auto; grid-template-rows: auto auto auto; border-right: 0; border-bottom: 1px solid var(--line-soft); }`、`.quickList { max-height: 220px; }`（`src/styles.css:7735-7750`）。この境目は `src/topMenuLabels.ts:20-21` の `STACKED_LAYOUT_MAX_WIDTH_PX = 760` と一致させている。
- `.sidebar` 自身: `position: sticky; top: 0; height: 100vh; display: grid; grid-template-rows: auto auto minmax(0, 1fr) auto; gap: 14px; border-right: 1px solid var(--line-soft); padding: 18px 12px;`（`src/styles.css:2399-2411`）。
- サイドバーの幅を変える取っ手・ドラッグ処理はメイン画面には無い。幅を変える取っ手があるのは手順書ビューアーの一覧だけ（`src/components/InstructionViewer.tsx:904-919`、幅の計算は `52-56` と `610-620`、`--instruction-sidebar-width` は `src/styles.css:1150`）。
- ウィンドウの最小幅は `860`（`src-tauri/tauri.conf.json:19`）。

### D-3. 今あるキー操作

#### Windows 全体（OS に登録しているもの）

`tauri-plugin-global-shortcut` で 4 つまで登録する（`src-tauri/src/startup.rs:212-290`）。既定値は次のとおり。

| 設定項目 | 既定値 | 行 | 押したときに出すイベント |
|---|---|---|---|
| `focusHotkey`（メイン呼び出し） | `Ctrl+Alt+Space` | `src-tauri/src/models.rs:788-790`、`817-821` | `main-shortcut-toggle` |
| `launcherHotkey`（辞書） | `Ctrl+K` | `src-tauri/src/models.rs:784-786`、`817-822` | `launcher-shortcut-toggle` |
| `miniHotkey`（ミニタイマー切替） | 未設定（`None`） | `src-tauri/src/models.rs:822` | `mini-shortcut-toggle` |
| `instructionHotkey`（手順書） | 未設定（`None`） | `src-tauri/src/models.rs:835` | `instruction-shortcut-toggle` |

- イベントを出す側は `src-tauri/src/lib.rs:200-222`（`ShortcutState::Pressed` のときだけ）。
- 受ける側は `src/App.tsx:3560-3595`（`main-shortcut-toggle` → `toggleMainFromShortcut()`、`launcher-shortcut-toggle` → `toggleDictionaryFromShortcut()`、`mini-shortcut-toggle` → `toggleMiniMode()`、`instruction-shortcut-toggle` → `openInstructionsManually()`）。
- テスト用の起動では OS へ登録しない（`src-tauri/src/startup.rs:303-307`）。
- 設定画面でショートカットを記録している間は、登録済みのものを一時的に外す（`suspendDashboardShortcuts` / `resumeDashboardShortcuts`、`src/App.tsx:3722-3785`、`src-tauri/src/startup.rs:66-82`）。

#### アプリの中（ダッシュボード）

| キー | 受けている場所（行） | 何をするか | 範囲 |
|---|---|---|---|
| 矢印キー（↑↓←→） | `src/App.tsx:2269-2278` → `src/keyboardNavigation.ts:102-224` | 画面の区画（サイドバー／上の段／メイン）をまたいでフォーカスを移す。ダイアログが開いていればその中を移る。設定の入力欄では「移動」と「編集」を分ける（`src/keyboardNavigation.ts:27-78`） | アプリ内 |
| `Escape` | `src/App.tsx:4120-4135` | 閉じてよいモーダル（`hasDismissibleModal`、`src/App.tsx:4102-4118`）を閉じる（`dismissNonCriticalModal`） | アプリ内 |
| `Escape` | `src/App.tsx:4594-4604` | ソフトウェアリセットの選択ダイアログを閉じる | アプリ内 |
| `Escape` | `src/App.tsx:5168-5174` | （死んでいる）旧辞書オーバーレイを閉じる。オーバーレイ自体が `{false && ...}` なので実際には出ない（`src/App.tsx:10137`） | アプリ内 |
| `Escape` | `src/App.tsx:9249-9279` | 「今日」／プロジェクト／やりたいこと／やりたいことグループのポインタードラッグを取り消す | アプリ内 |
| `Escape` | `src/components/ContextMenu.tsx:77-91`、`119-124` | 右クリックメニューを閉じ、開いた要素へフォーカスを戻す | アプリ内 |
| `Escape` | `src/components/ConfirmDialog.tsx:94-99` | 確認ダイアログをキャンセル（`processing` 中は閉じない） | アプリ内 |
| `Escape` | `src/components/ExpandedTimerOverlay.tsx:34-49` | 拡大タイマーを閉じる（タイマーは続く。`complete` のときと他のモーダルがあるときは効かない） | アプリ内 |
| `Escape` | `src/components/InstructionUnsavedDialog.tsx:30-35` | 「編集を続ける」 | アプリ内 |
| `Escape` | `src/components/ImportDialog.tsx:136-141` | 「まとめて取り込む」を閉じる（`busy` 中は閉じない） | アプリ内 |
| `Escape` | `src/StartEnvironmentPicker.tsx:169-174` | 「開始環境を選ぶ」を閉じる | アプリ内 |
| `Escape` | `src/InstructionPicker.tsx:80-85` | 「手順書を選ぶ」を閉じる | アプリ内 |
| `Escape` | `src/components/InstructionTree.tsx:409-414`、`448-453` | ファイル／フォルダ作成ダイアログ、プロジェクト紐付けダイアログを閉じる | アプリ内（手順書ウィンドウ） |
| `Escape` | `src/components/InstructionTree.tsx:644-648` | 一覧の検索欄を空にする | アプリ内（手順書ウィンドウ） |
| `Escape` | `src/components/DictionaryWindow.tsx:1284-1286`、`1304-1310`、`1379-1389` | 設定ダイアログを閉じる／タイトルバーのメニューを閉じる／検索語を消す（検索語が無ければ窓を隠す） | アプリ内（辞書ウィンドウ） |
| `Escape` | `src/components/DictionaryFeatureParityUi.tsx:55-60` | 辞書のダイアログを閉じる | アプリ内（辞書ウィンドウ） |
| `Tab` | `src/App.tsx:4137-4202` | モーダルの中でフォーカスを循環させる | アプリ内 |
| `Tab` | `src/components/ConfirmDialog.tsx:101-119`、`HelpGuideDialog.tsx:235-255`、`InstructionUnsavedDialog.tsx:36-53`、`ExpandedTimerOverlay.tsx:51-64`、`InstructionTree.tsx:415-434`、`InstructionTree.tsx:454-469`、`DictionaryFeatureParityUi.tsx:61-77` | 各ダイアログの中でフォーカスを循環させる | アプリ内 |
| `Tab` | `src/App.tsx:15930-15932` | ソフトウェアリセット実行中の画面では `Tab` を止める | アプリ内 |
| `Ctrl+W` | `src/components/WindowControls.tsx:98-117`（`window` の capture） | 窓を閉じる（`close()` と同じ）。`closeShortcutDisabled` のときと `repeat` のときは閉じない。WebView の既定と二重にならないよう常に `preventDefault()` | アプリ内（ダッシュボードと手順書の両方。`src/components/InstructionViewer.tsx:886` も同じ部品） |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | `src/components/DictionaryWindow.tsx:1374-1378` | 辞書のページを前後へ切り替える | アプリ内（辞書ウィンドウ） |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | `src/App.tsx:9636-9641` | （死んでいる）旧オーバーレイのページ切替 | アプリ内（実際には出ない） |
| `ContextMenu` キー / `Shift+F10` | `src/App.tsx:2569-2581` | フォーカス中の項目の右クリックメニューを開く（サイドバーの見出し・ボタン、今日の項目、やりたいこと、プロジェクト、記録の行など） | アプリ内 |
| `ContextMenu` キー / `Shift+F10` | `src/RecordsView.tsx:103-108`、`src/components/InstructionTree.tsx:711-716`、`src/components/DictionaryFeatureParity.tsx:829-838`、`src/components/DictionaryWindow.tsx:1708-1712` | 同上（記録の行、手順書の行、辞書のページ・項目） | アプリ内 |
| `Enter` | `src/App.tsx:7655-7666` | 「今日の勝利条件」の入力中、`Enter` で保存して確定、`Escape` で取り消し | アプリ内 |
| `Enter` | `src/App.tsx:10112-10114` | サイドバーの通常タイマーの分数入力で、`Enter` を押すと入力欄から離れる（`blur`） | アプリ内 |
| `Enter` | `src/App.tsx:13401-13409` | 辞書ページの追加／名前変更で、`Enter` で保存、`Escape` で閉じる | アプリ内 |
| `Enter` | `src/App.tsx:13462-13469`、`13520-13527` | グループ追加／グループ名変更で、`Enter` で確定、`Escape` で閉じる | アプリ内 |
| `Enter` | `src/App.tsx:14763-14767` | やりたいことの追加欄で、日本語入力の変換確定の `Enter` は止める（`isComposing`） | アプリ内 |
| `Enter` | `src/components/InstructionTree.tsx:664-667`、`754-757`、`775-778` | 検索結果を開く／ファイルの行で開く／フォルダの行で開閉 | アプリ内（手順書ウィンドウ） |
| `Enter` | `src/components/DictionaryWindow.tsx:1390-1394` | 検索欄にフォーカスがあるとき、選んでいる項目を起動する | アプリ内（辞書ウィンドウ） |
| `Enter` | `src/components/DictionaryFeatureParityUi.tsx:237-241` | 辞書ページの追加／名前変更で保存 | アプリ内（辞書ウィンドウ） |
| `Enter` | `src/components/ConfirmDialog.tsx:87-93` | 日本語入力の変換中は `Enter`/`Escape` を止める（誤操作の防止） | アプリ内 |
| 矢印キー | `src/components/ContextMenu.tsx:119-138` | メニュー項目の間を `↑↓` で移り、`Home`/`End` で先頭・最後へ | アプリ内 |
| 矢印キー | `src/keyboardNavigation.ts:130-165` | モーダルの中で `↑↓` は項目移動、`←→` はタブ・横並びのボタン移動、設定はタブ⇄節の移動 | アプリ内 |
| 矢印キー | `src/components/InstructionTree.tsx:718-774` | 手順書一覧の行移動（`Home`/`End`/`↑↓`）、`→` で本文へ、`←→` でフォルダの開閉 | アプリ内（手順書ウィンドウ） |
| 矢印キー | `src/components/InstructionViewer.tsx:737-768` | 本文のスクロール（`↑↓` 40px、`PageUp`/`PageDown` 1画面、`Home`/`End` 先頭・最後、`←` で一覧へ戻る）。`Alt`/`Ctrl`/`Meta` 付きは何もしない（`717-718`） | アプリ内（手順書ウィンドウ） |
| 矢印キー | `src/components/InstructionViewer.tsx:772-782` | ヘッダーのボタンの間を `←→` で移る | アプリ内（手順書ウィンドウ） |
| 矢印キー | `src/components/InstructionViewer.tsx:784-791` | 一覧の幅を `←→` で 16px ずつ、`Home`/`End` で最小・最大にする（`role="separator"`） | アプリ内（手順書ウィンドウ） |
| 矢印キー | `src/components/DictionaryWindow.tsx:1287-1301`、`1327-1372`、`1708-1727`、`1936-1953` | 設定のボタン移動、検索結果の選択、タイトルバーのボタン移動、タイルのフォーカス移動、ページタブの移動（`Home`/`End` 含む） | アプリ内（辞書ウィンドウ） |
| 矢印キー | `src/App.tsx:3997-4015` | 「今日」に追加する画面の追加元タブ（`←→`/`Home`/`End`） | アプリ内 |
| 印刷可能な 1 文字 | `src/components/DictionaryWindow.tsx:1395-1406` | 入力欄などの上以外で文字を打つと、検索欄にその文字を入れて検索を始める | アプリ内（辞書ウィンドウ） |
| ショートカットの記録中はすべてのキー | `src/App.tsx:3761-3785` | 次に押したキーを設定値にする。`Escape` で取り消し。英数字・`F1`〜`F12`・`Space` 以外は ``英数字、F1〜F12、Spaceのいずれかを押してください`` | アプリ内（設定画面） |

#### 指定のキーの有無

| キー | ある／無い | 根拠 |
|---|---|---|
| `Ctrl+K` | ある（Windows 全体とアプリ内の両方） | OS 登録は `launcherHotkey` の既定 `Ctrl+K`（`src-tauri/src/models.rs:784-786`）。アプリ内は `src/App.tsx:5168-5188`（`matchesHotkey(event, config?.settings.launcherHotkey)`、`src/App.tsx:1098-1115`。未設定時は `Ctrl+K` とみなす） |
| `Ctrl+W` | ある（アプリ内だけ） | `src/components/WindowControls.tsx:98-117` |
| `Enter` | ある（上記の各所） | `src/App.tsx:7655-7666, 10112-10114, 13401-13409, 13462-13469, 13520-13527, 14763-14767` ほか |
| `Shift+Enter` | 無い | `src` 全体で `shiftKey` を使うのは、フォーカス循環（`Tab`）、`Shift+F10`、`Ctrl+Shift+Tab` の判定だけ（`src/components/ConfirmDialog.tsx:113-119`、`src/components/InstructionTree.tsx:711`、`src/components/DictionaryWindow.tsx:1376` など）。`Enter` と `shiftKey` を組み合わせた判定は無い |
| 矢印キー | ある | 上記の表のとおり（アプリ全体の移動は `src/keyboardNavigation.ts:102-224`） |
| `Space` | アプリ独自の処理は無い | `src` で `Space` を扱うのは、ショートカット記録時のキー名変換（`src/App.tsx:1461-1462`）と、死んでいる旧オーバーレイの `event.key === " "`（`src/App.tsx:10241`）だけ。アプリ側で `Space` を `preventDefault` している箇所は無い |
| `Ctrl+Z` | 無い | `Ctrl+Z`・`"z"`・`KeyZ` を扱うコードは `src` に無い（取り消しはトーストの「元に戻す」などのボタン経由。例: `src/App.tsx:4969-4981`） |
| `Escape` | ある | 上記の表のとおり（ダッシュボード `src/App.tsx:4120-4135`、辞書 `src/components/DictionaryWindow.tsx:1379-1389` ほか） |
| `F2` | 無い | `"F2"` を扱うコードは `src` に無い（`F` のキーで扱うのは `F1`〜`F12` を記録できる旨の文字 `src/App.tsx:3775` と `Shift+F10` だけ） |
| `Delete` | 無い | `Delete` キーを扱うコードは `src` に無い（削除は右クリックメニューやボタン経由。例: `src/App.tsx:12703-12709`） |
| `Ctrl+F` | 無い | `Ctrl` と `f` の組み合わせを扱うコードは `src` に無い。`src` に `preventDefault` している `Ctrl` 付きのキーは `Ctrl+W`（`src/components/WindowControls.tsx:105-110`）と `Ctrl+Tab`（`src/components/DictionaryWindow.tsx:1374-1375`、死んだ経路 `src/App.tsx:9636-9637`）だけ |

### D-4. 手順書ビューアーに検索の欄や `Ctrl+F` があるか

- 本文側（`src/components/InstructionViewer.tsx`）に検索の入力欄は無い。ヘッダーにあるのは次のボタンだけ: `手順書を編集`（`831-841`）、外部で開く（`aria-label={externalOpenLabel}`、`843-853`）、`常に手前を解除`／`常に手前に表示`（`854-863`）、`ビューアーのサイズを切り替える`（`864-872`）、`手順書を再読み込み`（`873-884`）、`WindowControls`（`886`）。
- 本文の `onKeyDown` は `handleDocumentKeyDown`（`src/components/InstructionViewer.tsx:717-769`）で、扱うのは `ArrowLeft` / `ArrowDown` / `ArrowUp` / `PageDown` / `PageUp` / `Home` / `End` だけ。`Ctrl` 付きは先頭で `return` する（`717-718`）。
- 一覧側（`src/components/InstructionTree.tsx`）には検索の欄がある。`label.instructionSearchField` の中の `input`（`role="combobox"`、`type="search"`、`placeholder="検索"`、読み上げ用の文字は `手順書名またはフォルダ名を検索`）（`1121-1141`）。結果は `aria-label="手順書の検索結果"` の `div`（`role="listbox"`）に出る（`1174-1184`）。
- この検索欄が探すのは「手順書名またはフォルダ名」までで、本文の文字を探す処理は無い（`src/components/InstructionTree.tsx:1122`、結果の描画 `1184-1300` 付近）。
- `Ctrl+F` を受ける処理は、手順書ビューアーにも他の画面にも無い（D-3 の表のとおり）。`Ctrl+W` だけは `WindowControls` が受ける（`src/components/InstructionViewer.tsx:886`）。

### D-5. WebView2 そのもののキーを止めているか

#### 設定ファイル

| 項目 | 事実 | 場所 |
|---|---|---|
| `additionalBrowserArgs` | 書かれていない | `src-tauri/tauri.conf.json:1-52`（`app` の中は `windows` と `security` だけ。`13-34`） |
| `browser_accelerator_keys` / `browserAcceleratorKeys` | 書かれていない（`src-tauri` 全体を検索して一致なし。`gen/schemas` に見つかる `accelerator` はメニューの `allow-set-accelerator` だけ） | `src-tauri/tauri.conf.json`、`src-tauri/gen/schemas/desktop-schema.json:780-783`、`912-915` |
| 窓の指定 | `"decorations": false`、`"resizable": true`、`"create": false`、`"minWidth": 860`、`"minHeight": 560`（窓は `src-tauri/src/lib.rs:157-175` で作る） | `src-tauri/tauri.conf.json:13-27` |
| CSP | `default-src 'self'; ... object-src 'none'; ...` | `src-tauri/tauri.conf.json:29` |
| `devtools` フィーチャー | 有効化していない（`tauri = { version = "2", features = ["protocol-asset", "tray-icon"] }`） | `src-tauri/Cargo.toml:22` |
| 開発者ツールを開くコード | `src` にも `src-tauri/src` にも無い（`devtools` で検索して一致するのは `gen/schemas` の権限名だけ） | `src`、`src-tauri/src` |

#### 版

| クレート | 版 | 場所 |
|---|---|---|
| `tauri` | 2.11.5 | `src-tauri/Cargo.lock:3578`（宣言は `src-tauri/Cargo.toml:22`） |
| `tauri-runtime-wry` | 2.11.4 | `src-tauri/Cargo.lock:3814` |
| `wry` | 0.55.1 | `src-tauri/Cargo.lock:5115` |
| `tao` | 0.35.3 | `src-tauri/Cargo.lock:3521` |
| `webview2-com` | 0.38.2 | `src-tauri/Cargo.lock:4599` |
| `tauri-plugin-global-shortcut` | `"2"` | `src-tauri/Cargo.toml:23` |

- `wry` は直接の依存には書かれておらず、`tauri-runtime-wry` 経由で入る（`src-tauri/Cargo.toml` に `wry` の行は無い）。

#### `src` の `keydown` で `preventDefault` している所（全件）

| キー | 場所 | 何を止めているか |
|---|---|---|
| `Escape` | `src/App.tsx:4130`、`4598`、`5171`、`9259` | モーダル・リセット選択・旧オーバーレイ・ポインタードラッグ |
| `Tab` | `src/App.tsx:4171, 4178, 4181, 4184`、`15931` | フォーカスの循環と、リセット実行中の移動 |
| 矢印キー | `src/keyboardNavigation.ts:15, 131` | フォーカス移動、設定の数値欄・ラジオの値変更 |
| 矢印キー | `src/components/InstructionTree.tsx:720, 725, 730, 736, 741, 749, 755, 762, 770, 776` | 一覧の行移動・開閉 |
| 矢印キー | `src/components/InstructionViewer.tsx:739, 743, 747, 751, 755, 759, 763, 780, 786` | 本文のスクロール、ヘッダー移動、幅調整 |
| 矢印キー | `src/components/DictionaryWindow.tsx:1298, 1343, 1358, 1368, 1714, 1725, 1950` | 辞書の中の移動 |
| 矢印キー | `src/components/ContextMenu.tsx:121, 136`、`src/App.tsx:10236, 10242`（死んだ経路） | メニュー内の移動 |
| `Enter` / `Escape` | `src/App.tsx:7657`、`10113` は `blur` のみ、`13408`、`13466`、`13524`、`14765` | 各入力欄の確定・取り消し |
| `Enter` / `Escape` | `src/components/InstructionTree.tsx:410, 645, 755, 776` | 検索欄・一覧・ダイアログ |
| `Enter` / `Escape` | `src/components/DictionaryWindow.tsx:1285, 1306, 1312, 1380, 1391`、`src/components/DictionaryFeatureParityUi.tsx:56, 239` | 辞書のダイアログ・検索 |
| `Enter` / `Escape` | `src/components/ConfirmDialog.tsx:89, 95, 106`、`src/components/ImportDialog.tsx:138`、`src/StartEnvironmentPicker.tsx:171`、`src/InstructionPicker.tsx:82`、`src/components/HelpGuideDialog.tsx:249, 252`、`src/components/ExpandedTimerOverlay.tsx:43, 58, 61`、`src/components/InstructionUnsavedDialog.tsx:32, 41, 48, 51` | 各ダイアログ |
| `Ctrl+W` | `src/components/WindowControls.tsx:110` | 窓を閉じる（WebView の既定と二重にしないため常に止める） |
| `Ctrl+Tab` / `Ctrl+Shift+Tab` | `src/components/DictionaryWindow.tsx:1321, 1375`、`src/App.tsx:9637`（死んだ経路） | ページ切替、ドラッグ中の誤操作 |
| `ContextMenu` / `Shift+F10` | `src/App.tsx:2572`、`src/RecordsView.tsx:105`、`src/components/InstructionTree.tsx:712`、`src/components/DictionaryFeatureParity.tsx:834`、`src/components/DictionaryWindow.tsx:1759`（中身は `parity.keyboardMenu`） | 右クリックメニューを開く |
| 印刷可能な 1 文字 | `src/components/DictionaryWindow.tsx:1402` | 検索欄へ流し込む |
| すべてのキー（記録中） | `src/App.tsx:3765` | ショートカットの記録 |

- `Ctrl+F`・`F5`・`F12`・`Ctrl+R`・`Ctrl+P` を `preventDefault` している箇所は `src` に無い（`src` 全体を `F5` / `F12` / `KeyF` / `KeyR` / `KeyP` / `"f"` / `"r"` / `"p"` で検索して一致なし）。
- `contextmenu`（右クリックの既定メニュー）を全体で止める処理は無い。`document.addEventListener("contextmenu", ...)` も `oncontextmenu` も `src` に無い。各要素の `onContextMenu` で個別に `preventDefault()` している（例: `src/App.tsx:9782-9790`、`src/App.tsx:10765`、`src/components/TimerPanel.tsx:74-81`、`src/components/DictionaryWindow.tsx:1587-1595`）。
- 権限（capabilities）: メイン窓は `core:default` を含む（`src-tauri/capabilities/default.json`）。`core:default` の `core:webview:default` には `allow-internal-toggle-devtools` が含まれる（`src-tauri/gen/schemas/desktop-schema.json:1242-1245`）が、それを呼ぶコードは `src` に無い。

#### 分からなかった所（D-5）

- 実機で `Ctrl+F`（ページ内検索）・`Ctrl+P`（印刷）・`Ctrl+R`／`F5`（再読み込み）・`F12`（開発者ツール）が実際に効くかどうかは、このリポジトリのコードと設定だけでは決められない。`tauri.conf.json` に `additionalBrowserArgs` も `browser_accelerator_keys` も無く、`src` 側にもこれらのキーを止める処理が無い、という事実までは確認できた。Tauri／wry の既定がどうなっているかは、このリポジトリの中には書かれていない（`src-tauri/gen/schemas` は権限のスキーマで、`tauri.conf.json` の設定スキーマは `https://schema.tauri.app/config/2` を参照するだけでローカルに無い）。
- 開発ビルドと配布ビルドで開発者ツールの可否が変わるかは、`src-tauri/Cargo.toml` に `devtools` フィーチャーが無いこと以上は分からなかった。

## E. メイン画面の節

メイン画面の節は 6 つ + その他。前半（この節）で「今やる一手」「勝利条件」「今日の3件」、続きで「次の一手」「やりたいこと」「今日の実行」「その他」を書く。

対象は `src/App.tsx` のメイン画面（`activeView === "main"`）。3 節はいずれも `src/App.tsx:10572` の `.mainScrollArea` > `.mainScrollContent`（`src/App.tsx:10573-10578`）の中に、`victoryBar` → `doNowBand` → `focusBand` の順で並ぶ。記録ビュー（`activeView === "records"`、`src/App.tsx:10594-10621`）のときは 3 節とも描画されない（`src/App.tsx:10622` の else 側）。

十字キーの共通仕様（`src/keyboardNavigation.ts`）:
- 呼び出しは `document` の keydown 1 箇所のみ（`src/App.tsx:2269-2278`）。`navigateAppArrow(event, shortcutCaptureActiveRef.current)`。
- 対象キーは `ArrowUp/ArrowDown/ArrowLeft/ArrowRight` のみ。`event.defaultPrevented`、Alt/Ctrl/Meta 併用時は何もしない（`src/keyboardNavigation.ts:102-110`）。
- フォーカス可能要素は `button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]`。可視（`getClientRects().length > 0`、`visibility !== "hidden"`）で、`[aria-hidden="true"]` / `[inert]` の内側は除外（`src/keyboardNavigation.ts:1-11`）。
- 移動は `focus()` が `preventDefault` + `focus({preventScroll:true})` + `scrollIntoView({block:"nearest"})`（`src/keyboardNavigation.ts:13-19`）。`step()` は毎回 `available(container)` を引き直し、`indexOf(current) + offset` の要素へ移動。末尾では移動しない（ループしない）（`src/keyboardNavigation.ts:21-25`）。
- テキスト入力中は矢印ナビが丸ごと早期 return（`input:not([type="checkbox"])`, textarea, select, contenteditable。`src/keyboardNavigation.ts:115`）。チェックボックスは除外されないので矢印ナビが効く。
- `[role="menu"]` / `.launcherOverlay` の内側も早期 return（`src/keyboardNavigation.ts:116`）。
- モーダル（`.modalBackdrop [role="dialog"][aria-modal="true"]` の最後）または展開タイマー（`.expandedTimer[role="dialog"]`）があるときは、そちら専用の別ロジックになり、本文の節には効かない（`src/keyboardNavigation.ts:118-167`）。

---

### E-今やる一手

**1. 行の範囲・最外要素のクラスと aria-label**

| 項目 | 内容 |
|---|---|
| 行の範囲 | `src/App.tsx:10718-10980` |
| 最外要素 | `<section>`（`src/App.tsx:10718`） |
| クラス | `doNowBand`（`src/App.tsx:10719`） |
| ラベル | `aria-label` は無い。`aria-labelledby="do-now-title"`（`src/App.tsx:10720`）。`id="do-now-title"` の `<h2>` は 3 分岐すべてに存在（`src/App.tsx:10728` / `10783` / `10939`） |
| その他属性 | `data-skip-target="main"`（`src/App.tsx:10721`）、`tabIndex={-1}`（`src/App.tsx:10722`）。`role` は無い |

**2. 出す条件と、空のときに出る文**

分岐は 3 つ（`src/App.tsx:10724` / `10756` / `10936`）。

| 分岐 | 条件 | 出る内容 |
|---|---|---|
| 完了ホールド | `doNowCompletionHold` が真（`src/App.tsx:10724`） | `doNowContent doNowContent--hold`（`src/App.tsx:10725`）。プロジェクト名チップ、`✓ 一手進みました`（`role="status"`、`src/App.tsx:10738`）、`doNowHoldTask` に完了時のタスク文、`minutes > 0` のとき `実行 {minutes}分`（`src/App.tsx:10741`） |
| 候補あり | `doNowSelection` が真（`src/App.tsx:10756`） | `doNowContent` + `data-project-color`（`src/App.tsx:10757-10762`） |
| 空 | 上記以外（`src/App.tsx:10936`） | `doNowHeading` の `<h2 id="do-now-title">今やる一手</h2>`（`src/App.tsx:10938-10940`）+ `doNowEmpty` / `doNowEmptyContent`（`src/App.tsx:10941-10942`） |

空のときの文（`src/App.tsx:10943-10954`）:

| 条件 | `<strong>` | `<span>` | ボタン字 |
|---|---|---|---|
| `doNowOnlyExcluded` | `今は他に提案できる一手がありません。` | `取り組んだ一手は、もう一度候補を見ると表示できます。` | `候補をもう一度見る` |
| `nextStepSetupProject` あり | `次の一手を設定すると、ここに提案されます。` | `迷ったときに、今の状況から始めやすい「次にやること」を1つだけ提示します。` | `次の一手を設定` |
| どちらでもない | `プロジェクトを作り、次の一手を設定すると提案されます。` | 同上 | `プロジェクトを追加` |

- `doNowOnlyExcluded` = 「除外 ID があり、バックエンド候補が 1 件以上あり、除外後に 0 件」（`src/App.tsx:9493-9496`）。
- `nextStepSetupProject` = `config.projects.find(!nextStep.text.trim()) ?? config.projects[0]`（`src/App.tsx:9485-9486`）。
- 候補の出どころは Tauri コマンド `load_do_now_candidates`（`src/tauri.ts:176-178`、`src-tauri/src/commands/sessions.rs:198-216`）。候補になるのは `next_step.text` が空でないプロジェクトのみ（`src-tauri/src/commands/sessions.rs:240-248`）。フロント側で `doNowExcludedProjectId` を除外（`src/App.tsx:9487-9492`）。つまり「次の一手が未設定」「全候補が除外済み」で空になる。
- 初期値は `doNowResponse = null`（`src/App.tsx:2200`）なので、読み込み完了前も空分岐になる。読み込み失敗時はトースト `今やる一手を読めません: {message}`（`src/App.tsx:3016`）。
- ホールド状態の発生条件: `showTimerCompletionFeedback` で、`timer.doNowSnapshot` があり、かつ `continuedAfterCompletion` または完了ソースキー無しのとき（`src/App.tsx:7117-7123`）。日付が変わると解除（`src/App.tsx:3021-3025`）。
- ロック（無効化）に相当するもの: 3 節中この節には `disabled` の付いたボタンは無い（ホールドのボタンのみ `disabled={doNowCompletionSaving}`、`src/App.tsx:10747`）。

**3. 中のボタン・メニューの一覧**

ホールド分岐（`src/App.tsx:10744-10754`）:

| 字 | クラス | `aria-label` | 押したとき |
|---|---|---|---|
| `次の一手を見る`（+ `chevronRight` アイコン） | `mainActionButton mainActionButton--neutral doNowHoldButton` | 無し | `acknowledgeDoNowCompletion()`（`src/App.tsx:10748`、定義 `src/App.tsx:9577-9587`）。`refreshDoNow()` 成功後、除外 ID 設定 → `doNowPickedProjectId=null` → ホールド解除 → `requestAnimationFrame` で `.doNowStartPrimary, .doNowEmptyContent button` へフォーカス |

候補あり分岐（`src/App.tsx:10756-10935`）:

| 字 | クラス | `aria-label` / `title` | 押したとき |
|---|---|---|---|
| （コンテナ自体がフォーカス対象。候補 2 件以上のとき `tabIndex={0}`） | `doNowContent` | 無し | 右クリックで `openContextMenu({kind:"doNow"}, …)`（`src/App.tsx:10763-10773`）。`onKeyDown` は `openContextMenuFromKeyboard(event, {kind:"doNow"})`（`src/App.tsx:10774-10778`） |
| `他の一手`（+ `refresh` アイコン） | `doNowAlternateButton` | 無し | `showNextDoNowCandidate()`（`src/App.tsx:10837`、定義 `9572-9576`）。候補 2 件以上のときだけ描画（`src/App.tsx:10834`） |
| 実行中: `再開` / `一時停止` | `runningPauseButton` | `aria-label`: `このセッションを再開` / `このセッションを一時停止` | `togglePause()`（`src/App.tsx:10852-10864`） |
| 実行中: `終了` | `runningStopButton` | 無し | `finishActiveTimer(activeTimer)`（`src/App.tsx:10865-10871`） |
| 待機: `{n}分で始める` | `doNowStartPrimary` | `aria-label`: `短時間タイマー{doNowShortTimerMinutes}分で始める` | `startDoNowProject(project, "short")`（`src/App.tsx:10875-10887`） |
| 待機: `通常 {n}分` | `doNowStartSecondary` | `aria-label`: `通常タイマー{doNowDefaultTimerMinutes}分で開始` | `startDoNowProject(project, "normal")`（`src/App.tsx:10888-10900`） |
| 待機: `計測`（`clock` アイコン+文字） | `doNowMeasureButton` | `aria-label` と `title` ともに `時間を決めずに計測` | `startDoNowProject(project, "measure")`（`src/App.tsx:10901-10910`） |
| 実行中のみ: `{timerClock}` | `measureElapsedClock`（ボタンではない `<span>`） | 無し | — （`src/App.tsx:10849-10851`） |
| 手順書あり: `手順書`（+ `book` アイコン） | `doNowInstructionButton mainActionButton mainActionButton--neutral` | `aria-label`: `{project.name}の手順書を開く` | `openInstructionWindow({path, focus:true})`。失敗時トースト `手順書を開けません: {message}`（`src/App.tsx:10913-10932`） |

- 実行中の分岐と待機の分岐は `isDoNowRunning && activeTimer` で切り替わる（`src/App.tsx:10847`）。`isDoNowRunning` は `timerMatchesProjectNextStep(activeTimer, project.id, nextStep.generationId)`（`src/App.tsx:9528-9536`）。
- `doNowInstructionPath` が空なら手順書ボタンは出ない（`src/App.tsx:10913`）。
- 文脈メニュー（`kind === "doNow"`）の中身は `他の一手` 1 項目のみ（`src/App.tsx:12607-12610`）。`ContextMenu` 自体の `ariaLabel="操作メニュー"`（`src/App.tsx:12601`）。
- 空分岐のボタン: クラスは `doNowOnlyExcluded` のとき `mainActionButton mainActionButton--neutral`、それ以外 `mainActionButton mainActionButton--gold`（`src/App.tsx:10956-10958`）。`aria-label` は無し。`onClick`（`src/App.tsx:10959-10968`）: 除外中なら `setDoNowExcludedProjectId(null)` + `setDoNowPickedProjectId(null)`、`nextStepSetupProject` があれば `openNextStepEditor(nextStepSetupProject)`、無ければ `openProjectAddDialog()`。
- この節には `aria-haspopup` を持つ要素は無い。

**4. 十字キーでの移動（`src/keyboardNavigation.ts`）**

- `doNowBand` 専用の処理は無い。`keyboardNavigation.ts` に `doNow` / `.doNowBand` は一度も出てこない。
- したがって `ArrowUp` / `ArrowDown` は `.mainScrollArea` 全体の平坦な並び（`available(main)` = DOM 順）を 1 つずつ移動する（`src/keyboardNavigation.ts:220-223`）。候補 2 件以上のときは `div.doNowContent[tabindex="0"]` が DOM 上で子ボタンより先に来るため、順番は「`doNowContent` → `他の一手` → 開始/計測ボタン → 手順書」になる。
- `doNowBand` は `tabIndex={-1}` なので `available()` の対象外。スキップリンク経由でのみフォーカスされる（`focusSkipTarget`、`src/App.tsx:9699-9713`。第一候補は `.doNowStartPrimary:not(:disabled)`）。
- `ArrowLeft` は、`current.closest('.todayGrid, .dialogActions, .todayPickerRow')` に該当しないので、無条件で `.sidebar` の最初のフォーカス可能要素へ飛ぶ（`src/keyboardNavigation.ts:213-216`）。
- `ArrowRight` は同じくグループ外なので何も起きない（`src/keyboardNavigation.ts:217-219`。グループが無いと `step` を呼ばない）。
- `ArrowUp` で節の先頭より上に行こうとすると、`.topBar` の最初のフォーカス可能要素へ移る（`src/keyboardNavigation.ts:221-222`）。
- `Enter` / `Space` などの移動以外のキーは `keyboardNavigation.ts` に処理が無い。

**5. ドラッグでの並べ替え**

- `doNowBand` にドラッグ処理は無い。`onPointerDown` / `onDragStart` / `dataTransfer` / `draggable` はこの節に存在しない（`src/App.tsx:10718-10980` を通読して確認）。
- 並べ替えに相当する操作は `他の一手`（`showNextDoNowCandidate`、`src/App.tsx:9572-9576`）と文脈メニューの `他の一手`（`src/App.tsx:12608`）だけで、候補の切り替えであり並べ替えではない。候補側の並び順はバックエンドの `sort_by`（`src-tauri/src/commands/sessions.rs:279-288`）。

---

### E-勝利条件

**1. 行の範囲・最外要素のクラスと aria-label**

| 項目 | 内容 |
|---|---|
| 行の範囲 | `src/App.tsx:10624-10716` |
| 最外要素 | `<section>`（`src/App.tsx:10624`） |
| クラス | `victoryBar` + 条件付きで `victoryBar--done` / `victoryBar--empty` / `victoryBar--reward`（`src/App.tsx:10625-10632`） |
| `aria-label` | `今日の勝利条件`（`src/App.tsx:10633`）。`role` は無い。`aria-labelledby` も無い |

クラスの条件（`src/App.tsx:10627-10629`, 判定は `src/App.tsx:9314-9315`）:
- `victoryBar--done`: `victoryText` が空でなく、`config.today.victory.done` が真。
- `victoryBar--empty`: `config.today.victory.text.trim()` が空。
- `victoryBar--reward`: `completionFeedback?.kind === "victory"`。

**2. 出す条件と、空のときに出る文**

- 出す条件: `activeView === "main"` のとき常に描画される（記録ビューでは描画されない、`src/App.tsx:10594-10624`）。`config.today.victory.text` の有無では描画自体は変わらない。
- 空のとき（`victoryText` が空）:
  - 表示用ボタンの字が `今日はこれができれば勝ち`（`src/App.tsx:10685`）、クラスに `victoryTextButton--empty` が付く（`src/App.tsx:10677`）。
  - チェックボックスは `disabled={!victoryText}` で無効（`src/App.tsx:10645`）。
  - 編集モードの入力欄の `placeholder` も `今日はこれができれば勝ち`（`src/App.tsx:10664`）。
- 候補チップ: `!victoryText && victorySuggestions.length > 0` のときだけ出る（`src/App.tsx:10688`）。`victorySuggestions` は `uniqueSuggestions([morningVictorySuggestion, ...config.projects.slice(0,3) の nextStep.text, config.inbox[0]?.text], 5)`（`src/App.tsx:9316-9323`）。`uniqueSuggestions` は trim して空と重複を除き、上限 5 件（`src/App.tsx:893-906`）。
- 朝の自動フォーカス: `config` があり、`activeView === "main"`、`config.today.victory.text.trim()` が空、かつその日まだ実行していないとき、`victoryNavigationRef` に `data-auto-focus` を付けてフォーカスする（`src/App.tsx:3244-3256`）。リングは blur / キー入力で消す（`clearVictoryAutoFocus`、`src/App.tsx:7597-7599`）。
- 達成時の表示: `victoryDone` のとき `victoryBadge`（`completionFeedback?.kind === "victory"` なら `victoryBadge victoryBadge--reward` と `role="status"`）に `✓ 今日の勝利、達成`（`src/App.tsx:10704-10715`）。`victory` フィードバック中は `victoryRewardSweep`（`aria-hidden`）も出る（`src/App.tsx:10635-10637`）。
- 達成トグル時のガード: 本文が空なら `showToast("warn", "勝利条件を入力してください")` で何もしない（`src/App.tsx:7628-7635`）。

**3. 中のボタン・メニューの一覧**

| 字 | クラス | `aria-label` | 押したとき / 変更時 |
|---|---|---|---|
| （チェックボックス） | `check victoryCheck` | `勝利条件を達成` | `onChange={toggleVictoryDone}`（`src/App.tsx:10641-10648`、定義 `7628-7653`）。`disabled={!victoryText}` |
| 編集中の入力欄 | `victoryInput` / `victoryInput victoryInput--done` | `今日の勝利条件` | `onChange` で `updateVictoryText(value)`（`src/App.tsx:10660-10662`、定義 `7584-7595`）、`onKeyDown={handleVictoryKeyDown}`（Enter で確定・Escape で編集終了、`src/App.tsx:7655-7666`）、`onBlur` で `setVictoryEditing(false)`、`maxLength={90}` |
| 表示用テキスト（未編集時） | `victoryTextButton` / `victoryTextButton victoryTextButton--done` / `victoryTextButton victoryTextButton--empty` | `今日の勝利条件を編集` | `onClick={enterVictoryEditing}`（`src/App.tsx:10670-10686`、定義 `7601-7605`）、`onBlur` と `onKeyDown` は `clearVictoryAutoFocus` |
| 候補チップ（複数） | `suggestionChip` | 無し（字がそのまま名前） | `onClick={() => applyVictorySuggestion(suggestion)}`（`src/App.tsx:10691-10699`、定義 `7612-7626`）。`onMouseDown` で `preventDefault` |
| `✓ 今日の勝利、達成` | `victoryBadge` / `victoryBadge victoryBadge--reward` | 無し（`<span>`、`role="status"`） | ボタンではない（`src/App.tsx:10704-10714`） |
| `🏆` | `victoryIcon`（`aria-hidden="true"`） | 無し | ボタンではない（`src/App.tsx:10638-10640`） |
| `今日の勝利条件`（見出し文字） | `victoryLabel`（`<span>`） | 無し | ボタンではない（`src/App.tsx:10650`） |

- 候補チップの入れ物は `div.victorySuggestions` で `aria-label="勝利条件の候補"`（`src/App.tsx:10689`）。
- `applyVictorySuggestion` はスクロール位置を保存 → `setVictoryEditing(true)` → 保存 Promise 完了後に `scrollTop` 復元と `victoryInputRef.focus()`（`src/App.tsx:7612-7626`）。
- この節に文脈メニュー（右クリック）と `onContextMenu` は無い。
- この節に `aria-haspopup` を持つ要素は無い。

**4. 十字キーでの移動（`src/keyboardNavigation.ts`）**

- `victoryBar` 専用の処理は無い（`keyboardNavigation.ts` に `victory` は一度も出てこない）。
- `ArrowDown` / `ArrowUp` は `.mainScrollArea` 全体の平坦な並び（DOM 順）を移動する（`src/keyboardNavigation.ts:220-223`）。`mainScrollContent` の先頭はこの節なので、実質「この節の先頭が本文の先頭」になる。
- この節内の並び（DOM 順 = `available(main)` の順）:
  1. `input.check.victoryCheck`（`!victoryText` のときは `disabled` なので飛ばされる）
  2. 編集中は `input.victoryInput`、未編集なら `button.victoryTextButton`
  3. `button.suggestionChip`（候補があるときのみ、複数）
- `ArrowUp` でこの節より上に行こうとすると `.topBar` の最初のフォーカス可能要素へ移る（`src/keyboardNavigation.ts:221-222`）。本文の先頭がこの節なので、`victoryCheck` が最初の要素のとき `ArrowUp` はツールバーへ抜ける。
- `ArrowLeft` は `.todayGrid` / `.dialogActions` / `.todayPickerRow` のいずれにも属さないため、無条件で `.sidebar` の最初の要素へ飛ぶ（`src/keyboardNavigation.ts:213-216`）。`ArrowRight` は何も起きない（`src/keyboardNavigation.ts:217-219`）。
- 編集用入力欄（`victoryInput`）はテキスト input なので、フォーカス中は矢印ナビが早期 return し、キャレット移動がそのまま効く（`src/keyboardNavigation.ts:115`）。チェックボックスは除外されないので矢印ナビが効く。
- 自動フォーカスは「空のとき」だけ（`src/App.tsx:3244-3256`）。`Tab` 移動は素の DOM 順。

**5. ドラッグでの並べ替え**

- 無い。`victoryBar` の範囲（`src/App.tsx:10624-10716`）に `onPointerDown` / `onDragStart` / `draggable` / `dataTransfer` は存在しない。並べ替え対象も無い（単一の文字列と単一のチェックボックス）。
- 文字列の変更は編集モードの `onChange`（`updateVictoryText` → `persistConfig`、`src/App.tsx:7584-7595`）のみ。

---

### E-今日の3件

**1. 行の範囲・最外要素のクラスと aria-label**

| 項目 | 内容 |
|---|---|
| 行の範囲 | `src/App.tsx:10982-11554` |
| 最外要素 | `<section>`（`src/App.tsx:10982`） |
| クラス | `focusBand` のみ（`src/App.tsx:10982`） |
| ラベル | `aria-label` も `aria-labelledby` も無い。`role` も無い |
| 見出し | ヘッダーの `button.todaySectionDisclosure` の中の `<h2>今日の3件</h2>`（`src/App.tsx:10996`）。`id` は無い |

内部構造（`src/App.tsx:10983-11553`）:

| 要素 | クラス | 行 |
|---|---|---|
| ヘッダーバー（クリックで開閉） | `todaySectionBar` | `10984` |
| 開閉ボタン | `todaySectionDisclosure` | `10991` |
| 0 件表示 | `todaySectionCount`（字は `0件`） | `10998-10999` |
| 完了数表示 | `todayCompletionSummary` / `todayCompletionSummary--complete`（字は `{done} / {total} 完了`） | `11001-11009` |
| 説明文 | `todaySectionDescription`（字は `今日やると決めたもの。タイマーから開始します。`） | `11011-11013` |
| グリッド領域 | `todayGridRegion` | `11017` |
| グリッド | `todayGrid` + `todayGrid--empty` / `todayGrid--allCompleteReward` / `todayGrid--dropGuidance` / `todayGrid--dropTarget` | `11019-11036` |
| 1 件分のカード | `article.todayRow` + `todayRow--dragging` / `todayRow--running` / `todayRow--complete` / `todayRow--justCompleted` | `11089-11101` |
| 空状態 | `todayEmptyState` > `todayEmptyStateContent` | `11044-11045` |
| 完了演出 | `todayAllCompletionReward`（`role="status"`、字は `今日の3件、完了！`） | `11533-11536` |
| 次の枠 | `todayNextBatch` | `11540` |

- `.todayGrid` の CSS は 3 列グリッド（`src/styles.css:8440-8445`、`grid-template-columns: repeat(3, minmax(0, 1fr))`）。上限は `TODAY_ITEM_LIMIT = 3`（`src/constants.ts:1`）。

**2. 出す条件と、空のときに出る文**

| 状態 | 条件 | 出るもの |
|---|---|---|
| 節自体 | `activeView === "main"` のとき常に描画（`src/App.tsx:10594-10624`） | `focusBand` のセクション |
| 閉じている | `todayOpen === false`（初期値 `true`、`src/App.tsx:2174`） | ヘッダーバーのみ。`todayOpen && (` の中身は出ない（`src/App.tsx:11015`） |
| 0 件 | `config.today.items.length === 0` | `todayGrid--empty`（`src/App.tsx:11021`）+ `todayEmptyState`（`11043-11058`） |
| 1〜2 件 | `0 < items.length < 3` かつドラッグ中でない | カードの後ろに `todayPickerEntry`（`src/App.tsx:11452-11465`） |
| 3 件 | `items.length === 3` | 追加導線は出ない（`src/App.tsx:11453`）。`openTodayPicker` 自体も 3 件以上で即 return（`src/App.tsx:3983-3984`） |
| 全完了（3 件） | `allTodayItemsCompleted`（`items.length === 3` かつ全件 done、`src/App.tsx:9448-9449`） | `todayNextBatch` と `次の3件を選ぶ`（`src/App.tsx:11539-11551`） |
| 完了演出 | `completionFeedback?.kind === "todayAll"` | `todayGrid--allCompleteReward`（`11022-11024`）+ `todayAllCompletionReward`（`11532-11537`） |

空のときに出る文（`src/App.tsx:11044-11057`）:

| 位置 | 字 |
|---|---|
| `<strong>` | `今日やるものを選びましょう` |
| `<span>` | `次の一手・やりたいことから選べます` |
| ボタン | `今日やるものを選ぶ`（クラス `mainActionButton mainActionButton--gold`） |

ロック（無効化）:

| 要素 | 条件 | 行 |
|---|---|---|
| `todayStartButton--short` / `--normal` / `todayMeasureButton` | `disabled={!item.text.trim()}`（本文が空のカード） | `11333` / `11374` / `11415` |
| `todayRemoveButton` | `disabled={isRunningTodayItem}`。`title` は `タイマーを停止してから外してください` | `11230-11240` |
| 文脈メニューの `今日の3件から外す` | `isTimerOnTodayItem(...)` のとき `disabled` + 同じ `title` | `12765-12775` |
| 文脈メニューの `左へ移動` / `右へ移動` | 端で `disabled` | `12752` / `12759` |

ヘッダーの件数表示: 0 件なら `0件`（`src/App.tsx:10999`）、それ以外は `{todayCompletedCount} / {config.today.items.length} 完了`（`src/App.tsx:11008`）。`todayCompletionSummary--complete` は `todayAllCompleted`（`items.length > 0` かつ全件 done。`src/App.tsx:9312-9313`）で付く。`allTodayItemsCompleted`（`9448-9449`、3 件ちょうど限定）とは条件が違う。

**3. 中のボタン・メニューの一覧**

ヘッダー（`src/App.tsx:10983-11014`）:

| 字 | クラス | `aria-label` | 押したとき |
|---|---|---|---|
| `今日の3件`（+ chevron アイコン） | `todaySectionDisclosure` | 無し。`aria-expanded={todayOpen}` | `setTodayOpen((open) => !open)`（`src/App.tsx:10992`） |
| — | `todaySectionBar`（バー自体のクリック） | 無し | `toggleDisclosureFromBar(event, () => setTodayOpen(...))`（`src/App.tsx:10985-10987`、定義 `src/App.tsx:863-867`。`button, a, input, select, textarea` の内側なら無視） |

カード 1 枚（`src/App.tsx:11089-11449`）:

| 字 | クラス | `aria-label` / `title` | 押したとき |
|---|---|---|---|
| （カード自体。`tabIndex={0}`、`data-today-index={index}`） | `todayRow` | 無し | 右クリック → `openContextMenu({kind:"today", index, itemText}, …)`（`11109-11118`）。`onKeyDown` → `openContextMenuFromKeyboard(...)`（`11119-11125`）。ポインタ操作は後述（`11126-11129`） |
| `…`（`aria-hidden`） | `sourceRowMenu todayRowMenu` | `aria-label`: `{item.text || "未入力"}の操作`、`aria-haspopup="menu"`、`title`: `操作メニュー` | `openContextMenu({kind:"today", …}, rect.left, rect.bottom, currentTarget)`（`11132-11150`） |
| `✓` / `○` | `todayCompletionStatus` / `todayCompletionStatus--complete` | `aria-label`: `今日の分は完了` / `未完了`、`role="status"` | ボタンではない（`11151-11161`） |
| 本文（未入力なら `未入力`） | `todayTextButton` / `todayTextButton--done` | 無し（`title` は `{item.text || "未入力"}`） | ボタンではない `<span>`（`11194-11203`） |
| `手順書`（手順書パスがあるときのみ） | `doNowInstructionButton todayInstructionButton mainActionButton mainActionButton--neutral` | `aria-label`: `{item.text || "未入力"}の手順書を開く`、`title`: `手順書を開く` | `openInstructionWindow(...)`、失敗時トースト `手順書を開けません: {message}`（`11207-11228`） |
| `今日の3件から外す` | `todayRemoveButton mainActionButton mainActionButton--neutral` | 無し（`title` は実行中のみ `タイマーを停止してから外してください`） | `removeTodayItem(todaySourceKey(item, index))`（`11229-11245`、定義 `7711-7768`） |
| `+ きっかけ` / `{trigger} ▸` | `todayTriggerButton` / `todayTriggerButton todayTriggerButton--empty` | 無し | `beginTodayTriggerEdit(index)`（`11267-11278`、定義 `7770-7774`） |
| きっかけ入力欄（編集中） | `todayTriggerInput` | `aria-label`: `いつ・何の後にやる？`、`placeholder`: `例: 21時 / 夕食後`、`maxLength={EXECUTION_TRIGGER_MAX_CHARS}`（= 40、`src/constants.ts:3`） | `onChange` で `setTodayTriggerDraft`、`onKeyDown` で `handleTodayTriggerKeyDown(event, index)`（Enter で確定・Escape で取消、`7798-7808`）、`onBlur` で `cancelTodayTriggerEdit`（`11250-11265`） |
| `今日の分は完了` | `todayCompletedLabel` | 無し | 完了済みカードでは開始ボタンの代わりに出る（`11281-11282`） |
| 実行中: `再開` / `一時停止` / `停止` | `runningPauseButton` | `aria-label` と `title` が `このセッションを再開` / `このセッションを一時停止` | `togglePause()`（`11294-11318`） |
| 実行中: `終了` | `runningStopButton` | `title`: `このセッションを終了` | `finishActiveTimer(activeTimer)`（`11319-11326`） |
| 待機: `{n}分`（`play` アイコン、字は `aria-hidden`） | `todayStartButton todayStartButton--short` | `aria-label`: `短時間タイマー{shortMinutes}分で開始`、`title`: `短時間タイマー: {shortMinutes}分` | `startTimer(timerSourceId, …, "countdown", …)`（`11330-11370`） |
| 待機: `{n}分`（`play` アイコン、字は `aria-hidden`） | `todayStartButton todayStartButton--normal` | `aria-label`: `通常タイマー{defaultMinutes}分で開始`、`title`: `通常タイマー: {defaultMinutes}分` | `startTimer(..., "countdown", ...)`（`11371-11411`） |
| 待機:（`clock` アイコンのみ、字なし） | `todayMeasureButton` | `aria-label`: `時間を決めずに計測`、`title`: 同じ | `startTimer(..., "measure", ...)`（`11412-11444`） |

カード以外:

| 字 | クラス | `aria-label` | 押したとき |
|---|---|---|---|
| `今日やるものを選ぶ`（+ `add` アイコン） | `todayPickerEntry`（内側 `todayPickerEntryVisual`） | 無し | `openTodayPicker(event.currentTarget)`（`src/App.tsx:11455-11464`、定義 `3983-3995`） |
| `今日やるものを選ぶ`（空状態） | `mainActionButton mainActionButton--gold` | 無し | `openTodayPicker(event.currentTarget)`（`11048-11055`） |
| `次の3件を選ぶ`（+ `add` アイコン） | `secondaryButton mainActionButton mainActionButton--neutral` | 無し | `startNextTodayBatch()`（`11541-11548`、定義 `9040-9048`。`items` を空にして `selectionMutationTokens` も空にする） |
| `↓ ここにドロップして今日の3件から外す` | `todayRemoveDropZone` / `todayRemoveDropZone--active`（ドラッグ中のみ存在） | 無し（`aria-disabled={!removeEligible}`） | ドロップ先。ボタンではない（`11515-11529`） |
| `↓ ここにドロップして「今日の3件」に追加` | `todayDropGuidanceOverlay`（`aria-hidden`、プロジェクト/やりたいことのドラッグ中） | 無し | 案内表示のみ（`11037-11042`） |

文脈メニュー（`kind === "today"`、`src/App.tsx:12711-12785`）:

| 字 | 無効条件 | 押したとき |
|---|---|---|
| `編集` | `sourceKey` が無い / `canonicalSourceKey` が取れない / `sourceEditBlocked` | プロジェクトなら `openNextStepEditor(project, {origin:"today"})`、やりたいことなら `beginInboxEdit(index, "today")` |
| `左へ移動` | `contextMenu.index <= 0` | `moveTodayItemByOffset(index, -1)`（`12753`） |
| `右へ移動` | 末尾 | `moveTodayItemByOffset(index, 1)`（`12760`） |
| `今日の3件から外す` | そのカードでタイマー実行中 | `setContextMenu(null)` → `removeTodayItem(...)`（`12776-12780`） |

- 文脈メニューは `ContextMenu` に `ariaLabel="操作メニュー"`（`src/App.tsx:12601`）、開いた要素へ閉じたときフォーカスが戻る（`opener={contextMenuReturnFocusRef.current}`）。
- `openContextMenuFromKeyboard` が反応するのは `ContextMenu` キーまたは `Shift+F10` のみ（`src/App.tsx:2571`）。

**4. 十字キーでの移動（`src/keyboardNavigation.ts`）**

- `.todayGrid` は左右移動のグループとして明示的に扱われる唯一のメイン画面セレクタ。グループ判定は `current.closest('.todayGrid, .dialogActions, .todayPickerRow')`（`src/keyboardNavigation.ts:214` / `218`）。
- `ArrowLeft` / `ArrowRight`: `step(group, current, ∓1)`。グループ内の `available()` は平坦な DOM 順なので、「列」ではなく「行 → 行内の各ボタン」の順に 1 つずつ動く（`src/keyboardNavigation.ts:21-25`, `213-219`）。
  - `ArrowLeft` でグループ先頭より前へ出ようとすると `.sidebar` の最初の要素へ飛ぶ（`215-216`）。
  - `ArrowRight` でグループ末尾に達した場合は何も起きない（フォールバック無し、`217-219`）。
- `ArrowUp` / `ArrowDown`: グループを使わず、`.mainScrollArea` 全体の平坦な並び（DOM 順）で前後 1 つ（`src/keyboardNavigation.ts:220-223`）。`ArrowUp` が本文先頭で動けないときは `.topBar` の最初の要素へ抜ける（`222`）。
- `todayGrid` 内の平坦な順番（カード 1 枚あたり）: `article.todayRow[tabindex="0"]` → `button.todayRowMenu` → `button.todayInstructionButton`（手順書ありのとき）→ `button.todayRemoveButton` → `button.todayTriggerButton` または `input.todayTriggerInput` → 実行中なら `button.runningPauseButton` / `button.runningStopButton`、待機なら `button.todayStartButton--short` / `--normal` / `button.todayMeasureButton`。`article` が子より先に来るのは `querySelectorAll` が文書順だから（`src/keyboardNavigation.ts:4-11`）。
- カードは全件が `tabIndex={0}`（`src/App.tsx:11130`）。ロービング tabindex ではないので、Tab でも全カードが止まる。
- 開閉が閉じている（`todayOpen === false`）とき、グリッド内の要素は DOM に存在しないので `available()` に入らない（`src/App.tsx:11015`）。
- 入力欄（`todayTriggerInput`）はテキスト input なので、フォーカス中は矢印ナビが早期 return し、ネイティブのキャレット移動になる（`src/keyboardNavigation.ts:115`）。
- カード上のキーで文脈メニューを開けるのは `ContextMenu` / `Shift+F10`（`src/App.tsx:11119-11125`, `2569-2581`）。矢印キーでは開かない。
- 並べ替え後のフォーカス復帰は `moveTodayItemByOffset` が `[data-today-index="{移動先}"]` に `.focus()`（`src/App.tsx:5525-5527`、`focusAfterReorder` は rAF 2 回、`5459-5463`）。移動は `aria-live="polite"` の `reorderAnnouncement` で `「{text}」を{n}番目へ移動しました` と読み上げる（`src/App.tsx:5455-5457`, `12525-12527`）。

**5. ドラッグでの並べ替え**

HTML5 の Drag and Drop ではなく、Pointer Events による自前実装。`onDragStart` / `dataTransfer` はこの節に無い（`App.tsx` で `dataTransfer` を使うのはファイルドロップ・オーバーレイページ・操作の並べ替えのみ）。

型・状態:

| 名前 | 場所 | 内容 |
|---|---|---|
| `TodayPointerDrag` | `src/App.tsx:633-642` | `index` / `startX` / `startY` / `hasMoved` / `offsetX` / `offsetY` / `width` / `height` |
| `TodayDragPreview` | `src/App.tsx:644-662` | 上記 + `pointerX` / `pointerY` / `removeEligible` / `removeTargetActive` / `targetIndex` / `placement` / `targetIndicator` |
| `todayPointerDrag` 状態 | `src/App.tsx:2304` | プレビュー（描画用） |
| `todayPointerDragRef` | `src/App.tsx:2321` | ドラッグ中の実体 |
| `SIDEBAR_DRAG_THRESHOLD_PX` | `src/App.tsx:813` | `6`（この定数を today のドラッグ判定にも流用） |

結線（カードの `article`、`src/App.tsx:11126-11129`）:

| ハンドラ | 関数 | 行 |
|---|---|---|
| `onPointerDown` | `startTodayPointerDrag(event, index)` | `src/App.tsx:5708-5724` |
| `onPointerMove` | `updateTodayPointerDrag(event)` | `src/App.tsx:5726-5764` |
| `onPointerUp` | `finishTodayPointerDrag(event)` | `src/App.tsx:5766-5800` |
| `onPointerCancel` | `cancelTodayPointerDrag()` | `src/App.tsx:5802-5805` |

処理の流れ:

1. `startTodayPointerDrag`（`5708-5724`）: `event.button !== 0` なら中断。`isReorderBlockedTarget(event.target)` が真（`button, input, textarea, select, a, [role='button']` の内側、`src/App.tsx:1912-1917`）なら中断。`preventDefault` + `stopPropagation` → `setPointerCapture(event.pointerId)` → 要素の矩形から `offsetX/offsetY/width/height` を記録。
2. `updateTodayPointerDrag`（`5726-5764`）: 移動距離が `6px` 以上で `hasMoved = true`。`removeEligible` は「そのカードでタイマーが動いていない」こと（`activeTimerRef.current?.sourceId !== todayTimerSourceId(item, index)`）。`todayDropTargetFromPoint(x, y)` で挿入先とインジケータを計算し、`setTodayPointerDrag(...)`。
3. ドロップ先計算 `todayDropTargetFromPoint`（`src/App.tsx:1591-1639`）: `[data-today-index]` の矩形で判定。同じ行に並ぶカードがあれば左右半分で `before`/`after`（縦線インジケータ）、そうでなければ上下半分で `before`/`after`（横線インジケータ）。3 列グリッドなので実際には左右判定が使われる。
4. 除外ゾーン判定: `pointWithinTodayRemoveDropZone`（`src/App.tsx:1720-1734`、`.todayRemoveDropZone` の矩形 + 上 20px / 下 6px（幅 860px 以下なら下 32px））と `draggedCardTopWithinTodayRemoveDropZone`（`src/App.tsx:1736-1759`、カード上端がゾーン内か）。定数は `src/App.tsx:1715-1718`。
5. `finishTodayPointerDrag`（`5766-5800`）: 状態をクリアしてから、`hasMoved` が偽なら何もしない（＝クリック扱い）。除外ゾーン上なら `removeTodayItem(sourceKey)`。それ以外は `todayDropTargetFromPoint` の結果で `moveTodayItem(drag.index, target.index, target.placement)`。
6. `moveTodayItem`（`src/App.tsx:5365-5387`）: `draggedIndex === targetIndex` なら中断。`withoutDragged` を作り、`draggedIndex < targetIndex` なら `insertIndex -= 1`、`placement === "after"` なら `+= 1` して `splice` → `persistConfig({...config, today: {...config.today, items}})`。
7. キャンセル: `Escape` キーまたはウィンドウ `blur` で `todayPointerDragRef` 等を全部 null にする effect（`src/App.tsx:9249-9279`）。

ドラッグ中に出るクラス・要素:

| クラス | 条件 | 行 |
|---|---|---|
| `todayRow--dragging` | `todayPointerDrag?.index === index` | `11092` |
| `todayDropIndicator`（`aria-hidden`、`style={targetIndicator}`） | `todayPointerDrag?.targetIndicator` があり、かつ対象が自分自身でない（`5762`） | `11466-11472` |
| `todayDragGhost`（`aria-hidden`、`data-project-color`、位置/サイズをインライン style） | ドラッグ中。中に `ProjectIdentity` と本文（`未入力` フォールバック） | `11473-11512` |
| `todayRemoveDropZone` / `todayRemoveDropZone--active` | ドラッグ中。`aria-disabled={!removeEligible}` | `11515-11529` |
| `todayGrid--dropGuidance` / `todayGrid--dropTarget` | プロジェクト/やりたいことのドラッグ（`projectPointerDrag` / `inboxPointerDrag` の `todayGuidanceActive` / `todayTargetIndicator`） | `11025-11032` |
| `todayDropGuidanceOverlay` | 同上（`aria-hidden` の案内文） | `11037-11042` |
| `todayPickerEntry` 非表示 | `todayPointerDrag` が真のとき | `11454` |

- カード内のボタンは `onPointerDown={(event) => event.stopPropagation()}` でドラッグ開始を止めている（`11145`、`11222`、`11235`、`11262`、`11274`）。カード本体の `pointerdown` がボタン上で起きた場合は `isReorderBlockedTarget` でも弾かれる（二重の防御）。
- 並べ替えはドラッグ以外に文脈メニューの `左へ移動` / `右へ移動`（`moveTodayItemByOffset`、`src/App.tsx:5515-5528`）でも行える。
- 並べ替えは `persistConfig` を待たずに投げる（`void`）実装で、`moveTodayItem` は await しない（`5386`）。`moveTodayItemByOffset` は await して失敗時はフォーカス復帰しない（`5523`）。
- この節のカード並べ替えは「今日の3件」内の順序のみを変える。`config.today.items` の並びがそのまま `todaySourceKey` の index と `data-today-index` になる（`11059`, `11062-11063`, `11102`）。

**分からなかったこと**
- `victoryBar` / `doNowBand` / `focusBand` に `role` が明示されていないため、アクセシビリティツリー上で section がどう扱われるかはコードからは断定しなかった（`aria-label` の有無だけを記載した）。
- `.todayGrid` の 3 列レイアウトと `todayDropTargetFromPoint` の「同じ行」判定（`top` の差 2px 未満）が、ウィンドウ幅を狭めた 1〜2 列時にどう振る舞うかは CSS のメディアクエリを追いきれず、確認していない。

## E. メイン画面の節（続き）

対象は `activeView === "records"` でないときのメイン列（`src/App.tsx:10594-10623`）。3 節は `.mainScrollArea`（`src/App.tsx:10572`）内の `.mainScrollContent`（`src/App.tsx:10573-10578`）の兄弟で、DOM 順は `victoryBar`（`src/App.tsx:10624`）→ `doNowBand`（`src/App.tsx:10719`）→ `focusBand`（`src/App.tsx:10982`）→ `projectsBand`（`src/App.tsx:11557`）→ `inboxBand`（`src/App.tsx:11963`）→ `todayActivityBand`（`src/App.tsx:12459`）。

### E-次の一手

#### 1. 行の範囲・一番外の要素

| 項目 | 内容 |
|---|---|
| 行の範囲 | `src/App.tsx:11557-11961` |
| 一番外の要素 | `<section>`。className は配列結合で `projectsBand` ＋ `inboxPointerDrag?.nextStepEligible` のとき `sourceReturnBand--target`（`src/App.tsx:11560`）＋ `inboxPointerDrag?.nextStepTargetProjectId` のとき `sourceReturnBand--active`（`src/App.tsx:11561`） |
| `aria-label` | なし（`<section>` に `aria-label` / `role` は付いていない） |
| その他の属性 | `onContextMenu` で `{ kind: "projects" }` のメニュー（`src/App.tsx:11565-11574`）、`tabIndex={-1}`（`src/App.tsx:11574`） |
| 内部構造 | `div.disclosureHeader`（`src/App.tsx:11576-11642`）→ 条件付き `div.sourceReturnDropZone`（`src/App.tsx:11643-11654`）→ `projectsOpen` のとき `div.nextStepBody`（空のときは `nextStepBody nextStepBody--empty`、`src/App.tsx:11656-11661`） |

#### 2. 出す条件と空のときの文

| 要素 | 条件 | 出る文 |
|---|---|---|
| 節全体 | `activeView !== "records"`（`src/App.tsx:10594-10623`） | — |
| 本体 `nextStepBody` | `projectsOpen`（初期値 `true`、`src/App.tsx:2173`） | — |
| 空状態 `div.sectionEmptyState` | `config.projects.length === 0`（`src/App.tsx:11663`） | `プロジェクトを設定しましょう`（strong）／`取り組みたいことをまとめると、次の一手を決められます`（span）（`src/App.tsx:11666-11667`） |
| 見出しの件数 `span.disclosureCount` | 常時 | `{config.projects.length}件`（`src/App.tsx:11603`） |
| 見出しの説明 `span.disclosureDescription` | 常時 | `迷ったときに戻る再開地点。プロジェクトごとに1つだけ設定。`（`src/App.tsx:11604-11606`） |
| カード | `visibleProjects`（折りたたみ時は先頭 6 件、`PROJECT_CARD_COMPACT_LIMIT = 6`、`src/App.tsx:825`, `src/App.tsx:9298-9300`） | — |
| `− 折りたたむ` / `＋ 残りN件を表示` | `config.projects.length > PROJECT_CARD_COMPACT_LIMIT`（`src/App.tsx:11897`） | `− 折りたたむ`／`＋ 残り${config.projects.length - 6}件を表示`（`src/App.tsx:11907-11909`） |
| 次の一手が未設定のカード | `project.nextStep?.text.trim()` が空 | `まだ次の一手がありません`（`p.projectNextStepPlaceholder`、`title` も同文）（`src/App.tsx:11798-11814`） |
| ロック中バッジ `span.sourceLockBadge` | `project.nextStep` があり `sourceLockedByUnfinishedToday(config, "project:${id}")` が `true`（`src/App.tsx:11682-11685`, `src/sourceEdit.ts:44-50`） | `aria-label="今日の3件で使用中のためロック中"`、`title` は `SOURCE_LOCK_REASON` = `未完了の「今日の3件」に入っているため、完了または外すまで元の登録は変更できません`（`src/sourceEdit.ts:4-5`） |
| ロック中のカード操作 | `!sourceLocked` のときだけ `div.nextStepCardActions` を描画（`src/App.tsx:11815-11818`） | `＋ 今日へ` と `編集` はロック中は描画されない（`…` メニューだけ残る） |
| 採用済み表示 `span.nextStepTodayStatus` | `alreadySelected`（`rawTodayBuilderCandidates` から該当候補を引き、`todayCandidateSelected` が `true`、`src/App.tsx:11686-11691`） | `✓ 今日の3件`（`src/App.tsx:11777`） |
| ドロップ帯 `div.sourceReturnDropZone` | `inboxPointerDrag?.nextStepEligible`（やりたいことの項目ドラッグ中で昇格可能なとき、`src/App.tsx:6085-6087`, `11643`） | `ここにドロップして次の一手を設定する`（`src/App.tsx:11652`） |

#### 3. 中のボタン・メニューの一覧

見出し行（`src/App.tsx:11576-11642`）

| 字 | クラス | `aria-label` / `title` | 押したときの関数 |
|---|---|---|---|
| `次の一手`（`UiIcon` ＋ strong） | `disclosure`（`aria-expanded={projectsOpen}`） | なし | `setProjectsOpen((open) => !open)`（`src/App.tsx:11592-11602`） |
| `＋ プロジェクト` | `sectionAddButton sectionAddButton--barHitTarget nextStepHeaderAdd nextStepHeaderAdd--project mainActionButton mainActionButton--neutral` | `aria-label="プロジェクトを追加"` / `title="プロジェクトを追加"` | `openProjectAddDialog()`（`src/App.tsx:11608-11620`、定義 `src/App.tsx:8338-8352`） |
| `…` | `sectionMenuButton`（`aria-haspopup="menu"`） | `aria-label="次の一手の操作"` / `title="次の一手の操作"` | `openContextMenu({kind:"projects"}, rect.left, rect.bottom, ...)`（`src/App.tsx:11621-11640`） |

空状態（`src/App.tsx:11663-11678`）

| 字 | クラス | `aria-label` | 押したときの関数 |
|---|---|---|---|
| `プロジェクトを設定`（`UiIcon add`） | `mainActionButton mainActionButton--gold` | なし | `openProjectAddDialog`（`src/App.tsx:11668-11675`） |

カード（`article.nextStepRow sourceListRow nextStepCard`、`src/App.tsx:11693-11893`）

| 字 | クラス | `aria-label` / `title` | 押したときの関数 |
|---|---|---|---|
| `＋ 今日へ` | `nextStepTodayAdd mainActionButton mainActionButton--neutral` | なし / `title` は `今日の3件にあります`・`今日の3件は3件埋まっています`・`今日の3件に追加` の 3 分岐（`src/App.tsx:11831-11837`） | `addCandidateToToday(todayCandidate)`（`src/App.tsx:11825-11829`, 定義 `src/App.tsx:8129-8187`）。`disabled` = `!todayCandidate || alreadySelected || config.today.items.length >= TODAY_ITEM_LIMIT`（`src/App.tsx:11820-11824`） |
| `編集` | `nextStepRowAction nextStepRowAction--change mainActionButton mainActionButton--neutral` | なし / `title={sourceEditBlockReason("project:id")}` | `openNextStepEditor(project)`（`src/App.tsx:11842-11854`、定義 `src/App.tsx:8400-8444`）。`disabled={sourceEditBlocked("project:id")}` |
| `次の一手を設定` | `nextStepRowAction nextStepRowAction--set mainActionButton mainActionButton--neutral` | なし / 同じ `title` | `openNextStepEditor(project)`（`src/App.tsx:11858-11870`） |
| `…` | `sourceRowMenu nextStepRegionMenu`（`aria-haspopup="menu"`） | `aria-label={`${project.name}の次の一手の操作`}` / `title="次の一手の操作"` | `openContextMenu({kind:"nextStep", project}, ...)`（`src/App.tsx:11872-11891`） |

リスト操作（`src/App.tsx:11897-11912`）

| 字 | クラス | `aria-label` | 押したときの関数 |
|---|---|---|---|
| `− 折りたたむ` / `＋ 残りN件を表示` | `mainActionButton mainActionButton--neutral` | なし | `projectListAnchorRef.current = null` → `setProjectsListExpanded(...)`（`src/App.tsx:11899-11910`） |

コンテキストメニュー（`role="menu"`、`aria-label="操作メニュー"`、`src/components/ContextMenu.tsx:114-151`。項目は `role="menuitem"`、`src/components/ContextMenu.tsx:16-21`）

| メニュー種別 | 字 | クラス | 押したときの関数 |
|---|---|---|---|
| `{kind:"projects"}`（見出しの `…`・見出し右クリック、`src/App.tsx:12945-12953`） | `プロジェクトを追加` | — | `openProjectAddDialog` |
| 同上 | `まとめて取り込む` | — | `openImportDialog("")` |
| `{kind:"nextStep"}`（カード右クリック・カードの `…`、`src/App.tsx:12863-12921`） | `プロジェクトを編集` | — | `openProjectEditDialog(contextMenu.project)` |
| 同上（次の一手あり） | `次の一手を編集` | — | `openNextStepEditor(project)` |
| 同上（次の一手あり） | `別の行動に入れ替える` | — | `openNextStepEditor(project, {mode:"promote", text:"", projectLocked:true})` |
| 同上（次の一手あり） | `次の一手を未設定にする` | — | `clearProjectNextStep(project)`（確認ダイアログ `src/App.tsx:8859-8871`） |
| 同上（未設定） | `次の一手を設定` | — | `openNextStepEditor(project)` |
| 同上 | `プロジェクトを削除…` | `contextMenuDanger contextMenuSeparatorBefore` | `requestProjectDeletion(project)` |

（`次の一手を編集`・`別の行動に入れ替える`・`次の一手を未設定にする`・`次の一手を設定` はいずれも `disabled={sourceEditBlocked("project:id")}`、`title={sourceEditBlockReason(...)}`。）

#### 4. 十字キーでの移動（`src/keyboardNavigation.ts`）

* `src/keyboardNavigation.ts` 全 224 行を読んだ範囲では、`projectsBand` / `nextStepCard` / `inboxBand` / `wishlistGroup` / `todayActivityBand` というセレクタは一切出てこない。この 3 節専用の矢印処理は無い。
* 呼び出しは 1 箇所だけ。`document` の `keydown` に登録し `navigateAppArrow(event, shortcutCaptureActiveRef.current)` を呼ぶ（`src/App.tsx:2269-2278`、import は `src/App.tsx:182`）。`captureActive` が `true`（ショートカット記録中）のときは即 return（`src/keyboardNavigation.ts:103-110`）。
* モーダル（`.modalBackdrop [role="dialog"][aria-modal="true"]`）または `.expandedTimer[role="dialog"]` があるときは、その surface 内の移動に切り替わり、節の並びは使われない（`src/keyboardNavigation.ts:118-167`）。
* メニュー内にフォーカスがあると `navigateAppArrow` は return し（`src/keyboardNavigation.ts:116`）、メニュー側が ↑↓/Home/End/Escape を処理する（`src/components/ContextMenu.tsx:119-138`, `93-106`）。
* 入力欄・`select`・`[contenteditable="true"]` にフォーカスがあると return（`src/keyboardNavigation.ts:115`）。
* 通常時（`src/keyboardNavigation.ts:212-223`）
  * `ArrowDown` / `ArrowUp` … `step(main, current, ±1, event)`。`main` は `.mainScrollArea`（`src/keyboardNavigation.ts:171`）。すなわち **節単位の特別扱いはなく、`.mainScrollArea` 全体の DOM 順**で次の/前のフォーカス可能要素へ移る（`src/keyboardNavigation.ts:21-25`, `221`）。端では移動しない（wrap しない）。
  * `ArrowLeft` … `current.closest('.todayGrid, .dialogActions, .todayPickerRow')` の中なら 1 つ前へ、そうでなければ `.sidebar` の先頭へ（`src/keyboardNavigation.ts:213-216`）。この 3 節はどのグループにも該当しないので、**節内を左に移動できない**。
  * `ArrowRight` … 上記グループ内のときだけ 1 つ次へ。グループ外では何もしない（`src/keyboardNavigation.ts:217-219`）。
* フォーカス対象は `available()` が `button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]` を DOM 順で返したもの（`src/keyboardNavigation.ts:1-11`）。`aria-hidden="true"` / `[inert]` の内側と、矩形 0・`visibility:hidden` は除外。**`opacity` は判定に使っていない**。
* よって「次の一手」節の ↑↓ の順番は次のとおり。

| 順 | 要素 | 根拠 |
|---|---|---|
| 1 | 節の開閉ボタン（`次の一手`） | `button.disclosure`（`src/App.tsx:11592`） |
| 2 | `＋ プロジェクト` | `button`（`src/App.tsx:11608`） |
| 3 | `…`（次の一手の操作） | `button`（`src/App.tsx:11621`） |
| 4〜 | 各カードの `article`（`tabIndex={0}`）→ `div.nextStepProjectRegion`（`tabIndex={0}`）→ `div.nextStepActionRegion`（`tabIndex={0}`）→ 中のボタン（`＋ 今日へ` / `編集` または `次の一手を設定` / `…`） | `src/App.tsx:11740`, `11757`, `11796`, `11818`, `11842`, `11858`, `11872` |
| 末尾 | `− 折りたたむ` / `＋ 残りN件を表示`（表示時） | `src/App.tsx:11899` |

* ロック中のバッジ `span.sourceLockBadge` は `tabIndex={0}` なのでフォーカス順に入る（`src/App.tsx:11770`）。カード 1 枚あたり最大 7 個のフォーカス停止点（article・projectRegion・actionRegion・バッジ・ボタン 3 個）になる。
* メニューは `Shift+F10` または `ContextMenu` キーでも開く（`openContextMenuFromKeyboard`、`src/App.tsx:2569-2581`）。付与箇所は article（`src/App.tsx:11733-11735`）、`nextStepProjectRegion`（`11754-11756`）、`nextStepActionRegion`（`11793-11795`）、節見出し（`src/App.tsx:11565-11574` は右クリックのみ）。開いた後はメニュー先頭の有効項目へフォーカス（`src/components/ContextMenu.tsx:65, 73`）。

#### 5. ドラッグでの並べ替えの仕組み

HTML5 の `draggable` / `dataTransfer` はこの節では使っていない。ポインタ操作と `setPointerCapture` で実装されている（`onPointerDown` / `onPointerMove` / `onPointerUp` / `onPointerCancel`、`src/App.tsx:11736-11739`）。しきい値は `SIDEBAR_DRAG_THRESHOLD_PX = 6`（`src/App.tsx:813`）。

| 操作 | 開始 | 更新 | 終了 | 当たり判定 | 確定処理 | クラス |
|---|---|---|---|---|---|---|
| カードの並べ替え | `startProjectPointerDrag`（`src/App.tsx:5874-5895`。`event.button !== 0` と `isReorderBlockedTarget` を除外、`setPointerCapture`） | `updateProjectPointerDrag`（`src/App.tsx:5897-5960`） | `finishProjectPointerDrag`（`src/App.tsx:5962-6011`） | `projectDropTargetFromPoint`（`src/App.tsx:1761-1771`）→ `projectDropTargetFromCard`（`1773-1797`）/ `nearestProjectDropTargetFromPoint`（`1799-1820`）、配置は `resolveProjectDropPlacement`（`src/App.tsx:5862-5872`） | `moveProject(drag.id, target.id, placement)`（`src/App.tsx:5389-5413`） | ドラッグ中 `nextStepRow--dragging`（`src/App.tsx:11697-11699`）、対象カード `nextStepCard--dropTarget`（`11700-11702`）、挿入線 `div.projectDropIndicator`（`11913-11919`、`projectDropIndicator` `1882-1910`）、ゴースト `div.projectDragGhost`（`11927-11958`） |
| カード → 今日の3件 | 同上 | 同上（`todayAdoptionDropTargetFromPoint`、`src/App.tsx:1641-1707`） | `finishProjectPointerDrag`（`5992-5995`） | `pointWithinSelector(..., ".todayGrid")`（`5907`） | `addCandidateToToday(candidate, insertionIndex)`（`src/App.tsx:8129-8187`。3 件上限・重複は warn） | `projectDragGhost--today`（`11930-11933`）、`div.todayDropIndicator`（`11920-11926`） |
| カード → やりたいこと | 同上 | 同上（`wishlistEligible = project?.nextStep?.text.trim() && !sourceEditBlocked(...)`、`5930-5932`） | `finishProjectPointerDrag`（`5998-6006`） | `pointWithinSelector(..., ".inboxBand")` | `removeProjectNextStep(project, "return")`（`src/App.tsx:8817-8847`）。ブロック時は `warnSourceEditBlocked` | `sourceReturnBand--target` / `--active`（`src/App.tsx:11560-11561`）、ドロップ帯（`11643-11654`） |

* ドラッグ開始は「ボタン・入力・リンク・`[role='button']` の上で押したとき」を除外（`isReorderBlockedTarget`、`src/App.tsx:1912-1917`）。カード内のボタンからはドラッグが始まらない。
* 画面端では自動スクロールする（`updateProjectAutoScroll`、`src/App.tsx:5841-5860`、速度上限 ±18px/frame）。
* 並べ替え結果は `persistConfig` で保存（`src/App.tsx:5412`）。アナウンス用の live region は `div.reorderAnnouncement`（`src/App.tsx:12525-12527`）だが、`moveProject` は `announceReorder` を呼んでいない（「やりたいこと」の上下移動だけが呼ぶ）。

### E-やりたいこと

#### 1. 行の範囲・一番外の要素

| 項目 | 内容 |
|---|---|
| 行の範囲 | `src/App.tsx:11963-12457` |
| 一番外の要素 | `<section>`。className は `inboxBand` ＋ `projectPointerDrag?.wishlistEligible` のとき `sourceReturnBand--target`（`11966`）＋ `projectPointerDrag?.wishlistTarget` のとき `sourceReturnBand--active`（`11967`） |
| `aria-label` | なし |
| 内部構造 | `div.disclosureHeader`（`data-inbox-header` 付き、`src/App.tsx:11972-12041`）→ 条件付き `div.sourceReturnDropZone`（`12043-12054`）→ `inboxOpen` のとき `div.inboxBody`（`12056-12057`）→ `div.inboxGroups`（`12075`）内に `section.wishlistGroup` を繰り返し（`12089-12380`） |
| グループ分け | `groupWishlistForDisplay(config)`（`src/App.tsx:12076`, 定義 `src/nextStepWishlist.ts:48-54`）。プロジェクト所属グループを `config.inbox` の初出順に並べ、`未分類` を最後に置く（`src/nextStepWishlist.ts:24-46`）。グループ key は `project:${id}` または `unassigned`（`src/nextStepWishlist.ts:18-22`） |

#### 2. 出す条件と空のときの文

| 要素 | 条件 | 出る文 |
|---|---|---|
| 節全体 | `activeView !== "records"` | — |
| 本体 `div.inboxBody` | `inboxOpen`（初期値 `false`、`src/App.tsx:2172`） | — |
| 空状態 `div.sectionEmptyState` | `config.inbox.length === 0`（`src/App.tsx:12058`） | `やりたいことを設定しましょう`（strong）／`あとでやりたいことを登録して、今日やる候補にできます`（span）（`src/App.tsx:12061-12062`） |
| 見出しの件数 | 常時 | `{config.inbox.length}件`（`src/App.tsx:12001`） |
| 見出しの説明 | 常時 | `他にやりたいこと。今日やるものは「今日の3件」から選べます。`（`src/App.tsx:12002-12004`） |
| グループ折りたたみ | `collapsed`（`wishlistGroupViews[group.key]?.collapsed`、`src/App.tsx:12083`）。初期は未設定＝展開 | 折りたたむと行が消える（`!collapsed && (...)`、`12069`） |
| 行の表示件数 | `sourceListRange(group.items.length, expanded, page)`（`src/App.tsx:12078-12084`, 定義 `830-843`） | 5 件以下は全件、6〜19 件は 5 件＋`残りN件をもっと見る`、20 件以上は 10 件/page のページャ |
| `5件だけ表示` / `残りN件をもっと見る` | `group.items.length > SOURCE_LIST_COMPACT_LIMIT(5)` かつ `< SOURCE_LIST_PAGINATION_THRESHOLD(20)`（`src/App.tsx:12314-12315`） | `5件だけ表示`／`残り${n - 5}件をもっと見る`（`12330-12332`） |
| ページャ `nav.sourceListPagination` | `group.items.length >= 20`（`src/App.tsx:12336`） | `前へ` / `{page} / {pageCount}` / `次へ`（`12341-12375`） |
| ロック中バッジ `span.sourceLockBadge sourceLockBadge--wishlist` | `sourceKey = wishlist:${item.id}` があり `sourceLockedByUnfinishedToday(config, sourceKey)`（`src/App.tsx:12173-12177`, `12240-12249`） | `aria-label="今日の3件で使用中のためロック中"`、`title` は `SOURCE_LOCK_REASON` |
| `▷ 次の一手を設定` | `!nextStepSelected && !sourceLocked`（`src/App.tsx:12254`） | ボタンを描画（ロック中・設定済みは描画しない） |
| `✓ 次の一手に設定済み` | `wishlistItemIsCurrentNextStep(item)`（`src/App.tsx:12193`, 定義 `9357-9364`。`sourceWishlistId` 一致、無ければ本文一致） | `✓ 次の一手に設定済み`（`12280-12284`） |
| `✓ 今日の3件に設定済み` | `selected`（`config.today.items` と `canonicalSourceKey` で照合、`src/App.tsx:12178-12192`） | `✓ 今日の3件に設定済み`（`12285-12289`） |
| ドロップ帯 | `projectPointerDrag?.wishlistEligible`（次の一手カードのドラッグ中、`src/App.tsx:5930-5932`） | `ここにドロップしてやりたいことへ戻す`（`12052`） |

#### 3. 中のボタン・メニューの一覧

見出し行（`src/App.tsx:11972-12041`）

| 字 | クラス | `aria-label` / `title` | 押したときの関数 |
|---|---|---|---|
| `やりたいこと`（`UiIcon` ＋ strong） | `disclosure`（`aria-expanded={inboxOpen}`） | なし | `setInboxOpen((open) => !open)`（`11990-12000`） |
| `＋ やりたいこと` | `sectionAddButton sectionAddButton--barHitTarget nextStepHeaderAdd nextStepHeaderAdd--wishlist mainActionButton mainActionButton--neutral` | `aria-label="やりたいことを追加"` / `title="やりたいことを追加"` | `openInboxAddDialog(event.currentTarget)`（`12006-12019`、定義 `8324-8336`）。`disabled={inboxAddOpen}` |
| `…` | `sectionMenuButton`（`aria-haspopup="menu"`） | `aria-label="やりたいことの操作"` / `title="やりたいことの操作"` | `openContextMenu({kind:"inboxes"}, rect.left, rect.bottom, ...)`（`12020-12039`） |

空状態（`src/App.tsx:12058-12074`）

| 字 | クラス | `aria-label` | 押したときの関数 |
|---|---|---|---|
| `やりたいことを追加する`（`UiIcon add`） | `mainActionButton mainActionButton--gold` | なし | `openInboxAddDialog(event.currentTarget)`（`12063-12071`）。`disabled={inboxAddOpen}` |

グループ見出し（`button.wishlistGroupHeader`／未分類は `wishlistGroupHeader wishlistGroupHeader--fixed`、`src/App.tsx:12113-12168`）

| 字 | クラス | `title` | 押したときの関数 |
|---|---|---|---|
| `プロジェクト名`（`ProjectIdentity`）または `未分類` ＋ `{n}件` ＋ chevron | `wishlistGroupHeader`（`aria-expanded={!collapsed}`） | `未分類は並べ替えできません`／`${group.name}（ドラッグでグループを並べ替え、右クリックで編集）`／`ドラッグでグループを並べ替え`（`12144-12150`） | `onClick`: `event.detail === 0`（キーボード）または `unassigned` のとき `toggleWishlistGroup(group.key)`（`12120-12124`）。マウスは `finishWishlistGroupPointerDrag` 側で `toggleWishlistGroup`（`6272-6275`）。右クリックは `{kind:"project", project}` メニュー（`12125-12135`） |

行（`div.inboxRow sourceListRow`、`src/App.tsx:12195-12310`）

| 字 | クラス | `aria-label` / `title` | 押したときの関数 |
|---|---|---|---|
| `▷ 次の一手を設定` | `wishlistNextStepAction nextStepRowAction nextStepRowAction--set mainActionButton mainActionButton--neutral` | `aria-label={`${item.text}の次の一手を設定`}` / `title` は `sourceEditBlockReason(...) ?? "次の一手を設定"`（`12267-12273`） | `promoteInboxToNextStep(index)`（`12262-12265`、定義 `8446-8496`）。`disabled = !item.id || sourceEditBlocked(...)` |
| `…` | `sourceRowMenu`（`aria-haspopup="menu"`） | `aria-label={`${item.text}の操作`}` / `title="操作メニュー"` | `openContextMenu({kind:"inbox", index, itemText}, rect.left, rect.bottom, ...)`（`12290-12308`） |

* `▷ 次の一手を設定` は CSS で `opacity: 0; pointer-events: none`、`.inboxRow:hover`・`.inboxRow:focus-within`・`:focus-visible` のときだけ表示（`src/styles.css:9750-9788`）。幅は 120px 固定（`9743-9748`）、`max-width: 620px` で 112px（`9795-9801`）、`max-width: 520px` では `wishlistNextStepSlot` ごと `display: none`（`9803-9807`）。`…` は常時 `opacity: 1`（`9790-9793`）。

ページャ（`src/App.tsx:12336-12377`）

| 字 | クラス | `aria-label` | 押したときの関数 |
|---|---|---|---|
| `前へ` / `次へ` | `mainActionButton mainActionButton--neutral`（`disabled` は端で true） | 親 `nav` に `aria-label={`${group.name}のやりたいことページ`}`（`12338`） | `setWishlistGroupViews` の `page` を ±1（`12341-12375`） |

コンテキストメニュー（`src/App.tsx:12786-12861`, `12922-12944`, `12954-12957`）

| メニュー種別 | 字 | クラス | 押したときの関数 |
|---|---|---|---|
| `{kind:"inbox"}`（行右クリック・行の `…`） | `次の一手にする` ／ `次の一手に設定済み`（設定済み・ブロック時は `disabled`） | — | `promoteInboxToNextStep(contextMenu.index)`（`12796`） |
| 同上 | `上へ移動` / `下へ移動`（同一グループ内の隣が無いとき `disabled`） | — | `moveInboxItemByOffset(contextMenu.index, ∓1)`（`12810`, `12817`、定義 `5530-5551`） |
| 同上 | `編集` | — | `beginInboxEdit(contextMenu.index)`（`12828`、定義 `7890-...`） |
| 同上 | `完了にする` | — | `completeInboxItem(contextMenu.index)`（`12842`、定義 `7989-8029`。確認ダイアログ） |
| 同上 | `削除` | `contextMenuDanger` | `deleteInboxItem(contextMenu.index)`（`12857`、定義 `8031-8061`。確認ダイアログ） |
| `{kind:"project"}`（グループ見出し右クリック） | `プロジェクトを編集` / `プロジェクトを管理` / `プロジェクトを削除…` | 削除は `contextMenuDanger contextMenuSeparatorBefore` | `openProjectEditDialog` / `openProjectManagement` / `requestProjectDeletion`（`12924-12944`） |
| `{kind:"inboxes"}`（節見出しの `…`・右クリック） | `やりたいことを追加` | — | `openInboxAddDialog()`（`12954-12957`） |

#### 4. 十字キーでの移動

* 専用処理は無い（`src/keyboardNavigation.ts` 全 224 行に `inboxBand` / `wishlistGroup` / `inboxRow` は出現しない）。↑↓は `.mainScrollArea` 全体の DOM 順（`src/keyboardNavigation.ts:212-223`）、←→はこの節では効かない（グループ `.todayGrid, .dialogActions, .todayPickerRow` に該当しないため、←はサイドバー先頭へ移動、→は何もしない）。
* 「やりたいこと」節内の ↑↓ の順番:

| 順 | 要素 | 根拠 |
|---|---|---|
| 1 | 節の開閉ボタン（`やりたいこと`） | `button.disclosure`（`src/App.tsx:11990`） |
| 2 | `＋ やりたいこと` | `button`（`12006`。`disabled` のときは対象外） |
| 3 | `…`（やりたいことの操作） | `button`（`12020`） |
| 4〜 | グループごとに `button.wishlistGroupHeader` → 行の `div.inboxRow`（`tabIndex={0}`、`12237`）→ 中の `▷ 次の一手を設定`（`12255`）→ `…`（`12290`）→ `5件だけ表示`（`12317`）or ページャの `前へ`/`次へ`（`12341`, `12360`） | `src/App.tsx:12113`, `12195`, `12237`, `12252-12308`, `12317`, `12341-12375` |
| 備考 | ロック中バッジ `span.sourceLockBadge` は `tabIndex={0}`（`12244`） | — |

* 行の `div.inboxRow` は `tabIndex={0}` でフォーカス可能（`src/App.tsx:12237`）。`aria-label` は付いていない（読み上げ名は中の `span.inboxItemText` の文字列）。
* `Shift+F10` / `ContextMenu` キー: 行（`src/App.tsx:12224-12230`）、グループ見出し（`12136-12143`、`groupProject` があるときのみ）、節見出し（`11984`）に付与。
* CSS 上 `opacity: 0` の `▷ 次の一手を設定` も `available()` の判定（`getClientRects().length > 0` と `visibility`）を通るため、↑↓のフォーカス順には含まれる（`src/keyboardNavigation.ts:4-11`、`src/styles.css:9762-9770`）。

#### 5. ドラッグでの並べ替えの仕組み

| 操作 | 開始 | 更新 | 終了 | 当たり判定 | 確定処理 | クラス |
|---|---|---|---|---|---|---|
| グループの並べ替え | `startWishlistGroupPointerDrag`（`src/App.tsx:6216-6239`）。`key === "unassigned"` は開始しない、`event.target.closest(".wishlistGroupHeader")` が自要素内にあるときだけ開始、`setPointerCapture` | `updateWishlistGroupPointerDrag`（`6241-6262`） | `finishWishlistGroupPointerDrag`（`6264-6280`）。動いていなければ `toggleWishlistGroup(drag.key)` | `wishlistGroupDropTargetFromPoint`（`1822-1849`。`[data-wishlist-group]` の矩形内判定、上半分で `before`） | `moveWishlistGroup(drag.key, target.key, target.placement)`（`5438-5453`）→ `reorderWishlistGroups`（`src/nextStepWishlist.ts:56-81`。`unassigned` へは常に `before`、`config.inbox` をグループ順に並べ直す） | ドラッグ中 `wishlistGroup--dragging`（`12093-12095`）、挿入線 `div.wishlistGroupDropIndicator`（`12398-12404`）、ゴースト `div.wishlistGroupDragGhost`（`12405-12419`。幅は最大 320px） |
| 行（項目）の並べ替え | `startInboxPointerDrag`（`src/App.tsx:6020-6042`）。`item.id` が無い旧形式は開始しない | `updateInboxPointerDrag`（`6044-6124`） | `finishInboxPointerDrag`（`6126-6197`） | `inboxDropTargetFromPoint`（`1851-1880`。`[data-inbox-index]` の矩形内、上半分で `before`）。同一グループ内のみ許可（`wishlistGroupKey(sourceItem) === wishlistGroupKey(targetItem)`、`6096-6103`） | `moveInboxItem(sourceIndex, target.index, placement)`（`5415-5436`。グループ跨ぎは return） | ドラッグ中 `inboxRow--dragging`（`12196-12200`）、挿入線 `div.inboxDropIndicator`（`12384-12390`）、ゴースト `div.inboxDragGhost`（`12420-12454`。幅は最大 300px、`ProjectIdentity` か `プロジェクトなし` を表示） |
| 行 → 次の一手 | 同上 | `nextStepEligible` / `nextStepTargetProjectId` を計算（`6085-6091`。`pointWithinSelector(..., ".projectsBand")` のとき、その項目の所属プロジェクト ID） | `6169-6187` | `.projectsBand` 上 | `promoteWishlistToProject(item.id)`（`8498-8578`）。不可なら `showToast("warn", blockReason ?? "このやりたいことは次の一手へ移動できません")`（`6185`） | 節側 `sourceReturnBand--target/--active`（`11560-11561`）、各行 `nextStepCard--dropTarget`（`11700-11702`）、ドロップ帯（`11643-11654`） |
| 行 → 今日の3件 | 同上 | `todayGuidanceActive` / `todayTarget`（`6069-6084`） | `6161-6164` | `todayAdoptionDropTargetFromPoint`（`1641-1707`） | `addCandidateToToday(candidate, insertionIndex)` | `inboxDragGhost`、`div.todayDropIndicator`（`12391-12397`） |

* ドラッグ開始の除外は `isReorderBlockedTarget`（`src/App.tsx:1912-1917`）と `event.button !== 0`。グループは見出し上の押下のみ、行は行全体（`item.id` 必須）。
* 並べ替えのキーボード代替はコンテキストメニューの `上へ移動` / `下へ移動` だけ（`moveInboxItemByOffset`、`src/App.tsx:5530-5551`。同一グループ内で入れ替え、`setContextMenu(null)`、`announceReorder(item.text, targetIndex + 1)`、`focusAfterReorder` で `[data-inbox-index="..."]` にフォーカス）。
* グループの並べ替えにはキーボード代替が無い（メニュー項目は `プロジェクトを編集` / `プロジェクトを管理` / `プロジェクトを削除…` のみ、`src/App.tsx:12922-12944`）。
* HTML5 drag は使っていない（`dataTransfer` / `onDragStart` はこの節には無く、`src/App.tsx` 内の該当はサイドバー・オーバーレイページ・ボタン編集・JSON 取り込みのみ）。

### E-今日の実行

#### 1. 行の範囲・一番外の要素

| 項目 | 内容 |
|---|---|
| 行の範囲 | `src/App.tsx:12459-12518` |
| 一番外の要素 | `<section className="todayActivityBand">`（`src/App.tsx:12459`。動的クラス無し） |
| `aria-label` | なし |
| 内部構造 | `div.disclosureHeader`（`12460-12480`）→ `todayActivityOpen` のとき `div.todayActivityBody`（`12482-12483`）→ `div.todayActivityList`（`12485`）内に `div.todayActivityRow`（`12491-12509`） |

#### 2. 出す条件と空のときの文

| 要素 | 条件 | 出る文 |
|---|---|---|
| 節全体 | `activeView !== "records"` | — |
| 本体 `div.todayActivityBody` | `todayActivityOpen`（初期値 `false`、`src/App.tsx:2186`） | — |
| 見出しの件数 | `todayActivityCount = todayActivityDate === displayedDayKey ? todayActivityEntries.length : 0`（`src/App.tsx:9452-9453`）。`displayedDayKey = topMenuDayKey = observedDayKey || config?.today.date`（`9450`, `2112`） | `{todayActivityCount}件`（`12477`） |
| 見出しの説明 | 常時 | `タイマーで実行した内容`（`12478`） |
| バッジ `span.todayActivityAutoBadge` | 常時 | `自動`（`12479`） |
| 空のとき | `todayActivityCount === 0` | `今日はまだ実行記録がありません。`（`p.quietText`、`12514`） |
| 行の内容 | `todayActivityCount > 0` | `ProjectIdentity`（`title` は `プロジェクト: ${name}`）＋ `session.label || project.name`、または `span.todayActivityDot` ＋ `session.label || "記録"`／`span.todayActivityStartedAt` に `session.startedAt` をそのまま表示／`strong` に `${session.minutes}分`（`12493-12508`） |
| データ源 | `loadSessionEntries({ dateScope: "today" })` の `entries` と `date`（`refreshTodayActivity`、`src/App.tsx:3043-3055`）。型は `SessionEntryRow`（`src/types.ts:468-478`） | — |

補足: `src/App.tsx:12479` のバッジは `自動`。実行記録の行に `note` / `manual` は表示していない。

#### 3. 中のボタン・メニューの一覧

| 字 | クラス | `aria-label` / `title` | 押したときの関数 |
|---|---|---|---|
| `今日の実行`（`UiIcon` ＋ strong） | `disclosure`（`aria-expanded={todayActivityOpen}`） | なし | `setTodayActivityOpen((open) => !open)`（`12466-12476`） |
| （行・本文内のボタン） | — | — | なし。`div.todayActivityRow`（`12491-12509`）と `div.todayActivityBody` には `onClick` / `onContextMenu` / `onKeyDown` / `tabIndex` が付いていない |

* `div.disclosureHeader` 自体をクリックしても開閉する（`toggleDisclosureFromBar`、`src/App.tsx:863-867`。ボタン・入力・リンク上では発火しない）。この見出しには `tabIndex` も `onContextMenu` も無い（`12460-12465`）。
* この節のコンテキストメニューは存在しない（`{kind:"session"}` のメニューは `src/App.tsx:12958-12973` にあるが、開くのは `RecordsView` 側の行だけ、`src/RecordsView.tsx:367`）。

#### 4. 十字キーでの移動

* 専用処理は無い（`src/keyboardNavigation.ts` 全 224 行に `todayActivity` は出現しない）。
* この節でフォーカス可能なのは見出しの `button.disclosure` 1 個だけ（行の `div` に `tabIndex` が無く、ボタンも無いため）。したがって ↑↓ では「開閉ボタン」だけを経由し、`available()` の対象に本文の行は入らない（`src/keyboardNavigation.ts:1-11`）。
* ←→ はグループ外なので、←はサイドバー先頭へ、→は何もしない（`src/keyboardNavigation.ts:213-219`）。
* `Shift+F10` / `ContextMenu` キーのハンドラはこの節に無い。

#### 5. ドラッグでの並べ替えの仕組み

* 無し。この節には `onPointerDown` / `onPointerMove` / `onPointerUp` / `onPointerCancel`、`draggable`、`onDragStart`、`onDrop` がいずれも付いていない（`src/App.tsx:12459-12518`）。並べ替え・ドロップの対象にもなっていない（`pointWithinSelector` で参照されるのは `.inboxBand` / `.todayGrid` / `.projectsBand` のみ、`src/App.tsx:5906-5907`, `5996-5998`, `6089`, `6165-6169`）。

### E-その他

#### 1. 行の範囲・一番外の要素

| 対象 | 行の範囲 | クラス | `aria-label` |
|---|---|---|---|
| 3 節を包むスクロール領域 | `src/App.tsx:10572-10578` | `mainScrollArea app-scrollbar`（`id="main-content"`）／内側 `mainScrollContent`（`data-main-display-size`） | なし |
| 次の一手のカード | `src/App.tsx:11693-11741` | `nextStepRow sourceListRow nextStepCard` ＋ `nextStepRow--dragging` / `nextStepCard--dropTarget`、`data-project-id`、`data-project-color`、`tabIndex={0}` | なし（`aria-label` は中の `…` のみ） |
| やりたいことのグループ | `src/App.tsx:12089-12112` | `wishlistGroup` ＋ `wishlistGroup--unassigned` / `wishlistGroup--dragging`、`data-wishlist-group`、`data-project-color` | なし |
| やりたいことの行 | `src/App.tsx:12195-12238` | `inboxRow sourceListRow` ＋ `inboxRow--dragging`、`data-inbox-index`、`data-inbox-id`、`tabIndex={0}` | なし |
| ロックバッジ（次の一手） | `src/App.tsx:11766-11775` | `sourceLockBadge`、`tabIndex={0}` | `今日の3件で使用中のためロック中` |
| ロックバッジ（やりたいこと） | `src/App.tsx:12240-12249` | `sourceLockBadge sourceLockBadge--wishlist`、`tabIndex={0}` | `今日の3件で使用中のためロック中` |
| 並べ替えアナウンス | `src/App.tsx:12525-12527` | `reorderAnnouncement`（`aria-live="polite"`、`role="status"`） | — |

#### 2. 出す条件と空のときの文

| 要素 | 条件 | 内容 |
|---|---|---|
| ドロップ帯（やりたいこと → 次の一手） | `inboxPointerDrag?.nextStepEligible`（`src/App.tsx:11643`） | `↓` ＋ `ここにドロップして次の一手を設定する`（`11651-11652`）。`sourceReturnDropZone--active` は対象プロジェクトが決まったとき（`11646-11648`） |
| ドロップ帯（次の一手 → やりたいこと） | `projectPointerDrag?.wishlistEligible`（`src/App.tsx:12043`） | `↓` ＋ `ここにドロップしてやりたいことへ戻す`（`12051-12052`） |
| 挿入線（次の一手） | `projectPointerDrag?.targetIndicator`（`11913`） | `div.projectDropIndicator`（`aria-hidden="true"`） |
| 挿入線（やりたいこと・行） | `inboxPointerDrag?.targetIndicator`（`12384`） | `div.inboxDropIndicator` |
| 挿入線（やりたいこと・グループ） | `wishlistGroupPointerDrag?.targetIndicator`（`12398`） | `div.wishlistGroupDropIndicator` |
| ゴースト（次の一手） | `projectPointerDrag`（`11927`） | `div.projectDragGhost`（`aria-hidden="true"`、幅 `Math.min(300, width)`）。今日の3件狙いのときは `projectDragGhost--today`（`11930-11933`）。中身は `ProjectIdentity` ＋ `{project.nextStep?.text || "次の一手を書く"}`（`11945-11954`） |
| ゴースト（やりたいこと・グループ） | `wishlistGroupPointerDrag`（`12405`） | `div.wishlistGroupDragGhost`（`aria-hidden="true"`、幅 `Math.min(320, width)`、中身はグループ名） |
| ゴースト（やりたいこと・行） | `inboxPointerDrag`（`12420`） | `div.inboxDragGhost`（`aria-hidden="true"`、幅 `Math.min(300, width)`）。`ProjectIdentity` または `プロジェクトなし` ＋ 本文（`12439-12452`） |
| 今日の3件のドロップ挿入線 | `projectPointerDrag?.todayTargetIndicator` / `inboxPointerDrag?.todayTargetIndicator`（`11920`, `12391`） | `div.todayDropIndicator` |

#### 3. 中のボタン・メニューの一覧（この 3 節に共通する操作）

| 操作 | 起点 | 関数 | 根拠 |
|---|---|---|---|
| 節の開閉（3 節共通の作法） | 見出しバー全体のクリック（ボタン・入力・リンク上を除く）と `button.disclosure` | `toggleDisclosureFromBar` / `setXOpen` | `src/App.tsx:863-867`, `11578-11580`, `11986-11988`, `12462-12464` |
| 節の右クリックメニュー | 次の一手＝`{kind:"projects"}`、やりたいこと＝`{kind:"inboxes"}`、今日の実行＝無し | `openContextMenu` | `src/App.tsx:11565-11574`, `11975-11984`, `12460-12465` |
| メニュー項目のキーボード操作 | `role="menu"` 内 | ↑↓ / Home / End で巡回、Escape で閉じ、閉じると opener にフォーカス戻し | `src/components/ContextMenu.tsx:93-106`, `119-138`, `34-40` |
| カード・行・グループ見出しのメニューキー | `Shift+F10` / `ContextMenu` | `openContextMenuFromKeyboard` | `src/App.tsx:2569-2581`, `11733-11735`, `11754-11756`, `11793-11795`, `12136-12143`, `12224-12230` |
| 次の一手へ昇格できないときの警告 | やりたいこと行を `.projectsBand` へドロップ | `showToast("warn", blockReason ?? "このやりたいことは次の一手へ移動できません")` | `src/App.tsx:6180-6186` |
| 今日の3件が埋まっているときの警告 | `addCandidateToToday` | `いま選べるのは3件までです。完了後に次の3件を選べます` | `src/App.tsx:8132-8135` |
| 既に今日の3件にあるとき | `addCandidateToToday` | `今日の3件に既にあります` | `src/App.tsx:8137-8142` |

#### 4. 十字キーでの移動（節をまたぐ部分）

| 項目 | 内容 | 根拠 |
|---|---|---|
| 登録 | `document.addEventListener("keydown", ...)` 1 本で `navigateAppArrow(event, shortcutCaptureActiveRef.current)` | `src/App.tsx:2269-2278` |
| 面の決定 | モーダル → `.expandedTimer` → サイドバー／トップバー／`.mainScrollArea` の順に判定 | `src/keyboardNavigation.ts:118-172` |
| ↑↓ の単位 | `.mainScrollArea` 全体の DOM 順（節をまたいで連続） | `src/keyboardNavigation.ts:221` |
| ←→ の単位 | `.todayGrid` / `.dialogActions` / `.todayPickerRow` の中だけ。この 3 節は対象外 | `src/keyboardNavigation.ts:213-219` |
| 端の扱い | 次が無ければ `focus()` が `false` を返し、`preventDefault` されない（＝ブラウザ既定のスクロールが残る） | `src/keyboardNavigation.ts:13-19` |
| 除外 | `role="menu"` 内、入力欄、`[aria-hidden="true"]`・`[inert]` 内、非表示要素 | `src/keyboardNavigation.ts:4-11`, `115-116` |
| スキップリンクの着地点 | `.doNowStartPrimary:not(:disabled)` → `[data-skip-target='main'] button` → `[data-skip-target='main']`。3 節より上（`doNowBand`）に着地する | `src/App.tsx:9699-9712` |

#### 5. ドラッグでの並べ替えの仕組み（節をまたぐ部分）

| 項目 | 内容 | 根拠 |
|---|---|---|
| 共通のしきい値 | `SIDEBAR_DRAG_THRESHOLD_PX = 6`（移動量がこれ未満なら「移動していない」＝クリック扱い） | `src/App.tsx:813`, `5901-5904`, `6054-6056`, `6244-6246` |
| 共通のポインタ捕捉 | `event.currentTarget.setPointerCapture(event.pointerId)` | `src/App.tsx:5880`, `6027`, `6226` |
| 自動スクロール | `.mainScrollArea` の上下端 ±`min(72px, 高さ20%)` でスクロール、速度は ±18px/frame に丸め | `src/App.tsx:5841-5860`, `5958`, `6123`, `6261` |
| キャンセル | `onPointerCancel` → `cancelProjectPointerDrag` / `cancelInboxPointerDrag` / `cancelWishlistGroupPointerDrag`。やりたいこと行は対象インデックスが見つからない場合もキャンセル | `src/App.tsx:6013-6018`, `6199-6204`, `6282-6286`, `6049-6053` |
| 再計算のたびに参照する状態 | `configRef.current`（最新 config） | `src/App.tsx:5876`, `5908`, `6047`, `6143` |
| 保存 | いずれも `persistConfig` 経由（`moveProject` `5412`、`moveInboxItem` `5435`、`moveWishlistGroup` `5452`） | — |
| 並べ替えの読み上げ | `announceReorder` → `setReorderAnnouncement("「${label}」を${position}番目へ移動しました")`。呼ぶのは `moveInboxItemByOffset` / `moveSidebarButtonByOffset` / `moveSidebarGroupByOffset` / `moveTodayItemByOffset` / `moveOverlayPageByOffset` のみ。ドラッグ確定（`moveProject` / `moveInboxItem` / `moveWishlistGroup`）は呼ばない | `src/App.tsx:5455-5457`, `5484`, `5506`, `5524`, `5547`, `5563` |

#### 6. その他の事実

* 3 節の DOM 順は `projectsBand` → `inboxBand` → `todayActivityBand` で、間に区切り要素は無い（`src/App.tsx:11961`, `12457`）。
* 次の一手カードの色は `data-project-color={resolveProjectColorId(project.id, project.colorId)}`（`src/App.tsx:11706-11709`）、やりたいことグループは所属プロジェクトがあるときだけ同じ属性（`src/App.tsx:12099-12103`）。
* `ProjectIdentity` の出力は `span.projectIdentity.projectIdentity--compact`（`data-project-color`、`title="プロジェクト: {name}"`、`span.projectIdentityDot` ＋ `span.projectIdentityName`）（`src/components/ProjectIdentity.tsx:18-27`）。
* 今日の実行の行は本文の `{session.startedAt}` をそのまま表示する（整形していない）。テストも `08:10` 等の文字列一致で確認している（`tests/visual/phase810-activity-axis.spec.ts:53-57`）。
* 今日の実行は「自動」バッジを持つが、記録の追加・編集・削除の UI はこの節には無い（`src/App.tsx:12459-12518`）。
* 3 節とも `data-skip-target` を持たない（`src/App.tsx:11557-12518` 内に出現しない）。
* 空状態の文言はテストでも固定されている: `プロジェクトを設定しましょう` / `取り組みたいことをまとめると、次の一手を決められます` / `やりたいことを設定しましょう` / `あとでやりたいことを登録して、今日やる候補にできます`（`tests/visual/phase84-section-empty-state-polish.spec.ts:69-87`, `140-161`）。
* 節の件数表示は `0件` 形式（`src/App.tsx:11603`, `12001`, `12477`、テスト `tests/visual/phase83-clean-start.spec.ts:77`）。

分からなかった点:
* `todayActivityEntries` の `startedAt` を生成するバックエンド（`src-tauri` 側）の整形規則は読んでいないため、「常に HH:MM か」は分からなかった（フロントは受け取った文字列をそのまま出すだけ、`src/App.tsx:12507`）。
* なぜ `moveProject` / `moveInboxItem` / `moveWishlistGroup` が `announceReorder` を呼ばないのか（意図）はコードからは分からなかった。
* `.wishlistNextStepAction` が `opacity: 0` のままフォーカス対象に残る設計意図は、コメント等が無く分からなかった。

## F. タイマーと終わり

前提: 実行中のタイマーは `ActiveTimer`（`src/App.tsx:293-311`）1 個だけで、`DashboardApp` の state `activeTimer`（`src/App.tsx:2214`）と `activeTimerRef`（`src/App.tsx:2218`）に持つ。**保存はされない**（`src-tauri/src/models.rs` と `src/types.ts` に実行中タイマーの項目は無く、`localStorage` にも書いていない。`src/App.tsx:249` / `952` / `1170` が `localStorage` の書き込み箇所すべて）。秒は `now` state を 1000ms ごとに進めて作る（`src/App.tsx:3258-3265`、`TIMER_TICK_MS = 1000` は `src/constants.ts:7`）。残り秒・経過秒は `timerMetrics`（`src/timerRuntime.ts:19-29`）で、休止していた時間（`pausedTotalMs` + 現在の休止分）を引く。1 分未満は記録しない（`SESSION_MINIMUM_MINUTES = 1`、`src/timerRuntime.ts:1`、`src/timerRuntime.ts:31-37`）。

---

### F-1. タイマーが動いている間のメイン画面

**1. メイン画面の部位ごとの変化**

| 部位 | タイマーが無いとき | 実行中（`countdown`） | 一時停止中 | 満了して確認待ち（`completionPrompt` あり） | 根拠 |
|---|---|---|---|---|---|
| サイドバーの `TimerPanel`（`variant="sidebar"`） | 見出し `Timer`、分数のプリセット（`aria-label="通常タイマーの分数"`、`-`/`+` は 5 分刻み）、`開始ボタンから計測できます` ではなく `timerPresetControls` | 時計 `mm:ss`、状態バッジ `実行中`、進み具合の棒、行動テキスト、`一時停止` / `終了` の 2 ボタン、`タイマーを大きく表示` ボタン | 時計が `--warn` 色（`.timerClock--paused`）、バッジ `一時停止`（`--warn` 色）、ボタンが `再開` / `終了` | 状態が `"complete"` になり、バッジ `完了確認中`（`--good` 色、`.timerStateBadge--complete`） | `src/App.tsx:10029-10133`、`src/components/TimerPanel.tsx:66-153`、`src/App.tsx:9463-9478`、`src/styles.css:3720-3745`、`src/styles.css:3065-3067` |
| 窓の上端の線 | 出ない | 出る（`--accent`、幅 = 経過 %、1s linear で伸びる） | 出る（`--warn` 色に変わり、`transition: none`） | 出たまま（100% で止まる。`activeTimer` が残っているため） | `src/App.tsx:9725-9741`、`src/styles.css:12830-12873` |
| 「今日の3件」の、いま計っている行 | 開始ボタン 3 種（`短時間タイマーN分で開始` / `通常タイマーN分で開始` / `時間を決めずに計測`） | `.todayRow--running`（枠が `--accent`）、行の中に `runningBadge--running` の `実行中`、ボタンが `一時停止` / `終了` に置き換わる。`measure` のときは経過時計（`.measureElapsedClock`）も出る。`今日の3件から外す` が `disabled` | バッジ `一時停止`（`--warn` 色）、ボタンが `再開` / `終了`、`measure` 以外の停止ボタン字は `一時停止` のまま | 変化なし（行の見た目は実行中と同じ） | `src/App.tsx:11059-11101`、`src/App.tsx:11179-11193`、`src/App.tsx:11283-11327`、`src/App.tsx:11229-11245`、`src/styles.css:8562-8564` |
| 「今やる一手」の帯 | `{N}分で始める` / `通常 {N}分` / `計測` の 3 ボタン | バッジ `実行中`（`measure` は `計測中`）、時計欄が `残り mm:ss`（`measure` は `計測中`）に変わり、ボタンが `一時停止` / `終了` に置き換わる（`measure` は経過時計も出る） | バッジ `一時停止` | 変化なし | `src/App.tsx:10795-10809`、`src/App.tsx:10814-10822`、`src/App.tsx:10845-10872` |
| 拡大タイマー（`.expandedTimerBackdrop`） | 出ない | メイン画面全体を覆う。`Timer` / 戻る / プロジェクト / 行動テキスト / `実行中` / 大きな時計 / 進み具合の棒 / `一時停止`・`終了` / `Escで戻る（タイマーは継続します）` | 状態が `一時停止中`、時計が `--muted` 色、ボタンが `再開` / `終了` | 状態が `時間になりました`、`--accent-strong` で大きく、操作ボタンが消え、Esc も効かなくなる | `src/App.tsx:15574-15599`、`src/components/ExpandedTimerOverlay.tsx:66-118`、`src/styles.css:2892-3055` |
| その他の節（勝利条件・プロジェクト・記録ビューなど） | — | 変化なし（タイマー由来のクラス・文字は付かない） | — | — | `src/App.tsx:10624-12523` の中にタイマー分岐は上記 2 つだけ |

補足（事実）:
- サイドバーの `TimerPanel` はサイドバー（`<aside className="sidebar">`、`src/App.tsx:9781`）の最後の子で、ボタン一覧の後ろに置かれる（`src/App.tsx:9985-10029`）。
- 実行中だけ出る拡大ボタンは `aria-label="タイマーを大きく表示"`（`src/components/TimerPanel.tsx:88-99`）、押すと `setExpandedTimerOpen(true)`（`src/App.tsx:10056`）。
- サイドバーの時計は実行中 `mm:ss`、停止中は `N分`（`src/App.tsx:10032-10038`。`formatClock` は `src/App.tsx:1153-1158`）。
- タイマーが無くなると拡大タイマーは自動で閉じる（`src/App.tsx:2657-2659`）。

**2. 拡大タイマーの仕組み（同じ窓の中の覆い。窓は大きくしない）**

| 項目 | 内容 | 根拠 |
|---|---|---|
| 実体 | メインウィンドウの中の `<div className="expandedTimerBackdrop">`。`position: fixed; inset: 0; z-index: 90; background: var(--surface-soft)` | `src/components/ExpandedTimerOverlay.tsx:67`、`src/styles.css:2892-2899` |
| 窓の大きさ | 変えていない。`setSize` を呼ぶのは手順書ウィンドウと辞書ウィンドウだけ | `src/instructionWindow.ts:162` / `198` / `360`、`src/dictionaryWindow.ts:101`（`src/App.tsx` には無し） |
| ダイアログ | `role="dialog"`、`aria-modal="true"`、`aria-label="拡大タイマー"`、`tabIndex` 無しの `<section>`。背景に `modalDragBand`（`data-tauri-drag-region`） | `src/components/ExpandedTimerOverlay.tsx:68-76` |
| 背景の無効化 | `.sidebar` と `.mainScrollArea` に `inert = true`（閉じると戻す）。窓のボタンのヘッダーは含めない | `src/App.tsx:2648-2655` |
| 初期フォーカス | 戻るボタンへ `focus({ preventScroll: true })` | `src/components/ExpandedTimerOverlay.tsx:30-32`、`79-89` |
| Esc | `complete` でなく、`.modalBackdrop` / `.launcherOverlayBackdrop` が無いときだけ閉じる（`keydown` を capture で拾う） | `src/components/ExpandedTimerOverlay.tsx:34-49` |
| Tab | ダイアログ内の `button:not(:disabled)` を循環 | `src/components/ExpandedTimerOverlay.tsx:51-64` |
| 閉じたあと | `setExpandedTimerOpen(false)` → `expandTimerButtonRef.current.focus()` | `src/App.tsx:15587-15590` |
| `終了` を押したとき | 先に拡大を閉じてから `finishActiveTimer(activeTimer)` | `src/App.tsx:15591-15594` |
| 表示中の画面消灯 | 拡大タイマー表示中だけ `setDisplayAwake(leaseId, true)` を 20 秒ごとに更新し、閉じるとき解除 | `src/App.tsx:2661-2688` |
| 自動で閉じる条件 | 表示中にメインウィンドウが非表示 or 最小化になったら 1 秒間隔の検査で閉じる | `src/App.tsx:2672-2679` |
| 開始と同時に開く | `startTimer(..., expandOnStart)` が `setExpandedTimerOpen(expandOnStart)`。`nextStep.expandTimerOnStart` が真の Today 行・一手から開始したとき | `src/App.tsx:7322`、`src/App.tsx:11354-11355`、`src/App.tsx:11395-11396`、`src/App.tsx:11436-11437`、`src/App.tsx:9569` |
| 開いたときメインが隠れていたら | `returnToMain()` を呼ぶ（メインを出す） | `src/App.tsx:7341-7348` |
| 十字キー | 拡大タイマーが開いていると、矢印キーは `.expandedTimer[role="dialog"]` 専用の分岐に入る | `src/keyboardNavigation.ts:118-129` |

**3. ミニタイマーの仕組み（別の窓。`tauri.conf.json` には無く、実行時に作る）**

| 項目 | 内容 | 根拠 |
|---|---|---|
| 種類 | 別の Tauri ウィンドウ（`new WebviewWindow(...)`）。同じ窓の大きさを変えるのではない | `src/App.tsx:3392-3410` |
| ラベル / URL | `label = "life-launcher-mini"`、`url = "/?view=mini"`、`title = "Life Launcher Timer"` | `src/App.tsx:814`、`src/App.tsx:3392-3394` |
| 大きさ | `288 x 136`（`MINI_WINDOW_WIDTH_PX` / `MINI_WINDOW_HEIGHT_PX`）。`minWidth`/`minHeight` も同じ、`resizable: false` | `src/App.tsx:820-821`、`src/App.tsx:3397-3401` |
| 窓の装飾 | `decorations: false`、`alwaysOnTop: true`、`skipTaskbar: true`、`focus: false`、`focusable: false`、`visible: false` で作る | `src/App.tsx:3402-3407` |
| 設定ファイル | `src-tauri/tauri.conf.json` の `app.windows` は `label: "main"` の 1 つだけ（`create: false`） | `src-tauri/tauri.conf.json:12-27` |
| Rust 側 | `src-tauri/src/lib.rs` にミニウィンドウを作る処理は無い（`mini` で出るのは `mini-shortcut-toggle` の emit だけ） | `src-tauri/src/lib.rs:212` |
| ルーティング | `App()` が `isMiniModeView()`（`view=mini`）のとき `<MiniModeApp />` を返す。同じ JS 束を別ウィンドウで開いている | `src/App.tsx:2057-2058`、`src/App.tsx:908-910`、`src/App.tsx:1933-2043` |
| 開く操作 | 上の段の `aria-label="ミニタイマーへ切り替え"` ボタン、または `mini` ホットキー（`mini-shortcut-toggle`） | `src/App.tsx:10494-10511`、`src/App.tsx:3573-3575` |
| 開く手順 | `settings.miniMode` が偽なら警告トーストで止まる → メイン取得 → `ensureMiniWindow(false)` → `show()` → スナップショット送信 → **メインを `hide()`** | `src/App.tsx:3430-3460` |
| 窓の再利用 | 既にあれば `getByLabel` で拾い、位置だけ安全な所へ直して `show()` | `src/App.tsx:3369-3388`、`src/App.tsx:3462-3466` |
| 位置の保存 | `localStorage` の `MINI_POSITION_STORAGE_KEY` と `settings.miniWindowPosition` の両方 | `src/App.tsx:819`、`src/App.tsx:952`、`src/App.tsx:3468-3484` |
| データの流れ | メイン → `mini-timer-snapshot` イベント（`MiniTimerSnapshot`、`src/App.tsx:794-805`）を `miniSnapshot` が変わるたび送る。ミニ → `mini-timer-command`（`pause` / `finish`）、`mini-return-requested`、`mini-ready` | `src/App.tsx:7549-7551`、`src/App.tsx:7514-7516`、`src/App.tsx:1958-1960`、`src/App.tsx:7517-7530` |
| ミニの見た目 | `<main className="miniShell">`（`background: #1c1a16`、`cursor: move`）。1 段目 `ミニタイマー` + `メイン画面に戻る` / `ミニ画面を閉じる` の 2 ボタン、その下に `TimerPanel variant="mini"` | `src/App.tsx:1981-2041`、`src/styles.css:2216-2243` |
| ミニの操作 | どこでもドラッグで移動（`miniWindow.startDragging()`。ボタン上は除く）、ボタン・入力欄以外のダブルクリックでメインへ戻る | `src/App.tsx:1962-1965`、`src/App.tsx:1971-1979`、`src/App.tsx:1982-1986` |
| ミニの状態表示 | `待機中` / `実行中` / `計測中` / `一時停止中` の 4 つだけ。`完了確認中` は無い（`state` は `active ? (paused ? "paused" : "running") : "waiting"`） | `src/App.tsx:2029-2038` |
| ミニの進み具合の棒 | `TimerPanel` の `.timerProgress`（グリッドの 3 行目、`3px`）。窓の上端の線はミニには出ない | `src/App.tsx:2028`、`src/styles.css:2731-2769`、`src/styles.css:12355-12416` |
| 閉じる | `hideMiniWindow()` は位置を保存して `hide()` するだけ（`close()` は作成失敗時のみ） | `src/App.tsx:3486`、`src/App.tsx:3415` |
| メインへ戻る | `returnToMain()` = `focusDashboardWindow()` + `hideMiniWindow()` | `src/App.tsx:3489-3492` |

**4. 窓の上端の進み具合の線（`windowTimerLine`）**

ヒントにあった `timer-line` / `--timer-progress` / `topTimerLine` はコードに存在しない（grep で 0 件）。実装名は次のとおり。

| 項目 | 内容 | 根拠 |
|---|---|---|
| 値の計算 | `mode === "countdown" && targetMinutes !== null` のときだけ、`percent = clamp(0..100, elapsedSeconds / (targetMinutes * 60) * 100)`。`measure` では `null` | `src/App.tsx:2752-2761`、`src/App.tsx:2765-2774` |
| 出す条件 | 「予定時間のあるタイマー（countdown）が実行中か一時停止中の間だけ」（コメント）。タイマーが無い／`measure` のときは描画ごと出ない | `src/App.tsx:2762-2764`、`src/App.tsx:9725` |
| 置き場所 | `main.appShell.appShell--dashboard` の最初の子（`.sidebar` より前） | `src/App.tsx:9715-9741` |
| 構造 | `.windowTimerLine` > `.windowTimerLineGroove`（溝）+ `.windowTimerLineFill`（幅 = `percent%`） | `src/App.tsx:9726-9739` |
| 見た目 | `position: fixed; top: 0; left: 0; right: 0; height: 3px; z-index: 150; pointer-events: none`。溝は `var(--accent)` を `opacity: 0.12`、塗りは `var(--accent)`、`transition: width 1s linear` | `src/styles.css:12833-12857` |
| 重なり順 | 窓のボタン（z-index 140）とダイアログの幕（`.modalBackdrop` は z-index 35、拡大タイマーの幕は 90）より手前 | `src/styles.css:12830-12832`、`src/styles.css:5892`、`src/styles.css:2897`、`src/styles.css:2901-2903` |
| 一時停止 | `.windowTimerLine--paused` で溝も塗りも `var(--warn)`、塗りは `transition: none`（その位置で止める） | `src/styles.css:12859-12867` |
| 開始・+15 分のとき | `key={`${instanceId}:${targetMinutes}`}` で塗りを作り直すので、前の幅から動かず今の値で出る | `src/App.tsx:9737`、`src/App.tsx:2772`、`src/App.tsx:2764` |
| 動きを減らす設定 | `@media (prefers-reduced-motion: reduce)` で `transition: none` | `src/styles.css:12869-12873` |
| ミニ画面 | 出ない（`MiniModeApp` は別の木で、`windowTimerLine` を描かない） | `src/App.tsx:1933-2043` |

---

### F-2. タイマーが終わったとき・途中で終えたとき

**1. 予定時間が来たとき（自然満了）に出る物、出る順**

| # | 何が起きるか | 画面 | 字・ラベル | ボタン | 根拠 |
|---|---|---|---|---|---|
| 1 | 残り 0 秒を 1 秒刻みの監視で見つけ、`completionPrompt` を立てる（同じタイマー・同じ分数では 1 回だけ） | メイン画面 | — | — | `src/App.tsx:7200-7232`（判定 `7211-7220`、設定 `7222-7228`） |
| 2 | メインウィンドウを出す・前面へ（`show` / `unminimize` / `set_focus`。ミニは隠さない） | OS のウィンドウ | — | — | `src/App.tsx:7229`、`src-tauri/src/startup.rs:84-96` |
| 3 | OS の通知（許可されている場合だけ）。本文は「`{label} が満了しました`」、題は `Life Launcher` | OS の通知 | `Life Launcher` / `{label} が満了しました` | — | `src/App.tsx:1919-1931`、`src/App.tsx:7230` |
| 4 | 満了ダイアログ。幕は `.modalBackdrop`（z-index 35。拡大タイマーの幕 90 の上に来るのは `.appShell:has(.expandedTimerBackdrop) > .modalBackdrop { z-index: 95 }`） | メイン画面の中央 | `Timer Complete`（eyebrow）、プロジェクト名、見出しは `timerActionText`（行動テキスト）、本文 `予定時間になりました` | `続ける(+15分)` / `終わる` | `src/App.tsx:15601-15640`、`src/styles.css:2901-2903` |
| 5 | サイドバーのバッジが `完了確認中` に変わる（`--good` 色） | サイドバー | `完了確認中` | （幕の下） | `src/App.tsx:9463-9464`、`src/App.tsx:10068-10076`、`src/styles.css:3742-3745` |
| 6 | 拡大タイマーが開いていれば「満了の姿」に変わる（操作ボタンが消え、Esc も効かない） | 拡大タイマー | `時間になりました`（大きく `--accent-strong`） | 無し | `src/App.tsx:15577`、`src/components/ExpandedTimerOverlay.tsx:94-96`、`105-113`、`34-49`、`src/styles.css:2991-3000` |

`続ける(+15分)` を押したとき（`src/App.tsx:7386-7408`）: ダイアログが閉じ、`targetMinutes` が +15 され、`continuedAfterCompletion = true` が立つ。タイマーは止まらず続く。窓の上端の線は `resetKey` が変わるので新しい割合から出る（`src/App.tsx:2772`）。もう一度満了すると、また同じ手順で満了ダイアログが出る（`targetMinutes` が変わっているので 1 回だけ、の判定は外れる。`src/App.tsx:7216-7218`）。

**2. 満了ダイアログで `終わる` を押したとき（`finishCompletedTimer`）に出る物、出る順**

| # | 何が起きるか | 画面 | 字・ラベル | ボタン | 根拠 |
|---|---|---|---|---|---|
| 1 | 記録を保存（1 分未満なら保存せず、警告トースト） | トースト | `{label} {minutes}分を記録しました`（成功）。1 分未満は `1分未満なので記録しませんでした`。失敗は `記録できません: {message}`、更新だけ失敗は `記録は保存しましたが、表示を更新できませんでした` | — | `src/App.tsx:7006-7046`（`7042` / `7012` / `7029` / `7040`） |
| 2 | タイマーが消える（サイドバーは待機中の姿へ、上端の線が消える、拡大タイマーが閉じる） | 全体 | — | — | `src/App.tsx:7096-7100`、`2657-2659` |
| 3 | そのタイマーが「今日の3件」の項目のものなら、その項目を完了にする（プロジェクトの次の一手は消え、`sourceCompletions` に 1 件足す） | データ | — | — | `src/App.tsx:7443-7451`、`src/completionFollowup.ts:72-120` |
| 4a | 3 件すべて完了なら、ごほうび。約 1 秒だけ出る | 「今日の3件」の下 | `✓ 今日の3件、完了！`（`role="status"`） | — | `src/App.tsx:7128-7131`、`src/App.tsx:11532-11537` |
| 4b | 3 件そろってはいないが 1 件完了なら、その行だけ光る。約 1 秒 | その行 | （行に `今日の分は完了` が出る） | — | `src/App.tsx:7132-7139`、`src/App.tsx:11095-11098`、`src/App.tsx:11281-11282`、`src/styles.css:11330-11338` |
| 4c | ごほうびの粒（6 個）が出る（`victory` か `todayAll` のときだけ。z-index 39） | 画面全体 | — | — | `src/App.tsx:12529-12535`、`src/styles.css:11361-11379` |
| 5 | 「今やる一手」が完了ホールドの姿になる（一手から始めたとき、または 3 件の項目に当たらなかったとき） | 「今やる一手」の帯 | `✓ 一手進みました`（`role="status"`）、タスク文、`実行 {N}分` | `次の一手を見る` | `src/App.tsx:7117-7123`、`src/App.tsx:10724-10755` |
| 6 | その一手のプロジェクトが「今やる一手」の候補から外され、次の候補に切り替わる | 「今やる一手」の帯 | — | — | `src/App.tsx:7124-7127` |
| 7 | 約 1.1 秒後に「次の一手を決めますか？」ダイアログ（条件は下の表） | メイン画面の中央 | `Next Step`（eyebrow）、`次の一手を決めますか？`、`{projectName}のやりたいこと`、やることの候補（そのプロジェクトのやりたいこと）、`新しく入力する` | 候補ボタン / `新しく入力する` / `今は決めない` | `src/App.tsx:6950-7004`（遅延 `7003`）、`src/App.tsx:14819-14882` |

ごほうび（4a / 4b / 4c）の出し方（`src/App.tsx:2406-2417`）: `document.hidden` が真なら出さない。同じ `key` は 1 回だけ（`seenCompletionFeedbackRef`）。出してから 1000ms で消す（`completionFeedbackTimerRef`）。`key` は `timer:{today.date}:{instanceId}`（`src/App.tsx:7116`）。

**3. 「次の一手」を決める流れが今あるか → ある。3 つの入口**

| 入口 | 出る条件 | 中身 | 根拠 |
|---|---|---|---|
| 「次の一手を決めますか？」ダイアログ | 完了した項目の出どころが `nextStep` で、その `generationId` が今のスナップショットと一致し、そのプロジェクトの「やりたいこと」が 1 件以上あるとき（満たさなければ出ない） | そのプロジェクトの「やりたいこと」を選ぶ → `promoteInboxToNextStep`（プロジェクト付きなら次の一手エディタを `mode: "promote"` で開く）／`新しく入力する` → `openNextStepEditor(project, { mode: "set" })`／`今は決めない` → 閉じる | `src/App.tsx:6955-6962`、`src/App.tsx:14834-14879`、`src/App.tsx:8446-8475` |
| 「✓ 一手進みました」→ `次の一手を見る` | 「今やる一手」の一手から始めて終えたとき、または 3 件の項目に当たらなかったとき | `acknowledgeDoNowCompletion()` が `refreshDoNow()` して、終えたプロジェクトを除外し、帯を次の候補に切り替える。候補が尽きたら「今は他に提案できる一手がありません。」 | `src/App.tsx:9577-9587`、`src/App.tsx:9578-9581`、`src/App.tsx:10943-10948` |
| 「やりたいこと」の後始末（確認ダイアログ） | 完了した項目の出どころが `wishlist` のとき（1.1 秒後に出る） | 題 `この「やりたいこと」はどうしますか？`、件名 `「{text}」`、本文 `完了にすると、やりたいことから外します。今日の3件と実行記録は残ります。`、ボタン `完了にする` / `まだやりたい`（初期フォーカスは `まだやりたい`） | `src/App.tsx:6979-7001`、`src/components/ConfirmDialog.tsx:42-44`、`src/components/ConfirmDialog.tsx:65-72` |

**4. 途中で終えたとき（`終了` / `停止` ボタン、ミニの `終了`）に出る物、出る順**

入口は `finishActiveTimer`（`src/App.tsx:7479-7484`）。`continuedAfterCompletion` かつ `doNowSnapshot` があるときだけ `finishCompletedTimer` へ、それ以外は `finishTimer(timer)`（理由 `"manual"`）へ。ミニからの `finish` も同じ関数を呼ぶ（`src/App.tsx:7522-7524`）。

| # | 条件 | 出る物 | 画面 | 字・ラベル | ボタン | 根拠 |
|---|---|---|---|---|---|---|
| 1 | `countdown` で残り 0 以下 | 何も記録せず、満了ダイアログへ切り替える | 中央 | 上の F-2-1 と同じ | 同じ | `src/App.tsx:7061-7076` |
| 2 | 「今日の3件」の未完了項目のタイマーで、経過が `min(5, 短時間の分数) * 60` 秒以上 | 早め完了の確認ダイアログ。タイマーはその場で凍る（休止扱い） | 中央 | 題 `今日の分は完了にしますか？`、本文 `ここまでの実行は記録されます。` | `今日の分は完了` / `未完了のまま終了`、右上の × は `確認を閉じる`。`tone="positive"`、初期フォーカスは `未完了のまま終了` | `src/App.tsx:7077-7092`、`src/App.tsx:15962-15977`、`src/earlyCompletion.ts:4-36`、`src/components/ConfirmDialog.tsx:150-217` |
| 3 | 2 で `今日の分は完了` | 記録 → その項目を完了 → 4a/4b/4c のごほうび → 「次の一手」の流れ（F-2-3 と同じ）。タイマーが消える | — | — | — | `src/App.tsx:7159-7193`、`src/App.tsx:7174-7185` |
| 4 | 2 で `未完了のまま終了`（× で閉じたときも同じ） | 記録だけしてタイマーが消える。完了にもごほうびにもならない | — | — | — | `src/App.tsx:7154-7157`、`src/App.tsx:7189-7193`、`src/App.tsx:15973-15975` |
| 5 | 上のどれでもない（3 件に当たらない／5 分未満） | 記録してトースト。タイマーが消える。ごほうび・ダイアログは出ない | トースト | `{label} {minutes}分を記録しました`（1 分未満は `1分未満なので記録しませんでした`） | — | `src/App.tsx:7093-7104`、`src/App.tsx:7042` |

補足（事実）:
- `終了` はサイドバー・拡大タイマー・Today 行・「今やる一手」・ミニの 5 か所にある（`src/components/TimerPanel.tsx:143-149`、`src/components/ExpandedTimerOverlay.tsx:110-112`、`src/App.tsx:11319-11326`、`src/App.tsx:10865-10871`、`src/App.tsx:2025`）。
- `measure`（時間を決めずに計測）は満了が無いので、`countdown` の満了ダイアログは出ない（`src/App.tsx:7203` で `mode !== "countdown"` を弾く）。終わりは手動だけ。
- 早め完了の確認は「その項目の `shortTimerMinutes`」で秒数を決める（`src/earlyCompletion.ts:4-10`、`src/earlyCompletion.ts:33`）。`1..240` の整数以外は 5 分として扱い、上限 5 分（`src/earlyCompletion.ts:5-9`）。

---

### F-3. タイマーの分数（短時間・通常）はどこで決まるか

**1. 値の持ち場は 3 段（設定 → プロジェクトの次の一手 → 今日の3件の項目）**

| 段 | 項目名 | 型・既定 | 根拠 |
|---|---|---|---|
| 全体設定 | `settings.defaultTimerMinutes`（通常） | 必須、1〜240 の整数。Rust の既定は `25` | `src/types.ts:194`、`src-tauri/src/models.rs:8`、`src-tauri/src/models.rs:362-365` |
| 全体設定 | `settings.shortTimerMinutes`（短時間） | 任意、既定 `5`、1〜240 の整数。Rust の既定は `5` | `src/types.ts:195`、`src-tauri/src/models.rs:9`、`src-tauri/src/models.rs:764-770` |
| プロジェクトの次の一手 | `nextStep.defaultTimerMinutes` / `nextStep.shortTimerMinutes` | 任意、1〜240 の整数 | `src/types.ts:104-112`、`src-tauri/src/models.rs:105-131` |
| 今日の3件の項目 | `today.items[].defaultTimerMinutes` / `shortTimerMinutes` | 任意、1〜240 の整数 | `src/types.ts:142-155`、`src-tauri/src/models.rs:290-305` |

**2. 画面から変える場所**

| UI | 何を変えるか | 字・ラベル | 根拠 |
|---|---|---|---|
| 設定 → 「基本」 | 全体設定の 2 つ | `短時間タイマー分数`、`通常タイマー分数`（`min=1` / `max=240` の数値入力。上下ドラッグ可、`title="上下にドラッグして分数を調整"`） | `src/App.tsx:13614-13687` |
| サイドバーの `TimerPanel`（停止中） | 全体設定の通常分数 | `aria-label="通常タイマーの分数"` の数値入力 + `分` + `-` / `+`（±5 分）。フォーカスを外すと保存 | `src/App.tsx:10079-10131`、`src/App.tsx:3675-3692` |
| 次の一手エディタの `タイマー` 節 | そのプロジェクトの次の一手の 2 つ | `短時間` / `通常` の行。`aria-label="{短時間|通常}タイマー分数"`、`{label}タイマーを1分減らす` / `…増やす`、`{N}分を使用`、`全体設定 {N}分を使用`、`全体設定に戻す` | `src/App.tsx:15281-15375`、`src/App.tsx:5815-5827` |
| 保存時の丸め | 設定 | `normalizeTimerMinutes` = 1〜240 に丸める（四捨五入） | `src/App.tsx:1351-1353`、`src/App.tsx:4634-4639` |

**3. 実際に使う分数の決まり方（優先順）**

| 開始する場所 | 使う分数 | 根拠 |
|---|---|---|
| 「今日の3件」の `短時間タイマーN分で開始` | `item.shortTimerMinutes ?? project.nextStep.shortTimerMinutes ?? settings.shortTimerMinutes`。ただし「ひも付いた出どころがあり、かつ次の一手に値が無い」ときは `settings.shortTimerMinutes`（項目側の値を無視する） | `src/App.tsx:11076-11081`、`src/App.tsx:11348` |
| 「今日の3件」の `通常タイマーN分で開始` | `item.defaultTimerMinutes ?? project.nextStep.defaultTimerMinutes ?? settings.defaultTimerMinutes`。同じ例外あり | `src/App.tsx:11082-11087`、`src/App.tsx:11389` |
| 「今日の3件」の `時間を決めずに計測` | 分数なし（`targetMinutes = null`、`mode = "measure"`） | `src/App.tsx:11417-11438`、`src/App.tsx:7281-7282` |
| 「今やる一手」の `{N}分で始める` / `通常 {N}分` | `project.nextStep.shortTimerMinutes ?? settings.shortTimerMinutes` / `project.nextStep.defaultTimerMinutes ?? settings.defaultTimerMinutes`（項目側の値は見ない） | `src/App.tsx:9521-9526`、`src/App.tsx:9546-9570` |
| `startTimer` に分数が渡らなかったとき | `settings.defaultTimerMinutes` | `src/App.tsx:7281-7282` |
| 手動で記録するダイアログの初期値 | `settings.defaultTimerMinutes` | `src/App.tsx:9029-9037` |

**4. 「項目ごとに変えられるか」**

| 問い | 事実 | 根拠 |
|---|---|---|
| today の各項目は分数を持てるか | 持てる（`today.items[].defaultTimerMinutes` / `shortTimerMinutes`） | `src/types.ts:142-155` |
| その値を画面から直接いじれるか | **見つからなかった**。今日の3件の行に分数の入力・増減ボタンは無く、`shortMinutes` / `defaultMinutes` は計算して表示に使うだけ | `src/App.tsx:11076-11087`、`src/App.tsx:11328-11445` |
| ではいつ書かれるか | 今日の3件に選んだとき、候補の値（＝そのプロジェクトの次の一手か全体設定）をそのまま写す。出どころを編集したときも同じ式で書き直す | `src/App.tsx:8149-8166`、`src/App.tsx:8189-8206`、`src/todayCandidates.ts:52-53`、`src/todayCandidates.ts:80-81`、`src/sourceEdit.ts:101-104` |
| プロジェクトごとの上書き | できる（次の一手エディタの `タイマー` 節） | `src/App.tsx:15281-15375`、`src/App.tsx:8731-8739`、`src/App.tsx:8749-8750` |
| 実行中に分数を変えられるか | 変えられない。`計測` 以外で伸ばせるのは満了ダイアログの `続ける(+15分)` だけ（+15 固定）。サイドバーの時計ドラッグは `clockAdjustable={!activeTimer}` で停止中だけ | `src/App.tsx:10039`、`src/App.tsx:7386-7408`、`src/components/ExpandedTimerOverlay.tsx:4-14`（分数の props は無い） |
| 範囲 | どこも 1〜240 分。`parseNextStepTimer` の検証、入力の `min` / `max`、`normalizeTimerMinutes` の 3 か所で同じ範囲 | `src/types.ts:107-108`、`src/App.tsx:15330-15334`、`src/App.tsx:13638-13639`、`src/App.tsx:1351-1353`、`src/App.tsx:8733-8739` |

---

### 分からなかった所（F）

- メインウィンドウを `hide()` している間（ミニ表示中）に、WebView の `document.hidden` が真になるか。コードは「真ならごほうびを出さない」としか書いていない（`src/App.tsx:2407`）。実行して確かめていない。
- ミニ表示中に満了・早め完了が起きたとき、`focusDashboardWindow()` でメインが出る（`src-tauri/src/startup.rs:90-96`）が、ミニを隠す処理はその経路に無い（`hideMiniWindow` は `returnToMain` からだけ。`src/App.tsx:3489-3492`）。実際に 2 つの窓が同時に出るかは実行して確かめていない。
- OS の通知が実際に表示されるか（`Notification.permission` と OS 側の設定しだい。コードは許可要求と送信だけ。`src/App.tsx:1919-1931`）。
- 早め完了の確認ダイアログで右上の × を押した場合の扱いは、`onCancel` → `resolveEarlyStop(false)` を読む限り「未完了のまま終了」と同じ（`src/components/ConfirmDialog.tsx:164-173`、`src/App.tsx:15973-15975`）。ただし実際の見え方は確認していない。
- ヒントの `timer-line` / `--timer-progress` / `topTimerLine` に対応する名前はコードに無かった（grep 0 件）。実装は `windowTimerLine` / `windowTimerLineGroove` / `windowTimerLineFill`（`src/App.tsx:2765-2774`、`src/styles.css:12833-12873`）。

## G. 今日の3件を選ぶ・次の一手を編集する

### G-1. 今日の3件を選ぶ画面（`src/todayCandidates.ts`・picker の部品）の形と候補の出し方

#### 実装の置き場所（事実）

| 項目 | 事実 | 行 |
|---|---|---|
| 今日の3件の選択画面 | 専用ファイルは無く `src/App.tsx` 内にインラインで実装 | `src/App.tsx:13147-13375` |
| 状態 | `todayPickerOpen` / `todayPickerSource` / `todayPickerDraftItems` / `todayPickerSaving` / `todayPickerWishlistCollapsed` | `src/App.tsx:2179-2185` |
| ref | `todayPickerOpenerRef` / `todayPickerInitialItemsRef` | `src/App.tsx:2338-2339` |
| `src/StartEnvironmentPicker.tsx` | 開始環境（`buttonIds`）用。今日の3件の選択画面では使われていない。import は `src/App.tsx:130-131`、使用は 手順書/開始環境の欄（`src/App.tsx:13093`, `src/App.tsx:15237`） | — |
| `src/InstructionPicker.tsx` | 手順書（`instructionPath`）用。使用は `src/App.tsx:13100`, `src/App.tsx:15248` | — |
| `src/components/InstructionTree.tsx` | 手順書ビューア内で使用（`src/components/InstructionViewer.tsx:892`）。今日の3件の選択には関与しない | — |
| `src/components/GroupModeField.tsx` | ボタンのグループ指定用（`src/App.tsx:14451`(ボタン編集), `src/App.tsx:15720`(ボタン追加)）。今日の3件・次の一手には関与しない | — |
| 上限値 | `TODAY_ITEM_LIMIT = 3` | `src/constants.ts:1` |

#### 候補の出し方（`src/todayCandidates.ts`）

- 型 `TodayCandidate` の項目：`key` / `text` / `source`（`"次の一手"` または `"やりたいこと"`）/ `sourceKey` / `sourceGenerationId?` / `legacyOrderKeys?` / `sourceAliases?` / `trigger?` / `projectId?` / `buttonIds?` / `expandTimerOnStart?` / `instructionPath?` / `instructionOpenOnStart?` / `defaultTimerMinutes` / `shortTimerMinutes` — `src/todayCandidates.ts:3-19`
- `buildTodayCandidates(config)` は「プロジェクトの `nextStep.text` が空でないもの（`config.projects` の順）」→「`config.inbox` の `text` が空でないもの（配列順）」の順に並べる — `src/todayCandidates.ts:85-114`

| 候補の種類 | 生成関数 | `sourceKey` | 行 |
|---|---|---|---|
| 次の一手 | `projectTodayCandidate` | `project:<project.id>` | `src/todayCandidates.ts:29-55`（key は 36、sourceKey は 39） |
| やりたいこと（stable ID あり） | `wishlistTodayCandidate` | `wishlist:<item.id>` | `src/todayCandidates.ts:21-23, 66-69` |
| やりたいこと（ID 無し） | 同上 | `wishlist:legacy-<index+1>` | `src/todayCandidates.ts:22` |
| 旧形式の別名 | `legacyWishlistSourceKey` | `wishlist:<projectId または none>:<text>`、`sourceAliases` にだけ入る（同じ text の最初の1件のみ） | `src/todayCandidates.ts:25-27, 70-71, 87-94, 108` |

- 値の引き継ぎ元：`trigger` / `buttonIds` / `expandTimerOnStart` / `instructionPath` / `instructionOpenOnStart` は `project.nextStep` または `inbox[]` から、分数は `nextStep` → `settings` の順でフォールバック — `src/todayCandidates.ts:43-53, 72-81`
- 逆引き `todayCandidateFromConfig(config, sourceKey)` は `sourceKey` と `sourceAliases` を照合 — `src/todayCandidates.ts:116-124`。ドラッグ＆ドロップからの追加で使用（`src/App.tsx:5910`, `5974`, `6065`, `6143`）。
- 今日の項目の同一性判定は `todaySourceKey(item, index) = item.sourceKey ?? `legacy:<index>:<projectId>:<text>`` — `src/App.tsx:851-853`

#### 画面を開く入口

| 入口 | 文言・条件 | 行 |
|---|---|---|
| 0件のときの空状態 | `今日やるものを選びましょう` / `次の一手・やりたいことから選べます` / ボタン `今日やるものを選ぶ` | `src/App.tsx:11043-11058` |
| 1〜2件のときの追加スロット | ボタン `今日やるものを選ぶ`（`todayPickerEntry`） | `src/App.tsx:11452-11465` |
| 3件すべて完了後 | `次の3件を選ぶ` → `startNextTodayBatch()` が `today.items` を空にする | `src/App.tsx:11539-11551` / `src/App.tsx:9040-9048` |
| 開く関数 | `openTodayPicker(opener)`：既に3件なら何もせず return、下書きは `config.today.items` のコピー、追加元タブは `nextStep` にリセット、折りたたみ状態をリセット | `src/App.tsx:3983-3995`（3件ガードは 3984） |

#### 画面の構成（`src/App.tsx:13147-13375`）

| 領域 | 内容（画面の文字・クラス・属性） | 行 |
|---|---|---|
| ダイアログ全体 | `aria-label="今日やるものを選ぶ"` / `role="dialog"` / `className="dropDialog todayPickerDialog"` | `13150-13156` |
| ヘッダー | `eyebrow` = `Today`、`h2` = `今日やるものを選ぶ`、`p.todayPickerIntro` = `上の「今日の3件」に、下の候補から追加します。`、閉じるボタン `aria-label="今日やるものを選ぶを閉じる"` に `autoFocus` | `13157-13174` |
| 追加先（上段） | `data-today-picker-section="selected"`、見出し `追加先：今日の3件`、進捗バー `role="progressbar"` `aria-label="今日の3件の選択状況 {n}/3"`、`aria-label="今日の3件 {n}件"` の `{n} / 3` と `あと{n}件`、説明 `今日やると決めたもの。最大3件まで。` | `13176-13203` |
| 3つのスロット | `Array.from({length: TODAY_ITEM_LIMIT})` で 3 枠。空きは `空き {index+1}`、選択済みは `renderTodayPickerSelectedItem` | `13204-13215` |
| 追加元タブ（下段） | `aria-label="追加元を選ぶ"` `role="tablist"`、見出し `追加元` / `どこから選びますか？`、タブは `次の一手 {n}件`（副題 `各プロジェクトの「迷ったら戻る一手」`）と `やりたいこと {n}件`（副題 `その他の候補・あとでやりたいこと`） | `13218-13254` |
| 次の一手パネル | `data-today-picker-section="next-step"`、`role="tabpanel"`、見出し `次の一手` / `今日やるなら「＋ 今日へ」`、0件なら `追加できる次の一手はありません` | `13256-13277` |
| やりたいことパネル | `data-today-picker-section="wishlist"`、見出し `やりたいこと` / `プロジェクトごとに表示`、0件なら `追加できるやりたいことはありません`、プロジェクト見出しは折りたたみ（`aria-expanded`、`{n}件`、プロジェクト無しは `未分類`） | `13278-13347` |
| フッター | 左の説明は タブが `wishlist` のとき `プロジェクト見出しで開閉できます。`、それ以外は `選ぶと上の今日の3件へ追加されます。`、`決定`（`todayPickerConfirmButton`）、`キャンセル`（`dangerButton todayPickerCancelButton`） | `13350-13372` |

- レイアウト（CSS）：`.todayPickerDialog` は `width: min(720px, 100%)` / `height: min(720px, calc(100vh - 24px))` / 4行グリッド — `src/styles.css:9025-9035`。スロットは3列 `repeat(3, minmax(0, 1fr))` — `src/styles.css:9147-9153`。候補行は `minmax(130px,170px) minmax(0,1fr) 96px` の3列 — `src/styles.css:9350-9358`。候補パネルは縦スクロール — `src/styles.css:9319-9325`。

#### 候補リストの作り方（描画側）

| 処理 | 事実 | 行 |
|---|---|---|
| 候補の元 | `rawTodayBuilderCandidates = buildTodayCandidates(config)` | `src/App.tsx:9324` |
| 既に今日に入っているか | `todayCandidateSelected`：`sourceKey` と `sourceAliases` を `config.today.items` と照合 | `src/App.tsx:9325-9330` |
| 下書き内で選択済みか | `todayPickerCandidateSelected`：下書き `todayPickerDraftItems` と照合 | `src/App.tsx:9331-9336` |
| 次の一手タブの候補 | `source === "次の一手"` かつ未選択 | `src/App.tsx:9337-9339` |
| やりたいことタブの候補 | `source === "やりたいこと"` かつ未選択 | `src/App.tsx:9340-9342` |
| プロジェクト別グループ | `wishlistGroups`（= `groupWishlistForDisplay`）に候補を突き合わせ、候補0件のグループは落とす | `src/App.tsx:9346-9356` / 順序は プロジェクト順→`未分類` が最後 `src/nextStepWishlist.ts:48-54` |
| 候補行の描画 | `＋ 今日へ`（`todayPickerAddButton`）、3件埋まると `disabled` で `title="今日の3件は3件埋まっています"`、グループ内表示時はプロジェクト名を出さない | `src/App.tsx:9409-9447`（`＋ 今日へ` は 9443、disabled は 9434-9440） |
| 選択済み行の描画 | `✓ 選択済み`、`今日から外す`（`aria-label="今日から外す"`、タイマー実行中は `disabled` で `title="タイマーを停止してから外してください"`） | `src/App.tsx:9365-9408` |

#### 操作と保存の挙動

| 操作 | 事実 | 行 |
|---|---|---|
| `＋ 今日へ` | `chooseTodayCandidate`：候補から `TodayItem` を作り **その場で `persistConfig`**、3件に達したら自動で閉じてトースト `今日の3件を選択しました` | `src/App.tsx:8232-8259`（作成 8189-8206、自動クローズ 8254-8258） |
| `今日から外す` | `removeTodayPickerDraftItem`：これも **その場で `persistConfig`**、その項目でタイマーが動いていれば `タイマーを停止してから外してください` | `src/App.tsx:8261-8286` |
| `決定` | `saveTodayPickerDraft`：現在値と同一なら閉じるだけ、差分があれば保存して `今日の3件を選択しました` | `src/App.tsx:8208-8230` |
| `キャンセル` / 閉じる | `requestCloseTodayPicker`：下書きが初期値と違えば破棄確認（`入力内容を破棄して閉じますか？`）、破棄時は `todayPickerInitialItemsRef` の内容で `persistConfig` してから閉じる | `src/App.tsx:3949-3981` |
| フォーカス復帰 | `closeTodayPicker` が開いた要素へ `focus()` を戻す | `src/App.tsx:3938-3947` |
| タブのキーボード | `ArrowLeft` / `ArrowRight` / `Home` / `End`、`data-today-picker-tab` でフォーカス移動 | `src/App.tsx:3997-4015` |
| Escape | `closeOnEscape` → `dismissNonCriticalModal` → `requestCloseTodayPicker` | `src/App.tsx:4120-4135` / `4017-4021` |

#### 事実として確認できた注意点

- 追加・削除のたびに即保存されるため、`キャンセル` は「元に戻す保存」を行う（`src/App.tsx:8232-8286`, `3949-3971`）。テストも「confirmed cancel で `today.items` が 0 に戻る」ことを確認している（`tests/visual/phase84-today-picker.spec.ts:202-230`）。
- `config.today.candidateExcludedSourceKeys` は定義（`src/types.ts:221`）と削除時のフィルタ（`src/projectDeletion.ts:148`, `src/App.tsx:7982`）だけに現れ、`src/todayCandidates.ts` と picker の候補絞り込みでは参照されていない（grep 一致は3件のみ）。
- 「今日の3件」の候補に `sourceCompletions` を掛ける処理は `src/todayCandidates.ts` には無い（`buildTodayCandidates` は `projects` と `inbox` のみ参照: `src/todayCandidates.ts:85-114`）。

---

### G-2. 次の一手・やりたいこと・プロジェクトを足す／直す画面の欄の一覧

`config.json` のキー名は `src/types.ts` の Zod（camelCase）と一致し、Rust 側も `#[serde(rename_all = "camelCase")]`（`src-tauri/src/models.rs:19, 40, 106, 165, 247, 282, 322, 352`）。

#### (1) 次の一手（`project.nextStep`）を設定・編集するダイアログ — `src/App.tsx:14884-15427`

タイトルは状況で変わる：`次の一手を編集` / `次の一手を入れ替える` / `次の一手を設定`（`14925-14929`）。`eyebrow` は `Next Step`、説明 `今進める1件と、始めるための環境を設定します。`（`14951-14953`）。

| 欄の名前（画面の文字） | `config.json` の値 | 入力の形・制約 | 行 |
|---|---|---|---|
| `プロジェクト` | `projects[].id`（選択結果） | `select`（`projectLocked` のときは固定表示 `このプロジェクトに設定します`） | `14967-14994` |
| `次の一手の決め方` タブ `＋ やりたいことから選ぶ` / `＋ 新しく入力` | （UI のみ。`decisionMode`） | `role="tablist"` / `tab` | `14996-15032` |
| `次の一手にするやりたいこと`（`やりたいこと {n}件`） | `inbox[].id` から選択（保存で `nextStep.sourceWishlistId` の元） | `role="radiogroup"` / `radio`、`aria-checked` | `15034-15088` |
| `選択済み`（選んだやりたいこと） | 同上 | 表示＋`選び直す` | `15090-15113` |
| `現在の次の一手` / `やりたいことへ戻す` | （入れ替え時の確認。`replacementChoice`） | ボタン | `15115-15140` |
| `以前の実行設定` / `引き継ぐ` / `破棄して全体設定を使う` | `projects[].legacyNextStepSettings` の扱い | ボタン2つ | `15144-15177` |
| `行動` | `projects[].nextStep.text` | `input` `maxLength={120}`、placeholder `次に着手する具体的な一手`、候補チップ `aria-label="次の一手候補"` | `15178-15213` |
| **`始めるきっかけ（任意）`** | **`projects[].nextStep.trigger`** | `input` `maxLength={EXECUTION_TRIGGER_MAX_CHARS}`（=40, `src/constants.ts:3`）、placeholder `例: 21時 / 夕食後 / PCを開いたら` | `15219-15233` |
| `開始環境`（見出し）＋ `道具・アプリ` / `アプリ、フォルダ、ファイル、URLなど` / `開始環境を選ぶ` | `projects[].nextStep.buttonIds` | `StartEnvironmentPicker`（既定 `maxSelected = 2`、タブ `すべて` / `サイドバー` / `辞書`、検索、`role="listbox"`） | `15235-15245` / 部品 `src/StartEnvironmentPicker.tsx:17-27, 104-283`（`maxSelected = 2` は 35） |
| 注記 `タイマー開始時に一緒に開きます。` | （説明文） | 段落 | `15236` |
| `手順書`（`手順書を選ぶ`、`開始時に確認したいMarkdown・TXT・HTMLなど`） | `projects[].nextStep.instructionPath` | `InstructionPicker` | `15247-15265` / `src/InstructionPicker.tsx:46-142` |
| `開始時に手順書を開く` | `projects[].nextStep.instructionOpenOnStart` | checkbox（`instructionPath` 未選択なら `disabled`） | `15266-15279` |
| `タイマー` 見出し＋ `短時間` / `通常` | `projects[].nextStep.shortTimerMinutes` / `defaultTimerMinutes` | `type="number"` `min=1` `max=240`、`aria-label="短時間タイマー分数"` / `"通常タイマー分数"`、`−`/`+`、ドラッグ調整、`{n}分を使用` / `全体設定 {fallback}分を使用`、`全体設定に戻す` | `15281-15375`（15286, 15292） |
| `開始時にタイマーを大きく表示` | `projects[].nextStep.expandTimerOnStart` | checkbox | `15377-15389` |
| `開始noteテンプレート（任意）` | `projects[].nextStep.startNoteTemplate` | `input` `maxLength={120}` | `15391-15404` |
| `保存` / `キャンセル` | — | ボタン（保存不可条件 14930-14937） | `15406-15423` |

- 直接は編集できない値：`nextStep.generationId`（新規は `createStableId()`、編集は既存維持）、`updatedAt`、`reviewedAt`、`sourceWishlistId` — `src/App.tsx:8743-8763`
- 保存時の生成：`buttonIds` は常に配列、`trigger` / 分数 / `expandTimerOnStart` / `startNoteTemplate` / `instructionPath`+`instructionOpenOnStart` は空なら省略 — `src/App.tsx:8743-8763`。分数検証は `parseNextStepTimer`（`8731-8739`）。

#### (2) やりたいことを追加するダイアログ — `src/App.tsx:14714-14817`

`aria-label="やりたいことを追加"`、`eyebrow` = `Wishlist`、`h2` = `やりたいことを追加`、説明 `あとでやりたいことを、ひとまず残しておきます。`（`14717-14728`）。

| 欄の名前（画面の文字） | `config.json` の値 | 入力の形・制約 | 行 |
|---|---|---|---|
| `やりたいこと` | `inbox[].text` | `input` `maxLength={120}`、placeholder `気になっていた本を読む`、ヒント `120文字まで` | `14749-14779` |
| `プロジェクト（任意）` | `inbox[].projectId` | `select`（先頭 `プロジェクトなし`） | `14781-14795` |
| `保存` / `キャンセル` | — | ボタン（空なら保存不可） | `14797-14813` |

- 保存時に作られる値は `id` / `text` / `projectId` のみ — `src/App.tsx:7825-7835`
- 「開始環境」「手順書」「きっかけ」「分数」の欄は無い（`14742-14814`）

#### (3) やりたいことを編集するダイアログ — `src/App.tsx:13034-13145`

`aria-label="やりたいこと編集"`、`eyebrow` = `Wishlist`、`h2` = `やりたいことを編集`（`13037-13047`）。

| 欄の名前（画面の文字） | `config.json` の値 | 入力の形・制約 | 行 |
|---|---|---|---|
| `やりたいこと` | `inbox[].text` | `input` `maxLength={120}`、`autoFocus` | `13049-13058` |
| `プロジェクト` | `inbox[].projectId` | `radio`（`プロジェクトなし` ＋ 各プロジェクト） | `13060-13087` |
| `開始環境`（注記 `一緒に使う道具や、開始時に確認する手順を設定します。`） | `inbox[].buttonIds` | `StartEnvironmentPicker` | `13089-13099` |
| `手順書` | `inbox[].instructionPath` | `InstructionPicker` | `13100-13116` |
| `開始時に手順書を開く` | `inbox[].instructionOpenOnStart` | checkbox | `13117-13125` |
| `保存` / `キャンセル` | — | ボタン | `13126-13142` |

- 保存時に `text` / `projectId` / `buttonIds` / `instructionPath`+`instructionOpenOnStart` を書き戻す — `src/App.tsx:7937-7952`
- `InboxItem` に `trigger` と分数の値が無い（`src/types.ts:164-171`, `src-tauri/src/models.rs:322-335`）

#### (4) プロジェクトを追加・編集するダイアログ — `src/App.tsx:15429-15572`

`aria-label` は `プロジェクトを追加` / `プロジェクトを編集`、`eyebrow` = `Project`（`15432-15445`）。

| 欄の名前（画面の文字） | `config.json` の値 | 入力の形・制約 | 行 |
|---|---|---|---|
| `プロジェクト名` | `projects[].name` | `input` `maxLength={48}` | `15460-15471` |
| `目標（任意）` | `projects[].northStar` | `input` `maxLength={60}`、placeholder `EPを1枚完成させる` | `15473-15485` |
| `今週の重点にする` | `projects[].weeklyFocus` | checkbox | `15487-15494` |
| `プロジェクトカラー` | `projects[].colorId` | `role="radiogroup"` の12色 | `15496-15524` |
| `危険な操作` / `プロジェクトを削除…` | （削除操作） | 編集時のみ | `15526-15546` |
| `プロジェクトを追加` / `保存` / `キャンセル` | — | ボタン | `15548-15569` |

- この画面に `nextStep`・`trigger`・分数・`buttonIds`・`instructionPath` の欄は無い（`15459-15546`）

#### (5) 今日の3件カード上で「きっかけ」を直す欄 — `src/App.tsx:11248-11279`

| 項目 | 事実 | 行 |
|---|---|---|
| 表示 | 値が無ければ `+ きっかけ`、有れば `{trigger} ▸` | `11267-11279` |
| 入力 | `aria-label="いつ・何の後にやる？"`、placeholder `例: 21時 / 夕食後`、`maxLength={EXECUTION_TRIGGER_MAX_CHARS}` | `11249-11265` |
| Enter / Escape | Enter 確定、Escape 取消 | `7798-7808` |
| 保存先 | `today.items[].trigger` のみ（空で `delete`）。`project.nextStep.trigger` へは書き戻さない | `7781-7796` |

#### (6) 全体設定（フォールバック値）

| 欄の名前 | `config.json` の値 | 行 |
|---|---|---|
| `短時間タイマー分数` | `settings.shortTimerMinutes`（既定 5） | `src/App.tsx:13634` / `src/types.ts:195` |
| `通常タイマー分数` | `settings.defaultTimerMinutes`（既定 25） | `src/App.tsx:13670` / `src-tauri/src/models.rs:8` |
| `手順書フォルダ（最大5件）` | `settings.instructionFolders` | `src/App.tsx:13941` / `src/types.ts:203` |

#### 調査項目ごとの結論（事実）

**「きっかけ（いつ・どこで）」に当たる欄**

| 問い | 事実 | 行 |
|---|---|---|
| あるか | ある。1本の自由入力テキストのみ | `15219-15233`, `11249-11279` |
| 値の名前 | `trigger`（`nextStep.trigger` / `today.items[].trigger`） | `src/types.ts:118, 147` / `src-tauri/src/models.rs:112, 291` |
| 「いつ」「どこで」の分離 | 無い。`when` / `where` という値・欄は無い（`src` 内の `when`/`where` はコメントのみ：`src/keyboardNavigation.ts:28`, `src/mhtml/assembleMhtml.ts:19`, `src/mhtml/parseMhtml.ts:459`） | — |
| 文字数上限 | 40（`EXECUTION_TRIGGER_MAX_CHARS`） | `src/constants.ts:3` |

**項目ごとのタイマーの分数**

| 対象 | 値の名前 | 画面 | 行 |
|---|---|---|---|
| 次の一手 | `nextStep.shortTimerMinutes` / `nextStep.defaultTimerMinutes` | `短時間` / `通常`（1〜240） | `src/App.tsx:15281-15375` / `src/types.ts:107-108` |
| 今日の項目 | `today.items[].shortTimerMinutes` / `defaultTimerMinutes` | 編集欄なし。追加時に候補から複写 | `src/App.tsx:8189-8206`, `8154-8165` |
| 今日のカード表示 | `{shortMinutes}分` / `{defaultMinutes}分`（`短時間タイマー{n}分で開始` / `通常タイマー{n}分で開始`）＋ `時間を決めずに計測` | 参照のみ | `src/App.tsx:11330-11445`（分数決定は 11076-11087） |
| やりたいこと | 無い | — | `src/types.ts:164-171` |
| プロジェクト | 無い（`nextStep` 経由のみ） | — | `src/types.ts:123-140` |

**「一緒に開く」ボタン・手順書のつながり**

| 問い | 事実 | 行 |
|---|---|---|
| 「一緒に開く」という名前のボタン | 無い。関連する説明文は `タイマー開始時に一緒に開きます。` と `一緒に使う道具や、開始時に確認する手順を設定します。` | `15236`, `13091`、`src/content/helpGuide.ts:66` |
| 道具・アプリ側の値 | `buttonIds`（`nextStep` / `inbox[]` / `today.items[]`） | `src/types.ts:105, 149, 168` |
| その UI | 見出し `開始環境`、`StartEnvironmentPicker`（`道具・アプリ` / `開始環境を選ぶ`、既定上限2件） | `15235-15245`, `13089-13099` / `src/StartEnvironmentPicker.tsx:104-161` |
| 手順書側の値 | `instructionPath` と `instructionOpenOnStart` | `src/types.ts:110-111, 151-152, 169-170` |
| その UI | 見出し `手順書`、`InstructionPicker`、checkbox `開始時に手順書を開く` | `15247-15279`, `13100-13125` / `src/InstructionPicker.tsx:46-142` |
| 開始時の動き | `buttonIds` の `actions` を `runActions` で実行し、`instructionPath` かつ「開く」設定なら `openInstructionWindow({focus:false})`。今日のカードは `item.instructionPath` を渡し、`startTimer` 内で `project.nextStep.instructionPath` にフォールバック | `7324-7340` / `11330-11357`, `11371-11398` |
| 手順書 → 次の一手 の逆方向リンク | 文脈メニュー `link-project` → ダイアログ `次の一手に紐づける`（`aria-label="次の一手に手順書を紐づける"`、`紐づけ先`、`紐づける`）。保存で `instructionPath` と `instructionOpenOnStart: true` を書く。未完了の今日の3件にある次の一手は対象外 | `src/components/InstructionTree.tsx:1674-1809`（説明 1784-1787）、書込 1016-1045、絞り込み 990-993, 1028-1030、メニュー 1079-1080, 1420 |
| 手順書の候補の出所 | `settings.instructionFolders` を走査し `<root.name> / <相対パス>` を最大 50,000 件まで列挙 | `src/App.tsx:8288-8322` |
| 今日のカードの手順書ボタン | `item.instructionPath` が無くても `project.nextStep.instructionPath` があれば出る（`todayInstructionPath`） | `src/App.tsx:11065-11067`, `11207-11228` |
| カード上の表示 | 次の一手カードは `trigger ▸ text`、今やる一手カードは時計アイコンの分数と `trigger` | `11808-11813`, `10814-10833` |

**分からなかったこと**

- `config.today.candidateExcludedSourceKeys` を今日の3件の候補から除外するために読む画面・関数は見つからなかった（`src/todayCandidates.ts` と picker の絞り込みに参照が無い）。この値が UI 上でどう使われるかは分からなかった。
- 「きっかけ」を「いつ」「どこで」に分ける構想・下書き・未使用の型は `src` 内で見つからなかった（存在するかどうかは分からない）。

## H. メニュー・トースト・ダイアログ

### H-1 コンテキストメニュー

#### H-1-1 部品の作り（`src/components/ContextMenu.tsx`、全 152 行）

| 項目 | 内容 | 場所 |
|---|---|---|
| props | `ariaLabel` / `children` / `className?` / `opener` / `onClose` / `x` / `y` | `src/components/ContextMenu.tsx:4-12` |
| 既定のクラス名 | `contextMenu`（`className = "contextMenu"`） | `src/components/ContextMenu.tsx:26` |
| 端の余白 | `const EDGE_GUTTER = 8` | `src/components/ContextMenu.tsx:14` |
| 項目の部品 | `ContextMenuItem` は `<button {...props} role="menuitem" type={type} />` | `src/components/ContextMenu.tsx:16-21` |
| ルート要素 | `<div role="menu" aria-label={ariaLabel} className={className}>` | `src/components/ContextMenu.tsx:114-141` |
| 初期スタイル | `left: 0, top: 0, opacity: 0, visibility: "hidden", transition: "none"`（JS で位置を決めてから表示） | `src/components/ContextMenu.tsx:141-147` |
| 位置決め | `clampToViewport` が `x` / `y` を `EDGE_GUTTER` と `innerWidth` / `innerHeight` の内側に丸め、`opacity = "1"` / `visibility = "visible"` にする | `src/components/ContextMenu.tsx:42-54` |
| 位置の再計算 | `useLayoutEffect` で `ResizeObserver` と `window` の `resize` を購読 | `src/components/ContextMenu.tsx:56-70` |
| 開いたときのフォーカス | `menu.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus()`（無効でない最初の項目） | `src/components/ContextMenu.tsx:65`（再実行 `:73`） |
| 項目クリックでの閉じ | ルートの `onClick`（`handleClick`）が `button` かつ `disabled` でない場合に `onClose()` | `src/components/ContextMenu.tsx:108-112` |
| 外側クリックでの閉じ | `document` の `pointerdown` を capture で購読し、メニュー外なら `dismiss()` | `src/components/ContextMenu.tsx:74-76, 83` |
| Escape での閉じ | ルートの `onKeyDown` と `document` の `keydown` の両方で `dismiss()`（`event.defaultPrevented` のときは何もしない） | `src/components/ContextMenu.tsx:77-81, 119-124` |
| ウィンドウ blur での閉じ | `window.addEventListener("blur", closeOnBlur)` → `dismiss()` | `src/components/ContextMenu.tsx:82, 85` |
| 閉じたあとのフォーカス復帰 | `dismiss()` が `onClose()` のあと `requestAnimationFrame` で、`document.activeElement` が `[role="menu"]` の中にいなければ `opener.focus({ preventScroll: true })` | `src/components/ContextMenu.tsx:34-40` |
| キー操作（メニュー内） | `ArrowDown` → 次、`ArrowUp` → 前、`Home` → 先頭、`End` → 末尾（`moveFocus`、末尾から先頭へ循環） | `src/components/ContextMenu.tsx:93-106, 125-137` |
| 文字キーでのジャンプ | なし（該当コードなし） | — |
| 見た目 | `.contextMenu { position: fixed; z-index: 40; width: min(240px, calc(100vw - 16px)); min-width: 116px; max-height: calc(100vh - 16px); overflow-y: auto; }` | `src/styles.css:5554-5567` |
| 項目の見た目 | `.contextMenu button { width: 100%; min-height: 34px; text-align: left; }` | `src/styles.css:5569-5577` |
| 赤い字 | `.contextMenuDanger { color: #ffb4ad !important; }`（hover / focus-visible は `#ffd0cb`） | `src/styles.css:5583-5591` |
| 区切り線 | `.contextMenuSeparatorBefore { margin-top: 5px; border-top: 1px solid var(--line-soft) !important; }` | `src/styles.css:5593-5597` |

#### H-1-2 開き方

| きっかけ | 仕組み | 場所 |
|---|---|---|
| 右クリック | 各要素の `onContextMenu` で `event.preventDefault()`（必要な所は `stopPropagation()`）してから `openContextMenu(target, event.clientX, event.clientY, event.currentTarget)` | `src/App.tsx:2560-2567`（関数）／呼び出しは下表 |
| 「…」ボタン | `onClick` で `event.currentTarget.getBoundingClientRect()` を取り、`openContextMenu(target, rect.left, rect.bottom, event.currentTarget)` | `src/App.tsx:11136-11144` ほか／`src/RecordsView.tsx:377` |
| キー（メニューキー / Shift+F10） | `openContextMenuFromKeyboard`：`event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")` なら何もしない。opener は `event.target.closest('button, [tabindex="0"]') ?? event.currentTarget`、位置は `rect.left`, `rect.bottom + 4` | `src/App.tsx:2569-2581`（記録ビューは独自実装 `src/RecordsView.tsx:103-108`） |
| フォーカス復帰先の記録 | `openContextMenu` が `opener ?? document.activeElement` を `contextMenuReturnFocusRef` に入れる | `src/App.tsx:2562-2563` |
| ダイアログを開くときの引き継ぎ | `captureDialogReturnFocus` は、`activeElement` が `[role="menu"]` の中なら `contextMenuReturnFocusRef` の要素を復帰先にする | `src/App.tsx:2442-2458` |
| 状態 | `const [contextMenu, setContextMenu] = useState<ContextMenuState \| null>(null)` | `src/App.tsx:2317` |
| 型 | `ContextMenuTarget`（11 種の union）と `ContextMenuState = ContextMenuTarget & { x, y }` | `src/App.tsx:528-576` |
| 描画 | `{contextMenu && (<ContextMenu ariaLabel="操作メニュー" onClose={() => dismissContextMenu(false)} opener={contextMenuReturnFocusRef.current} x={contextMenu.x} y={contextMenu.y}>…)}` | `src/App.tsx:12599-12606` |
| 閉じる側の実装 | `dismissContextMenu(restoreFocus = true)`。描画時は常に `false` が渡るので、メニュー側の `dismiss()` 以外では復帰しない | `src/App.tsx:2431-2440, 12602` |
| 重なり順 | `.modalBackdrop` は `z-index: 35`、`.contextMenu` は `z-index: 40`、`.toastStack` は `z-index: 80` | `src/styles.css:5892, 5556, 5297` |

#### H-1-3 メニューの種類と、開く場所

| `contextMenu.kind` | 開く場所（右クリック / 「…」 / キー） | 項目の定義 |
|---|---|---|
| `doNow` | 今やる一手の本体を右クリック（`doNowCandidates.length > 1` のときだけ開く。`tabIndex` も同じ条件）／キー（同じ条件）／「…」なし | `src/App.tsx:10763-10779` |
| `overlayPage` | 辞書ページのタブを右クリック（`customPage` があるときだけ）／キー | `src/App.tsx:10223-10233, 10248-10253` |
| `button` | サイドバーのボタン右クリック／キー、辞書オーバーレイの検索結果とタイルの右クリック／キー | `src/App.tsx:9941-9953, 10355-10370, 10411-10423` |
| `today` | 今日の3件の行を右クリック／キー、行内の「…」ボタン | `src/App.tsx:11109-11125, 11132-11150` |
| `inbox` | やりたいことの行を右クリック／キー、行内の「…」ボタン | `src/App.tsx:12214-12230, 12290-12308` |
| `nextStep` | プロジェクトカード本体の右クリック、カード内の操作領域の右クリック／キー、カード内の「…」ボタン | `src/App.tsx:11712-11720, 11744-11756, 11783-11795, 11872-11891` |
| `project` | やりたいことのグループ見出しを右クリック（`groupProject` があるときだけ）／キー | `src/App.tsx:12125-12143` |
| `projects` | プロジェクト帯（`section className=projectsBand`）の右クリック、見出しの右クリック、見出しの「…」ボタン | `src/App.tsx:11565-11573, 11581-11589, 11621-11640` |
| `inboxes` | やりたいこと帯の見出しの右クリック／キー、見出しの「…」ボタン | `src/App.tsx:11975-11984, 12020-12039` |
| `session` | 記録ビューの行を右クリック／キー、行内の「⋯」ボタン | `src/RecordsView.tsx:367-368, 377`（キー処理は `src/RecordsView.tsx:103-108`） |
| `sidebar`（既定の else 分岐） | `aside.sidebar` の右クリック／キー、グループのまとまりの右クリック、グループ見出しの右クリック／キー | `src/App.tsx:9782-9791, 9875-9908` |

「…」ボタンの属性（コードにあるとおり）:

| ボタン | `aria-label` | `aria-haspopup` | `title` | クラス | 場所 |
|---|---|---|---|---|---|
| 今日の3件の行 | `` `${item.text \|\| "未入力"}の操作` `` | `"menu"` | `"操作メニュー"` | `sourceRowMenu todayRowMenu` | `src/App.tsx:11132-11150` |
| 次の一手の帯 | `"次の一手の操作"` | `"menu"` | `"次の一手の操作"` | `sectionMenuButton` | `src/App.tsx:11621-11640` |
| プロジェクトカード | `` `${project.name}の次の一手の操作` `` | `"menu"` | `"次の一手の操作"` | `sourceRowMenu nextStepRegionMenu` | `src/App.tsx:11872-11891` |
| やりたいことの帯 | `"やりたいことの操作"` | `"menu"` | `"やりたいことの操作"` | `sectionMenuButton` | `src/App.tsx:12020-12039` |
| やりたいことの行 | `` `${item.text}の操作` `` | `"menu"` | `"操作メニュー"` | `sourceRowMenu` | `src/App.tsx:12290-12308` |
| 記録ビューの行 | `` `${session.date} ${session.label}の操作` `` | なし | なし | `sourceRowMenu recordsSessionMenuButton` | `src/RecordsView.tsx:377` |

（「…」ボタンに `aria-expanded` を付けている箇所は無い。`src/App.tsx` の grep で該当なし。）

#### H-1-4 種類ごとの項目（上から順、字はコードのとおり）

##### `kind: "doNow"`（`src/App.tsx:12607-12610`）

| # | 字 | 押したとき | 赤い字 |
|---|---|---|---|
| 1 | `他の一手` | `showNextDoNowCandidate` | いいえ |

##### `kind: "overlayPage"`（`src/App.tsx:12611-12643`）

| # | 字 | 押したとき | 赤い字 | 無効になる条件 |
|---|---|---|---|---|
| 1 | `上へ移動` | `void moveOverlayPageByOffset(contextMenu.page.id, -1)` | いいえ | `overlayPages` 内の位置が 0 以下 |
| 2 | `下へ移動` | `void moveOverlayPageByOffset(contextMenu.page.id, 1)` | いいえ | 位置が最後（`length - 1` 以上） |
| 3 | `名前を変更` | `openOverlayPageDialog(contextMenu.page)` | いいえ | なし |
| 4 | `ページを削除` | `deleteOverlayPage(contextMenu.page)` | はい（`contextMenuDanger`） | なし |

##### `kind: "button"`（`src/App.tsx:12644-12710`）

| # | 字 | 押したとき | 赤い字 | 区切り線 | 出る条件・無効条件 |
|---|---|---|---|---|---|
| 1 | `上へ移動` | `void moveSidebarButtonByOffset(contextMenu.button.id, -1)` | いいえ | なし | `showButtonInSidebar(contextMenu.button)` のときだけ出る。同じグループ内の位置が 0 以下なら無効 |
| 2 | `下へ移動` | `void moveSidebarButtonByOffset(contextMenu.button.id, 1)` | いいえ | なし | 同上。同じグループ内の最後なら無効 |
| 3 | `編集` | `openButtonEditDialog(contextMenu.button)` | いいえ | なし | 常に出る |
| 4 | `エクスプローラーで表示する` | `void revealButtonInExplorer(contextMenu.button)` | いいえ | なし | `canRevealLauncherButton(contextMenu.button)` のときだけ出る |
| 5 | `辞書に移動` | `void moveSidebarButtonToDictionary(contextMenu.button)` | いいえ | あり（`contextMenuSeparatorBefore`） | 常に出る |
| 6 | `削除` | `deleteButton(contextMenu.button)` | はい（`contextMenuDanger`） | あり | 常に出る |

##### `kind: "today"`（`src/App.tsx:12711-12785`）

| # | 字 | 押したとき | 赤い字 | 無効になる条件 |
|---|---|---|---|---|
| 1 | `編集` | インライン関数（`openNextStepEditor(project, { origin: "today" })` または `beginInboxEdit(index, "today")`） | いいえ | `sourceKey` が無い／`canonicalSourceKey` が空／`sourceEditBlocked(key, true)`。`title` に `sourceEditBlockReason(key, true)` |
| 2 | `左へ移動` | `void moveTodayItemByOffset(contextMenu.index, -1)` | いいえ | `index <= 0` |
| 3 | `右へ移動` | `void moveTodayItemByOffset(contextMenu.index, 1)` | いいえ | `index >= items.length - 1` |
| 4 | `今日の3件から外す` | `setContextMenu(null)` のあと `void removeTodayItem(todaySourceKey(item, index))` | いいえ | その項目でタイマーが動いている（`isTimerOnTodayItem`）。`title` は `"タイマーを停止してから外してください"` |

##### `kind: "inbox"`（`src/App.tsx:12786-12862`）

| # | 字 | 押したとき | 赤い字 | 無効になる条件 |
|---|---|---|---|---|
| 1 | `次の一手にする` / `次の一手に設定済み`（`wishlistItemIsCurrentNextStep` のとき後者） | `promoteInboxToNextStep(contextMenu.index)` | いいえ | `sourceEditBlocked("wishlist:…")` または既に次の一手 |
| 2 | `上へ移動` | `void moveInboxItemByOffset(contextMenu.index, -1)` | いいえ | `inboxNeighborIndex(contextMenu.index, -1) === undefined` |
| 3 | `下へ移動` | `void moveInboxItemByOffset(contextMenu.index, 1)` | いいえ | `inboxNeighborIndex(contextMenu.index, 1) === undefined` |
| 4 | `編集` | `beginInboxEdit(contextMenu.index)` | いいえ | `sourceEditBlocked("wishlist:…")` |
| 5 | `完了にする` | `completeInboxItem(contextMenu.index)` | いいえ | 項目が無い／`sourceEditBlocked`／タイマーが動いている（`isTimerActiveForSource`） |
| 6 | `削除` | `deleteInboxItem(contextMenu.index)` | はい（`contextMenuDanger`） | 同上 |

##### `kind: "nextStep"`（`src/App.tsx:12863-12921`）

| # | 字 | 押したとき | 赤い字 | 区切り線 | 出る条件・無効条件 |
|---|---|---|---|---|---|
| 1 | `プロジェクトを編集` | `openProjectEditDialog(contextMenu.project)` | いいえ | なし | 常に出る |
| 2 | `次の一手を編集` | `openNextStepEditor(contextMenu.project)` | いいえ | なし | `project.nextStep?.text.trim()` があるとき。`sourceEditBlocked("project:…")` で無効 |
| 3 | `別の行動に入れ替える` | `openNextStepEditor(contextMenu.project, { mode: "promote", text: "", projectLocked: true })` | いいえ | なし | 同上 |
| 4 | `次の一手を未設定にする` | `clearProjectNextStep(contextMenu.project)` | いいえ | なし | 同上 |
| 5 | `次の一手を設定` | `openNextStepEditor(contextMenu.project)` | いいえ | なし | 次の一手が空のとき（4 の代わり） |
| 6 | `プロジェクトを削除…` | `requestProjectDeletion(contextMenu.project)` | はい（`contextMenuDanger`） | あり（`contextMenuSeparatorBefore`） | 常に出る |

##### `kind: "project"`（`src/App.tsx:12922-12944`）

| # | 字 | 押したとき | 赤い字 | 区切り線 |
|---|---|---|---|---|
| 1 | `プロジェクトを編集` | `openProjectEditDialog(contextMenu.project)` | いいえ | なし |
| 2 | `プロジェクトを管理` | `openProjectManagement` | いいえ | あり（`contextMenuSeparatorBefore`） |
| 3 | `プロジェクトを削除…` | `requestProjectDeletion(contextMenu.project)` | はい（`contextMenuDanger`） | あり（`contextMenuSeparatorBefore`） |

##### `kind: "projects"`（`src/App.tsx:12945-12953`）

| # | 字 | 押したとき | 赤い字 |
|---|---|---|---|
| 1 | `プロジェクトを追加` | `openProjectAddDialog` | いいえ |
| 2 | `まとめて取り込む` | `() => openImportDialog("")` | いいえ |

##### `kind: "inboxes"`（`src/App.tsx:12954-12957`）

| # | 字 | 押したとき | 赤い字 |
|---|---|---|---|
| 1 | `やりたいことを追加` | `() => openInboxAddDialog()` | いいえ |

##### `kind: "session"`（`src/App.tsx:12958-12973`）

| # | 字 | 押したとき | 赤い字 |
|---|---|---|---|
| 1 | `編集` | `openSessionEditDialog(contextMenu.session)` | いいえ |
| 2 | `削除` | `requestSessionDelete(contextMenu.session)` | はい（`contextMenuDanger`） |

##### `kind: "sidebar"`（既定の else 分岐、`src/App.tsx:12974-13030`）

| # | 字 | 押したとき | 赤い字 | 出る条件・無効条件 |
|---|---|---|---|---|
| 1 | `グループを追加` | `openGroupDialog` | いいえ | 常に出る |
| 2 | `ボタンを追加` | `() => openButtonBuilder(contextMenu.groupName)` | いいえ | 常に出る |
| 3 | `上へ移動` | `void moveSidebarGroupByOffset(contextMenu.groupName!, -1)` | いいえ | `groupName` があるとき。`uniqueGroupNames(config)` 内の位置が 0 以下なら無効 |
| 4 | `下へ移動` | `void moveSidebarGroupByOffset(contextMenu.groupName!, 1)` | いいえ | 同上。最後なら無効 |
| 5 | `その他は削除不可` | なし（無効のまま） | いいえ | `groupName === DEFAULT_BUTTON_GROUP`（`"その他"`、`src/constants.ts:9`）のとき |
| 6 | `名前を変更` | `openGroupRenameDialog(contextMenu.groupName)` | いいえ | `groupName` があり、`"その他"` でないとき |
| 7 | `` `${contextMenu.groupName}を削除` `` | `deleteGroup(contextMenu.groupName)` | はい（`contextMenuDanger`） | 同上 |

### H-2 トースト

#### H-2-1 部品の場所

| 部分 | 内容 | 場所 |
|---|---|---|
| 型 `ToastTone` | `"neutral" \| "ok" \| "warn" \| "error" \| "danger"`（5 種） | `src/App.tsx:209` |
| 型 `Toast` | `id / tone / message / detail? / actionLabel? / onAction? / actionPending / durationMs / queued / paused / leaving` | `src/App.tsx:257-269` |
| 型 `ToastOptions` | `detail? / actionLabel? / onAction? / durationMs?` | `src/App.tsx:271-276` |
| 型 `ToastTimerState` | `dismissTimer / removeTimer / remainingMs / startedAt / pointerInside / focusInside / documentHidden` | `src/App.tsx:278-286` |
| 状態 | `toasts` / `toastsRef` は `src/App.tsx:2092-2094`、`toastIdRef` / `toastTimersRef` / `toastActionLocksRef` は `src/App.tsx:2349-2351` |
| 出す関数 | `showToast(tone, message, options = {})`（`id` を返す） | `src/App.tsx:2892-2930` |
| 消す関数 | `dismissToast(id)`（`leaving: true` にして 180ms 後に配列から削除） | `src/App.tsx:2808-2832` |
| 時間の管理 | `useEffect` で `durationMs` の `setTimeout` を仕掛ける | `src/App.tsx:2834-2858` |
| 一時停止 | `pauseToast(id, "pointer" \| "focus" \| "document", paused)` | `src/App.tsx:2860-2882` |
| 「元に戻す」の実行 | `runToastAction(id)` | `src/App.tsx:2932-2954` |
| 描画 | `toasts.some((toast) => !toast.queued)` のときだけ `.toastStack` を出す | `src/App.tsx:12537-12597` |
| CSS | `.toastStack` / `.toast` / `.toastAccent` / `.toastIconBadge` / `.toastCopy` / `.toastAction` / `.toastClose` / `.toastLifetime` / `.toast--*` / keyframes / reduced-motion / 幅 520px 以下 | `src/styles.css:5293-5552` |
| 標準の表示時間の定数 | `TOAST_TIMEOUT_MS = 4000` / `TOAST_UNDO_TIMEOUT_MS = 8000` | `src/constants.ts:5-6` |

#### H-2-2 色の種類と決まり

| tone | クラス | 色（CSS 変数と値） | 既定の表示時間 | アイコン |
|---|---|---|---|---|
| `ok` | `toast--ok` | `--good` = `#6fcf97`（`toast` の色・`toastAccent`・`toastIconBadge`） | 4000ms | `play` |
| `neutral` | `toast--neutral` | `--accent` = `#e7b94d`（`toast` の色）、`toastIconBadge` は `--accent-strong` = `#ffce5b`。`toastAccent` の上書きは無いので `.toastAccent` の `var(--accent)` のまま | 4000ms | `clock` |
| `warn` | `toast--warn` | `--warn` = `#f2a65a` | 4000ms | `clock` |
| `error` | `toast--error` | `--error` = `#f06f68` | 8000ms | `close` |
| `danger` | `toast--danger` | `--error` = `#f06f68` | 4000ms | `close` |

- どの tone でも `.toastCopy strong`（本文）は `color: var(--text)` になる（`src/styles.css:5369-5372, 5487-5489, 5495-5497, 5512-5514, 5532-5535`）。
- 色は `styles.css` の `--good: #6fcf97` / `--warn: #f2a65a` / `--error: #f06f68` / `--accent: #e7b94d` / `--accent-strong: #ffce5b`（`src/styles.css:17-21`）。ライトテーマ用の上書き定義は grep で見つからなかった。
- 表示時間の決まり（コード）: `options.durationMs ?? (options.onAction ? TOAST_UNDO_TIMEOUT_MS : tone === "error" ? 8000 : TOAST_TIMEOUT_MS)`（`src/App.tsx:2895-2897`）。
- 仕様書の色の役割（コードではなく文書）: 「緑(`ok`)=追加・保存・実行が済んだ、灰色(`neutral`)=止めた・外した・解除した・削除した・元に戻した、赤(`danger`)=プロジェクトの削除。失敗(`error`)・注意(`warn`)の色は変えない（P97-08、オーナー指示 2026-11-07）」`docs/spec/current-spec.md:901`。
- 上の仕様書は `neutral` を「灰色」と書いているが、`styles.css` の `.toast--neutral` は `var(--accent)`（`#e7b94d`）を指定している（`src/styles.css:5491-5493`）。どちらが正かは分からなかった。
- `ok` の緑・`neutral` の灰・`danger` の赤の使い分けを検証するテスト: `tests/visual/phase97-toast-colors.spec.ts:19-24, 26-41, 43-54, 56-71`。

#### H-2-3 出る場所（ダイアログを開いている間の扱い、#167）

| 状態 | 位置 | 場所 |
|---|---|---|
| 通常 | `.toastStack { position: fixed; right: 18px; bottom: 18px; z-index: 80; width: min(390px, calc(100vw - 36px)); gap: 10px; align-items: flex-end; pointer-events: none; }`（右下） | `src/styles.css:5293-5304` |
| ダイアログを開いている間 | `body:has([aria-modal="true"]) .toastStack { top: 12px; right: auto; bottom: auto; left: 50%; transform: translateX(-50%); align-items: center; }`（上端の中央） | `src/styles.css:5306-5316` |
| 幅 520px 以下 | `.toastStack { right: 10px; bottom: 10px; width: calc(100vw - 20px); }`、`.toast { grid-template-columns: 32px minmax(0, 1fr) 28px; }`、`.toastAction` は 2 列目に回る | `src/styles.css:5537-5552` |

- この上端中央の切替は commit `984f59e`「fix: ダイアログを開いている間は通知を上端の中央に出す」で入り、PR #167（`d211daf`「Merge pull request #167 from Takuyakou/fix/toast-over-dialog-buttons」）で取り込まれている（`git log`, `git show 984f59e --stat`：`docs/spec/current-spec.md` / `src/styles.css` / `tests/visual/toast-dialog-placement.spec.ts` の 3 ファイル、125 行追加・2 行削除）。
- コミットメッセージの理由（原文）: 「窓の幅が約1050px以下のとき、ボタン登録や設定で保存に失敗すると、右下のエラー通知がダイアログの「キャンセル」に重なり、通知が消えるまで約8秒押せなかった。ダイアログ(aria-modal)を開いている間は、通知を上端の中央に出す(オーナー決定 2026-11-10)。閉じると右下に戻る。」（`git show 984f59e`）
- 検査: `tests/visual/toast-dialog-placement.spec.ts:5-6, 45-51`（`.toastStack` の中心が viewport の中心 ±1px、`y <= 13`）、4 サイズ（860×560 / 1000×720 / 1200×680 / 1920×1080）で確認（同 `:13-18`）。
- 仕様書 `docs/spec/current-spec.md:898` は「トーストは右下へ表示し、最大幅は約420px。ダイアログ(`aria-modal`)を開いている間は、上端の中央へ表示する。」と書いているが、CSS の幅は `min(390px, calc(100vw - 36px))`（`src/styles.css:5301`）。約420px と 390px の差の理由は分からなかった。
- トーストを描くのはメイン画面の `App` だけ。`MiniModeApp` / 辞書ウィンドウ / 手順書ウィンドウは `App` の早期 return で別ツリーになる（`src/App.tsx:2058-2070`）。`DictionaryWindow.tsx` などに `.toastStack` は無い（grep で `toastStack` は `src/App.tsx:12538` と `src/styles.css` のみ）。
- 通知はダイアログの外側（`main` の中、`src/App.tsx:12537`）に描かれ、`position: fixed` で置かれる。`pointer-events` は `.toastStack` が `none`、`.toast` が `auto`（`src/styles.css:5303, 5337`）。

#### H-2-4 消えるまでの時間・待ち行列・止まる条件

| 項目 | 内容 | 場所 |
|---|---|---|
| 通常 | 4000ms | `src/constants.ts:5`、`src/App.tsx:2897` |
| `error` | 8000ms | `src/App.tsx:2897` |
| `onAction` 付き（元に戻す） | 8000ms（tone に関係なく） | `src/App.tsx:2897` |
| 個別指定 | `options.durationMs` が最優先 | `src/App.tsx:2896` |
| 同時に見える数 | 3 件（`visibleCount >= 3` で `queued: true`） | `src/App.tsx:2908, 2918` |
| 待ち行列の解除 | 1 件消えるごとに `queued` を先頭から解除（`available = max(0, 3 - visibleCount)`） | `src/App.tsx:2820-2829` |
| 全体の上限 | 24 件。超えるときは `queued` かつ `onAction` なしの 1 件を落とす | `src/App.tsx:2922-2927` |
| 同じ通知の重複 | `onAction` なしで tone と message が同じものが表示中なら追加しない | `src/App.tsx:2899-2907` |
| 消える動き | `leaving: true` → 180ms 後に配列から削除。CSS は `toast-leave 200ms` | `src/App.tsx:2815-2830`、`src/styles.css:5434-5436` |
| 残り時間のバー | `.toastLifetime` が `animation: toast-lifetime var(--toast-duration) linear forwards`。`--toast-duration` は `toast.durationMs` | `src/styles.css:5418-5428`、`src/App.tsx:12555` |
| 止まる条件 | ポインタがトースト内（`onPointerEnter` / `onPointerLeave`）、フォーカスがトースト内（`onFocusCapture` / `onBlurCapture`）、`document.hidden`（`visibilitychange`）のいずれか | `src/App.tsx:12546-12553, 2884-2890`、`src/styles.css:5430-5432` |
| 止めたときの残り時間 | `remainingMs` を保持し、再開時に `setTimeout(dismissToast, remainingMs)` で張り直す | `src/App.tsx:2862-2881` |
| 入場の動き | `animation: toast-enter 140ms ease-out both`（`translateX(28px)` → `0`） | `src/styles.css:5338, 5438-5447` |
| reduced-motion | `.toast`, `.toast--leaving`, `.toastLifetime` の `animation-duration: 1ms` | `src/styles.css:5469-5475` |
| 手で閉じる | `aria-label="通知を閉じる"` のボタン → `dismissToast(toast.id)` | `src/App.tsx:12585-12592` |

#### H-2-5 「元に戻す」の仕組み

| 項目 | 内容 | 場所 |
|---|---|---|
| ボタンの字 | `toast.actionPending ? "処理中…" : (toast.actionLabel ?? "元に戻す")` | `src/App.tsx:12582` |
| ボタンのクラス・アイコン | `className="toastAction"`、`<UiIcon name="back" size={16} />` | `src/App.tsx:12575-12581` |
| 実行 | `runToastAction(id)`：`onAction` が無い／同じ id がロック中なら何もしない。`pauseToast(id, "focus", true)` → `actionPending: true` → `await toast.onAction()` | `src/App.tsx:2932-2940` |
| 成功時 | `dismissToast(id)` のあと `showToast("neutral", "元に戻しました")` を出す | `src/App.tsx:2941-2944` |
| 失敗時 | ロックを外し `actionPending: false` に戻す（`onAction` 側が `showToast("warn", …)` を出すものもある）。フォーカスがトースト内なら再度止める | `src/App.tsx:2946-2953` |
| 型 | `onAction?: () => Promise<boolean>`（`true` で成功扱い） | `src/App.tsx:263, 274` |
| `onAction` を持つトースト（2 箇所） | 取り込み後 `` `${total}件を取り込みました` ``（`actionLabel: "元に戻す"`、中で `undoImport(...)`、失敗時 `showToast("warn", message.replace(/^changed:/, ""))`） | `src/App.tsx:4967-4981` |
| 同上 | `今日の3件から外しました`（`detail: "元の次の一手・やりたいことは残ります"`、`actionLabel: "元に戻す"`、中で `undoTodaySelectionOperation({...})`） | `src/App.tsx:7752-7766` |
| 検証 | `tests/visual/phase72-toast-undo.spec.ts:53-70`（`元に戻す` を押すと `undo_today_selection` が呼ばれる） | — |

#### H-2-6 `aria-live`

| 要素 | 属性 | 場所 |
|---|---|---|
| トーストの入れ物 | `<div aria-live="polite" aria-relevant="additions text" className="toastStack">` | `src/App.tsx:12538` |
| 各トースト | `<div ... role="status" ...>`（`aria-atomic` は無い） | `src/App.tsx:12554` |
| 装飾 | `toastAccent` / `toastIconBadge` / `toastLifetime` は `aria-hidden="true"` | `src/App.tsx:12557, 12558, 12593` |
| 閉じるボタン | `aria-label="通知を閉じる"` | `src/App.tsx:12586` |
| 別の live region（トーストではない） | `<div aria-live="polite" className="reorderAnnouncement" role="status">{reorderAnnouncement}</div>`（並べ替えの読み上げ） | `src/App.tsx:12525-12527` |
| 強制読み上げ（トーストではない） | ソフトウェアリセット進行の `<section aria-live="assertive" …>` | `src/App.tsx:15927` |

#### H-2-7 トーストを出している所（全部）

`src/App.tsx` の `showToast(...)` 呼び出し（行の順）。「字」はコードにあるとおり（`${...}` は式のまま）。色が「式」の行は、その式が `ok` / `warn` / `neutral` / `error` のどれかを返す。

| 行 | 色 | 字 |
|---|---|---|
| 2943 | `neutral` | `元に戻しました` |
| 3016 | `error` | `` `今やる一手を読めません: ${message}` `` |
| 3039 | `error` | `` `実行記録を読めません: ${message}` `` |
| 3049 | `warn` | `response.warning` |
| 3053 | `error` | `` `今日の実行を読み込めません: ${message}` `` |
| 3068 | `error` | `` `先週のふりかえりを読めません: ${message}` `` |
| 3096 | `warn` | `entries.warning` |
| 3100 | `error` | `` `記録を読めません: ${message}` `` |
| 3137 | `warn` | `` `バックアップできません: ${response.backupError}` `` |
| 3145 | `ok` | `設定を再読み込みしました` |
| 3152 | `error` | `` `設定を読めません: ${message}` `` |
| 3197 | `warn` | `recovery.message` |
| 3202 | `error` | `` `ソフトウェアリセットの復旧を完了できません: ${message}` `` |
| 3295 | `error` | `message` |
| 3322 | `error` | `` `保存できません: ${message}` `` |
| 3340 | `warn` | `warning` |
| 3433 | `warn` | `設定で「ミニタイマーを使う」をオンにしてください` |
| 3458 | `warn` | `` `ミニタイマーを開けません (${stage}): ${message}` `` |
| 3531 | `error` | `` `手順書を開けません: ${error instanceof Error ? error.message : String(error)}` `` |
| 3542 | `error` | `` `辞書ウィンドウを開けません: ${error instanceof Error ? error.message : String(error)}` `` |
| 3552 | `error` | `` "辞書ウィンドウを切り替えられません: " + (error instanceof Error ? error.message : String(error)) `` |
| 3617 | `ok` | `ミニウィンドウ位置をリセットしました` |
| 3625 | `warn` | `再生成できるアイコンがありません` |
| 3630 | `ok` | `` `アイコンキャッシュを再生成しました (${targets.length}件)` `` |
| 3649 | `warn` | `再生成できるアイコンがありません` |
| 3668 | `ok` | `バックアップフォルダを開きました` |
| 3671 | `error` | `` `バックアップを開けません: ${message}` `` |
| 3697 | `ok` | `データフォルダを開きました` |
| 3700 | `error` | `` `データフォルダを開けません: ${message}` `` |
| 3713 | `ok` | `今日の活動ログをコピーしました` |
| 3716 | `error` | `` `今日の活動ログをコピーできません: ${message}` `` |
| 3729 | `warn` | `` `ショートカットを再登録できません: ${error instanceof Error ? error.message : String(error)}` `` |
| 3752 | `error` | `` `ショートカット入力を開始できません: ${error instanceof Error ? error.message : String(error)}` `` |
| 3775 | `warn` | `英数字、F1〜F12、Spaceのいずれかを押してください` |
| 4306 | `error` | `` `フォルダを選べません: ${message}` `` |
| 4321 | `warn` | `同じ手順書フォルダは重複して登録できません` |
| 4329 | `error` | `` `手順書フォルダを追加できません: ${error instanceof Error ? error.message : String(error)}` `` |
| 4380 | `neutral` | `手順書フォルダの登録を解除しました` |
| 4396 | `ok` | `手順書一覧を再読み込みしました` |
| 4408 | `ok` | `手順書ウィンドウ位置をリセットしました` |
| 4421 | `warn` | `SOFTWARE_RESET_TIMER_MESSAGE`（`"実行中のタイマーを終了してからリセットしてください。"`、`src/App.tsx:212`） |
| 4459 | `error` | `` `ソフトウェアリセットを準備できません: ${message}` `` |
| 4496 | `error` | `` `ソフトウェアリセットに失敗しました: ${message}${rollbackDetail}` `` |
| 4541 | `warn` | `バックアップ保存先を選択してください` |
| 4570 | `error` | `` `リセット前のバックアップに失敗しました: ${message}` `` |
| 4630 | `warn` | `shortcutError` |
| 4708 | `warn` | `設定を反映できなかったため、以前の設定を維持しました` |
| 4710 | `error` | `` `以前の設定へ戻せません: ${rollbackError instanceof Error ? rollbackError.message : String(rollbackError)}` `` |
| 4732 | 式 | `windowWarning ? "warn" : "ok"` ／ 字は `windowWarning ?? "設定を保存しました"` |
| 4735 | `error` | `` `設定を保存できません: ${message}` `` |
| 4755 | `error` | `` `バックアップZIPを選べません: ${message}` `` |
| 4771 | `error` | `` `復元できません: ${message}` `` |
| 4812 | `warn` | `` `バックアップから復元しましたが、${warnings.join(" / ")}` `` |
| 4814 | `ok` | `バックアップから復元しました` |
| 4822 | `warn` | `ボタン編集で実行するアクションを追加してください` |
| 4830 | 式 | `summary.tone` ／ 字は `summary.message`（`formatActionSummary` が `ok`「起動しました」か `warn`「N件失敗: …」を返す、`src/App.tsx:870-881`） |
| 4833 | `error` | `` `実行できません: ${message}` `` |
| 4846 | `error` | `エクスプローラーで表示できませんでした` |
| 4909 | `error` | `` `登録できません: ${message}` `` |
| 4920 | `warn` | `複数ドロップ時は先頭の1件だけ登録します` |
| 4967 | `ok` | `` `${total}件を取り込みました` ``（`detail` / `actionLabel: "元に戻す"` / `onAction` 付き） |
| 4977 | `warn` | `message.replace(/^changed:/, "")` |
| 5056 | `error` | `` `D&Dを初期化できません: ${event.payload.message}` `` |
| 5099 | `error` | `` `D&Dを初期化できません: ${message}` `` |
| 5159 | `error` | `` `D&Dを初期化できません: ${message}` `` |
| 6185 | `warn` | `blockReason ?? "このやりたいことは次の一手へ移動できません"` |
| 6295 | `warn` | `登録先を入力してください` |
| 6309 | `warn` | `builderKind === "file" ? "ファイルを選んでください" : "フォルダを選んでください"` |
| 6322 | `error` | `` `登録先を確認できません: ${error instanceof Error ? error.message : String(error)}` `` |
| 6333 | `warn` | `ラベルを入力してください` |
| 6367 | `ok` | `` `${label} を登録しました` `` |
| 6419 | `danger` | `` `${button.label} を削除しました` `` |
| 6492 | `error` | `` `選択できません: ${error instanceof Error ? error.message : String(error)}` `` |
| 6503 | `warn` | `` `${groupName} はすでにあります` `` |
| 6518 | `ok` | `` `${groupName} を追加しました` `` |
| 6527 | `warn` | `` `${DEFAULT_BUTTON_GROUP} は削除できません` `` |
| 6532 | `warn` | `` `${cleanGroupName} は見つかりません` `` |
| 6566 | `danger` | `` `${cleanGroupName} を削除しました` `` |
| 6575 | `warn` | `` `${DEFAULT_BUTTON_GROUP} は名前を変更できません` `` |
| 6590 | `warn` | `` `${DEFAULT_BUTTON_GROUP} は変更できません` `` |
| 6594 | `warn` | `` `${to} はすでにあります` `` |
| 6621 | `ok` | `` `${from} を ${to} に変更しました` `` |
| 6660 | `warn` | `error` |
| 6683 | `ok` | `` `${name} を追加しました` `` |
| 6689 | `warn` | `ページが見つかりません` |
| 6701 | `ok` | `` `${name} に変更しました` `` |
| 6742 | `neutral` | `` `${page.name} を削除しました` `` |
| 6769 | `ok` | `辞書ページの順番を保存しました` |
| 6792 | `ok` | `` `${button.label} を辞書に移動しました` `` |
| 6821 | `warn` | `ラベルを入力してください` |
| 6827 | `warn` | `アクション内容を入力してください` |
| 6839 | `warn` | `` `${group} はすでにあります` `` |
| 6905 | `warn` | `保存しました。開けない場合はパスまたはURLを確認してください` |
| 6907 | `ok` | `` `${label} を保存しました` `` |
| 6996 | `warn` | `元のやりたいことが見つかりません` |
| 7012 | `warn` | `1分未満なので記録しませんでした` |
| 7029 | `error` | `` `記録できません: ${message}` `` |
| 7040 | `warn` | `記録は保存しましたが、表示を更新できませんでした` |
| 7042 | `ok` | `` `${timer.label} ${minutes}分を記録しました` `` |
| 7335 | `warn` | `` `タイマーは開始しましたが、手順書を開けません: ${error instanceof Error ? error.message : String(error)}` `` |
| 7574 | 式 | `nextAutoStart ? "ok" : "neutral"` ／ 字は `nextAutoStart ? "PC起動時に開くようにしました" : "PC起動時の起動を止めました"` |
| 7580 | `error` | `` `自動起動を変更できません: ${message}` `` |
| 7633 | `warn` | `勝利条件を入力してください` |
| 7695 | `warn` | `タイマーを停止してから元に戻してください` |
| 7706 | `error` | `` `元に戻せません: ${message}` `` |
| 7726 | `warn` | `タイマーを停止してから外してください` |
| 7752 | `neutral` | `今日の3件から外しました`（`detail: "元の次の一手・やりたいことは残ります"` / `actionLabel: "元に戻す"` / `onAction` 付き） |
| 7866 | `warn` | `reason` |
| 7882 | `error` | `error instanceof Error ? error.message : String(error)` |
| 7926 | `warn` | `元の登録が見つかりません` |
| 7962 | `ok` | `変更を保存しました`（`detail` 付き） |
| 8001 | `warn` | `タイマーを停止してから完了してください` |
| 8043 | `warn` | `タイマーを停止してから削除してください` |
| 8094 | `error` | `` `できたことノートを保存できません: ${message}` `` |
| 8124 | `error` | `` `できたことノートを保存できません: ${message}` `` |
| 8133 | `warn` | `いま選べるのは3件までです。完了後に次の3件を選べます` |
| 8140 | `warn` | `今日の3件に既にあります` |
| 8185 | `ok` | `今日の3件に追加しました`（`if (saved)` の内側） |
| 8225 | `ok` | `今日の3件を選択しました` |
| 8257 | `ok` | `今日の3件を選択しました` |
| 8275 | `warn` | `タイマーを停止してから外してください` |
| 8452 | `warn` | `この項目にはstable IDがないため、先に編集して保存してください` |
| 8464 | `warn` | `所属プロジェクトが見つかりません` |
| 8506 | `warn` | `すでに次の一手に設定されています` |
| 8515 | `warn` | `blockReason` |
| 8556 | `warn` | `error instanceof Error ? error.message : String(error)` |
| 8564 | `ok` | `project.nextStep?.text.trim() ? "次の一手を変更しました" : "次の一手に設定しました"`（`detail: "元の次の一手はやりたいことへ戻しました"`） |
| 8666 | `warn` | `プロジェクトを選択してください` |
| 8678 | `warn` | `やりたいことを選択してください` |
| 8682 | `warn` | `すでに次の一手に設定されています` |
| 8687 | `warn` | `次の一手を入力してください` |
| 8691 | `warn` | `現在の次の一手が変更されたため、内容を確認し直してください` |
| 8700 | `warn` | `以前の実行設定を引き継ぐか破棄するか選んでください` |
| 8706 | `warn` | `現在の次の一手をやりたいことへ戻すことを確認してください` |
| 8716 | `warn` | `blockReason` |
| 8720 | `warn` | `今日の3件で未完了のやりたいことは選べません` |
| 8727 | `warn` | `今日の3件で未完了の次の一手があるため変更できません` |
| 8737 | `warn` | `error instanceof Error ? error.message : String(error)` |
| 8776 | `warn` | `error instanceof Error ? error.message : String(error)` |
| 8797 | `ok` | `次の一手を保存しました`（`detail: result.todayUpdated ? "今日の3件にも反映しました" : undefined`） |
| 8808 | `ok` | `promotingWishlist ? "次の一手にしました" : "次の一手を保存しました"`（`detail: replacingExisting ? "元の次の一手はやりたいことへ戻しました" : undefined`） |
| 8835 | `warn` | `error instanceof Error ? error.message : String(error)` |
| 8841 | `neutral` | `choice === "return" ? "やりたいことへ戻しました" : "次の一手を未設定にしました"` |
| 8888 | `warn` | `reason` |
| 8893 | `warn` | `削除するプロジェクトが見つかりません` |
| 8904 | `danger` | `mode === "complete" ? \`残っている項目を完了扱いにして、プロジェクト「${summary.project.name}」を削除しました\` : \`プロジェクト「${summary.project.name}」を削除しました\`` |
| 8919 | `warn` | `reason` |
| 8924 | `warn` | `削除するプロジェクトが見つかりません` |
| 8958 | `warn` | `元の登録が見つかりません` |
| 8963 | `warn` | `プロジェクト名を入力してください` |
| 8989 | `ok` | `` `${name} を追加しました` `` |
| 8991 | `ok` | `プロジェクトを保存しました` |
| 9005 | `neutral` | `` `今週の重点は最大${WEEKLY_FOCUS_LIMIT}件まで選べます` `` |
| 9017 | `neutral` | `` `今週の重点は最大${WEEKLY_FOCUS_LIMIT}件まで選べます` `` |
| 9047 | `ok` | `次の3件を選べます` |
| 9054 | `warn` | `分数は1以上で入力してください` |
| 9059 | `warn` | `開始時刻はHH:mm形式で入力してください` |
| 9084 | `ok` | `実行記録を追加しました` |
| 9087 | `error` | `` `実行記録を追加できません: ${message}` `` |
| 9107 | `warn` | `日付を入力してください` |
| 9111 | `warn` | `ラベルを入力してください` |
| 9115 | `warn` | `開始時刻を入力してください` |
| 9119 | `warn` | `分数は1以上で入力してください` |
| 9136 | `warn` | `response.warning` |
| 9141 | `ok` | `実行記録を更新しました` |
| 9144 | `error` | `` `実行記録を更新できません: ${message}` `` |
| 9154 | `warn` | `response.warning` |
| 9158 | `neutral` | `実行記録を削除しました` |
| 9162 | `error` | `` `実行記録を削除できません: ${message}` `` |
| 10922 | `error` | `` `手順書を開けません: ${error instanceof Error ? error.message : String(error)}` `` |
| 11216 | `error` | `` `手順書を開けません: ${error instanceof Error ? error.message : String(error)}` `` |
| 15953 | 式 | `ok ? "ok" : "error"` ／ 字は `ok ? "コピーしました" : "コピーできませんでした。テキストを選択してコピーしてください。"` |

`showToast` を props 経由で呼ぶ所（`onNotify`）:

| 呼び出し元 | 渡す色と字 | 場所 |
|---|---|---|
| 取り込みダイアログの「プロンプトをコピー」成功 | `ok` / `"はじめて用のプロンプトをコピーしました"` または `"今の内容を付けてコピーしました"` | `src/components/ImportDialog.tsx:85, 91-98`（`onNotify` の型は `:15`、接続は `src/App.tsx:15984`） |
| 同・失敗 | `warn` / `"プロンプトをコピーできませんでした"` | `src/components/ImportDialog.tsx:87` |

（`showToast` を呼ぶファイルは `src/App.tsx` と `src/components/ImportDialog.tsx`（`onNotify` 経由）だけ。grep で確認。）

### H-3 ダイアログ一覧

#### H-3-1 共通の動き

| 仕組み | 内容 | 場所 |
|---|---|---|
| Esc（全体） | `window` の `keydown` で、`Escape` かつ `completionPrompt` / `confirmDialog` / `earlyStop` が無く、`hasDismissibleModal` が真なら `event.preventDefault()` して `dismissNonCriticalModal()` | `src/App.tsx:4120-4135` |
| `hasDismissibleModal` の対象 | `inboxAddOpen` / `todayPickerOpen` / `inboxEditingIndex !== null` / `helpGuideOpen` / `settingsDraft` / `dropDraft` / `sessionEditDraft` / `manualSessionDraft` / `buttonEditDraft` / `projectEditDraft` / `nextStepEditDraft` / `completionFollowup` / `groupRenameDraft` / `overlayPageDraft` / `groupDraft !== null` | `src/App.tsx:4102-4118` |
| `dismissNonCriticalModal` の順序 | `todayPickerOpen` → `inboxAddOpen` → `inboxEditingIndex` → `helpGuideOpen` → `settingsDraft` → `dropDraft` → `sessionEditDraft` → `manualSessionDraft` → `overlayPageDraft` → `buttonEditDraft` → `projectEditDraft` → `nextStepEditDraft` → `completionFollowup` → `groupRenameDraft` → `groupDraft`。先頭で `sourceEditBusyRef.current \|\| projectEditSavingRef.current` なら何もしない | `src/App.tsx:4017-4076` |
| 最初のフォーカス（共通） | `hasDismissibleModal` / `completionPrompt` / `launcherOverlayOpen` のいずれかがある間、最後の `.modalBackdrop` / `.launcherOverlayBackdrop` の中の `button, input, select, textarea, [tabindex]:not([tabindex="-1"])` の先頭へ `requestAnimationFrame` でフォーカス（既に中にフォーカスがあれば何もしない）。片付け時に opener へ戻す | `src/App.tsx:4137-4202`（フォーカスは `:4160-4164`） |
| Tab の閉じ込め（共通） | 同じ effect の `trapFocus`（先頭で Shift+Tab → 末尾、末尾で Tab → 先頭） | `src/App.tsx:4165-4189` |
| 背景 | `.modalBackdrop { position: fixed; inset: 0; z-index: 35; display: grid; place-items: center; padding: 18px; }` | `src/styles.css:5887-5897` |
| ダイアログ本体 | `.dropDialog { width: min(520px, 100%); max-height: calc(100vh - 36px); display: grid; gap: 16px; }` | `src/styles.css:5899-5904` |

#### H-3-2 `src/App.tsx` のダイアログ

| 名前（`aria-label` / 見出し） | 行 | 最初にフォーカスが行く所 | Esc で閉じるか |
|---|---|---|---|
| `起動辞書`（`<h2>辞書</h2>`） | `src/App.tsx:10137-10151` | 開いたときに `launcherSearchRef.current?.focus()`（検索欄） | 閉じる処理は `handleLauncherOverlayKeyDown` の `Escape`（`:9643-9653`、検索語があれば消すだけ）。**ただしこのダイアログは `{false && launcherOverlayOpen && (` で無効化されており描画されない**（`:10136-10137`） |
| `やりたいこと編集` | `src/App.tsx:13037-13042` | 入力欄の `autoFocus`（`:13051-13057`） | 閉じる（`dismissNonCriticalModal` → `closeInboxEditDialog`、`:4027-4030`） |
| `今日やるものを選ぶ` | `src/App.tsx:13150-13155` | 閉じるボタンの `autoFocus`（`aria-label="今日やるものを選ぶを閉じる"`、`:13163-13173`） | 閉じる（`:4019-4022`。未保存なら確認を挟む `requestCloseTodayPicker` `:3949-3981`） |
| `辞書ページ追加` / `辞書ページ名変更` | `src/App.tsx:13380-13385` | ページ名入力の `autoFocus`（`:13394-13412`） | 閉じる（入力欄の `onKeyDown` で `closeOverlayPageDialog()` `:13408`、全体ハンドラでも `:4051-4053`） |
| `グループ追加` | `src/App.tsx:13443-13448` | グループ名入力の `autoFocus`（`:13457-13472`） | 閉じる（入力欄の `onKeyDown` で `setGroupDraft(null)` `:13466-13468`、全体でも `:4075`） |
| `グループ名変更` | `src/App.tsx:13499-13504` | グループ名入力の `autoFocus`（`:13513-13527`） | 閉じる（`:13524-13526`、全体でも `:4071-4074`） |
| `設定` | `src/App.tsx:13556-13562` | 専用の `autoFocus` は無い。共通処理（`:4160-4164`）で先頭の操作可能要素＝`aria-label="設定を閉じる"` のボタン（`:13568-13576`） | 閉じる（`:4035-4038` → `requestCloseSettings` `:3849`） |
| `実行記録を追加` | `src/App.tsx:14164-14169` | 専用の `autoFocus` は無い。共通処理で先頭の操作可能要素＝「プロジェクト」の `select`（`:14176-14187`） | 閉じる（`:4047-4050`） |
| `実行記録を編集` | `src/App.tsx:14283-14288` | 専用の `autoFocus` は無い。共通処理で先頭の操作可能要素＝「プロジェクト」の `select`（`:14295-14307`） | 閉じる（`:4043-4046`） |
| `ボタン編集`（`<h2>ボタンを編集</h2>`） | `src/App.tsx:14414-14420` | 専用の `autoFocus` は無い。共通処理で先頭＝`aria-label="ボタン編集を閉じる"` のボタン（`:14426-14435`） | 閉じる（`:4055-4058` → `requestCloseButtonEdit` `:3857`） |
| `やりたいことを追加` | `src/App.tsx:14717-14722` | 入力欄の `autoFocus`（`:14751-14770`） | 閉じる（`:4023-4026`） |
| `次の一手を決めますか？` | `src/App.tsx:14822-14828` | 専用の `autoFocus` は無い。共通処理で先頭＝候補の先頭ボタン（`:14838-14853`。候補が無ければ `新しく入力する` `:14855`） | 閉じる（`setCompletionFollowup(null)` `:4067-4070`） |
| `次の一手編集`（`aria-label={dialogTitle}`、`<h2>{dialogTitle}</h2>`） | `src/App.tsx:14942-14948` | `projectLocked` でないときは「プロジェクト」の `select` の `autoFocus`（`:14980-14992`）。`projectLocked` のときは「行動」入力の `autoFocus={nextStepEditDraft.projectLocked}`（`:15180-15193`） | 閉じる（`:4063-4066` → `closeNextStepEditDialog`） |
| `プロジェクトを追加` / `プロジェクトを編集` | `src/App.tsx:15432-15438` | プロジェクト名入力の `autoFocus={projectEditDraft.isNew}`（`:15460-15470`）。既存の編集では `autoFocus` 無し（共通処理で先頭＝`aria-label="…を閉じる"` のボタン `:15447-15456`） | 閉じる（`:4059-4062` → `closeProjectEditDialog` `:2477`） |
| `タイマー満了` | `src/App.tsx:15604-15610` | 専用の `autoFocus` は無い。共通処理で先頭＝`続ける(+15分)` ボタン（`:15627-15629`） | **閉じない**（全体ハンドラが `completionPrompt` のとき早期 return、`:4122-4129`。専用の Esc 処理も無い） |
| `Button Builder` / `ボタン登録`（`<h2>ボタンを追加</h2>`） | `src/App.tsx:15645-15651` | 専用の `autoFocus` は無い。共通処理で先頭＝`builderKind` があるときは「追加元」の `ファイル` ボタン（`:15657-15679`）、無いときは「ラベル」入力（`:15707-15718`） | 閉じる（`:4039-4041` → `setDropDraft(null)`） |
| `リセット前にバックアップしますか？` | `src/App.tsx:15865-15871` | `キャンセル` ボタンの `autoFocus`（`:15909-15917`） | 閉じる（専用の `keydown`（capture）`:4594-4604`。`softwareResetChoiceBusy` の間は効かない） |
| `リセット前にバックアップしますか？` の確認用 `ConfirmDialog` | `src/App.tsx:15922` | `ConfirmDialog` 側（下の表） | `ConfirmDialog` 側 |
| ソフトウェアリセット進行（`<h2 id="software-reset-progress-title">`） | `src/App.tsx:15925-15936` | `softwareResetProgressRef.current?.focus()`（`:4606-4609`） | **閉じない**（Esc 処理なし。`Tab` は `preventDefault` で止める `:15930-15932`） |
| 早期終了の `ConfirmDialog`（`title="今日の分は完了にしますか？"`、`initialFocus="cancel"`） | `src/App.tsx:15962-15976` | `ConfirmDialog` 側（`initialFocus="cancel"` なので `キャンセル` 相当の `未完了のまま終了`） | `ConfirmDialog` 側 |
| `HelpGuideDialog` | `src/App.tsx:15949-15961` | 部品側（下の表） | 全体ハンドラで閉じる（`:4031-4034`） |
| `ImportDialog`（`aria-label="まとめて取り込む"`） | `src/App.tsx:15978-15986` | 部品側（下の表） | 部品側（下の表） |

#### H-3-3 部品側のダイアログ

| 名前 | 実装 | 最初にフォーカスが行く所 | Esc で閉じるか |
|---|---|---|---|
| `ConfirmDialog`（`className="modalBackdrop confirmBackdrop"`、`role="dialog"`、`tabIndex={-1}`、`aria-labelledby` / `aria-describedby`） | `src/components/ConfirmDialog.tsx:150-161` | `initialFocus === "confirm" ? confirmRef : cancelRef`（既定は `"cancel"`、`:42, 65-72`）。押せないときはダイアログ本体 | 閉じる（`document` の `keydown`（capture）で `Escape` → `processing` でなければ `onCancel()`。最前面のダイアログのときだけ効く `:84-99`） |
| `HelpGuideDialog`（`aria-labelledby="help-guide-title"`、`className="dropDialog helpGuideDialog"`） | `src/components/HelpGuideDialog.tsx:258-266` | 見出し `titleRef.current?.focus()`（`:135-139`）。見出しは `tabIndex={-1}`（`:270`） | 専用の Esc 処理は無い（grep で該当なし）。`App` 側の全体ハンドラで閉じる（`src/App.tsx:4031-4034`） |
| `ImportDialog`（`aria-label="まとめて取り込む"`、`className="importDialog"`） | `src/components/ImportDialog.tsx:132-143` | JSON 入力の `textareaRef.current?.focus()`（`:71`） | 閉じる（`onKeyDown` で `Escape` かつ `!busy` → `onClose()`、`:136-141`） |
| `InstructionPicker`（`aria-label="手順書を選ぶ"`） | `src/InstructionPicker.tsx:76-86` | 検索欄 `searchRef.current?.focus()`（`:43`） | 閉じる（`onKeyDown` の `Escape`、`:80-81`） |
| `StartEnvironmentPicker`（`aria-label="開始環境を選ぶ"`） | `src/StartEnvironmentPicker.tsx:165-175` | `cancelRef.current?.focus()`（`:93`） | 閉じる（`onKeyDown` の `Escape`、`:169-170`） |
| `ExpandedTimerOverlay`（`aria-label="拡大タイマー"`） | `src/components/ExpandedTimerOverlay.tsx:69-75` | 閉じるボタン（`closeRef`、`aria-label="メイン画面に戻る（タイマーは続きます）"`）へ `focus({ preventScroll: true })`（`:28-32`, `:80-81`） | 閉じる（`window` の `keydown`（capture）の `Escape`、`:34-49`。ただし `complete` のとき、または `.modalBackdrop` / `.launcherOverlayBackdrop` が画面にあるときは何もしない） |
| `辞書の設定`（`aria-labelledby="dictionary-settings-title"`、`className="dictionarySettingsDialog"`） | `src/components/DictionaryWindow.tsx:1992-2000` | 設定を開いたとき `[role="radio"][aria-checked="true"]` のボタンへフォーカス（`:345-355`） | 閉じる（`Escape` → `closeDictionarySettings()`、`:1281-1286`。矢印キーでダイアログ内のボタンを移動する処理も同じ所 `:1287-1301`） |
| `辞書ページ追加` / `辞書ページ名変更`（`className="dropDialog dictionaryParityDialog"`、見出しは `ページを追加` / `名前を変更`） | `src/components/DictionaryFeatureParityUi.tsx:211-216` | 「ページ名」入力の `autoFocus`（`:230-242`） | 閉じる（`Escape` → `closeRef.current()`、`:54-60`。入力欄側にも `setPageDraft(null)` の処理 `:240`） |
| `ボタン登録`（`className="dropDialog modalLongForm dictionaryParityDialog app-scrollbar"`、見出しは `辞書へ登録`） | `src/components/DictionaryFeatureParityUi.tsx:277-282` | 「ラベル」入力の `autoFocus`（`:296-305`） | 閉じる（同上 `:54-60`） |
| `ボタン編集`（`className="dropDialog editDialog dictionaryParityDialog buttonEditDialog"`） | `src/components/DictionaryFeatureParityUi.tsx:386-390` | 「ラベル」入力の `autoFocus`（`:415-425`） | 閉じる（同上 `:54-60`） |
| `変更を保存しますか？`（`className="dropDialog instructionUnsavedDialog"`） | `src/components/InstructionUnsavedDialog.tsx:66-73` | 「編集を続ける」ボタン（`continueRef`）へ `requestAnimationFrame` でフォーカス（`:29`。`aria-label="編集を続ける"` は `:79`） | 閉じる（`Escape` の処理 `:31`） |
| `手順書操作`（`className="dropDialog instructionOperationDialog"`） | `src/components/InstructionTree.tsx:1561-1567` | 操作名の入力（`operationNameRef`）へフォーカス（`:408`） | 閉じる（`closeOnEscape` は `document` の `keydown`（capture）、`:409-439`） |
| `次の一手に手順書を紐づける`（`className="dropDialog instructionProjectLinkDialog"`） | `src/components/InstructionTree.tsx:1675-1681` | プロジェクト選択（`projectLinkSelectRef`）へフォーカス（`:447`） | 閉じる（`Escape` の処理 `:449`。`!projectLinkSubmittingRef.current` のとき） |

（`src/keyboardNavigation.ts:119-122` は `.modalBackdrop [role="dialog"][aria-modal="true"]` と `.expandedTimer[role="dialog"]` を対象にした処理を持つ。中身は追い切れていない。）

## I. 辞書と検索

### I-1. 辞書（`DictionaryWindow.tsx`・`dictionaryWindow.ts`・`overlayPages.ts`）

#### 別の窓か

- 別の窓。ラベルは `"dictionary"`（`src/dictionaryWindow.ts:13`）。`new WebviewWindow("dictionary", { url: "/?view=dictionary", title: "Life Launcher - Dictionary", width: 760, height: 520, minWidth: 420, minHeight: 300, resizable: true, decorations: false, skipTaskbar: true, parent: "main", focus: false, visible: false, ... })`（`src/dictionaryWindow.ts:196-213`、初期値は `18-22`）。
- 窓の状態（位置・大きさ）は `tauri-plugin-window-state` で保存・復元する。`restoreDictionaryWindowBounds` / `saveDictionaryWindowBounds`（`src/dictionaryWindow.ts:111-122`）、プラグイン設定で `skip_initial_state("dictionary")`（`src-tauri/src/lib.rs:189-192`）。
- 画面の出し分けは URL の `view` で行う。`isDictionaryView()` は `?view=dictionary` のとき真（`src/App.tsx:916-918`）、そのとき `DictionaryWindow` を遅延読み込みして出す（`src/App.tsx:2051-2065`）。読み込み中は `辞書を準備しています`（`src/App.tsx:2061`）。
- メイン窓は辞書が前面のとき薄暗くする: `setDictionaryMainDimmed(true/false)` は `emitTo("main", "dictionary-visibility-changed", ...)`（`src/dictionaryWindow.ts:244-246`）。受ける側は `src/App.tsx:2141-2148`、覆いは `dictionaryMainScrim`（`src/App.tsx:9777-9779`、CSS `src/styles.css:5621-5627`）。
- ウィンドウの権限は別ファイル: `src-tauri/capabilities/dictionary.json`（`core:window:allow-hide`、`allow-set-focus`、`allow-start-dragging`、`allow-start-resize-dragging`、`window-state:allow-save-window-state` など）。
- 辞書の窓は自分で閉じるボタンを持つ（`aria-label="辞書ウィンドウを閉じる"`、`src/components/DictionaryWindow.tsx:1629-1637`）。`onCloseRequested` は閉じずに隠す（`src/components/DictionaryWindow.tsx:385-399`）。「範囲外クリックで閉じる」のロックがあり、`focusLockedRef.current` が偽のとき `onFocusChanged` で隠す（`src/components/DictionaryWindow.tsx:413-435`、保存キー `life-launcher.dictionary-focus-lock` は `95`、読み込み `101-107`、切替ボタン `1613-1628`）。

#### 開き方（`Ctrl+K` はアプリの中か Windows 全体か）

- 両方ある。
- Windows 全体: `launcherHotkey`（既定 `Ctrl+K`）を `tauri-plugin-global-shortcut` で OS に登録し、押されると `launcher-shortcut-toggle` を出す（`src-tauri/src/lib.rs:208-210`、`src-tauri/src/startup.rs:228-233`、既定値 `src-tauri/src/models.rs:784-786`）。受ける側は `toggleDictionaryFromShortcut()` → `toggleDictionaryWindow()`（`src/App.tsx:3548-3558`、`3570-3572`）。表示中かつフォーカス中なら隠す、それ以外は出して前に出す（`src/dictionaryWindow.ts:248-280`）。
- アプリの中: ダッシュボードの `keydown` でも同じホットキーを見ている。`matchesHotkey(event, config?.settings.launcherHotkey)` のとき `toggleDictionaryFromShortcut()`（`isTauri()` かつ `__LIFE_LAUNCHER_VISUAL_QA__` でないとき）。それ以外は旧オーバーレイを開く（`src/App.tsx:5168-5188`）。ホットキーが未設定のときは `Ctrl+K` とみなす（`src/App.tsx:1102`）。入力欄などの上では効かない（`src/App.tsx:5176`、`isEditableTarget` は `1087-1096`）。
- サイドバーの `辞書を開く` ボタンからも開く（`src/App.tsx:9828-9846` → `3538-3547`）。開く関数は「既にあれば出して前に出す／無ければ作る」（`src/dictionaryWindow.ts:189-234`）。
- 辞書ウィンドウの中に `Ctrl+K` を扱う処理は無い。

#### ページの仕組み

- ページのタブは「固定 2 つ + 利用者が作ったページ」で、保存はされない固定分と `config.overlayPages` から組み立てる（`src/components/DictionaryWindow.tsx:498-506`）。固定は `すべて`（キー `fixed:all`）と `未分類`（キー `fixed:unclassified`）（`src/overlayPages.ts:4-5`、`src/components/DictionaryWindow.tsx:501-502`）。利用者のページはキー `custom:<ページID>`（`src/overlayPages.ts:36-38`）。
- ボタンがどのページに入るかは `button.overlayPageId` で決まり、その ID のページが無ければ `未分類` になる（`src/overlayPages.ts:46-62`）。`すべて` は `showInOverlay !== false` の全件（`src/overlayPages.ts:86-97`）。
- ページごとの件数は `getOverlayPageCounts`（`src/overlayPages.ts:99-117`）。タブには名前と件数を出す（`src/components/DictionaryWindow.tsx:1738-1739`）。
- タブの並びは `config.overlayPages` の順。並べ替えはポインタードラッグ（`src/components/DictionaryWindow.tsx:1433-1513`）と右クリックメニュー（`src/components/DictionaryFeatureParityUi.tsx:174-205`）。ページの追加は `aria-label="辞書ページを追加"` のボタン（`src/components/DictionaryWindow.tsx:1743-1752`）。
- ページの切替はタブのクリック（`src/components/DictionaryWindow.tsx:1694-1703`）、`←→`/`Home`/`End`（`1708-1728`）、`Ctrl+Tab`（`1374-1378`）、タブへ 240ms 乗せたときの自動切替（`DICTIONARY_PAGE_HOVER_SWITCH_DELAY_MS = 240`、`99`、`517-539`）。
- 項目（ボタン）の並びは `config.dictionaryOrder`（辞書だけの順）に従い、そこに無いものは `config.buttons` の順で後ろに足す（`src/overlayPages.ts:8-34`）。`dictionaryOrder` はサイドバーの順とは別（スキーマの説明: `src-tauri/src/commands/config.rs:1916-1918`）。
- 表示形式は「タイル」と「リスト」（`src/components/DictionaryWindow.tsx:2017-2042`）、アイコンの大きさは 自動／小／中／大（`2043-2067`）。設定は `localStorage` に保存する（`src/components/DictionaryWindow.tsx:96-97`、`333-343`、読み込み `109-125`）。
- 辞書ウィンドウへのドロップは `parity.onDragOver` / `parity.onDrop`（`src/components/DictionaryWindow.tsx:1573-1574`、ドラッグ中の案内 `ここにドロップして辞書へ登録` は `1795-1799`）。ファイル・フォルダ・URL を落とすと登録のダイアログになる（`1795-1799`、空のときの案内 `ファイル・フォルダ・URLをドロップして登録できます。` は `1967-1974`）。OS からのドロップは Rust 側が窓ラベル `main` と `dictionary` の両方で受ける（`src-tauri/src/commands/main_shell_drop.rs:674`）。

#### 中で探す欄

- ある。`label.dictionarySearchField` の中の `input`（`type="search"`、`aria-label="辞書を検索"`、`placeholder="ラベル・グループ・ページ・キーワードから検索"`、`autoComplete="off"`、`spellCheck={false}`）（`src/components/DictionaryWindow.tsx:1754-1781`）。
- 探す対象は「ラベル・グループ・ページ名・説明・別名（`aliases`）」で、部分一致（大文字小文字を区別しない）。`searchOverlayButtons`（`src/overlayPages.ts:64-84`）。
- 結果は `aria-label="全ページの検索結果"` の `div`（`role="listbox"`）に、`全ページの検索結果` と `{件数}件` を出して並べる（`src/components/DictionaryWindow.tsx:1829-1892`）。1 件も無いときは `該当する項目がありません` と `検索語を変えてください。`（`1888-1891`）。
- 検索は全ページが対象で、いま選んでいるページに限らない（`1837-1840`）。結果の行は `ラベル / ページ名 / グループ名 / 説明 / 別名` を `title` に持つ（`1864-1872`）。
- 検索欄のキー: `↑↓` で結果の選択を動かす（`1338-1347`）、`Enter` で選んだ項目を起動（`1390-1394`）、`Escape` で検索語を消す（もう一度で窓を隠す、`1379-1389`）。検索欄の外で文字を打つと検索欄に入る（`1395-1406`）。
- 窓を出し直したときは検索語を消し、前に見ていたページ・項目・スクロール位置へ戻す（`src/components/DictionaryWindow.tsx:1175-1231`、`1243-1247`）。
- 検索中は並べ替え（タイルのドラッグ）を止める（`src/components/DictionaryWindow.tsx:1156-1158`、`src/overlayPages.ts:125-134` の `searchActive`）。
- 補足: ダッシュボード側にも同じ検索欄があるが、その画面は `{false && launcherOverlayOpen && ...}` の中にあり、実際には表示されない（`src/App.tsx:10137`、検索欄は `10314-10326`、`aria-label="辞書を検索"` は `10318`）。

### I-2. 一手・ボタン・手順書をまとめて探す仕組み

- 一手・ボタン・手順書をまとめて（横断して）探す仕組みは**無い**。
- 近い物（それぞれ別々の対象だけを探す）:

| 探す仕組み | 探す対象 | 場所 |
|---|---|---|
| 辞書ウィンドウの検索 | ボタン（ラベル・グループ・ページ名・説明・別名） | `src/components/DictionaryWindow.tsx:1754-1781`、`src/overlayPages.ts:64-84` |
| ダッシュボードの旧オーバーレイの検索 | ボタン（ラベル・ページ・キーワード）※表示されない死んだ経路 | `src/App.tsx:10314-10326`（`{false && ...}` は `10137`） |
| 手順書一覧の検索 | 手順書のファイル名・フォルダ名（本文は対象外） | `src/components/InstructionTree.tsx:1121-1141`、`643-668` |
| 開始環境を選ぶ画面の検索 | ボタン（名前・カテゴリ） | `src/StartEnvironmentPicker.tsx:213-217` |
| 手順書を選ぶ画面の検索 | 手順書の名前・フォルダ | `src/InstructionPicker.tsx:93-97` |
| 記録ビューの検索 | 実行記録（セッション） | `src/RecordsView.tsx:344`（`aria-label="実行記録を検索"`、`placeholder="検索"`） |
| プロジェクト・次の一手・やりたいこと | 検索の欄は無い。`今日` に追加する画面は候補を一覧で出すだけ（`src/App.tsx:13218-13269`） | — |

- 「次の一手」と「やりたいこと」を探す入力欄は、ダッシュボードにも `今日` に追加する画面にも無い（`src/App.tsx` の `<input>` 50 個のうち、`type="search"` は無く、`aria-label` に「検索」を含むのは死んだ経路の `辞書を検索` だけ）。
- 手順書の本文（`InstructionViewer`）とボタンと一手を同じ語で一度に探す処理・画面は `src` に無い。

## J. 記録の画面と、記録のデータ

### J-1. `src/RecordsView.tsx` の形（タブ・節・行）

`src/App.tsx:2090` の `activeView`（`"main" | "records"`、型は `src/App.tsx:254`）で切り替わり、記録のときは `src/App.tsx:10594-10595` で `<RecordsView …>` を出す。記録を開くと `src/App.tsx:3227-3231` で `refreshRecords()` を呼び、`src/App.tsx:3070-3102` で `loadSessionSummary()`・`loadWeeklyReview()`・`loadNextStepFreshness()`・`loadSessionEntries()` を読む。

外側は `src/RecordsView.tsx:110-411` の `<section className="recordsView" data-skip-target="records" tabIndex={-1}>`。見出しは `src/RecordsView.tsx:112-131` の `<nav aria-label="記録の表示" className="recordsTabs" role="tablist">`。

タブは 3 つで、押すと `src/RecordsView.tsx:97` の `tab` state が変わる（`src/RecordsView.tsx:114-129`）。タブの中身は全部この部品の中にあり、`tab` によって出し分ける。

| タブ | 字 | `value` | class（選んだとき） | 行 | 中身の行 |
|---|---|---|---|---|---|
| ふりかえり | `ふりかえり` | `review` | `recordsTab recordsTab--active` | `src/RecordsView.tsx:115,121` | `src/RecordsView.tsx:133-269` |
| 今週を決める | `今週を決める` | `planning` | 同上 | `src/RecordsView.tsx:116,121` | `src/RecordsView.tsx:271-334` |
| すべての記録 | `すべての記録` | `all` | 同上 | `src/RecordsView.tsx:117,121` | `src/RecordsView.tsx:336-409` |

選んだタブのボタンは `aria-selected={tab === key}`（`src/RecordsView.tsx:120`）、中身は `<div className="recordsTabPanel" role="tabpanel">`（`src/RecordsView.tsx:134,272,337`）。

**ふりかえりタブ**（`src/RecordsView.tsx:133-269`）

| 節 | 行 | 見出し・字 | 中身 |
|---|---|---|---|
| 数字の行 | `src/RecordsView.tsx:135-139` | `今日`・`今週`・`活動日数`（`src/RecordsView.tsx:136-138`） | `class="recordsStats"`。`{n}分`・`{n}日` |
| プロジェクト別（今週） | `src/RecordsView.tsx:141-186` | `h2` `プロジェクト別（今週）`（`src/RecordsView.tsx:143`）、右に日付（`src/RecordsView.tsx:144`） | `class="recordsSection"`。`class="recordsAccordionList"` の中に `article.recordsAccordion`、見出しボタン `class="recordsAccordionSummary"`（`src/RecordsView.tsx:157-168`）。開くと `class="recordsAccordionBody"`（`src/RecordsView.tsx:170-180`）に `div.recordsActionHistoryRow`（日付・実行内容・分）。空は `今週の実行記録はありません。`（`src/RecordsView.tsx:185`） |
| プロジェクト別累計 | `src/RecordsView.tsx:188-246` | `h2` `プロジェクト別累計`、右に `すべての記録`（`src/RecordsView.tsx:189`） | 同じ形のアコーディオン。開いた中は 5 件ずつのページ送り（`HISTORY_PAGE_SIZE = 5` は `src/RecordsView.tsx:48`、ページ計算は `src/RecordsView.tsx:196-198`、`nav` は `aria-label={`${project.label}の履歴ページ`}` で `src/RecordsView.tsx:227-233`）。空は `実行記録はまだありません。`（`src/RecordsView.tsx:245`） |
| 完了した項目 | `src/RecordsView.tsx:248-267` | `h2` `完了した項目`、説明 `今後の候補から外した、完了済みの項目`、右に `{n}件`（`src/RecordsView.tsx:251-252`） | `config.sourceCompletions.length > 0` のときだけ出る（`src/RecordsView.tsx:248`）。`div.sourceCompletionRow` に日付・`次の一手`/`やりたいこと`・プロジェクト名・本文（`src/RecordsView.tsx:256-263`） |

アコーディオンの開閉は `weeklyExpanded`（`src/RecordsView.tsx:98`）と `cumulativeExpanded`（`src/RecordsView.tsx:99`）、ページは `cumulativePages`（`src/RecordsView.tsx:100`）。開いた印は `<UiIcon name={expanded ? "chevronDown" : "chevronRight"} size={16} />`（`src/RecordsView.tsx:163,210`）。

**今週を決めるタブ**（`src/RecordsView.tsx:271-334`）

| 節 | 行 | 見出し・字 | 中身 |
|---|---|---|---|
| 先週のふりかえり | `src/RecordsView.tsx:273-332` | `h2 id="weekly-review-title"` `先週のふりかえり`、右に `{previousWeekStart} - {previousWeekEnd}`（`src/RecordsView.tsx:275`） | `section.weeklyReviewSection` `aria-labelledby="weekly-review-title"` |
| 数字の行 | `src/RecordsView.tsx:277-281` | `合計時間`・`活動日数`・`動かしたプロジェクト` | `class="weeklyReviewFacts"` |
| 動かしたプロジェクト | `src/RecordsView.tsx:282-297` | `h3` `動かしたプロジェクト`、説明 `先週の実行記録に残ったプロジェクト`（`src/RecordsView.tsx:283`） | `div.weeklyReviewProjectRow` に `ProjectIdentity`・`目標: {northStar}`・`{n}回・{n}分`（`src/RecordsView.tsx:287-293`）。空は `先週の実行記録はありません。`（`src/RecordsView.tsx:296`） |
| 今週の重点 | `src/RecordsView.tsx:298-311` | `h3` `今週の重点`、説明 `今週優先して進めるプロジェクトを最大3件まで選びます`、右に `{n}/3`（`src/RecordsView.tsx:300-301`） | `div.weeklyFocusChecklist` に `input type="checkbox"`（`src/RecordsView.tsx:303-309`）。切り替えは `onWeeklyFocusChange`（`src/RecordsView.tsx:306`、実体は `src/App.tsx:9011` の `setWeeklyReviewProjectFocus`） |
| 鮮度レビュー | `src/RecordsView.tsx:312-331` | `h3 id="freshness-title"` `鮮度レビュー`、説明 `次の一手を14日以上更新・確認していないプロジェクト`（`src/RecordsView.tsx:314`） | `staleNextStepProjects.length > 0` のときだけ。`div.freshnessReviewRow` にプロジェクト名・次の一手の文・`次の一手が14日以上同じです`（`src/RecordsView.tsx:317-321`）。ボタンは左から `書き直す`（`mainActionButton mainActionButton--neutral`、`onEditProject`、`src/RecordsView.tsx:323`）・`短時間で試す`（`mainActionButton mainActionButton--positive`、`onTryShort`、`src/RecordsView.tsx:324`）・`このまま`（`mainActionButton mainActionButton--neutral`、`onMarkReviewed`、`src/RecordsView.tsx:325`） |

**すべての記録タブ**（`src/RecordsView.tsx:336-409`）

| 節 | 行 | 見出し・字 | 中身 |
|---|---|---|---|
| 最近の実行記録 | `src/RecordsView.tsx:338-382` | `h2` `最近の実行記録`、右に `実行記録を追加`（`class="sectionLinkButton mainActionButton mainActionButton--gold"`、`onAddSession`、`src/RecordsView.tsx:341`） | 下の絞り込みと一覧 |
| 絞り込み | `src/RecordsView.tsx:343-360` | 検索の欄は `aria-label="実行記録を検索"`・`placeholder="検索"`（`src/RecordsView.tsx:344`） | `期間`（`segmentRow`／`segmentButton`、`今週`・`今日`・`すべて`、`src/RecordsView.tsx:345-351`）と `プロジェクト`（`projectFilterRow`／`filterChip`、先頭 `すべて`、`src/RecordsView.tsx:352-359`） |
| 一覧の行 | `src/RecordsView.tsx:361-381` | — | `article.recentSessionRow.recordsCompactRow`（`tabIndex={0}`、右クリックで `onOpenSessionMenu`、`src/RecordsView.tsx:364-370`）。中は日付・開始時刻・プロジェクト名・実行内容（`recordsCompactAction`）・分・`⋯` ボタン（`aria-label={`${session.date} ${session.label}の操作`}`、`class="sourceRowMenu recordsSessionMenuButton"`、`src/RecordsView.tsx:377`）。空は `条件に一致する実行記録がありません。検索語またはフィルターを変更してください。`（`src/RecordsView.tsx:381`） |
| 以前のメモ | `src/RecordsView.tsx:384-407` | `<summary>` の字は `以前のメモ（{n}日）`、無いときは `以前のメモ`（`src/RecordsView.tsx:391`） | `<details className="recordsSection recordsOlderNotes">`。日ごとに `input` が 3 つ（`aria-label={`${entry.date} できたこと ${index + 1}`}`、`maxLength={120}`、`src/RecordsView.tsx:400`）。空は `以前のメモはありません。`（`src/RecordsView.tsx:406`） |

一覧の行と `以前のメモ` の行は、右クリックのほかに <kbd>ContextMenu</kbd> キーと <kbd>Shift</kbd>+<kbd>F10</kbd> でもメニューが開く（`src/RecordsView.tsx:103-108`）。ページ送りのボタンは `mainActionButton mainActionButton--neutral` で、`‹ 前へ`・数字・`次へ ›`（`src/RecordsView.tsx:228-232`）。

### J-2. `sessions.jsonl` の 1 行の中身

1 行が `SessionLogEntry` を JSON にしたもの（`src-tauri/src/commands/sessions.rs:529-539` で `serde_json::to_string` して 1 行ずつ追記）。型は `src-tauri/src/models.rs:553-567` で、`#[serde(rename_all = "camelCase")]` なので**キーは camelCase**。

| キー | 型 | 意味 | 無いときの扱い（行） |
|---|---|---|---|
| `id` | string（任意） | 実行記録の識別子。`new_session_id()` で作る（`src-tauri/src/commands/sessions.rs:742`） | 無ければ書かない（`skip_serializing_if = "Option::is_none"`、`src-tauri/src/models.rs:556-557`） |
| `date` | string | 記録した日（`YYYY-MM-DD`）。日付の変わり目をまたいだ実行は「終わった日」になる（`src-tauri/src/commands/sessions.rs:1531` のテスト名 `crossing_midnight_session_uses_its_recorded_end_day_without_changing_old_rows`） | 必須 |
| `projectId` | string / null | プロジェクトの `id`。無い記録は `null`（未分類） | 必須（`null` を書く） |
| `label` | string | 実行したときの名前（プロジェクト名か、ボタン名）を保存したもの（`display_session_label`、`src-tauri/src/commands/sessions.rs:711`） | 必須 |
| `startedAt` | string | 開始した時刻（`HH:MM`） | 必須 |
| `minutes` | number | 実行した分数 | 必須 |
| `note` | string | 実行内容の記録。空文字あり | 無ければ `""`（`#[serde(default)]`、`src-tauri/src/models.rs:563-564`） |
| `manual` | boolean | 手で足した記録かどうか | 無ければ `false`（`#[serde(default)]` と `skip_serializing_if = "is_false"`、`src-tauri/src/models.rs:565-566`） |

読む側は、壊れた行があっても止めずに飛ばして数える（`read_session_file`、`src-tauri/src/commands/sessions.rs:578-607`、`invalid_lines_warning` は `:749`）。

### J-3. 「次の一手（またはプロジェクト）が最後に動いた日」は今のデータから出せるか

**出せる。** 使える値は 2 つある。

1. 次の一手そのものの日時。`config.json` の `projects[].nextStep.updatedAt` と `projects[].nextStep.reviewedAt`（RFC3339 の文字列、`src-tauri/src/models.rs:113-116` の `updated_at`・`reviewed_at`、TS 側は `src/types.ts:119-120`）。鮮度レビューは `reviewedAt` を先に見て、無ければ `updatedAt` を使い、14 日以上たっていれば「古い」とする（`project_is_stale_at`、`src-tauri/src/commands/config.rs:2462-2476`）。
   - **書き換えたことが分かる値**: 次の一手を編集して文が変わったときは `updatedAt` が今の時刻になる（`src/App.tsx:8761`）。文が変わらなければ前の `updatedAt` を残す（同 `:8761`、`existing?.updatedAt && text === draft.originalText ? existing.updatedAt : now`）。
   - **「このまま」を押したことが分かる値**: `reviewedAt` が今の時刻になる（`src/App.tsx:7355-7360` の `markNextStepReviewed`）。
   - 次の一手を作ったときは `updatedAt` を入れる（`src/App.tsx:8544`）。
2. 最後に実行した日。`sessions.jsonl` の各行の `date` と `projectId` から、プロジェクトごとの最後の日付が出せる。今のアプリでも `project_totals`（`src-tauri/src/commands/sessions.rs:141`）が `activeDays` を数え、`build_do_now_candidates`（`src-tauri/src/commands/sessions.rs:233`）が最後に実行した日を使って並べている。記録の画面には「最後に実行した日」をそのまま出す欄は無い。

どちらの値も今のデータの形（`config.json`・`sessions.jsonl`）に既にあり、**項目を足さなくても出せる**。ただし `updatedAt`・`reviewedAt` は次の一手ごとの値で、プロジェクト全体の「最後に動いた日」という 1 つの値は無い。

### J-4. 「まとめて取り込む」の、今の状態を付けてコピーする仕組み

| 物 | 場所 | 中身 |
|---|---|---|
| 入口のダイアログ | `src/components/ImportDialog.tsx` | `role="dialog"`・`aria-label="まとめて取り込む"`・`aria-modal="true"`（`src/components/ImportDialog.tsx:132-142`）。閉じる `×` は `aria-label="まとめて取り込むを閉じる"`（`src/components/ImportDialog.tsx:151-159`） |
| 今の状態を作る関数 | `src/importCurrentState.ts:4-27` `buildImportCurrentState(config)` | 設定が無いときは `(まだ何もありません)`（`:5`・`:26`）。あるときは、プロジェクトごとに `名前(色: colorId)`（`:8`）・`目標: …`（`:10`）・`次の一手: …`（`:12`）・`やりたいこと: a / b`（`:17`）を並べ、プロジェクトに属さないやりたいことを `プロジェクトなしのやりたいこと: …`（`:24`）として最後に足す。区切りは改行（`:26`） |
| コピーのボタン | `src/components/ImportDialog.tsx:181-201` | 左が `はじめて用をコピー`（`class="secondaryButton"`、`copyFirstPrompt`、`:181-188`）、右が `今の内容を付けてコピー`（同じ class、`copyRepeatPrompt`、`:190-197`）。右のボタンの下に説明 `コピーする文には、今のプロジェクト名・目標・次の一手・やりたいことが入ります。`（`:198-200`） |
| はじめて用の中身 | `src/content/importPrompt.ts:1-37` `IMPORT_PROMPT_FIRST` | AI に渡す指示と JSON の形。`"lifeLauncherImport": 1`（`:16`）、`"trigger"` は「いつ・どこで」（`:17`）、`"color"` の一覧（`:18`）、形式は `projects[].name`・`color`・`goal`・`nextStep{text,trigger,minutes,shortMinutes}`・`wishes` と、プロジェクトに属さない `wishes`（`:22-34`） |
| 今の内容を付ける中身 | `src/content/importPrompt.ts:39-71` `IMPORT_PROMPT_REPEAT` | ひな形の `{CURRENT_STATE}`（`:68`）を今の状態で置き換える（`src/components/ImportDialog.tsx:96`）。文面は「今の内容にあるものは、もう一度書かない」（`:49`）・「今あるプロジェクトに足すときは "name" を今の名前と一字一句同じにする」（`:50`）・「すでに次の一手があるプロジェクトには "nextStep" を書かない」（`:51`）・足す上限（`:53`）など |
| コピーの実行と知らせ | `src/components/ImportDialog.tsx:82-98` | `navigator.clipboard.writeText`（`:84`）。成功は `onNotify("ok", …)` でトースト `はじめて用のプロンプトをコピーしました`（`:92`）／`今の内容を付けてコピーしました`（`:97`）、失敗は `onNotify("warn", "プロンプトをコピーできませんでした")`（`:87`） |
| 取り込みの欄 | `src/components/ImportDialog.tsx:165-177` | `textarea` の `aria-label="取り込みのJSON"`・`class="textInput importTextarea"`・`placeholder='{"lifeLauncherImport": 1, "projects": [], "wishes": []}'`（`:174`） |
| 取り込みのボタン | `src/components/ImportDialog.tsx:348-358` | 左が `取り込む`（`class="secondaryButton importDialogCommitButton"`、`:348-355`）、右が `キャンセル`（`class="dangerButton importDialogCancelButton"`、`:356-358`） |

## K. 何も無いときと、はじめての起動

### K-1 `config.json` が無い・空のときに出る画面

読み込み側（`src-tauri/src/commands/config.rs` の `load_config_from_disk`）

| `config.json` の状態 | 行 | 返る内容 | 画面 |
| --- | --- | --- | --- |
| ファイルが無い | 571-585 | `initial_config()` を作ってその場で書き出す（`write_config`）。`error: None`、`save_blocked: false`、`changed: true` | エラーの帯は出ない。中身が空の通常のメイン画面 |
| 0 バイト / JSON として壊れている | 589-603 | `config: initial_config()`、`error: Some("config.json is not valid JSON: {error}")`、`save_blocked: true`。**ファイルは書き換えない** | 知らせの帯にその英語の文が出る（`src/App.tsx:10579-10592`）。保存は止まる（`src/App.tsx:3292-3296`） |
| JSON だが object でない | 609-620 | `error: Some("config root must be an object")`、`save_blocked: true` | 同上 |
| `{}`（object だが `version` が無い） | 605-608, 645-658, 708-712 | `error: Some("config version is missing or invalid")`、`save_blocked: true` | 同上 |
| `version` が 4 以上 | 716-719 | `error: Some("config version {raw_version} is newer than this app supports")`、`save_blocked: true` | 同上 |
| 読み込みそのものが失敗（コマンドが例外） | `src/App.tsx:3147-3155` | `config` は `null` のまま、`banner` にメッセージ、`loading` を false に | `設定を読み込めませんでした`（後述） |

初期設定の中身（`src-tauri/src/models.rs:839-859` の `initial_config`）: `groups` / `buttons` / `projects` / `inbox` / `today.items` はすべて空、`today.victory` は既定値、`settings` は `default_settings()`（817-837）。既定値は `default_timer_minutes = 25`、`short_timer_minutes = 5`、`day_start_hour = 4`、`backup_keep = 30`、`mini_mode = true`、`auto_start = false`、`always_on_top = false`、`main_display_size = None`（定数は `src-tauri/src/models.rs:8-11`、817-837）。

画面（`src/App.tsx`）

| 画面の状態 | 行 | 出る文・見え方 |
| --- | --- | --- |
| 読み込み中 | 9281-9287 | `<main className="appShell appShell--loading">` に `<div className="loadingMark" />` だけ。文字は無い |
| `config` が `null` のまま | 9289-9295 | `<main className="appShell">` の `<section className="emptyState">設定を読み込めませんでした</section>` |
| 初期設定で進んだ場合の全体 | 9714-15987 | `appShell appShell--dashboard`。以降の節が空の状態で並ぶ |

空のときに各節へ出る文（初期設定のまま起動した場合）

| 部分 | 行 | 出る文・見え方 |
| --- | --- | --- |
| 上の段の見出し | 10460-10465 | `今日 0分`（`todaySessionMinutes` の初期値が 0（2082）、`todaySessionDate` が空（2083）なので `topMenuMinutes` は 0（2113-2114）、`displayedTodayMinutes`（9451））。日付は `formatDateKeyForHeader(displayedDayKey)`（10468） |
| サイドバー: クイック起動 | 9849-9852 | `サイドバー表示の項目がありません。アプリ、ショートカット、URLをドラッグして追加できます。`（`quietText quietText--small`） |
| サイドバー: タイマー | 10029-10133 | 待機で `通常タイマー`（10052）。分数は `config.settings.defaultTimerMinutes`（既定 25）で、`aria-label="通常タイマーの分数"` の入力欄（10080, 10106）と `-` / `+`（10082-10128） |
| 今日の勝利条件 | 10624-10716 | 枠に `victoryBar--empty`（10628）。ラベル `今日の勝利条件`（10650）。入力の `placeholder="今日はこれができれば勝ち"`（10664）／ボタンの文言も同じ（10685）。チェックは `disabled={!victoryText}`（10645）。候補の列は `!victoryText && victorySuggestions.length > 0` のときだけ（10688）で、初期設定では `morning_victory_suggestion` が `None`（`src-tauri/src/commands/config.rs:583`、算出は 1685-1698）なので出ない |
| 今やる一手 | 10718-10980 | 見出し `今やる一手`（10939）。`プロジェクトを作り、次の一手を設定すると提案されます。`（10948）。説明 `迷ったときに、今の状況から始めやすい「次にやることを1つだけ提示します。`（10953）。ボタン `プロジェクトを追加`（10974）。プロジェクトはあるが次の一手が無いときは `次の一手を設定すると、ここに提案されます。`（10947）とボタン `次の一手を設定`（10974） |
| 今日の3件 | 10982-11554 | 見出し `今日の3件`（10996）、`0件`（10999）、説明 `今日やると決めたもの。タイマーから開始します。`（11012）。空表示は `今日やるものを選びましょう`（11046）/ `次の一手・やりたいことから選べます`（11047）/ ボタン `今日やるものを選ぶ`（11054） |
| 次の一手 | 11557-11961 | 見出し `次の一手`（11600）、`0件`（11603）、説明 `迷ったときに戻る再開地点。プロジェクトごとに1つだけ設定。`（11605）。空表示は `プロジェクトを設定しましょう`（11666）/ `取り組みたいことをまとめると、次の一手を決められます`（11667）/ ボタン `プロジェクトを設定`（11674） |
| やりたいこと | 11963-12457 | 見出し `やりたいこと`（11998）、`0件`（12001）、説明 `他にやりたいこと。今日やるものは「今日の3件」から選べます。`（12003）。中身は初期状態で閉じている（`inboxOpen` の初期値 `false`: 2172）ので、開いたときだけ `やりたいことを設定しましょう`（12061）/ `あとでやりたいことを登録して、今日やる候補にできます`（12062）/ ボタン `やりたいことを追加する`（12070） |
| 今日の実行 | 12459-12518 | 見出し `今日の実行`（12474）、`0件`（12477）、説明 `タイマーで実行した内容`（12478）、`自動`（12479）。中身は初期状態で閉じている（`todayActivityOpen` の初期値 `false`: 2186）ので、開いたときだけ `今日はまだ実行記録がありません。`（12514） |
| 記録の画面 | 10594-10621（本体は `src/RecordsView.tsx`） | 週の実行記録 `今週の実行記録はありません。`（`src/RecordsView.tsx:185`）、積み上げ `実行記録はまだありません。`（245）、先週 `先週の実行記録はありません。`（296）、絞り込み `該当する実行記録はありません。`（177, 225）、検索 `条件に一致する実行記録がありません。検索語またはフィルターを変更してください。`（381）、メモ `以前のメモはありません。`（406） |
| 並べ替えの読み上げ | 12525-12527 | `aria-live="polite"` の領域。空のときは何も出ない |

自動で開くもの（事実）

| 対象 | 行 | 内容 |
| --- | --- | --- |
| 使い方（`HelpGuideDialog`） | 2279 / 10548-10556 / 15949-15961 | `helpGuideOpen` の初期値は `false`。`true` にするのは上部メニューの「使い方」ボタン（10550）だけ。閉じるのは 4032 と 15951。`HelpGuideDialog.tsx` 自身にも自動で開く処理は無い（`onClose` と `onCopyResult` を受け取るだけ: `src/components/HelpGuideDialog.tsx:11-14`） |
| キー割り当て | `src/App.tsx` | `"F1"` は出てこない（grep で 0 件）。使い方を開くキーは無い |
| 設定 | 2254 / 13553 | `settingsDraft` の初期値は `null`。設定を開くのは上部メニューの「設定を開く」ボタン（10559、`openSettingsCenter` 3792）だけ（grep で `openSettingsCenter` の使用は 3792 と 10559 の 2 箇所） |
| 初回起動専用の画面・案内 | `src/App.tsx` | 「ようこそ」「初めて」「firstRun」に当たる文字・状態は無い（grep で 0 件）。`config.json` が無くても、初回だけ出る画面や自動で開くダイアログは無く、空のメイン画面がそのまま出る |
| 空のときの自動動作 | 10998 / 11043 / 11658 / 11663 / 12058 | `config.today.items.length === 0` / `config.projects.length === 0` / `config.inbox.length === 0` は空表示の出し分けにだけ使われ、ダイアログを開く処理は無い |

`save_blocked: true` のときの保存

| 場所 | 行 | 内容 |
| --- | --- | --- |
| 保存の入口 | 3292-3296 | `configSaveBlockedRef.current` が真なら `設定ファイルに問題があるため、元データを保護して保存を停止しています` を `banner` とトースト（`error`）に出し、`false` を返して保存しない |
| フラグの設定 | 3129（読み込み成功時）、3148（読み込み例外時）、4366、4775 | `response.saveBlocked` をそのまま入れる |

## L. 見本の要素ごとの対応表

見本はリポジトリ外の `handoff/mocks/` の HTML（`Main.html` ほか）。行番号はその HTML の行。今のアプリ側は行番号を実際に開いて確認した。`src/App.tsx` は 15,989 行、`src/styles.css` は 13,074 行。

| # | 見本の要素 | 今ある/近い物がある/無い | 場所（ファイル:行） | クラス・関数・補足 |
|---|---|---|---|---|
| L1 | 上の段の真ん中の検索の欄（Ctrl+F）（`Main.html`:122） | 無い | —（該当なし） | `className="topBar"` の中は `.topSummary`（h1＋日付）・`.topPills`・`WindowControls` の3つだけ（`src/App.tsx:10459-10569`）。`検索` は `src/App.tsx` に16件あるが、辞書ウィンドウ（`src/components/DictionaryWindow.tsx:1754-1781`）と記録ビュー（`src/RecordsView.tsx:344`）だけ。Ctrl+F は `matchesHotkey`（`src/App.tsx:1098-1115`）にも `src-tauri` にも無い。 |
| L2 | 上の段の自動起動（アイコンだけ・ON は緑と点）・記録・手順書・設定（`Main.html`:123） | 今ある（自動起動は文字つきで、アイコンだけの見た目は無い） | `src/App.tsx:10472-10567` / `src/styles.css:3359-3447` | 自動起動 `viewToggleButton viewToggleButton--active`＋`UiIcon name="power"`＋`viewToggleButtonLabel`「自動起動」。`aria-pressed` は無く、`aria-label` と `title` は `Windows自動起動: ON` / `: OFF`（10485-10488）。記録 `data-view-toggle`（10520）、手順書（10531-10540）、設定（10557-10566）。**同じ段に「使い方」も在る**（10547-10556）。文字は `TOP_MENU_LABELS`（`src/App.tsx:454-472`）、幅で文字を隠す段階は `data-top-menu-labels`（10456）と `hideLabelsIn`（`src/topMenuLabels.ts:34-44`）。テストは `title` と名前に依存（`tests/visual/phase97-toast-colors.spec.ts:33-34`）。 |
| L3 | サイドバーの一番上の「辞書を開く Ctrl K」（`Main.html`:129-133） | 今ある | `src/App.tsx:9828-9846` / `src/styles.css:2476-2547` | `launcherOpenButton` / `launcherOpenButtonLabel` / `launcherOpenButtonIcon`（`UiIcon name="search"`）/ 文字「辞書を開く」/ `ShortcutBadge`（`<kbd class="shortcutBadge">`、`src/components/ShortcutBadge.tsx:15-22`）。キーの初期値は Ctrl+K（`src/App.tsx:1102`、`src-tauri/src/models.rs:784`、`src-tauri/src/commands/config.rs:2159`）。テスト: `.launcherOpenButton .shortcutBadge` が `Ctrl+K`、色 `rgb(231,185,77)`、枠 `rgba(231,185,77,0.48)`、`font-weight 820`（`tests/visual/phase87-followup-polish.spec.ts:150-157`）、アイコンの枠 28px・`.uiIcon` 22px（同 110-128）。 |
| L25 | サイドバーの見出しの開け閉め（今のまま残す）（`Main.html`:134-155） | 今ある（**マウスのクリックでは開け閉めしない。キーボードだけ**） | 状態 `src/App.tsx:2237-2238`、保存 `1160-1171`、切替 `4852-4858`、見出し `9886-9919` | 状態は `collapsedGroups`（`Record<string, boolean>`）。保存先は `window.localStorage` の `life-launcher.sidebar-groups`（`src/constants.ts:10`、`readCollapsedGroups`/`writeCollapsedGroups`）。見出しは `button.quickGroupHeader`、`aria-expanded={!collapsed}`、`UiIcon chevronRight/chevronDown`、`<strong>{group.name}</strong>`、`<small>{group.buttons.length}</small>`。件数は「件」を付けない数字だけ（`src/styles.css:2603-2607` で右寄せ）。`onClick` は `event.detail === 0` のときだけ切替（9890-9892）＝マウス押下は並べ替えドラッグ（9909-9912）。詳細は下の L25 の表。 |
| L4 | 日付と曜日の表示（`Main.html`:163-166） | 今ある（1つの文字列で、上の段に在る） | `src/App.tsx:10467-10470` / `1130-1146` / `src/styles.css:3352-3357` | `formatDateKeyForHeader` が `11月15日 日曜日` の形で返す（`11月15日` と `日曜日` を別要素には分けない）。置き場所は `.topSummary` の中の `span.topDateLabel`（12px・`var(--muted)`）。見本は本文の左上で、日付 22px＋曜日 13px。 |
| L5 | 今日の勝利条件の欄（チェックつき）（`Main.html`:167-172） | 今ある | `src/App.tsx:10624-10716` / `src/styles.css:3849-3884`・`11212-11251` | `section.victoryBar`（`aria-label="今日の勝利条件"`）、`victoryIcon`（🏆）、`input.check.victoryCheck`（`aria-label="勝利条件を達成"`）、`victoryLabel`「今日の勝利条件」、`victoryTextButton` / `victoryInput`（`aria-label="今日の勝利条件"`、placeholder「今日はこれができれば勝ち」）、`victorySuggestions` / `suggestionChip`、達成時 `victoryBadge`「✓ 今日の勝利、達成」。見本の「英語を1回やる」に当たる所は `config.today.victory.text`。 |
| L6 | 今やる一手の大きな札（`Main.html`:175-196） | 近い物がある（**「一緒に開く物」の札は無い**） | `src/App.tsx:10718-10980` / `src/styles.css:3997-4275` | 札は `section.doNowBand`＋`div.doNowContent`（`data-project-color` で左3px、`src/styles.css:4077-4085`）。プロジェクト名 `doNowProjectChip`＋`ProjectIdentity`（10787-10794）、行動の文 `<strong title>`（10811-10813）、きっかけ `doNowMetaItem doNowTrigger`＋`UiIcon name="external"`（10823-10831）、理由 `doNowReason`（10832）。ボタンは `doNowStartPrimary`（`{doNowShortTimerMinutes}分で始める`、`aria-label="短時間タイマー5分で始める"`）・`doNowStartSecondary`（`通常 {n}分`）・`doNowMeasureButton`（`計測`）（10875-10911）、`doNowAlternateButton`「他の一手」は候補が2件以上のときだけ（10834-10843）。`nextStep.buttonIds` は開始時に開くだけで、札としては出ない（`startDoNowProject` 9551-9570）。 |
| L7 | 今日の3件の札（`Main.html`:198-205） | 近い物がある（**「いまここ」は無い**） | `src/App.tsx:10982-11554` / `src/styles.css:8348-8392`・`8522-8666`・`8975-9023` | 見出し `todaySectionBar`／`todaySectionDisclosure`（`aria-expanded`）／`todaySectionCount`「0件」／`todayCompletionSummary`「{n} / {n} 完了」／`todaySectionDescription`「今日やると決めたもの。タイマーから開始します。」（10982-11014）。札 `article.todayRow`＋`data-project-color`（上2px は `border-top`、`src/styles.css:8571-8573`）。完了は `todayCompletionStatus`（`✓`/`○`、`aria-label="今日の分は完了"`/`"未完了"`）・`todayTextButton--done`・`todayCompletedLabel`「今日の分は完了」（11151-11203、11281-11282）。点線の札は `todayPickerEntry`／`todayPickerEntryVisual`「今日やるものを選ぶ」（11452-11465）。実行中は `runningBadge`「実行中／一時停止／計測中」（11179-11193）で、「いまここ」の字は無い。開始は `todayStartButton--short`（`{shortMinutes}分`）・`--normal`（`{defaultMinutes}分`）・`todayMeasureButton`（11330-11445）。 |
| L8 | 次の一手の行（`Main.html`:207-215） | 近い物がある（**1列の行ではなく3列のカード。**「小さくする」は無い） | `src/App.tsx:11557-11961` / `src/styles.css:9994-10237` | `section.projectsBand`＋`disclosureHeader`（`disclosure` / `disclosureCount`「{n}件」/ `disclosureDescription` / `＋ プロジェクト` / `…`）。1件は `article.nextStepCard.nextStepRow.sourceListRow`、左3px は `::before`（10031-10037）、並びは `grid-template-columns: repeat(3, …)`・高さ112px（10003-10013）。`＋ 今日へ` は `nextStepTodayAdd`（11817-11841、使えない理由は `title`）。次の一手が無いときは `projectNextStepPlaceholder`「まだ次の一手がありません」（11802・11813）＋`nextStepRowAction--set`「次の一手を設定」（11858-11870）。**見本の「次の一手を決める」に当たる字は「次の一手を設定」**。`小さくする` は `src` に0件（`このまま` は記録ビューだけ `src/RecordsView.tsx:325`）。 |
| L9 | しばらく動いていない一手の知らせ（`Main.html`:213） | 無い（メイン画面）。記録ビューに近い物がある | `src/RecordsView.tsx:312-331` / `src-tauri/src/commands/config.rs:2462-2476` / `src/App.tsx:2621-2627`・`3065`・`3094` | 記録の「鮮度レビュー」＝`freshnessReview`、見出し「鮮度レビュー」、説明「次の一手を14日以上更新・確認していないプロジェクト」、行の文「次の一手が14日以上同じです」、ボタン「書き直す」「短時間で試す」「このまま」（`mainActionButton--neutral`/`--positive`）。判定は `project_is_stale_at`（`reviewed_at` ?? `updated_at` から14日）。見本の「12日動いていません」「大きすぎるかもしれません」「小さくする」「このまま」の字はメイン側のコードに無い（「このまま」は `RecordsView.tsx:325` だけ）。 |
| L10 | やりたいことの節（`Main.html`:215、`Wishlist.html` 全体） | 今ある（D24〜D26 の3つは無い） | `src/App.tsx:11963-12457` / `src/styles.css:10551-10645` / `src/nextStepWishlist.ts:11-54` | 見出しは `disclosureHeader`＋`data-inbox-header`、`disclosure`、`disclosureCount`「{n}件」、`disclosureDescription`「他にやりたいこと。今日やるものは「今日の3件」から選べます。」、`＋ やりたいこと`、`…`（11972-12041）。まとまりは `section.wishlistGroup`（`data-wishlist-group`、`wishlistGroup--unassigned`）、見出し `wishlistGroupHeader`（`ProjectIdentity` か `<strong>未分類</strong>`、`aria-expanded`、`{n}件`、`title` に並べ替えの説明）（12113-12168）。行は `div.inboxRow.sourceListRow`（左3px は `border-left: 3px solid var(--project-color)`、`src/styles.css:10607-10618`）、文字 `inboxItemText`、`wishlistRowActions`、`sourceRowMenu`「…」、`wishlistNextStepAction`「▷ 次の一手を設定」、`wishlistNextStepStatus`「✓ 次の一手に設定済み」、`wishlistTodayStatus`「✓ 今日の3件に設定済み」（12195-12310）。右クリックの「次の一手にする」は `kind: "inbox"` のメニュー（12802-12807）。D24〜D26 用の値は下の L10 の表。 |
| L11 | 今日の実行の一覧（`Main.html`:218-229） | 近い物がある（**行動の文の列が無い。合計の「5分 ・ 1回」も無い**） | `src/App.tsx:12459-12518` | `section.todayActivityBand`＋`disclosure`/`disclosureLabel`「今日の実行」/`disclosureCount`「{n}件」/`disclosureDescription`「タイマーで実行した内容」/`todayActivityAutoBadge`「自動」。行は `todayActivityRow`＝`todayActivityIdentity`（`ProjectIdentity` か `todayActivityDot`＋`session.label`）＋`todayActivityStartedAt`（時刻）＋`<strong>{minutes}分</strong>`。行動の文（見本の「机の上を5分だけ整える」）は出ない。0件は `quietText`「今日はまだ実行記録がありません。」 |
| L12 | サイドバーの下の「タイマーだけ使う」（`Main.html` に該当なし） | 無い | サイドバー最下段は `src/App.tsx:10029-10133` | `タイマーだけ` はリポジトリ全体で0件。見本 `Main.html` にも「タイマーだけ使う」の字は無い（grep 0件。サイドバーの下は `section.ll-dock` だけ、`Main.html`:156）。近い物: 上の段の「ミニタイマーへ切り替え」（`src/App.tsx:10494-10511`、`toggleMiniMode`）と設定の「ミニタイマーを使う」（`src/App.tsx:13751-13760`、`settingsDraft.miniMode`）。 |
| L13 | 実行中の画面（`Running.html`:32-76） | 専用の画面は無い。近い物＝拡大タイマー | `src/components/ExpandedTimerOverlay.tsx:66-117` / 呼び出し `src/App.tsx:15574-15599` / 上端の線 `src/App.tsx:9725-9741` | 画面は main / records / mini / dictionary / instruction の5つだけ（`src/App.tsx:2057-2064`）。拡大タイマーは `expandedTimer`（`role="dialog"`、`aria-label="拡大タイマー"`）、`expandedTimerEyebrow`「Timer」、`expandedTimerClose`「戻る」（`aria-label="メイン画面に戻る（タイマーは続きます）"`）、`expandedTimerIdentity`、`expandedTimerTask`、`expandedTimerState`「実行中／一時停止中／時間になりました」、`expandedTimerClock`（`clamp(54px,17cqi,230px)`、`src/styles.css:3002-3011`）、`expandedTimerProgress`、`expandedTimerActions`（`secondaryButton` の「一時停止／再開」と `secondaryButton--finish`「終了」）、`expandedTimerHint`「Escで戻る（タイマーは継続します）」。上端3pxの線は `windowTimerLine`／`windowTimerLineGroove`／`windowTimerLineFill`（`--paused` あり、`src/styles.css:12833-12867`）。**「終わる時刻」「開いたもの」「Space」は無い**（`終わ` 0件、`Space` で止める処理は無い）。 |
| L14 | 終わりの確認（`Done.html`:18-48） | 近い物がある（2つのダイアログに分かれている） | 時間になったとき `src/App.tsx:15601-15640`、終わったあと `src/App.tsx:14819-14882` | (1)「タイマー満了」ダイアログ: `dropDialog timerCompleteDialog`、`eyebrow`「Timer Complete」、`ProjectIdentity`、`h2.timerCompleteHeading`、`timerCompleteText`「予定時間になりました」、`dialogActions` の「続ける(+15分)」「終わる」。(2)「次の一手を決めますか？」ダイアログ: `dropDialog completionFollowupDialog`、`eyebrow`「Next Step」、`h2`「次の一手を決めますか？」、`dialogLead`「{プロジェクト名}のやりたいこと」、`completionFollowupChoices` の `completionFollowupChoice`＋`completionFollowupRadio`（同じプロジェクトのやりたいこと）、`completionFollowupChoice--new`「新しく入力する」、`dialogCancelButton`「今は決めない」。**見本 `Done.html` には「できたこと」の欄も「もう5分続ける」も無い**（在るのは「次はどこから始めますか」の5択と「決定」「閉じる」）。コード側に「できたこと」の欄は無い。 |
| L15 | 今日やるものを選ぶ（`Picker.html`:39-80） | 今ある（**上が3枠・下が候補。左右2列ではない**） | `src/App.tsx:13147-13370` | `dropDialog todayPickerDialog`（`aria-label="今日やるものを選ぶ"`）、`eyebrow`「Today」、`h2`「今日やるものを選ぶ」、`todayPickerIntro`「上の「今日の3件」に、下の候補から追加します。」、`todayPickerDestination`（`todayPickerProgress` は `role="progressbar"`、`todayPickerCounter`「{n} / 3」「あと{n}件」、`todayPickerSlots`、`todayPickerSlot--selected`〔`todayPickerSelectedStatus`「✓ 選択済み」は `src/App.tsx:9389`〕、空きは `todayPickerSlot--empty`「空き {n}」）、`todayPickerSource`（`todayPickerSourceTabs` の「次の一手 {n}件」「やりたいこと {n}件」、`todayPickerList`、`todayPickerWishlistGroup*`）、下は `todayPickerConfirmButton`「決定」と `todayPickerCancelButton`「キャンセル」。見本の「3件まで。決めたら、あとは始めるだけです」「残りは明日に繰り越されません」「ドラッグで順番を変えられます」の字は無い（ピッカー内のドラッグ並べ替えは無い）。 |
| L16 | 検索の窓（`Palette.html`:18-48） | 無い | 近い物 `src/components/DictionaryWindow.tsx:1754-1781` / `src/App.tsx:10317-10327` / `src/RecordsView.tsx:344` | 辞書の検索は `dictionarySearchField`＋`dictionarySearchInput`（`aria-label="辞書を検索"`、placeholder「ラベル・グループ・ページ・キーワードから検索」）でボタンだけ。`launcherSearchInput`（`aria-label="辞書を検索"`、placeholder「ラベル・ページ・キーワードで検索」）は `{false && launcherOverlayOpen && (`（`src/App.tsx:10137`）の中にあり、画面には出ない。記録は `textInput`「実行記録を検索」。一手・ボタン・手順書・操作を1つの一覧にする窓は無い。見本の下の行「何も打たなければ「今やる一手」が先頭に出ます」（`Palette.html`:45）に当たる物も無い。 |
| L17 | ミニタイマー（`Mini.html`:17-30） | 今ある（線の位置と中身が違う） | `src/App.tsx:1933-2043` / `src/components/TimerPanel.tsx:66-155` / `src/styles.css:2216`・`2731-2790` | `main.miniShell`、`miniTopline`「ミニタイマー」、`miniToplineActions`、`miniExpandButton`（`aria-label="メイン画面に戻る"`）、`miniCloseButton`（`aria-label="ミニ画面を閉じる"`）、その下に `TimerPanel variant="mini"`（`timerPanel timerPanel--mini`＋`--active`/`--idle`）。中は `timerMeta`「タイマー」＋`ProjectIdentity`＋`timerActionText`、`timerStateBadge`「実行中／一時停止中／計測中／待機中」、`timerClock`（30px、`src/styles.css:2762-2765`）、`timerProgress`、`timerControls`、待機中は `miniQuietText`。見本の上端の進み具合の線は、今は枠の中の `timerProgress`（3px、`TimerPanel.tsx:133-137`）で、枠の上端ではない。テスト: `tests/visual/phase9-mini-idle.spec.ts:48-56`・`77-86`、`tests/visual/phase9-timer-action-text.spec.ts:170-175`。 |
| L18 | はじめての起動（`FirstRun.html`:46-88） | 無い | 近い物 `src/App.tsx:10941-10977`・`11044-11057`・`11664-11677`・`12059-12073` / `src/components/ImportDialog.tsx:180-201` | 初回だけ出す画面・設定の印は無い（`firstRun` はリポジトリ全体で0件、`src-tauri` にも無い）。空のときの案内は「今やる一手」の `doNowEmpty`（「プロジェクトを作り、次の一手を設定すると提案されます。」＋「プロジェクトを追加」）、今日の3件の `todayEmptyState`（「今日やるものを選びましょう」）、`sectionEmptyState`（「プロジェクトを設定しましょう」「やりたいことを設定しましょう」）。「プロンプトをコピー」に当たる物は `ImportDialog` の「はじめて用をコピー」「今の内容を付けてコピー」（`copyFirstPrompt`/`copyRepeatPrompt`、`src/components/ImportDialog.tsx:82-98`）、入口は「次の一手」の右クリック「まとめて取り込む」（`src/App.tsx:12950`）。 |
| L19 | （不採用。調べなくてよい） | 不採用 | — | 不採用。 |
| L20 | 右クリックのメニュー（`ContextMenu.html`:92-105、`Menus.html`:21-31・37-47・53-62） | 今ある（**右端のキー表示は無い**） | `src/components/ContextMenu.tsx:16-21`・`114-151` / `src/styles.css:5554-5617` / 項目 `src/App.tsx:12599-13000` | `ContextMenu` は `div[role="menu"]`＋`aria-label`、項目は `ContextMenuItem`＝`button[role="menuitem"]`。Esc・↑↓・Home・End・画面外へはみ出さない処理あり（42-54、77-138）。`ariaLabel` は「操作メニュー」（`src/App.tsx:12601`）。項目: サイドバーのボタン（上へ移動／下へ移動／編集／エクスプローラーで表示する／辞書に移動／削除、12644-12710）、今日の3件（編集／左へ移動／右へ移動／今日の3件から外す、12711-12785）、やりたいこと（次の一手にする／上へ移動／下へ移動／編集／完了にする／削除、12786-12862）、次の一手（プロジェクトを編集／次の一手を編集／別の行動に入れ替える／次の一手を未設定にする／プロジェクトを削除…、12863-12921）、まとまり（プロジェクトを編集／プロジェクトを管理／プロジェクトを削除…、12922-12944）、節の見出し（プロジェクトを追加／まとめて取り込む、12945-12953）。キーの札（Enter・F2・T・Delete）はメニューに無い（`<kbd>` は `ShortcutBadge` と設定の記録欄 `src/App.tsx:13897` だけ）。見本の「開く」「ファイルの場所を開く」「アイコンを変える」「別のグループへ移す」「辞書だけに置く」の字は無い（今は「エクスプローラーで表示する」「辞書に移動」）。 |
| L21 | トースト（`Toast.html`:104-121、`ToastTones.html`:20-56） | 今ある（右下18px。キーの札は無い） | `src/App.tsx:12537-12597` / `src/styles.css:5293-5535` / 時間 `src/App.tsx:2892-2930`・`src/constants.ts:5-6` | 置き場所 `toastStack`（`right: 18px; bottom: 18px; width: min(390px, calc(100vw - 36px))`）、ダイアログを開いている間は上端の中央（`src/styles.css:5309-5316`）。1つは `div.toast.toast--{tone}`（`role="status"`、`data-toast-id`、`--toast-duration`）、中は `toastAccent`（左3pxの縦線）・`toastIconBadge`・`toastCopy`（`strong`＋`span`）・`toastAction`「元に戻す」（処理中は「処理中…」）・`toastClose`（`aria-label="通知を閉じる"`）・`toastLifetime`（下2pxの残り時間の線、`src/styles.css:5418-5432`）。乗せている間とフォーカス中は `toast--paused` で線が止まる（5430-5432、`pauseToast`）。tone は `neutral`/`ok`/`warn`/`error`/`danger`（`src/App.tsx:209`）。時間は 4000ms、元に戻す付きは 8000ms、`error` は 8000ms（`src/constants.ts:5-6`、`src/App.tsx:2895-2897`）、3つを超えると `queued`（2918）。**Ctrl+Z で元に戻す割り当ては無い**（`=== "z"` がリポジトリに0件）。見本の「失敗は自分で消えない」に対して、今の `error` は 8000ms で消える。 |
| L22 | ボタンの4つの状態・説明の吹き出し・入力欄のフォーカス・行のフォーカスの「Enter」（`States.html`:50-118） | 近い物がある（吹き出しと行の「Enter」は無い） | `src/styles.css:2309-2317`・`4640-4670`・`4741-4808`・`12049-12080` | ボタンは `:focus-visible { outline: 2px solid var(--accent-strong); outline-offset: 2px }`（2314-2317）、`button:disabled { cursor: not-allowed; opacity: 0.5 }`（2309-2312）、`.mainActionButton` の hover/focus/active/disabled（12049-12080）、`--gold`/`--neutral`/`--positive` と `primaryButton`/`secondaryButton`/`dangerButton`（4741-4808）。入力欄は `.textInput:focus` が枠 `var(--muted)` ＋ 2px の輪（4653-4656）で、設定ダイアログだけ `outline: 2px solid var(--accent-strong)`（4660-4666）。**説明の吹き出しの部品は無い**（`tooltip` はリポジトリに0件。今は `title` 属性だけで、ブラウザ標準の物が出る）。**行のフォーカスに「Enter」を出す部品も無い**（`>Enter<` に当たる表示は0件）。 |
| L23 | 一手を編集（`EditStep.html`:18-73） | 今ある | `src/App.tsx:14884-15427` | `dropDialog editDialog modalLongForm nextStepEditDialog`、`aria-label` は `dialogTitle`（「次の一手を編集」「次の一手を入れ替える」「次の一手を設定」、14925-14929）、`eyebrow`「Next Step」、`dialogLead`「今進める1件と、始めるための環境を設定します。」。`fieldStack`「プロジェクト」（14967-14994。固定のときは `nextStepFixedProject`「このプロジェクトに設定します」）、「次の一手の決め方」（`nextStepDecisionModes` の「＋ やりたいことから選ぶ」「＋ 新しく入力」）、「行動」（`aria-label="行動"`、maxLength 120、placeholder「次に着手する具体的な一手」、15178-15213）、「始めるきっかけ（任意）」（placeholder「例: 21時 / 夕食後 / PCを開いたら」、15219-15233）、`formSectionHeading`「開始環境」＋`StartEnvironmentPicker`（15235-15245）、「手順書」＋`開始時に手順書を開く`（15247-15279）、「タイマー」（`projectTimerGrid` の「短時間」「通常」、`projectTimerStepButton` `−`/`+`、`aria-label="{label}タイマーを1分減らす/増やす"`、「{n}分を使用／全体設定 {n}分を使用」「全体設定に戻す」、15281-15375）、「開始時にタイマーを大きく表示」（15377-15389）、「開始noteテンプレート（任意）」（15391-15404）、下は `primaryButton`「保存」と `dialogCancelButton`「キャンセル」（15406-15423）。見本の「Ctrl + Enter でも保存できます」（`EditStep.html`:69）はコードに無い。見本の aria-label「短時間を1分減らす」に対して、今は「短時間タイマーを1分減らす」。見本のヘッダー右のプロジェクト札は無い。 |
| L24 | 左下のタイマー（今のまま残す）（`TimerDock.html`:66-72、`Main.html`:156） | 今ある | `src/components/TimerPanel.tsx:31-156` / 呼び出し `src/App.tsx:10029-10133` / 状態 `src/App.tsx:9463-9471`・`10068-10077` | 枠は `section.timerDock.timerPanel`（＋`timerPanel--active`）、`aria-label` は無し。上から `timerMeta`（`timerMetaTop` の「Timer」＋`timerExpandButton`／`ProjectIdentity`＋`strong.timerActionText`）、`timerStateRow` の `timerStateBadge`、`timerClock`、`timerProgress`、下の段（`timerControls` か `waitingContent`）。4状態の中身とテストの目印は下の L24 の表。 |

### L25 の細部（見出しの開け閉め）

| 項目 | 今の作り | 場所 |
|---|---|---|
| 開閉の状態 | `collapsedGroups`（`Record<string, boolean>`、キーはグループ名） | `src/App.tsx:2237-2238` |
| 覚えている場所 | `window.localStorage` の `life-launcher.sidebar-groups`（JSON） | `src/constants.ts:10`、`src/App.tsx:1160-1171`、`4852-4858` |
| 読み直す所 | 起動時（`useState(readCollapsedGroups)`）と、ソフトウェアリセットの復元後 | `src/App.tsx:2238`、`3195` |
| 保存する所 | 開閉の切替（`toggleGroupCollapsed`）と、グループの追加・削除・改名 | `src/App.tsx:4852-4858`、`6507-6511`、`6559-6564`、`6605-6613` |
| 見出しの部品 | `button.quickGroupHeader`（`aria-expanded`、`data-sidebar-group-name`、`title`）＋`UiIcon chevronRight/chevronDown`＋`<strong>`＋`<small>` | `src/App.tsx:9886-9919` |
| 件数の出し方 | `<small>{group.buttons.length}</small>`（「件」は付けない。右寄せ 12px・`var(--text-muted-readable)`） | `src/App.tsx:9918`、`src/styles.css:2603-2607` |
| 開け閉めの入口 | `onClick` は `event.detail === 0`（キーボード）のときだけ `toggleGroupCollapsed`。マウス押下は並べ替えドラッグが受ける | `src/App.tsx:9890-9912`、`4852-4858` |
| まとまりの枠 | `section.quickGroup`（`data-sidebar-group-section`）、中身は `div.quickGroupItems`（`data-sidebar-group-name`） | `src/App.tsx:9857-9873`、`9921` |
| テストの目印 | `.quickGroup` / `.quickGroupHeader` の `aria-expanded`（Enter で false、再読み込み後も false）、`.quickGroupHeader small` の件数、`.quickGroupHeader` の右クリックと Shift+F10・ContextMenu キー | `tests/visual/phase6-dictionary.spec.ts:242-252`、`tests/visual/phase9-main-details.spec.ts:184-198`、`tests/visual/post-v133a-additional-fixes.spec.ts:283-329`、`tests/visual/post-v133c-followup.spec.ts:41-77`・`213` |

### L24 の細部（`TimerPanel` の4つの状態）

`state` は `TimerPanelState = "waiting" | "running" | "paused" | "complete"`（`src/components/TimerPanel.tsx:5`）。呼び出し側は `completionPrompt` → `complete`、`activeTimer.paused` → `paused`、`activeTimer` → `running`、それ以外 → `waiting`（`src/App.tsx:10068-10076`）。

| 状態 | 札（`timerStateBadge`）の字 | 時計 | 進み具合の線 | 下の段 | 右上 |
|---|---|---|---|---|---|
| 待機中 | 「待機中」／`timerStateBadge`（修飾なし） | `{設定の通常分数}分`／`timerClock--adjustable`（`title="上下にドラッグして分数を変更"`） | 出ない（`progressPercent` は `null`、`TimerPanel.tsx:133`） | `timerPresetControls`＞`timerPresetRow`：`timerPresetButton`「-」／`timerPresetInputWrap` の `input aria-label="通常タイマーの分数"`＋「分」＋`numberDragAffordance`／「+」（`src/App.tsx:10079-10132`） | `timerExpandButton` は出ない（`active` のときだけ、`TimerPanel.tsx:88-99`）。`strong.timerActionText` は「通常タイマー」（`src/App.tsx:10052`） |
| 実行中 | 「実行中」（計測は「計測中」）／`timerStateBadge--running` | `timerClock`（`mm:ss`） | `timerProgress`＋`span` の `width: {n}%` | `timerControls`：`secondaryButton`「一時停止」（計測は「停止」）＋`secondaryButton secondaryButton--finish`「終了」 | `timerExpandButton`（`aria-label="タイマーを大きく表示"`、`UiIcon name="maximize"`） |
| 一時停止 | 「一時停止」／`timerStateBadge--paused` | `timerClock timerClock--paused` | 同じ（その位置で止まる） | 「再開」＋「終了」 | 同じ（大きく表示） |
| 完了確認中 | 「完了確認中」／`timerStateBadge--complete` | `timerClock` | 同じ | 実行中と同じ「一時停止／再開」「終了」（完了専用の段は無い） | 同じ |

補足（事実）:
- 枠の見た目は `.timerDock`（`display: grid; gap: 10px; border: 1px solid var(--line); border-radius: var(--radius); padding: 12px 10px; background: var(--surface-strong)`、`src/styles.css:2716-2723`）。
- `timerMeta` の1行目はサイドバーだけ「Timer」＋右上のボタン（`timerMetaTop`、`TimerPanel.tsx:85-100`）。ミニは「タイマー」（102）。
- プロジェクト名は `ProjectIdentity`（`src/App.tsx:10041-10050`）、行動の文は `strong.timerActionText`（`TimerPanel.tsx:105-109`、`title` 付き）。
- サイドバーの枠は右クリックを握りつぶす（`onContextMenu` で `preventDefault`、`TimerPanel.tsx:74-81`）。テストが依存（`tests/visual/post-v133a-additional-fixes.spec.ts:270`）。
- テストが頼っている目印: `.timerDock .timerClock`、`.timerDock .timerStateBadge`（「待機中／実行中／計測中／一時停止」）、`.timerDock .timerActionText`、`.timerDock .timerPresetButton`、`.timerDock .timerPresetInputWrap input`、`.timerDock .timerProgress`、`.timerClock--paused`、`.timerClock--adjustable`、`.timerDock` の「終了」「一時停止」「再開」ボタン（`getByRole("button", { name: ... })`）、`post-v133c-followup.spec.ts:144`・`181`。
- `timerProgress` は `aria-hidden="true"`（`TimerPanel.tsx:134`）。

### L10 の細部（D24〜D26 に使える今の値）

| 使う所 | 今ある値・部品 | 場所 |
|---|---|---|
| D24 行の操作を出す仕組み | 行 `div.inboxRow.sourceListRow` の `:hover` / `:focus-within` で出す。`wishlistRowActions` の中の `wishlistNextStepAction`「▷ 次の一手を設定」は既定 `opacity: 0; pointer-events: none`、`.inboxRow:hover`・`:focus-within`・`:focus-visible` で `1`。行の「…」は `.sourceRowMenu` が既定 `opacity: 0` だが、`.inboxRow .sourceRowMenu` で常時 `1` | `src/styles.css:9712-9726`、`9750-9793`、`src/App.tsx:12252-12308` |
| D24 押した先の画面 | 右クリックの「次の一手にする」は `promoteInboxToNextStep(index) → openNextStepEditor(project, { mode: "promote" })` と同じ流れ。行の「▷ 次の一手を設定」も `promoteInboxToNextStep(index)` | `src/App.tsx:12262-12277`、`12796-12807` |
| D25 まとまりに次の一手があるか | `groupProject = group.projectId ? projectsById.get(group.projectId) : undefined` と `groupProject.nextStep?.text.trim()` の有無。行ごとでは `wishlistItemIsCurrentNextStep(item)`（`nextStep.sourceWishlistId` か本文一致） | `src/App.tsx:12085-12087`、`9357-9364`、`12193` |
| D25 「未分類」の見分け | `group.key === "unassigned"`（`wishlistGroup--unassigned`、見出しは `<strong>未分類</strong>`、`title="未分類は並べ替えできません"`） | `src/App.tsx:12092`、`12116-12118`、`12144-12166` |
| D26 閉じた見出しに出す一覧 | `wishlistGroups = groupWishlistForDisplay(config)`。各まとまりは `{ key, projectId?, name, items }`、並びは「未分類」が最後、件数は `items.length`。今は開閉に関係なく `disclosureDescription` の文を出している（`inboxOpen` は本文の表示だけを切り替える） | `src/App.tsx:9301`、`12001-12004`、`12056`、`src/nextStepWishlist.ts:11-16`・`36-54` |

### 見本とコードで字が違う所（事実）

| 見本の字 | 今の字 | 場所 |
|---|---|---|
| 「次の一手を決める」（`Main.html`:212） | 「次の一手を設定」 | `src/App.tsx:11869` |
| 「小さくする」（`Main.html`:213） | 無い（記録ビューの「このまま」だけ在る） | `src/RecordsView.tsx:323-325` |
| 「12日動いていません」／「大きすぎるかもしれません」（`Main.html`:213） | 「次の一手が14日以上同じです」（記録ビュー） | `src/RecordsView.tsx:320` |
| 「辞書を検索」の欄が上の段の中央（`Main.html`:122） | 上の段に検索の欄は無い | — |
| 「今日 5分・1回」の合計（`Main.html`:156） | 上の段の h1 が「今日 {n}分」 | `src/App.tsx:10464` |
| 「今日やるものを選ぶ」の3件目の空き「空けておいてもかまいません」（`Picker.html`:70） | 「空き {n}」 | `src/App.tsx:13211` |
| 「決定」「閉じる」（`Done.html`:44-45） | 「続ける(+15分)」「終わる」、「新しく入力する」「今は決めない」 | `src/App.tsx:15627-15636`、`14868-14877` |
| 「元に戻す」のキー札「Ctrl Z」（`Toast.html`、D30） | 札は無い。Ctrl+Z の割り当ても無い | `src/App.tsx:12574-12583` |

### 分からなかった所

- 見本 `TimerDock.html` の 66 行目と 72 行目が read では 2,000 文字で切れて全部を読めなかった。4状態の案の側（一時停止・完了確認中の見た目）は、HTML のソースの切れていない部分と `TimerPanel.tsx` の今の作りからは確認できていない。
- 「L12 サイドバーの下の『タイマーだけ使う』」は、見本 `Main.html` にもリポジトリにも字が見当たらなかった（grep 0件）。何を指すかは分からなかった。
- 見本 `Main.html` の 123 行目（上の段）は read で 2,000 文字に切れ、`最大化` の aria-label の所だけ文字化けして読めた（`髢峨§繧・`）。窓のボタンの並びは `WindowControls.tsx:129-157` で確認した（最小化・最大化／元に戻す・閉じる）。
- 見本 `Done.html` の「できたこと」の欄と「もう5分続ける」は、見本の HTML にもコードにも無かった。指示の表の字と見本の中身が食い違っている。

## M. テストの地図

`npx.cmd playwright test --list` の結果は **678 テスト / 90 ファイル**。うち 4 テストは `@manual`（`public-screenshots.spec.ts`）で、`npm run test:visual` は `--grep-invert "@manual"` のため通常は実行されない。

### M-1 spec ごとの本数と主な画面

| # | spec | 本数 | 主に見ている画面 |
| ---: | --- | ---: | --- |
| 1 | `config-validation.spec.ts` | 2 | 設定ファイルの読み込み（旧形式の既定値・競合する手順の検証） |
| 2 | `dashboard-disclosure-context.spec.ts` | 2 | メインの「次の一手」「今日の3件」の右クリックメニュー |
| 3 | `dictionary-window-position.spec.ts` | 3 | 辞書ウィンドウの位置（マルチモニタ・小さい作業領域） |
| 4 | `instruction-html-browser-parity.spec.ts` | 5 | 手順書 HTML プレビューと Chromium 描画の比較 |
| 5 | `phase61-guide.spec.ts` | 5 | 使い方ダイアログ（目次・フォーカス・取り込みプロンプト） |
| 6 | `phase61-wishlist-modal.spec.ts` | 6 | やりたいことの追加・編集モーダル |
| 7 | `phase62-quick-picker.spec.ts` | 6 | クイック/辞書の移動・開始環境ピッカー・やりたいこと編集 |
| 8 | `phase62-source-lifecycle.spec.ts` | 6 | 次の一手/やりたいこと/今日の3件の source lifecycle |
| 9 | `phase6-dictionary.spec.ts` | 8 | 辞書（カテゴリ・タイル・キーボード・ドラッグ・120件） |
| 10 | `phase6-main.spec.ts` | 9 | メイン（勝利条件・今日の3件D&D・次の一手/やりたいこと→今日） |
| 11 | `phase6-readiness.spec.ts` | 7 | 今日の3件の完了数・タイマー切替・一括取り込み・3列 |
| 12 | `phase71-edit-sync.spec.ts` | 7 | 編集と実行中タイマーの同期・スナップショット |
| 13 | `phase72-completion-feedback.spec.ts` | 16 | 完了フィードバック（勝利条件・今日・Do Now） |
| 14 | `phase72-followup-five.spec.ts` | 3 | 今日3件のドラッグ・待機時計・Undo |
| 15 | `phase72-lists-timer-size.spec.ts` | 12 | プロジェクト/やりたいことの件数しきい値・長文・タイマー |
| 16 | `phase72-public-safety.spec.ts` | 1 | 公開安全チェックの CLI（画面を出さない） |
| 17 | `phase72-selection-edit-menus.spec.ts` | 5 | 候補選択と右クリックメニュー |
| 18 | `phase72-toast-undo.spec.ts` | 5 | Undo トーストの寿命・キュー |
| 19 | `phase7-audit.spec.ts` | 6 | タイマー経過時間の基準（短時間/計画/一時停止/時計ジャンプ） |
| 20 | `phase7-early-completion.spec.ts` | 17 | 早期終了ダイアログと記録・ソース保持 |
| 21 | `phase810-activity-axis.spec.ts` | 3 | 今日の実行リストの軸揃え |
| 22 | `phase810-expanded-timer.spec.ts` | 15 | 拡大タイマーと自動展開設定 |
| 23 | `phase810-main-shortcut.spec.ts` | 2 | メインのショートカットとバッジ |
| 24 | `phase810-timer-focus.spec.ts` | 1 | タイマーの分数ステッパーのフォーカス |
| 25 | `phase81-entry-contracts.spec.ts` | 9 | プロジェクト/やりたいこと/手順書の入力契約 |
| 26 | `phase81-generation-boundary.spec.ts` | 10 | 次の一手の generation 境界と source lock |
| 27 | `phase81-layout-qa.spec.ts` | 8 | 長文・空データでのレイアウトとダイアログ |
| 28 | `phase81-source-followup.spec.ts` | 12 | 今日3件完了後の source follow-up |
| 29 | `phase82-countup-core.spec.ts` | 5 | 計測（カウントアップ）の中核ロジック |
| 30 | `phase82-countup-ui.spec.ts` | 8 | 計測の UI・切替・レイアウト |
| 31 | `phase82-nextstep-wishlist.spec.ts` | 18 | 次の一手とやりたいことのグループ/D&D |
| 32 | `phase83-clean-start.spec.ts` | 2 | 初回起動とリセットのバックアップ |
| 33 | `phase83-main-action-hover.spec.ts` | 2 | メインの操作ボタンの hover/focus/press |
| 34 | `phase83-settings-maintenance.spec.ts` | 3 | 設定フッターとメンテナンス操作 |
| 35 | `phase83-software-reset.spec.ts` | 11 | ソフトウェアリセットの各分岐 |
| 36 | `phase84-do-now-ranking.spec.ts` | 4 | 今やる一手の候補ランキングと他の一手 |
| 37 | `phase84-nextstep-create-pick.spec.ts` | 2 | 次の一手エディタの初期タブと選択 |
| 38 | `phase84-nextstep-today3-dnd.spec.ts` | 3 | 次の一手→今日3件のドラッグ |
| 39 | `phase84-project-delete-and-wishlist-today.spec.ts` | 6 | プロジェクト削除とやりたいこと→今日 |
| 40 | `phase84-section-empty-state-polish.spec.ts` | 3 | 4セクションの空状態と余白 |
| 41 | `phase84-source-lock-ui.spec.ts` | 4 | 今日3件による source lock の見た目 |
| 42 | `phase84-today-picker.spec.ts` | 18 | 今日やるものを選ぶピッカー |
| 43 | `phase84-today-remove-dropzone.spec.ts` | 12 | 今日3件の削除ドロップゾーン |
| 44 | `phase84-wishlist-nextstep-hover.spec.ts` | 1 | やりたいことの「次の一手にする」ホバー |
| 45 | `phase87-dictionary-ux.spec.ts` | 5 | 辞書ウィンドウの編集・設定・表示モード |
| 46 | `phase87-drop-register.spec.ts` | 6 | ドロップ登録（ファイル/URL/ごみ箱） |
| 47 | `phase87-followup-polish.spec.ts` | 4 | メイン/今日/辞書/使い方の仕上げ |
| 48 | `phase87-instruction-viewer.spec.ts` | 7 | 手順書ビューア（読込・リネーム・HTML） |
| 49 | `phase89-main-display.spec.ts` | 9 | メイン表示サイズ（standard/large/xlarge）と設定 |
| 50 | `phase8-dictionary-state.spec.ts` | 5 | 辞書のページ/フォーカス/検索の状態復元 |
| 51 | `phase8-entry-forms.spec.ts` | 2 | 手順書ピッカーと追加アクション |
| 52 | `phase8-guide-sync.spec.ts` | 1 | 使い方の目次同期 |
| 53 | `phase8-records.spec.ts` | 4 | 記録ビュー（3タブ・履歴ページ・絞り込み） |
| 54 | `phase95-settings-keyboard.spec.ts` | 10 | 設定ダイアログのキーボード操作 |
| 55 | `phase95-timer-toast-clock.spec.ts` | 32 | タイマー/トースト/時計/記録見出し |
| 56 | `phase96-timer-line.spec.ts` | 10 | ウィンドウ上部のタイマーライン |
| 57 | `phase96-titlebar.spec.ts` | 22 | タイトルバー・ウィンドウ操作・上部メニュー |
| 58 | `phase96-topmenu-labels.spec.ts` | 5 | 上部メニューのラベル段階 |
| 59 | `phase96-viewer-keyboard.spec.ts` | 8 | 手順書ビューアのキーボード操作 |
| 60 | `phase97-close-button.spec.ts` | 18 | 閉じるボタンと Ctrl+W |
| 61 | `phase97-colors.spec.ts` | 4 | プロジェクト12色 |
| 62 | `phase97-drag-regions.spec.ts` | 2 | ドラッグ領域 |
| 63 | `phase97-import.spec.ts` | 11 | JSON 取り込み（抽出/プレビュー/Undo） |
| 64 | `phase97-mhtml.spec.ts` | 25 | MHTML の解析・表示 |
| 65 | `phase97-small-fixes.spec.ts` | 8 | 細かな修正（設定/ホバー/記録/ミニ） |
| 66 | `phase97-test-profile.spec.ts` | 2 | テストプロファイルのバッジ |
| 67 | `phase97-toast-colors.spec.ts` | 6 | トーストの色分け |
| 68 | `phase97-version.spec.ts` | 3 | バージョン表示 |
| 69 | `phase97-wishlist-layout.spec.ts` | 10 | やりたいことの「未分類」とレイアウト |
| 70 | `phase9-border-roles.spec.ts` | 9 | 枠線の役割（P9-07） |
| 71 | `phase9-color-roles.spec.ts` | 6 | 色の役割（P9-06） |
| 72 | `phase9-dialog-details.spec.ts` | 14 | ダイアログの見出し・フッター・記録画面の細部 |
| 73 | `phase9-display-size.spec.ts` | 3 | 表示サイズごとの文字サイズ |
| 74 | `phase9-do-now-today3.spec.ts` | 8 | 今やる一手と今日3件の候補連携 |
| 75 | `phase9-flow.spec.ts` | 14 | タイマーと Do Now/Today3 の連携フロー |
| 76 | `phase9-heading-victory-polish.spec.ts` | 12 | セクション見出しと勝利条件の仕上げ |
| 77 | `phase9-main-details.spec.ts` | 11 | メインの細部（時計・件数・編集・ダイアログ） |
| 78 | `phase9-mini-idle.spec.ts` | 2 | ミニウィンドウの待機/実行表示 |
| 79 | `phase9-native-fixes.spec.ts` | 5 | 勝利条件バーの hover/focus |
| 80 | `phase9-picker-space.spec.ts` | 6 | ピッカーの高さ・スクロール |
| 81 | `phase9-timer-action-text.spec.ts` | 6 | タイマーの行動テキスト表示 |
| 82 | `phase9-visual.spec.ts` | 13 | 画面の基準画像（メイン/設定/記録/ミニ/ピッカー/拡大タイマー） |
| 83 | `post-v133a-additional-fixes.spec.ts` | 9 | 追加修正（選択・URL・ピッカー・グループ） |
| 84 | `post-v133b-followup.spec.ts` | 9 | 追加修正（Builder/やりたいこと/今日/ショートカット） |
| 85 | `post-v133c-followup.spec.ts` | 7 | 追加修正（サイドバー/勝利条件/タイマー/記録タブ） |
| 86 | `public-screenshots.spec.ts` | 4 | 公開用スクリーンショット撮影（@manual） |
| 87 | `readme-contract.spec.ts` | 6 | README とリリースノートの整合 |
| 88 | `toast-dialog-placement.spec.ts` | 9 | ダイアログとトーストの位置 |
| 89 | `today3-remove.spec.ts` | 11 | 今日3件の削除（×ボタン/ドロップ） |
| 90 | `today-global-timer.spec.ts` | 2 | 今日タイマーのグローバル設定 |
| | **合計** | **678** | 90 ファイル |

### M-2 部品ごとの目印

`tests/visual` の `locator(...)` / `querySelector(...)` に出てくるクラス名は **296 種**（のべ 1648 箇所）。以下はクラス名 296 種すべてと、テストが使っている role・`aria-label`・画面の文字の主なもの。`spec:行` はその目印を書いている行（行が連続する場合は `12-15` と範囲で書いた）。

`data-testid` は `src/` に **0 件**、テストの `getByTestId` も **0 回**。`role` は `button` 878・`dialog` 315・`menuitem` 143・`tab` 98・`textbox` 89・`spinbutton` 31 の順に多い。

**上の段**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `mainPanel` | クラス | phase89-main-display.spec.ts:218 / phase95-timer-toast-clock.spec.ts:280,300 / phase96-timer-line.spec.ts:261 / phase96-titlebar.spec.ts:84,164,185,222,253,261,271,302,314,342,352,378 / phase97-drag-regions.spec.ts:28,30,62 / post-v133a-additional-fixes.spec.ts:27 |
| `topBar` | クラス | phase84-today-remove-dropzone.spec.ts:199 / phase89-main-display.spec.ts:33,152,218 / phase95-timer-toast-clock.spec.ts:280,300 / phase96-titlebar.spec.ts:84,185,222,253,261,271,314,342,378 / phase97-drag-regions.spec.ts:30 / phase9-dialog-details.spec.ts:334 / post-v133a-additional-fixes.spec.ts:28 |
| `mainScrollArea` | クラス | phase6-main.spec.ts:82,266 / phase84-source-lock-ui.spec.ts:140 / phase84-today-remove-dropzone.spec.ts:154 / phase89-main-display.spec.ts:26 / phase9-border-roles.spec.ts:239 / phase9-dialog-details.spec.ts:337,340 / phase9-display-size.spec.ts:97,98 / post-v133c-followup.spec.ts:216 |
| `mainScrollContent` | クラス | phase810-activity-axis.spec.ts:26 / phase84-source-lock-ui.spec.ts:141 / phase89-main-display.spec.ts:48,89,96,225,231,238 |
| `brandBlock` | クラス | phase95-settings-keyboard.spec.ts:232 / post-v133a-additional-fixes.spec.ts:15,272,284 / post-v133b-followup.spec.ts:25,55 / post-v133c-followup.spec.ts:37 |
| `viewToggleButtonLabel` | クラス | phase89-main-display.spec.ts:228,243 / phase95-timer-toast-clock.spec.ts:283 / phase96-titlebar.spec.ts:98,261,271,378 |
| `topTitle` | クラス | phase96-titlebar.spec.ts:86 / post-v133b-followup.spec.ts:127,131,146,150 |
| `viewToggleButton` | クラス | phase89-main-display.spec.ts:33,154,226 / phase96-titlebar.spec.ts:612 / post-v133b-followup.spec.ts:217 |
| `windowControlButton` | クラス | phase96-timer-line.spec.ts:200 / phase96-titlebar.spec.ts:615 / phase97-close-button.spec.ts:81 / phase97-small-fixes.spec.ts:75 |
| `windowControls` | クラス | phase96-titlebar.spec.ts:88,661 / phase97-close-button.spec.ts:116,153 |
| `appShell` | クラス | post-v133a-additional-fixes.spec.ts:74,89,99 |
| `brandCopy` | クラス | phase810-main-shortcut.spec.ts:81,92 / post-v133a-additional-fixes.spec.ts:39 |
| `testProfileBadge` | クラス | phase97-test-profile.spec.ts:31,38,39 |
| `topPills` | クラス | phase95-timer-toast-clock.spec.ts:280 / phase96-titlebar.spec.ts:85,612 |
| `windowControlButton--close` | クラス | phase97-close-button.spec.ts:61,93,162 |
| `windowControlsButtons` | クラス | phase96-titlebar.spec.ts:482,670 / phase97-close-button.spec.ts:81 |
| `topDateLabel` | クラス | post-v133b-followup.spec.ts:132,149 |
| `brandIcon` | クラス | post-v133a-additional-fixes.spec.ts:30 |
| `panelDragStrip--main` | クラス | phase97-drag-regions.spec.ts:64 |
| `panelDragStrip--sidebar` | クラス | phase97-drag-regions.spec.ts:65 |
| `topSummary` | クラス | phase96-titlebar.spec.ts:87 |
| `topTitle--records` | クラス | phase96-titlebar.spec.ts:170 |
| `aria-label="最小化"` | aria-label | phase96-timer-line.spec.ts:200 |
| `role="button" name="設定を開く"` | role | phase81-entry-contracts.spec.ts:508,547 / phase83-clean-start.spec.ts:43,163 / phase83-settings-maintenance.spec.ts:26,46 / phase83-software-reset.spec.ts:67,377 / phase89-main-display.spec.ts:42 / phase95-settings-keyboard.spec.ts:16,258 / phase96-titlebar.spec.ts:548,657,691,707,713 / phase97-close-button.spec.ts:216,247,295 / phase97-import.spec.ts:227 / phase97-small-fixes.spec.ts:36 / phase97-test-profile.spec.ts:42 / phase97-toast-colors.spec.ts:46 / phase97-version.spec.ts:23 / phase9-color-roles.spec.ts:114,152,197,228 / phase9-dialog-details.spec.ts:42,276 / phase9-visual.spec.ts:98 / post-v133a-additional-fixes.spec.ts:47 / post-v133b-followup.spec.ts:159,218,250 / post-v133c-followup.spec.ts:110 / toast-dialog-placement.spec.ts:76 / today-global-timer.spec.ts:30 |
| `role="button" name="記録ビューを開く"` | role | phase83-clean-start.spec.ts:144 / phase89-main-display.spec.ts:237 / phase8-records.spec.ts:22 / phase95-timer-toast-clock.spec.ts:306 / phase96-timer-line.spec.ts:176,263 / phase96-titlebar.spec.ts:174,250,304,412 / phase97-small-fixes.spec.ts:196 / phase97-toast-colors.spec.ts:59 / phase9-dialog-details.spec.ts:322,354 / phase9-visual.spec.ts:137 / post-v133c-followup.spec.ts:214 |

**サイドバー**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `quickGroupHeader` | クラス | phase6-dictionary.spec.ts:243,249,336,366 / phase9-dialog-details.spec.ts:260,268 / phase9-main-details.spec.ts:184,185,198 / post-v133a-additional-fixes.spec.ts:15,283,288,298,300,301,316,325,328,329 / post-v133b-followup.spec.ts:213 / post-v133c-followup.spec.ts:42,66,145 |
| `quickButton` | クラス | phase62-quick-picker.spec.ts:60,74,88,99 / phase6-dictionary.spec.ts:215,234,303,332 / phase87-followup-polish.spec.ts:21,111 / phase9-main-details.spec.ts:205,217 / post-v133a-additional-fixes.spec.ts:175,294,304 / post-v133c-followup.spec.ts:48,59,92 |
| `quickGroup` | クラス | phase6-dictionary.spec.ts:242,249,303,331,337 / phase97-drag-regions.spec.ts:31 / phase9-main-details.spec.ts:182,196,216,217 / post-v133a-additional-fixes.spec.ts:175,293 / post-v133c-followup.spec.ts:41,66 |
| `sidebar` | クラス | phase810-main-shortcut.spec.ts:96 / phase95-settings-keyboard.spec.ts:15,231 / phase97-drag-regions.spec.ts:29,63 / post-v133a-additional-fixes.spec.ts:10,26 / post-v133b-followup.spec.ts:10 / post-v133c-followup.spec.ts:9 |
| `quickGroupEmpty` | クラス | phase9-main-details.spec.ts:186,196,200,216 |
| `shortcutBadge` | クラス | phase810-main-shortcut.spec.ts:81,83 / phase87-followup-polish.spec.ts:152 |
| `launcherOpenButton` | クラス | phase810-main-shortcut.spec.ts:83 / phase87-followup-polish.spec.ts:152 |
| `launcherOpenButtonIcon` | クラス | phase87-followup-polish.spec.ts:112 |
| `launcherOpenButtonLabel` | クラス | phase87-followup-polish.spec.ts:110 |
| `quickList` | クラス | post-v133c-followup.spec.ts:90 |

**勝利条件**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `victoryTextButton` | クラス | phase72-completion-feedback.spec.ts:136 / phase95-timer-toast-clock.spec.ts:455,474,486 / phase9-color-roles.spec.ts:182 / phase9-heading-victory-polish.spec.ts:137,149,162,180,195,208 / phase9-native-fixes.spec.ts:69,82,86,94 / post-v133c-followup.spec.ts:107 |
| `victoryBadge--reward` | クラス | phase72-completion-feedback.spec.ts:89,112,115,124,143,152,169,178,371 |
| `victoryInput` | クラス | phase95-timer-toast-clock.spec.ts:475 / phase9-heading-victory-polish.spec.ts:144,182,214 / phase9-native-fixes.spec.ts:81,84,87 |
| `victoryBar` | クラス | phase95-timer-toast-clock.spec.ts:454,472,485 / phase9-display-size.spec.ts:82 / phase9-heading-victory-polish.spec.ts:130 / phase9-native-fixes.spec.ts:20 |
| `victoryIcon` | クラス | phase9-heading-victory-polish.spec.ts:156 / phase9-native-fixes.spec.ts:39,56,80 |
| `suggestionChip` | クラス | phase9-display-size.spec.ts:102 / phase9-heading-victory-polish.spec.ts:196 |
| `victoryBadge` | クラス | phase72-completion-feedback.spec.ts:111,177 |
| `victoryBar--reward` | クラス | phase72-completion-feedback.spec.ts:369 |
| `victoryLabel` | クラス | phase9-native-fixes.spec.ts:83 |
| `victorySuggestions` | クラス | phase9-display-size.spec.ts:102 |
| `aria-label="勝利条件の候補"` | aria-label | phase6-main.spec.ts:84 |

**今やる一手**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `doNowBand` | クラス | dashboard-disclosure-context.spec.ts:10 / phase61-guide.spec.ts:14 / phase61-wishlist-modal.spec.ts:17 / phase62-quick-picker.spec.ts:17 / phase62-source-lifecycle.spec.ts:13 / phase6-main.spec.ts:13 / phase6-readiness.spec.ts:17 / phase72-completion-feedback.spec.ts:18 / phase72-followup-five.spec.ts:12 / phase72-lists-timer-size.spec.ts:39 / phase72-selection-edit-menus.spec.ts:13,137 / phase72-toast-undo.spec.ts:33 / phase7-early-completion.spec.ts:52,197,213 / phase81-generation-boundary.spec.ts:282 / phase81-layout-qa.spec.ts:91 / phase82-countup-ui.spec.ts:28 / phase83-clean-start.spec.ts:23,75 / phase83-main-action-hover.spec.ts:38 / phase84-do-now-ranking.spec.ts:11 / phase84-project-delete-and-wishlist-today.spec.ts:12,111,121 / phase84-section-empty-state-polish.spec.ts:10 / phase8-entry-forms.spec.ts:10 / phase8-records.spec.ts:14,86 / phase95-timer-toast-clock.spec.ts:35 / phase96-timer-line.spec.ts:16 / phase97-close-button.spec.ts:31 / phase97-colors.spec.ts:37,97,115,162 / phase97-drag-regions.spec.ts:15 / phase97-import.spec.ts:97 / phase97-small-fixes.spec.ts:31,177 / phase97-test-profile.spec.ts:18 / phase97-toast-colors.spec.ts:10 / phase97-wishlist-layout.spec.ts:25 / phase9-border-roles.spec.ts:15 / phase9-color-roles.spec.ts:10 / phase9-dialog-details.spec.ts:22,348 / phase9-display-size.spec.ts:29 / phase9-flow.spec.ts:28 / phase9-heading-victory-polish.spec.ts:23 / phase9-main-details.spec.ts:22 / phase9-native-fixes.spec.ts:13 / phase9-visual.spec.ts:70 / post-v133c-followup.spec.ts:174,207 |
| `doNowStartPrimary` | クラス | phase72-completion-feedback.spec.ts:251,259,272,286,288,295,321,355 / phase72-selection-edit-menus.spec.ts:115 / phase810-expanded-timer.spec.ts:13,35,76,90,125,187,248,263,284 / phase810-timer-focus.spec.ts:22 / phase82-countup-ui.spec.ts:216 / phase95-timer-toast-clock.spec.ts:78,109,120,134,176 / phase96-timer-line.spec.ts:22 / phase9-color-roles.spec.ts:188 / phase9-do-now-today3.spec.ts:115 / phase9-flow.spec.ts:84,97,112,179,192,202,232,241,247,261,273,294,312,347 / phase9-main-details.spec.ts:260 / phase9-timer-action-text.spec.ts:82,99 / post-v133a-additional-fixes.spec.ts:140 / post-v133c-followup.spec.ts:143,175 |
| `doNowContent` | クラス | phase72-completion-feedback.spec.ts:273,274,362 / phase72-selection-edit-menus.spec.ts:85,107,121 / phase82-countup-ui.spec.ts:51,207 / phase84-do-now-ranking.spec.ts:100 / phase9-do-now-today3.spec.ts:28,140,143,153,157,158,162,167,176,179,181,191,193,195 / phase9-flow.spec.ts:66 / post-v133a-additional-fixes.spec.ts:147,150 |
| `doNowContent--hold` | クラス | phase72-completion-feedback.spec.ts:211,228,254,298,311,320,324,333,340,360 / phase9-do-now-today3.spec.ts:122 / phase9-flow.spec.ts:128 / post-v133a-additional-fixes.spec.ts:143 / post-v133c-followup.spec.ts:188 |
| `doNowAlternateButton` | クラス | phase72-completion-feedback.spec.ts:259 / phase9-do-now-today3.spec.ts:57,139,152,175,189 / phase9-flow.spec.ts:244 |
| `doNowCopy` | クラス | phase72-selection-edit-menus.spec.ts:87,97,100 / phase84-do-now-ranking.spec.ts:40,67,98,112 |
| `doNowMeasureButton` | クラス | phase810-expanded-timer.spec.ts:110 / phase82-countup-ui.spec.ts:45,77,218 / phase96-timer-line.spec.ts:23 / phase9-flow.spec.ts:166 |
| `doNowStartSecondary` | クラス | phase72-selection-edit-menus.spec.ts:116 / phase7-early-completion.spec.ts:195,211 / phase81-generation-boundary.spec.ts:265,280 / phase82-countup-ui.spec.ts:217 |
| `doNowActions` | クラス | phase72-selection-edit-menus.spec.ts:86 / phase82-countup-ui.spec.ts:56,61,76 / phase9-flow.spec.ts:171 |
| `doNowMetaTimer` | クラス | phase9-flow.spec.ts:86,100,101,168 |
| `doNowEmptyContent` | クラス | phase72-completion-feedback.spec.ts:284,285,313 |
| `doNowReason` | クラス | phase84-do-now-ranking.spec.ts:43,99 / phase9-do-now-today3.spec.ts:39 |
| `doNowEmpty` | クラス | phase84-do-now-ranking.spec.ts:147 / phase84-section-empty-state-polish.spec.ts:63 |
| `doNowKicker` | クラス | phase72-selection-edit-menus.spec.ts:120 / phase84-do-now-ranking.spec.ts:69 |
| `doNowMeta` | クラス | phase84-do-now-ranking.spec.ts:69 |

**今日の3件**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `todayRow` | クラス | dashboard-disclosure-context.spec.ts:30,40 / phase62-source-lifecycle.spec.ts:181,196,207 / phase6-main.spec.ts:104,142,314,340 / phase6-readiness.spec.ts:83,108,125,137,224 / phase71-edit-sync.spec.ts:21,27,119,148,180,181 / phase72-completion-feedback.spec.ts:70,191,230,233,359 / phase72-followup-five.spec.ts:51,124,142 / phase72-lists-timer-size.spec.ts:184 / phase72-toast-undo.spec.ts:47,88,162 / phase7-audit.spec.ts:36,50,111,134 / phase7-early-completion.spec.ts:68,136,177,193,322,359,380,393,414,430 / phase810-expanded-timer.spec.ts:157,206,216,231 / phase81-generation-boundary.spec.ts:47,199 / phase81-source-followup.spec.ts:16,44,267,286,299,306,381 / phase82-countup-ui.spec.ts:85,98,113,132,182 / phase83-clean-start.spec.ts:121 / phase83-software-reset.spec.ts:371 / phase84-nextstep-today3-dnd.spec.ts:59,118,138 / phase84-section-empty-state-polish.spec.ts:35,36 / phase84-source-lock-ui.spec.ts:10,44,82 / phase84-today-picker.spec.ts:68,149,189,198,541,544 / phase84-today-remove-dropzone.spec.ts:31,76,94,109,112,122,144,147,160,161,171,187,197,205,206,229,231,233,239,248,256,262,269,273,280 / phase89-main-display.spec.ts:160,179 / phase8-entry-forms.spec.ts:38,84 / phase95-timer-toast-clock.spec.ts:92,223,238,260 / phase97-import.spec.ts:288 / phase97-small-fixes.spec.ts:194 / phase9-border-roles.spec.ts:206 / phase9-do-now-today3.spec.ts:78,95,121 / phase9-flow.spec.ts:30,67,257,336 / phase9-main-details.spec.ts:60,245,280 / phase9-timer-action-text.spec.ts:65,127 / phase9-visual.spec.ts:50 / today3-remove.spec.ts:27,48,60,79,110,116,127,132,147,158,177,201,206,214,259,284 / today-global-timer.spec.ts:28,76 |
| `todayPickerRow` | クラス | phase61-wishlist-modal.spec.ts:106 / phase6-main.spec.ts:185,211,245,264,338 / phase6-readiness.spec.ts:133 / phase72-selection-edit-menus.spec.ts:54 / phase810-expanded-timer.spec.ts:198 / phase81-generation-boundary.spec.ts:187 / phase83-clean-start.spec.ts:118 / phase84-today-picker.spec.ts:105,111,126,130,156,181,184,212,289,295,301,338,381,385,407,412,464 / phase9-picker-space.spec.ts:26,32 / today3-remove.spec.ts:64,70 |
| `todayRemoveButton` | クラス | phase72-completion-feedback.spec.ts:188,207 / phase72-toast-undo.spec.ts:58,161 / phase82-countup-ui.spec.ts:215 / phase84-source-lock-ui.spec.ts:44,82 / phase84-today-picker.spec.ts:549 / phase97-toast-colors.spec.ts:111 / phase9-do-now-today3.spec.ts:83 / phase9-flow.spec.ts:316 / today3-remove.spec.ts:44,47,90,112,126,145,188,205,207,219,229,260,291 |
| `todayTextButton` | クラス | dashboard-disclosure-context.spec.ts:37,39,42 / phase6-main.spec.ts:315 / phase72-followup-five.spec.ts:52 / phase72-toast-undo.spec.ts:76,98,160,177 / phase84-today-remove-dropzone.spec.ts:45,77,216 / today3-remove.spec.ts:149,217 |
| `todayRemoveDropZone` | クラス | phase84-today-remove-dropzone.spec.ts:57,83,87,89,93,111,146,179,249,263,274 / phase9-flow.spec.ts:328 / today3-remove.spec.ts:167 |
| `todayMeasureButton` | クラス | phase82-countup-ui.spec.ts:86,89,99,114,121,124,133,184,213,232-234 |
| `todayCompletionSummary` | クラス | phase6-readiness.spec.ts:66 / phase72-completion-feedback.spec.ts:234 / phase84-today-picker.spec.ts:545,551 / phase87-followup-polish.spec.ts:74 / phase95-timer-toast-clock.spec.ts:522 / phase9-main-details.spec.ts:82,95 / today3-remove.spec.ts:119 |
| `todayAllCompletionReward` | クラス | phase72-completion-feedback.spec.ts:178,211,224,241,275,360 / phase7-early-completion.spec.ts:152 / phase84-today-picker.spec.ts:548 |
| `todayGrid` | クラス | phase82-countup-ui.spec.ts:204 / phase84-nextstep-today3-dnd.spec.ts:62,117,121 / phase84-project-delete-and-wishlist-today.spec.ts:72 / phase84-today-remove-dropzone.spec.ts:60 / phase89-main-display.spec.ts:191 / today3-remove.spec.ts:255 |
| `todayStartButton` | クラス | phase6-main.spec.ts:174 / phase72-completion-feedback.spec.ts:208,233,339 / phase72-lists-timer-size.spec.ts:231 / phase84-today-picker.spec.ts:544 / phase9-flow.spec.ts:97 |
| `todayPickerSourcePanel` | クラス | phase84-today-picker.spec.ts:439 / phase9-picker-space.spec.ts:26,31,32,72,97 |
| `todayRow--justCompleted` | クラス | phase72-completion-feedback.spec.ts:223,241,275,358 / phase7-early-completion.spec.ts:152 / phase84-today-picker.spec.ts:548 |
| `todayPickerSlot--selected` | クラス | phase84-today-picker.spec.ts:56,135,219,255,271 |
| `todaySectionCount` | クラス | phase87-followup-polish.spec.ts:74 / phase95-timer-toast-clock.spec.ts:522,557 / phase9-main-details.spec.ts:83,94 |
| `todayDragGhost` | クラス | phase6-main.spec.ts:119,154 / phase72-followup-five.spec.ts:62,64 |
| `todayDropGuidanceOverlay` | クラス | phase84-nextstep-today3-dnd.spec.ts:64,92,105 / phase84-project-delete-and-wishlist-today.spec.ts:76 |
| `todayPickerCopy` | クラス | phase84-today-picker.spec.ts:334,346,413,414 |
| `todaySectionBar` | クラス | phase87-followup-polish.spec.ts:70,86 / phase9-main-details.spec.ts:81,93 |
| `todaySectionDescription` | クラス | phase95-timer-toast-clock.spec.ts:523 / phase9-heading-victory-polish.spec.ts:50 / phase9-main-details.spec.ts:86,97 |
| `todayCompletionStatus--complete` | クラス | phase6-readiness.spec.ts:62,64 / phase72-completion-feedback.spec.ts:232 |
| `todayDropIndicator` | クラス | phase6-main.spec.ts:120 / phase84-nextstep-today3-dnd.spec.ts:77,122 |
| `todayEmptyState` | クラス | phase6-readiness.spec.ts:153 / phase83-main-action-hover.spec.ts:78 / phase84-section-empty-state-polish.spec.ts:90 |
| `todayPickerSelectedStatus` | クラス | phase6-main.spec.ts:214,246 / phase84-today-picker.spec.ts:133 |
| `todayPickerSlot--empty` | クラス | phase84-today-picker.spec.ts:57,136 / phase9-picker-space.spec.ts:51 |
| `todayRow--complete` | クラス | phase72-completion-feedback.spec.ts:231 / phase84-today-picker.spec.ts:542,550 |
| `todaySectionDisclosure` | クラス | phase87-followup-polish.spec.ts:41,73,84 |
| `todayStartButton--short` | クラス | phase82-countup-ui.spec.ts:116,190,211 |
| `todayTriggerButton--empty` | クラス | phase9-border-roles.spec.ts:209,212 / today3-remove.spec.ts:215 |
| `todayTriggerZone` | クラス | phase9-border-roles.spec.ts:208 / today3-remove.spec.ts:222,238 |
| `todayBuilderBand` | クラス | phase84-today-picker.spec.ts:48,196 |
| `todayGridRegion` | クラス | phase87-followup-polish.spec.ts:45,47 |
| `todayInstructionButton` | クラス | phase82-countup-ui.spec.ts:214 / today3-remove.spec.ts:84 |
| `todayPickerCounter` | クラス | phase84-today-picker.spec.ts:249 / phase9-picker-space.spec.ts:58 |
| `todayPickerEntry` | クラス | phase84-today-picker.spec.ts:69 / phase9-border-roles.spec.ts:159 |
| `todayPickerRow--groupedWishlist` | クラス | phase84-today-picker.spec.ts:346,351 |
| `todayPickerWishlistGroupHeader` | クラス | phase84-today-picker.spec.ts:103,376 |
| `todayStartButton--normal` | クラス | phase82-countup-ui.spec.ts:101,212 |
| `todayTimerActions` | クラス | today3-remove.spec.ts:216,292 |
| `todayBuilderDestination` | クラス | phase6-readiness.spec.ts:164 |
| `todayCardFooter` | クラス | today3-remove.spec.ts:285 |
| `todayCardSecondaryActions` | クラス | today3-remove.spec.ts:85 |
| `todayCompletedLabel` | クラス | today3-remove.spec.ts:292 |
| `todayCompletionStatus` | クラス | phase6-readiness.spec.ts:64 |
| `todayGrid--dropGuidance` | クラス | phase84-nextstep-today3-dnd.spec.ts:104 |
| `todayPickerAddButton` | クラス | phase84-today-picker.spec.ts:442 |
| `todayPickerDialog` | クラス | phase9-picker-space.spec.ts:91 |
| `todayPickerEntryVisual` | クラス | phase84-today-picker.spec.ts:70 |
| `todayPickerProgress` | クラス | phase84-today-picker.spec.ts:247 |
| `todayPickerRemoveDropZone` | クラス | phase84-today-picker.spec.ts:257 |
| `todayPickerSlot` | クラス | phase84-today-picker.spec.ts:55 |
| `todayPickerSlotTask` | クラス | phase84-today-picker.spec.ts:132 |
| `todayProjectIdentity` | クラス | today3-remove.spec.ts:271 |
| `todayTimerActions--measure` | クラス | phase82-countup-ui.spec.ts:236 |
| `todayTimerActions--running` | クラス | phase82-countup-ui.spec.ts:127 |
| `role="dialog" name="今日やるものを選ぶ"` | role | phase6-main.spec.ts:193 / phase6-readiness.spec.ts:139 / phase72-selection-edit-menus.spec.ts:51,74 / phase810-expanded-timer.spec.ts:197 / phase84-today-picker.spec.ts:37 / phase96-titlebar.spec.ts:737,740 / phase9-dialog-details.spec.ts:284 / phase9-do-now-today3.spec.ts:88 / phase9-flow.spec.ts:351 / phase9-picker-space.spec.ts:23,61,82 / phase9-visual.spec.ts:92 |

**次の一手**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `nextStepCard` | クラス | phase72-lists-timer-size.spec.ts:134,175 / phase810-timer-focus.spec.ts:29 / phase81-entry-contracts.spec.ts:343 / phase81-layout-qa.spec.ts:139,140,266,304,347 / phase82-nextstep-wishlist.spec.ts:557,565,568,574,584 / phase84-nextstep-create-pick.spec.ts:15,43 / phase84-nextstep-today3-dnd.spec.ts:11,58,102,115,133 / phase84-project-delete-and-wishlist-today.spec.ts:88,114,146,186,206 / phase84-section-empty-state-polish.spec.ts:37,38,147 / phase84-source-lock-ui.spec.ts:19 / phase89-main-display.spec.ts:178 / phase97-import.spec.ts:285 / phase97-toast-colors.spec.ts:77,85,97 / phase9-border-roles.spec.ts:131 / phase9-dialog-details.spec.ts:228 / phase9-flow.spec.ts:213 / phase9-main-details.spec.ts:122,156 |
| `projectsBand` | クラス | phase6-main.spec.ts:172 / phase6-readiness.spec.ts:166 / phase72-lists-timer-size.spec.ts:93 / phase810-timer-focus.spec.ts:25 / phase81-layout-qa.spec.ts:132 / phase82-nextstep-wishlist.spec.ts:720,721 / phase83-clean-start.spec.ts:77,80,161 / phase84-section-empty-state-polish.spec.ts:69,140 / phase87-followup-polish.spec.ts:50,70,87 / phase8-entry-forms.spec.ts:61,77 / phase9-border-roles.spec.ts:149 / phase9-main-details.spec.ts:102 |
| `nextStepActionRegion` | クラス | dashboard-disclosure-context.spec.ts:19 / phase72-selection-edit-menus.spec.ts:37 / phase81-generation-boundary.spec.ts:226 / phase81-layout-qa.spec.ts:142,268,306,349 / phase82-nextstep-wishlist.spec.ts:586 |
| `nextStepProjectRegion` | クラス | phase61-wishlist-modal.spec.ts:247 / phase81-layout-qa.spec.ts:141,267,305,348 / phase82-nextstep-wishlist.spec.ts:586 / phase84-source-lock-ui.spec.ts:25 / phase8-entry-forms.spec.ts:81 |
| `nextStepRow` | クラス | dashboard-disclosure-context.spec.ts:18 / phase62-source-lifecycle.spec.ts:44 / phase6-main.spec.ts:173 / phase71-edit-sync.spec.ts:126 / phase72-lists-timer-size.spec.ts:95,98 / phase72-selection-edit-menus.spec.ts:37 / phase81-layout-qa.spec.ts:197 |
| `projectIdentity` | クラス | phase81-layout-qa.spec.ts:145 / phase84-project-delete-and-wishlist-today.spec.ts:90 / phase84-source-lock-ui.spec.ts:25 / phase84-today-picker.spec.ts:131 / phase9-main-details.spec.ts:230 |
| `sourceLockBadge` | クラス | phase84-project-delete-and-wishlist-today.spec.ts:89 / phase84-source-lock-ui.spec.ts:20,23,45 |
| `sourceLockBadge--wishlist` | クラス | phase84-source-lock-ui.spec.ts:65,69,83 / phase84-wishlist-nextstep-hover.spec.ts:80 |
| `nextStepRowAction` | クラス | phase81-layout-qa.spec.ts:165 / phase83-main-action-hover.spec.ts:79,113 |
| `nextStepStartDuration` | クラス | phase72-lists-timer-size.spec.ts:189,190,201 |
| `nextStepStartGlyph` | クラス | phase72-lists-timer-size.spec.ts:198,202,216 |
| `nextStepTodayStatus` | クラス | phase84-source-lock-ui.spec.ts:22,24,46 |
| `projectGrid` | クラス | phase82-nextstep-wishlist.spec.ts:561,602,608 |
| `sourceReturnBand--target` | クラス | phase82-nextstep-wishlist.spec.ts:507,720 |
| `sourceReturnDropZone` | クラス | phase82-nextstep-wishlist.spec.ts:508,721 |
| `nextStepFixedProject` | クラス | phase81-layout-qa.spec.ts:254 |
| `nextStepLockedStatus` | クラス | phase84-source-lock-ui.spec.ts:34 |
| `nextStepReplacementNotice` | クラス | phase81-layout-qa.spec.ts:232 |
| `nextStepTodayButton` | クラス | phase6-main.spec.ts:177 |
| `projectNextStepPlaceholder` | クラス | phase82-nextstep-wishlist.spec.ts:575 |
| `projectTimerSetting` | クラス | phase71-edit-sync.spec.ts:89 |
| `sourceReturnBand--active` | クラス | phase82-nextstep-wishlist.spec.ts:512 |
| `role="dialog" name="次の一手を編集"` | role | phase62-quick-picker.spec.ts:137,224 / phase71-edit-sync.spec.ts:87,137,143,177 / phase72-followup-five.spec.ts:69,75 / phase810-expanded-timer.spec.ts:176 / phase81-generation-boundary.spec.ts:201,249 / phase81-layout-qa.spec.ts:331,338,382 / phase8-entry-forms.spec.ts:40,86 / phase9-dialog-details.spec.ts:231 / phase9-main-details.spec.ts:126,139 |

**やりたいこと**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `inboxBand` | クラス | phase62-source-lifecycle.spec.ts:85,122,153,184 / phase6-main.spec.ts:179 / phase6-readiness.spec.ts:143,185 / phase72-lists-timer-size.spec.ts:43 / phase72-selection-edit-menus.spec.ts:43 / phase810-timer-focus.spec.ts:51 / phase81-entry-contracts.spec.ts:104 / phase81-layout-qa.spec.ts:96,133 / phase81-source-followup.spec.ts:324 / phase82-nextstep-wishlist.spec.ts:27,28,375,500,507,508,512 / phase83-clean-start.spec.ts:100,102 / phase84-nextstep-create-pick.spec.ts:16 / phase84-project-delete-and-wishlist-today.spec.ts:196 / phase84-section-empty-state-polish.spec.ts:30,79,83,152,157 / phase84-wishlist-nextstep-hover.spec.ts:15,141 / phase87-followup-polish.spec.ts:50,70 / phase8-entry-forms.spec.ts:89 / phase97-wishlist-layout.spec.ts:26,148 / phase9-dialog-details.spec.ts:54 / phase9-main-details.spec.ts:103,113 / post-v133b-followup.spec.ts:68,105 |
| `inboxRow` | クラス | phase62-quick-picker.spec.ts:184 / phase62-source-lifecycle.spec.ts:86,123,154,185 / phase6-main.spec.ts:183 / phase6-readiness.spec.ts:144 / phase71-edit-sync.spec.ts:166 / phase72-lists-timer-size.spec.ts:119,121,126 / phase810-timer-focus.spec.ts:55 / phase81-layout-qa.spec.ts:197 / phase81-source-followup.spec.ts:325 / phase82-nextstep-wishlist.spec.ts:296,307,378 / phase84-section-empty-state-polish.spec.ts:39,164 / phase84-wishlist-nextstep-hover.spec.ts:17 / phase8-entry-forms.spec.ts:108 |
| `wishlistGroupHeader` | クラス | phase81-layout-qa.spec.ts:137 / phase82-nextstep-wishlist.spec.ts:292,295,304,624,625,642 / phase97-wishlist-layout.spec.ts:87 / phase9-main-details.spec.ts:170 |
| `inboxBody` | クラス | phase81-entry-contracts.spec.ts:108 / phase81-layout-qa.spec.ts:98 / phase8-entry-forms.spec.ts:107 / phase97-wishlist-layout.spec.ts:30 / phase9-main-details.spec.ts:115 |
| `inboxItemText` | クラス | phase81-layout-qa.spec.ts:176,180,185 / phase97-wishlist-layout.spec.ts:105,120 |
| `wishlistGroup` | クラス | phase72-lists-timer-size.spec.ts:110 / phase82-nextstep-wishlist.spec.ts:288 / phase97-wishlist-layout.spec.ts:84,210 |
| `wishlistTodayStatus` | クラス | phase82-nextstep-wishlist.spec.ts:297 / phase84-source-lock-ui.spec.ts:68 / phase84-wishlist-nextstep-hover.spec.ts:72,75 |
| `wishlistGroupDragGhost` | クラス | phase82-nextstep-wishlist.spec.ts:633 / phase97-wishlist-layout.spec.ts:183,203 |
| `wishlistNextStepStatus` | クラス | phase81-entry-contracts.spec.ts:341 / phase84-nextstep-create-pick.spec.ts:121 / phase84-wishlist-nextstep-hover.spec.ts:73 |
| `inboxDropIndicator` | クラス | phase82-nextstep-wishlist.spec.ts:367,398 |
| `moveTodayButton` | クラス | phase6-main.spec.ts:183 / phase6-readiness.spec.ts:144 |
| `wishlistGroupDropIndicator` | クラス | phase82-nextstep-wishlist.spec.ts:635 / phase97-wishlist-layout.spec.ts:205 |
| `wishlistNextStepAction` | クラス | phase84-source-lock-ui.spec.ts:67,84 |
| `inboxAddPrompt` | クラス | phase6-main.spec.ts:181 |
| `inboxAddRow` | クラス | phase61-wishlist-modal.spec.ts:85 |
| `inboxDragGhost` | クラス | phase82-nextstep-wishlist.spec.ts:388 |
| `wishlistNextStepSlot` | クラス | phase84-wishlist-nextstep-hover.spec.ts:121 |
| `wishlistRowActions` | クラス | phase84-wishlist-nextstep-hover.spec.ts:125 |

**今日の実行**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `runningBadge` | クラス | phase6-readiness.spec.ts:116 / phase82-countup-ui.spec.ts:51 / phase9-flow.spec.ts:82,83,92,93,105,158,193,234,295 / today3-remove.spec.ts:269,278,281 |
| `runningStopButton` | クラス | phase82-countup-ui.spec.ts:76,88,135 / phase83-clean-start.spec.ts:128 / phase9-do-now-today3.spec.ts:121 / phase9-flow.spec.ts:96,126,151,181,197,275,298,339 |
| `todayActivityBand` | クラス | phase810-activity-axis.spec.ts:27,36 / phase87-followup-polish.spec.ts:50,70 / phase9-main-details.spec.ts:104 / post-v133b-followup.spec.ts:128 |
| `measureElapsedClock` | クラス | phase82-countup-ui.spec.ts:122,125,241 / phase9-flow.spec.ts:171 |
| `todayActivityRow` | クラス | phase810-activity-axis.spec.ts:30 / post-v133b-followup.spec.ts:129,133 |
| `todayActivityAutoBadge` | クラス | phase810-activity-axis.spec.ts:29 |
| `todayActivityBody` | クラス | post-v133b-followup.spec.ts:134 |
| `todayActivityStartedAt` | クラス | phase810-activity-axis.spec.ts:53 |

**タイマー**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `timerDock` | クラス | phase72-followup-five.spec.ts:82,130 / phase810-expanded-timer.spec.ts:51,53,56,62,69,85,297 / phase810-timer-focus.spec.ts:32,39,45,48 / phase82-countup-ui.spec.ts:48 / phase95-timer-toast-clock.spec.ts:61,79-83,96,111,122,135,142,177,187,192,194 / phase96-timer-line.spec.ts:53,64,99,111,128,132,174,244 / phase97-drag-regions.spec.ts:38 / phase9-color-roles.spec.ts:189 / phase9-do-now-today3.spec.ts:102 / phase9-flow.spec.ts:41,250 / phase9-main-details.spec.ts:46 / phase9-timer-action-text.spec.ts:41,84,87,100,115,132 / phase9-visual.spec.ts:54 / post-v133a-additional-fixes.spec.ts:270 / post-v133c-followup.spec.ts:144,181 / today-global-timer.spec.ts:49 |
| `timerStateBadge` | クラス | phase810-expanded-timer.spec.ts:56,62,69,85,297 / phase95-timer-toast-clock.spec.ts:79,81,83,96,135,177,187,192 / phase96-timer-line.spec.ts:64 / phase97-small-fixes.spec.ts:302,324 / phase9-color-roles.spec.ts:189 / phase9-flow.spec.ts:43,45,250 / phase9-main-details.spec.ts:64,69 / phase9-mini-idle.spec.ts:48,80,86 / phase9-visual.spec.ts:54 |
| `timerClock` | クラス | phase72-followup-five.spec.ts:82 / phase810-expanded-timer.spec.ts:51,53 / phase82-countup-ui.spec.ts:49,54,60,63 / phase95-timer-toast-clock.spec.ts:61,142,194 / phase96-timer-line.spec.ts:53 / phase9-main-details.spec.ts:47 / phase9-mini-idle.spec.ts:53,82 / today-global-timer.spec.ts:49 |
| `windowTimerLine` | クラス | phase96-timer-line.spec.ts:27,62,66,72,150,185,189,195,197 |
| `expandedTimerClock` | クラス | phase810-expanded-timer.spec.ts:51,53,64,95,114 / phase95-timer-toast-clock.spec.ts:144 / phase9-timer-action-text.spec.ts:146 |
| `timerActionText` | クラス | phase9-mini-idle.spec.ts:81 / phase9-timer-action-text.spec.ts:42,100,115,132,170 |
| `miniShell` | クラス | phase97-small-fixes.spec.ts:296,325 / phase9-mini-idle.spec.ts:16,37 / phase9-timer-action-text.spec.ts:193 |
| `timerStartDuration` | クラス | phase72-selection-edit-menus.spec.ts:117,118,126,130,134 |
| `windowTimerLineFill` | クラス | phase96-timer-line.spec.ts:29,82,103,113,232 |
| `timerControls` | クラス | phase9-mini-idle.spec.ts:55 / post-v133c-followup.spec.ts:162,192 |
| `timerPanel--mini` | クラス | phase9-mini-idle.spec.ts:46,76 / phase9-timer-action-text.spec.ts:170 |
| `timerStartHoverGlyph` | クラス | phase72-selection-edit-menus.spec.ts:127,129,135 |
| `expandedTimer` | クラス | phase96-titlebar.spec.ts:745,748 |
| `expandedTimerTask` | クラス | phase9-timer-action-text.spec.ts:48,142 |
| `timerPresetButton` | クラス | phase810-timer-focus.spec.ts:37,45 |
| `timerPresetInputWrap` | クラス | phase810-timer-focus.spec.ts:39,48 |
| `timerProgress` | クラス | phase82-countup-ui.spec.ts:50 / phase9-mini-idle.spec.ts:54 |
| `expandedTimerBackdrop` | クラス | phase810-expanded-timer.spec.ts:101 |
| `expandedTimerProgress` | クラス | phase810-expanded-timer.spec.ts:113 |
| `miniQuietText` | クラス | phase9-mini-idle.spec.ts:49 |
| `miniTopline` | クラス | phase97-small-fixes.spec.ts:331 |
| `timerHint` | クラス | phase9-main-details.spec.ts:50 |
| `timerMeta` | クラス | phase9-mini-idle.spec.ts:47 |
| `windowTimerLineGroove` | クラス | phase96-timer-line.spec.ts:30 |
| `aria-label="通常タイマーの分数"` | aria-label | phase9-main-details.spec.ts:52 |
| `role="dialog" name="拡大タイマー"` | role | phase810-expanded-timer.spec.ts:18,36,40,78,92,112,127,160,167,188,207,217,232,249,268,273,286,292 / phase95-timer-toast-clock.spec.ts:98,141 / phase9-timer-action-text.spec.ts:47 / phase9-visual.spec.ts:85 |
| `role="button" name="タイマーを大きく表示"` | role | phase810-expanded-timer.spec.ts:34,37,77,91,111,126,159,265,271,285 / phase95-timer-toast-clock.spec.ts:97,140 / phase96-titlebar.spec.ts:744 / phase9-timer-action-text.spec.ts:46,141 / phase9-visual.spec.ts:84 |
| `画面の文字「実行中」` | text | phase6-readiness.spec.ts:90,96,97,114 / phase7-early-completion.spec.ts:370 / phase810-expanded-timer.spec.ts:58,136 |
| `画面の文字「一時停止中」` | text | phase810-expanded-timer.spec.ts:55 / phase95-timer-toast-clock.spec.ts:100 |

**記録**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `recordsView` | クラス | phase83-clean-start.spec.ts:145 / phase8-records.spec.ts:23 / phase95-timer-toast-clock.spec.ts:307,321,384 / phase96-timer-line.spec.ts:177,264 / phase96-titlebar.spec.ts:266,305 / phase97-small-fixes.spec.ts:182,197,219,226,227 / phase97-toast-colors.spec.ts:60 / phase9-dialog-details.spec.ts:323,355 / phase9-visual.spec.ts:138 |
| `recordsCompactRow` | クラス | phase8-records.spec.ts:130,131,134,136,180 / phase97-small-fixes.spec.ts:227 / phase97-toast-colors.spec.ts:63 |
| `recordsAccordionSummary` | クラス | phase8-records.spec.ts:94 / phase95-timer-toast-clock.spec.ts:396 / phase97-small-fixes.spec.ts:219 |
| `recordsOlderNotes` | クラス | phase8-records.spec.ts:146 / phase9-dialog-details.spec.ts:369,394 |
| `recordsSection` | クラス | phase8-records.spec.ts:102 / phase95-timer-toast-clock.spec.ts:384,434 |
| `recordsStats` | クラス | phase83-clean-start.spec.ts:147 / phase95-timer-toast-clock.spec.ts:345 / phase97-small-fixes.spec.ts:182 |
| `recordsAccordion` | クラス | phase8-records.spec.ts:105,111 |
| `recordsActionHistoryRow` | クラス | phase8-records.spec.ts:106,109 |
| `recordsAccordionList` | クラス | phase95-timer-toast-clock.spec.ts:389 |
| `recordsBackButton` | クラス | phase9-dialog-details.spec.ts:326 |
| `recordsInlineHeading` | クラス | phase8-records.spec.ts:168 |
| `recordsSessionMenuButton` | クラス | phase8-records.spec.ts:181 |
| `recordsViewHeader` | クラス | post-v133c-followup.spec.ts:215 |
| `sourceCompletionRow` | クラス | phase95-timer-toast-clock.spec.ts:404 |
| `sourceCompletionSection` | クラス | phase95-timer-toast-clock.spec.ts:402 |
| `weeklyReviewBlockHeading` | クラス | phase95-timer-toast-clock.spec.ts:425 |
| `role="tab" name="すべての記録"` | role | phase83-clean-start.spec.ts:149 / phase8-records.spec.ts:119,179 / phase95-timer-toast-clock.spec.ts:433 / phase97-small-fixes.spec.ts:226 / phase97-toast-colors.spec.ts:62 / phase9-dialog-details.spec.ts:336,356 |

**ダイアログ**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `modalBackdrop` | クラス | phase61-wishlist-modal.spec.ts:146,198 / phase81-entry-contracts.spec.ts:135 / phase81-layout-qa.spec.ts:313 / phase84-today-picker.spec.ts:217 / phase87-drop-register.spec.ts:131 / phase96-titlebar.spec.ts:672 |
| `formDialogActions` | クラス | phase81-layout-qa.spec.ts:361,395 / phase87-instruction-viewer.spec.ts:165 / phase8-records.spec.ts:143,157 / post-v133a-additional-fixes.spec.ts:275 |
| `projectColorPalette` | クラス | phase97-colors.spec.ts:76,87,101,118 |
| `shortcutCaptureField` | クラス | phase97-close-button.spec.ts:251 / phase9-dialog-details.spec.ts:140,144,163 |
| `startEnvironmentSelectedItem` | クラス | phase62-quick-picker.spec.ts:139,160,168,195 |
| `dialogActions` | クラス | phase61-wishlist-modal.spec.ts:78 / phase62-quick-picker.spec.ts:143 / phase71-edit-sync.spec.ts:88 |
| `dropDialog` | クラス | phase97-import.spec.ts:495,503,515 |
| `eyebrow` | クラス | phase9-dialog-details.spec.ts:59,65,75 |
| `numberDragUnit` | クラス | phase9-dialog-details.spec.ts:86,88,93 |
| `settingsVersion` | クラス | phase97-version.spec.ts:38,49,51 |
| `shortcutCaptureField--conflict` | クラス | phase9-dialog-details.spec.ts:190 / post-v133b-followup.spec.ts:165,169 |
| `buttonEditDialogFooter` | クラス | phase87-dictionary-ux.spec.ts:56 / phase87-followup-polish.spec.ts:29 |
| `confirmDialogActions` | クラス | phase62-source-lifecycle.spec.ts:90,129 |
| `importDropZone--active` | クラス | phase97-import.spec.ts:474,480 |
| `projectDangerZone` | クラス | phase84-project-delete-and-wishlist-today.spec.ts:162,212 |
| `settingsDialogActions` | クラス | phase83-settings-maintenance.spec.ts:48,151 |
| `settingsSection` | クラス | phase97-version.spec.ts:36 / phase9-dialog-details.spec.ts:199 |
| `confirmBackdrop` | クラス | phase7-early-completion.spec.ts:288 |
| `dropRegisterActions` | クラス | phase87-drop-register.spec.ts:78 |
| `helpGuideBackdrop` | クラス | phase61-guide.spec.ts:68 |
| `helpGuideBody` | クラス | phase8-guide-sync.spec.ts:22 |
| `helpGuideCodeBlock` | クラス | phase61-guide.spec.ts:121 |
| `helpGuideFooter` | クラス | phase87-followup-polish.spec.ts:131 |
| `importDropOverlay` | クラス | phase97-import.spec.ts:472 |
| `importDropZone--main` | クラス | phase97-import.spec.ts:474 |
| `importDropZone--sidebar` | クラス | phase97-import.spec.ts:480 |
| `maintenanceGroup` | クラス | phase83-settings-maintenance.spec.ts:79 |
| `maintenanceGroups` | クラス | phase9-dialog-details.spec.ts:204 |
| `modalDragBand` | クラス | phase96-titlebar.spec.ts:672 |
| `numberDragAffordance` | クラス | phase9-dialog-details.spec.ts:94 |
| `settingsSection--hidden` | クラス | phase9-dialog-details.spec.ts:199 |
| `settingsTabs` | クラス | phase97-small-fixes.spec.ts:40 |
| `shortcutCaptureControl` | クラス | phase9-dialog-details.spec.ts:168 |
| `shortcutCaptureValue` | クラス | phase97-close-button.spec.ts:254 |
| `startEnvironmentCount` | クラス | phase62-quick-picker.spec.ts:225 |
| `role="dialog" name="設定"` | role | phase81-entry-contracts.spec.ts:509,548 / phase83-clean-start.spec.ts:44,164 / phase83-settings-maintenance.spec.ts:27,47 / phase83-software-reset.spec.ts:65,99,114,378 / phase89-main-display.spec.ts:43 / phase95-settings-keyboard.spec.ts:17 / phase96-titlebar.spec.ts:658,693,710,715,719 / phase97-close-button.spec.ts:217,248,296 / phase97-import.spec.ts:228 / phase97-small-fixes.spec.ts:37 / phase97-test-profile.spec.ts:43 / phase97-toast-colors.spec.ts:47 / phase97-version.spec.ts:24 / phase9-color-roles.spec.ts:115,198,229 / phase9-dialog-details.spec.ts:43,277 / phase9-visual.spec.ts:99 / post-v133a-additional-fixes.spec.ts:48 / post-v133b-followup.spec.ts:160,225 / toast-dialog-placement.spec.ts:77 / today-global-timer.spec.ts:31 |
| `role="dialog" name="使い方"` | role | phase61-guide.spec.ts:26 / phase87-dictionary-ux.spec.ts:42 / phase87-followup-polish.spec.ts:132 / phase8-guide-sync.spec.ts:12 / phase96-titlebar.spec.ts:730,733 |
| `role="tab" name="基本"` | role | phase83-settings-maintenance.spec.ts:68 / phase95-settings-keyboard.spec.ts:54,77,100,191 / phase97-close-button.spec.ts:298 / phase97-version.spec.ts:48 / phase9-dialog-details.spec.ts:209 / phase9-visual.spec.ts:100 / post-v133b-followup.spec.ts:228 |

**トースト**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `toast` | クラス | phase6-main.spec.ts:339 / phase71-edit-sync.spec.ts:103,183 / phase72-completion-feedback.spec.ts:189 / phase72-followup-five.spec.ts:146,164 / phase72-selection-edit-menus.spec.ts:80 / phase72-toast-undo.spec.ts:48,63,77,87,99,148,163,167,171,173,178 / phase7-audit.spec.ts:118 / phase7-early-completion.spec.ts:248,264 / phase83-clean-start.spec.ts:129 / phase83-settings-maintenance.spec.ts:110,115,118,124,130,143 / phase83-software-reset.spec.ts:175,210,293,314,354,382 / phase84-today-picker.spec.ts:190 / phase84-today-remove-dropzone.spec.ts:119,148 / phase87-drop-register.spec.ts:107 / phase87-instruction-viewer.spec.ts:51,92 / phase97-close-button.spec.ts:270 / phase97-small-fixes.spec.ts:241 / phase97-toast-colors.spec.ts:14,114 / phase9-flow.spec.ts:335 / today3-remove.spec.ts:45,146,178 |
| `toast--error` | クラス | phase81-entry-contracts.spec.ts:558 / phase84-project-delete-and-wishlist-today.spec.ts:192 / phase84-section-empty-state-polish.spec.ts:150 / toast-dialog-placement.spec.ts:68,81,101,104 |
| `toast--warn` | クラス | phase81-entry-contracts.spec.ts:555 / phase84-project-delete-and-wishlist-today.spec.ts:98,118,124 / phase84-section-empty-state-polish.spec.ts:149,166 |
| `toastStack` | クラス | phase95-timer-toast-clock.spec.ts:86 / toast-dialog-placement.spec.ts:46,107 |

**メニュー**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `sourceRowMenu` | クラス | phase81-layout-qa.spec.ts:189 / phase84-source-lock-ui.spec.ts:71 / phase84-wishlist-nextstep-hover.spec.ts:70,71 |
| `todayRowMenu` | クラス | dashboard-disclosure-context.spec.ts:30,40 / phase72-followup-five.spec.ts:73 |
| `nextStepRegionMenu` | クラス | phase82-nextstep-wishlist.spec.ts:586 / phase84-source-lock-ui.spec.ts:31 |
| `role="menuitem" name="編集"` | role | phase61-wishlist-modal.spec.ts:193 / phase62-quick-picker.spec.ts:186 / phase6-dictionary.spec.ts:196,224 / phase71-edit-sync.spec.ts:28,124,167 / phase72-followup-five.spec.ts:68,74 / phase81-generation-boundary.spec.ts:200 / phase84-source-lock-ui.spec.ts:77 / phase87-dictionary-ux.spec.ts:53 / phase87-followup-polish.spec.ts:22 / phase8-entry-forms.spec.ts:39,85 / phase8-records.spec.ts:139 / phase9-dialog-details.spec.ts:56 |
| `role="menu"` | role | phase6-dictionary.spec.ts:240 / phase81-layout-qa.spec.ts:218,243,272,287 / phase82-nextstep-wishlist.spec.ts:42,466 / phase87-dictionary-ux.spec.ts:97 / phase87-instruction-viewer.spec.ts:148 / phase97-mhtml.spec.ts:189 / phase9-main-details.spec.ts:158,172 / post-v133c-followup.spec.ts:53,94 / today3-remove.spec.ts:120 |

**辞書**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `dictionaryTile` | クラス | phase62-quick-picker.spec.ts:76,116 / phase6-dictionary.spec.ts:83,114,119,122,127,134,140,142,144,147,159,161,173,193,207,258,289,290,292 / phase87-dictionary-ux.spec.ts:50,119,122,139 / phase8-dictionary-state.spec.ts:34,83,107,143,154,167 |
| `dictionaryWindowShell` | クラス | phase87-dictionary-ux.spec.ts:105,138 / post-v133b-followup.spec.ts:196 / public-screenshots.spec.ts:47 |
| `dictionaryTile--selected` | クラス | phase8-dictionary-state.spec.ts:89,100,136 |
| `dictionarySearchInput` | クラス | post-v133b-followup.spec.ts:203,206 |
| `dictionaryMainScrim` | クラス | phase87-dictionary-ux.spec.ts:40 |
| `dictionaryPageTabs` | クラス | post-v133b-followup.spec.ts:202 |
| `dictionarySearchResult` | クラス | phase6-dictionary.spec.ts:295 |
| `dictionarySettingsBackdrop` | クラス | phase87-dictionary-ux.spec.ts:87 |
| `dictionaryWindowBody` | クラス | phase8-dictionary-state.spec.ts:109 |
| `dictionaryWindowLock` | クラス | post-v133b-followup.spec.ts:200 |
| `dictionaryWindowTitleActions` | クラス | post-v133b-followup.spec.ts:197 |
| `dictionaryWindowTitlebar` | クラス | phase87-dictionary-ux.spec.ts:95 |
| `role="dialog" name="辞書の設定"` | role | phase87-dictionary-ux.spec.ts:84,100 / phase9-dialog-details.spec.ts:74,307 |

**手順書**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `instructionTreeRow` | クラス | phase81-entry-contracts.spec.ts:360,362,399,403,438,441 / phase87-instruction-viewer.spec.ts:90,143,145,160,162 / phase96-viewer-keyboard.spec.ts:43,48,70,75,178 / phase97-mhtml.spec.ts:178,179,210,213,216,219 / phase97-small-fixes.spec.ts:139,152 / public-screenshots.spec.ts:58,60 |
| `instructionDocument` | クラス | phase96-viewer-keyboard.spec.ts:81,85,89,96,144,234-236 / phase97-mhtml.spec.ts:262 |
| `instructionHtmlFrame` | クラス | instruction-html-browser-parity.spec.ts:60,135,221 / phase87-instruction-viewer.spec.ts:184 / phase96-viewer-keyboard.spec.ts:158 / phase97-mhtml.spec.ts:68 |
| `instructionFileIcon` | クラス | phase97-mhtml.spec.ts:183,224,227 |
| `instructionPickerSelection` | クラス | phase81-entry-contracts.spec.ts:307 / phase8-entry-forms.spec.ts:49,54 |
| `instructionTreeLoad` | クラス | phase87-instruction-viewer.spec.ts:49,50,71 |
| `instructionTreeName` | クラス | phase97-mhtml.spec.ts:214,217,220 |
| `instructionDocument--html` | クラス | instruction-html-browser-parity.spec.ts:151,153 |
| `instructionHeaderTitle` | クラス | phase96-viewer-keyboard.spec.ts:97,143 |
| `instructionProjectLinkPreview` | クラス | phase81-entry-contracts.spec.ts:373,379 |
| `check-item` | クラス | instruction-html-browser-parity.spec.ts:228 |
| `html` | クラス | instruction-html-browser-parity.spec.ts:192 |
| `instructionEditorTextarea` | クラス | phase96-viewer-keyboard.spec.ts:215 |
| `instructionHeader` | クラス | phase96-viewer-keyboard.spec.ts:193 |
| `instructionHeaderActions` | クラス | phase96-titlebar.spec.ts:642 |
| `instructionIconButton` | クラス | phase96-titlebar.spec.ts:642 |
| `instructionProjectLinkFooter` | クラス | phase81-entry-contracts.spec.ts:385 |
| `instructionProjectLinkSourceCard` | クラス | phase81-entry-contracts.spec.ts:367 |
| `instructionSearchField` | クラス | phase96-viewer-keyboard.spec.ts:174 |
| `instructionSidebar` | クラス | phase87-instruction-viewer.spec.ts:115 |
| `instructionTreeMessage` | クラス | phase87-instruction-viewer.spec.ts:42 |
| `instructionWorkspace` | クラス | phase87-instruction-viewer.spec.ts:130 |

**共通**

| 目印 | 種類 | 使っている spec:行 |
| --- | --- | --- |
| `disclosure` | クラス | phase62-source-lifecycle.spec.ts:85,122,153,184 / phase6-main.spec.ts:180 / phase6-readiness.spec.ts:143 / phase72-lists-timer-size.spec.ts:43,96 / phase72-selection-edit-menus.spec.ts:43 / phase810-activity-axis.spec.ts:27 / phase810-timer-focus.spec.ts:25,51 / phase81-entry-contracts.spec.ts:104 / phase81-layout-qa.spec.ts:96 / phase81-source-followup.spec.ts:324 / phase82-nextstep-wishlist.spec.ts:28,375 / phase83-clean-start.spec.ts:100 / phase84-nextstep-create-pick.spec.ts:16 / phase84-project-delete-and-wishlist-today.spec.ts:196 / phase84-section-empty-state-polish.spec.ts:30,79,152 / phase84-wishlist-nextstep-hover.spec.ts:15 / phase8-entry-forms.spec.ts:61,89 / phase97-wishlist-layout.spec.ts:26 / phase9-dialog-details.spec.ts:54 / phase9-main-details.spec.ts:113 / post-v133b-followup.spec.ts:68,105,128 |
| `disclosureCount` | クラス | phase72-lists-timer-size.spec.ts:75 / phase81-layout-qa.spec.ts:134,135 / phase83-clean-start.spec.ts:77,161 / phase87-followup-polish.spec.ts:74 / phase95-timer-toast-clock.spec.ts:522 / phase9-main-details.spec.ts:102-104 |
| `completionParticle` | クラス | phase72-completion-feedback.spec.ts:108,116,144,178,212,227,241 |
| `disclosureHeader` | クラス | phase810-activity-axis.spec.ts:36 / phase82-nextstep-wishlist.spec.ts:500 / phase87-followup-polish.spec.ts:53,87 / phase8-entry-forms.spec.ts:77 / post-v133a-additional-fixes.spec.ts:29 |
| `sectionHeading` | クラス | phase95-timer-toast-clock.spec.ts:388,394,403,410,434 |
| `accent` | クラス | phase97-mhtml.spec.ts:78,79,118,119 |
| `focusBand` | クラス | phase6-readiness.spec.ts:153 / phase84-today-picker.spec.ts:11 / phase89-main-display.spec.ts:20 / phase96-titlebar.spec.ts:43 |
| `projectDragGhost` | クラス | phase84-nextstep-today3-dnd.spec.ts:67,78,116,135 |
| `sectionEmptyState` | クラス | phase84-section-empty-state-polish.spec.ts:69,83,140,157 |
| `banner` | クラス | phase81-entry-contracts.spec.ts:489,495,507 |
| `disclosureDescription` | クラス | phase95-timer-toast-clock.spec.ts:523 / phase9-heading-victory-polish.spec.ts:50 |
| `sectionLinkButton` | クラス | phase95-timer-toast-clock.spec.ts:435,437 |
| `uiIcon` | クラス | phase87-followup-polish.spec.ts:113,153 |
| `completionParticleLayer` | クラス | phase72-completion-feedback.spec.ts:372 |
| `disclosureLabel` | クラス | phase87-followup-polish.spec.ts:73 |
| `mainActionButton--gold` | クラス | phase83-main-action-hover.spec.ts:78 |
| `secondaryButton` | クラス | phase96-titlebar.spec.ts:780 |
| `shortStartButton` | クラス | phase6-main.spec.ts:174 |
| `sourceListControls` | クラス | phase72-lists-timer-size.spec.ts:84 |
| `sourceListPagination` | クラス | phase72-lists-timer-size.spec.ts:85 |
| `startButton` | クラス | phase6-main.spec.ts:174 |

### M-3 画面の比較の基準画像

`toHaveScreenshot` の呼び出しは 12 箇所、画像は 17 枚。すべて `tests/visual/<spec>.ts-snapshots/` にあり、ファイル名の末尾は `-win32`。

| フォルダ | ファイル | どの spec（呼び出し行）・テスト名 |
| --- | --- | --- |
| `phase9-visual.spec.ts-snapshots` | `main-standard-win32.png` | `phase9-visual.spec.ts:71` `P9-00 visual main-standard` |
| `phase9-visual.spec.ts-snapshots` | `main-large-win32.png` | `phase9-visual.spec.ts:71` `P9-00 visual main-large` |
| `phase9-visual.spec.ts-snapshots` | `main-xlarge-win32.png` | `phase9-visual.spec.ts:71` `P9-00 visual main-xlarge` |
| `phase9-visual.spec.ts-snapshots` | `main-min-win32.png` | `phase9-visual.spec.ts:71` `P9-00 visual main-min` |
| `phase9-visual.spec.ts-snapshots` | `main-running-win32.png` | `phase9-visual.spec.ts:78` `P9-00 visual main-running` |
| `phase9-visual.spec.ts-snapshots` | `timer-expanded-win32.png` | `phase9-visual.spec.ts:86` `P9-00 visual timer-expanded` |
| `phase9-visual.spec.ts-snapshots` | `today-picker-win32.png` | `phase9-visual.spec.ts:93` `P9-00 visual today-picker` |
| `phase9-visual.spec.ts-snapshots` | `settings-basic-win32.png` | `phase9-visual.spec.ts:101` `P9-00 visual settings-basic` |
| `phase9-visual.spec.ts-snapshots` | `mini-idle-win32.png` | `phase9-visual.spec.ts:106` `P9-00 visual mini-idle` |
| `phase9-visual.spec.ts-snapshots` | `mini-running-win32.png` | `phase9-visual.spec.ts:127` `P9-00 visual mini-running` |
| `phase9-visual.spec.ts-snapshots` | `records-review-win32.png` | `phase9-visual.spec.ts:141` `P9-00 visual records-review` |
| `phase9-visual.spec.ts-snapshots` | `records-week-win32.png` | `phase9-visual.spec.ts:141` `P9-00 visual records-week` |
| `phase9-visual.spec.ts-snapshots` | `records-all-win32.png` | `phase9-visual.spec.ts:141` `P9-00 visual records-all` |
| `phase97-colors.spec.ts-snapshots` | `phase97-project-colors-win32.png` | `phase97-colors.spec.ts:81` `the project editor shows twelve colors and every color survives save and reload` |
| `phase97-import.spec.ts-snapshots` | `phase97-import-drop-main-win32.png` | `phase97-import.spec.ts:475` `routes a JSON drop by the side and shows the two-zone overlay` |
| `phase97-import.spec.ts-snapshots` | `phase97-import-drop-sidebar-win32.png` | `phase97-import.spec.ts:481` `routes a JSON drop by the side and shows the two-zone overlay` |
| `phase97-wishlist-layout.spec.ts-snapshots` | `phase97-wishlist-layout-win32.png` | `phase97-wishlist-layout.spec.ts:148` `the wishlist section keeps the new layout` |

### M-4 `tests/visual/fixtures.ts` の偽データ

基準日時は `FIXTURE_DATE = "2026-08-13"`、`FIXTURE_NOW = "2026-08-13T09:30:00+09:00"`（`tests/visual/fixtures.ts:10-11`）。fixture は `public` / `phase9-full` / `phase9-picker` / `phase9-running` の 4 種（`fixtures.ts:14`、`fixtures.ts:189,339,357,364`）。

#### プロジェクト（`fixtures.ts:88-118`、`fixtures.ts:247-298`）

| id | 名前 | 色 | weeklyFocus | northStar | 次の一手（generationId / 分数） |
| --- | --- | --- | --- | --- | --- |
| `sample-learning` | サンプル学習 | `blue` | true | 小さな一手から理解を深める | 資料を1ページ読む（`gen-learning-1`、通常25分/短5分、trigger「サンプル資料」、buttonIds `["sample-documents"]`、instructionPath は手順書ルートの `guide.md`） |
| `sample-stretch` | ストレッチ | `green` | true | 無理なく体を整える | 5分だけ体を動かす（`gen-stretch-1`、通常20分/短5分、buttonIds `[]`） |
| `sample-writing` | 文章づくり | `violet` | false | 毎日少しずつ書く | 見出しを3つ書き出す（`gen-writing-1`、25分/5分） |
| `sample-music` | 音づくり | `rose` | false | 短いループを1本仕上げる | ドラムの音を1つ選ぶ（`gen-music-1`、25分/5分） |
| `sample-home` | 暮らしの整理 | `orange` | false | 部屋を軽く保つ | 引き出しを1段だけ片づける（`gen-home-1`、20分/5分） |

`public` は上の 2 件だけ。`phase9-*` は 5 件で、`sample-learning` / `sample-stretch` にも generationId が付く。

#### fixture ごとの差（`fixtures.ts:339-367`）

| 項目 | `public` | `phase9-full` / `phase9-running` | `phase9-picker` |
| --- | --- | --- | --- |
| 今日の3件 | 2 件（1 件 done） | 3 件（1 件 done、先頭に `shortTimerMinutes: 1`） | 0 件 |
| 今日の3件の中身 | 資料を1ページ読む（`project:sample-learning`）/ 机の上を5分だけ整える（`manual:fixture-cleanup`、done） | 資料を1ページ読む（`project:sample-learning`、`sourceGenerationId: gen-learning-1`）/ 机の上を5分だけ整える（done）/ 週末に試すアイデア（`wishlist:sample-weekend`） | なし |
| やりたいこと（inbox） | 2 件 | 5 件（`sample-book`・`sample-walk`・`sample-shelf` を追加） | 5 件 |
| Do Now 候補 | 2 件（learning=`manualOrder` / stretch=`noToday`） | 5 件（先頭だけ `manualOrder`、残り `noToday`） | 5 件 |
| Session 行 | 2 件 | 4 件（`phase9-session-3` 文章づくり 08-11 15分 / `phase9-session-4` 音づくり 08-10 30分） | 4 件 |
| name | `public` | `phase9-full` / `phase9-running` | `phase9-picker` |

#### 共通の設定値（`fixtures.ts:119-160`）

| 項目 | 値 |
| --- | --- |
| `groups` | `["ショートカット", "資料", "リンク"]` |
| `overlayPages` | `tools`=「ツール」、`reference`=「参考資料」 |
| `dictionaryOrder` | `["sample-editor", "sample-documents", "reference-site"]` |
| `today.victory` | テキスト「最優先の一手を始める」、`done: false` |
| `sourceCompletions` | `[]` |
| `settings.alwaysOnTop` | `false` |
| `settings.focusHotkey` / `miniHotkey` / `instructionHotkey` | `null` |
| `settings.launcherHotkey` | `Ctrl+K` |
| `settings.autoStart` | `false` |
| `settings.defaultTimerMinutes` / `shortTimerMinutes` | `25` / `5` |
| `settings.dayStartHour` | `4` |
| `settings.backupFolder` / `backupKeep` | バックアップ先のパス（`fixtures.ts:152`）/ `30` |
| `settings.miniMode` | `true` |
| `settings.miniWindowPosition` | `null` |
| `settings.restartShortFirst` | `true` |
| `settings.instructionFolders` | 手順書ルート 1 件（`fixtures.ts:36` の `INSTRUCTION_ROOT`） |
| `settings.instructionFolderIdentities` | `[]` |
| ボタン | 3 件: `sample-editor`「サンプルエディター」（ショートカット、`open_app`）/ `sample-documents`「サンプル資料」（資料、`open_folder`）/ `reference-site`「参考サイト」（リンク、サイドバー非表示、`open_url`） |
| sessionSummary | `todayMinutes: 25`、`weekMinutes: 75`、`activeDays: 3`、プロジェクト別 学習 2日/50分・ストレッチ 1日/25分、allTime 学習 8日/210分・ストレッチ 5日/95分、`path` はセッション JSONL のパス |
| weeklyReview | `weekKey: "2026-W33"`、前週 `2026-08-03`〜`2026-08-09`、`totalMinutes: 75`、`activeDays: 3` |
| todayNotes / notesHistory | `["公開撮影用の合成メモ"]` / `[{ date: "2026-08-12", items: ["前日の合成メモ"] }]` |

#### `tests/visual/tauriMock.ts`

`installTauriMock(page, fixture, currentWindowLabel, softwareResetRecovery, options)` が `window.__TAURI_INTERNALS__.invoke` と `window.__LIFE_LAUNCHER_VISUAL_QA__` を差し込み、`invoke` は `load_config` に fixture の `config`（sessionStorage の保存値があればそれ）、`save_config` に保存後の config、`load_session_summary` / `load_session_entries` / `load_weekly_review` / `load_do_now_candidates` / `load_today_notes` に fixture の各値、`record_session` に当日合計、`execute_actions` に成功/失敗/遅延の結果、`plugin:window|*` にメモリ上のウィンドウ状態を返し、未知の command は `null` を返す（`tauriMock.ts:317-870`）。`fixture.instructionDocuments` / `instructionBytes` / `instructionExtraEntries` / `instructionTooLargePaths` は手順書・MHTML 用の追加データ。

## N. 版と公開の物

### N-1 版の数字が書いてある 5 か所

`tests/visual/readme-contract.spec.ts` が突き合わせている 5 ファイル（`package.json`・`CHANGELOG.md`・`src-tauri/Cargo.toml`・`src-tauri/Cargo.lock`・`src-tauri/tauri.conf.json`）の今の値は、すべて `1.4.3`。

| ファイル:行 | 今の値（コードのまま） | 読み取り方 |
| --- | --- | --- |
| `package.json:4` | `"version": "1.4.3",` | アプリ版の基準（`readme-contract.spec.ts:6`） |
| `src-tauri/tauri.conf.json:4` | `"version": "1.4.3",` | `tauriConfig.version` と一致することを検査（`readme-contract.spec.ts:86`） |
| `src-tauri/Cargo.toml:3` | `version = "1.4.3"` | 正規表現で一致を検査（`readme-contract.spec.ts:82`） |
| `src-tauri/Cargo.lock:2052` | `version = "1.4.3"`（`name = "life-launcher"` は 2051 行） | パッケージ名＋版の並びで検査（`readme-contract.spec.ts:83-85`） |
| `CHANGELOG.md:3` | `## 1.4.3 - 2026-11-08` | 公開済み版の取り出し元（`readme-contract.spec.ts:8`） |

同じ数字が入っている別の場所。

| ファイル:行 | 値 | 備考 |
| --- | --- | --- |
| `package-lock.json:3` | `"version": "1.4.3",` | ルートの版 |
| `package-lock.json:9` | `"version": "1.4.3",` | `packages[""]` の版 |
| `docs/spec/current-spec.md:1` | `# Life Launcher v1.4.3 UI/UX・機能仕様書` | 仕様書の題 |
| `docs/spec/current-spec.md:7` | `| 文書版 | 1.4.3 |` | 文書版 |
| `docs/spec/current-spec.md:9` | `Public repository \`Takuyakou/life-launcher\` のv1.4.3実装` | 実装基準 |
| `docs/spec/current-spec.md:17` | `アプリ版は\`1.4.3\`、config schemaは\`3\`である。` | 本文 |
| `CHANGELOG.md:40` | `Life-Launcher-v1.4.3-windows-x64-setup.exe` など 3 ファイル名 | 配布物名 |
| `CHANGELOG.md:41` | `[v1.4.3 Release notes](docs/releases/v1.4.3.md)` | リリースノート参照 |
| `docs/releases/v1.4.3.md` | ファイルとして存在 | `readme-contract.spec.ts:80` が存在を検査 |

版の数字を直接書かずに参照している場所。

| ファイル:行 | 内容 |
| --- | --- |
| `src/version.ts:2` | `declare const __APP_VERSION__: string;` |
| `src/version.ts:4` | `export const APP_VERSION = __APP_VERSION__;` |
| `vite.config.ts:9-11` | `__APP_VERSION__` を `package.json` の `version` で置き換える（`JSON.stringify(packageJson.version)`） |
| `src/App.tsx:14135-14137` | 設定のメンテナンス欄に `バージョン {APP_VERSION}` を表示（`className="quietText quietText--small settingsVersion"`） |
| `tests/visual/phase97-version.spec.ts:33` | `the Maintenance tab shows the package version at the bottom without controls` |
| `README.md:68` / `:74` / `:80` | `Life-Launcher-v<バージョン>-windows-x64-setup.exe` / `...exe` / `...-portable.zip`（数字ではなくプレースホルダ） |
| `README.en.md:68` / `:74` / `:80` | `Life-Launcher-v<version>-...`（同上） |
| `README.md:136` / `README.en.md:136` | `release-candidate/v<バージョン>/...` / `release-candidate/v<version>/...`（同上） |
| `tests/visual/readme-contract.spec.ts:56-59` | README にプレースホルダの 3 行があることを検査し、実数字は禁止 |

分からなかったこと: NSIS のインストーラー定義（`src-tauri/installer/`）やパッケージ用スクリプト（`scripts/*.ps1`）に版の数字を直接書いている箇所は無く、すべて Tauri / Cargo の値から入る作りに見えるが、生成物の版埋め込みを実際に確認した記録は無い。

### N-2 画面の形を説明・写している所

**README（`README.md` と `README.en.md`）が写している画像**（両ファイルで行番号は同じ）。

| 参照 | 画像 | 何を写しているか（ファイル名・README の説明） |
| --- | --- | --- |
| `README.md:11` / `README.en.md:11` | `docs/screenshots/main-dashboard.png` | `![Life Launcher メインダッシュボード]` / `![Life Launcher main dashboard]` |
| `README.md:19` / `README.en.md:19` | `docs/screenshots/web-demo.png` | `<img src="docs/screenshots/web-demo.png" alt="Life Launcher Web Demo" width="720">` |
| `README.md:54` / `README.en.md:54` | `docs/screenshots/dictionary.png` と `docs/screenshots/instruction-viewer.png` | 表のセル `![検索可能な辞書]` / `![Searchable dictionary]`、`![手順書ビューア]` / `![Instructions window]` |

**README が文章で画面の形・位置を書いている行。**

| 行（両ファイル同じ） | 画面の形への言及（引用） |
| --- | --- |
| `README.md:34` / `README.en.md:34` | `今日の3件の空き枠から選択画面を開き`、`「＋ 今日へ」で選びます`、`ドラッグ中だけ表示される解除エリア`、`操作メニュー` |
| `README.md:37` / `README.en.md:37` | `カードの左下か右クリックのメニューから` |
| `README.md:40` / `README.en.md:40` | `サイドバーや\`Ctrl+K\`の検索から開けます`、`辞書は矢印キーで移動でき`、`本体のウィンドウがある画面に開きます` |
| `README.md:46` / `README.en.md:46` | `別のウィンドウで読めます` |
| `README.md:56` / `README.en.md:56` | `スクリーンショットは合成データで作っています。` / `The screenshots are generated from synthetic data.` |
| `README.md:94` | `窓の位置と大きさも引き継ぎます。`（画面の形ではないが窓の状態） |

**使い方（`src/content/helpGuide.ts`）で画面の形に触れている節。** このファイルのブロック種別は `paragraph` / `steps` / `bullets` / `definitions` / `note` / `code` / `examples` の 7 種で、画像を出す種別は無い（`src/content/helpGuide.ts:29-42`）。節は 11 個（`:54-411`）。

| 節（id） | 行 | 画面の形への言及（引用） |
| --- | --- | --- |
| `getting-started`「3分で使ってみる」 | `:54-76` | `「＋ プロジェクト」から`（:63）、`「次の一手を設定」を押し`（:64）、`「＋ 今日やるものを選ぶ」を開き`（:65）、`今日の3件にある「5分」を押して`（:66） |
| `daily-basics`「最初に覚える5つ」 | `:78-113` | 用語の定義のみ（`プロジェクト`、`次の一手`、`やりたいこと`、`今日の3件`、`今やる一手`）。画面の位置の記述は無い |
| `today-builder`「今日やるものを選ぶ」 | `:115-134` | `上のタブで「次の一手」または「やりたいこと」を選びます`（:123）、`候補の「＋ 今日へ」を押します`（:124）、`「決定」を押します`（:125） |
| `today-three`「今日の使い方」 | `:136-154` | `「今日の勝利条件」に`（:143）、`短時間・通常・計測のどれかで始めます`（:145）、`ドラッグで並べ替えられます。下の解除エリアまでドラッグすると`（:151）、`カードの「…」から「編集」`（:151） |
| `timer-completion`「タイマーと完了」 | `:156-194` | `左側の拡大ボタンで、アプリの画面に大きく表示できます`（:183）、`「次の一手を見る」を押すと`（:192） |
| `bulk-import`「まとめて取り込む」 | `:196-267` | `「次の一手」の「…」メニューから「まとめて取り込む」を開きます`（:202、:211）、`プレビューで`（:214、:228）、`トーストの「元に戻す」`（:264） |
| `start-environment`「開始環境と手順書ビューアー」 | `:269-282` | `「開始環境を選ぶ」では、アプリ・フォルダ・ファイル・URLを2件まで選べます`（:275）、`「開始時に手順書を開く」をオンにすると`（:279） |
| `launcher-dictionary`「Quickと辞書」 | `:284-314` | `メイン画面の左側に置いておく場所です`（:293）、`メイン画面の「辞書を開く」か`（:303）、`表示をタイルかリストから、アイコンの大きさを自動・小・中・大から選べます`（:307）、`Quickの横には、メイン画面を出すショートカットが表示されています`（:311） |
| `records-review`「記録を見る」 | `:316-342` | 3 つの区分 `ふりかえり` / `今週を決める` / `すべての記録`（:325、:329、:333） |
| `settings-data`「設定とデータを守る」 | `:344-362` | `設定の「バックアップ」で保存先を選ぶと`（:350）、`「バックアップから復元」を使うと`（:350）、`ソフトウェアリセットは`（:354） |
| `non-goals`「困ったとき」 | `:364-411` | `右上の×を押すか、Ctrl+Wを押します`（:377）、`カードの「今日の3件から外す」を押すか、カードを下の解除エリアまでドラッグします`（:381）、`手順書ビューアーを開き、左上の「読み込み」を押します`（:393）、`タスクトレイのメニューの「終了」`（:401） |

**公開用の画面写真（`docs/screenshots/`）の一覧。** 13 ファイル（PNG 12・README 1）。

| ファイル | 写している画面（`docs/screenshots/README.md` の説明） | 参照している場所 |
| --- | --- | --- |
| `docs/screenshots/main-dashboard.png` | `Main dashboard, 1366 x 768`（`docs/screenshots/README.md:13`） | `README.md:11`、`README.en.md:11` |
| `docs/screenshots/dictionary.png` | `Dictionary, 1000 x 640`（`:14`） | `README.md:54`、`README.en.md:54` |
| `docs/screenshots/instruction-viewer.png` | `Instruction Viewer, 1080 x 680`（`:15`） | `README.md:54`、`README.en.md:54` |
| `docs/screenshots/contact-sheet.png` | `Combined Windows product review sheet`（`:16`） | `docs/screenshots/README.md:16` のみ（README 本文の参照は無い） |
| `docs/screenshots/web-demo.png` | `Web Demo landing page and Hero mini UI, 1440 x 900`（`:17`） | `README.md:19`、`README.en.md:19` |
| `docs/screenshots/ui-05-nsis/welcome-100.png` | インストーラーのようこそ画面（100% 表示） | `docs/release/v1.3.3/ui-05-nsis-work-report.md:19`、`:34` |
| `docs/screenshots/ui-05-nsis/finish-100.png` | インストーラーの完了画面 | 同上 |
| `docs/screenshots/v1.3.4-installer/welcome-100.png` | NSIS のようこそ画面（日本語・100% DPI） | `docs/release/v1.3.3/ui-05-nsis-work-report.md:34`（フォルダの説明） |
| `docs/screenshots/v1.3.4-installer/directory-100.png` | インストール先の指定画面 | 同上 |
| `docs/screenshots/v1.3.4-installer/installing-100.png` | インストール中の画面 | 同上 |
| `docs/screenshots/v1.3.4-installer/uninstall-100.png` | アンインストール画面 | 同上 |
| `docs/screenshots/v1.3.4-installer/finish-100.png` | 完了画面 | 同上 |
| `docs/screenshots/README.md` | 画像の説明表と生成方法（`npm.cmd run screenshot:public`） | `docs/screenshots/README.md:1-21` |

補足の事実。

| 事実 | 場所 |
| --- | --- |
| README 用の 3 枚と contact-sheet は `tests/visual/public-screenshots.spec.ts` が生成する（`@manual` 指定） | `tests/visual/public-screenshots.spec.ts:35-87`、`package.json:18` |
| 生成時の viewport は main が 1366×768、dictionary が 1000×640、instruction が 1080×680、contact-sheet が 1280×920 | `tests/visual/public-screenshots.spec.ts:36`、`:43-46`、`:54-57`、`:76` |
| `web-demo.png` はこのリポジトリのテストでは作らず、別リポジトリの画像をそのまま使っている | `docs/screenshots/README.md:21` |
| アプリの既定ウィンドウは `width: 1200`、`height: 680`、最小 `860 x 560`（公開画像の 1366×768 とは別の値） | `src-tauri/tauri.conf.json:17-20` |
| README の画像パスはすべて実在する（`readme-contract.spec.ts` が `existsSync` で検査） | `tests/visual/readme-contract.spec.ts:65-67` |
| `contact-sheet.png` は README から参照されていない（`docs/screenshots/README.md` の表のみ） | 参照検索の結果 |

## O. 設計のレビューを受けて足した調べ

調査条件: 読み取りのみ（`git grep` / ファイル読み取り / PowerShell の読み取り）。作業ブランチは `chore/p10-00-investigation`、HEAD は `d211daf`。以下はすべてコードから読めた事実で、動作は実機で確認していない。実機確認していない推論にはその旨を書いた。

---

### O-1 次の一手の項目（TypeScript / Rust / 生成スキーマ）

TypeScript の型は `NextStepSchema` = `NextStepExecutionSchema.extend({...})`（`src/types.ts:104-121`）。Rust は `NextStepV3`（`src-tauri/src/models.rs:105-131`）で、`#[serde(rename_all = "camelCase")]`（`models.rs:106`）により JSON 名は TypeScript と同じ。`deny_unknown_fields` はこの構造体にもリポジトリ全体にも付いていない（`src-tauri` を grep して 0 件）。3 つ目の定義として `config.schema.json` を組み立てている文字列（`src-tauri/src/commands/config.rs:2017-2041` の `$defs.nextStep`）がある。

| 項目 | TypeScript（`src/types.ts`） | Rust（`src-tauri/src/models.rs`） | `config.schema.json` の `nextStep`（`src-tauri/src/commands/config.rs`） |
| --- | --- | --- | --- |
| `text` | `z.string()`（必須） `115` | `String`（必須） `108` | `{"type":"string"}`・`required` `2020-2022` |
| `generationId` | `z.string().min(1).optional()` `116` | `Option<String>` `109-110` | `minLength: 1` `2023` |
| `sourceWishlistId` | `z.string().min(1).optional()` `117` | **無し** | **無し** |
| `trigger` | `z.string().max(EXECUTION_TRIGGER_MAX_CHARS).optional()`（40 文字） `118` | `Option<String>` `111-112` | `minLength: 1, maxLength: 40` `2024` |
| `updatedAt` | `z.string().datetime({ offset: true }).optional()` `119` | `Option<String>` `113-114` | `format: "date-time"` `2025` |
| `reviewedAt` | `z.string().datetime({ offset: true }).optional()` `120` | `Option<String>` `115-116` | `format: "date-time"` `2026` |
| `buttonIds` | `z.array(z.string()).default([])` `105` | `Vec<String>`＋`#[serde(default)]` `117-118` | `items: minLength 1` `2027-2030` |
| `expandTimerOnStart` | `z.boolean().optional()` `106` | `Option<bool>` `123-124` | **無し** |
| `defaultTimerMinutes` | `z.number().int().min(1).max(240).optional()` `107` | `Option<u32>` `119-120` | `1..240` `2031` |
| `shortTimerMinutes` | `z.number().int().min(1).max(240).optional()` `108` | `Option<u32>` `121-122` | `1..240` `2032` |
| `startNoteTemplate` | `z.string().optional()` `109` | `Option<String>` `125-126` | `{"type":"string"}` `2033` |
| `instructionPath` | `InstructionPathSchema`（`trim` / `min(3)` / `^[A-Za-z]:[\\/]`）`110`（定義は `73-77`） | `Option<String>` `127-128` | `minLength: 3`＋`pattern: ^[A-Za-z]:[\\\\/]` `2034-2038` |
| `instructionOpenOnStart` | `z.boolean().optional()` `111` | `Option<bool>` `129-130` | `{"type":"boolean"}` `2039` |

片方にしか無い項目:

| 項目 | 状況 |
| --- | --- |
| `sourceWishlistId` | TypeScript にだけある（`src/types.ts:117`）。Rust の `NextStepV3` にも `config.schema.json` の `nextStep` にも無い。`src-tauri` 全体を `sourceWishlistId` / `source_wishlist` で grep して 0 件。 |
| その他 | Rust にだけある項目は無い（Rust の 12 項目はすべて TypeScript 側にある）。`expandTimerOnStart` は TypeScript と Rust にあるが、`config.schema.json` の `nextStep` には無い。 |

`sourceWishlistId` の扱い（コードからの読み・実機未確認）:

- `save_config` は受け取った `AppConfig` を `sanitize_config` してから `write_config` で書き出す（`src-tauri/src/commands/config.rs:91-120`、`954-958`）。Rust 側に `sourceWishlistId` の項目が無いので、保存すると JSON から消える。
- フロントは保存の応答で `setConfig(response.config)` する（`src/App.tsx:3309-3310`）。応答の `config` は Rust が組み立てた `AppConfig`（`src-tauri/src/commands/config.rs:116-119`）。
- この値は判定に使われている（`src/nextStepWishlist.ts:105-106`、`151`、`224`、`240-241`、`src/App.tsx:8505`、`8681`、`8746`、`9361-9363`）。
- Playwright の mock は `save_config` で `args.config` をそのまま保存する（`tests/visual/tauriMock.ts:365-369`）ので、テストでは残る。テストが `sourceWishlistId` の保存を確かめている箇所（`tests/visual/phase82-nextstep-wishlist.spec.ts:691`、`736`、`tests/visual/phase84-nextstep-create-pick.spec.ts:119`、`tests/visual/post-v133b-followup.spec.ts:117`）は mock 経由なので、Rust の往復は通っていない。

`legacyNextStepSettings` 側: `NextStepExecutionSchema`（`src/types.ts:104-112`）と `NextStepExecutionSettingsV3`（`src-tauri/src/models.rs:133-150`）は 7 項目（`buttonIds` / `expandTimerOnStart` / `defaultTimerMinutes` / `shortTimerMinutes` / `startNoteTemplate` / `instructionPath` / `instructionOpenOnStart`）で一致する。ただし `config.schema.json` の `nextStepExecutionSettings`（`src-tauri/src/commands/config.rs:2042-2060`）には `expandTimerOnStart` が無い。

---

### O-2 `settings` の項目と、`config.schema.json` を作る所

TypeScript は `SettingsSchema`（`src/types.ts:188-206`）、Rust は `Settings`（`src-tauri/src/models.rs:351-386`）、スキーマは `src-tauri/src/commands/config.rs:2152-2211`。

| 項目 | TypeScript（`src/types.ts`） | Rust（`src-tauri/src/models.rs`） | `config.schema.json`（`src-tauri/src/commands/config.rs`） |
| --- | --- | --- | --- |
| `alwaysOnTop` | `z.boolean()`（必須） `189` | `bool`（必須） `354` | `boolean`・`required` `2157` |
| `focusHotkey` | `z.string().nullable()`（必須） `190` | `Option<String>`（必須） `355` | `["string","null"]`・`required` `2158` |
| `launcherHotkey` | `z.string().nullable().default("Ctrl+K")` `191` | `Option<String>`＋`#[serde(default = "default_launcher_hotkey")]`（`"Ctrl+K"`） `356-357`・`784-786` | `default: "Ctrl+K"`・`required` `2159` |
| `miniHotkey` | `.nullable().default(null)` `192` | `#[serde(default)] Option<String>` `358-359` | `default: null`・`required` `2160` |
| `autoStart` | `.default(false)` `193` | `#[serde(default)] bool` `360-361` | `default: false` `2161` |
| `defaultTimerMinutes` | `z.number().int().min(1).max(240)`（**既定値なし**） `194` | `#[serde(default = "default_timer_minutes")] u16` `362-363` | `1..240`・`required` `2162` |
| `shortTimerMinutes` | `.int().min(1).max(240).default(5)` `195` | `#[serde(default = "short_timer_minutes")] u16`（5） `364-365` | `default: 5` `2163` |
| `dayStartHour` | `.int().min(0).max(23).default(4)` `196` | `#[serde(default = "default_day_start_hour")] u8`（4） `366-367` | `default: 4` `2164` |
| `backupFolder` | `.nullable().default(null)` `197` | `#[serde(default)] Option<String>` `368-369` | `default: null` `2165` |
| `backupKeep` | `.int().min(1).default(30)` `198` | `#[serde(default = "default_backup_keep")] u16`（30） `370-371` | `minimum: 1`・`default: 30` `2166` |
| `miniMode` | `.default(true)` `199` | `#[serde(default = "default_mini_mode")] bool` `372-373` | `default: true` `2167` |
| `miniWindowPosition` | `MiniWindowPositionSchema.nullable().default(null)` `200`（`183-186`） | `#[serde(default)] Option<MiniWindowPosition>` `374-375`（`337-342`） | `["object","null"]`・`required` `2201-2210` |
| `restartShortFirst` | `z.boolean().optional()` `201` | `#[serde(default, skip_serializing_if = "Option::is_none")] Option<bool>` `376-377` | `default: true` `2168` |
| `mainDisplaySize` | `z.enum(["standard","large","xlarge"]).optional()` `202` | `Option<String>` `378-379` | `enum`＋`default: "standard"` `2169` |
| `instructionFolders` | `InstructionFolderListSchema.default([])`（最大 5・重複不可・絶対パス） `203`（`79-95`） | `Option<Vec<String>>` `380-381` | `maxItems: 5`・`uniqueItems: true` `2170-2179` |
| `instructionFolderIdentities` | `z.array(...).max(5).optional()` `204`（要素は `97-102`） | `Option<Vec<InstructionFolderIdentity>>` `382-383`（`344-349`） | `maxItems: 5` `2180-2199` |
| `instructionHotkey` | `z.string().trim().min(1).nullable().optional()` `205` | `Option<String>` `384-385` | `default: null` `2200` |

差が出ている点（事実のみ）:

| 項目 | 違い |
| --- | --- |
| `defaultTimerMinutes` | TypeScript は必須（既定値なし）。Rust は `#[serde(default)]` で 25 が入る。 |
| `instructionHotkey` | TypeScript は空文字を拒否（`trim().min(1)`）。Rust は任意の `String` を受ける。 |
| `instructionFolders` | TypeScript は最大 5 件・重複禁止・絶対パス。Rust のデシアライズ時は制約なし（`sanitize_config` 側で整える）。 |
| `mainDisplaySize` | TypeScript は enum。Rust は `String`。 |
| `backupKeep` | TypeScript は `min(1)` のみ（上限なし）。Rust は `u16` なので、デシアライズでは 0 も通る（`sanitize_config` が 0 を 30 に戻す: `src-tauri/src/commands/config.rs:2737-2740`）。 |
| タイマー分数・`dayStartHour` の上限 | `240` / `23` の上限は TypeScript とスキーマだけが持ち、Rust のデシアライズ（`u16` / `u8`）では検査しない。`sanitize_config` がタイマー分数の 0 と 240 超、`dayStartHour` の 23 超を直す（`src-tauri/src/commands/config.rs:2709-2728`）。 |

知らない項目が来たときの扱い:

| 側 | 仕組み | 結果 |
| --- | --- | --- |
| TypeScript（zod） | `src` 全体を `.strict()` / `.loose()` / `.passthrough()` で grep して 0 件。`z.object()` の既定（未知キーは捨てる）がそのまま効く。zod は `^4.6.7`（`package.json:28`）。 | 知らない項目は**捨てる**。例外にならない。 |
| TypeScript（型違反・必須欠け） | `loadConfig` / `saveConfig` などは `AppConfigSchema.parse(response.config)` を通す（`src/tauri.ts:51-57`、`59-65`、`75-79`、`86-90`、`100-105`、`290`）。 | **止まる**（parse が throw）。`refreshConfig` の catch で `設定を読めません: …` を出す（`src/App.tsx:3147-3152`）。 |
| Rust（serde） | `deny_unknown_fields` は `src-tauri` 全体で 0 件。 | 知らない項目は**無視して捨てる**。エラーにならない。 |
| Rust（型違反・必須欠け） | `serde_json::from_value::<AppConfig>`（`src-tauri/src/commands/config.rs:749-750`）。 | **止まる**（`config v3 validation failed: …`）。`load_config` は初期設定を返し `save_blocked: true` にする（`645-658`）。 |

補足（コードからの読み）:

- 知らない項目があっても `load_config` の `changed` 判定には入らない（`src-tauri/src/commands/config.rs:665-688`）。そのため読み込みだけでは `config.json` は書き換わらない。次に保存したときに `write_config` が構造体を書き出すので、ファイルからは消える。フロントも zod で捨てるので、画面から保存すると同じく消える。
- `config.schema.json` は最上位も各定義も `additionalProperties: false`（`src-tauri/src/commands/config.rs:1901`、`1951`、`1960`、`1986`、`2019`、`2044`、`2063`、`2086`、`2095`、`2120`、`2140`、`2154`、`2185`、`2204`、`2217`）。エディタでこのスキーマを使って検証すると、知らない項目はエラーになる。

`config.schema.json` を作っている所:

| 役割 | 場所 |
| --- | --- |
| スキーマ本体（Rust の文字列リテラル） | `config_schema_json()` `src-tauri/src/commands/config.rs:1896-`（`r##"{...}"##`） |
| ファイル名の定数 | `CONFIG_SCHEMA_FILE_NAME = "config.schema.json"` `src-tauri/src/commands/config.rs:34`、`$schema` に入れる値 `CONFIG_SCHEMA_REF = "./config.schema.json"` `35` |
| 書き出し先 | `schema_path()` `src-tauri/src/commands/config.rs:829-831` → `config_dir_path()` `824-827` → `crate::app_paths::data_dir()` |
| 書き出し | `ensure_config_schema_file()` `src-tauri/src/commands/config.rs:853-860`（内容が同じなら何もしない／違えば `write_bytes_atomically` `876-912`） |
| 呼び出し元 | `save_config` `107`、`undo_today_selection` `248`、`load_config_from_disk` `570`、`daily_backup` `1000`・`1031`、`commit_import` `src-tauri/src/commands/import.rs:784`、`undo_import` `src-tauri/src/commands/import.rs:828` |
| 直接書く所 | `src-tauri/src/commands/reset.rs:609-610` が `config_schema_json().as_bytes()` を書く。バックアップ対象の一覧にも入っている（`src-tauri/src/commands/config.rs:48-53`、`src-tauri/src/commands/reset.rs:25`） |
| `$schema` の強制 | `sanitize_config` が `Some("./config.schema.json")` 以外なら上書きする（`src-tauri/src/commands/config.rs:1609-1612`） |
| テスト | `generated_config_schema_is_valid_json_with_project_fields` `src-tauri/src/commands/config.rs:2831-` |
| リポジトリ内のファイル | リポジトリ直下・`src`・`src-tauri` には置いていない（`config.schema.json` を glob して 0 件。`docs/phase9.7/08-colors.md:26` にも「リポジトリに書き出していない」と書かれている） |

---

### O-3 `persistConfig` の呼び出し元

定義は `src/App.tsx:3289-3353`（`DashboardApp` の中の `useCallback`）。戻り値は成功 `true` / 失敗 `false`。`resetInProgressRef.current` が立っていると即 `false`（`3291`）。第 2 引数 `applySettingsAfterSave` を渡しているのは `4666` の 1 か所だけ（`4699` で `hotkeysChanged`）。`persistConfig` を `useCallback` の依存配列に入れている参照は `3487`、`3619`、`3977`、`4578`（呼び出しではない）。

呼び出しは 52 か所。

| 行 | 呼び出し元の関数 | 何を保存するか |
| --- | --- | --- |
| `3476` | `hideMiniWindow` | `settings.miniWindowPosition` |
| `3599` | `resetMiniWindowPosition` | `settings.miniWindowPosition` を `null` |
| `3685` | `saveDefaultTimerMinutes` | `settings.defaultTimerMinutes` |
| `3958` | `requestCloseTodayPicker`（破棄確認の `onConfirm` の中） | `today.items` を開いた時の内容へ戻す |
| `4550` | `continueSoftwareReset` | `settings.backupFolder` |
| `4666` | `saveSettingsCenter` | `settings` 全部・`projects[].weeklyFocus`（第 2 引数あり） |
| `5344` | `moveButtonInSidebar` | `buttons` の並び・`group` |
| `5362` | `moveGroupInSidebar` | `groups` の並び |
| `5386` | `moveTodayItem` | `today.items` の並び |
| `5412` | `moveProject` | `projects` の並び |
| `5435` | `moveInboxItem` | `inbox` の並び |
| `5452` | `moveWishlistGroup` | `inbox`（`reorderWishlistGroups` の結果） |
| `5483` | `moveSidebarButtonByOffset` | `buttons` の並び（キー操作） |
| `5505` | `moveSidebarGroupByOffset` | `groups` の並び（キー操作） |
| `5523` | `moveTodayItemByOffset` | `today.items` の並び（キー操作） |
| `5545` | `moveInboxItemByOffset` | `inbox` の並び（キー操作） |
| `5562` | `moveOverlayPageByOffset` | `overlayPages` の並び |
| `6354` | `confirmDropRegistration` | `buttons` 追加・`groups` |
| `6381` | `deleteButton`（確認の `onConfirm` の中） | `buttons` 削除・各 `nextStep.buttonIds` の掃除 |
| `6513` | `confirmGroupAddition` | `groups` 追加 |
| `6554` | `deleteGroup`（確認の `onConfirm` の中） | `groups` 削除・該当 `buttons` を未分類へ |
| `6616` | `confirmGroupRename` | `groups` / `buttons[].group` の改名 |
| `6669` | `saveOverlayPageDraft`（追加） | `overlayPages` 追加 |
| `6692` | `saveOverlayPageDraft`（名前変更） | `overlayPages` の名前 |
| `6722` | `deleteOverlayPage`（確認の `onConfirm` の中） | `overlayPages` 削除・`buttons[].overlayPageId` の掃除 |
| `6764` | `moveOverlayPage` | `overlayPages` の並び |
| `6781` | `moveSidebarButtonToDictionary` | `dictionaryOrder`・`buttons[].showInSidebar` / `showInOverlay` |
| `6890` | `saveButtonEdit` | `buttons`・`groups`・`projects` |
| `6999` | `queueCompletionFollowup`（`requestConfirmation` の `onConfirm` の中） | やりたいことの完了（`inbox` / `sourceCompletions`） |
| `7172` | `resolveEarlyStop` | 今日の3件の完了（`completeTodayItemAndPrepareSource` の結果） |
| `7356` | `markNextStepReviewed` | `projects[].nextStep.reviewedAt` |
| `7451` | `finishCompletedTimer` | 今日の3件の完了（`completeTodayItemAndPrepareSource` の結果） |
| `7570` | `toggleAutoStart` | `settings.autoStart` |
| `7594` | `updateVictoryText` | `today.victory.text` |
| `7641` | `toggleVictoryDone` | `today.victory.done` |
| `7740` | `removeTodayItem` | `today.items` から除去＋`selectionMutationTokens` |
| `7795` | `commitTodayTriggerEdit` | `today.items[].trigger` |
| `7825` | `addInboxItem` | `inbox` 追加 |
| `7880` | `saveSourceEdit` | `resnapshotSource` の結果（元の登録と今日の3件の同期） |
| `8021` | `completeInboxItem`（確認の `onConfirm` の中） | `inbox` から除去・`sourceCompletions` 追加・`today` 掃除 |
| `8055` | `deleteInboxItem`（確認の `onConfirm` の中） | `inbox` から削除・`today` 掃除 |
| `8167` | `addCandidateToToday` | `today.items` 追加＋`selectionMutationTokens` |
| `8216` | `saveTodayPickerDraft` | `today.items`（決定） |
| `8246` | `chooseTodayCandidate` | `today.items`（候補を押した時） |
| `8280` | `removeTodayPickerDraftItem` | `today.items`（今日から外す） |
| `8562` | `promoteWishlistToProject` | やりたいこと→次の一手（`prepareWishlistPromotion` の結果） |
| `8806` | `saveNextStepEdit` | 次の一手（`prepareWishlistPromotion` または `projects` の差し替え） |
| `8838` | `removeProjectNextStep` | 次の一手の削除（`prepareNextStepRemoval` の結果） |
| `8901` | `executeProjectDeletion` | プロジェクト削除（`prepareProjectDeletion` の結果） |
| `8986` | `saveProjectEdit` | `projects`（追加または更新） |
| `9021` | `setWeeklyReviewProjectFocus` | `projects[].weeklyFocus` |
| `9042` | `startNextTodayBatch` | `today.items` を空に・`selectionMutationTokens` を空に |

`persistConfig` 以外の保存の入口（`persistConfig` を通らない）:

| 入口 | 場所 | 使っている所 |
| --- | --- | --- |
| `saveConfig` を直接呼ぶ | `src/tauri.ts:59-65` | `saveSettingsCenter` のロールバック `src/App.tsx:4703` |
| `saveConfigAndNotifyDashboard` | `src/tauri.ts:107-113`（`saveConfig`＋`config-changed` イベント） | `src/components/DictionaryFeatureParity.tsx:226`（同ファイルの `persist` `215-239` 経由）、`src/components/InstructionTree.tsx:819`（`registerInstructionFolder` `802-`）、`1031`（`submitProjectLink` `1016-`） |
| `undoTodaySelection` | `src/tauri.ts:97-105` | `src/App.tsx:7699`（`undoTodaySelectionOperation` `7678-`） |

---

### O-4 F1 キー

F1 を固定で受けている所は無い。

| 調べたこと | 結果 |
| --- | --- |
| `F1` を探す（`src` / `src-tauri`） | `F1` そのものの一致は 0 件。一致したのは `F10`（`src/App.tsx:2571`、`src/RecordsView.tsx:104`、`src/components/DictionaryFeatureParity.tsx:833`、`src/components/InstructionTree.tsx:711`）と、注意文の `F1〜F12`（`src/App.tsx:3775`）と `SHORTCUT_PATTERN` の `F(?:[1-9]\|1[0-2])`（`src/App.tsx:1448`、`1459`）だけ。 |
| `key === "F1"` のような分岐 | 0 件。 |
| ヘルプを F1 で開く仕組み | 無い。`helpGuideOpen` は状態（`src/App.tsx:2279`）と Esc で閉じる扱い（`4031-4033`）だけで、F1 からは開かない。 |

辞書を開くキー（`launcherHotkey`）に F1 だけを割り当てられるか（コード上の可否）:

| 段階 | 事実 |
| --- | --- |
| 入力の形式チェック | `SHORTCUT_PATTERN = /^(?:(?:Ctrl\|Alt\|Shift\|Super\|Command)\+)*(?:[A-Za-z0-9]\|F(?:[1-9]\|1[0-2])\|Space)$/i`（`src/App.tsx:1447-1448`）。修飾キーは 0 個でもよいので、`F1` 単体は一致する。 |
| 記録（キーを押して取る） | `shortcutFromKeyboardEvent` が `^F(?:[1-9]\|1[0-2])$` を `key` にする（`1459-1460`）。取れないキーのときの注意文は `英数字、F1〜F12、Spaceのいずれかを押してください`（`3775`）。 |
| 検証 | `shortcutValidationMessage`（`1475-1487`）と `validateShortcutSettings`（`1489-1513`）。禁止は `WINDOWS_RESERVED_SHORTCUTS = ["alt+space", "ctrl+esc", "ctrl+alt+delete"]`（`1449`）と `Ctrl+W`（`1117-1121`、`1479`、`1500-1502`）、他の 3 つのキーとの重複（`1503-1508`）。修飾キーを必須にする規則は無い。 |
| 設定値の型 | `launcherHotkey: z.string().nullable().default("Ctrl+K")`（`src/types.ts:191`）。パターン検証は無い。Rust は `Option<String>`（`src-tauri/src/models.rs:356-357`）、スキーマは `{"type":["string","null"],"default":"Ctrl+K"}`（`src-tauri/src/commands/config.rs:2159`）。 |
| アプリ内の照合 | `matchesHotkey`（`src/App.tsx:1098-1115`）が `event.key.toLowerCase()` を最後の `+` 区切りと比べ、`ctrlKey` / `altKey` / `shiftKey` の一致を見る。`F1` なら `f1` と比較され、修飾キーはすべて false を要求。`metaKey`（Super）は比較していない。 |
| グローバル登録（Rust） | `Shortcut::from_str(hotkey)`（`src-tauri/src/startup.rs:239-240`）→ `app.global_shortcut().register`（`265`）。失敗時は登録済みを戻す（`265-289`）。テスト用の起動では登録しない（`219`、`305-307`）。修飾キーを必須にする検査はリポジトリ内に無い。 |
| 保存後の再登録 | `persistConfig` の第 2 引数が true のとき `reapplyDashboardSettings()` を呼ぶ（`src/App.tsx:3330-3333`）。`saveSettingsCenter` は `hotkeysChanged` を渡す（`4646-4651`、`4699`）。 |

分からなかった: Windows が修飾キー無しの `F1` をグローバルホットキーとして登録できるか、WebView2 が `F1` をページに渡すかは、リポジトリのコードからは分からない（`Shortcut::from_str` は `tauri-plugin-global-shortcut` / `global-hotkey` クレートの実装で、リポジトリ内にソースが無い）。F1 を割り当てた実機・テストは無い（`Ctrl+K` を使うテストだけがある: `tests/visual/phase87-followup-polish.spec.ts:154`、`tests/visual/phase9-dialog-details.spec.ts:145`）。

---

### O-5 鮮度レビュー

判定の決まり:

| 項目 | 内容 | 場所 |
| --- | --- | --- |
| `project_is_stale_at` | `nextStep` が無ければ `false`。基準は `reviewed_at` があればそれ、無ければ `updated_at`。RFC3339 として読めなければ `false`。`now.signed_duration_since(basis) >= Duration::days(14)` で `true`。 | `src-tauri/src/commands/config.rs:2462-2476` |
| `load_next_step_freshness` | `load_config_internal` で設定を読み、`now = chrono::Utc::now().fixed_offset()` で全プロジェクトを判定し、`staleProjectIds` に id を入れて返す。 | `src-tauri/src/commands/config.rs:69-89` |
| 応答の型 | `NextStepFreshnessResponse { staleProjectIds: string[] }` | `src/types.ts:447-449`、`src-tauri/src/models.rs:651-655` |
| フロントの入口 | `loadNextStepFreshness()` = `invoke("load_next_step_freshness")` | `src/tauri.ts:184-186` |

画面で読み直す所:

| 関数 | 行 | いつ走るか |
| --- | --- | --- |
| `refreshWeeklyReview` | `3061-3070`（`loadNextStepFreshness()` は `3063`） | `config.today.date` が変わったときの `useEffect`（`3232-3236`） |
| `refreshRecords` | `3072-3102`（`loadNextStepFreshness()` は `3086`） | 記録画面を開いたとき（`3226-3230`）、バックアップから復元したとき（`4801`、`confirmBackupRestore`）、実行記録を保存したとき（`7038`、`recordTimerSession`）、手動記録の保存（`9081`、`saveManualSession`）、記録の編集（`9139`、`saveSessionEdit`）、記録の削除（`9157`、`confirmSessionDelete`） |

- 結果は `staleNextStepProjectIds` に入る（`src/App.tsx:2199`、`3065`、`3094`）。
- 表示に使う一覧は `staleNextStepProjectIds` と `project.nextStep?.text.trim()` の両方が真のもの（`2621-2627`）。`RecordsView` へは `staleNextStepProjects` として渡す（`10617`）。
- 表示場所は記録画面の「今週を決める」タブ（`tab === "planning"`、`src/RecordsView.tsx:271-331`）。見出しは `鮮度レビュー`、説明は `次の一手を14日以上更新・確認していないプロジェクト`（`314`）、行の説明は `次の一手が14日以上同じです`（`320`）。
- `markNextStepReviewed` の後は一覧を取り直さず、state から id を除くだけ（`7364-7366`）。

「このまま」と「書き直す」の働き:

| ボタン | つながり | 実際の動き |
| --- | --- | --- |
| `このまま` | `src/RecordsView.tsx:325` → `onMarkReviewed`（`src/App.tsx:10605`） → `markNextStepReviewed`（`7353-7368`） | `reviewedAt = new Date().toISOString()`（`7355`）を入れて `persistConfig`（`7356-7363`）。成功したら `staleNextStepProjectIds` から id を除く（`7364-7366`）。押している間の busy 表示・二重押しの防止は無い（`7353-7368` にフラグが無い）。 |
| `書き直す` | `src/RecordsView.tsx:323` → `onEditProject`（`src/App.tsx:10602`） → `openProjectEditDialog`（`8354-8371`） | 開くのはプロジェクト編集ダイアログで、下書きは `id` / `name` / `northStar` / `weeklyFocus` / `colorId` だけ（`8361-8368`）。`nextStep` は含まない。保存の `saveProjectEdit` も `nextStep` を変えない（`8970-8981` で `existingProject` を展開してから 5 項目だけ上書き）。`reviewedAt` も変えない。 |
| `短時間で試す` | `src/RecordsView.tsx:324` → `onTryShort`（`src/App.tsx:10611`） → `tryStaleNextStepForShortTime`（`7370-7384`） | 短時間タイマーを開始し（`7375-7382`）、`markNextStepReviewed` を呼ぶ（`7383`）。 |

`reviewedAt` を書く所（grep の結果）:

| 場所 | 内容 |
| --- | --- |
| `src/App.tsx:7355`、`7360` | 「このまま」だけ |
| `src/App.tsx:8762` | `saveNextStepEdit` は既存の `reviewedAt` をそのまま引き継ぐ |
| `src-tauri/src/commands/config.rs:2334-2339` | `sanitize_config` が `updatedAt` と `reviewedAt` の両方とも無いとき、同じ now を両方に入れる |
| `src-tauri/src/commands/import.rs:553` | 取り込んだ次の一手に `reviewed_at: Some(now_iso())` |

コードからの読み（実機未確認）: 「書き直す」でプロジェクト名などを変えても `reviewedAt` は残り、`saveNextStepEdit` で次の一手の文言を変えると `updatedAt` だけが新しくなる（`8761`）。判定は `reviewed_at` を優先する（`2466-2470`）ので、`reviewedAt` が古いままだと鮮度の基準は変わらず、「14日以上」の判定は解消しない。鮮度一覧を取り直す処理も無い（`8762` の後で `loadNextStepFreshness` を呼んでいない）。

今あるテスト:

| 種別 | 名前 | 場所 |
| --- | --- | --- |
| Rust 単体 | `next_step_freshness_changes_at_fourteen_days` | `src-tauri/src/commands/config.rs:3179-3196` |
| Rust 単体 | `legacy_next_step_gets_a_fresh_baseline_without_warning` | `src-tauri/src/commands/config.rs:3158-3177` |
| Playwright | 鮮度レビューの表示・`このまま`・`書き直す` を確かめるテストは 0 件（`このまま` / `書き直す` / `短時間で試す` / `鮮度レビュー` で `tests` を grep して 0 件） | — |
| Playwright（fixture だけ） | `fixture.staleProjectIds = ["sample-learning"]` を入れるテスト（鮮度レビュー自体は検証していない） | `tests/visual/phase83-main-action-hover.spec.ts:23` |
| mock | `load_next_step_freshness` は `{ staleProjectIds: fixture.staleProjectIds ?? [] }` を返す | `tests/visual/tauriMock.ts:528` |

---

### O-6 今日やるものを選ぶ画面の保存の流れ

開ける条件:

| 条件 | 事実 | 場所 |
| --- | --- | --- |
| 3 件のとき開けるか | 開けない。`openTodayPicker` の先頭で `(configRef.current?.today.items.length ?? TODAY_ITEM_LIMIT) >= TODAY_ITEM_LIMIT` なら即 return。 | `src/App.tsx:3983-3984` |
| 入口（0 件） | 空状態の `今日やるものを選ぶ` ボタン | `11043-11057` |
| 入口（1〜2 件） | `.todayPickerEntry` の `今日やるものを選ぶ`（`items.length > 0 && < TODAY_ITEM_LIMIT && !todayPointerDrag`） | `11452-11464` |
| 入口（3 件） | 出ない。3 件すべて完了のときだけ `次の3件を選ぶ` が出る（`11539-11548`）。押すと `startNextTodayBatch` が `today.items` を空にして保存する（`9040-9048`）ので、そのあと開ける。 | `11539-11548`、`9040-9048` |
| ダイアログ | `aria-label="今日やるものを選ぶ"`、見出し `今日やるものを選ぶ` | `13147-13161` |

操作ごとの保存:

| 操作 | 関数 | 行 | 保存するか |
| --- | --- | --- | --- |
| 候補の `＋ 今日へ` を押す | `chooseTodayCandidate` | `8232-8259`（保存は `8246`） | する。押すたびに即保存。既に選ばれていれば何もしない（`8234-8241`）。3 件ならボタンが `disabled`（`9434`）で関数も return（`8233`）。保存に失敗したら下書きを進めない（`8250-8253`）。3 件目で閉じる（`8255-8258`）。 |
| `↩ 今日から外す` を押す（× のアイコンではなく `↩`、`aria-label="今日から外す"`） | `removeTodayPickerDraftItem` | `8261-8286`（保存は `8280`） | する。即保存。保存に失敗したら下書きを戻さない（`8280-8283`）。 |
| 並べ替える | — | — | この画面には並べ替えが無い。選択中の行は `draggable` でなく、ドロップ帯も無い（`tests/visual/phase84-today-picker.spec.ts:256-258` が `not draggable` と `.todayPickerRemoveDropZone` 0 件を確認）。追加は常に末尾（`8242`）。ダッシュボードの「今日の3件」側には、ポインタのドラッグ `moveTodayItem`（`5365-5387`、保存 `5386`）とキーの `moveTodayItemByOffset`（`5515-5528`、保存 `5523`）がある。 |
| `決定` | `saveTodayPickerDraft()` | `8208-8230`（ボタンは `13356-13363`） | 中身が今の `today.items` と同じなら保存せず閉じる（`8211-8214`）。違えば `8216` で保存し、成功で閉じる（`8223-8226`）。保存中はボタンが `disabled` で文言が `保存中…`（`13358-13362`）。 |
| `キャンセル` | `requestCloseTodayPicker` | `3949-3981`（ボタンは `13364-13371`） | 保存中は何もしない（`3950`）。下書きが開いた時の内容（`todayPickerInitialItemsRef`）と違えば、`入力内容を破棄して閉じますか？`（`2391-2404`、ボタンは `破棄して閉じる` / `戻る`）を出し、`破棄して閉じる` で**開いた時の内容を保存し直して**（`3958`）閉じる。差分が無ければ `closeTodayPicker`（`3938-3947`）で保存しない。 |
| `Esc` | `closeOnEscape`（`4120-4135`） → `dismissNonCriticalModal`（`4017-`） | picker が開いていれば `requestCloseTodayPicker`（`4019-4021`） | キャンセルと同じ。 |
| 右上の閉じる（`aria-label="今日やるものを選ぶを閉じる"`） | `requestCloseTodayPicker` | `13163-13168` | キャンセルと同じ。 |

外せる札の決まり:

| 条件 | 事実 | 場所 |
| --- | --- | --- |
| 保存中 | 外せない（関数の先頭で return、ボタンも `disabled`） | `8262`、`9397` |
| タイマーが回っている札 | 外せない。`timerRunsTodayItem(...)` が真なら `タイマーを停止してから外してください` を出す（ボタンも `disabled`、`title` も同じ文） | `8266-8277`、`9367-9372`、`9397-9400` |
| 完了した札（`done: true`） | 外せる。`removeTodayPickerDraftItem` に `done` の判定は無い（`8261-8286`）。`timerRunsTodayItem` は `findTodayEntryForTimer` が `!item.done` で絞る（`src/timerSource.ts:26-38`）ので、完了した札はタイマー判定でも止まらない（`timer.sourceId === ownTimerSourceId` の一致だけは `done` を見ない）。 | `8261-8286`、`src/timerSource.ts:26-38`、`58-69` |
| ダッシュボードの「今日の3件」から外す | `removeTodayItem`（`7711-7768`）。タイマーのときだけ止める（`7718-7728`）。完了した札を外せることを前提にしたテストがある（`tests/visual/phase84-today-picker.spec.ts:549-552`） | `7711-7768` |

---

### O-7 終わりの確認（「次の一手を決めますか？」）

| 調べたこと | 事実 | 場所 |
| --- | --- | --- |
| 出す条件（描画） | `completionFollowup?.source.kind === "nextStep"` のときだけ。`aria-label` と見出しは `次の一手を決めますか？`。 | `src/App.tsx:14819-14833` |
| 選択肢 | `completionFollowup.source.projectId` と同じ `projectId` の `inbox` 項目を並べる（`14835-14854`）。`新しく入力する`（`14855-14869`）。`今は決めない`（`14872-14878`）。 | `14834-14879` |
| 出す条件（キュー） | `queueCompletionFollowup`（`6950-7004`）: source が無い／同じ key を既にキュー済みなら出さない（`6955`）。`source.kind === "nextStep"` で `isCurrentSnapshot` が false か、同じプロジェクトの `inbox` が 0 件なら出さない（`6956-6962`）。1100ms 後に出し（`7003`）、出す直前にあらためて `inbox` を確認する（`6970`）。 | `6950-7004` |
| キューする前に保存しているか | している。`finishCompletedTimer` は `completeTodayItemAndPrepareSource`（`completionFollowup.ts:72-120`）の結果を `persistConfig` で保存し、成功したときだけ `queueCompletionFollowup` を呼ぶ（`7451` → `7461`）。`resolveEarlyStop` も同じ（`7172` → `7181`）。 | `7443-7466`、`7159-7186` |
| `isCurrentSnapshot` の意味 | `item.sourceGenerationId === project.nextStep.generationId`（`item.projectId` があるときは id も一致）（`completionFollowup.ts:20-31`）。`generationId` が無い組み合わせでは一致しない。 | `completionFollowup.ts:20-31` |
| やりたいこと由来のとき | 同じダイアログではなく `requestConfirmation` で `この「やりたいこと」はどうしますか？`（`6979-7001`）。 | `6979-7001` |
| Esc | `dismissNonCriticalModal` が `completionFollowup` を `null` にする（`4067-4069`）。 | `4067-4069` |

`promoteInboxToNextStep` が保存の前に確かめていること（`src/App.tsx:8446-8496`）:

| 順 | 確かめること | 行 |
| --- | --- | --- |
| 1 | `configRef.current` と `inbox[index]` がある | `8447-8449` |
| 2 | `item.id`（stable ID）がある。無ければ `この項目にはstable IDがないため、先に編集して保存してください` | `8450-8454` |
| 3 | `warnSourceEditBlocked(\`wishlist:${item.id}\`)` が偽（保存中・同じ元でタイマー実行中・未完了の今日の3件に使われている、のいずれでもない） | `8455-8458`、`7845-7868` |
| 4 | `item.projectId` があるとき、そのプロジェクトが存在する。無ければ `所属プロジェクトが見つかりません` | `8459-8466` |
| 5 | プロジェクトがあるときは `openNextStepEditor(project, { mode: "promote", text: item.text, promotedWishlistId: item.id, projectLocked: true })` を開くだけ。無いときはプロジェクト未選択の下書きを作る | `8467-8495` |

- `promoteInboxToNextStep` 自身は保存しない（`8446-8496` に `persistConfig` は無い）。
- 実際の保存は次の一手の編集ダイアログの `saveNextStepEdit`（`8660-8815`）。保存の前に、選択の存在（`8677-8680`）、既に同じ次の一手か（`8681-8684`）、文言（`8685-8689`）、`sameNextStepSnapshot` で競合していないか（`8690-8693`）、旧実行設定の引き継ぎ選択（`8694-8702`）、置き換え確認（`8704-8708`）、source のロック（`8709-8729`）、タイマー分数（`8731-8739`）を確かめる。

保存の最中に二重に押せないようにしているか:

| 場所 | 事実 |
| --- | --- |
| 「次の一手を決めますか？」の選択肢 | `disabled` も保存中の表示も無い。押すとすぐ `setCompletionFollowup(null)` してから編集ダイアログを開く（`14841-14848`、`14857-14864`）。このダイアログ自身は保存しない。 |
| 次の一手の編集ダイアログの `保存` | `disabled={saveDisabled}` で、`saveDisabled` に `sourceEditSaving` が入る（`14930-14937`、`15407-15414`）。`saveNextStepEdit` は `sourceEditBusyRef.current` が立っていれば即 return（`8663`）。`sourceEditSaving` 中は閉じるボタンも `disabled`（`15415-15419`）。 |
| タイマー完了側 | `finishCompletedTimer` は `plannedCommitRef.current` / `finishingTimerRef.current` / `earlyStopRef.current` で再入を止める（`7410-7423`）。`continueCompletedTimer` も同じフラグを見る（`7386-7388`）。 |
| 確認ダイアログ（`ConfirmDialog`） | `processing` 中は `runAction` が return し、ボタンがすべて `disabled`（`src/components/ConfirmDialog.tsx:128-146`、`186-214`）。 |

保存に失敗したとき:

| 場所 | 事実 |
| --- | --- |
| `persistConfig` | 失敗すると `configRef` と `config` を保存前へ戻し、`banner` と `保存できません: …` のトーストを出して `false` を返す（`3312-3323`）。 |
| `finishCompletedTimer` | `7451` が false なら `showTimerCompletionFeedback` も `queueCompletionFollowup` もしない（`7451-7466`）。`plannedCommitRef` は `finally` で戻す（`7470-7476`）。 |
| `resolveEarlyStop` | 記録（セッション）は先に保存済みで（`7154-7157`）、今日の3件の保存が false なら `saved && completedSourceKey` が偽になり、フィードバックもフォローアップも出ない（`7172-7186`）。 |
| 次の一手の編集ダイアログ | `saveNextStepEdit` は保存が false なら return し、`closeNextStepEditDialog` を呼ばない（`8803-8814`）。テストは保存を失敗させてダイアログが開いたまま残ることを確認している（`tests/visual/phase82-nextstep-wishlist.spec.ts:252-261`）。 |

---

### O-8 テストの作り

Tauri の `invoke` の差し替え:

| 項目 | 内容 | 場所 |
| --- | --- | --- |
| 仕組み | `installTauriMock(page, fixture, currentWindowLabel, softwareResetRecovery, options)` が `page.addInitScript` で、ページのスクリプトより前に `window.__TAURI_INTERNALS__` を定義する。 | `tests/visual/tauriMock.ts:10-24`、`297-317` |
| `invoke` | `__TAURI_INTERNALS__.invoke = async (command, args) => switch (command) {...}`。`load_config` は `currentConfig` を返し（`324-357`）、`save_config` は `args.config` を `currentConfig` に入れて保存する（`365-369`）。 | `tests/visual/tauriMock.ts:317-` |
| なぜこれで差し替わるか | `@tauri-apps/api` の `invoke` は `window.__TAURI_INTERNALS__.invoke(cmd, args, options)` を呼ぶだけ。モジュールを差し替えるのではなく、グローバルを置き換えている。 | `node_modules/@tauri-apps/api/core.js:202` |
| イベント | `__TAURI_EVENT_PLUGIN_INTERNALS__` と `transformCallback` / `unregisterCallback` も定義する。 | `tests/visual/tauriMock.ts:293-309` |
| 呼び出しの記録 | `invokeCalls` に `{ command, args }` を積み、`__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls` で見せる。テストは `save_config` の回数を数える。 | `tauriMock.ts:210`、`227`、`tests/visual/phase82-nextstep-wishlist.spec.ts:346-351`、`368`、`373`、`396-400` |
| 近道の操作口 | `__LIFE_LAUNCHER_VISUAL_QA__` に `currentConfig()`、`updateConfig()`、`setSaveConfigFailure()` などを持つ。 | `tauriMock.ts:226-283` |

保存を失敗させているテスト:

| 例 | 内容 | 場所 |
| --- | --- | --- |
| 失敗の作り方 | mock の `failSaveConfig` を立てると `save_config` が `throw new Error("Public demo mock: config save failed")`。テストは `page.evaluate` で `setSaveConfigFailure(true)` を呼ぶ。 | `tauriMock.ts:191`、`243-245`、`365-366`、`tests/visual/phase84-today-picker.spec.ts:24-34` |
| 例 1 | `P84-01 save failure rolls back and leaves the Picker usable`（候補を押した保存が失敗すると、ピッカーの選択が 0 件のままで、もう一度押せる） | `tests/visual/phase84-today-picker.spec.ts:280-304` |
| 例 2 | 次の一手の保存を失敗させると、ダイアログが閉じず、設定も変わらない | `tests/visual/phase82-nextstep-wishlist.spec.ts:252-261` |
| 例 3 | 並べ替えの保存を失敗させても並びが変わらない | `tests/visual/phase82-nextstep-wishlist.spec.ts:381-394` |
| 失敗させる口の一覧 | `setSaveConfigFailure` を使うテストは 16 ファイル（`git grep` の結果） | `tests/visual/phase6-main.spec.ts:42-52` ほか |

テストの最初の設定のデータ:

| 作っている所 | 内容 | 場所 |
| --- | --- | --- |
| `createConfig()` | 公開用の初期 `AppConfig`（`$schema`、`version: 3`、グループ 3 つ、ボタン 3 つ、プロジェクト 2 つ、`today`、`inbox`、`settings`）。 | `tests/visual/fixtures.ts:38-162` |
| `createPublicFixture()` | `createConfig()` にセッション・週次・ノート・`doNowCandidates` を足して `VisualQaFixture` にする。 | `tests/visual/fixtures.ts:189-239` |
| `createPhase9Base()` | 公開 fixture を土台に、色付き 5 プロジェクトなどの Phase 9 用に作り替える。 | `tests/visual/fixtures.ts:243-` |
| 固定日時 | `FIXTURE_DATE = "2026-08-13"`、`FIXTURE_NOW = "2026-08-13T09:30:00+09:00"`。 | `tests/visual/fixtures.ts:10-11` |
| テスト側 | `createPublicFixture()` を呼んで書き換え、`installTauriMock(page, fixture, "main")` に渡す。 | `tests/visual/phase84-today-picker.spec.ts:6-12`、`44-46` |
| mock 側の初期値 | `fixture.config` を `currentConfig` の初期値にし、`sessionStorage` の `life-launcher-visual-qa-config` に保存して再読み込み後も同じ状態を再現する。 | `tauriMock.ts:25`、`46-53`、`61-63` |
| clean start 用 | `software_reset` のときに `freshConfig()` が空の設定を作る（`options.cleanStartReset` のときだけ状態を持つ）。 | `tauriMock.ts:107-`、`722-724` |
| Rust 側 | `sample_config()` が単体テスト用の設定を作る。 | `src-tauri/src/models.rs:862-` |

時計を固定しているテスト:

| 例 | 内容 | 場所 |
| --- | --- | --- |
| `page.clock.install` | `await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() })`。picker のテストは `prepare()` の中の 1 行目で固定している。 | `tests/visual/phase84-today-picker.spec.ts:7`、`tests/visual/phase6-main.spec.ts:9`、`tests/visual/phase83-main-action-hover.spec.ts:34` ほか多数 |
| 時計を進める | `page.clock.fastForward(...)`、`page.clock.setSystemTime(...)`、`page.clock.pauseAt(...)`、`page.clock.runFor(...)` を使うテストがある。 | `tests/visual/phase7-audit.spec.ts:136-137`、`tests/visual/phase72-toast-undo.spec.ts:104-112`、`tests/visual/phase72-followup-five.spec.ts:140-170` |
| mock 側の時刻 | `options.cleanStartNow ?? new Date().toISOString()` を日付キーの計算に使う（固定時計と組み合わせて使う）。 | `tauriMock.ts:95-106`、`116` |

---

### O-9 十字キーで行を選ぶ働きと、行で Enter を押したとき

| 調べたこと | 事実 | 場所 |
| --- | --- | --- |
| 行はフォーカスできるか | 次の一手は `.nextStepRow .nextStepCard` に `tabIndex={0}`（`11740`）、やりたいことは `.inboxRow .sourceListRow` に `tabIndex={0}`（`12237`）、今日の3件は `.todayRow` に `tabIndex={0}`（`11130`）。 | `src/App.tsx:11740`、`12237`、`11130` |
| 十字キーの処理 | `document` の `keydown` で常に `navigateAppArrow(event, shortcutCaptureActiveRef.current)` を呼ぶ。 | `src/App.tsx:2269-2278` |
| 何をするか | 修飾キー無しの ↑↓←→ で、フォーカスできる要素（`button:not(:disabled), a[href], input, select, textarea, [tabindex="0"]`）の間で DOM フォーカスを移す。モーダルが開いていればその中、無ければサイドバー→上部バー→`.mainScrollArea` の順。主画面では ↑↓ が `available(main)` の前後、←→ は `.todayGrid, .dialogActions, .todayPickerRow` の中、← は端でサイドバーへ。 | `src/keyboardNavigation.ts:1-11`、`102-223`（主画面は `212-223`） |
| 「選んだ行」の状態 | 次の一手・やりたいこと・今日の3件の 3 つの一覧には、選択 index や `aria-selected` / `aria-activedescendant` を持つ状態が無い。`aria-selected` は辞書のページタブ（`10210`）、ピッカーの追加元タブ（`13226`、`13241`）、設定のタブ（`13588`）、次の一手ダイアログのタブ（`15005`、`15019`）、記録のタブ（`src/RecordsView.tsx:120`）などにだけある。動くのはフォーカスだけ。 | `src/App.tsx` の grep 結果、`src/RecordsView.tsx:120` |
| 行の keydown | 3 つの一覧の行が持つハンドラは `openContextMenuFromKeyboard` だけで、`ContextMenu` キーか `Shift+F10` のときだけメニューを開く（それ以外のキーは素通り）。 | `src/App.tsx:2569-2581`、`11119-11125`、`12224-12237`、`11733-11735` |
| 行で Enter を押すと | 行自身には Enter の分岐が無い（上記）。行は `article` / `div` なので既定の動作も無い。つまり何も起きない。行の中のボタン（例: 今日の3件の開始ボタン、`…` の操作メニュー）にフォーカスがあるときは、ブラウザ既定でそのボタンが押される。 | `11119-11131`、`12224-12238`、`11733-11741` |
| 参考（選択のある画面） | 辞書（Ctrl+K）は ↑↓ で `launcherSelectedIndex` を動かし、Enter で `runLauncherOverlayItem` を実行する（`9633-9677`）。ピッカーの中の ↑↓ はモーダル内のフォーカス移動（`keyboardNavigation.ts:143-159`）。 | `9633-9677`、`keyboardNavigation.ts:143-159` |
| 参考（同じ一覧のキー操作） | 並べ替えはメニューからもできる（`moveSidebarButtonByOffset` `5465-5491`、`moveSidebarGroupByOffset` `5493-5513`、`moveTodayItemByOffset` `5515-5528`、`moveInboxItemByOffset` `5530-5551`、`moveOverlayPageByOffset` `5553-5567`）。呼び出しは操作メニューの各項目（`12615`、`12625`、`12658`、`12675`、`12753`、`12760`、`12810`、`12817`、`12989`、`12999`）。行にフォーカスがある状態の ↑↓ からは呼ばれない。 | `5465-5567`、`12615-12999` |

分からなかった: 3 つの一覧の行にフォーカスがある状態で Enter を押したときに、WebView2 側や OS 側で何かが起きるかは、リポジトリのコードからは分からない（アプリ側にハンドラが無いことだけを確認した）。

## 分からなかった所

書いた節ごとに、コードと設定から決められなかった物・実機で確かめていない物をまとめる。**推測で埋めていない。**

### A(全体の地図)

- 無し。(画面の部分の境目・行の範囲は JSX を開いて確認した。`@media` は 13,074 行すべてを検索した。)

### B(色・字・形)

- 無し。(値と行は `src/styles.css` を開いて確認した。上書きがある所は「最後に効く定義」を書いた。)

### C(フォント)

- 実際のフォントファイル(`.woff2` など)や実際のライセンス文書(OFL の本文)を置いて `npm.cmd run public:check` を通した記録はリポジトリに無く、個別のライセンス文書がメールアドレス等を含むかは、フォントを同梱していないため確認できなかった。**`baseline` 等を含むパス名の禁止(`scripts/check-public-safety.mjs:123-128`)はフォントのファイル名にもそのまま当たる。**
- `release-candidate/v1.4.3/` の 3 ファイルが今の `dist/` から作られたものかは、記録が無いため分からなかった。
- 基準画像(17 枚)の中身は開いていない。何が写っているかは推測しない。

### D(上の段とサイドバー)

- WebView2 そのもののキー(Ctrl+F のページ内検索・Ctrl+P・Ctrl+R・F5・F12 など)を Tauri／wry の既定がどう扱うかは、このリポジトリの中に書かれていない。`src-tauri/tauri.conf.json` に `additionalBrowserArgs` も `browser_accelerator_keys` も無く、`src` 側にもこれらのキーを止める処理が無い、という事実までは確認した。`src-tauri/gen/schemas` は権限のスキーマで、設定のスキーマは `https://schema.tauri.app/config/2` を参照するだけでローカルに無い。
- 開発ビルドと配布ビルドで開発者ツールの可否が変わるかは、`src-tauri/Cargo.toml` に `devtools` フィーチャーが無いこと以上は分からなかった。

### E(メイン画面の節)

- `victoryBar` / `doNowBand` / `focusBand` に `role` が明示されていないため、アクセシビリティツリー上で section がどう扱われるかはコードからは断定しなかった(`aria-label` の有無だけを書いた)。
- `todayActivityEntries` の `startedAt` を組み立てるバックエンドの整形規則は読んでいないため、「常に `HH:MM` か」は分からなかった(フロントは受け取った文字列をそのまま出すだけ、`src/App.tsx:12507`)。
- なぜ `moveProject` / `moveInboxItem` / `moveWishlistGroup` が `announceReorder` を呼ばないのか(意図)は、コードからは分からなかった。
- `.wishlistNextStepAction` を `opacity: 0` のままフォーカス対象に残している設計の意図は、コメント等が無く分からなかった。

### F(タイマーと終わり)

- メインウィンドウを `hide()` している間(ミニ表示中)に、WebView2 の `document.hidden` が真になるか。コードは「真ならごほうびを出さない」としか書いていない(`src/App.tsx:2407`)。**実行して確かめていない。**
- ミニ表示中に満了・早め完了が起きたとき、`focusDashboardWindow()` でメインは出る(`src-tauri/src/startup.rs:90-96`)が、ミニを隠す処理はその経路に無い(`hideMiniWindow` は `returnToMain` からだけ、`src/App.tsx:3489-3492`)。2 つの窓が同時に出るかは**実行して確かめていない。**
- OS の通知が実際に表示されるか(`Notification.permission` と OS 側の設定しだい。コードは許可要求と送信だけ、`src/App.tsx:1919-1931`)。
- 早め完了の確認ダイアログで右上の × を押したときの扱いは、`onCancel` → `resolveEarlyStop(false)` を読む限り「未完了のまま終了」と同じ(`src/components/ConfirmDialog.tsx:164-173`、`src/App.tsx:15973-15975`)だが、実際の見え方は確認していない。
- 指示の手がかりにあった `timer-line` / `--timer-progress` / `topTimerLine` という名前はコードに無かった(grep 0 件)。実装は `windowTimerLine` / `windowTimerLineGroove` / `windowTimerLineFill`。

### G(今日の3件を選ぶ・次の一手を編集する)

- `config.today.candidateExcludedSourceKeys` を候補から除外するために読む画面・関数は見つからなかった(`src/todayCandidates.ts` と picker の絞り込みに参照が無い)。この値が UI 上でどう使われるかは分からなかった。
- 「きっかけ」を「いつ」「どこで」に分ける構想・下書き・未使用の型は `src` 内で見つからなかった(存在するかどうかは分からない)。

### H(メニュー・トースト・ダイアログ)

- 上の仕様書は `neutral` を「灰色」と書いているが、`src/styles.css` の `.toast--neutral` は `var(--accent)`(`#e7b94d`)を指定している(`src/styles.css:5491-5493`)。どちらが正かは分からなかった。
- 仕様書 `docs/spec/current-spec.md:898` は「最大幅は約420px」と書いているが、CSS の幅は `min(390px, calc(100vw - 36px))`(`src/styles.css:5301`)。差の理由は分からなかった。
- `src/keyboardNavigation.ts:119-122` のモーダル内の処理の中身は追い切れていない。

### I(辞書と検索)

- 無し。(別の窓かどうか、開き方、ページ、検索の欄の有無、まとめて探す仕組みの有無はコードで確認した。)

### J(記録の画面と、記録のデータ)

- 無し。(`sessions.jsonl` の項目は Rust の型と書き出しの両方で確認した。)

### K(何も無いときと、はじめての起動)

- 無し。(`config.json` が無い・壊れている・空のときの読み込み側の分岐と、画面に出る文を確認した。)

### L(見本の要素ごとの対応表)

- L12 の「サイドバーの下の『タイマーだけ使う』」は、見本 `Main.html` にもリポジトリにも字が見当たらなかった(grep 0 件)。何を指すかは分からなかった。
- 見本 `Done.html` の「できたこと」の欄と「もう5分続ける」は、見本の HTML にもコードにも無かった。指示の表の字と見本の中身が食い違っている。

### M(テストの地図)

- 各 spec が「主にどの画面を見ているか」は、ファイル名・`test.describe`・テスト名から分かる範囲で 1 行にした。テストを実行して画面を確かめてはいない。
- M-2 の目印は、テストが実際に使っているクラス名・`role`・`aria-label`・画面の文字を機械的に集めた物。テストが「目印を変えると落ちるか」を実際に試してはいない(テストは回していない)。

### N(版と公開の物)

- NSIS のインストーラー定義やパッケージ用スクリプト(`scripts/*.ps1`)に版の数字を直接書いている所は無く、すべて Tauri／Cargo の値から入る作りに見えるが、生成物への版の埋め込みを実際に確認した記録は無い。

### O(設計のレビューを受けて足した調べ)

- Windows が修飾キー無しの `F1` をグローバルホットキーとして登録できるか、WebView2 が `F1` をページに渡すかは、リポジトリのコードからは分からない(`Shortcut::from_str` は `tauri-plugin-global-shortcut` / `global-hotkey` クレートの実装で、リポジトリ内にソースが無い)。`F1` を割り当てた実機・テストは無い。
- `sourceWishlistId` が保存の往復で消えるという読み(`save_config` が sanitize して書き出す)は、コードを読んだ結果で、**実機では確かめていない。**
- 鮮度の「書き直す」で `reviewedAt` が残るため 14 日の判定が解消しないという読みも、コードを読んだ結果で、**実機では確かめていない。**
- 3 つの一覧の行にフォーカスがある状態で Enter を押したときに、WebView2 側や OS 側で何かが起きるかは、リポジトリのコードからは分からない(アプリ側にハンドラが無いことだけを確認した)。
