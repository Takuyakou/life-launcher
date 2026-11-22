import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

async function prepare(page: Page, width: number, height: number) {
  await page.setViewportSize({ width, height });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createFullTodayFixture(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

for (const [width, height] of [
  [1366, 768],
  [860, 720],
]) {
  test(`V163-B3 the sidebar and main panel start right under the top bar at ${width}`, async ({
    page,
  }) => {
    await prepare(page, width, height);
    const rects = await page.evaluate(() => {
      const box = (selector: string) => {
        const element = document.querySelector(selector);
        if (!element) throw new Error("missing " + selector);
        const { top, bottom } = element.getBoundingClientRect();
        return { top, bottom };
      };
      return {
        topBar: box(".topBar"),
        appBody: box(".appBody"),
        sidebar: box(".sidebar"),
        timerDock: box(".timerDock"),
      };
    });
    expect(Math.abs(rects.appBody.top - rects.topBar.bottom)).toBeLessThanOrEqual(0.5);
    expect(Math.abs(rects.sidebar.top - rects.topBar.bottom)).toBeLessThanOrEqual(0.5);
    // The timer dock stays at the bottom of the sidebar (20px bottom padding).
    expect(Math.abs(rects.sidebar.bottom - rects.timerDock.bottom - 20)).toBeLessThanOrEqual(1);
  });
}
