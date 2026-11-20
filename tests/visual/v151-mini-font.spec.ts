import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V151-S2-4: the mini clock uses the bundled font (P10-18e). While that font is still loading, the
// digits and the action text or the buttons must not overlap, neither before nor after the load.

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: { emit: (event: string, payload?: unknown) => void };
};

const MINI = { width: 340, height: 120 };

async function openMini(page: Page) {
  await page.setViewportSize(MINI);
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createFullTodayFixture(), "life-launcher-mini");
  await page.goto("/?view=mini");
  await waitForBundledFonts(page);
  await expect(page.locator(".miniShell")).toBeVisible();
}

async function emitRunning(page: Page, paused: boolean) {
  await page.evaluate((isPaused) => {
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("mini-timer-snapshot", {
      active: true,
      label: "サンプル学習",
      actionText: "資料を1ページ読む",
      mode: "countdown",
      remainingClock: "24:55",
      paused: isPaused,
      progressPercent: 1,
      projectId: "sample-learning",
      projectName: "サンプル学習",
      projectColorId: "blue",
    });
  }, paused);
  const panel = page.locator(".timerPanel--mini");
  await expect(panel.locator(".timerStateBadge")).toHaveText(paused ? "一時停止中" : "実行中");
  await expect(panel.locator(".timerClock")).toHaveText("24:55");
}

async function expectNoOverlap(page: Page, state: string) {
  const boxes = await page.evaluate((selectors) => {
    return selectors.map((selector) => {
      const element = document.querySelector(`.timerPanel--mini ${selector}`);
      if (!element) throw new Error(`missing ${selector}`);
      const rect = element.getBoundingClientRect();
      return {
        selector,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
      };
    });
  }, [".miniProjectLine", ".timerActionText", ".timerClock", ".timerControls"]);

  for (const box of boxes) {
    expect(box.left, `${state}: ${box.selector} left`).toBeGreaterThanOrEqual(0);
    expect(box.top, `${state}: ${box.selector} top`).toBeGreaterThanOrEqual(0);
    expect(box.right, `${state}: ${box.selector} right`).toBeLessThanOrEqual(MINI.width);
    expect(box.bottom, `${state}: ${box.selector} bottom`).toBeLessThanOrEqual(MINI.height);
  }
  for (const [index, first] of boxes.entries()) {
    for (const second of boxes.slice(index + 1)) {
      const overlaps =
        first.left < second.right &&
        second.left < first.right &&
        first.top < second.bottom &&
        second.top < first.bottom;
      expect(overlaps, `${state}: ${first.selector} overlaps ${second.selector}`).toBe(false);
    }
  }
  expect(
    await page.locator(".miniShell").evaluate((element) => element.scrollHeight <= element.clientHeight),
    `${state}: the mini window must not scroll`,
  ).toBe(true);
}

test("V151-S2-4 the mini clock never overlaps the other parts while its font loads", async ({
  page,
}) => {
  // Keep the bundled font from loading. The clock must still keep its place with the fallback font.
  await page.route("**/*.woff2", (route) => route.abort());
  await openMini(page);
  await emitRunning(page, false);
  await expectNoOverlap(page, "font blocked, running");
  await emitRunning(page, true);
  await expectNoOverlap(page, "font blocked, paused");

  // Let the font load, wait for it, and check the same layout again.
  await page.unroute("**/*.woff2");
  await page.reload();
  await expect(page.locator(".miniShell")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await emitRunning(page, false);
  await expectNoOverlap(page, "font loaded, running");
  await emitRunning(page, true);
  await expectNoOverlap(page, "font loaded, paused");
});
