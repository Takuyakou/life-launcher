# P8.7-01 Dictionary UX

判定: PASS

## Changes

- Mainの「辞書を開く」にwindow iconを追加し、既存のshortcut表示と高さを維持した。
- Dictionary titlebarへSettings iconを追加した。
- titlebar空き領域の右クリックから同じSettingsを開ける補助menuを追加した。
- アイコンサイズを`自動 / 小 / 中 / 大`から選択できるようにした。
- preferenceはDictionary固有のlocalStorageへ保存し、config schemaは変更していない。
- 未設定時は`自動`で、v1.3.0のresponsive gridを維持する。
- Settings表示中は範囲外clickによるDictionary auto-hideを抑止する。
- Dictionary起動成功時no-toast、失敗時local errorの既存契約は変更していない。
- global shortcut、single window、page/focus/scroll復元は既存実装を再利用した。

## Files

- `src/App.tsx`
- `src/components/DictionaryWindow.tsx`
- `src/components/UiIcon.tsx`
- `src/styles.css`
- `tests/visual/phase87-dictionary-ux.spec.ts`

## Verification

- `npm run lint`: PASS
- `npm run build`: PASS（既存chunk size warningのみ）
- Dictionary focused Playwright: 21 passed / 0 failed
- `git diff --check`: PASS

## Visual

- `auto / small / medium / large`を720px幅で確認。
- `auto`を520px幅で確認。
- 長いlabel、titlebar icon、context menu、settings dialog、keyboard focus、横overflowなしをPlaywrightで確認。

## Notes

- shortcutはP8.7-00でglobal登録済みと確認したため二重実装していない。
- Main Quickの成功ToastはDictionaryとは別契約のため変更していない。
