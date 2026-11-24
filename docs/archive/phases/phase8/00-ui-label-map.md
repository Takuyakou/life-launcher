# P8-00 UI Label Map

Audit source: `265dafebc8ef0e6a6a2d1ac5196a4765d13bd313`.
This is a proposed UI vocabulary map, not an implemented specification.

| Current UI | Phase 8 UI | Stored field / boundary | Stage |
| --- | --- | --- | --- |
| Project / プロジェクト | 取り組み | `projects`, `Project`, `projectId` stay unchanged | 01, 03, 05 |
| プロジェクト名 | 取り組み名 | `Project.name`, required; UI max 48 | 01 |
| 北極星（任意） | 目標（任意） | `northStar`, optional, max 60 | 01 |
| 今週の重点にする | Keep | `weeklyFocus`, existing maximum three | 01 |
| Form: 次の一手 | 次にやること | `nextStep`, UI max 120; empty allowed | 01 |
| Main section: 次の一手 | Keep | Section label, not a field rename | 01 |
| いつ・何の後にやる？（任意） | 始めるきっかけ（任意） | `nextStepTrigger`; Today snapshot `trigger` | 01 |
| 開始環境 | Keep | `buttonIds`, existing ordered maximum two | 01 |
| 手順書（任意） | Keep; searchable picker | `instructionPath`; existing registered-root validation | 01 |
| プロジェクト開始時に手順書を開く | 開始時に手順書を開く | `instructionOpenOnStart` | 01 |
| 短時間 / 通常タイマー | Keep, short first | `shortTimerMinutes` / `defaultTimerMinutes`; 1..240, unset inherits settings | 01 |
| プロジェクトカラー | 取り組みカラー | `colorId`; existing palette | 01 |
| 開始noteテンプレート（空欄は次の一手） | 開始noteテンプレート（任意）; hint uses 次にやること | `startNoteTemplate`, do not reinterpret stored notes | 01 |
| プロジェクトなし | 取り組みなし | Missing optional `projectId`, not a synthetic ID | 01, 03 |
| やりたいこと | Keep | `inbox[].text`, optional stable `id` retained | 01 |
| 保存 / 選択を反映 / キャンセル | Keep action meaning; save/apply left green, cancel right muted red | Draft/apply/cancel boundaries unchanged | 01, 03 |
| 今日やるものを選びましょう | New two-line empty state; CTA ＋ 今日を組み立てる | No data change | 02 |
| Builder 選択済み | ✓ 選択済み, status not toggle | Derived from canonical source identity | 02 |
| セッション / Session (visible UI) | 実行記録 | Internal types/commands/file names stay | 03, 05 |
| セッションを追加 / 編集 | 実行記録を追加 / 編集 | Existing add/update commands | 03 |
| 最近のセッション | すべての記録 tab/list | Preserve search and date/project filters | 03 |
| 旧notes履歴 | 以前のメモ | Existing notes history, collapsed presentation | 03 |
| noteなし | Honest empty-memo display, wording to settle in 03 | Never substitute current `nextStep` for missing history | 03 |

## Form Inventory

- Project add/edit: `src/App.tsx:6641` opens add; `:6670` edit area; `:6710` save area; dialog `:12157`. Current order is basic, plan, instruction, timers, appearance/note, then Start Environment. Move environment and instruction together; do not recreate source saving.
- NextStep edits use the Project dialog through existing source-edit routing. There is no independent second NextStep data model. Preserve save synchronization with current Today snapshots (`src/sourceEdit.ts`).
- Wishlist add (`src/App.tsx:12085`) is a text-only form with IME protection, busy guard and Save/Cancel. Wishlist edit (`:10715`) additionally has project association, instruction and Start Environment. Do not silently turn simple add into a full Project form.
- Project/Wishlist edit instruction choices come from registered-root directory traversal (`src/App.tsx:6610`), with a 50,000-entry bound, loading/error states and a retained missing-current-reference option. A new picker must preserve these states and backend restrictions.
- `src/StartEnvironmentPicker.tsx` already provides draft selection, search/category filtering, keyboard handling, apply/cancel and focus return. It is the interaction reference, not a reason to combine file paths and launcher IDs into one list.
- Most relevant forms already place Save/Apply before Cancel. The remaining work is grouping, vocabulary and scoped colors, not a global button-order rewrite. Destructive confirmations remain outside this change.

## Guide Synchronization Inventory

`src/content/helpGuide.ts` currently uses プロジェクト, 北極星, 実行トリガー, Session/セッション and 開始note throughout setup, terms, prompts, Project, instruction and records sections. Update visible prose and copied templates consistently after P8-01..04, not before.

- The guide's Do Now description lacks the precursor 他の一手 button/context path (`helpGuide.ts:178`, `:194`). `docs/spec/current-spec.md` section 9 also needs that path documented.
- Existing Today3 completion, exact 3/3 next batch, explicit removal and Undo descriptions largely match code. Retain them; do not claim completion automatically removes a card.
- The records guide (`helpGuide.ts:507`) describes the current single view. Replace it only after the three tabs, accordions and pagination exist.
- Dictionary guidance must distinguish active group and keyboard focus, and describe reopen restoration only after implementation. Temporary search reset already exists.
- `src/components/HelpGuideDialog.tsx` owns dialog navigation/focus. Preserve its existing keyboard behavior while restructuring guide content.
- `docs/spec/current-spec.md` sections 9..15 and dictionary/guide sections are future synchronization targets; `docs/OVERVIEW.md` stays thin. Historical work reports and internal schema identifiers should not undergo mass replacement.

Related: [audit](00-current-main-audit.md), [data impact](00-data-impact.md).
