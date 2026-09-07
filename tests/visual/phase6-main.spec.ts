import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_DIR = resolve("docs/phase6/screenshots");
const P61_SCREENSHOT_DIR = resolve("docs/phase6.1/screenshots");

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

function withOneMinuteProjectTimer(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.projects[0].shortTimerMinutes = 1;
  fixture.config.today.items = [
    {
      text: fixture.config.projects[0].nextStep,
      done: false,
      sourceKey: "project:" + fixture.config.projects[0].id,
      projectId: fixture.config.projects[0].id,
    },
  ];
  return fixture;
}

test("Main hierarchy and Today3 three-column layout match Phase 6", async ({ page }) => {
  await prepare(page, withThreeTodayItems());
  const selectors = [
    ".victoryBar",
    ".doNowBand",
    ".focusBand",
    ".todayBuilderBand",
    ".projectsBand",
    ".inboxBand",
    ".todayActivityBand",
  ];
  const ordered = await page
    .locator(selectors.join(","))
    .evaluateAll(
      (elements, selectorList) =>
        elements.map((element) => selectorList.findIndex((selector) => element.matches(selector))),
      selectors,
    );
  expect(ordered).toEqual([0, 1, 2, 3, 4, 5, 6]);

  const cards = page.locator(".todayRow");
  await expect(cards).toHaveCount(3);
  await expect(page.getByRole("button", { name: /次の3件を選ぶ/ })).toHaveCount(0);
  const boxes = await cards.evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { width: rect.width, y: rect.y };
    }),
  );
  expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(1);
  expect(
    Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width)),
  ).toBeLessThan(2);
  const gridSpacing = await page.locator(".todayGrid").evaluate((grid) => {
    const gridRect = grid.getBoundingClientRect();
    const cards = Array.from(grid.querySelectorAll<HTMLElement>(".todayRow"));
    const firstRect = cards[0].getBoundingClientRect();
    const secondRect = cards[1].getBoundingClientRect();
    const lastRect = cards.at(-1)!.getBoundingClientRect();
    return {
      cardGap: secondRect.left - firstRect.right,
      endGap: gridRect.right - lastRect.right,
    };
  });
  expect(gridSpacing.endGap).toBeGreaterThanOrEqual(9);
  expect(Math.abs(gridSpacing.endGap - gridSpacing.cardGap)).toBeLessThan(1);
  await expect(cards.first()).toHaveAttribute("data-project-color", "blue");
  await expect(cards.first()).toHaveCSS("border-top-color", "rgb(112, 167, 255)");
  await expect(cards.nth(1)).not.toHaveAttribute("data-project-color");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "p6-01-main-today3-three-cards.png") });
});

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
  await page.mouse.move(source!.x + source!.width - 12, source!.y + 12);
  await page.mouse.down();
  await page.mouse.move(source!.x + source!.width - 28, source!.y + 12, { steps: 2 });
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
  await page.screenshot({
    path: resolve(P61_SCREENSHOT_DIR, "p61-05-today3-drag.png"),
  });
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
  await page.mouse.move(source!.x + source!.width - 12, source!.y + 12);
  await page.mouse.down();
  await page.mouse.move(source!.x + source!.width - 28, source!.y + 12, {
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

test("Today3 renders a stable two-card layout", async ({ page }) => {
  const fixture = withThreeTodayItems();
  fixture.config.today.items = fixture.config.today.items.slice(0, 2);
  await prepare(page, fixture);
  await expect(page.locator(".todayRow")).toHaveCount(2);
  await page.locator(".focusBand").screenshot({
    path: resolve(SCREENSHOT_DIR, "p6-01-main-today3-two-cards.png"),
  });
});

test("planned completion from a Today card marks only the linked item complete", async ({
  page,
}) => {
  await prepare(page, withOneMinuteProjectTimer());
  const card = page.locator(".todayRow").first();
  await expect(page.locator(".todayRow")).toHaveCount(1);
  await page.locator(".focusBand").screenshot({
    path: resolve(SCREENSHOT_DIR, "p6-01-main-today3-one-card.png"),
  });
  await card.getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await page.clock.runFor(60_500);
  await expect(page.getByRole("dialog", { name: "タイマー満了" })).toBeVisible();
  await page.getByRole("button", { name: "終わる" }).click();
  await expect(card.getByRole("status", { name: "タイマー満了済み" })).toBeVisible();
  expect((await currentConfig(page)).today.items[0].done).toBe(true);
});

test("manual stop keeps a Today item incomplete", async ({ page }) => {
  const fixture = withOneMinuteProjectTimer();
  fixture.config.projects[0].shortTimerMinutes = 2;
  await prepare(page, fixture);
  const card = page.locator(".todayRow").first();
  await card.getByRole("button", { name: "短時間タイマー2分で開始" }).click();
  await page.clock.runFor(70_000);
  await card.getByRole("button", { name: "終了" }).click();
  await expect(card.getByRole("status", { name: "未完了" })).toBeVisible();
  expect((await currentConfig(page)).today.items[0].done).toBe(false);
  const recorded = await page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: {
          invokeCalls: Array<{ command: string }>;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    return control?.invokeCalls.some((call) => call.command === "record_session");
  });
  expect(recorded).toBe(true);
});

test("planned completion started from Do Now completes the linked Today item", async ({ page }) => {
  await prepare(page, withOneMinuteProjectTimer());
  await page
    .locator(".doNowBand")
    .getByRole("button", { name: /1分で始める/ })
    .click();
  await page.clock.runFor(60_500);
  await page.getByRole("button", { name: "終わる" }).click();
  await expect(
    page.locator(".todayRow").getByRole("status", { name: "タイマー満了済み" }),
  ).toBeVisible();
});

test("three completed items expose the manual next-batch flow", async ({ page }) => {
  const fixture = withThreeTodayItems();
  fixture.config.today.items = fixture.config.today.items.map((item) => ({
    ...item,
    done: true,
  }));
  await prepare(page, fixture);
  await expect(page.getByRole("button", { name: /次の3件を選ぶ/ })).toBeVisible();
  await page.locator(".focusBand").screenshot({
    path: resolve(SCREENSHOT_DIR, "p6-01-main-today3-completed.png"),
  });
  await page.getByRole("button", { name: /次の3件を選ぶ/ }).click();
  await expect(page.locator(".todayRow")).toHaveCount(0);
  await expect(page.locator(".todayBuilderDisclosure")).toHaveAttribute("aria-expanded", "true");
  expect((await currentConfig(page)).today.items).toEqual([]);
  await page.locator(".todayActivityBand .disclosure").click();
  await expect(page.locator(".todayActivityRow")).toHaveCount(1);
  await page.locator(".focusBand").screenshot({
    path: resolve(SCREENSHOT_DIR, "p6-01-main-next-batch-empty.png"),
  });
});

test("Today Builder is source-only, paginates, and ignores legacy dismiss keys", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.inbox.push(
    { id: "extra-1", text: "追加候補 1" },
    { id: "extra-2", text: "追加候補 2" },
    { id: "extra-3", text: "追加候補 3" },
    { id: "extra-4", text: "追加候補 4" },
  );
  await prepare(page, fixture);
  const legacyDismissed = ["project:sample-learning:資料を1ページ読む"];
  await page.evaluate((keys) => {
    localStorage.setItem("life-launcher-today-builder-dismissed", JSON.stringify(keys));
  }, legacyDismissed);
  await page.reload();
  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator("[data-today-builder-index]")).toHaveCount(5);
  await expect(page.locator(".todayBuilderPagination")).toContainText("1 / 2");
  await expect(page.getByRole("button", { name: "今日を組み立てるに次の一手を追加" })).toHaveCount(
    0,
  );
  await expect(page.locator(".todayBuilderDestination")).toHaveCount(0);
  await expect(page.locator(".todayBuilderSource").filter({ hasText: "最近のnote" })).toHaveCount(
    0,
  );
  await expect(
    page.locator(".todayBuilderSource").filter({ hasText: "昨日の勝利条件" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => localStorage.getItem("life-launcher-today-builder-dismissed")),
  ).toBe(JSON.stringify(legacyDismissed));

  await page.locator(".todayBuilderBand").screenshot({
    path: resolve(P61_SCREENSHOT_DIR, "p61-01-builder-source-only.png"),
  });
  await page.locator("[data-today-builder-index]").first().click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "上へ移動" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "削除" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator("[data-today-builder-index]")).toHaveCount(3);

  await page.locator(".projectsBand").getByRole("button", { name: "プロジェクトを追加" }).click();
  const dialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await dialog.getByRole("textbox", { name: "プロジェクト名" }).fill("追加したプロジェクト");
  await dialog.getByRole("textbox", { name: "次の一手", exact: true }).fill("6件目以降も残る候補");
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(page.locator(".todayBuilderHeader .disclosureCount")).toContainText("9件");

  await page.reload();
  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator(".todayBuilderPagination")).toContainText("1 / 2");
  expect(
    (await currentConfig(page)).projects.some(
      (project) => project.nextStep === "6件目以降も残る候補",
    ),
  ).toBe(true);
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
  await page.locator(".todayBuilderDisclosure").click();
  const builderRows = page.locator(".todayBuilderRow");
  await builderRows.nth(0).getByRole("button", { name: "今日へ" }).click();
  await builderRows.nth(1).getByRole("button", { name: "今日へ" }).click();
  await builderRows.nth(2).getByRole("button", { name: "今日へ" }).click();
  const config = await currentConfig(page);
  expect(config.today.items).toHaveLength(3);
  expect(config.inbox).toHaveLength(2);
  await expect(builderRows.nth(3).getByRole("button", { name: "今日へ" })).toBeDisabled();
  await projects.screenshot({
    path: resolve(SCREENSHOT_DIR, "p6-01-main-next-step-expanded.png"),
  });
  await page.locator(".inboxBand").screenshot({
    path: resolve(SCREENSHOT_DIR, "p6-01-main-wishlist-expanded.png"),
  });
  await page.locator(".todayActivityBand .disclosure").click();
  await page.locator(".todayActivityBand").screenshot({
    path: resolve(SCREENSHOT_DIR, "p6-01-main-today-activity.png"),
  });
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

  await page.locator(".todayBuilderDisclosure").click();
  const rows = page.locator(".todayBuilderRow");
  await expect(rows).toHaveCount(2);
  await rows.nth(0).getByRole("button", { name: "今日へ" }).click();
  await expect(rows.nth(0).getByRole("button", { name: "選択済み" })).toBeDisabled();
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

  await page.locator(".todayBuilderDisclosure").click();
  const rows = page.locator(".todayBuilderRow");
  await expect(rows.nth(0).getByRole("button", { name: "選択済み" })).toBeDisabled();
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
  fixture.config.projects[0].defaultTimerMinutes = 37;
  fixture.config.projects[0].shortTimerMinutes = 7;
  await prepare(page, fixture);

  await page.locator(".todayBuilderDisclosure").click();
  await page.locator(".todayBuilderRow").first().getByRole("button", { name: "今日へ" }).click();
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
              nextStep: "変更後の一手",
              buttonIds: [],
              instructionPath: undefined,
              defaultTimerMinutes: 25,
              shortTimerMinutes: 5,
            }
          : project,
      ),
    });
  });

  const today = page.locator(".todayRow").first();
  await expect(today.getByRole("button", { name: "資料を1ページ読む" })).toBeVisible();
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

  await page.locator(".todayBuilderDisclosure").click();
  await page.locator(".todayBuilderRow").first().getByRole("button", { name: "今日へ" }).click();
  await expect(page.locator(".toast")).toContainText("保存できません");
  await expect(page.locator(".todayRow")).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toEqual([]);
});

test("NextStep accordion, detailed add dialog, and keyboard context menu are reachable", async ({
  page,
}) => {
  await prepare(page);
  const disclosure = page.locator(".projectsBand .disclosure");
  await disclosure.focus();
  await disclosure.press("Enter");
  await expect(page.locator(".nextStepBody")).toBeHidden();
  await page.locator(".projectsBand").screenshot({
    path: resolve(SCREENSHOT_DIR, "p6-01-main-next-step-collapsed.png"),
  });
  await disclosure.press("Enter");

  await page.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await dialog.getByRole("textbox", { name: "プロジェクト名" }).fill("新しいプロジェクト");
  await dialog.getByRole("textbox", { name: "次の一手", exact: true }).fill("最初の1行を書く");
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(page.locator(".nextStepRow")).toHaveCount(3);

  const row = page.locator(".nextStepRow").first();
  await row.focus();
  await row.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "編集" })).toBeVisible();
});
