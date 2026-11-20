import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// V151-S2-3: Escape must close the search window even when focus sits outside it (on the page),
// must not close it while Japanese input is composing, and must leave no listener behind.

async function prepare(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
}

async function openSearch(page: Page) {
  const opener = page.locator(".topSearchButton");
  await opener.click();
  const palette = page.locator(".searchPalette");
  await expect(palette).toBeVisible();
  return { opener, palette };
}

test("V151-S2-3 Escape closes the search window when focus is on the page and returns focus", async ({
  page,
}) => {
  await prepare(page);
  const { opener, palette } = await openSearch(page);

  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);

  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(opener).toBeFocused();

  // The window listener is removed when the window closes: a later Escape does nothing.
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("V151-S2-3 Escape during Japanese conversion keeps the search window open", async ({ page }) => {
  await prepare(page);
  const { palette } = await openSearch(page);
  const input = page.locator(".searchPaletteInput");
  await expect(input).toBeFocused();

  await input.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Escape",
        bubbles: true,
        cancelable: true,
        isComposing: true,
      }),
    );
    const legacy = new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    });
    Object.defineProperty(legacy, "keyCode", { value: 229 });
    element.dispatchEvent(legacy);
  });

  await expect(palette).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette).toHaveCount(0);
});
