import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function open(page: Page, reducedMotion: "no-preference" | "reduce" = "no-preference") {
  await page.emulateMedia({ reducedMotion });
  await page.setViewportSize({ width: 1080, height: 680 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createFullTodayFixture(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".sidebar")).toBeVisible();
}

/** The "資料" group (one button) in the fixture. */
const group = (page: Page) => page.locator(".quickGroup", { hasText: "資料" }).first();
const header = (page: Page) => group(page).locator(".quickGroupHeader");

test("P10-02 opening a sidebar group ends at the height of its items", async ({ page }) => {
  await open(page);
  await expect(header(page)).toHaveAttribute("aria-expanded", "true");
  await header(page).focus();
  await page.keyboard.press("Enter");
  await expect(header(page)).toHaveAttribute("aria-expanded", "false");
  await expect(group(page).locator(".quickGroupItems")).toHaveCount(0);

  await page.keyboard.press("Enter");
  await expect(header(page)).toHaveAttribute("aria-expanded", "true");
  await expect
    .poll(async () => {
      const items = group(page).locator(".quickGroupItems");
      const box = await items.boundingBox();
      const content = await items.evaluate((element) => element.scrollHeight);
      return box ? Math.abs(box.height - content) : 999;
    })
    .toBeLessThanOrEqual(1);
  await expect(group(page).getByRole("button", { name: "サンプル資料" })).toBeVisible();
  const opacity = await group(page)
    .locator(".quickButtonDrag")
    .first()
    .evaluate((element) => getComputedStyle(element).opacity);
  expect(Number(opacity)).toBe(1);
});

test("P10-02 a closed sidebar group keeps its buttons out of the tab order", async ({ page }) => {
  await open(page);
  await header(page).focus();
  await page.keyboard.press("Enter");
  await expect(header(page)).toHaveAttribute("aria-expanded", "false");
  // The spring finishes and the items leave the DOM (so they cannot be tabbed to).
  await expect(group(page).locator(".quickGroupItems")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "サンプル資料" })).toHaveCount(0);
  for (let step = 0; step < 12; step += 1) {
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => document.activeElement?.textContent ?? "");
    expect(focused).not.toContain("サンプル資料");
  }
});
test("P10-02 reduced motion still ends with the same open and closed shape", async ({ page }) => {
  await open(page, "reduce");
  const heightWhileOpen = (await group(page).locator(".quickGroupItems").boundingBox())!.height;
  await header(page).focus();
  await page.keyboard.press("Enter");
  await expect(header(page)).toHaveAttribute("aria-expanded", "false");
  await expect(group(page).locator(".quickGroupItems")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(header(page)).toHaveAttribute("aria-expanded", "true");
  await expect
    .poll(async () => (await group(page).locator(".quickGroupItems").boundingBox())?.height ?? 0)
    .toBeGreaterThan(0);
  const heightAfter = (await group(page).locator(".quickGroupItems").boundingBox())!.height;
  expect(Math.abs(heightAfter - heightWhileOpen)).toBeLessThanOrEqual(1);
});
