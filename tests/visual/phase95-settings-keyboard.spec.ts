import { expect, test, type Locator, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P95-04: the Settings dialog moves with the arrow keys (also over fields); Enter starts editing a
// field, Enter commits, Esc restores the value from before editing.

type Control = { currentConfig: () => VisualQaFixture["config"] };
type QaWindow = Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control };

async function openSettings(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".sidebar")).toBeVisible();
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();
  return settings;
}

const settingsConfig = (page: Page) =>
  page.evaluate(() => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().settings);

/** What has focus, as "type:name" for fields and "button:text" for buttons / tabs. */
const focused = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement as HTMLInputElement | HTMLButtonElement | null;
    if (!el) return "";
    if (el instanceof HTMLInputElement) {
      const name = el.getAttribute("aria-label") ?? el.labels?.[0]?.textContent ?? "";
      return `${el.type}:${name.trim()}`;
    }
    return `${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") ?? el.textContent ?? "").trim()}`;
  });

/** Press ArrowDown from the focused item until "キャンセル" is reached; returns every item visited. */
async function walkDown(page: Page) {
  const visited: string[] = [];
  for (let step = 0; step < 40; step += 1) {
    await page.keyboard.press("ArrowDown");
    const item = await focused(page);
    visited.push(item);
    if (item === "button:キャンセル") return visited;
  }
  throw new Error(`ArrowDown never reached キャンセル: ${visited.join(" > ")}`);
}

const editing = (field: Locator) => field.evaluate((el) => (el as HTMLElement).dataset.editing === "true");

test("ArrowDown alone walks every item of the Basic tab without changing a number", async ({ page }) => {
  const settings = await openSettings(page);
  const before = await settingsConfig(page);
  await settings.getByRole("tab", { name: "基本" }).focus();
  const visited = await walkDown(page);
  expect(visited.slice(0, 6)).toEqual([
    "number:短時間タイマー分数",
    "number:通常タイマー分数",
    "number:日付切替時刻時",
    "checkbox:常に手前",
    "checkbox:Windows自動起動",
    "checkbox:ミニタイマーを使う",
  ]);
  expect(visited).toEqual(expect.arrayContaining(["radio:標準", "radio:大", "radio:特大", "button:保存"]));
  expect(visited.slice(-2)).toEqual(["button:保存", "button:キャンセル"]);
  await expect(settings.getByRole("spinbutton", { name: "短時間タイマー分数" })).toHaveValue(String(before.shortTimerMinutes));
  await expect(settings.getByRole("spinbutton", { name: "通常タイマー分数" })).toHaveValue(String(before.defaultTimerMinutes));
  await expect(settings.getByRole("spinbutton", { name: "日付切替時刻" })).toHaveValue(String(before.dayStartHour));
  // ArrowUp walks back through the same fields without changing them either.
  await page.keyboard.press("ArrowUp");
  await expect.poll(() => focused(page)).toBe("button:保存");
  expect(await settingsConfig(page)).toEqual(before);
});

test("Every other tab can be walked to its last item with ArrowDown after ArrowRight on the tabs", async ({ page }) => {
  const settings = await openSettings(page);
  await settings.getByRole("tab", { name: "基本" }).focus();
  const sections: Array<[string, string]> = [
    ["ショートカット", "button:登録"],
    ["手順書", "button:＋ フォルダを追加"],
    ["バックアップ", "number:保持世代数"],
    ["メンテナンス", "button:ソフトウェアリセット..."],
  ];
  for (const [tab, expected] of sections) {
    await page.keyboard.press("ArrowRight");
    await expect(settings.getByRole("tab", { name: tab })).toBeFocused();
    await expect(settings.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    const visited = await walkDown(page);
    expect(visited, tab).toContain(expected);
    expect(visited.slice(-2), tab).toEqual(["button:保存", "button:キャンセル"]);
    // Back on the tab row, ready for the next ArrowRight.
    await settings.getByRole("tab", { name: tab }).focus();
  }
});

test("Enter edits a number: all selected, arrows step it, Enter commits and arrows move again", async ({ page }) => {
  const settings = await openSettings(page);
  const short = settings.getByRole("spinbutton", { name: "短時間タイマー分数" });
  const original = Number(await short.inputValue());
  await settings.getByRole("tab", { name: "基本" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(short).toBeFocused();
  // Arrows over a field only move: ArrowRight goes to the next field and ArrowLeft back, value untouched.
  await page.keyboard.press("ArrowRight");
  await expect(settings.getByRole("spinbutton", { name: "通常タイマー分数" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(short).toBeFocused();
  await expect(short).toHaveValue(String(original));
  expect(await editing(short)).toBe(false);

  await page.keyboard.press("Enter");
  expect(await editing(short)).toBe(true);
  await page.keyboard.press("ArrowUp");
  await expect(short).toHaveValue(String(original + 1));
  await expect(short).toBeFocused();
  await page.keyboard.press("Enter");
  expect(await editing(short)).toBe(false);
  await expect(short).toBeFocused();
  await expect(short).toHaveValue(String(original + 1));

  await page.keyboard.press("ArrowDown");
  await expect(settings.getByRole("spinbutton", { name: "通常タイマー分数" })).toBeFocused();
  await expect(short).toHaveValue(String(original + 1));

  // Enter selects the whole text, so typing replaces it.
  await short.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("17");
  await expect(short).toHaveValue("17");
});

test("Esc in editing restores the value and keeps the dialog; the second Esc leaves the dialog", async ({ page }) => {
  const settings = await openSettings(page);
  const short = settings.getByRole("spinbutton", { name: "短時間タイマー分数" });
  const original = await short.inputValue();
  await short.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("17");
  await expect(short).toHaveValue("17");
  await page.keyboard.press("Escape");
  await expect(short).toHaveValue(original);
  await expect(short).toBeFocused();
  await expect(settings).toBeVisible();
  expect(await editing(short)).toBe(false);
  // Nothing changed, so the next Esc closes without a discard confirmation.
  await page.keyboard.press("Escape");
  await expect(settings).toHaveCount(0);
});

test("A click edits like Enter, and Tab leaves with the value kept and the navigating state back", async ({ page }) => {
  const settings = await openSettings(page);
  const short = settings.getByRole("spinbutton", { name: "短時間タイマー分数" });
  await short.click();
  expect(await editing(short)).toBe(true);
  await page.keyboard.press("Control+a");
  await page.keyboard.type("12");
  await page.keyboard.press("Tab");
  await expect(short).toHaveValue("12");
  expect(await editing(short)).toBe(false);
  await expect(settings.getByRole("spinbutton", { name: "通常タイマー分数" })).toBeFocused();
});

test("Enter toggles a checkbox; ArrowRight moves over the display size and Enter picks it", async ({ page }) => {
  const settings = await openSettings(page);
  const topmost = settings.getByRole("checkbox", { name: "常に手前" });
  const before = await topmost.isChecked();
  await topmost.focus();
  await page.keyboard.press("Enter");
  expect(await topmost.isChecked()).toBe(!before);
  await page.keyboard.press("Enter");
  expect(await topmost.isChecked()).toBe(before);

  const standard = settings.getByRole("radio", { name: "標準" });
  const large = settings.getByRole("radio", { name: "大", exact: true });
  await standard.focus();
  await page.keyboard.press("ArrowRight");
  await expect(large).toBeFocused();
  await expect(standard).toBeChecked();
  await page.keyboard.press("Enter");
  await expect(large).toBeChecked();
});

test("Navigating and editing a field look different (ring and caret)", async ({ page }) => {
  const settings = await openSettings(page);
  const short = settings.getByRole("spinbutton", { name: "短時間タイマー分数" });
  const look = () =>
    short.evaluate((el) => {
      const style = getComputedStyle(el);
      return { outline: style.outlineStyle, caret: style.caretColor };
    });
  await settings.getByRole("tab", { name: "基本" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(short).toBeFocused();
  await expect(short).toHaveCSS("outline-style", "solid");
  await expect(short).toHaveCSS("outline-width", "2px");
  await expect(short).toHaveCSS("caret-color", "rgba(0, 0, 0, 0)");
  const navigating = await look();

  await page.keyboard.press("Enter");
  await expect(short).toHaveCSS("outline-style", "none");
  await expect.poll(async () => (await look()).caret).not.toBe("rgba(0, 0, 0, 0)");
  expect(await look()).not.toEqual(navigating);

  await page.keyboard.press("Enter");
  await expect(short).toHaveCSS("outline-style", "solid");
  await expect(short).toHaveCSS("caret-color", "rgba(0, 0, 0, 0)");
});

test("Enter while composing (IME) does not end editing", async ({ page }) => {
  const settings = await openSettings(page);
  const short = settings.getByRole("spinbutton", { name: "短時間タイマー分数" });
  const composingEnter = () =>
    short.evaluate((el) =>
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true })),
    );
  await short.focus();
  await composingEnter();
  expect(await editing(short)).toBe(false);
  await page.keyboard.press("Enter");
  expect(await editing(short)).toBe(true);
  await composingEnter();
  expect(await editing(short)).toBe(true);
  await page.keyboard.press("Enter");
  expect(await editing(short)).toBe(false);
});

test("Arrows outside the Settings dialog are unchanged (a text field keeps its caret keys)", async ({ page }) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".sidebar")).toBeVisible();
  await page.locator(".brandBlock").click({ button: "right" });
  await page.getByRole("menuitem", { name: "ボタンを追加" }).click();
  const dialog = page.getByRole("dialog", { name: "Button Builder" });
  const file = dialog.getByRole("textbox", { name: "ファイル", exact: true });
  await file.fill("abc");
  await page.keyboard.press("ArrowLeft");
  expect(await file.evaluate((el) => (el as HTMLInputElement).selectionStart)).toBe(2);
  await page.keyboard.press("ArrowUp");
  await expect(file).toBeFocused();
  expect(await file.evaluate((el) => (el as HTMLInputElement).selectionStart)).toBe(0);
});

test("Save keeps a keyboard-edited value; Cancel discards it", async ({ page }) => {
  const settings = await openSettings(page);
  const original = (await settingsConfig(page)).shortTimerMinutes;
  const short = settings.getByRole("spinbutton", { name: "短時間タイマー分数" });
  await short.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("17");
  await page.keyboard.press("Enter");
  await settings.getByRole("button", { name: "キャンセル" }).focus();
  await page.keyboard.press("Enter");
  await page.getByRole("button", { name: "破棄して閉じる" }).click();
  await expect(settings).toHaveCount(0);
  expect((await settingsConfig(page)).shortTimerMinutes).toBe(original);

  await page.getByRole("button", { name: "設定を開く" }).click();
  await short.focus();
  await page.keyboard.press("Enter");
  await page.keyboard.type("17");
  await page.keyboard.press("Enter");
  await settings.getByRole("button", { name: "保存" }).focus();
  await page.keyboard.press("Enter");
  await expect(settings).toHaveCount(0);
  expect((await settingsConfig(page)).shortTimerMinutes).toBe(17);
});
