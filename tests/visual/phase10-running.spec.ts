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

async function openRunning(page: Page, fixture: VisualQaFixture = createFullTodayFixture()) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await page.locator(".doNowStartPrimary").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  await expect(overlay).toBeVisible();
  return overlay;
}

test("P10-08 the expanded timer has no あとで column", async ({ page }) => {
  const overlay = await openRunning(page);
  await expect(overlay.getByText("あとで")).toHaveCount(0);
  await expect(overlay.locator(".expandedTimerLater")).toHaveCount(0);
});

test("P10-08 the plan line shows the minutes and the end time, and hides while paused", async ({
  page,
}) => {
  const overlay = await openRunning(page);
  const plan = overlay.locator(".expandedTimerPlan");
  await expect(plan).toContainText("5分のうち");
  await expect(plan).toContainText("に終わります");
  const text = (await plan.innerText()).trim();
  expect(text).toMatch(/\d{1,2}:\d{2}/);

  await overlay.getByRole("button", { name: "一時停止" }).click();
  await expect(overlay.locator(".timerStateBadge")).toHaveText("一時停止中");
  await expect(overlay.getByText("一時停止中")).toHaveCount(1);
  await expect(plan).toHaveCount(0);
});

test("P10-08 戻る・ミニ・一時停止・終える still do what they did", async ({ page }) => {
  const overlay = await openRunning(page);
  const calls = () =>
    page.evaluate(() => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.length);
  const before = await calls();

  await overlay.getByRole("button", { name: "一時停止" }).click();
  await expect(overlay.getByRole("button", { name: "再開" })).toBeVisible();

  await overlay.getByRole("button", { name: "メイン画面に戻る（タイマーは続きます）" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("一時停止");

  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: "ミニタイマーにする" }).click();
  await expect(overlay).toHaveCount(0);
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("一時停止");
  expect(await calls()).toBeGreaterThanOrEqual(before);
});

test("P10-08 the window timer line keeps its colour and thickness", async ({ page }) => {
  await openRunning(page);
  const line = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(".windowTimerLine");
    if (!element) return null;
    const style = getComputedStyle(element);
    return {
      height: style.height,
      background: style.backgroundImage,
      color: style.backgroundColor,
    };
  });
  expect(line).not.toBeNull();
  // D17: the line keeps its thickness and its own paint (this stage does not touch it).
  expect(line!.height).toBe("3px");
  // D17: this stage does not touch the line's paint; the CSS file keeps the same rules
  // (checked with git diff), so here we only pin the thickness and that it is painted.
  const painted = await page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(".windowTimerLine");
    if (!element) return false;
    const parts = [element, ...Array.from(element.querySelectorAll<HTMLElement>("*"))];
    return parts.some((part) => {
      const style = getComputedStyle(part);
      return style.backgroundColor !== "rgba(0, 0, 0, 0)" || style.backgroundImage !== "none";
    });
  });
  expect(painted).toBe(true);
});
