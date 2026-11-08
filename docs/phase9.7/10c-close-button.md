# P97-10c — 窓の閉じるボタンを押しやすくする 報告

- 日付: 2026-11-08
- ブランチ: `fix/p97-close-button`（`main` = `d1489af` から）
- 判定: **DONE**

## 実装内容の要約

閉じるボタンだけを44×32に広げ、透明な `::before` で押せる範囲を窓の右端まで広げた。最大化しているときは、同じ透明な範囲を窓の上端まで広げて右上の角でも閉じられるようにし、最大化していないときは上端を今までどおり窓の大きさを変える場所として残した。メイン画面と手順書ビューアーの両方に効く。

## 変更ファイル一覧

| ファイル | 内容 |
| --- | --- |
| `src/components/WindowControls.tsx` | 最大化中だけ `windowControls--maximized` を付ける |
| `src/styles.css` | 閉じるボタンを44pxに。`::before` で右端（最大化時は上端も）まで押せる範囲を拡張。表示サイズごとの上端オフセットを追加。仕切り線の左右余白を8/6→4/2にして帯幅127pxを維持 |
| `tests/visual/phase97-close-button.spec.ts` | 幅・右端の当たり・乗せた赤・クリックで閉じる・最大化/非最大化の右上・大/特大・手順書ビューアーの7件 |
| `tests/visual/phase97-import.spec.ts-snapshots/phase97-import-drop-main-win32.png` | 窓のボタンが写っているため更新 |
| `tests/visual/phase97-import.spec.ts-snapshots/phase97-import-drop-sidebar-win32.png` | 窓のボタンが写っているため更新 |
| `docs/phase9.7/10c-close-button.md` | この報告 |

## 完了条件ごとの結果

### 1. 閉じるボタンだけ44px、押せる範囲は右端まで

- 閉じるボタン: 幅44px・高さ32px。最小化・最大化は36×32のまま。アイコンは12pxのまま。
- 乗せたときの赤（`--error`）と押したときの色は今までどおり。`windowControlButton--close:hover` / `:active` の指定は変えていない。
- 閉じるボタンの右に透明な `::before`（`right: -8px; width: 8px; top: 0; bottom: 0`）を置き、窓の右端まで押せるようにした。見た目は透明のまま。
- 右端の1px内側・ボタンの縦の真ん中で `document.elementFromPoint` が閉じるボタンになり、そこに乗せると赤くなり、クリックで閉じることをテストした。
- 透明な範囲はボタンの一部なので、ボタンの `:hover` がそのまま効く。赤くなるのは44pxのボタン本体で、透明な8pxは塗らない（見た目を変えないため）。

### 2. 最大化中だけ右上の角まで広げる

- `WindowControls` が持っている `maximized` の状態で `windowControls--maximized` を付ける。
- 最大化中は `::before` の `top` を `calc(-1 * var(--window-controls-close-top-offset))` にし、窓の上端まで届かせる。
- 上端オフセットは、ボタンの上端が窓の上端に来る値: 標準24px、大25.5px、特大29px、幅760px以下18px、手順書ビューアー13px。
- 最大化中は右上の角（右端の1px内側・上端の1px内側）でも閉じるボタンになる。標準・大・特大でテストした。
- 最大化していないときは `::before` の `top` が0（ボタンの上端）のままなので、窓の上端と右上の角は今までどおり窓の大きさを変える場所として残る。右上の角が閉じるボタンでないことをテストした。

### 3. メイン画面と手順書ビューアーの両方

- `WindowControls` は両方で同じ部品なので、同じCSSと状態クラスが効く。
- 手順書ビューアーでも閉じるボタンが44pxで、右端の1px内側が閉じるボタンになることをテストした。
- ビューアーの上端オフセット13pxは、ビューアーのヘッダー（高さ58px）の中央にボタンがある前提。

### 4. 変えないもの

- ボタンの並び・順番（最小化・最大化・閉じる）は変えていない。
- キーボードの移り方（P96-03 の ←→）は変えていない。既存の `phase96-titlebar` のキーボードのテストが通る。
- 窓が裏にあるときの薄さ（`windowControls--unfocused`）と、P96-01 の乗せた色の残りの直し（`windowControls--hover-suppressed`）は変えていない。
- 上部メニューの文字の段階は、閉じるボタンの+8pxを仕切り線の左右余白（8/6→4/2）で吸収し、帯幅を127pxのままにした。そのため上部メニューの右余白111pxと、ダイアログ・手順書ヘッダーの143pxも変えていない。
- 段階の切り替わる幅を測り直した結果、必要な内容幅は **650px / 517px / 452px** のまま。テストした幅での段階も、860px `[2,2,2]`、1080px `[0,1,1]`、1200/1440/1920px `[0,0,0]` で変わっていない。`phase96-titlebar` の30通りのレイアウト予算テストも通る。

## テスト

- `phase97-close-button.spec.ts` の7件:
  - 閉じる44px、最小化・最大化36px、高さ32px
  - 右端1px内側の縦中央が閉じるボタン。乗せると `rgb(240, 111, 104)`（`--error`）
  - 最大化していないとき、右上の角は閉じるボタンではない
  - 最大化すると `windowControls--maximized` が付き、右上の角が閉じるボタンになる（標準・大・特大）
  - 右端の拡張範囲をクリックすると閉じる（`plugin:window|close`、`visible=false`）
  - 手順書ビューアーでも44px・右端1px内側が閉じるボタン
- 既存: `phase96-titlebar` 34件、`phase96-topmenu-labels` 5件、`phase96-titlebar` のレイアウト予算30通りがすべて成功。

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm run public:check` | 成功（3,654ファイル、0 blockers） |
| `npm run lint` | 成功（0エラー、0警告） |
| `npm run build` | 成功 |
| `npm run test:visual` | 669件成功（2.5分） |
| `cargo fmt --check` | 成功 |
| `cargo check` | 成功 |
| `cargo clippy --all-targets -- -D warnings` | 成功 |
| `cargo test` | 157 unit + 1 capability = 158件成功 |
| `git diff --check` | 成功 |

## 更新した基準画像の一覧と理由

| 画像 | 理由 |
| --- | --- |
| `tests/visual/phase97-import.spec.ts-snapshots/phase97-import-drop-main-win32.png` | メイン画面の右上に窓のボタンが写っており、閉じるボタンの幅・アイコン位置が変わったため |
| `tests/visual/phase97-import.spec.ts-snapshots/phase97-import-drop-sidebar-win32.png` | 同じく窓のボタンが写っているため |

ほかの基準画像は変えていない。窓のボタンが写っていない画像（やりたいことの節など）は更新していない。

## 判断メモ

- 閉じるボタンの+8pxを、上部メニューの右余白を増やして吸収すると、狭い幅で見出しが2行になったり、文字の段階が8px早く切り替わったりした。今回は仕切り線の左右余白を8/6→4/2にして帯幅127pxを維持し、上部メニューの段階と見出しの1行をそのまま保つ方を選んだ。
- 透明な `::before` はボタンの子として置いた。`elementFromPoint` はボタン本体を返し、乗せた状態・クリックもボタンに集約される。
- 最大化時の上端オフセットは、各表示サイズの `.windowControls` の `top` と `height` から、ボタン上端が窓の上端に来る値を計算してCSS変数にした。固定の24pxだけにすると大・特大で上端に届かない。
- 閉じるボタンのアイコン中心は、幅が36→44になる分だけ4px左へ動く。ボタンの右端は窓の右端から8pxのまま。
- 透明な8pxは塗らないので、右端に乗せたときの赤は44pxのボタン本体だけに出る。押せる範囲と赤い見た目は一致しないが、見た目を変えない条件を優先した。
- 基準画像は、窓のボタンが写っている2枚だけを更新した。上部メニューの段階を変えていないため、ほかの画面の画像は動いていない。

## 提案

- P97-11 の実機確認で、最大化したときの画面右上の角、最大化していないときの右上の角（窓の大きさを変えられること）、メイン画面と手順書ビューアーの両方、表示サイズ「特大」を確かめる。
- 右端の透明な範囲に乗せたとき、赤が8px手前で止まるのが気になる場合は、`::before` にも `--error` を塗る選択肢がある。今回は「見た目を変えずに押せる範囲だけ広げる」を優先した。

## 追記（2026-11-08）— Ctrl+W で閉じる

オーナー判断 2026-11-08。`fix/p97-close-button` に、閉じるボタンと同じ処理を呼ぶ Ctrl+W を足した。

### 実装

- `WindowControls` の `close()`（`getCurrentWindow().close()`）を、閉じるボタンと Ctrl+W の両方から呼ぶ。別の閉じ方や `hide()` / `destroy()` は作っていない。- `window` の `keydown` を capture で受け、`Ctrl+W`（Shift・Alt・Meta なし、`event.key` が `w` または `event.code` が `KeyW`）で発火する。ダイアログや入力欄にフォーカスがあっても届く。
- 発火時に `preventDefault()` して WebView の既定の Ctrl+W を止める。`event.repeat` では閉じない。閉じる処理は1回だけ。
- メイン画面では今の CloseRequested（トレイへ格納）をそのまま通り、手順書ビューアーでは今の `onCloseRequested`（dirty なら確認）をそのまま通る。ミニタイマーの表示中も同じ。
- Esc でダイアログを閉じる動きは変えていない。

### 設定のショートカットとのぶつかり

- 設定で変えられる4つ（メイン呼び出し・辞書・ミニタイマー切替・手順書）のどれかに Ctrl+W を入れようとすると、保存時に「Ctrl+W はアプリの『閉じる』で使っています」と出して保存しない。入力中の案内も同じ文にした。
- すでに config の4つのどれかに Ctrl+W が設定されている場合は、その設定を優先し、Ctrl+W では閉じない。`closeShortcutDisabled` を `WindowControls` に渡して切り替える。4つすべてをテストした。
- ショートカットの登録待ちの間だけは、Ctrl+W を閉じる処理より登録に渡す（Ctrl+W を押して「ぶつかる」と案内を出すため）。登録待ち以外のダイアログ・入力欄では閉じる。
- WebView の既定の Ctrl+W は、閉じる処理が有効なときも、config 優先で閉じないときも `preventDefault()` で止める。二重に閉じない。

### 使い方と仕様

- `src/content/helpGuide.ts` の「困ったとき」に「窓を閉じるには？」を追加し、右上の×または Ctrl+W、メインはトレイ、ビューアーは確認つきで閉じることを書いた。
- `docs/spec/current-spec.md` §6.1 に、Ctrl+W の動作、ダイアログ・入力欄での扱い、設定とのぶつかり、config 優先、WebView の既定を止めることを書いた。

### テスト（追記分）

- `tests/visual/phase97-close-button.spec.ts` を7件から18件に増やした。
  - メイン画面の Ctrl+W で `plugin:window|close` が1回だけ呼ばれる。
  - WebView の既定の動きを `preventDefault()` で止めている。
  - 設定ダイアログの入力欄にフォーカスがある状態でも閉じる。
  - 手順書ビューアーが clean のときは閉じ、編集中は確認が出る。
  - 辞書のショートカットに Ctrl+W を登録すると、入力中の案内と保存時のトーストが出て、config が変わらない。
  - config の `focusHotkey` / `launcherHotkey` / `miniHotkey` / `instructionHotkey` のそれぞれに Ctrl+W があるとき、Ctrl+W で閉じない。
  - 既存の config に Ctrl+W があるまま、ほかの設定（短時間タイマー分数）を保存できる。

### 実行したゲート（追記分）

| ゲート | 結果 |
| --- | --- |
| `npm run public:check` | 成功（3,654ファイル、0 blockers） |
| `npm run lint` | 成功（0エラー、0警告） |
| `npm run build` | 成功 |
| `npm run test:visual` | 669件成功（2.5分） |
| `cargo fmt --check` | 成功 |
| `cargo check` | 成功 |
| `cargo clippy --all-targets -- -D warnings` | 成功 |
| `cargo test` | 157 unit + 1 capability = 158件成功 |
| `git diff --check` | 成功 |

### 追記の変更ファイル

- `src/components/WindowControls.tsx`: Ctrl+W の capture ハンドラ、`closeShortcutDisabled`。
- `src/App.tsx`: 4つの設定の Ctrl+W 判定、保存時の案内、`closeShortcutDisabled` の受け渡し。
- `src/components/InstructionViewer.tsx`: 開いたときの config 読み込みと `closeShortcutDisabled` の受け渡し。
- `src/content/helpGuide.ts`: 「窓を閉じるには？」。
- `docs/spec/current-spec.md` §6.1: Ctrl+W と設定のぶつかり。
- `tests/visual/phase97-close-button.spec.ts`: 18件。
- `docs/phase9.7/10c-close-button.md`: この追記。

### 判断メモ（追記）

- Ctrl+W の処理は `WindowControls` に置いた。閉じるボタンと同じコンポーネント・同じ `close()` を使うため、メイン画面と手順書ビューアーで閉じ方の違いが出ない。
- 設定の登録待ちだけは、Ctrl+W を登録に渡す例外にした。そうしないと「Ctrl+W を設定しようとしたら窓が閉じる」となり、ぶつかりの案内を出せない。
- config に Ctrl+W があるときは、閉じる処理を止めるだけでなく WebView の既定も止める。設定したショートカット（グローバル側）を壊さないため。
- 既存の `matchesHotkey()` は辞書の入力欄では無効になるが、config 優先の確認は閉じる側の `closeShortcutDisabled` で行う。入力欄にフォーカスがあっても、config に Ctrl+W があれば閉じない。
- 手順書ビューアーも、開いたときに `loadConfig()` で config を読み、4つのどれかに Ctrl+W があれば閉じない（開いた時点の設定）。設定の読み込みに失敗したときは、今までどおり Ctrl+W で閉じる。
