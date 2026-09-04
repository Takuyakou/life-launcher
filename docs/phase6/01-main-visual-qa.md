# P6.1 Main Visual QA

## Capture method

`tests/visual/phase6-main.spec.ts`と`tests/visual/phase6-baseline.spec.ts`がTauri mockと公開用合成データを使い、時刻、locale、timezone、dark mode、motionを固定して撮影する。
実ユーザーデータ、実パス、秘密情報は含めない。

## Capture matrix

| Surface / state              | File                                                                                   | Automated assertion                          |
| ---------------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------- |
| Main 1366x768                | [main-1366x768.png](./screenshots/main-1366x768.png)                                   | hierarchy、horizontal overflow 0             |
| Main 1440x900                | [main-1440x900.png](./screenshots/main-1440x900.png)                                   | hierarchy、horizontal overflow 0             |
| Main 1920x1080               | [main-1920x1080.png](./screenshots/main-1920x1080.png)                                 | hierarchy、horizontal overflow 0             |
| Main narrow desktop 1000x900 | [main-1000x900.png](./screenshots/main-1000x900.png)                                   | responsive layout、horizontal overflow 0     |
| Today3 1 item                | [p6-01-main-today3-one-card.png](./screenshots/p6-01-main-today3-one-card.png)         | row count 1                                  |
| Today3 2 items               | [p6-01-main-today3-two-cards.png](./screenshots/p6-01-main-today3-two-cards.png)       | row count 2                                  |
| Today3 3 items               | [p6-01-main-today3-three-cards.png](./screenshots/p6-01-main-today3-three-cards.png)   | row count 3、equal width/y                   |
| Today3 3 completed           | [p6-01-main-today3-completed.png](./screenshots/p6-01-main-today3-completed.png)       | completed status、next batch visible         |
| Next batch cleared           | [p6-01-main-next-batch-empty.png](./screenshots/p6-01-main-next-batch-empty.png)       | active slots empty、Builder expanded         |
| Today Builder page 1         | [today-builder-5-items.png](./screenshots/today-builder-5-items.png)                   | 5 items/page                                 |
| Today Builder page 2         | [today-builder-8-items.png](./screenshots/today-builder-8-items.png)                   | pagination、reload persistence               |
| NextStep expanded            | [p6-01-main-next-step-expanded.png](./screenshots/p6-01-main-next-step-expanded.png)   | compact rows、no Timer actions               |
| NextStep collapsed           | [p6-01-main-next-step-collapsed.png](./screenshots/p6-01-main-next-step-collapsed.png) | keyboard accordion                           |
| Wishlist expanded            | [p6-01-main-wishlist-expanded.png](./screenshots/p6-01-main-wishlist-expanded.png)     | compact rows、source-preserving Today action |
| Today Activity               | [p6-01-main-today-activity.png](./screenshots/p6-01-main-today-activity.png)           | compact lower-priority history               |

## Visual review

- Main order is Victory, Do Now, Today3, Today Builder, NextStep, Wishlist, Today Activity.
- Today3 cards keep aligned actions and bottom controls with 1, 2, and 3 items.
- Wide desktop uses 3 columns; medium and narrow layouts reduce to 2 and 1 columns without horizontal overflow.
- NextStep and Wishlist are compact rows and remain visually subordinate to Do Now and Today3.
- Narrow desktop at 1000x900 has no text/control overlap or clipped sidebar controls.
- Keyboard focus remains visible on disclosures, add controls, context-menu rows, and Timer controls.

## Automated result

```text
npm.cmd run test:visual
22 passed
```
