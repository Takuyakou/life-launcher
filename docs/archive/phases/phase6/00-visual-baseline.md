# P6.0 Visual Baseline

## Capture method

`tests/visual/phase6-baseline.spec.ts`がTauri mockと公開用合成データを使い、時刻、locale、timezone、dark mode、motionを固定して撮影する。
実ユーザーデータ、実パス、秘密情報は含めない。

## Capture matrix

| Surface / state          | File                                                                               | Automated assertion                    |
| ------------------------ | ---------------------------------------------------------------------------------- | -------------------------------------- |
| Main 1366x768            | [main-1366x768.png](./screenshots/main-1366x768.png)                               | Victory visible、horizontal overflow 0 |
| Main 1440x900            | [main-1440x900.png](./screenshots/main-1440x900.png)                               | Victory visible、horizontal overflow 0 |
| Main 1920x1080           | [main-1920x1080.png](./screenshots/main-1920x1080.png)                             | Victory visible、horizontal overflow 0 |
| Today Builder 5件        | [today-builder-5-items.png](./screenshots/today-builder-5-items.png)               | row count 5                            |
| Today Builder 8件        | [today-builder-8-items.png](./screenshots/today-builder-8-items.png)               | row count 8、reload後も8               |
| Dictionary default       | [dictionary-default.png](./screenshots/dictionary-default.png)                     | shell visible、horizontal overflow 0   |
| custom category selected | [dictionary-category-selected.png](./screenshots/dictionary-category-selected.png) | tab click後capture                     |
| tile focused             | [dictionary-tile-focused.png](./screenshots/dictionary-tile-focused.png)           | tile programmatic focus                |
| context menu             | [dictionary-context-menu.png](./screenshots/dictionary-context-menu.png)           | right click後menu visible              |

## Category state matrix

| State            | File                                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------------------- |
| すべて selected  | [dictionary-category-all-selected.png](./screenshots/dictionary-category-all-selected.png)                     |
| 未分類 selected  | [dictionary-category-uncategorized-selected.png](./screenshots/dictionary-category-uncategorized-selected.png) |
| custom selected  | [dictionary-category-custom-selected.png](./screenshots/dictionary-category-custom-selected.png)               |
| hover            | [dictionary-category-hover.png](./screenshots/dictionary-category-hover.png)                                   |
| keyboard focus   | [dictionary-category-focus.png](./screenshots/dictionary-category-focus.png)                                   |
| selected + hover | [dictionary-category-selected-hover.png](./screenshots/dictionary-category-selected-hover.png)                 |
| selected + focus | [dictionary-category-selected-focus.png](./screenshots/dictionary-category-selected-focus.png)                 |

## Reproduced visual bug

CSS priority is currently:

1. generic hover/focus
2. selected
3. fixed selected override
4. fixed focus override

`.dictionaryPageTab--fixed.dictionaryPageTab--selected` removes the accent border and underline used by custom selected category。
そのため「すべて」「未分類」は`aria-selected=true`でもcustom categoryと同じselected colorにならない。
テストはfixed selectedとcustom selectedのcomputed border/background/shadow signatureが異なることをassertし、現行bugを再現状態として固定した。

さらにgeneric `:focus-visible`はselected ruleより前にあり、selected + focusでborder差が消える。独立したfocus ringもない。
P6.2ではselected colorを全categoryで統一し、hoverがselectedを上書きせず、focus ringを追加する順へ整理する。

## Main observations

- 3 viewportとも横overflowはない。
- section順はPhase 6推奨順どおり。
- 1366x768ではNextStep以降がfold下になり、Today3/Builderの密度変更がfirst viewportへ強く影響する。
- NextStep cardsの面積と二つのTimer actionが、Do Now/Today3と競合する。
- Builderは8件を一度に表示し、paginationがないためsection高が件数に比例する。
- 8件fixtureはreloadで復元するが、source dataからの再生成である。

## Test result

```text
tests/visual/phase6-baseline.spec.ts
7 passed
```

このStageはbrowser-level Tauri mockでのbaseline固定であり、製品挙動変更や実Tauri smokeは行っていない。
