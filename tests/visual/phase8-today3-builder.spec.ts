import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture, width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".focusBand")).toBeVisible();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() => (window as Window & {
    __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => AppConfig };
  }).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig());
}

test("P8 Today3 empty state reserves one row and opens Builder without a large shift", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  const empty = page.locator(".todayEmptyState");
  await expect(empty.getByText("今日やるものを選びましょう", { exact: true })).toBeVisible();
  await expect(empty.getByText("次の一手・やりたいことから選べます", { exact: true })).toBeVisible();
  const beforeHeight = (await page.locator(".todayGrid").boundingBox())!.height;
  expect(beforeHeight).toBeGreaterThanOrEqual(104);
  expect(beforeHeight).toBeLessThan(160);

  await empty.getByRole("button", { name: "今日を組み立てる" }).click();
  await expect(page.locator(".todayBuilderDisclosure")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".todayBuilderRow").first()).toBeFocused();
  await page.locator(".todayBuilderRow").first().getByRole("button", { name: "今日へ" }).click();
  await expect(empty).toHaveCount(0);
  await expect(page.locator(".todayRow")).toHaveCount(1);
  const afterHeight = (await page.locator(".todayGrid").boundingBox())!.height;
  expect(Math.abs(afterHeight - beforeHeight)).toBeLessThanOrEqual(16);
  expect((await currentConfig(page)).today.items).toHaveLength(1);
});

test("P8 completed Today3 cards stay visible and only exact 3 of 3 offers the next batch", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [
    { text: "資料を1ページ読む", done: true, sourceKey: "project:sample-learning", projectId: "sample-learning" },
    { text: "5分だけ体を動かす", done: true, sourceKey: "project:sample-stretch", projectId: "sample-stretch" },
    { text: "あとで確認するサンプル", done: true, sourceKey: "wishlist:sample-later" },
  ];
  await prepare(page, fixture);

  await expect(page.locator(".todayRow")).toHaveCount(3);
  await expect(page.locator(".todayRow--complete")).toHaveCount(3);
  await expect(page.getByText("今日の分は完了", { exact: true })).toHaveCount(3);
  await expect(page.locator(".todayRow .todayStartButton")).toHaveCount(0);
  await expect(page.locator(".todayCompletionSummary")).toHaveText("3 / 3 完了");
  await expect(page.getByRole("button", { name: "次の3件を選ぶ" })).toBeVisible();
});

test("P8 Builder selection is a status and not a toggle", async ({ page }) => {
  await prepare(page, createPublicFixture());
  await page.locator(".todayBuilderDisclosure").click();
  const selected = page.locator(".todayBuilderRow", { hasText: "資料を1ページ読む" });
  await expect(selected).toHaveClass(/todayBuilderRow--selected/);
  await expect(selected.locator(".todayBuilderSelectedStatus")).toHaveText("✓ 選択済み");
  await expect(selected.getByRole("button", { name: "今日へ" })).toHaveCount(0);
});

test("P8 Builder omits registration while source bars keep their add actions", async ({ page }) => {
  await prepare(page, createPublicFixture(), 860);
  const disclosure = page.locator(".todayBuilderDisclosure");
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("button", { name: "今日の候補を追加" })).toHaveCount(0);

  await page.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  await expect(disclosure).toHaveAttribute("aria-expanded", "false");
  await expect(page.getByRole("dialog", { name: "プロジェクトを追加" })).toBeVisible();
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "やりたいことを追加", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "やりたいことを追加" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});
