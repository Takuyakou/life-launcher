# P6.2 Quick / Dictionary Visual QA

## Capture method

`tests/visual/phase6-dictionary.spec.ts`と`tests/visual/phase6-baseline.spec.ts`がTauri mockと公開用合成データを使い、時刻、dark mode、motionを固定して撮影する。
実ユーザーデータ、実パス、秘密情報は含めない。

## Capture matrix

| Surface / state | File | Automated assertion |
| --- | --- | --- |
| Dictionary selected + focus | [p6-02-dictionary-selected-focus.png](./screenshots/p6-02-dictionary-selected-focus.png) | selected fill維持、focus ring、category roving focus |
| Dictionary context menu | [p6-02-dictionary-context-menu.png](./screenshots/p6-02-dictionary-context-menu.png) | keyboard open、Explorer action、delete separator |
| Dictionary narrow 640x640 | [p6-02-dictionary-narrow.png](./screenshots/p6-02-dictionary-narrow.png) | resize後のvisual-row navigation、horizontal overflow 0 |
| Dictionary wide 1200x700 | [p6-02-dictionary-wide.png](./screenshots/p6-02-dictionary-wide.png) | responsive grid、focus-visible |
| Quick context menu | [p6-02-quick-context-menu.png](./screenshots/p6-02-quick-context-menu.png) | Shift+F10、Explorer action、URL action非表示 |
| Dictionary default | [dictionary-default.png](./screenshots/dictionary-default.png) | existing baseline regression |
| Category state matrix | [dictionary-category-selected-focus.png](./screenshots/dictionary-category-selected-focus.png) | normal / hover / focus / selected combinations |
| Tile focus | [dictionary-tile-focused.png](./screenshots/dictionary-tile-focused.png) | visible overlay focus ring |

## Visual review

- `すべて`、`未分類`、custom categoryは同じselected visualを使う。
- selected categoryはhoverしても背景と文字色が消えない。
- selected+focusはsemantic fillを維持し、その外側へfocus ringを重ねる。
- narrow / wideのどちらでもtile grid、category tabs、検索欄に重なりと横あふれはない。
- QuickとDictionaryのcontext menuはExplorer actionを編集の後、削除separatorの前に表示する。
- keyboard-opened menuでもfocus位置が見え、mouse menuと同じactionを利用できる。

## Automated result

```text
npm.cmd run test:visual
27 passed
```

