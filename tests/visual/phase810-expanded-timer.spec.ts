import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { mkdir } from "node:fs/promises";

async function prepare(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowStartPrimary")).toBeVisible();
}

test("P8.10 TX-01 manual expand shares timer state and Esc keeps it running", async ({ page }) => {
  await prepare(page);
  await expect(page.getByRole("button", { name: "タイマーを大きく表示" })).toHaveCount(0);
  await page.locator(".doNowStartPrimary").click();
  const expand = page.getByRole("button", { name: "タイマーを大きく表示" });
  await expect(expand).toBeVisible();
  await expand.click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  await expect(overlay).toBeVisible();
  await expect(overlay.locator(".expandedTimerClock")).toHaveText(await page.locator(".timerDock .timerClock").innerText());
  await page.clock.runFor(5_000);
  await expect(overlay.locator(".expandedTimerClock")).toHaveText(await page.locator(".timerDock .timerClock").innerText());
  await overlay.getByRole("button", { name: "一時停止" }).click();
  await expect(overlay.getByText("一時停止中")).toBeVisible();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("一時停止");
  await overlay.getByRole("button", { name: "再開" }).click();
  await expect(overlay.getByText("実行中")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
  await expect(expand).toBeFocused();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
});

test("P8.10 TX-01 overlay traps Tab, closes without backdrop click, and can end timer", async ({ page }) => {
  await prepare(page);
  await page.locator(".doNowStartPrimary").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  const close = overlay.getByRole("button", { name: "拡大表示を閉じる" });
  await expect(close).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(overlay.getByRole("button", { name: "終了" })).toBeFocused();
  await page.locator(".expandedTimerBackdrop").click({ position: { x: 3, y: 3 } });
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: "終了" }).click();
  await expect(overlay).toHaveCount(0);
});

test("P8.10 TX-01 measure mode has no progress bar and fits narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 380 });
  await prepare(page);
  await page.locator(".doNowMeasureButton").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  await expect(overlay.locator(".expandedTimerProgress")).toHaveCount(0);
  await expect(overlay.locator(".expandedTimerClock")).toHaveText("00:00");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const clock = await overlay.locator(".expandedTimerClock").boundingBox();
  expect(clock).not.toBeNull();
  expect(clock!.x).toBeGreaterThanOrEqual(0);
  expect(clock!.x + clock!.width).toBeLessThanOrEqual(430);
});

for (const viewport of [{ width: 430, height: 380 }, { width: 1200, height: 800 }, { width: 1920, height: 1080 }]) {
  test(`P8.10 TX-01 expanded timer fits ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await prepare(page);
    await page.locator(".doNowStartPrimary").click();
    await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
    const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
    for (const selector of [".expandedTimerClock", ".expandedTimerActions", ".expandedTimerClose"]) {
      const box = await overlay.locator(selector).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
      expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    }
    await mkdir("dist/visual-qa", { recursive: true });
    await page.screenshot({ path: `dist/visual-qa/expanded-timer-${viewport.width}.png` });
  });
}
