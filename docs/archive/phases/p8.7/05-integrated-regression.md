# P8.7-05 Integrated Regression

判定: PASS

## Source

- Integrated source before this report: `21cc31c`
- Included stages: P8.7-01 through P8.7-04
- Blockers: 0

## Focused regression

- Dictionary / Drop Register / Instruction Viewer / Guide: 46 passed / 0 failed
- Instruction Viewer freeze repeat: 20 passed / 0 failed（5 repeats）

確認範囲:

- Dictionary launch、settings、auto/small/medium/large、search、pages、lock、titlebar、launch action
- Drop Register path表示、group mode、display target、save failure draft保持、cancel
- Instruction Viewer no-folder、picker cancel/select、Markdown/Text/HTML、toolbar、edit/read-only
- Guide open、TOC、focus、keyboard、narrow layout、current terminology

## Full gates

- `npm run lint`: PASS
- `npm run build`: PASS（既存chunk size warningのみ）
- full Playwright: 375 passed / 48 skipped / 0 failed（423 total）
- `npm run public:check`: PASS、378 files / 0 blockers
- `npm audit --audit-level=low`: PASS、0 vulnerabilities
- `cargo fmt --check`: PASS
- `cargo check`: PASS
- `cargo clippy --all-targets -- -D warnings`: PASS
- `cargo test`: PASS、129 unit + 2 capability
- `cargo audit`: PASS、0 vulnerabilities / 8 allowed warnings
- `git diff --check`: PASS
- `tauri build --no-bundle`: PASS

`cargo audit`の8件は上流依存のunmaintained/unsound warningであり、auditはexit 0。新規vulnerabilityは検出されていない。

## Native smoke

実ユーザーデータを使用せず、repository配下の専用`APPDATA` / `LOCALAPPDATA`で実施した。既に常駐していたユーザー所有v1.3.0とはsingle-instanceを分離するため、build overrideのidentifier `com.takuyakou.lifelauncher.p87smoke`を使用した。ユーザー所有プロセスには触れていない。

- Main: native window表示、schema-v3 `config.json` / `config.schema.json`生成を確認。
- Dictionary: Mainから起動し、settings dialogとsize controlsを確認。
- Dictionary direct shortcut: 隔離設定で`Ctrl+Shift+F11`を登録し、hidden状態から再表示されforeground windowになることを確認。
- Drop Register: 実Tauri event plugin経由で隔離fixture pathをMainへ送信し、native buildの「ボタン登録」dialog、人間向けpath、内部`open_file:`非表示、cancelを確認。
- Instruction Viewer: no-folder CTAを確認。Windows `IFileOpenDialog`を実際に開き、Escape cancel後のpending復帰を確認。再度開いて隔離folderを選択し、`README.md`読み込みを確認。
- Guide: dialog表示、「3分で使ってみる」、Escape closeを確認。
- Normal exit: `LIFE_LAUNCHER_RELEASE_SMOKE_EXIT_AFTER_MS`のapp-owned exit経路でExitCode 0と隔離config生成を確認。

## Core regression

full PlaywrightとRust suiteで、Project create/edit、NextStep、Wishlist、Today Picker、Today3、Do Now、short/normal/measure Timer、Records、Settings、Backup/Restore、reset、Mini state、Dictionary、Instruction Viewerを確認した。

## Remaining issues

- Windowsの実pointerによるShell D&Dジェスチャー自体は、Rust OLE unit testsと既存Playwright契約で検証し、native smokeでは実Tauri event plugin以降のDrop Registerを確認した。
- `cargo audit`の8 allowed warningsは上流依存更新の追跡対象。v1.3.1 blockerではない。
- Viteの500kB超chunk warningは既存。build failureではない。

## Verdict

P8.7-01〜04の統合状態に製品blockerはない。full gate、freeze反復、隔離native smokeがPASSしたため、v1.3.1 version/package/release gateへ進める。
