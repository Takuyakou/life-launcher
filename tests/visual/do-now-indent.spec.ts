import { expect, test } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

for (const width of [1440, 860]) {
  test(`Do Now action indent at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
    await installTauriMock(page, createPublicFixture(), "main");
    await page.goto("/");
    const action = page.locator(".doNowCopy > strong");
    await expect(action).toBeVisible();
    const positions = await page.locator(".doNowContent").evaluate(el => {
      const rect = (selector: string) => el.querySelector(selector)!.getBoundingClientRect();
      return {
        action: rect(".doNowCopy > strong").x,
        dotEnd: rect(".doNowStatusDot").right,
        copy: rect(".doNowCopy").x,
        meta: rect(".doNowMeta").x,
        overflow: el.scrollWidth > el.clientWidth,
      };
    });
    expect(positions.action - positions.copy).toBe(15);
    expect(positions.action - positions.dotEnd).toBe(7);
    expect(positions.meta).toBe(positions.copy);
    expect(positions.overflow).toBe(false);
    await page.locator(".doNowBand").screenshot({ path: info.outputPath("do-now-indent.png") });
  });
}
