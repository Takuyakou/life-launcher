import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => VisualQaFixture["config"];
    updateConfig: (config: VisualQaFixture["config"]) => void;
    invokeCalls: Array<{ command: string; args?: unknown }>;
  };
};

async function open(page: Page, fixture: VisualQaFixture = createFullTodayFixture(), width = 1080) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width, height: 760 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".timerDock")).toBeVisible();
}

const dock = (page: Page) => page.locator(".timerDock");

async function startTimer(page: Page) {
  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: /通常タイマー.*分で開始/ })
    .click();
  await expect(dock(page).locator(".timerClock")).not.toHaveText(/分$/);
}

async function setDisplaySize(page: Page, size: "standard" | "large" | "xlarge") {
  await page.evaluate((next) => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    config.settings.mainDisplaySize = next;
    control.updateConfig(config);
  }, size);
  await expect(page.locator(".mainScrollContent")).toHaveAttribute("data-main-display-size", size);
}

async function measure(page: Page) {
  return page.evaluate(() => {
    const dockElement = document.querySelector<HTMLElement>(".timerDock")!;
    const clock = dockElement.querySelector<HTMLElement>(".timerClock")!;
    const footer =
      dockElement.querySelector<HTMLElement>(".timerControls") ??
      dockElement.querySelector<HTMLElement>(".timerPresetRow")!;
    const box = dockElement.getBoundingClientRect();
    return {
      height: Math.round(box.height * 10) / 10,
      clockTop: Math.round((clock.getBoundingClientRect().top - box.top) * 10) / 10,
      footerTop: Math.round((footer.getBoundingClientRect().top - box.top) * 10) / 10,
      footerHeight: Math.round(footer.getBoundingClientRect().height * 10) / 10,
    };
  });
}

for (const size of ["standard", "large", "xlarge"] as const) {
  test(`G7 the idle dock is back to its short Phase 10 shape (${size})`, async ({ page }) => {
    await open(page);
    await setDisplaySize(page, size);
    const sample = await measure(page);
    expect(Math.abs(sample.height - 192)).toBeLessThanOrEqual(2);
    await expect(dock(page).locator(".timerTodaySummary")).toHaveCount(0);
    await expect(dock(page).locator(".timerProgress")).toHaveCount(0);
    const presetButton = (await dock(page).locator(".timerPresetButton").first().boundingBox())!;
    expect(Math.round(presetButton.width)).toBe(32);
    expect(Math.round(presetButton.height)).toBe(32);
    const input = (await dock(page).locator(".timerPresetInputWrap").boundingBox())!;
    expect(Math.round(input.height)).toBe(32);
  });
}

test("G7 a running dock keeps its progress line and 34px controls", async ({ page }) => {
  await open(page);
  await startTimer(page);
  await expect(dock(page).locator(".timerProgress")).toHaveCount(1);
  const controls = (await dock(page).locator(".timerControls").boundingBox())!;
  expect(Math.round(controls.height)).toBeGreaterThanOrEqual(34);
  const paused = dock(page).getByRole("button", { name: "一時停止" });
  expect(Math.round((await paused.boundingBox())!.height)).toBe(34);
});

test("P10-07 the idle dock has the mini button; the other states keep the expand button", async ({
  page,
}) => {
  await open(page);
  const mini = dock(page).getByRole("button", { name: "ミニタイマーにする" });
  await expect(mini).toBeVisible();
  await expect(mini).toHaveAttribute("title", "ミニタイマーにする");
  await expect(dock(page).getByRole("button", { name: "タイマーを大きく表示" })).toHaveCount(0);

  await mini.click();
  const opened = await page.evaluate(
    () =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => {
        const name = call.command.toLowerCase();
        return name.includes("window") || name.includes("webview");
      }).length,
  );
  expect(opened).toBeGreaterThan(0);

  await open(page);
  await page.evaluate(() => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    config.settings.miniMode = false;
    control.updateConfig(config);
  });
  await expect(dock(page).getByRole("button", { name: "ミニタイマーにする" })).toBeDisabled();

  await startTimer(page);
  await expect(dock(page).getByRole("button", { name: "ミニタイマーにする" })).toHaveCount(0);
  await expect(dock(page).getByRole("button", { name: "タイマーを大きく表示" })).toBeVisible();
});

test("P10-07 the main top title is the date now", async ({ page }) => {
  await open(page);
  await expect(page.locator(".topTitle")).toContainText("8月13日");
  await expect(page.locator(".topDateLabel")).toHaveCount(0);
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  await expect(page.locator(".topTitle")).toHaveText("記録");
});

test("P10-07 the idle minutes roll to the new value without leaving an old digit", async ({
  page,
}) => {
  for (const reducedMotion of ["no-preference", "reduce"] as const) {
    await page.emulateMedia({ reducedMotion });
    await open(page);
    const clock = dock(page).locator(".timerClock");
    const before = Number((await clock.textContent())!.replace(/\D/g, ""));
    await dock(page).getByRole("button", { name: "+", exact: true }).click();
    await expect
      .poll(async () => (await clock.textContent())!.replace(/\D/g, ""))
      .toBe(String(before + 5));
    // The old digits are gone; only one copy of each digit remains.
    const digits = await dock(page).locator(".timerClockDigit").count();
    expect(digits).toBe(String(before + 5).length);
    const visible = await dock(page)
      .locator(".timerClockDigit > span")
      .evaluateAll((elements) => elements.filter((el) => getComputedStyle(el).opacity !== "0").length);
    expect(visible).toBe(digits);
  }
});

test("P10-07 a running clock keeps plain text and does not roll", async ({ page }) => {
  await open(page);
  await startTimer(page);
  await expect(dock(page).locator(".timerClockDigit")).toHaveCount(0);
  await expect(dock(page).locator(".timerClock")).toHaveText(/^\d{2}:\d{2}$/);
});
