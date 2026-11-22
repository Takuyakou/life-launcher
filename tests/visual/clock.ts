import type { Page } from "@playwright/test";

/** Pauses Playwright's virtual clock at the page's current clock time + 1s buffer. */
export async function pauseClock(page: Page) {
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
}
