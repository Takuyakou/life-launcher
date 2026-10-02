import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test.describe.configure({ mode: "serial" });

async function prepare(page: Page, fixture: VisualQaFixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    return control.currentConfig();
  });
}
async function saveConfigCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { invokeCalls: Array<{ command: string }> };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    return control?.invokeCalls.filter((call) => call.command === "save_config").length ?? 0;
  });
}

async function setSaveConfigFailure(page: Page, failed: boolean) {
  await page.evaluate((shouldFail) => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: {
          setSaveConfigFailure: (value: boolean) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    control.setSaveConfigFailure(shouldFail);
  }, failed);
}

function withThreeTodayItems(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.today.items = [
    fixture.config.today.items[0],
    {
      text: "机の上を整える",
      done: false,
      sourceKey: "manual:fixture-cleanup",
    },
    {
      text: "短い振り返りを書く",
      done: false,
      sourceKey: "manual:fixture-review",
    },
  ];
  return fixture;
}

for (const width of [860, 1440]) {
  test(`victory suggestion preserves the main scroll position at ${width}px`, async ({ page }) => {
    const fixture = createPublicFixture();
    fixture.config.today.victory = { text: "", done: false };
    await page.setViewportSize({ width, height: 700 });
    await prepare(page, fixture);
    await page.setViewportSize({ width, height: 700 });

    const scrollArea = page.locator(".mainScrollArea");
    const suggestion = page
      .locator('[aria-label="勝利条件の候補"]')
      .getByRole("button")
      .first();
    await expect(suggestion).toBeVisible();
    await scrollArea.evaluate((node) => {
      node.scrollTop = 24;
    });
    const before = await scrollArea.evaluate((node) => node.scrollTop);
    await suggestion.click();
    await expect(page.getByRole("textbox", { name: "今日の勝利条件" })).not.toHaveValue("");
    await expect
      .poll(() => scrollArea.evaluate((node) => node.scrollTop))
      .toBeCloseTo(before, 0);
  });
}

test("Today3 drag shows its position and saves on drop only", async ({ page }) => {
  const fixture = withThreeTodayItems();
  const originalOrder = fixture.config.today.items.map((item) => item.text);
  await prepare(page, fixture);
  const cards = page.locator(".todayRow");
  const source = await cards.nth(0).boundingBox();
  const target = await cards.nth(2).boundingBox();
  expect(source).not.toBeNull();
  expect(target).not.toBeNull();

  const savesBeforeDrag = await saveConfigCount(page);
  await page.mouse.move(source!.x + source!.width * 0.5, source!.y + 12);
  await page.mouse.down();
  await page.mouse.move(source!.x + source!.width * 0.5 - 16, source!.y + 12, { steps: 2 });
  await page.mouse.move(target!.x + target!.width * 0.75, target!.y + 12, {
    steps: 5,
  });

  await expect(cards.nth(0)).toHaveClass(/todayRow--dragging/);
  await expect(page.locator(".todayDragGhost")).toBeVisible();
  const indicator = page.locator(".todayDropIndicator");
  await expect(indicator).toBeVisible();
  await expect(indicator).toHaveCSS("background-color", "rgb(231, 185, 77)");
  const indicatorBox = await indicator.boundingBox();
  expect(indicatorBox).not.toBeNull();
  expect(indicatorBox!.height).toBeGreaterThan(indicatorBox!.width);
  expect(await saveConfigCount(page)).toBe(savesBeforeDrag);
  expect((await currentConfig(page)).today.items.map((item) => item.text)).toEqual(originalOrder);
  await page.mouse.up();

  const reordered = [originalOrder[1], originalOrder[2], originalOrder[0]];
  await expect
    .poll(async () => (await currentConfig(page)).today.items.map((item) => item.text))
    .toEqual(reordered);
  expect(await saveConfigCount(page)).toBe(savesBeforeDrag + 1);
});

test("Today3 drag rolls its optimistic order back when saving fails", async ({ page }) => {
  const fixture = withThreeTodayItems();
  const originalOrder = fixture.config.today.items.map((item) => item.text);
  await prepare(page, fixture);
  await setSaveConfigFailure(page, true);
  const cards = page.locator(".todayRow");
  const source = await cards.nth(0).boundingBox();
  const target = await cards.nth(2).boundingBox();
  expect(source).not.toBeNull();
  expect(target).not.toBeNull();
  const savesBeforeDrag = await saveConfigCount(page);
  await page.mouse.move(source!.x + source!.width * 0.5, source!.y + 12);
  await page.mouse.down();
  await page.mouse.move(source!.x + source!.width * 0.5 - 16, source!.y + 12, {
    steps: 2,
  });
  await page.mouse.move(target!.x + target!.width * 0.75, target!.y + 12, { steps: 5 });
  await expect(page.locator(".todayDragGhost")).toBeVisible();
  await page.mouse.up();

  await expect.poll(() => saveConfigCount(page)).toBe(savesBeforeDrag + 1);
  await expect
    .poll(async () => (await currentConfig(page)).today.items.map((item) => item.text))
    .toEqual(originalOrder);
  await expect(cards.nth(0)).toContainText(originalOrder[0]);
  await expect(cards.nth(1)).toContainText(originalOrder[1]);
  await expect(cards.nth(2)).toContainText(originalOrder[2]);
  await setSaveConfigFailure(page, false);
});

test("NextStep and Wishlist use compact non-destructive Today actions", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  const projects = page.locator(".projectsBand");
  await expect(projects.locator(".nextStepRow")).toHaveCount(2);
  await expect(projects.locator(".startButton, .shortStartButton, .todayStartButton")).toHaveCount(
    0,
  );
  await expect(projects.locator(".nextStepTodayButton")).toHaveCount(0);

  const wishlist = page.locator(".inboxBand");
  await wishlist.locator(".disclosure").click();
  await expect(wishlist.locator(".inboxAddPrompt")).toHaveCount(0);
  await expect(wishlist.getByRole("button", { name: "やりたいことを追加" })).toBeVisible();
  await expect(wishlist.locator(".inboxRow .moveTodayButton")).toHaveCount(0);
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const builderRows = page.locator(".todayPickerRow");
  await builderRows.nth(0).getByRole("button", { name: "今日へ" }).click();
  await builderRows.nth(1).getByRole("button", { name: "今日へ" }).click();
  await page.getByRole("tab", { name: /やりたいこと/ }).click();
  await builderRows.nth(2).getByRole("button", { name: "今日へ" }).click();
  const config = await currentConfig(page);
  expect(config.today.items).toHaveLength(3);
  expect(config.inbox).toHaveLength(2);
  const picker = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole("button", { name: "今日やるものを選ぶ", exact: true })).toHaveCount(0);
});

test("same-text Wishlist items keep separate stable identities", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects = [];
  fixture.config.today.items = [];
  fixture.config.inbox = [
    { id: "same-first", text: "同じ文面" },
    { id: "same-second", text: "同じ文面" },
  ];
  fixture.doNowCandidates = [];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  await page.getByRole("tab", { name: /やりたいこと/ }).click();
  const rows = page.locator(".todayPickerRow");
  await expect(rows).toHaveCount(2);
  await rows.nth(0).getByRole("button", { name: "今日へ" }).click();
  await expect(rows.nth(0).locator(".todayPickerSelectedStatus")).toHaveText("✓ 選択済み");
  await expect(rows.nth(1).getByRole("button", { name: "今日へ" })).toBeEnabled();
  await rows.nth(1).getByRole("button", { name: "今日へ" }).click();

  const items = (await currentConfig(page)).today.items;
  expect(items.map((item) => item.text)).toEqual(["同じ文面", "同じ文面"]);
  expect(items.map((item) => item.sourceKey)).toEqual([
    "wishlist:same-first",
    "wishlist:same-second",
  ]);
});

test("legacy same-text Wishlist selection maps to only the first stable item", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects = [];
  fixture.config.today.items = [
    {
      text: "同じ文面",
      done: false,
      sourceKey: "wishlist:none:同じ文面",
    },
  ];
  fixture.config.inbox = [
    { id: "same-first", text: "同じ文面" },
    { id: "same-second", text: "同じ文面" },
  ];
  fixture.doNowCandidates = [];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  await page.getByRole("tab", { name: /やりたいこと/ }).click();
  const rows = page.locator(".todayPickerRow");
  await expect(rows.nth(0).locator(".todayPickerSelectedStatus")).toHaveText("✓ 選択済み");
  await expect(rows.nth(1).getByRole("button", { name: "今日へ" })).toBeEnabled();
  await rows.nth(1).getByRole("button", { name: "今日へ" }).click();
  expect((await currentConfig(page)).today.items.map((item) => item.sourceKey)).toEqual([
    "wishlist:none:同じ文面",
    "wishlist:same-second",
  ]);
});

test("Today adoption snapshots timer, actions, text, and instruction", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.projects[0].nextStep!.defaultTimerMinutes = 37;
  fixture.config.projects[0].nextStep!.shortTimerMinutes = 7;
  await prepare(page, fixture);
  await page.setViewportSize({ width: 860, height: 900 });

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const source = page.locator(".todayPickerRow").first();
  await source.scrollIntoViewIfNeeded();
  const background = page.locator(".mainScrollArea");
  const beforeScroll = await background.evaluate((node) => node.scrollTop);
  const beforeSaves = await saveConfigCount(page);
  await source.getByRole("button", { name: "今日へ" }).click();
  expect(await background.evaluate((node) => node.scrollTop)).toBe(beforeScroll);
  await expect.poll(() => saveConfigCount(page)).toBe(beforeSaves + 1);
  expect(await background.evaluate((node) => node.scrollTop)).toBe(beforeScroll);
  let item = (await currentConfig(page)).today.items[0];
  expect(item).toMatchObject({
    text: "資料を1ページ読む",
    sourceKey: "project:sample-learning",
    buttonIds: ["sample-documents"],
    instructionPath: "C:\\PublicDemo\\Instructions\\guide.md",
    defaultTimerMinutes: 37,
    shortTimerMinutes: 7,
  });

  await page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: {
          currentConfig: () => AppConfig;
          updateConfig: (config: AppConfig) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    const config = control.currentConfig();
    control.updateConfig({
      ...config,
      projects: config.projects.map((project) =>
        project.id === "sample-learning"
          ? {
              ...project,
              nextStep: {
                ...project.nextStep!,
                text: "変更後の一手",
                buttonIds: [],
                instructionPath: undefined,
                defaultTimerMinutes: 25,
                shortTimerMinutes: 5,
              },
            }
          : project,
      ),
    });
  });

  const today = page.locator(".todayRow").first();
  await expect(today.locator(".todayTextButton", { hasText: "資料を1ページ読む" })).toBeVisible();
  await expect(today.getByRole("button", { name: "短時間タイマー7分で開始" })).toBeVisible();
  await expect(today.getByRole("button", { name: "通常タイマー37分で開始" })).toBeVisible();
  item = (await currentConfig(page)).today.items[0];
  expect(item.buttonIds).toEqual(["sample-documents"]);
  expect(item.defaultTimerMinutes).toBe(37);
  expect(item.shortTimerMinutes).toBe(7);
});

test("failed Today adoption rolls the optimistic UI back", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);
  await page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { setSaveConfigFailure: (failed: boolean) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    control?.setSaveConfigFailure(true);
  });

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  await page.locator(".todayPickerRow").first().getByRole("button", { name: "今日へ" }).click();
  await expect(page.locator(".toast")).toContainText("保存できません");
  await expect(page.locator(".todayRow")).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toEqual([]);
});
