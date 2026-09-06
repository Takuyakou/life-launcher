import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_DIR = resolve("docs/phase6/screenshots");

test.describe.configure({ mode: "serial" });

async function prepare(
  page: Page,
  route: string,
  windowLabel: string,
  viewport: { width: number; height: number },
  fixture: VisualQaFixture = createPublicFixture(),
) {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, windowLabel);
  await page.goto(route);
  await expect(page.locator("main, [role=main]").first()).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}",
  });
  return errors;
}

async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

function createLargeBuilderFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.projects.push(
    {
      id: "sample-writing",
      name: "文章",
      northStar: "短く書き進める",
      weeklyFocus: false,
      nextStep: "見出しを1つ書く",
      buttonIds: [],
      defaultTimerMinutes: 25,
      shortTimerMinutes: 5,
      colorId: "rose",
    },
    {
      id: "sample-cleanup",
      name: "片付け",
      northStar: "少しずつ整える",
      weeklyFocus: false,
      nextStep: "引き出しを1段見る",
      buttonIds: [],
      defaultTimerMinutes: 25,
      shortTimerMinutes: 5,
      colorId: "orange",
    },
    {
      id: "sample-review",
      name: "振り返り",
      northStar: "次の再開を軽くする",
      weeklyFocus: false,
      nextStep: "昨日のメモを1つ読む",
      buttonIds: [],
      defaultTimerMinutes: 25,
      shortTimerMinutes: 5,
      colorId: "violet",
    },
  );
  fixture.config.inbox.push({
    id: "sample-reading-later",
    text: "気になる資料をあとで読む",
  });
  return fixture;
}

for (const viewport of [
  { width: 1280, height: 720 },
  { width: 1366, height: 768 },
  { width: 1440, height: 900 },
  { width: 1920, height: 1080 },
  { width: 1000, height: 900 },
]) {
  test(`capture Phase 6 main ${viewport.width}x${viewport.height}`, async ({ page }) => {
    const errors = await prepare(page, "/", "main", viewport);
    await expect(page.getByText("最優先の一手を始める", { exact: true })).toBeVisible();
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, `main-${viewport.width}x${viewport.height}.png`),
    });
    await expectNoHorizontalOverflow(page);
    expect(errors).toEqual([]);
  });
}

test("capture Today Builder at five candidates", async ({ page }) => {
  const errors = await prepare(
    page,
    "/",
    "main",
    { width: 1440, height: 900 },
    createLargeBuilderFixture(),
  );
  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator("[data-today-builder-index]")).toHaveCount(5);
  await expect(page.locator(".todayBuilderPagination")).toContainText("1 / 2");
  await page.locator(".todayBuilderBand").screenshot({
    path: resolve(SCREENSHOT_DIR, "today-builder-5-items.png"),
  });
  expect(errors).toEqual([]);
});

test("capture and reload Today Builder above five candidates", async ({ page }) => {
  const errors = await prepare(
    page,
    "/",
    "main",
    { width: 1440, height: 900 },
    createLargeBuilderFixture(),
  );
  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator("[data-today-builder-index]")).toHaveCount(5);
  await expect(page.locator(".todayBuilderPagination")).toContainText("1 / 2");
  await page.locator(".todayBuilderBand").screenshot({
    path: resolve(SCREENSHOT_DIR, "today-builder-8-items.png"),
  });

  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator("[data-today-builder-index]")).toHaveCount(3);
  await page.reload();
  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator("[data-today-builder-index]")).toHaveCount(5);
  await expect(page.locator(".todayBuilderPagination")).toContainText("1 / 2");
  expect(errors).toEqual([]);
});

test("capture dictionary default, selected category, tile focus, and context menu", async ({
  page,
}) => {
  const errors = await prepare(page, "/?view=dictionary", "dictionary", {
    width: 1000,
    height: 640,
  });
  const allTab = page.getByRole("tab", { name: /すべて/ });
  const referenceTab = page.getByRole("tab", { name: /参考資料/ });

  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "dictionary-default.png") });
  await expectNoHorizontalOverflow(page);
  await referenceTab.click();
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "dictionary-category-selected.png") });

  const tile = page.locator(".dictionaryTile").first();
  await tile.focus();
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "dictionary-tile-focused.png") });
  await tile.click({ button: "right" });
  await expect(page.locator(".contextMenu")).toBeVisible();
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "dictionary-context-menu.png") });
  await page.keyboard.press("Escape");
  await allTab.click();
  expect(errors).toEqual([]);
});

test("capture dictionary category state priority matrix", async ({ page }) => {
  const errors = await prepare(page, "/?view=dictionary", "dictionary", {
    width: 1000,
    height: 640,
  });
  const allTab = page.getByRole("tab", { name: /すべて/ });
  const uncategorizedTab = page.getByRole("tab", { name: /未分類/ });
  const referenceTab = page.getByRole("tab", { name: /参考資料/ });

  await allTab.click();
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "dictionary-category-all-selected.png") });
  const fixedSelectedStyle = await allTab.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
    };
  });
  await uncategorizedTab.click();
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "dictionary-category-uncategorized-selected.png"),
  });
  await referenceTab.click();
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "dictionary-category-custom-selected.png"),
  });
  const customSelectedStyle = await referenceTab.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
    };
  });
  expect(fixedSelectedStyle).toEqual(customSelectedStyle);

  await allTab.click();
  await referenceTab.hover();
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "dictionary-category-hover.png") });
  await page.mouse.move(900, 600);
  await page.keyboard.press("Tab");
  await referenceTab.focus();
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "dictionary-category-focus.png") });

  await referenceTab.click();
  await referenceTab.hover();
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "dictionary-category-selected-hover.png"),
  });
  await page.mouse.move(900, 600);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowRight");
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "dictionary-category-selected-focus.png"),
  });
  expect(errors).toEqual([]);
});
