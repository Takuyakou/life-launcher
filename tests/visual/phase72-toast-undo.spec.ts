import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test.describe.configure({ mode: "serial" });

async function prepare(page: Page, fixture: VisualQaFixture = createPublicFixture(), width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function removeFirstToday(page: Page) {
  await page.locator(".todayRow").first().getByRole("button", { name: "今日の3件から外す" }).click();
  const toast = page.locator(".toast", { hasText: "今日の3件から外しました" }).last();
  await expect(toast).toBeVisible();
  return toast;
}

test("P72-02 remove Undo restores one snapshot while preserving later order and settings", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items.push({ text: "第三の項目", done: false, sourceKey: "manual:third" });
  await prepare(page, fixture);
  const toast = await removeFirstToday(page);

  await page.evaluate(() => {
    const qa = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          currentConfig: () => AppConfig;
          updateConfig: (config: AppConfig) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    const current = structuredClone(qa.currentConfig());
    current.today.items.reverse();
    current.settings.backupKeep = 17;
    qa.updateConfig(current);
  });
  await toast.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.locator(".toast", { hasText: "元に戻しました" })).toBeVisible();
  const config = await currentConfig(page);
  expect(config.settings.backupKeep).toBe(17);
  expect(config.today.items.map((item) => item.sourceKey)).toEqual([
    "manual:third",
    "project:sample-learning",
    "manual:fixture-cleanup",
  ]);
  expect(config.today.items[1].done).toBe(false);
});

test("P72-02 candidate exclusion Undo restores Builder only when no Today item was removed", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);
  await page.locator(".todayBuilderDisclosure").click();
  const candidate = page.locator(".todayBuilderRow", { hasText: "資料を1ページ読む" });
  await candidate.locator(".sourceRowMenu").click();
  await page.getByRole("menuitem", { name: "今日の候補から外す" }).click();
  const toast = page.locator(".toast", { hasText: "今日の候補から外しました" });
  await toast.getByRole("button", { name: "元に戻す" }).click();
  const config = await currentConfig(page);
  expect(config.today.items).toEqual([]);
  expect(config.today.candidateExcludedSourceKeys).not.toContain("project:sample-learning");
  await expect(page.locator(".todayBuilderRow", { hasText: "資料を1ページ読む" })).toBeVisible();
});

test("P72-02 conflicted Undo is retryable and a double click invokes it once", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const toast = await removeFirstToday(page);
  await page.evaluate(() => {
    const qa = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          currentConfig: () => AppConfig;
          updateConfig: (config: AppConfig) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    const current = structuredClone(qa.currentConfig());
    current.today.items.push(
      { text: "追加1", done: false, sourceKey: "manual:new-1" },
      { text: "追加2", done: false, sourceKey: "manual:new-2" },
    );
    qa.updateConfig(current);
  });
  const undo = toast.getByRole("button", { name: "元に戻す" });
  await undo.click();
  await expect(page.locator(".toast", { hasText: "元に戻せません" })).toBeVisible();
  await expect(undo).toBeEnabled();

  await page.evaluate(() => {
    const qa = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          currentConfig: () => AppConfig;
          updateConfig: (config: AppConfig) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    const current = structuredClone(qa.currentConfig());
    current.today.items.pop();
    qa.updateConfig(current);
  });
  await undo.dblclick();
  await expect(page.locator(".toast", { hasText: "元に戻しました" })).toBeVisible();
  const calls = await page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string }> };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
      (call) => call.command === "undo_today_selection",
    ).length,
  );
  expect(calls).toBe(2);
});

test("P72-02 Undo lifetime pauses while hover or focus remains", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const toast = await removeFirstToday(page);
  const undo = toast.getByRole("button", { name: "元に戻す" });
  await toast.hover();
  await undo.focus();
  await page.mouse.move(1, 1);
  await page.clock.fastForward(9_000);
  await expect(toast).toBeVisible();
  await page.locator(".todayBuilderDisclosure").focus();
  await page.clock.fastForward(7_900);
  await expect(toast).toBeVisible();
  await page.clock.fastForward(400);
  await expect(toast).toHaveCount(0);
});

test("P72-02 document hidden pauses the remaining Undo time", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const toast = await removeFirstToday(page);
  await page.clock.fastForward(3_000);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(12_000);
  await expect(toast).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(4_900);
  await expect(toast).toBeVisible();
  await page.clock.fastForward(400);
  await expect(toast).toHaveCount(0);
});

test("P72-02 keeps at most three visible Toasts and starts queued Undo on promotion", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [
    { text: "A", done: false, sourceKey: "manual:a" },
    { text: "B", done: false, sourceKey: "manual:b" },
    { text: "C", done: false, sourceKey: "manual:c" },
  ];
  await prepare(page, fixture, 860);
  for (let index = 0; index < 3; index += 1) await removeFirstToday(page);
  await page.locator(".todayBuilderDisclosure").click();
  await page.locator(".todayBuilderRow").first().locator(".sourceRowMenu").click();
  await page.getByRole("menuitem", { name: "今日の候補から外す" }).click();
  await expect(page.locator(".toast")).toHaveCount(3);
  await page.clock.fastForward(7_000);
  await page.locator(".toast").first().getByRole("button", { name: "通知を閉じる" }).click();
  await page.clock.fastForward(200);
  await expect(page.locator(".toast", { hasText: "今日の候補から外しました" })).toBeVisible();
  await page.clock.fastForward(7_900);
  await expect(page.locator(".toast", { hasText: "今日の候補から外しました" })).toBeVisible();
});
