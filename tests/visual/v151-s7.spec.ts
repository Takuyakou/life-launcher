import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { createFullTodayFixture, createPickerFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// V151-S7: while 「予定時間になりました」 waits, the timer is stopped at the planned end.

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    emit: (event: string, payload?: unknown) => void;
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
  };
};

const TEN_MINUTES = 10 * 60_000;

async function open(page: Page, fixture: VisualQaFixture) {
  fixture.config.projects[0].nextStep!.shortTimerMinutes = 1;
  const now = new Date(FIXTURE_NOW).getTime();
  await page.clock.install({ time: now });
  await page.setViewportSize({ width: 1280, height: 800 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
  // Only the time the test moves with the page clock passes.
  await page.clock.pauseAt(now + 600_000);
}

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "タイマー満了" });
const dockClock = (page: Page) => page.locator(".timerDock .timerClock");

async function startDoNow(page: Page) {
  await page.locator(".doNowStartPrimary").click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
}

async function expire(page: Page) {
  await page.clock.fastForward(60_500);
  await expect(dialogOf(page)).toBeVisible();
}

async function recordedMinutes(page: Page) {
  return page.evaluate(() =>
    (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls
      .filter((call) => call.command === "record_session")
      .map((call) => (call.args.session as { minutes: number }).minutes),
  );
}

async function finish(page: Page) {
  await dialogOf(page).getByRole("button", { name: "終わる" }).click();
  await expect(dialogOf(page)).toHaveCount(0);
}

test("V151-S7 1 waiting 10 minutes on the prompt then 終わる records the planned 1 minute", async ({ page }) => {
  await open(page, createPickerFixture());
  await startDoNow(page);
  await expire(page);
  await page.clock.fastForward(TEN_MINUTES);
  await expect(dialogOf(page)).toBeVisible();
  await finish(page);
  await expect.poll(() => recordedMinutes(page)).toEqual([1]);
});

test("V151-S7 2 続ける(+15分) after waiting 10 minutes gives a full 15 minutes", async ({ page }) => {
  await open(page, createPickerFixture());
  await startDoNow(page);
  await expire(page);
  await page.clock.fastForward(TEN_MINUTES);
  await dialogOf(page).getByRole("button", { name: "続ける(+15分)" }).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(dockClock(page)).toHaveText(/^(15:00|14:59)$/);

  // The prompt does not come back early: 14 minutes later there are still about 60 seconds left.
  await page.clock.fastForward(14 * 60_000);
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(dockClock(page)).toHaveText(/^(01:00|00:59)$/);

  await page.clock.fastForward(60_500);
  await expect(dialogOf(page)).toBeVisible();
  await expect(dialogOf(page).locator(".timerCompleteMinutes")).toHaveText("予定 16分");
  await finish(page);
  await expect.poll(() => recordedMinutes(page)).toEqual([16]);
});

const timerSnapshot = (page: Page) =>
  page.evaluate(() => {
    const line = document.querySelector<HTMLElement>(".windowTimerLine .windowTimerLineFill");
    return {
      dock: document.querySelector<HTMLElement>(".timerDock")?.innerText ?? null,
      expanded: document.querySelector<HTMLElement>(".expandedTimerClock")?.innerText ?? null,
      expandedPanel: document.querySelector<HTMLElement>(".expandedTimerBackdrop")?.innerText ?? null,
      line: line ? line.style.width : null,
    };
  });

test("V151-S7 3 the dock, the expanded timer and the top line stand still while the prompt waits", async ({
  page,
}) => {
  await open(page, createPickerFixture());
  await startDoNow(page);
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toBeVisible();
  await expire(page);
  const before = await timerSnapshot(page);
  expect(before.dock).not.toBeNull();
  expect(before.expanded).not.toBeNull();
  expect(before.line).not.toBeNull();
  await page.clock.fastForward(TEN_MINUTES);
  await expect(dialogOf(page)).toBeVisible();
  expect(await timerSnapshot(page)).toEqual(before);

  // The displays were already capped at 00:00 / 100% before V151-S7; what moved was the hidden
  // elapsed time. After 続ける the expanded timer, the dock and the line show none of the wait.
  await dialogOf(page).getByRole("button", { name: "続ける(+15分)" }).click();
  await expect(dialogOf(page)).toHaveCount(0);
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  await expect(overlay.locator(".expandedTimerClock")).toHaveText(/^(15:00|14:59)$/);
  await expect(dockClock(page)).toHaveText(/^(15:00|14:59)$/);
  // 1 of 16 planned minutes is used: 6.25%.
  const width = await page.evaluate(
    () => document.querySelector<HTMLElement>(".windowTimerLine .windowTimerLineFill")!.style.width,
  );
  expect(Math.abs(Number.parseFloat(width) - 6.25)).toBeLessThanOrEqual(0.2);
});

test("V151-S7 4 a jump of 11 minutes past the end (sleep) still records the planned 1 minute", async ({ page }) => {
  await open(page, createPickerFixture());
  await startDoNow(page);
  await page.clock.fastForward(11 * 60_000);
  await expect(dialogOf(page)).toBeVisible();
  await finish(page);
  await expect.poll(() => recordedMinutes(page)).toEqual([1]);
});

test("V151-S7 5 the mini pause command does nothing while the prompt waits", async ({ page }) => {
  await open(page, createPickerFixture());
  await startDoNow(page);
  await expire(page);
  const badge = page.locator(".timerDock .timerStateBadge");
  const badgeBefore = await badge.innerText();
  expect(badgeBefore).not.toBe("一時停止");
  // The mini window sends this command; in the main window it calls togglePause.
  await page.evaluate(() =>
    (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("mini-timer-command", {
      action: "pause",
    }),
  );
  // The command is handled synchronously by the mock listener; nothing changes.
  await expect(badge).toHaveText(badgeBefore);
  await expect(page.locator(".timerDock").getByRole("button", { name: "再開" })).toHaveCount(0);
  // Continuing still works from the stopped end, as if no pause had been pressed.
  await page.clock.fastForward(TEN_MINUTES);
  await dialogOf(page).getByRole("button", { name: "続ける(+15分)" }).click();
  await expect(dialogOf(page)).toHaveCount(0);
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  await expect(dockClock(page)).toHaveText(/^(15:00|14:59)$/);
});

test("V151-S7 6 a pause before the end is not counted and the prompt wait is not either", async ({ page }) => {
  await open(page, createPickerFixture());
  await startDoNow(page);
  await page.clock.fastForward(20_000);
  const dock = page.locator(".timerDock");
  await dock.getByRole("button", { name: "一時停止" }).click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("一時停止");
  await page.clock.fastForward(3 * 60_000);
  await dock.getByRole("button", { name: "再開" }).click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  await expect(dialogOf(page)).toHaveCount(0);
  await page.clock.fastForward(40_500);
  await expect(dialogOf(page)).toBeVisible();
  await page.clock.fastForward(TEN_MINUTES);
  await finish(page);
  await expect.poll(() => recordedMinutes(page)).toEqual([1]);
});

test("V151-S7 7 the Today3 timer also records only the planned minutes", async ({ page }) => {
  await open(page, createFullTodayFixture());
  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: "短時間タイマー1分で開始" })
    .click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  await expire(page);
  await page.clock.fastForward(TEN_MINUTES);
  await finish(page);
  await expect.poll(() => recordedMinutes(page)).toEqual([1]);
});

// V151-S7 (ANSWER 案 A): the search selection survives the App's re-renders. ---------------

async function openSearchWhileRunning(page: Page) {
  await open(page, createFullTodayFixture());
  await page.locator(".doNowStartPrimary").click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  await page.keyboard.press("Control+f");
  const palette = page.getByRole("dialog", { name: "検索" });
  await palette.getByRole("combobox").fill("サンプル");
  await expect(palette.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  return palette;
}

test("V151-S7 search keeps the ↓ selection while a running timer re-renders the App", async ({ page }) => {
  const palette = await openSearchWhileRunning(page);
  const second = palette.getByRole("option").nth(1);
  await expect(second).toHaveText("あとで確認するサンプル");
  await page.keyboard.press("ArrowDown");
  await expect(second).toHaveAttribute("aria-selected", "true");
  // The timer ticks every second; each tick re-renders the App and rebuilt the search sections.
  await page.clock.runFor(3_000);
  await expect(second).toHaveAttribute("aria-selected", "true");
  await expect(palette.getByRole("option").first()).toHaveAttribute("aria-selected", "false");
  // Enter runs the second entry: the unsorted wishlist item opens 次の一手を設定 (the first
  // entry, a Next Step, would start its timer instead).
  await page.keyboard.press("Enter");
  await expect(palette).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "次の一手を設定" })).toBeVisible();
});

test("V151-S7 search still returns to the first row when the listed entries change", async ({ page }) => {
  const palette = await openSearchWhileRunning(page);
  await page.keyboard.press("ArrowDown");
  await expect(palette.getByRole("option").nth(1)).toHaveAttribute("aria-selected", "true");
  await palette.getByRole("combobox").fill("サンプル資");
  await expect(palette.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
  await page.clock.runFor(2_000);
  await expect(palette.getByRole("option").first()).toHaveAttribute("aria-selected", "true");
});
