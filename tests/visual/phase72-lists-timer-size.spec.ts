import { expect, test, type Page } from "@playwright/test";
import type { AppConfig, InboxItem, LauncherProject } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

function fixtureWithCount(kind: "projects" | "inbox", count: number): VisualQaFixture {
  const fixture = createPublicFixture();
  const projectTemplate = fixture.config.projects[0];
  if (kind === "projects") {
    fixture.config.projects = Array.from({ length: count }, (_, index): LauncherProject => ({
      ...projectTemplate,
      id: `project-${index + 1}`,
      name: `プロジェクト ${String(index + 1).padStart(3, "0")}`,
      nextStep: {
        ...projectTemplate.nextStep!,
        text: `次の一手 ${String(index + 1).padStart(3, "0")}`,
        buttonIds: [],
      },
      weeklyFocus: undefined,
    }));
    fixture.config.inbox = [];
  } else {
    fixture.config.projects = [projectTemplate];
    fixture.config.inbox = Array.from({ length: count }, (_, index): InboxItem => ({
      id: `wishlist-${index + 1}`,
      text: `やりたいこと ${String(index + 1).padStart(3, "0")}`,
      projectId: projectTemplate.id,
    }));
  }
  fixture.config.today.items = [];
  return fixture;
}

async function prepare(page: Page, fixture: VisualQaFixture, width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function openWishlist(page: Page) {
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
}

async function saveCallCount(page: Page) {
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string }> };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === "save_config")
      .length,
  );
}

for (const [kind, counts] of [
  ["projects", [6, 7]],
  ["inbox", [5, 6, 19, 20]],
] as const) {
  for (const count of counts) {
    test(`P72-03 ${kind} count ${count} uses the contracted display threshold`, async ({ page }) => {
      await prepare(page, fixtureWithCount(kind, count));
      if (kind === "inbox") await openWishlist(page);
      const section = page.locator(kind === "projects" ? ".projectsBand" : ".inboxBand");
      const rows = section.locator(kind === "projects" ? ".nextStepRow" : ".inboxRow");
      const expected =
        kind === "projects"
          ? Math.min(6, count)
          : count >= 20
            ? 10
            : Math.min(5, count);
      await expect(rows).toHaveCount(expected);
      await expect(section.locator(".disclosureCount")).toHaveText(`${count}件`);
      const expectedControls =
        kind === "inbox"
          ? count > 5 && count < 20
            ? 1
            : 0
          : count > 6
            ? 1
            : 0;
      await expect(section.locator(".sourceListControls")).toHaveCount(expectedControls);
      await expect(section.locator(".sourceListPagination")).toHaveCount(kind === "inbox" && count >= 20 ? 1 : 0);
    });
  }
}

test("v1.3 7+ Project cards expand and compact without saving or toggling the section", async ({ page }) => {
  await prepare(page, fixtureWithCount("projects", 19));
  const before = await saveCallCount(page);
  const section = page.locator(".projectsBand");
  await section.getByRole("button", { name: "＋ 残り13件を表示" }).click();
  await expect(section.locator(".nextStepRow")).toHaveCount(19);
  await expect(section.locator(".disclosure")).toHaveAttribute("aria-expanded", "true");
  await section.getByRole("button", { name: "− 折りたたむ" }).click();
  await expect(section.locator(".nextStepRow")).toHaveCount(6);
  expect(await saveCallCount(page)).toBe(before);
});

test("P72-03 group pagination is independent and clamps after deleting its last-page item", async ({ page }) => {
  const fixture = fixtureWithCount("inbox", 21);
  fixture.config.inbox.push(...Array.from({ length: 20 }, (_, index) => ({
    id: "ungrouped-" + index, text: "Unclassified " + index,
  })));
  await prepare(page, fixture);
  await openWishlist(page);
  const before = await saveCallCount(page);
  const group = page.locator(".wishlistGroup", { has: page.getByRole("navigation", { name: "サンプル学習のやりたいことページ" }) });
  const nav = group.getByRole("navigation");
  const other = page.getByRole("navigation", { name: "未分類のやりたいことページ" });
  await expect(nav).toContainText("1 / 3");
  await other.getByRole("button", { name: "次へ" }).click();
  await nav.getByRole("button", { name: "次へ" }).click();
  await nav.getByRole("button", { name: "次へ" }).click();
  await expect(nav).toContainText("3 / 3");
  await expect(other).toContainText("2 / 2");
  await expect(group.locator(".inboxRow")).toHaveCount(1);
  expect(await saveCallCount(page)).toBe(before);
  await group.locator(".inboxRow").click({ button: "right" });
  await page.getByRole("menuitem", { name: "削除", exact: true }).click();
  await page.getByRole("dialog", { name: "削除しますか？" }).getByRole("button", { name: "削除", exact: true }).click();
  await expect(nav).toContainText("2 / 2");
  await expect(other).toContainText("2 / 2");
  await expect(group.locator(".inboxRow")).toHaveCount(10);
  await expect(nav.getByRole("button", { name: "次へ" })).toBeDisabled();
  expect(await saveCallCount(page)).toBe(before + 1);
});

test("v1.3 stable focus follows a Project card across expansion and deletion", async ({ page }) => {
  await prepare(page, fixtureWithCount("projects", 19));
  await page.getByRole("button", { name: "＋ 残り13件を表示" }).click();
  const anchored = page.locator('.nextStepCard[data-project-id="project-19"]');
  await anchored.focus();
  await page.evaluate(() => {
    const qa = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          currentConfig: () => AppConfig;
          updateConfig: (config: AppConfig) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = structuredClone(qa.currentConfig());
    config.projects.push({
      ...config.projects[0],
      id: "project-20",
      name: "プロジェクト 020",
      nextStep: {
        ...config.projects[0].nextStep!,
        text: "次の一手 020",
      },
    });
    qa.updateConfig(config);
  });
  await expect(page.getByRole("navigation", { name: "次の一手のページ" })).toHaveCount(0);
  await expect(anchored).toBeFocused();

  await page.evaluate(() => {
    const qa = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          currentConfig: () => AppConfig;
          updateConfig: (config: AppConfig) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = structuredClone(qa.currentConfig());
    config.projects = config.projects.filter((project) => project.id !== "project-19");
    qa.updateConfig(config);
  });
  await expect(page.getByRole("navigation", { name: "次の一手のページ" })).toHaveCount(0);
  await expect(
    page.locator('.nextStepCard[data-project-id="project-20"]'),
  ).toBeFocused();
});

test("P72-03 long-duration Today actions remain readable, separate and operable", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items[0].shortTimerMinutes = 120;
  fixture.config.today.items[0].defaultTimerMinutes = 240;
  await prepare(page, fixture, 1366);
  const card = page.locator(".todayRow").first();
  const short = card.getByRole("button", { name: "短時間タイマー120分で開始" });
  const normal = card.getByRole("button", { name: "通常タイマー240分で開始" });
  await expect(short).toHaveAttribute("title", "短時間タイマー: 120分");
  await expect(normal).toHaveAttribute("title", "通常タイマー: 240分");
  await expect(short.locator(".nextStepStartDuration")).toHaveText("120分");
  await expect(normal.locator(".nextStepStartDuration")).toHaveText("240分");
  const shortBox = (await short.boundingBox())!;
  const normalBox = (await normal.boundingBox())!;
  expect(shortBox.x + shortBox.width <= normalBox.x || shortBox.y + shortBox.height <= normalBox.y).toBe(true);
  for (const button of [short, normal]) {
    expect(await button.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  }
  await page.mouse.move(0, 0);
  await expect(short.locator(".nextStepStartGlyph")).toHaveCSS("opacity", "0");
  const beforeHover = await short.boundingBox();
  await short.hover();
  await expect(short.locator(".nextStepStartDuration")).toHaveCSS("opacity", "1");
  await expect(short.locator(".nextStepStartGlyph")).toHaveCSS("opacity", "1");
  const afterHover = (await short.boundingBox())!;
  expect({ width: afterHover.width, height: afterHover.height }).toEqual({
    width: beforeHover!.width,
    height: beforeHover!.height,
  });
  const normalAfterHover = (await normal.boundingBox())!;
  expect(
    afterHover.x + afterHover.width <= normalAfterHover.x ||
    afterHover.y + afterHover.height <= normalAfterHover.y,
  ).toBe(true);
  expect(await short.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(short).toHaveCSS("transform", "none");
  await expect(short.locator(".nextStepStartGlyph")).toHaveCSS("transition-duration", "0s");
  await short.click();
  const pause = card.getByRole("button", { name: "このセッションを一時停止" });
  const stop = card.getByRole("button", { name: "終了", exact: true });
  const pauseBox = (await pause.boundingBox())!, stopBox = (await stop.boundingBox())!;
  expect(pauseBox.x + pauseBox.width <= stopBox.x || pauseBox.y + pauseBox.height <= stopBox.y).toBe(true);
  await expect(stop.locator("svg")).toHaveCount(1);
  await expect(card.getByRole("button", { name: "このセッションを一時停止" })).toBeVisible();
});

for (const width of [1920, 860]) {
  test(`P72-03 long-text Today buttons keep the Today grid bounded at ${width}`, async ({ page }) => {
    const fixture = createPublicFixture();
    fixture.config.today.items.push({ text: "長い本文".repeat(20), done: false, sourceKey: "manual:long" });
    await prepare(page, fixture, width);
    for (const button of await page.locator(".todayStartButton").all()) {
      await expect(button).toBeVisible();
      expect(await button.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
  });
}
