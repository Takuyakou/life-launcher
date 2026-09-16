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

test.skip("Today3 empty state reserves one row and opens Builder without moving its layout", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  const empty = page.locator(".todayEmptyState");
  await expect(empty.getByText("今日やるものを選びましょう", { exact: true })).toBeVisible();
  await expect(empty.getByText("次の一手・やりたいことから選べます", { exact: true })).toBeVisible();
  const buildButton = empty.getByRole("button", { name: "今日やるものを選ぶ" });
  const projectButton = page.getByRole("button", { name: "プロジェクトを追加", exact: true });
  await expect(buildButton).toHaveClass(/mainActionButton--gold/);
  await expect(projectButton).toHaveClass(/mainActionButton--gold/);
  const actionColors = (button: HTMLElement) => {
    const style = getComputedStyle(button);
    return [style.backgroundColor, style.borderColor, style.color];
  };
  expect(await buildButton.evaluate(actionColors)).toEqual(await projectButton.evaluate(actionColors));
  const beforeHeight = (await page.locator(".todayGrid").boundingBox())!.height;
  expect(beforeHeight).toBeGreaterThanOrEqual(104);
  expect(beforeHeight).toBeLessThan(160);

  await buildButton.click();
  await expect(page.locator(".todayBuilderDisclosure")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".todayPickerRow").first()).toBeFocused();
  expect((await page.locator(".todayGrid").boundingBox())!.height).toBe(beforeHeight);
  await page.locator(".todayPickerRow").first().getByRole("button", { name: "選ぶ" }).click();
  await expect(empty).toHaveCount(0);
  await expect(page.locator(".todayRow")).toHaveCount(1);
  const afterHeight = (await page.locator(".todayGrid").boundingBox())!.height;
  expect(afterHeight).toBeLessThan(260);
  expect(afterHeight).toBe((await page.locator(".todayRow").boundingBox())!.height);
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

test.skip("P8 Builder selection removes Today adoption and supports Undo", async ({ page }) => {
  await prepare(page, createPublicFixture());
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const selected = page.locator(".todayPickerRow", { hasText: "資料を1ページ読む" });
  await expect(selected).toHaveClass(/todayBuilderRow--selected/);
  const selectedButton = selected.getByRole("button", { name: "選択済み" });
  await expect(selectedButton).toHaveText("✓ 今日の3件");
  await expect(selected.getByRole("button", { name: "選ぶ" })).toHaveCount(0);
  const beforeCount = (await currentConfig(page)).today.items.length;
  await selectedButton.click();
  await expect(page.getByText("今日の3件から外しました", { exact: true })).toBeVisible();
  expect((await currentConfig(page)).today.items).toHaveLength(beforeCount - 1);
  await expect(selected.getByRole("button", { name: "選ぶ" })).toBeVisible();
  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(selected.getByRole("button", { name: "選択済み" })).toBeVisible();
  expect((await currentConfig(page)).today.items).toHaveLength(beforeCount);
});

test.skip("P8 Builder omits registration while source bars keep their add actions", async ({ page }) => {
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
