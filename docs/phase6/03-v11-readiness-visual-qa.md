# P6.3 v1.1 Readiness Visual QA

## Capture method

`tests/visual/phase6-readiness.spec.ts`、`tests/visual/phase6-main.spec.ts`、`tests/visual/phase6-dictionary.spec.ts`、`tests/visual/phase6-baseline.spec.ts`がTauri mockと公開用合成データを使い、時刻、dark mode、motionを固定して検証・撮影する。
実ユーザーデータ、実パス、秘密情報は含めない。

## Capture matrix

| Surface / state | Viewport / file | Automated assertion |
| --- | --- | --- |
| Main desktop | 1280x720 / [main-1280x720.png](./screenshots/main-1280x720.png) | hierarchy、horizontal overflow 0 |
| Main desktop | 1366x768 / [main-1366x768.png](./screenshots/main-1366x768.png) | hierarchy、horizontal overflow 0 |
| Main desktop | 1440x900 / [main-1440x900.png](./screenshots/main-1440x900.png) | Today3 3 columns、horizontal overflow 0 |
| Main desktop | 1920x1080 / [main-1920x1080.png](./screenshots/main-1920x1080.png) | wide layout、horizontal overflow 0 |
| Main medium | 1000x900 / [main-1000x900.png](./screenshots/main-1000x900.png) | Today3 2 columns、horizontal overflow 0 |
| Main minimum width | 860x900 / [p6-03-main-responsive-860.png](./screenshots/p6-03-main-responsive-860.png) | Today3 1 column、horizontal overflow 0 |
| Today3 cardinality | 0 / 1 / 2 / 3 items | active-slot count and start-entry responsibility |
| Today3 completion | 0/3 / 1/3 / 2/3 / 3/3 | completion state and next-batch transition |
| Today Builder | 0 / 1 / 5 / 6 / 10 / 11 candidates | 5 items/page and bounded pagination |
| Dictionary | narrow / wide / selected / focus / context menu | responsive grid、focus and selection separation |
| Quick | item / group keyboard and context menu | Enter launch、Enter collapse、visible focus、menu parity |

## Visual review

- Main responsibility remains legible: start controls exist only in Do Now and Today3.
- Today Builder sits between Today3 and NextStep and stays subordinate to immediate-action surfaces.
- Today3 changes from 3 to 2 to 1 columns at supported desktop widths without overlap or horizontal overflow.
- Long Japanese labels, timer controls, project labels, and add controls remain inside their containers.
- Disclosure buttons and Quick groups expose expanded state and keep visible keyboard focus.
- Dictionary selected fill and focus ring remain distinct across responsive layouts.
- Context menus appear without slide-in motion and keep destructive actions separated.

## Data and performance review

- Dictionary: 120 synthetic entries render, filter, and accept arrow-key focus movement.
- Today Builder: 50 synthetic candidates remain bounded to 5 rows per page and 10 pages.
- Reordering is persisted on drop and survives reload; pointer movement alone does not persist.

## Automated result

```text
npm.cmd run test:visual
54 passed
```

Full command results are recorded in [P6.3 work report](./workreports/p6-03-report.md).
