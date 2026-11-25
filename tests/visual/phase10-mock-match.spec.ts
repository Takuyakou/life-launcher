import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

async function prepare(page: Page, viewport = { width: 1280, height: 900 }) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

test("P10-14d C1 the menu key hints are text and delete items are red", async ({ page }) => {
  await prepare(page);
  await page.locator(".nextStepRow").filter({ hasText: "ストレッチ" }).getByRole("button", {
    name: /の次の一手の操作/,
  }).click();
  const menu = page.getByRole("menu");
  const hint = menu.locator(".contextMenuShortcut").first();
  expect(await hint.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("0px");
  expect(await hint.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    "rgba(0, 0, 0, 0)",
  );
  const danger = menu.locator(".contextMenuDanger").first();
  expect(await danger.evaluate((element) => getComputedStyle(element).color)).not.toBe(
    await menu.locator(".contextMenuItemLabel").first().evaluate(
      (element) => getComputedStyle(element).color,
    ),
  );
});

test("P10-14d K1 keyboard focus shows one yellow ring", async ({ page }) => {
  await prepare(page);
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus-visible").first();
  const outline = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.outlineColor, width: style.outlineWidth, offset: style.outlineOffset };
  });
  expect(outline.color).toContain("255");
  expect(outline.width).toBe("2px");
  expect(outline.offset).toBe("2px");
});
