import { expect, test } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V163-C9: the app icon at the top left was 26px (a 20px picture, of which about 17px is drawn),
// so it looked smaller than the sidebar's magnifier (about 22〜24px). The frame is 30px and the
// picture 26px now; the bar keeps its height and the name keeps its place in the middle.

test("V163-C9 the app icon is as big as the sidebar magnifier, without moving the bar", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1366, height: 768 });
  await installTauriMock(page, createFullTodayFixture(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();

  const measured = await page.evaluate(() => {
    const bar = document.querySelector<HTMLElement>(".topBar")!;
    const icon = document.querySelector<HTMLElement>(".topBrand .topBrandIcon")!;
    const image = icon.querySelector<HTMLElement>("img")!;
    const name = document.querySelector<HTMLElement>(".topBrand .topBrandName")!;
    const barBox = bar.getBoundingClientRect();
    const iconBox = icon.getBoundingClientRect();
    const imageBox = image.getBoundingClientRect();
    const nameBox = name.getBoundingClientRect();
    return {
      barHeight: Math.round(barBox.height),
      icon: [Math.round(iconBox.width), Math.round(iconBox.height)],
      image: [Math.round(imageBox.width), Math.round(imageBox.height)],
      top: Math.round(iconBox.top - barBox.top),
      bottom: Math.round(barBox.bottom - iconBox.bottom),
      nameLeftFromIcon: Math.round(nameBox.left - iconBox.left),
      nameFontSize: getComputedStyle(name).fontSize,
    };
  });

  expect(measured.icon).toEqual([30, 30]);
  expect(measured.image).toEqual([26, 26]);
  expect(measured.barHeight).toBe(44);
  expect(Math.abs(measured.top - measured.bottom)).toBeLessThanOrEqual(1);
  // The frame grew by 4px, so the name starts 4px further right (30px frame + 10px gap).
  expect(measured.nameLeftFromIcon).toBe(40);
  expect(measured.nameFontSize).toBe("13px");
});
