import { expect, test } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V163-C6: the app's text fields do not offer the browser's own list of values typed before
// (it grew forever and could not be cleared from the app). The source contract is checked by
// input-autocomplete-contract.spec.ts; this one checks the real attribute on the main screen.

test("V163-C6 the main screen's text fields opt out of the browser's saved values", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1366, height: 768 });
  await installTauriMock(page, createFullTodayFixture(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();

  // 今日の勝利条件: the field the user reported (a list of wrong values kept coming back).
  // The field is an input only while it is being edited.
  await page.getByRole("button", { name: "今日の勝利条件を編集" }).click();
  const victory = page.locator("input[aria-label='今日の勝利条件']");
  await expect(victory).toBeVisible();
  await expect(victory).toHaveAttribute("autocomplete", "off");

  // Every other text field on the screen opts out too.
  const missing = await page.evaluate(() => {
    const skip = new Set(["checkbox", "radio", "range", "file", "color"]);
    return Array.from(document.querySelectorAll<HTMLInputElement>("input, textarea"))
      .filter((field) => field.tagName === "TEXTAREA" || !skip.has(field.type))
      .filter((field) => field.getAttribute("autocomplete") !== "off")
      .map((field) => `${field.tagName}:${field.getAttribute("aria-label") ?? field.className}`);
  });
  expect(missing).toEqual([]);
});
