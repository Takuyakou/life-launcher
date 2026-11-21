import { expect, test } from "@playwright/test";
import { createPublicFixture } from "./fixtures";
import { waitForBundledFonts } from "./bundledFonts";
import { installTauriMock } from "./tauriMock";

test("V160-B5 the records tabs never overflow while the tab band moves", async ({ page }) => {
  await page.setViewportSize({ width: 860, height: 560 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".sidebar")).toBeVisible();

  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  const reviewTab = page.getByRole("tab", { name: "ふりかえり" });
  const allTab = page.getByRole("tab", { name: "すべての記録" });
  await expect(reviewTab).toBeVisible();
  await expect(reviewTab).toHaveAttribute("aria-selected", "true");

  await page.evaluate(() => {
    const state = { frames: 0, found: 0, max: 0, maxPageOverflow: 0 };
    (window as unknown as { __recordsTabOverflow: typeof state }).__recordsTabOverflow = state;
    const tick = () => {
      const tabs = document.querySelector<HTMLElement>(".recordsTabs");
      if (tabs) {
        state.found += 1;
        state.max = Math.max(state.max, tabs.scrollWidth - tabs.clientWidth);
      }
      const pageElement = document.scrollingElement;
      if (pageElement) {
        state.maxPageOverflow = Math.max(
          state.maxPageOverflow,
          pageElement.scrollWidth - pageElement.clientWidth,
        );
      }
      state.frames += 1;
      if (state.frames < 240) window.requestAnimationFrame(tick);
    };
    window.requestAnimationFrame(tick);
  });

  await allTab.click();
  await expect(allTab).toHaveAttribute("aria-selected", "true");
  await page.waitForFunction(
    () =>
      (window as unknown as { __recordsTabOverflow: { frames: number } }).__recordsTabOverflow
        .frames >= 240,
  );
  const measured = await page.evaluate(
    () =>
      (
        window as unknown as {
          __recordsTabOverflow: {
            found: number;
            max: number;
            maxPageOverflow: number;
          };
        }
      ).__recordsTabOverflow,
  );
  expect(measured.found).toBeGreaterThan(100);
  expect(measured.max).toBeLessThanOrEqual(0);
  expect(measured.maxPageOverflow).toBeLessThanOrEqual(0);
  expect(
    await page.locator(".recordsTabs").evaluate((element) => getComputedStyle(element).overflowX),
  ).toBe("visible");
});
