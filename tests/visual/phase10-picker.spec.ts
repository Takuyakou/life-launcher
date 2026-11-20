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

  // P10-14d (P1): the picker stacks both groups; there are no tabs to switch.
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

test("F11 the Picker header has no rule and 今日の3件 sits next to 2 / 3", async ({ page }) => {
  await prepare(page, createPublicFixture());
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  const header = dialog.locator(".todayPickerHead");
  await expect(header).toHaveCSS("border-bottom-width", "0px");
  await expect(dialog.locator(".todayPickerDestinationHeader h3")).toBeVisible();
  await expect(dialog.locator(".todayPickerCounter")).toBeVisible();
  await page.evaluate(() => document.fonts.ready);
  // Measure both boxes in one evaluate: two boundingBox() calls can straddle a font-load reflow.
  await expect
    .poll(async () => {
      const { titleRight, counterLeft } = await page.evaluate(
        ([titleSelector, counterSelector]) => {
          const titleRect = document.querySelector(titleSelector)!.getBoundingClientRect();
          const counterRect = document.querySelector(counterSelector)!.getBoundingClientRect();
          return { titleRight: titleRect.right, counterLeft: counterRect.left };
        },
        [".todayPickerDestinationHeader h3", ".todayPickerCounter"],
      );
      return Math.abs(counterLeft - (titleRight + 8));
    })
    .toBeLessThanOrEqual(1);
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

test("P10-15b H0 the picker progress line sits under the header and follows the count", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  await prepare(page, fixture);
  const dialog = await openPicker(page);
  await page.waitForTimeout(300);
  const progress = dialog.locator(".todayPickerProgress");
  const header = dialog.locator(".todayPickerDestinationHeader");
  const destination = dialog.locator(".todayPickerDestination");
  await expect(progress).toBeVisible();
  const headerBox = (await header.boundingBox())!;
  const progressBox = (await progress.boundingBox())!;
  const destinationBox = (await destination.boundingBox())!;
  const destinationStyle = await destination.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      paddingLeft: parseFloat(style.paddingLeft),
      paddingRight: parseFloat(style.paddingRight),
    };
  });
  expect(Math.abs(progressBox.y - (headerBox.y + headerBox.height) - 10)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(
      progressBox.width -
        (destinationBox.width - destinationStyle.paddingLeft - destinationStyle.paddingRight),
    ),
  ).toBeLessThanOrEqual(2);
  const expected = async (count: number) => {
    await expect(progress).toHaveAttribute("aria-valuenow", String(count));
    const bar = progress.locator("span");
    await page.waitForTimeout(260);
    const barBox = (await bar.boundingBox())!;
    const full = (await progress.boundingBox())!;
    expect(Math.abs(barBox.width - (full.width * count) / 3)).toBeLessThanOrEqual(2);
  };
  await expected(1);
  await addNextStepCandidate(dialog, "5分だけ体を動かす");
  await expected(2);
  await dialog
    .locator('[data-today-picker-section="wishlist"] .todayPickerRow', {
      hasText: "あとで確認するサンプル",
    })
    .getByRole("button", { name: "今日へ" })
    .click();
  await expected(3);
});

test("P10-15b H1 the picker footer lines up with the 今日の3件 frame and uses 42px", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const dialog = await openPicker(page);
  await page.waitForTimeout(300);
  const frame = (await dialog.locator(".todayPickerDestination").boundingBox())!;
  const actions = (await dialog.locator(".formDialogActions").boundingBox())!;
  expect(Math.abs(actions.x - frame.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(actions.x + actions.width - (frame.x + frame.width))).toBeLessThanOrEqual(1);
  const decide = (await dialog.getByRole("button", { name: "決定" }).boundingBox())!;
  const cancel = (await dialog.getByRole("button", { name: "キャンセル" }).boundingBox())!;
  expect(Math.round(decide.height)).toBe(42);
  expect(Math.round(cancel.height)).toBe(42);
  await page.setViewportSize({ width: 860, height: 560 });
  await page.waitForTimeout(100);
  const narrowFrame = (await dialog.locator(".todayPickerDestination").boundingBox())!;
  const narrowActions = (await dialog.locator(".formDialogActions").boundingBox())!;
  expect(Math.abs(narrowActions.x - narrowFrame.x)).toBeLessThanOrEqual(1);
  expect(
    Math.abs(narrowActions.x + narrowActions.width - (narrowFrame.x + narrowFrame.width)),
  ).toBeLessThanOrEqual(1);
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  const card = page.locator(".nextStepCard").filter({ hasText: "ストレッチ" }).first();
  await card.hover();
  await card.getByRole("button", { name: "編集", exact: true }).click();
  const editor = page.locator(".nextStepEditDialog").first();
  await expect(editor).toBeVisible();
  const save = (await editor.getByRole("button", { name: "保存" }).boundingBox())!;
  const cancelSave = (await editor.getByRole("button", { name: "キャンセル" }).boundingBox())!;
  expect(Math.round(save.height)).toBeGreaterThanOrEqual(41);
  expect(Math.round(cancelSave.height)).toBeGreaterThanOrEqual(41);
  expect(Math.abs(decide.height - save.height)).toBeLessThanOrEqual(1);
});

test("P10-10 決定 pressed twice in one task still saves once (P10-14)", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  await prepare(page, fixture);
  const dialog = await openPicker(page);
  await addNextStepCandidate(dialog, "5分だけ体を動かす");
  const before = await saveConfigCount(page);

  await page.evaluate(() => {
    const buttons = Array.from(document.querySelectorAll("button"));
    const decide = buttons.find((button) => button.textContent?.trim() === "決定");
    if (!decide) throw new Error("決定 was not found");
    decide.click();
    decide.click();
  });

  await expect(dialog).toHaveCount(0);
  await expect.poll(() => saveConfigCount(page)).toBe(before + 1);
  await page.waitForTimeout(300);
  expect(await saveConfigCount(page)).toBe(before + 1);
});
