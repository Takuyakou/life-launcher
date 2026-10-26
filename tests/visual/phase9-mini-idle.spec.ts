import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: { emit: (event: string, payload?: unknown) => void };
};

const MINI = { width: 288, height: 136 };

async function openMini(page: Page) {
  await page.setViewportSize(MINI);
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createFullTodayFixture(), "life-launcher-mini");
  await page.goto("/?view=mini");
  await expect(page.locator(".miniShell")).toBeVisible();
}

async function expectNoOverlapInsideWindow(page: Page, selectors: string[]) {
  const boxes = [];
  for (const selector of selectors) {
    const box = await page.locator(`.timerPanel--mini ${selector}`).first().boundingBox();
    expect(box, selector).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(MINI.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(MINI.height);
    boxes.push({ selector, ...box! });
  }
  for (const [index, a] of boxes.entries()) {
    for (const b of boxes.slice(index + 1)) {
      const overlaps =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlaps, `${a.selector} overlaps ${b.selector}`).toBe(false);
    }
  }
  expect(await page.locator(".miniShell").evaluate((el) => el.scrollHeight <= el.clientHeight)).toBe(
    true,
  );
}

test("P9-03 idle mini shows a heading, one waiting badge and a hint without overlap", async ({
  page,
}) => {
  await openMini(page);
  const panel = page.locator(".timerPanel--mini");
  await expect(panel.locator(".timerMeta span")).toHaveText("タイマー");
  await expect(panel.locator(".timerStateBadge")).toHaveText("待機中");
  await expect(panel.locator(".miniQuietText")).toHaveText("開始ボタンから計測できます");
  // "待機中" appears exactly once, and the idle mini has no clock or progress to disagree
  // with the main window's planned minutes.
  await expect(page.getByText("待機中")).toHaveCount(1);
  await expect(panel.locator(".timerClock")).toHaveCount(0);
  await expect(panel.locator(".timerProgress")).toHaveCount(0);
  await expect(panel.locator(".timerControls")).toHaveCount(0);
  await expectNoOverlapInsideWindow(page, [".timerMeta span", ".timerStateBadge", ".miniQuietText"]);
});

test("P9-03 running and paused mini keep the P9-02 layout", async ({ page }) => {
  await openMini(page);
  const emit = (paused: boolean) =>
    page.evaluate((isPaused) => {
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
  const parts = [".projectIdentity", ".timerActionText", ".timerStateBadge", ".timerClock", ".timerControls"];

  await emit(false);
  await expect(panel.locator(".timerStateBadge")).toHaveText("実行中");
  await expect(panel.locator(".timerActionText")).toHaveText("資料を1ページ読む");
  await expect(panel.locator(".timerClock")).toHaveText("24:55");
  await expectNoOverlapInsideWindow(page, parts);

  await emit(true);
  await expect(panel.locator(".timerStateBadge")).toHaveText("一時停止中");
  await expect(panel.getByRole("button", { name: "再開" })).toBeVisible();
  await expectNoOverlapInsideWindow(page, parts);
});
