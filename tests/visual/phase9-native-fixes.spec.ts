import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
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

test("P9-13 victory bar keeps the keyboard focus ring; the frame stays as it is (P9-14)", async ({ page }) => {
  await open(page, createFullTodayFixture());
  await page.getByRole("checkbox", { name: "勝利条件を達成" }).focus();
  await page.keyboard.press("Tab");
  const text = page.locator(".victoryTextButton");
  await expect(text).toBeFocused();
  // P9-14: keyboard focus shows the inner ring only; the frame does not light up (no second square).
  await expect(text).toHaveCSS("outline-style", "solid");
  await expect(text).toHaveCSS("outline-color", GOLD);
  await expect(text).toHaveCSS("outline-width", "2px");
  await expect.poll(() => bar(page)).toMatchObject({ border: "rgba(231, 185, 77, 0.42)", transform: "none" });
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
