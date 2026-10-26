import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type DisplaySize = "standard" | "large" | "xlarge";

// Text that has to grow (or at least not shrink) when the main display size grows.
const SELECTORS = {
  victoryView: ".victoryTextButton",
  victoryEdit: ".victoryInput",
  doNowText: ".doNowCopy > strong",
  todayText: ".todayTextButton",
  todayStart: ".todayStartButton",
} as const;

async function prepare(
  page: Page,
  size: DisplaySize,
  viewport = { width: 1080, height: 680 },
  victoryText?: string,
) {
  const fixture = createFullTodayFixture();
  fixture.config.settings.mainDisplaySize = size;
  if (victoryText !== undefined) fixture.config.today.victory.text = victoryText;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function fontSizes(page: Page, size: DisplaySize) {
  await prepare(page, size);
  const px = (selector: string) =>
    page
      .locator(selector)
      .first()
      .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
  const sizes: Record<keyof typeof SELECTORS, number> = {
    victoryView: await px(SELECTORS.victoryView),
    victoryEdit: 0,
    doNowText: await px(SELECTORS.doNowText),
    todayText: await px(SELECTORS.todayText),
    todayStart: await px(SELECTORS.todayStart),
  };
  await page.locator(SELECTORS.victoryView).click();
  sizes.victoryEdit = await px(SELECTORS.victoryEdit);
  return sizes;
}

test("P9-01 large and xlarge keep every main text at or above the standard size", async ({
  page,
}) => {
  const standard = await fontSizes(page, "standard");
  expect(standard.victoryView).toBe(17);
  for (const size of ["large", "xlarge"] as const) {
    const sizes = await fontSizes(page, size);
    for (const key of Object.keys(SELECTORS) as Array<keyof typeof SELECTORS>) {
      expect(sizes[key], `${size} ${key}`).toBeGreaterThanOrEqual(standard[key]);
    }
  }
});

test("P9-01 victory text is 17px, 19px and 20px in view and edit", async ({ page }) => {
  for (const [size, expected] of [
    ["standard", 17],
    ["large", 19],
    ["xlarge", 20],
  ] as const) {
    const sizes = await fontSizes(page, size);
    expect(sizes.victoryView, `${size} view`).toBe(expected);
    expect(sizes.victoryEdit, `${size} edit`).toBe(expected);
  }
});

test("P9-01 xlarge at 860x560 keeps victory view, edit and suggestions inside the bar", async ({
  page,
}) => {
  const longVictory = "今日の勝利条件をとても長く書いても枠の中に収まって崩れないことを確かめるための文章です。";
  for (const text of [longVictory, ""]) {
    await prepare(page, "xlarge", { width: 860, height: 560 }, text);
    const bar = page.locator(".victoryBar");
    const expectInsideBar = async (selector: string) => {
      const barBox = (await bar.boundingBox())!;
      for (const element of await page.locator(selector).all()) {
        const box = (await element.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(barBox.x - 1);
        expect(box.x + box.width).toBeLessThanOrEqual(barBox.x + barBox.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(barBox.y + barBox.height + 1);
      }
    };
    const expectNoHorizontalOverflow = async () =>
      expect(
        await page.evaluate(
          () =>
            document.documentElement.scrollWidth <= window.innerWidth &&
            document.querySelector(".mainScrollArea")!.scrollWidth <=
              document.querySelector(".mainScrollArea")!.clientWidth + 1,
        ),
      ).toBe(true);

    if (!text) await expect(page.locator(".victorySuggestions .suggestionChip").first()).toBeVisible();
    await expectInsideBar(SELECTORS.victoryView);
    await expectNoHorizontalOverflow();
    await page.locator(SELECTORS.victoryView).click();
    await expect(page.locator(SELECTORS.victoryEdit)).toBeFocused();
    await expectInsideBar(SELECTORS.victoryEdit);
    await expectInsideBar(".victorySuggestions, .suggestionChip");
    await expectNoHorizontalOverflow();
  }
});
