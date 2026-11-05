# P96-01 — 一体型タイトルバー(メイン画面・手順書ビューアー) 報告

- 日付: 2026-11-05
- ブランチ: `feature/p96-01-integrated-titlebar`
- 最終ステータス: **DONE**(実装・テスト・ゲート完了。実機確認のうち人の手が必要な項目は「オーナー確認待ち」)

## 実装内容の要約

メイン画面と手順書ビューアーからWindows標準のタイトルバーを外し、窓の右上(右端から 8px)に固定する窓のボタン3つと、ドラッグできる範囲(上部メニュー行・上端の余白・ブランド表示・ダイアログの幕の上端の帯)を一体化ヘッダーとして実装した。window-stateプラグインが `decorated` を保存・復元しないようにし、幅の予算はオーナー決定の案A(行内gap 8px＋大・特大で ≤1150px のラベル隠し拡大＋行の右余白の動的予約)で 24通りすべて収まることを実測で確かめた。

## オーナー決定の反映記録

| 決定 | 反映 |
| --- | --- |
| 幅の直し方: 案A(gap 18→8px、大・特大のラベル隠し閾値 ≤1050 → ≤1150、記録・手順書の文字は残す、topBar への必須対応) | **案Aを採用**。24通り(1920を含む)すべて収まったため案3(全6ボタンのアイコン化)は不使用 |
| 窓のボタンの位置: 窓の右上(右端から 8px)に固定、行と縦の中心をそろえる、重なる幅だけ右に空き | `position: fixed; right: 8px` のドック＋行の `padding-right: max(0px, 111px − max(0px, (100% − 最大幅) / 2))`。1920(中央寄せが効く幅)では予約 0 をテストで担保 |
| 測定とテストの幅に 1920 を足す(24通り) | 24通り(860/1080/1440/1920 × 3表示サイズ × メイン/記録)をコミットしたテストで検証 |
| ダイアログの部品が隠れたら × を帯の左へ(「今日やるものを選ぶ」) | `.todayPickerDialog .modalTitleRow` へ `max(16px, calc(50% − 50vw + 143px))` |
| (同種の発見)「ボタン編集」ダイアログの × も 1366px で衝突 | 同じ決定を同じ形の右上の × に適用: `.modalTitleRow` と `.confirmDialogHeader` に一般化(重ならない幅では今の余白のまま) |
| (同種の発見)拡大タイマーの閉じるボタンが帯と衝突(stage文書が予告した項目) | `.expandedTimerHeader` へ同じ式(今の余白 16〜64px を下限) |
| 拡大タイマー表示中も窓のボタンを押せる | 背景を止める `inert` の対象を `.sidebar, .mainPanel` から `.sidebar, .mainScrollArea` に変更(ヘッダーを含めない) |
| 実機確認の安全: アプリ起動中は終了させない | 起動中(pid=55944)のためオーナーに終了を依頼し、終了を確認してから検証した |

## 幅の予算(案A適用、24通り)

コミット済みテスト(`tests/visual/phase96-titlebar.spec.ts`)が 860/1080/1440/1920 × 標準/大/特大 × メイン/記録 の **24/24 を PASS**。窓のボタンは常に窓の内側に全部見え、メニューとの重なり・折返し・見出しの折返しなし。行の右余白の予約は:

| 幅 | 予約 | 根拠 |
| --- | --- | --- |
| 〜約1694px(標準) | 111px | 行の右端が窓の右端から 24px のため |
| 約1694px超(標準) | 0px(連続的に減衰) | 中央寄せで行の右端が帯から離れるため |
| 1920 | 0px | 重ならないため空きを取らない(オーナー決定) |

実装前の測定(BLOCKED報告の18通り、不足 2〜15px)は、案Aの3要素と窓ボタンの fixed 配置で解消。

## 変更ファイル一覧

| ファイル | 変更 |
| --- | --- |
| `src-tauri/tauri.conf.json` | main窓に `decorations: false` |
| `src/instructionWindow.ts` | ビューアー窓に `decorations: false` |
| `src-tauri/src/lib.rs` | window-state の flags から DECORATIONS を除外(`WINDOW_STATE_FLAGS`)＋Rustテスト2件 |
| `src-tauri/capabilities/default.json` | `allow-minimize` `allow-toggle-maximize` `allow-start-dragging` を追加 |
| `src-tauri/capabilities/instruction.json` | `allow-close` `allow-minimize` `allow-toggle-maximize` `allow-start-dragging` を追加 |
| `src-tauri/tests/capability_contract.rs` | 上記追加を契約に反映 |
| `src-tauri/gen/schemas/capabilities.json` | 自動生成(権限変更に伴う) |
| `src/components/WindowControls.tsx` | 新規。仕切り線＋3ボタン、最大化/フォーカス追跡、isTauri ガード |
| `src/components/UiIcon.tsx` | `windowMinimize/windowMaximize/windowRestore/windowClose`(線幅1.2)と size 12 を追加 |
| `src/App.tsx` | ドック設置、ドラッグ領域(mainPanel・topBar・topSummary・topTitle・topDateLabel・topPills・sidebar・brandBlock系)、ダイアログの幕15箇所へ帯、appShell に表示サイズ属性、inert 対象の変更 |
| `src/components/ConfirmDialog.tsx` `HelpGuideDialog.tsx` `ExpandedTimerOverlay.tsx` | 幕に帯 |
| `src/components/InstructionViewer.tsx` | ドック(variant instruction)、ヘッダーのドラッグ領域 |
| `src/styles.css` | 案A(gap 8px、ラベル隠し、予約式)、ドック、ドラッグ帯、×の帯回避、topBar `min-width: 0`、viewerヘッダー余白143px、reduced-motion |
| `tests/visual/tauriMock.ts` | `plugin:window|minimize / toggle_maximize / internal-toggle-maximize / is_maximized` を追加 |
| `tests/visual/phase96-titlebar.spec.ts` | 新規。16テスト |
| `tests/visual/phase9-visual.spec.ts-snapshots/`(11枚) | 下記「基準画像」 |
| `docs/spec/current-spec.md` | §2 に標準タイトルバーなし・decorated非復元、§6.1 新設、§17.1 に窓ボタン |

## 完了条件ごとの結果

- [x] メイン画面と手順書ビューアーに標準のタイトルバーがなく、一体型ヘッダーの右端に窓のボタンがある → 実装＋テスト(§3・§6の決まりどおり。ビューアーの閉じるは `close()` で `onCloseRequested` を通る)
- [x] 保存した窓の状態で標準のタイトルバーが戻らない → flags から DECORATIONS を除外＋Rustテスト(v1.4.1形のテストデータ。項目名は実物を写した `decorated`。プラグイン2.4.1の非公開構造のミラーで検証し、項目名が変わったらテストが失敗して気づける)
- [x] ドラッグ・ダブルクリック・閉じる(タスクトレイ)・最小化・最大化 → 属性と動作を実装。**実際の窓の動きはオーナー確認待ち(下記)**
- [x] ダイアログを開いたままでも窓のボタンが押せ、窓を動かせる → テスト(elementFromPoint・Tab除外・フォーカス復帰・幕の上端の帯)
- [x] 0. の測定の表 → 24/24 PASS(上記)
- [x] 手順書ビューアーの未保存の確認が、窓のボタンで閉じたときも出る → テスト(close要求→確認ダイアログ→編集内容保持)
- [x] 「実機確認」の結果 → 下記
- [x] `docs/spec/current-spec.md` に決まりを記載
- [x] 必須ゲートがローカルで通る

## テストの期待値の変更(オーナー指示4)

- `phase89-main-display.spec.ts` の「topBar 幅 = コンテンツ幅」(3件): **変更不要**。窓のボタンは行の外(fixed配置)にあり、行は `padding-right` で右に空きを取るため、topBar の box の位置も幅も変わらないため。全テストが無変更のまま通ることを確認
- その他の既存テスト: 無変更で通る(修正したのは新規 spec と tauriMock のみ)

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | PASS |
| `npm.cmd run lint` | PASS(警告0) |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | **557/557 PASS**(約2.3分) |
| `cargo fmt -- --check` | PASS |
| `cargo check` | PASS |
| `cargo clippy --all-targets -- -D warnings` | PASS |
| `cargo test` | **133 PASS**(lib 132＋capability契約 1) |
| `git diff --check` | PASS |

## 更新した基準画像(11枚)と理由

窓のボタンが増える・行の右余白とメニュー間隔が変わる・×の位置が変わる画面のみ:

- `main-standard` `main-large` `main-xlarge` `main-min` `main-running`(窓のボタン＋行の右余白＋gap 8px)
- `records-review` `records-week` `records-all`(同上)
- `timer-expanded`(窓のボタンが幕より手前に見える＋拡大タイマーの閉じるが帯より左へ)
- `today-picker`(窓のボタン＋×が帯より左へ)
- `settings-basic`(窓のボタンが幕より手前に見える)
- 変更なし: `mini-idle` `mini-running`(ミニタイマーは対象外)

## 実機確認

### プログラムで確かめた結果(テスト用 debug ビルド、オーナーの Life Launcher を終了してから実施)

| 項目 | 結果 |
| --- | --- |
| 標準のタイトルバーがない | **PASS** — クライアント領域が窓の上端 +1px から始まる(タイトルバーの高さがない)。tao はリサイズ枠のため内部で WS_CAPTION を持つため、GWL_STYLE ではなくクライアント位置で判定 |
| 最大化で作業領域に収まる | **測定値** — 最大化クライアント `(3840,0)-(5760,1079)` vs 作業領域 `(3840,0)-(5760,1080)`。下端 1px 差。見た目の問題はオーナー確認待ち |
| 元に戻す | **PASS** — 元の矩形 `(3892,52)-(4988,741)` に戻る(zoomed=False) |
| 最小化 | **PASS** — `IsIconic=True`。元に戻すと同じ矩形 |
| データの安全 | **PASS** — 検証後、`config.json` はハッシュ一致(無変更)。`.window-state.json` はバックアップから復元(ハッシュ一致)。レジスタ `HKCU\...\Run` に Life Launcher の項目なし(開始前と同じ) |

注: APPDATA 切替では隔離にならない(オーナー指摘のとおり)ため、実データのバックアップ(`config.json`・`.window-state.json`・データディレクトリ全体)を検証前に控え、検証後に復元してハッシュで確認した。

### オーナー確認待ち(人の手と目が必要な項目)

1. 標準の白いタイトルバーが出ない(メイン・ビューアー)。v1.4.1の状態からの更新初回でも出ない
2. ドラッグで窓が動く場所/動かない場所(§6.1 の表どおり)。ダブルクリックで最大化・元に戻す
3. **窓の上端での大きさの変更と、上端の余白のドラッグがぶつからない**(オーナー指示2で追加)
4. 窓を画面の端へドラッグするとスナップする。Win+Z で配置を選べる(使える前提にしない)
5. 窓の4辺と4つの角で大きさを変えられる
6. 最大化で作業領域に収まる(プログラム検証では下端 1px 差。目視で問題ないか)
7. 閉じるでタスクトレイに隠れ、トレイから戻せる。最小化できる
8. 別の窓を前に出すと窓のボタンが薄くなる(不透明度 0.45)
9. ダイアログ開いたまま窓を動かせ、マウスで最小化・閉じるができる。戻すとダイアログ内の前の場所にフォーカス
10. 手順書ビューアーで同じ 1〜7。未保存の編集があるとき閉じると確認ダイアログが出て編集内容が消えない
11. ミニタイマーと辞書が今までと同じ
12. 最大化クライアントの下端 1px 差が見た目として問題ないか

## 判断メモ

- 窓のボタンは行内ではなく fixed 配置(オーナー指示1)。行は重なる幅のときだけ `padding-right`(最大111px)で空きを取る。topBar の box は動かないため phase89 の幅テストは無変更
- 実装中に見つけた構造上の問題と対応: (1) `.topBar` はグリッドアイテムで `min-width: auto` のため、縮められない子を含むと指定幅を無視して膨らみ窓の外に出る → `min-width: 0` を追加。(2) 拡大タイマー表示中に `.mainPanel` 全体へ `inert` が付き、ヘッダー内の窓のボタンまで押せなくなっていた → inert の対象を本文領域に変更(P8.10 のフォーカストラップと Tab の契約は無変更で通ることを phase810 全7テストで確認)
- ダイアログ右上の × の帯回避は、オーナーの「今日やるものを選ぶ」の決定を同じ形(右上の ×)を持つダイアログすべてに適用した。`calc(50% − 50vw + 143px)` はダイアログの幅や padding によらず正しく帯の左端+8px に置く式
- 実装前の BLOCKED 報告(本PRの最初のコミット)は、測定の段階での報告。案A決定後に実装を再開した

## 提案

- 基準画像の再生成で気づいた点: `toHaveScreenshot` の許容差(0.001)は薄いアイコンの変化を吸収できるため、ドックのある画面の基準画像は意図的に再生成が必要(今回実施済み)
- P96-02(タイマーの線)はヘッダーの上端に触れるため、今回の fixed ドックと帯の実装を前提に着手すること
