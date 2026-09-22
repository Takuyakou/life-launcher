# P8.7-03 Instruction Viewer

判定: FIXED-AND-PASS

## Changes

- PowerShell + WinForms child processのfolder pickerを廃止した。
- Windows標準`IFileOpenDialog`を専用STA threadで開き、Instruction windowをownerにした。
- OS cancelを通常の`None`として扱い、select/errorと分離した。
- picker pending中の二重dispatch guardとbutton disabledを維持した。
- empty state CTAを「フォルダを読み込む」1本へ統一し、toolbarと同じhandlerを使用した。
- native frameと重複していたviewer内close buttonを削除した。
- reload / edit / external-openを対象選択時だけ表示し、EditはMarkdown/Textでのみ表示する。
- HTML read-onlyではdisabled Editや常設read-only表示を出さない。
- ユーザー向け表記を「手順書ビューアー」へ統一した。
- folder load成功はviewer内のUI反映/statusだけを使い、Main success Toastを出さない。

## Freeze cause and fix

旧実装はowner付きWinForms dialogをhidden PowerShell process内で開き、Rustが`Command::output()`を無期限待機していた。dialogのfocus/owner lifecycleが崩れるとprocessが終了せず、frontendは`registeringRoot = true`から戻れなかった。

新実装は専用STA thread内でCOM dialogを直接所有し、Instruction HWNDをnative ownerとして`Show`へ渡す。PowerShell process、stdout path受け渡し、orphan child processをなくした。

## Files

- `src-tauri/src/commands/instructions.rs`
- `src/components/InstructionTree.tsx`
- `src/components/InstructionViewer.tsx`
- `src/instructionWindow.ts`
- `src/content/helpGuide.ts`
- `tests/visual/tauriMock.ts`
- `tests/visual/phase87-instruction-viewer.spec.ts`
- `tests/visual/instruction-html-browser-parity.spec.ts`

## Verification

- `npm run lint`: PASS
- `npm run build`: PASS（既存chunk size warningのみ）
- Instruction Viewer + HTML focused Playwright: 8 passed / 0 failed
- freeze focused repeat: 12 passed / 0 failed（3 repeats）
- Rust instruction tests: 16 passed / 0 failed
- `cargo check`: PASS
- `cargo clippy --all-targets -- -D warnings`: PASS
- `cargo fmt --check`: PASS
- `git diff --check`: PASS

## Native

- Windows COM APIはnative Windows targetでcheck/clippy済み。
- 実dialogのcancel/select/focus smokeは、隔離RCを作るP8.7-05 native smokeへ統合する。実ユーザーデータは使用しない。
