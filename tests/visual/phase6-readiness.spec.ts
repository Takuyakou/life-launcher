import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_DIR = resolve("docs/phase6/screenshots");

test.describe.configure({ mode: "serial" });

async function prepare(
  page: Page,
  fixture: VisualQaFixture = createPublicFixture(),
  viewport = { width: 1440, height: 900 },
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
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

async function invokeCommands(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { invokeCalls: Array<{ command: string }> };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    return control?.invokeCalls.map((call) => call.command) ?? [];
  });
}

function withTodayState(activeCount: number, completedCount = 0): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.today.items = Array.from({ length: activeCount }, (_, index) => ({
    text: `今日の候補 ${index + 1}`,
    done: index < completedCount,
    sourceKey: `manual:p6-03-${index + 1}`,
  }));
  return fixture;
}

function withBuilderCount(count: number): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.projects = [];
  fixture.config.today = {
    ...fixture.config.today,
    victory: { text: "", done: false },
    items: [],
  };
  fixture.config.inbox = Array.from({ length: count }, (_, index) => ({
    text: `候補 ${String(index + 1).padStart(2, "0")}`,
  }));
  fixture.sessionSummary = { ...fixture.sessionSummary, recentSessions: [] };
  fixture.sessionEntries = { ...fixture.sessionEntries, entries: [] };
  fixture.doNowCandidates = [];
  return fixture;
}

test("Main responsibilities keep timer starts in Do Now and Today3 only", async ({ page }) => {
  await prepare(page, withTodayState(3));
  await expect(
    page.locator(".doNowBand .doNowStartPrimary, .doNowBand .doNowStartSecondary"),
  ).toHaveCount(2);
  await expect(page.locator(".focusBand .todayStartButton")).toHaveCount(6);
  await expect(
    page.locator(
      ".todayBuilderBand .todayStartButton, .projectsBand .todayStartButton, .projectsBand .startButton, .projectsBand .shortStartButton, .inboxBand .todayStartButton, .todayActivityBand .todayStartButton",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".projectsBand .nextStepRow")).toHaveCount(2);
  await expect(page.locator(".todayRow input[type=checkbox]")).toHaveCount(0);
  await expect(page.locator(".todayRow [role=status]")).toHaveCount(3);
  await expect(page.locator(".todayBuilderDisclosure")).toHaveAttribute("aria-expanded");
  await expect(page.locator(".projectsBand .disclosure")).toHaveAttribute("aria-expanded");
  await expect(page.locator(".inboxBand .disclosure")).toHaveAttribute("aria-expanded");
  await expect(page.locator(".todayActivityBand .disclosure")).toHaveAttribute("aria-expanded");
});

for (const activeCount of [0, 1, 2, 3]) {
  test(`Today3 active count ${activeCount} renders without an escape path`, async ({ page }) => {
    await prepare(page, withTodayState(activeCount));
    await expect(page.locator(".todayRow")).toHaveCount(activeCount);
    const addButton = page.getByRole("button", { name: "今日の3件に追加" });
    await expect(addButton).toBeEnabled();
    if (activeCount === 3) {
      await addButton.click();
      await expect(page.locator(".toast").last()).toContainText("3件まで");
      await expect(page.locator(".todayRow")).toHaveCount(3);
    }
    const completionSummary = page.locator(".todayCompletionSummary");
    if (activeCount === 0) await expect(completionSummary).toHaveCount(0);
    else {
      await expect(completionSummary).toHaveText(`0 / ${activeCount} 完了`);
    }
    await expect(page.getByRole("button", { name: /次の3件を選ぶ/ })).toHaveCount(0);
  });
}

for (const completedCount of [0, 1, 2, 3]) {
  test(`Today3 completion count ${completedCount} of 3 has the correct batch state`, async ({
    page,
  }) => {
    await prepare(page, withTodayState(3, completedCount));
    await expect(page.locator(".todayCompletionStatus--complete")).toHaveCount(completedCount);
    await expect(
      page.locator(".todayCompletionStatus:not(.todayCompletionStatus--complete)"),
    ).toHaveCount(3 - completedCount);
    const summary = page.locator(".todayCompletionSummary");
    await expect(summary).toHaveText(`${completedCount} / 3 完了`);
    await expect(summary).toHaveClass(
      completedCount === 3 ? /todayCompletionSummary--complete/ : /todayCompletionSummary$/,
    );
    await expect(page.getByRole("button", { name: /次の3件を選ぶ/ })).toHaveCount(
      completedCount === 3 ? 1 : 0,
    );
  });
}

test("Today3 manual stop below one minute is not recorded", async ({ page }) => {
  const fixture = withTodayState(1);
  fixture.config.settings.shortTimerMinutes = 2;
  await prepare(page, fixture);
  const card = page.locator(".todayRow").first();
  await card.getByRole("button", { name: "短時間タイマー2分で開始" }).click();
  await page.clock.runFor(30_000);
  await card.getByRole("button", { name: "終了" }).click();
  await expect(page.locator(".toast").last()).toContainText("1分未満なので記録しませんでした");
  expect(
    (await invokeCommands(page)).filter((command) => command === "record_session"),
  ).toHaveLength(0);
  await expect(card.getByRole("status", { name: "未完了" })).toBeVisible();
});

test("starting another timer ends a paused timer before the new timer runs", async ({ page }) => {
  const fixture = withTodayState(2);
  fixture.config.settings.shortTimerMinutes = 2;
  await prepare(page, fixture);
  const cards = page.locator(".todayRow");
  await cards.nth(0).getByRole("button", { name: "短時間タイマー2分で開始" }).click();
  await page.clock.runFor(70_000);
  await cards.nth(0).getByRole("button", { name: "このセッションを一時停止" }).click();
  await expect(cards.nth(0).getByText("一時停止", { exact: true })).toBeVisible();
  await cards.nth(1).getByRole("button", { name: "短時間タイマー2分で開始" }).click();
  await expect(cards.nth(1).getByText("実行中", { exact: true })).toBeVisible();
  await expect(cards.nth(0).getByText("一時停止", { exact: true })).toHaveCount(0);
  await expect(page.locator(".runningBadge")).toHaveCount(1);
  expect(
    (await invokeCommands(page)).filter((command) => command === "record_session"),
  ).toHaveLength(1);
});

test("manual next batch accepts one, two, and three new items but no fourth", async ({ page }) => {
  await prepare(page, withTodayState(3, 3));
  await page.getByRole("button", { name: /次の3件を選ぶ/ }).click();
  await expect(page.locator(".todayRow")).toHaveCount(0);

  for (let index = 0; index < 3; index += 1) {
    await page
      .locator(".todayBuilderRow")
      .nth(index)
      .getByRole("button", { name: "追加", exact: true })
      .click();
    await expect(page.locator(".todayRow")).toHaveCount(index + 1);
  }
  await page
    .locator(".todayBuilderRow")
    .nth(3)
    .getByRole("button", { name: "追加", exact: true })
    .click();
  await expect(page.locator(".toast").last()).toContainText("3件まで");
  expect((await currentConfig(page)).today.items).toHaveLength(3);
});

for (const count of [0, 1, 5, 6, 10, 11]) {
  test(`Today Builder count ${count} paginates deterministically`, async ({ page }) => {
    await prepare(page, withBuilderCount(count));
    await page.locator(".todayBuilderDisclosure").click();
    await expect(page.locator("[data-today-builder-index]")).toHaveCount(Math.min(5, count));
    await expect(page.locator(".todayBuilderPagination")).toHaveCount(count > 5 ? 1 : 0);
    if (count > 5) {
      await expect(page.locator(".todayBuilderPagination")).toContainText(
        `1 / ${Math.ceil(count / 5)}`,
      );
    }
  });
}

test("Today Builder clamps after deleting the final item on the last page and reloads", async ({
  page,
}) => {
  await prepare(page, withBuilderCount(11));
  await page.locator(".todayBuilderDisclosure").click();
  await page.getByRole("button", { name: "次のページ" }).click();
  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator(".todayBuilderPagination")).toContainText("3 / 3");
  await page.locator("[data-today-builder-index]").last().click({ button: "right" });
  await page.getByRole("menuitem", { name: "削除" }).click();
  await expect(page.locator(".todayBuilderPagination")).toContainText("2 / 2");
  await expect(page.locator(".todayBuilderHeader .disclosureCount")).toContainText("10件");
  await page.reload();
  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator(".todayBuilderHeader .disclosureCount")).toContainText("10件");
});

test("Today Builder can delete to zero and keeps the dismissal after reload", async ({ page }) => {
  await prepare(page, withBuilderCount(1));
  await page.locator(".todayBuilderDisclosure").click();
  await page.locator("[data-today-builder-index]").click({ button: "right" });
  await page.getByRole("menuitem", { name: "削除" }).click();
  await expect(page.locator("[data-today-builder-index]")).toHaveCount(0);
  await page.reload();
  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator("[data-today-builder-index]")).toHaveCount(0);
});

test("section add flows use the intended editor and keep reload persistence", async ({ page }) => {
  await prepare(page, withTodayState(0));

  await page.getByRole("button", { name: "今日の3件に追加" }).click();
  const todayInput = page.getByRole("textbox", { name: "今日に追加" });
  await expect(todayInput).toBeFocused();
  await expect(
    page.locator(".todayAddRow").getByRole("button", { name: "追加", exact: true }),
  ).toBeDisabled();
  await todayInput.press("Escape");
  await expect(todayInput).toHaveCount(0);
  await page.getByRole("button", { name: "今日の3件に追加" }).click();
  await page.getByRole("textbox", { name: "今日に追加" }).fill("再起動後も残る今日");
  await page.getByRole("textbox", { name: "今日に追加" }).press("Enter");

  const projects = page.locator(".projectsBand");
  await projects.getByRole("button", { name: "次の一手を追加" }).click();
  let projectDialog = page.getByRole("dialog", { name: "次の一手を追加" });
  await expect(projectDialog).toBeVisible();
  const projectName = projectDialog.getByRole("textbox", { name: "名前" });
  await expect(projectName).toBeFocused();
  await projectName.fill("再起動確認プロジェクト");
  await projectDialog
    .getByRole("textbox", { name: "次の一手", exact: true })
    .fill("再起動後も残る一手");
  await projectDialog.getByRole("button", { name: "保存" }).click();
  await expect(projectDialog).toHaveCount(0);

  const wishlist = page.locator(".inboxBand");
  await wishlist.getByRole("button", { name: "やりたいことを追加" }).click();
  const wishlistInput = wishlist.getByRole("textbox", { name: "やりたいことに追加" });
  await expect(wishlistInput).toBeFocused();
  await wishlistInput.fill("再起動後も残るやりたいこと");
  await wishlistInput.press("Enter");

  const builder = page.locator(".todayBuilderBand");
  await builder.locator(".todayBuilderDisclosure").click();
  await expect(builder.locator(".inboxAddPrompt")).toHaveCount(0);
  const builderAdd = builder.getByRole("button", {
    name: "今日を組み立てるに次の一手を追加",
  });
  await expect(builderAdd).toContainText("追加");
  await builderAdd.click();
  projectDialog = page.getByRole("dialog", { name: "次の一手を追加" });
  await expect(projectDialog).toBeVisible();
  await expect(projectDialog.getByRole("textbox", { name: "名前" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(projectDialog).toHaveCount(0);

  await page.reload();
  expect(
    (await currentConfig(page)).today.items.some((item) => item.text === "再起動後も残る今日"),
  ).toBe(true);
  expect(
    (await currentConfig(page)).projects.some(
      (project) => project.nextStep === "再起動後も残る一手",
    ),
  ).toBe(true);
  expect(
    (await currentConfig(page)).inbox.some((item) => item.text === "再起動後も残るやりたいこと"),
  ).toBe(true);
});

test("Today3 changes from three to two to one column without horizontal overflow", async ({
  page,
}) => {
  await prepare(page, withTodayState(3));
  const rowCount = async () =>
    page
      .locator(".todayRow")
      .evaluateAll(
        (rows) => new Set(rows.map((row) => Math.round(row.getBoundingClientRect().y))).size,
      );
  expect(await rowCount()).toBe(1);

  await page.setViewportSize({ width: 1000, height: 900 });
  expect(await rowCount()).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  await page.setViewportSize({ width: 860, height: 900 });
  expect(await rowCount()).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "p6-03-main-responsive-860.png") });
});

test("Today Builder stays bounded at fifty synthetic candidates", async ({ page }) => {
  await prepare(page, withBuilderCount(50));
  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator("[data-today-builder-index]")).toHaveCount(5);
  await expect(page.locator(".todayBuilderPagination")).toContainText("1 / 10");
  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator(".todayBuilderPagination")).toContainText("2 / 10");
});
