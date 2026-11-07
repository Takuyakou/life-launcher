# P97-06 — 古い「今日を組み立てる」の削除 報告

- 日付: 2026-11-07
- ブランチ: `feature/p97-06-legacy-today-builder`（`main` = `38d5455` から）
- 判定: **DONE**

## 実装内容の要約

`legacyTodayBuilderVisible()`（常に `false`）と、その分岐の中でしか使っていない古い「今日を組み立てる」の JSX（約400行）を消した。あわせて、そこからしか呼ばれていない関数・型・state・ref、旧「今日を組み立てる」へのドラッグ復元、旧コンテキストメニュー、候補の並べ替えを消し、`styles.css` からそのためだけの CSS（28クラス・92セレクタ・62規則）を消した。今の「今日やるものを選ぶ」（新しい選ぶ画面）と共有している state・関数・CSS は残した。

- `src/App.tsx`: 17行追加・1,136行削除（15,643行 / 620,014バイト）
- `src/styles.css`: 16行追加・491行削除（12,823行 / 273,062バイト。279,853バイトから 6,791バイト減）
- 基準画像: **0枚**（更新なし）
- 計算後のスタイル比較: **45画面・4,914スナップショット・821,082要素比較で違い 0**

## 消したもの・残したもの

### 消したもの（旧「今日を組み立てる」の分岐でしか使っていないもの）

| 種類 | 消したもの |
| --- | --- |
| JSX | `legacyTodayBuilderVisible()` の分岐（`todayBuilderBand`、ヘッダー、本文、候補行、ページ送り、復元ドロップゾーン。約400行） |
| 型 | `TodayBuilderPointerDrag`、`TodayBuilderDragPreview`、コンテキストメニューの `todayBuilder` / `todayBuilderBar` |
| state | `todayBuilderOpen`、`todayBuilderPage`、`todayBuilderWishlistCollapsed`、`todayBuilderPointerDrag`、`builderRestoreTargetActive`、`setTodayBuilderOrderRevision` |
| ref | `todayBuilderPointerDragRef`、`todayBuilderOpenRef`、`builderAutoOpenTimerRef`、`builderTemporarilyOpenedRef` |
| 関数 | `legacyTodayBuilderVisible`、`toggleTodayBuilder`、`focusTodayBuilder`、`focusCandidateSource`、`navigateToCandidateSource`、`start/update/finish/cancelTodayBuilderPointerDrag`、`builderRestoreTargetFromPoint`、`clearBuilderRestoreHover`、`updateBuilderRestoreHover`、`sourceCanReturnToBuilder`、`finishBuilderRestoreDrop`、`restoreTodayBuilderCandidate`、`explicitlyExcludedCandidate`、`candidateFromConfig`、`saveTodayBuilderOrder`、`moveTodayBuilderCandidate`、`moveTodayBuilderCandidateByOffset`、`editTodayBuilderCandidate`、`todayBuilderWishlistGroupKey`、`todayBuilderCandidates`、`isTodayBuilderCandidateActive`、`excludeTodayBuilderCandidate`、`todayBuilderWishlistGroupCounts`、`visibleTodayBuilderCandidates`、`todayBuilderPageCount`、`visibleTodayBuilderPage`、`todayBuilderDropTargetFromPoint` |
| 定数・補助 | `TODAY_BUILDER_PAGE_SIZE`、`TODAY_BUILDER_ORDER_STORAGE_KEY`、`readStoredStringArray`、`writeStoredStringArray` |
| ドラッグ | 旧「今日を組み立てる」への復元（プロジェクト／やりたいことのドラッグ中に `.todayBuilderBand` を見る処理、`restoreTarget` / `restoreEligible`、復元用のドラッグゴーストの分岐） |
| 呼び出し | `startNextTodayBatch` の `focusTodayBuilder()`（トースト「次の3件を選べます」は残した） |
| CSS | `moveTodayButton`、`sectionEmptyActions`、`sectionEmptyActions--sources`、`sourceListCopy`、`sourceListCopy--groupedWishlist`、`todayBuilderActions`、`todayBuilderAddButton`、`todayBuilderBand`、`todayBuilderBand--restoreHover`、`todayBuilderBand--restoreTarget`、`todayBuilderBody`、`todayBuilderCandidate`、`todayBuilderDisclosure`、`todayBuilderDragGhost`、`todayBuilderDragGhost--today`、`todayBuilderDropIndicator`、`todayBuilderGroupHeading`、`todayBuilderHeader`、`todayBuilderPagination`、`todayBuilderProjectGroupHeader`、`todayBuilderRestoreDropZone`、`todayBuilderRestoreDropZone--active`、`todayBuilderRow`、`todayBuilderRow--dragging`、`todayBuilderRow--selected`、`todayBuilderSelectedStatus`、`projectDragGhost--restore`、`inboxDragGhost--restore` |

### 残したもの（今の画面と共有しているもの）

| 種類 | 残したもの | 理由 |
| --- | --- | --- |
| 候補の材料 | `rawTodayBuilderCandidates`、`buildTodayCandidates`、`TodayCandidate`、`todayCandidateFromConfig`、`todayItemFromCandidate` | 新しい「今日やるものを選ぶ」が使っている。名前は `todayBuilder` のままだが、共有なので変えない |
| 今日の3件 | `addCandidateToToday`、`removeTodayItem`、`todaySourceKey`、`isTimerActiveForSource` | 新しい選ぶ画面・今日の3件・タイマーが使っている |
| 選ぶ画面 | `todayPickerOpen`、`todayPickerWishlistCollapsed`、`todayPickerSource`、`todayPickerDraftItems`、`todayPickerSaving`、`openTodayPicker`、`closeTodayPicker`、`requestCloseTodayPicker`、`saveTodayPickerDraft`、`chooseTodayCandidate`、`removeTodayPickerDraftItem`、`todayPickerNextStepCandidates`、`todayPickerWishlistCandidates` | 今の「今日やるものを選ぶ」そのもの |
| CSS | `todayGrid`、`todayRow`、`todayActivityBand`、`todayPickerRow`、`todayPickerAddButton`、`sourceReturnBand--target` / `--active`、`sourceReturnDropZone`、`projectDragGhost` / `inboxDragGhost`（基本）、`projectDragGhost--today`、`todayDragGhost`、`todayDropIndicator` | 今の画面・プロジェクトとやりたいことの移動・今日の3件へのドロップが使っている |

- 旧「今日を組み立てる」の並び順は `localStorage` の `life-launcher-today-builder-order` に保存していた。今回から読み書きしない。既存のキーは無視される（消しには行っていない。動きに影響しない）。
- `todayBuilderRow--groupedWishlist` は CSS に規則がなかったため、消したクラスの一覧には入れていない。

## 見た目が変わらないことの確かめ方（Phase 9.5 の P95-02 と同じ方法）

一時的な Playwright のテスト（リポジトリには入れていない）で、消す前の `main` と消した後の両方について、各画面の `document.body` の中のすべての要素と `::before`・`::after` の `getComputedStyle` の全プロパティをハッシュにして比べた。

- 比べた画面: **45**
  - メイン: 表示サイズ standard / large / xlarge × 幅 1080 / 860 / 700 / 560（12）＋ 今日0件 × 3表示サイズ（3）
  - タイマー: 実行中・一時停止・拡大（3）、今日やるものを選ぶ（1）
  - 設定: 基本・ショートカット・手順書・バックアップ・メンテナンス × standard / xlarge（10）
  - 記録: ふりかえり・今週を決める・すべての記録 × standard / xlarge（6）
  - ダイアログ: 使い方・プロジェクト追加・やりたいこと追加（3）
  - メニュー: プロジェクト・今日の行（2）、トースト（1）
  - ミニ: 待機・実行中（2）、辞書（1）、手順書ビューアー（1）
- 状態: 各画面のそのままの状態に加え、操作できる要素（最大40個）について hover・focus（focus-visible を含む）・押下（active + hover）を CDP の `CSS.forcePseudoState` で付けて、その要素の2つ上の親の下全体を比べた。
- 時計は固定し、アニメーションと遷移は止めた。
- 結果: **4,914スナップショット、821,082要素比較、違い 0**。スナップショットの欠け・余りも 0。
- 基準画像は1枚も更新していない（`test:visual` 623件が更新なしで通過）。

## テストが古い JSX のクラス名を見ている箇所

次のテストは古いクラス名をセレクタに使っているが、いずれも「**出ていないこと**（count 0）」を確かめるもので、今回の削除と矛盾しない。期待値は消していないし、変えていない。623件の実行でそのまま通った。

| テスト | 確かめていること |
| --- | --- |
| `tests/visual/phase6-main.spec.ts:183` | やりたいことの行に旧 `.inboxRow .moveTodayButton` が**出ない**こと（新しい選ぶ画面に置き換わったことの確認） |
| `tests/visual/phase6-readiness.spec.ts:144` | 同上（旧インラインの「今日へ」ボタンが**出ない**こと） |
| `tests/visual/phase84-today-picker.spec.ts:48` | 旧 `.todayBuilderBand` が**出ない**こと（新しい選ぶ画面を使うことの確認） |
| `tests/visual/phase84-today-picker.spec.ts:196` | 同上（3件選んだ後に旧バンドが**出ない**こと） |

- 旧 JSX の存在を期待しているテストはなかった。テストの期待値を消したり、緩めたりはしていない。
- これらのセレクタを新しい名前に置き換えるかは別の判断（今のままで「出ないこと」の見張りになっている）。

## 完了条件ごとの結果

- [x] 古い「今日を組み立てる」を消した。消したもの・残したものの表がある → 上の表
- [x] 計算後のスタイルの比較で違いが 0。基準画像は変わらない → 45画面・4,914スナップショット・821,082要素比較で 0、基準画像 0枚
- [x] 必須ゲートがローカルで通る → 下の表

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | PASS（3634ファイル、blocker 0） |
| `npm.cmd run lint` | PASS（警告0） |
| `npm.cmd run build` | PASS（CSS バンドル 213.63 kB → 206.04 kB、gzip 34.61 kB → 33.68 kB） |
| `npm.cmd run test:visual` | **623/623 PASS**（2.4分 / 142.7秒） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | **146 PASS**（145 unit + 1 capability） |
| `git diff --check` | PASS |

Rust のコードは変えていない。npm の依存も変えていない。

## 更新した基準画像

**0枚**。見た目が変わらないため。`test:visual` の画像比較は更新なしで通った。

## 判断メモ

1. **`startNextTodayBatch` の `focusTodayBuilder()`**: 旧バンドを開くためだけの呼び出しで、旧バンドは画面に出ないため、消しても見た目は変わらない。トースト「次の3件を選べます」は残した。
2. **復元（今日の候補に戻す）**: 旧バンドへのドロップでしか使えなかったため、プロジェクト／やりたいことのドラッグから復元の分岐を消した。今の「今日の候補に戻す」は新しい選ぶ画面側の操作で行う。
3. **`rawTodayBuilderCandidates` の名前**: 新しい選ぶ画面が使っている共有の変数なので、名前は変えずに残した（rename は別の片付け）。
4. **CSS の書式**: セレクタの並びから死んだものだけを外した箇所が16行あり、その行は1行にまとまった。規則の順番と、残した規則の中身は変えていない。
5. **`:not()` / `:is()` の中**: Phase 9.5 と同じく、括弧の中のクラスは消していない（`todayBuilderRow--selected` などが `:not()` の中に残っている箇所はそのまま）。

## 提案

- **計算後のスタイル比較の再利用**: 今回の一時テストを `scripts/style-snapshot.mjs`（画面と状態を取る）と `scripts/compare-style-snapshot.mjs`（前後を比べる）に分けて置き、`npm run style:snapshot` で任意に実行できるようにする。実行に4〜7分かかるため CI には入れず、CSS を整理するときだけ使う形がよい。
- **`rawTodayBuilderCandidates` の rename**: `rawTodayCandidates` にすると、旧機能の名前が製品コードから消える。共有の変数なので、動きを変えずに rename できる（別 Stage）。
- **テストの旧クラス名**: `phase6-main` / `phase6-readiness` / `phase84-today-picker` の「旧クラスが出ないこと」の確認は、今の見張りとして残す。消す場合は、新しい選ぶ画面のクラスで同じことを確かめる形に置き換える。
