import type { Page } from "@playwright/test";

/**
 * P10-01: the app bundles Inter / Noto Sans JP. Unicode-range subsets load lazily, so a page can
 * still swap fonts after `document.fonts.ready` (that promise only covers the loads started so
 * far). Geometry tests measure text, so load every face up front and then wait once more —
 * otherwise the first measurement uses the fallback font and the second one uses Inter.
 */
export async function waitForBundledFonts(page: Page) {
  await page.evaluate(async () => {
    await Promise.all(
      Array.from(document.fonts).map((face) => face.load().catch(() => undefined)),
    );
    await document.fonts.ready;
  });
}
