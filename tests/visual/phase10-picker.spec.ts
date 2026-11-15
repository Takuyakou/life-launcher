import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaControl = {
  currentConfig: () => AppConfig;
  setSaveConfigFailure: (failed: boolean) => void;
  updateConfig: (config: AppConfig) => void;
  invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
};

type QaWindow = Window & { __LIFE_LAUNCHER_VISUAL_QA__: QaControl };

async function prepare(page: Page, fixture: VisualQaFixture, width = 1280, height = 900) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".focusBand")).toBeVisible();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    return control.currentConfig();
  });
}

async function saveConfigCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === "save_config",
      ).length,
  );
}

async function setSaveFailure(page: Page, shouldFail: boolean) {
  await page.evaluate((value) => {
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(value);
  }, shouldFail);
}

function picker(page: Page) {
  return page.getByRole("dialog", { name: "今日やるものを選ぶ" });
}

async function openPicker(page: Page) {
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

async function addNextStepCandidate(dialog: ReturnType<typeof picker>, text: string) {
  await dialog
    .locator('[data-today-picker-section="next-step"] .todayPickerRow', { hasText: text })
    .getByRole("button", { name: "今日へ" })
    .click();
}

async function slotTexts(page: Page): Promise<string[]> {
  return picker(page).locator(".todayPickerSlotTask").allTextContents();
}

function findSlot(dialog: ReturnType<typeof picker>, text: string) {
  return dialog.locator(".todayPickerSlot--selected").filter({ hasText: text }).first();
}

test("P10-10 adding, removing and reordering only changes the draft", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  await prepare(page, fixture);
  const dialog = await openPicker(page);
  const before = await saveConfigCount(page);

  await addNextStepCandidate(dialog, "5分だけ体を動かす");
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(2);
  expect(await saveConfigCount(page)).toBe(before);

  await dialog.getByRole("tab", { name: /やりたいこと/ }).click();
  await dialog
    .locator('[data-today-picker-section="wishlist"] .todayPickerRow', {
      hasText: "あとで確認するサンプル",
    })
    .getByRole("button", { name: "今日へ" })
    .click();
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(3);
  expect(await saveConfigCount(page)).toBe(before);

  await findSlot(dialog, "あとで確認するサンプル")
    .getByRole("button", { name: "今日から外す" })
    .click();
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(2);
  expect(await saveConfigCount(page)).toBe(before);

  const orderBefore = await slotTexts(page);
  const firstSlot = findSlot(dialog, orderBefore[0]);
  await firstSlot.focus();
  await page.keyboard.press("Alt+ArrowDown");
  const orderAfter = await slotTexts(page);
  expect(orderAfter).toEqual([orderBefore[1], orderBefore[0]]);
  expect(await saveConfigCount(page)).toBe(before);

  const saved = await currentConfig(page);
  expect(saved.today.items).toHaveLength(1);
  expect(saved.today.items[0].text).toBe("資料を1ページ読む");

  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await page.getByRole("button", { name: "破棄して閉じる" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await saveConfigCount(page)).toBe(before);
  expect((await currentConfig(page)).today.items).toHaveLength(1);
});

test("P10-10 決定 saves once and keeps the slot order", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const dialog = await openPicker(page);
  const before = await saveConfigCount(page);

  await addNextStepCandidate(dialog, "5分だけ体を動かす");
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(3);
  const third = findSlot(dialog, "5分だけ体を動かす");
  await third.focus();
  await page.keyboard.press("Alt+ArrowUp");
  await page.keyboard.press("Alt+ArrowUp");
  const expectedOrder = await slotTexts(page);
  expect(expectedOrder[0]).toBe("5分だけ体を動かす");

  await dialog.getByRole("button", { name: "決定" }).dblclick();
  await expect(dialog).toHaveCount(0);
  expect(await saveConfigCount(page)).toBe(before + 1);
  const saved = await currentConfig(page);
  expect(saved.today.items.map((item) => item.text)).toEqual(expectedOrder);
  await expect(page.locator(".todayRow")).toHaveCount(3);
});

test("P10-10 キャンセル・Esc・閉じる never save", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  await prepare(page, fixture);
  const before = await saveConfigCount(page);

  // Esc with a changed draft asks first; 戻る keeps the draft.
  let dialog = await openPicker(page);
  await addNextStepCandidate(dialog, "5分だけ体を動かす");
  await page.keyboard.press("Escape");
  const confirmation = page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "戻る" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(2);

  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "破棄して閉じる" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await saveConfigCount(page)).toBe(before);

  // Cancel with no change closes directly.
  dialog = await openPicker(page);
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await saveConfigCount(page)).toBe(before);

  // The top-right close asks when the draft changed.
  dialog = await openPicker(page);
  await addNextStepCandidate(dialog, "5分だけ体を動かす");
  await dialog.getByRole("button", { name: "今日やるものを選ぶを閉じる" }).click();
  await expect(page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" })).toBeVisible();
  await page.getByRole("button", { name: "破棄して閉じる" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await saveConfigCount(page)).toBe(before);
  expect((await currentConfig(page)).today.items).toHaveLength(1);
});

test("P10-10 決定 warns when Today3 changed while the Picker was open", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  await prepare(page, fixture);
  const dialog = await openPicker(page);
  await addNextStepCandidate(dialog, "5分だけ体を動かす");
  const before = await saveConfigCount(page);

  await page.evaluate(() => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    config.today.items[0] = { ...config.today.items[0], done: true };
    control.updateConfig(config);
  });
  await expect(page.locator(".todayRow")).toHaveClass(/todayRow--complete/);

  await dialog.getByRole("button", { name: "決定" }).click();
  await expect(dialog).toBeVisible();
  await expect(
    page.locator(".toast", { hasText: "今日の3件がほかの所で変わりました。もう一度選んでください" }),
  ).toBeVisible();
  expect(await saveConfigCount(page)).toBe(before);

  // The draft is rebuilt from the live config (only the completed card).
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(1);
  await expect(dialog.locator(".todayPickerSlot--empty")).toHaveCount(2);
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveClass(/todayPickerSlot/);
  expect(await slotTexts(page)).toEqual(["資料を1ページ読む"]);
  const live = await currentConfig(page);
  expect(live.today.items).toHaveLength(1);
  expect(live.today.items[0].done).toBe(true);
});

test("P10-10 save failure keeps the Picker open and can be retried", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  await prepare(page, fixture);
  const dialog = await openPicker(page);
  await addNextStepCandidate(dialog, "5分だけ体を動かす");

  await setSaveFailure(page, true);
  await dialog.getByRole("button", { name: "決定" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(2);
  await expect(page.locator(".toast", { hasText: "保存できません" })).toBeVisible();
  expect((await currentConfig(page)).today.items).toHaveLength(1);

  await setSaveFailure(page, false);
  await dialog.getByRole("button", { name: "決定" }).click();
  await expect(dialog).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toHaveLength(2);
});

test("P10-10 a running Timer card cannot be removed", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  fixture.config.today.items[0].shortTimerMinutes = 1;
  await prepare(page, fixture);
  await page
    .locator(".todayRow")
    .getByRole("button", { name: "短時間タイマー1分で開始" })
    .click();

  const dialog = await openPicker(page);
  const remove = dialog.getByRole("button", { name: "今日から外す" });
  await expect(remove).toBeDisabled();
  await expect(remove).toHaveAttribute("title", "タイマーを停止してから外してください");
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(1);
});

test("P10-10 the Picker cannot be opened when Today3 is full", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items.push({
    text: "3件目の札",
    done: false,
    sourceKey: "manual:p10-10-third",
  });
  await prepare(page, fixture);
  await expect(page.locator(".todayRow")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "今日やるものを選ぶ", exact: true })).toHaveCount(0);
});
