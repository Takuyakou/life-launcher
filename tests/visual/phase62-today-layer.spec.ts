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

async function setSaveFailure(page: Page, failed: boolean) {
  await page.evaluate((value) => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { setSaveConfigFailure: (failed: boolean) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    control.setSaveConfigFailure(value);
  }, failed);
}

test("Builder is the only persistent Today adoption surface and groups its sources", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator(".projectsBand .nextStepTodayButton")).toHaveCount(0);
  await page.locator(".inboxBand .disclosure").click();
  await expect(page.locator(".inboxBand .moveTodayButton")).toHaveCount(0);
  await expect(page.locator(".todayBuilderGroupHeading")).toHaveText([
    "次の一手2件",
    "やりたいこと2件",
  ]);
  await expect(page.locator(".todayBuilderRow .projectIdentity")).toHaveCount(3);
  await expect(
    page.locator(".todayBuilderRow").getByRole("button", { name: "今日へ" }),
  ).toHaveCount(4);
});

test("excluding a candidate keeps its source, removes linked Today3, and survives reload", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  await page.locator(".todayBuilderDisclosure").click();
  const candidate = page.locator(".todayBuilderRow", { hasText: "資料を1ページ読む" });
  await candidate.click({ button: "right" });
  await page.getByRole("menuitem", { name: "今日の候補から外す" }).click();

  let config = await currentConfig(page);
  expect(config.projects[0].nextStep).toBe("資料を1ページ読む");
  expect(config.today.items.some((item) => item.sourceKey === "project:sample-learning")).toBe(
    false,
  );
  expect(config.today.candidateExcludedSourceKeys).toContain("project:sample-learning");
  await expect(candidate).toHaveCount(0);

  await page.reload();
  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator(".todayBuilderRow", { hasText: "資料を1ページ読む" })).toHaveCount(0);
  config = await currentConfig(page);
  expect(config.projects[0].nextStep).toBe("資料を1ページ読む");
});

test("candidate exclusion rolls the Today layer back when save fails", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  await page.locator(".todayBuilderDisclosure").click();
  await setSaveFailure(page, true);
  const candidate = page.locator(".todayBuilderRow", { hasText: "資料を1ページ読む" });
  await candidate.click({ button: "right" });
  await page.getByRole("menuitem", { name: "今日の候補から外す" }).click();

  await expect(page.locator(".toast").last()).toContainText("保存できません");
  const config = await currentConfig(page);
  expect(config.today.candidateExcludedSourceKeys).toEqual([]);
  expect(config.today.items.some((item) => item.sourceKey === "project:sample-learning")).toBe(
    true,
  );
  await expect(candidate).toBeVisible();
});

test("active Today timer disables candidate exclusion until it is stopped", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [fixture.config.today.items[0]];
  await prepare(page, fixture);
  await page
    .locator(".todayRow")
    .getByRole("button", { name: /短時間タイマー5分で開始/ })
    .click();
  await page.locator(".todayBuilderDisclosure").click();
  await page
    .locator(".todayBuilderRow", { hasText: "資料を1ページ読む" })
    .click({ button: "right" });
  const action = page.getByRole("menuitem", { name: "今日の候補から外す" });
  await expect(action).toBeDisabled();
  await expect(action).toHaveAttribute("title", "タイマーを停止してから外してください");
});

for (const width of [860, 1366, 1440, 1920]) {
  test(`Builder compact layout has no horizontal overflow at ${width}px`, async ({ page }) => {
    const fixture = createPublicFixture();
    fixture.config.projects[0].nextStep =
      "長い日本語の候補でもボタンと重ならず今日やる一手として最後まで確認できるようにする";
    await prepare(page, fixture);
    await page.setViewportSize({ width, height: 900 });
    await page.locator(".todayBuilderDisclosure").click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
    await expect(page.locator(".todayBuilderRow").first()).toBeVisible();
  });
}
