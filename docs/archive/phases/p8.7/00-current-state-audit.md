# P8.7-00 Current-State Audit

監査日: 2026-09-22  
対象: Life Launcher Windows desktop v1.3.0  
判定: PASS

## 1. Repository baseline

| 項目 | 結果 |
| --- | --- |
| branch | `docs/p87-00-current-state-audit` |
| HEAD / base | `ac661e7` (`origin/main`) |
| v1.3.0 tag | `8ca3c98` |
| working tree | 監査開始時 clean |
| product version | npm / Cargo / Tauri ともに `1.3.0` |
| config schema | `CONFIG_VERSION = 3` |
| v1.3.0以降 | `origin/main`には公開記録のdocs commit 1件のみ。未releaseの製品変更なし |

通常checkoutには別作業の変更があるため触れず、`origin/main`から専用worktreeを作成して監査した。

### Baseline gates

- `npm ci`: PASS（172 packages、npm vulnerability 0）
- `npm run public:check`: PASS（370 files、blocker 0）
- `npm run lint`: PASS
- `npm run build`: PASS（chunk size warningのみ）
- `npm run test:visual`: PASS（359 passed / 48 skipped / 0 failed、全407件）
- `cargo fmt --all -- --check`: PASS
- `cargo check --manifest-path src-tauri/Cargo.toml`: PASS
- `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings`: PASS
- `cargo test --manifest-path src-tauri/Cargo.toml`: PASS（unit 129、capability 2、failure 0）
- npm production/dev audit: PASS（vulnerability 0）
- `git diff --check`: PASS

Visual baselineは既存Playwright visual suiteで確認した。専用のP8.7画面変更はまだ行っていない。

## 2. Dictionary

### Current behavior

- Mainの「辞書を開く」は現在のshortcutを`kbd`表示するが、別windowを示すiconはない。
- 既定値は`Ctrl+K`。SettingsのShortcutにはすでに「辞書」用の`launcherHotkey`項目がある。
- Rustのglobal shortcut登録に`Launcher` actionが含まれ、押下時に`launcher-shortcut-toggle`をemitする。Mainがhidden/tray residentでもDictionaryを直接toggleする設計で、Main focus時だけのshortcutではない。
- Main側にもwindow keydown handlerがあるが、これはbrowser/visual fallbackとfocused window操作用であり、別のglobal shortcut登録ではない。
- Dictionaryはsingle windowとして再利用され、lock状態、page/focus/scroll、monitor placementの既存契約を持つ。
- titlebarにはlockとcloseがある。Settings iconとtitlebar context menuはない。
- tileは現在`auto-fill` + `minmax(104px, 1fr)`、iconは32px、tile min-heightは88px。固定の小/中/大 preferenceはない。
- Dictionary内の起動成功時はwindowをhideし、成功Toastを出していない。失敗時はDictionary内のerror statusを表示する。
- Main Quickには別経路の成功Toastがある。

### Confirmed problems

- Main入口にwindow iconがない。
- Dictionary自身から表示密度を変更する入口・設定がない。
- titlebar右クリックの補助導線がない。

### Obsolete assumptions

- 「辞書shortcutがSettingsから消えた」「Main focus時だけ」は現行コードに該当しない。global登録とSettings項目は既に存在するため二重実装しない。
- 「Dictionary成功Toastを削除」は現行Dictionaryでは既に満たしている。P8.7-01では回帰テストを追加し、Main Quickの成功Toastを巻き込まない。

### Stage P8.7-01 boundary

- Main入口icon、Dictionary Settings icon、空きtitlebarの右クリック導線を追加する。
- icon/tile sizeを`auto / small / medium / large`で保存し、既存利用者は`auto`のままにする。
- 現行global shortcutとsingle-window behaviorを維持し、hidden/tray起動、競合、multi-openを回帰確認する。
- Dictionary成功時no-toastと失敗表示をテストで固定する。
- 列数、font、gap、theme、page別設定、usage rankingは追加しない。

## 3. Drop Register

### Current behavior

- external D&D後のdialogでlabel、group、display target、Dictionary pageを設定する。
- group selectとtext inputが常時並び、既存group選択時も同名がtext inputへ同期される。内部状態が1つの`group`文字列であるため、既存選択と新規入力の意図がUI上で曖昧になっている。
- 確認文には`open_app:`、`run_script:`、`open_folder:`、`open_file:`、`open_url:`など内部action typeが露出する。
- display targetはSidebarとCtrl+K Dictionary。両方OFFでもwarningのみで保存できる。
- Dictionary pageはDictionary表示ON時だけ描画される。
- footerは左Cancel（neutral）、右Add（primary）で、P8.7 referenceと逆。
- 必須validationはlabelのみ。group空欄はdefault扱い。
- parsing、`.lnk`解決、action orderはRust側の既存経路で処理される。

### Confirmed problems

- 内部action prefixがユーザー向け表示に露出する。
- 既存groupと新規groupの操作が二重fieldに見え、modeが分からない。
- footerの順序・semantic colorが現行form grammarおよびreferenceと一致しない。
- saveはdialogを先に閉じて成功Toastを出し、永続化失敗を後から扱うため、Stage 02でdraft retentionの現行挙動を壊さないよう注意が必要。

### Obsolete assumptions

- 「少なくともdisplay target 1つがcurrent validation」は事実ではない。現行はwarningのみで保存可能。P8.7-02はUI整理を主目的とし、この保存契約を無断で変更しない。

### Stage P8.7-02 boundary

- 内部prefixを隠し、read-only pathを人間向けに表示する。
- groupを「既存から選ぶ / 新規グループを作成」の明示modeに分け、同期fieldをなくす。
- display targetとDictionary pageの依存を分かりやすくする。
- footerを左Add（green primary）、右Cancel（muted red）へ統一する。
- parsing、`.lnk`、action order、atomic save/data modelは変更しない。
- current save failure/draft behaviorをテストで把握し、UI変更による退行を防ぐ。

## 4. Instruction Viewer

### Current behavior

- folder 0件のempty stateには「フォルダを選んで作成」と「既存フォルダを読み込む」の2 CTAがある。toolbarにも「読み込み」がある。
- 2 CTAは別frontend functionだが、最終的にはfolder pickerを使う。toolbar「読み込み」は既存folder登録handlerを使う。
- `registeringRoot` guardでpending中の再clickは抑止され、buttonもdisabledになる。
- Windows pickerはhidden PowerShell STA processでWinForms `FolderBrowserDialog`を作り、Instruction WebView HWNDをownerにして`.output()`完了を待つ。
- Instruction windowはdecorationsを無効化していないためnative frame closeがある一方、viewer内部にもcustom close buttonがある。
- pinは独立controlとして存在する。
- Markdown/Textは編集可能。HTML/read-onlyでもEdit button自体は常時描画され、disabled + tooltipで示される。
- Mainからの通常openは成功Toastを出さず、失敗のみMainに表示する。Settingsの「手順書一覧を再読み込み」には成功Toastがある。
- title/document/Guideに旧表記「手順書ビューワー」が残る。

### Freeze reproduction condition

コード上の固定条件は次の通り。

1. folder 0件でtoolbarまたはempty CTAからpickerを開く。
2. frontendはTauri commandを`await`し、`registeringRoot = true`のまま待つ。
3. owner付きPowerShell/WinForms dialogが背面化、focus喪失、またはprocess未完了になる。
4. backendの`.output()`が返らず、frontendの`finally`へ到達しない。
5. 再clickはguardされるため、画面は「選択中…」のまま復帰手段を失う。

複数commandの同時dispatchではなく、native picker process/owner/focusと無期限pendingの組み合わせが主な疑い。P8.7-03では0 folder、select、cancel、focus、always-on-top、window close/unmountをnative smokeで確認し、単純なtimeout追加だけで済ませない。

### Confirmed problems

- folder読み込み入口が3か所あり、empty stateの役割が曖昧。
- native frame closeと内部closeが重複。
- read-only/未選択/HTMLでもEdit controlが常設される。
- picker commandが戻らない場合にpending状態から回復できない。
- 旧表記が残る。

### Obsolete assumptions

- 「成功操作が常にMain Toastへ飛ぶ」は一律には該当しない。通常openは既にno-success-toast。Settings reloadなど実際の発火元だけを対象にする。
- 「読み取り専用」の独立した常設text labelは現行DOMで確認できない。実際の問題はdisabled Edit controlの常設である。

### Stage P8.7-03 boundary

- picker lifecycle/focus原因を修正し、cancel/select/repeat/closeで復帰することをnativeで固定する。
- empty CTAを「フォルダを読み込む」1本にし、toolbarと同一handlerを使う。
- custom closeを除きnative closeへ統一し、pinを維持する。
- Editは編集可能なMarkdown/Text選択時だけ表示し、既存保存・cancel契約を維持する。
- 成功feedbackは操作画面の反映に任せ、errorはviewer内で見えるようにする。
- ユーザー向け表記を「手順書ビューアー」に統一する。

## 5. Help Guide

### Current behavior

- Guideは10 sectionで、TOC、focus、keyboard、narrow layout、scrollの既存UI契約がある。
- 冒頭には開始手順があり、Project / NextStep / Wishlist / Today3の関係、今やる一手、Quick / Dictionary、Timer、Backup / Restore / Resetも説明されている。
- 一方「毎日の基本」は13 bulletの密な契約列挙で、rollback、source identity、lock、legacy例外など内部仕様が複数章に混在する。
- 初心者が最短で価値を体験する順序より、機能・edge caseの網羅が前に出る。
- Guide内にも旧表記「手順書ビューワー」が残る。

### Confirmed problems

- 初見ユーザー向けの説明書より仕様書/test contractに近い。
- 「3分で使ってみる」という明確な最短導線と、具体例を軸にした日常flowが不足する。
- 画面語と旧表記が一部不一致。
- 重要概念は存在するが、情報密度が高く、最初に読む内容と必要時に読む詳細の優先順位が弱い。

### Obsolete assumptions

- Project / NextStep / Wishlist / Today3、今やる一手、Quick / Dictionary、Timer、data protectionの説明が「存在しない」わけではない。全面削除ではなく、正しい内容を初心者向けの順序と文体へ再編集する。

### Stage P8.7-04 boundary

- 冒頭にcurrent UI語による「3分で使ってみる」を置く。
- 具体例と日常flowで中心概念、Today Picker、Timer、Quick/Dictionary、開始環境、手順書ビューアー、記録、data protectionを説明する。
- FAQを実際に迷いやすい操作へ絞る。
- internal data model、全edge case、test contractをGuide本文から外す。
- Guide dialogのTOC/focus/keyboard/narrow/scrollは変更しない。
- P8.7-01と03の最終UI・shortcut・用語へ同期する。

## 6. Stage handoff

P8.7-00は監査のみで、製品コード、config、schema、versionを変更していない。

次は`P8.7-01`（Dictionary UX / Settings / Shortcut）。上記のobsolete assumptionsを前提に、既存global shortcutと既存no-success-toastを再実装せず、UI入口・size preference・回帰保証へ変更を限定する。
