# P83-00 Main Button Inventory

## Scope rule

Only category **A: Main Content Action Button** receives the Phase 8.3 full hover primitive: slightly brighter surface, stronger border, `translateY(-1px)`, subtle shadow, 100-150 ms transition, pressed `translateY(0) scale(.985)`, focus-visible parity, and transform disabled under reduced motion.

Categories B-I retain their existing interaction. Timer controls are listed separately because they are Main actions but their current specialized hover must not be reimplemented or replaced.

Current shared tokens live in `src/styles.css:1-60`. Generic `.primaryButton`, `.secondaryButton`, and `.dangerButton` are defined at `src/styles.css:4007-4073`; they are used in dialogs as well as Main, so P83-03 must not attach Main lift globally to those classes.

## A. Main Content Action Buttons: full primitive target

| Surface | Labels / selector | Intended semantic color | Notes |
| --- | --- | --- | --- |
| Recovery banner | `バックアップから復元: フォルダを開く`, `.bannerButton` | Neutral | Main inline recovery action. |
| Weekly review banner | `見る`, `.weeklyReviewBannerPrimary` | Neutral | Explicit navigation/action; banner close remains D. |
| Do Now | `他の一手`, `.doNowAlternateButton` | Neutral | Explicit choice action. |
| Do Now empty state | `次の一手を設定`, `重点を選ぶ` | Neutral | Main actions inside empty state. |
| Today empty state | `今日を組み立てる` | Neutral/positive according to existing product grammar | Explicit CTA, not the section header itself. |
| Today card | `手順書`, `.todayInstructionButton`; `今日の3件から外す`, `.todayRemoveButton` | Neutral | Removing adoption is not source deletion; disabled state must not lift. |
| Today completion | `次の3件を選ぶ`, `.todayNextBatch button` | Neutral/positive | Explicit next workflow action. |
| Today Builder | `今日へ`, `.todayBuilderAddButton` | Green | Success/adoption action. |
| Builder/source pagination | `前へ`, `次へ`, `.todayBuilderPagination button`, `.sourceListPagination button` | Neutral | Navigation buttons get the Main primitive; disabled pages do not. |
| NextStep header create | `＋ プロジェクト`, `.nextStepHeaderAdd--project` | Gold | Create/Add fixed rule. Preserve expanded hit target. |
| Wishlist header create | Current visible `追加`, `.sectionAddButton` | Gold | P83 copy target is `＋ やりたいこと`; this is Create/Add. |
| NextStep card | `変更`, `次の一手を設定`, `.nextStepRowAction` | Neutral | Same visual grammar, label differs. Do not redesign card layout. |
| Compact source controls | `残りN件をもっと見る`, `5件だけ表示`, `.sourceListControls button` | Neutral | Explicit disclosure action, separate from accordion header. |
| Wishlist item | `候補に戻す`, `.wishlistRestoreButton` | Neutral/positive | Restores eligibility, not destructive. |
| Records header | `メイン`, `.recordsBackButton` | Neutral | Main Records view navigation. |
| Records stale-step actions | `書き直す`, `短時間で試す`, `このまま` | Neutral / Green for execute | Explicit per-card actions. `短時間で試す` is an execution action. |
| Records log | `実行記録を追加`, `.sectionLinkButton` | Gold | Create/Add fixed rule. |
| Records pagination | `前へ`, page numbers, `次へ`, `.recordsPagination button` | Neutral | Disabled controls do not lift. |

Selectors should be opted into a Main-only primitive class or tightly scoped selector. Do not broaden `.primaryButton`/`.secondaryButton` because those classes also style modal and Settings controls.

## Timer controls: preserve current specialized behavior

These are Main actions but explicitly frozen for Phase 8.3:

- Do Now short/normal/measure: `.doNowStartPrimary`, `.doNowStartSecondary`, `.doNowMeasureButton`.
- Today3 short/normal/measure: `.todayStartButton--short`, `.todayStartButton--normal`, `.todayMeasureButton`.
- Running/paused controls: `.runningPauseButton`, `.runningStopButton`.
- Timer dock/mini controls: `.startButton`, `.shortStartButton`, `.miniStartButton`, `TimerPanel` buttons.

Their color and lift behavior is already specialized at `src/styles.css:4660-4793`. P83-03 must neither refactor their markup nor include them in a new generic primitive. The Measure button is not redesigned.

## B. Top-right Global Toolbar: excluded

`.topPills .viewToggleButton` at `src/App.tsx:8818-8907`:

- 自動起動
- ミニ
- 記録 / メイン
- 手順書
- 使い方
- 設定

No motion or visual change. Its neutral hover palette may be referenced, but selectors must remain untouched.

## C. Left Sidebar and launcher: excluded

- `辞書を開く`, `.launcherOpenButton`.
- Quick group rows, `.quickGroupHeader`.
- Quick launcher items, `.quickButton`.
- Sidebar timer increment/decrement controls, `.timerPresetButton`.
- Dictionary overlay tabs, tiles, search results, add/scroll controls.

These are navigation/launcher surfaces, not Main-content action buttons.

## D. Ellipsis and icon controls: weak hover only

- Today, Builder, NextStep, Wishlist, and Session ellipsis: `.sourceRowMenu`, `.recordsSessionMenuButton`.
- Modal close, Toast close, banner close, tab scroll arrows, instruction/tree icon buttons.
- Checkbox-like completion controls and icon-only remove/clear controls.

Keep current weak hover/focus feedback. Do not apply vertical lift or action shadow.

## E. Context Menu Rows: excluded

Every `ContextMenuItem` / `.contextMenu button` and instruction context-menu row is excluded, including destructive rows. Current hover uses menu surface colors at `src/styles.css:5167-5199`; no lift.

## F. Section/accordion/tab headers: excluded

- Main section `.disclosure` buttons: Today Builder, NextStep, Wishlist, Today activity.
- `.wishlistGroupHeader` and `.recordsAccordionSummary`.
- Settings, Records, Dictionary, Start Environment, and overlay tabs.
- Whole disclosure/header rows, even when technically rendered as `<button>`.

The compact source `残りN件` buttons remain A; they are commands, not the whole accordion header.

## G. Status, badge, and selected-state visuals: excluded

- Running/paused badges, completion labels, selected candidate labels, project identity/color dots, counts, and validation/status chips.
- Suggestion chips and filter chips keep their existing chip interaction rather than the full action primitive.
- Victory text behaves as editable content, not a command button.

## H. D&D handles and draggable rows: excluded

- Quick/group drag surfaces, Today3 cards, Today Builder rows, NextStep rows, Wishlist rows, Dictionary tiles/pages, and instruction tree rows.
- A nested explicit action button can be category A, but the draggable row/handle itself must not lift.

## I. Disabled controls: excluded in every category

All full-hover selectors must use `:not(:disabled)` and must not simulate lift for `aria-disabled="true"`. Current global disabled opacity/cursor is at `src/styles.css:1857`. Special cases such as Start Environment options using `aria-disabled` require explicit guards.

## Color semantic mapping for P83-03

| Semantic | Use | Current tokens / direction |
| --- | --- | --- |
| Gold | Create/Add only | `--accent`, `--accent-strong`; `＋ プロジェクト`, `＋ やりたいこと`, `実行記録を追加` |
| Neutral | Edit/configure/navigation/non-destructive utility | Reuse top-toolbar neutral hover palette: `--control-neutral-*`; `変更`, `次の一手を設定`, `手順書`, pagination |
| Green | Execute, short time, success/adoption | `--control-positive-*`, `--good`; preserve Timer classes |
| Blue | Normal Timer | Current `--control-short-*` token names are historically misleading but behavior is blue; do not rename/refactor in P83-03 unless necessary |
| Red | Destructive, discard, cancel | `--control-danger-*`, `--error`; software reset and true delete/discard |

Settings/dialog buttons are not Main-body category A. P83-01 may implement the explicitly required footer semantics, and P83-02 may style software-reset dialogs, but P83-03's Main lift must not leak into them.

## Regression selectors

P83-03 visual/interaction tests should separately assert:

1. one representative A button for Gold, Neutral, Green, and Red semantics;
2. hover/focus lift and pressed return;
3. reduced-motion removes transform transition/movement;
4. top toolbar, sidebar, context row, disclosure header, ellipsis, badge, D&D row, and disabled button have no full lift;
5. Timer and Measure screenshots/geometries remain unchanged;
6. NextStep card geometry remains unchanged.
