import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { measureRects, waitForStableRects } from "./helpers";
import { installTauriMock } from "./tauriMock";

// V151-S2-1: pressing an item in the Guide's table of contents must scroll only the content
// column. scrollIntoView also scrolled the outer dialog and pushed the header off screen.

async function openGuide(page: Page, size: { width: number; height: number }) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(size);
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "使い方を開く" }).click();
  const dialog = page.getByRole("dialog", { name: "使い方" });
  await expect(dialog).toBeVisible();
  await dialog.evaluate(async (node) => {
    await Promise.allSettled(node.getAnimations().map((animation) => animation.finished));
  });
  await page.evaluate(async () => document.fonts.ready);
  await waitForStableRects(page, [".helpGuideHeader"]);
  return dialog;
}

for (const [label, size] of [
  ["1280x800", { width: 1280, height: 800 }],
  ["860x560", { width: 860, height: 560 }],
] as const) {
  test(`V151-S2-1 the Guide header stays put when a table-of-contents item is pressed (${label})`, async ({
    page,
  }) => {
    const dialog = await openGuide(page, size);
    const navigation = dialog.getByRole("navigation", { name: "使い方の目次" });
    const buttons = navigation.getByRole("button");
    const count = await buttons.count();
    expect(count).toBeGreaterThanOrEqual(3);

    for (const index of [1, Math.floor(count / 2), count - 1]) {
      const button = buttons.nth(index);
      const section = dialog.locator(".helpGuideSection").nth(index);
      const sectionId = await section.getAttribute("data-help-section-id");
      expect(sectionId).not.toBeNull();
      const heading = section.locator("h3");
      const before = await waitForStableRects(page, [".helpGuideHeader"]);

      await button.click();
      await expect(heading).toBeFocused();
      await expect(button).toHaveAttribute("aria-current", "location");
      await expect(button).toContainText("表示中");

      // The scroll finishes synchronously here (reduced motion), so one measurement is enough.
      const rects = await measureRects(page, [
        ".helpGuideHeader",
        ".helpGuideDialog",
        ".helpGuideBody",
        `#help-${sectionId} h3`,
      ]);
      expect(
        Math.abs(rects[".helpGuideHeader"].y - before[".helpGuideHeader"].y),
        `header moved after pressing item ${index + 1}`,
      ).toBeLessThanOrEqual(1);
      expect(
        await dialog.evaluate((node) => node.scrollTop),
        "the outer dialog must not scroll",
      ).toBe(0);
      const body = rects[".helpGuideBody"];
      const h3 = rects[`#help-${sectionId} h3`];
      expect(h3.top, `section ${index + 1} heading top`).toBeGreaterThanOrEqual(body.top - 1);
      expect(h3.bottom, `section ${index + 1} heading bottom`).toBeLessThanOrEqual(body.bottom + 1);
    }
  });
}
