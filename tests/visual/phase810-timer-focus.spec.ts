import { expect, test } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test("Timer stepper retains focus without highlighting Do Now", async ({ page }) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1180, height: 760 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await page.evaluate(() => {
    const runtime = window as Window & {
      __TAURI_INTERNALS__: {
        invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
    const invoke = runtime.__TAURI_INTERNALS__.invoke;
    runtime.__TAURI_INTERNALS__.invoke = async (command, args) => {
      const result = await invoke(command, args);
      return command === "save_config" ? JSON.parse(JSON.stringify(result)) : result;
    };
  });
  const doNowStart = page.locator(".doNowStartPrimary");
  await expect(doNowStart).toBeVisible();
  await doNowStart.focus();
  const projectDisclosure = page.locator(".projectsBand .disclosure");
  if ((await projectDisclosure.getAttribute("aria-expanded")) === "false") {
    await projectDisclosure.click();
  }
  const nextStepCard = page.locator(".nextStepCard").first();
  await expect(nextStepCard).toBeVisible();
  await nextStepCard.focus();
  const timer = page.locator(".timerDock");
  await expect(timer).toHaveCSS("user-select", "none");
  await expect(timer.getByRole("spinbutton", { name: "通常タイマーの分数" })).toHaveCSS(
    "user-select", "none",
  );
  const plus = timer.locator(".timerPresetButton").last();
  await plus.click();
  await expect(page.locator(".timerDock .timerPresetInputWrap input")).toHaveValue("30");
  await expect(plus).toBeFocused();
  await expect(page.getByText(/通常タイマーを\d+分にしました/)).toHaveCount(0);
  await expect(nextStepCard).not.toBeFocused();
  await expect(nextStepCard).not.toHaveCSS("border-color", "rgb(112, 167, 255)");

  const minus = page.locator(".timerDock .timerPresetButton").first();
  await nextStepCard.focus();
  await minus.click();
  await expect(page.locator(".timerDock .timerPresetInputWrap input")).toHaveValue("25");
  await expect(minus).toBeFocused();

  const inboxDisclosure = page.locator(".inboxBand .disclosure");
  if ((await inboxDisclosure.getAttribute("aria-expanded")) === "false") {
    await inboxDisclosure.click();
  }
  const inboxRow = page.locator(".inboxRow[data-inbox-id]").first();
  await inboxRow.focus();
  await plus.click();
  await expect(plus).toBeFocused();
  await expect(inboxRow).not.toBeFocused();

  await nextStepCard.focus();
  await expect(nextStepCard).toBeFocused();
});
