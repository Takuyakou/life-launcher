import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaControl = {
  currentConfig: () => VisualQaFixture["config"];
  updateConfig: (config: VisualQaFixture["config"]) => void;
};
type QaWindow = Window & { __LIFE_LAUNCHER_VISUAL_QA__: QaControl };

async function open(page: Page, fixture: VisualQaFixture = createFullTodayFixture(), width = 1200) {
  await page.setViewportSize({ width, height: 680 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".topBar")).toBeVisible();
}

const topBar = (page: Page) => page.locator(".topBar");
const autoStartButton = (page: Page) =>
  topBar(page).getByRole("button", { name: "Windows自動起動" });

test("P10-02 the top bar has no Mini or Guide button", async ({ page }) => {
  await open(page);
  await expect(topBar(page).getByRole("button", { name: "ミニタイマーへ切り替え" })).toHaveCount(0);
  await expect(topBar(page).getByRole("button", { name: "使い方", exact: true })).toHaveCount(0);
  // The remaining three buttons are the view toggle, the instructions and the settings.
  const names = await topBar(page)
    .locator(".topPillGroup--work > button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label")));
  expect(names).toEqual(["記録ビューを開く", "手順書を開く", "設定を開く"]);
});

test("P10-02 the auto-start button is icon-only and shows its state", async ({ page }) => {
  await open(page);
  const button = autoStartButton(page);
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button).toHaveAttribute("title", "Windows自動起動: OFF");
  await expect(button.locator(".viewToggleButtonLabel")).toHaveCount(0);
  await expect(button).not.toContainText("自動起動");
  await expect(button.locator(".autoStartDot")).toHaveCount(0);
  const offColor = await button
    .locator(".uiIcon")
    .evaluate((icon) => getComputedStyle(icon).color);
  expect(offColor).toBe("rgb(184, 176, 160)");

  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(button).toHaveAttribute("title", "Windows自動起動: ON");
  await expect(button.locator(".autoStartDot")).toHaveCount(1);
  const onColor = await button
    .locator(".uiIcon")
    .evaluate((icon) => getComputedStyle(icon).color);
  expect(onColor).toBe("rgb(111, 207, 151)");
  await expect(page.locator(".topPillGroup--autostart")).toHaveAttribute("aria-label", "自動起動");
  await expect(page.locator(".topPillGroup--work")).toHaveAttribute(
    "aria-label",
    "記録 / 手順書 / 設定",
  );

  await button.click();
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button).toHaveAttribute("title", "Windows自動起動: OFF");
  await expect(button.locator(".autoStartDot")).toHaveCount(0);
});

test("P10-02 the guide opens from the Settings dialog and returns to Settings", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();
  await settings.getByRole("button", { name: "使い方を開く" }).click();
  await expect(page.getByRole("dialog", { name: "使い方" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "使い方" })).toHaveCount(0);
  // The guide sits above Settings, so closing it comes back to Settings (D5).
  await expect(settings).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(settings).toHaveCount(0);
});

test("P10-02 F1 opens the guide only when nothing else is open and the dictionary key is not F1", async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press("F1");
  await expect(page.getByRole("dialog", { name: "使い方" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "使い方" })).toHaveCount(0);

  // A dialog swallows F1.
  await page.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  await page.keyboard.press("F1");
  await expect(page.getByRole("dialog", { name: "使い方" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "設定" })).toHaveCount(0);

  // When the dictionary hotkey is exactly F1, the dictionary wins and the guide stays shut.
  await page.evaluate(() => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    config.settings.launcherHotkey = "F1";
    control.updateConfig(config);
  });
  // The badge follows the stored key, so it proves the new value reached the app.
  await expect(page.locator(".launcherOpenButton .uiKey")).toContainText("F1");
  await page.keyboard.press("F1");
  await expect(page.getByRole("dialog", { name: "使い方" })).toHaveCount(0);
});

test("P10-02 the empty middle of the top bar still drags the window", async ({ page }) => {
  await open(page);
  const middle = await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>(".topBar")!;
    const brand = bar.querySelector<HTMLElement>(".topBrand")!;
    const search = bar.querySelector<HTMLElement>(".topSearchButton")!;
    const brandRight = brand.getBoundingClientRect().right;
    const searchLeft = search.getBoundingClientRect().left;
    const y = bar.getBoundingClientRect().top + bar.getBoundingClientRect().height / 2;
    const x = brandRight + (searchLeft - brandRight) / 2;
    const hit = document.elementFromPoint(x, y);
    return {
      width: searchLeft - brandRight,
      insideDragRegion: hit !== null && hit.closest("[data-tauri-drag-region]") !== null,
      hitClass: hit?.className?.toString() ?? "",
    };
  });
  expect(middle.width).toBeGreaterThan(10);
  expect(middle.insideDragRegion).toBe(true);
});
