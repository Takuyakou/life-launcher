import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPickerFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type Display = "standard" | "large" | "xlarge";

async function open(page: Page, fixture: VisualQaFixture, display: Display = "standard") {
  fixture.config.settings.mainDisplaySize = display;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1080, height: 680 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

const columns = (page: Page, selector: string): Promise<number[]> =>
  page.locator(selector).first().evaluate((element) =>
    getComputedStyle(element)
      .gridTemplateColumns.split(" ")
      .map((column) => parseFloat(column)),
  );

/** Distance from the right edge of the count / completion display to the left edge of the description. */
const countToDescription = (page: Page) =>
  page.locator(".todaySectionBar").evaluate((bar) => {
    const count = bar.querySelector(".todayCompletionSummary, .todaySectionCount")!.getBoundingClientRect();
    const description = bar.querySelector(".todaySectionDescription")!.getBoundingClientRect();
    return description.left - count.right;
  });

// Measured on main before P9-13 (1080x680, createFullTodayFixture). These headings must not move.
const OTHER_HEADINGS: Record<Display, { leading: number[]; next: number }> = {
  standard: { leading: [120, 30], next: 481.19 },
  large: { leading: [132, 34], next: 455.47 },
  xlarge: { leading: [144, 38], next: 433.77 },
};

for (const display of ["standard", "large", "xlarge"] as const) {
  test(`P9-13 Today heading description follows the count (${display})`, async ({ page }) => {
    await open(page, createFullTodayFixture(), display);
    // 8px column gap; a few px of tolerance for the font.
    await expect.poll(() => countToDescription(page)).toBeGreaterThanOrEqual(0);
    await expect.poll(() => countToDescription(page)).toBeLessThanOrEqual(12);
    const today = await columns(page, ".todaySectionBar");
    expect(today.slice(0, 2)).toEqual(OTHER_HEADINGS[display].leading);
    // 3rd column fits "n / n 完了" only (tens of px), the description takes the rest.
    expect(today[2]).toBeGreaterThan(10);
    expect(today[2]).toBeLessThan(60);
    expect(today[3]).toBeGreaterThan(today[2] * 10);
  });

  test(`P9-13 Today heading with 0 items lines up like the standard size (${display})`, async ({ page }) => {
    await open(page, createPickerFixture(), display);
    await expect(page.locator(".todaySectionCount")).toHaveText("0件");
    // "0件" sits in column 2; column 3 is empty, so the description follows after two 8px gaps.
    await expect.poll(() => countToDescription(page)).toBeGreaterThanOrEqual(15);
    await expect.poll(() => countToDescription(page)).toBeLessThanOrEqual(17);
    expect((await columns(page, ".todaySectionBar"))[2]).toBe(0);
  });

  test(`P9-13 other headings keep their columns (${display})`, async ({ page }) => {
    await open(page, createFullTodayFixture(), display);
    const expected = OTHER_HEADINGS[display];
    for (const selector of [".projectsBand .disclosureHeader", ".inboxBand .disclosureHeader", ".todayActivityBand .disclosureHeader"]) {
      expect((await columns(page, selector)).slice(0, 2)).toEqual(expected.leading);
    }
    expect((await columns(page, ".projectsBand .disclosureHeader"))[2]).toBeCloseTo(expected.next, 0);
  });
}

const GOLD = "rgb(231, 185, 77)";
const LIFT = "matrix(1, 0, 0, 1, 0, -1)";

const bar = (page: Page) =>
  page.locator(".victoryBar").evaluate((element) => {
    const style = getComputedStyle(element);
    const box = element.getBoundingClientRect();
    return {
      border: style.borderTopColor,
      background: style.backgroundColor,
      image: style.backgroundImage,
      transform: style.transform,
      width: box.width,
      height: box.height,
    };
  });

const away = (page: Page) => page.mouse.move(2, 2);

test("P9-13 victory bar reacts to hover like the cards (not achieved)", async ({ page }) => {
  await open(page, createFullTodayFixture());
  await expect.poll(() => bar(page)).toMatchObject({ border: "rgba(231, 185, 77, 0.42)", transform: "none" });
  const before = await bar(page);
  await page.locator(".victoryIcon").hover();
  await expect
    .poll(() => bar(page))
    .toMatchObject({ border: GOLD, background: "rgba(231, 185, 77, 0.08)", transform: LIFT });
  const hovered = await bar(page);
  expect([hovered.width, hovered.height]).toEqual([before.width, before.height]);
  await away(page);
  await expect.poll(() => bar(page)).toMatchObject({ border: before.border, background: before.background, transform: "none" });
});

test("P9-13 victory bar reacts to hover like the cards (achieved)", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.config.today.victory.done = true;
  await open(page, fixture);
  // The Main-view override of .victoryBar (P8.9) outranks .victoryBar--done, so the resting border is 0.42 here too.
  await expect.poll(() => bar(page)).toMatchObject({ border: "rgba(231, 185, 77, 0.42)", transform: "none" });
  const before = await bar(page);
  await page.locator(".victoryIcon").hover();
  await expect.poll(() => bar(page)).toMatchObject({ border: GOLD, transform: LIFT });
  expect((await bar(page)).image).toContain("rgba(231, 185, 77, 0.14)");
  const hovered = await bar(page);
  expect([hovered.width, hovered.height]).toEqual([before.width, before.height]);
  await away(page);
  await expect.poll(() => bar(page)).toMatchObject({ border: before.border, image: before.image, transform: "none" });
});

test("P9-13 victory bar reacts to keyboard focus and keeps the focus ring", async ({ page }) => {
  await open(page, createFullTodayFixture());
  await page.getByRole("checkbox", { name: "勝利条件を達成" }).focus();
  await page.keyboard.press("Tab");
  const text = page.locator(".victoryTextButton");
  await expect(text).toBeFocused();
  await expect.poll(() => bar(page)).toMatchObject({ border: GOLD, background: "rgba(231, 185, 77, 0.08)", transform: LIFT });
  await expect(text).toHaveCSS("outline-style", "solid");
  await expect(text).toHaveCSS("outline-color", GOLD);
  await expect(text).toHaveCSS("outline-width", "2px");
});

test("P9-13 victory bar stays strong while editing, and an empty spot does not start editing", async ({ page }) => {
  await open(page, createFullTodayFixture());
  await page.locator(".victoryIcon").click();
  await expect(page.locator(".victoryInput")).toHaveCount(0);
  await expect(page.locator(".victoryTextButton")).toBeVisible();
  await page.locator(".victoryLabel").click();
  await expect(page.locator(".victoryInput")).toHaveCount(0);

  await page.locator(".victoryTextButton").click();
  await expect(page.locator(".victoryInput")).toBeFocused();
  await away(page);
  await expect.poll(() => bar(page)).toMatchObject({ border: GOLD, transform: LIFT });
});

test("P9-13 victory text button keeps its own hover colour", async ({ page }) => {
  await open(page, createFullTodayFixture());
  const text = page.locator(".victoryTextButton");
  const resting = await text.evaluate((element) => getComputedStyle(element).color);
  await text.hover();
  await expect.poll(() => text.evaluate((element) => getComputedStyle(element).color)).not.toBe(resting);
  await expect(text).toHaveCSS("cursor", "pointer");
});
