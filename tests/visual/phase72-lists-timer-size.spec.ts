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
      nextStep: `次の一手 ${String(index + 1).padStart(3, "0")}`,
      buttonIds: [],
      weeklyFocus: undefined,
    }));
    fixture.config.inbox = [];
  } else {
    fixture.config.projects = [projectTemplate];
    fixture.config.inbox = Array.from({ length: count }, (_, index): InboxItem => ({
      id: `wishlist-${index + 1}`,
      text: `やりたいこと ${String(index + 1).padStart(3, "0")}`,
      ...(index % 2 === 0 ? { projectId: projectTemplate.id } : {}),
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

for (const kind of ["projects", "inbox"] as const) {
  for (const count of [0, 1, 5, 6, 19, 20, 21, 30, 100]) {
    test(`P72-03 ${kind} count ${count} uses the contracted display threshold`, async ({ page }) => {
      await prepare(page, fixtureWithCount(kind, count));
      if (kind === "inbox") await openWishlist(page);
      const section = page.locator(kind === "projects" ? ".projectsBand" : ".inboxBand");
      const rows = section.locator(kind === "projects" ? ".nextStepRow" : ".inboxRow");
      const expected = count <= 5 ? count : count < 20 ? 5 : Math.min(10, count);
      await expect(rows).toHaveCount(expected);
      await expect(section.locator(".disclosureCount")).toHaveText(`${count}件`);
      await expect(section.locator(".sourceListControls")).toHaveCount(count >= 6 && count <= 19 ? 1 : 0);
      await expect(section.locator(".sourceListPagination")).toHaveCount(count >= 20 ? 1 : 0);
    });
  }
}

test("P72-03 6-19 item lists expand and compact without saving or toggling the section", async ({ page }) => {
  await prepare(page, fixtureWithCount("projects", 19));
  const before = await saveCallCount(page);
  const section = page.locator(".projectsBand");
  await section.getByRole("button", { name: "残り14件をもっと見る" }).click();
  await expect(section.locator(".nextStepRow")).toHaveCount(19);
  await expect(section.locator(".disclosure")).toHaveAttribute("aria-expanded", "true");
  await section.getByRole("button", { name: "5件だけ表示" }).click();
  await expect(section.locator(".nextStepRow")).toHaveCount(5);
  expect(await saveCallCount(page)).toBe(before);
});

test("P72-03 20+ pagination is independent, clamps, and never persists view state", async ({ page }) => {
  await prepare(page, fixtureWithCount("inbox", 21));
  await openWishlist(page);
  const before = await saveCallCount(page);
  const nav = page.getByRole("navigation", { name: "やりたいことのページ" });
  await expect(nav).toContainText("1 / 3");
  await nav.getByRole("button", { name: "次へ" }).click();
  await nav.getByRole("button", { name: "次へ" }).click();
  await expect(nav).toContainText("3 / 3");
  await expect(page.locator(".inboxRow")).toHaveCount(1);
  expect(await saveCallCount(page)).toBe(before);
});

test("P72-03 stable focus follows a source across 19-to-20 and deletion clamp", async ({ page }) => {
  await prepare(page, fixtureWithCount("projects", 19));
  await page.getByRole("button", { name: "残り14件をもっと見る" }).click();
  const anchored = page.locator('[data-project-id="project-19"]');
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
      nextStep: "次の一手 020",
    });
    qa.updateConfig(config);
  });
  await expect(page.getByRole("navigation", { name: "次の一手のページ" })).toContainText("2 / 2");
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
  await expect(page.locator('[data-project-id="project-20"]')).toBeFocused();
});

test("P72-03 Today buttons grow only in width while labels, colors and minutes remain unchanged", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items[0].shortTimerMinutes = 120;
  fixture.config.today.items[0].defaultTimerMinutes = 240;
  await prepare(page, fixture, 1366);
  const card = page.locator(".todayRow").first();
  const short = card.getByRole("button", { name: "短時間タイマー120分で開始" });
  const normal = card.getByRole("button", { name: "通常タイマー240分で開始" });
  await expect(short).toHaveAttribute("title", "短時間タイマー: 120分");
  await expect(normal).toHaveAttribute("title", "通常タイマー: 240分");
  const sizes = await Promise.all([short, normal].map((button) => button.evaluate((node) => {
    const style = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return { width: rect.width, height: rect.height, color: style.color, background: style.backgroundColor };
  })));
  expect(sizes[0].width).toBeGreaterThanOrEqual(88);
  expect(sizes[1].width).toBeGreaterThanOrEqual(88);
  expect(sizes[0].height).toBe(36);
  expect(sizes[1].height).toBe(36);
  expect(sizes[0].color).not.toBe(sizes[1].color);
  await short.hover();
  await expect(short.locator(".nextStepStartDuration")).toHaveCSS("opacity", "1");
  await short.click();
  await expect(card.getByRole("button", { name: "このセッションを一時停止" })).toBeVisible();
});

for (const width of [1920, 1000, 860]) {
  test(`P72-03 widened Today buttons keep the Today grid bounded at ${width}`, async ({ page }) => {
    const fixture = createPublicFixture();
    fixture.config.today.items.push({ text: "長い本文".repeat(20), done: false, sourceKey: "manual:long" });
    await prepare(page, fixture, width);
    for (const button of await page.locator(".todayStartButton").all()) {
      expect((await button.boundingBox())?.width).toBeGreaterThanOrEqual(88);
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
  });
}
