import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_DIR = resolve("docs/phase6/screenshots");

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
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "p6-01-main-today3-three-cards.png") });
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

test("Today Builder saves above five, paginates, deletes, and restores after reload", async ({
  page,
}) => {
  await prepare(page);
  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator("[data-today-builder-index]")).toHaveCount(5);
  await expect(page.locator(".todayBuilderPagination")).toContainText("1 / 2");

  const builder = page.locator(".todayBuilderBand");
  await builder.getByRole("button", { name: "やりたいことを追加" }).click();
  await builder.getByRole("textbox", { name: "やりたいことに追加" }).fill("6件目以降も残る候補");
  await builder.getByRole("textbox", { name: "やりたいことに追加" }).press("Enter");
  expect(
    (await currentConfig(page)).inbox.some((item) => item.text === "6件目以降も残る候補"),
  ).toBe(true);

  await page.getByRole("button", { name: "次のページ" }).click();
  while ((await page.locator(".todayBuilderPagination").count()) > 0) {
    await page.locator("[data-today-builder-index]").last().click({ button: "right" });
    await page.getByRole("menuitem", { name: "削除" }).click();
  }
  await expect(page.locator("[data-today-builder-index]")).toHaveCount(5);

  await page.reload();
  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator(".todayBuilderPagination")).toHaveCount(0);
  expect(
    (await currentConfig(page)).inbox.some((item) => item.text === "6件目以降も残る候補"),
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
  await projects.locator(".nextStepTodayButton").first().click();
  let config = await currentConfig(page);
  expect(config.today.items).toHaveLength(1);
  expect(config.projects[0].nextStep).toBe("資料を1ページ読む");
  await projects.locator(".nextStepTodayButton").first().click();
  await expect(page.locator(".toast").last()).toContainText("既にあります");
  expect((await currentConfig(page)).today.items).toHaveLength(1);

  await page.locator(".inboxBand .disclosure").click();
  await page.locator(".inboxRow .moveTodayButton").first().click();
  await projects.locator(".nextStepTodayButton").nth(1).click();
  config = await currentConfig(page);
  expect(config.today.items).toHaveLength(3);
  expect(config.inbox).toHaveLength(2);
  await page.locator(".inboxRow .moveTodayButton").nth(1).click();
  await expect(page.locator(".toast").last()).toContainText("3件まで");
  expect((await currentConfig(page)).today.items).toHaveLength(3);
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

  await page.locator(".projectsBand .nextStepTodayButton").first().click();
  await expect(page.locator(".toast")).toContainText("保存できません");
  await expect(page.locator(".todayRow")).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toEqual([]);
});

test("NextStep accordion, inline add, and keyboard context menu are reachable", async ({
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

  await page.getByRole("button", { name: "次の一手を追加" }).click();
  await page.getByRole("textbox", { name: "プロジェクト名" }).fill("新しいプロジェクト");
  await page.getByRole("textbox", { name: "次の一手" }).fill("最初の1行を書く");
  await page.getByRole("textbox", { name: "次の一手" }).press("Enter");
  await expect(page.locator(".nextStepRow")).toHaveCount(3);

  const row = page.locator(".nextStepRow").first();
  await row.focus();
  await row.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "編集" })).toBeVisible();
});
