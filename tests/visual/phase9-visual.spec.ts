import { expect, test, type Page } from "@playwright/test";
import {
  createFullTodayFixture,
  createPickerFixture,
  createRunningFixture,
  FIXTURE_NOW,
  type VisualQaFixture,
} from "./fixtures";
import { installTauriMock } from "./tauriMock";

// Same-machine renders are pixel-identical; the ratio only absorbs font rasterization drift
// between this machine and the windows-latest CI runner.
const SCREENSHOT_OPTIONS = {
  maxDiffPixelRatio: 0.001,
  animations: "disabled",
  caret: "hide",
} as const;

const MAIN_SIZE = { width: 1080, height: 680 };
const MIN_SIZE = { width: 860, height: 560 };
const MINI_SIZE = { width: 288, height: 136 };

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: { emit: (event: string, payload?: unknown) => void };
};

async function open(
  page: Page,
  fixture: VisualQaFixture,
  size: { width: number; height: number },
  route = "/",
  windowLabel = "main",
) {
  const now = new Date(FIXTURE_NOW).getTime();
  await page.setViewportSize(size);
  // A paused clock makes the Timer display deterministic; time only moves with runFor.
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1_000);
  await installTauriMock(page, fixture, windowLabel);
  await page.goto(route);
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({
    content:
      "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;cursor:none!important}",
  });
}

async function startTimer(page: Page) {
  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: "通常タイマー25分で開始" })
    .click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  await page.clock.runFor(5_000);
}

const mainCases: Array<[string, "standard" | "large" | "xlarge", typeof MAIN_SIZE]> = [
  ["main-standard", "standard", MAIN_SIZE],
  ["main-large", "large", MAIN_SIZE],
  ["main-xlarge", "xlarge", MAIN_SIZE],
  ["main-min", "standard", MIN_SIZE],
];

for (const [name, displaySize, size] of mainCases) {
  test(`P9-00 visual ${name}`, async ({ page }) => {
    const fixture = createFullTodayFixture();
    fixture.config.settings.mainDisplaySize = displaySize;
    await open(page, fixture, size);
    await expect(page.locator(".doNowBand")).toBeVisible();
    await expect(page).toHaveScreenshot(`${name}.png`, SCREENSHOT_OPTIONS);
  });
}

test("P9-00 visual main-running", async ({ page }) => {
  await open(page, createRunningFixture(), MAIN_SIZE);
  await startTimer(page);
  await expect(page).toHaveScreenshot("main-running.png", SCREENSHOT_OPTIONS);
});

test("P9-00 visual timer-expanded", async ({ page }) => {
  await open(page, createRunningFixture(), MAIN_SIZE);
  await startTimer(page);
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toBeVisible();
  await expect(page).toHaveScreenshot("timer-expanded.png", SCREENSHOT_OPTIONS);
});

test("P9-00 visual today-picker", async ({ page }) => {
  await open(page, createPickerFixture(), MAIN_SIZE);
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  await expect(page.getByRole("dialog", { name: "今日やるものを選ぶ" })).toBeVisible();
  await expect(page).toHaveScreenshot("today-picker.png", SCREENSHOT_OPTIONS);
});

test("P9-00 visual settings-basic", async ({ page }) => {
  await open(page, createFullTodayFixture(), MAIN_SIZE);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings.getByRole("tab", { name: "基本" }).click();
  await expect(page).toHaveScreenshot("settings-basic.png", SCREENSHOT_OPTIONS);
});

test("P9-00 visual mini-idle", async ({ page }) => {
  await open(page, createFullTodayFixture(), MINI_SIZE, "/?view=mini", "life-launcher-mini");
  await expect(page).toHaveScreenshot("mini-idle.png", SCREENSHOT_OPTIONS);
});

test("P9-00 visual mini-running", async ({ page }) => {
  await open(page, createRunningFixture(), MINI_SIZE, "/?view=mini", "life-launcher-mini");
  // The mini window only renders snapshots the main window emits.
  await page.evaluate(() =>
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("mini-timer-snapshot", {
      active: true,
      label: "サンプル学習",
      actionText: "資料を1ページ読む",
      mode: "countdown",
      remainingClock: "24:55",
      paused: false,
      progressPercent: 0.33,
      projectId: "sample-learning",
      projectName: "サンプル学習",
      projectColorId: "blue",
    }),
  );
  await expect(page.getByText("24:55")).toBeVisible();
  await expect(page).toHaveScreenshot("mini-running.png", SCREENSHOT_OPTIONS);
});

for (const [name, tab] of [
  ["records-review", "ふりかえり"],
  ["records-week", "今週を決める"],
  ["records-all", "すべての記録"],
] as const) {
  test(`P9-00 visual ${name}`, async ({ page }) => {
    await open(page, createFullTodayFixture(), MAIN_SIZE);
    await page.getByRole("button", { name: "記録ビューを開く" }).click();
    const records = page.locator(".recordsView");
    await records.getByRole("tab", { name: tab }).click();
    await expect(records.getByRole("tab", { name: tab })).toHaveAttribute("aria-selected", "true");
    await expect(page).toHaveScreenshot(`${name}.png`, SCREENSHOT_OPTIONS);
  });
}
