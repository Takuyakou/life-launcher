# P8.7-02 Drop Register

判定: PASS

## Changes

- `open_folder:`等の内部action prefixを確認表示から除去した。
- folder / file / URLをicon付きのread-only「登録先」として表示した。
- group指定を「既存から選ぶ / 新規グループを作成」の明示modeへ分離した。
- display targetへ用途の短い説明を追加した。
- Dictionary表示OFF時はDictionary page選択を非表示にする既存契約を維持した。
- footerを左Add（green primary）、右Cancel（muted red）へ統一した。
- config保存成功後にだけdialogを閉じるようにし、保存失敗時はdraftを保持する。
- drop parsing、`.lnk` resolution、action order、config schemaは変更していない。

## Files

- `src/App.tsx`
- `src/styles.css`
- `tests/visual/phase87-drop-register.spec.ts`

## Verification

- `npm run lint`: PASS
- `npm run build`: PASS（既存chunk size warningのみ）
- Drop Register focused Playwright: 6 passed / 0 failed
- `git diff --check`: PASS

## Visual

- folder / file / URL表示、既存/new group mode、display target、footerを確認。
- 540px幅でfooter順、Dictionary page連動、横overflowなしを確認。
- backdrop inert、save failure draft retentionを確認。
