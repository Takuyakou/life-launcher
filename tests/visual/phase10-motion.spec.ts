import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function open(page: Page, reducedMotion = "no-preference") {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.emulateMedia({ reducedMotion: reducedMotion as "reduce" | "no-preference" });
  await installTauriMock(page, createFullTodayFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

const cases = [
  {
    name: "today",
    header: () => ".todaySectionDisclosure",
    body: () => ".todayGridRegion",
  },
  {
    name: "next step",
    header: () => ".projectsBand .disclosure",
    body: () => ".nextStepBody",
  },
  {
    name: "wishlist",
    header: () => ".inboxBand .disclosure",
    body: () => ".inboxBody",
  },
  {
    name: "today activity",
    header: () => ".todayActivityBand .disclosure",
    body: () => ".todayActivityBody",
  },
  {
    name: "wishlist group",
    header: () => ".wishlistGroupHeader",
    body: () => ".wishlistGroup:first-of-type .inboxList",
  },
];

async function bodyHeight(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((node) => (node.parentElement as HTMLElement).getBoundingClientRect().height);
}

for (const item of cases) {
  test(`F6 ${item.name} collapses and opens with the spring`, async ({ page }) => {
    await open(page);
    if (item.name === "wishlist group") {
      const inboxHeader = page.locator(".inboxBand .disclosure");
      if ((await inboxHeader.getAttribute("aria-expanded")) === "false") {
        await inboxHeader.click();
        await expect(page.locator(".inboxBody")).toBeVisible();
      }
    }
    const header = page.locator(item.header()).first();
    await header.scrollIntoViewIfNeeded();
    if ((await header.getAttribute("aria-expanded")) === "false") {
      await header.click();
      await expect(page.locator(item.body()).first()).toBeVisible();
    }
    await header.click();
    await expect(page.locator(item.body())).toHaveCount(0);
    await header.click();
    await page.waitForTimeout(50);
    const early = await bodyHeight(page, item.body());
    await page.waitForTimeout(400);
    const settled = await bodyHeight(page, item.body());
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(settled - 1);
    expect(await page.locator(item.body()).first().evaluate((node) => getComputedStyle(node).overflow)).toBe(
      "visible",
    );
  });
}

test("F6 reduced motion jumps straight to the final height", async ({ page }) => {
  await open(page, "reduce");
  const header = page.locator(cases[0].header()).first();
  await header.click();
  await expect(page.locator(cases[0].body())).toHaveCount(0);
  await header.click();
  await page.waitForTimeout(50);
  const early = await bodyHeight(page, cases[0].body());
  await page.waitForTimeout(400);
  const settled = await bodyHeight(page, cases[0].body());
  expect(Math.abs(early - settled)).toBeLessThanOrEqual(1);
});
