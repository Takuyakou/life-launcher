import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { waitForAnimations, waitForStableRects } from "./helpers";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

async function prepare(page: Page, fixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.mouse.move(1, 1);
}

test("F1 the Do Now box keeps its Project border and lifts on hover", async ({ page }) => {
  await prepare(page);
  const box = page.locator(".doNowContent--active");
  const dotColor = await page
    .locator(".doNowStatusDot")
    .first()
    .evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(await box.evaluate((node) => getComputedStyle(node).borderTopColor)).toBe("rgb(74, 70, 57)");
  await box.hover();
  await expect(box).toHaveCSS("border-top-color", dotColor);
  await expect(box).toHaveCSS("background-color", "rgb(43, 41, 34)");
  await waitForAnimations(box);
  expect(await box.evaluate((node) => getComputedStyle(node).transform)).not.toBe("none");
});

test("F1 row buttons turn yellow on hover, and 他の一手 only changes its colour", async ({
  page,
}) => {
  await prepare(page);
  const edit = page.locator(".nextStepRowAction").first();
  await edit.hover();
  await expect(edit).toHaveCSS("border-top-color", "rgba(231, 185, 77, 0.48)");
  await expect(edit).toHaveCSS("color", "rgb(255, 206, 91)");

  const alternate = page.locator(".doNowAlternateButton");
  await alternate.hover();
  await expect(alternate).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  await expect(alternate).toHaveCSS("background-color", "rgb(43, 41, 34)");
  await expect(alternate).toHaveCSS("color", "rgb(255, 206, 91)");
  await waitForAnimations(alternate);
  expect(await alternate.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  expect(await alternate.evaluate((node) => getComputedStyle(node).boxShadow)).toBe("none");
});

test("F1 the freshness buttons turn yellow on hover", async ({ page }) => {
  const fixture = createFullTodayFixture();
  const locked = new Set(
    fixture.config.today.items.filter((item) => !item.done).map((item) => item.projectId),
  );
  const project = fixture.config.projects.find((item) => item.nextStep && !locked.has(item.id))!;
  fixture.staleProjectIds = [project.id];
  const updated = new Date(new Date(FIXTURE_NOW).getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  fixture.config.projects = fixture.config.projects.map((item) =>
    item.id === project.id
      ? { ...item, nextStep: { ...item.nextStep!, reviewedAt: updated, updatedAt: updated } }
      : item,
  );
  await prepare(page, fixture);
  const button = page.getByRole("button", { name: "小さくする" }).first();
  // The bundled font swaps in after first paint and moves the freshness button sideways; settle
  // the font and the layout before moving the pointer so it cannot slide out from under it.
  await page.evaluate(async () => document.fonts.ready);
  await waitForStableRects(page, [".nextStepFreshnessButton"]);
  await button.hover();
  await expect(button).toHaveCSS("border-top-color", "rgba(231, 185, 77, 0.48)");
  await expect(button).toHaveCSS("color", "rgb(255, 206, 91)");
});

test("F1 the dictionary and the top-bar buttons turn yellow on hover", async ({ page }) => {
  await prepare(page);
  const dictionary = page.locator(".launcherOpenButton");
  await dictionary.hover();
  await expect(dictionary).toHaveCSS("border-top-color", "rgb(184, 176, 160)");
  await expect(dictionary).toHaveCSS("background-color", "rgb(43, 41, 34)");
  await expect(dictionary).toHaveCSS("color", "rgb(244, 240, 232)");

  for (const selector of [
    ".topPills .viewToggleButton:not(.viewToggleButton--active)",
    ".topSearchButton",
  ]) {
    const button = page.locator(selector).first();
    await button.hover();
    const icon = button.locator("svg").first();
    await expect(button).toHaveCSS("background-color", "rgb(43, 41, 34)");
    await expect(icon).toHaveCSS("color", "rgb(255, 206, 91)");
    const label = button.locator(".viewToggleButtonLabel");
    if ((await label.count()) > 0) {
      await expect(label).toHaveCSS("color", "rgb(255, 206, 91)");
    }
  }
});

test("G9 the top search reads 検索 and keeps its full name for assistive tech", async ({ page }) => {
  await prepare(page);
  const button = page.locator(".topSearchButton");
  await expect(button).toHaveAccessibleName("一手・ボタン・手順書を検索(Ctrl+F)");
  await expect(button).toHaveAttribute("title", "一手・ボタン・手順書を検索(Ctrl+F)");
  await expect(button.locator(".topSearchLabel")).toHaveText("検索");
  await button.click();
  await expect(page.locator(".searchPaletteInput")).toBeVisible();
});

test("G6 the top app mark is a 26px box with a 20px icon", async ({ page }) => {
  await prepare(page);
  const box = page.locator(".topBrandIcon");
  const icon = box.locator("img");
  expect(Math.round((await box.boundingBox())!.width)).toBe(26);
  expect(Math.round((await box.boundingBox())!.height)).toBe(26);
  expect(Math.round((await icon.boundingBox())!.width)).toBe(20);
  expect(Math.round((await icon.boundingBox())!.height)).toBe(20);
  expect(await box.evaluate((node) => getComputedStyle(node).borderRadius)).toBe("7px");
});

test("F3 the dictionary icon is a 28px yellow 16px glyph with a 13px label", async ({ page }) => {
  await prepare(page);
  const box = page.locator(".launcherOpenButtonIcon");
  const icon = box.locator("svg");
  expect(Math.round((await box.boundingBox())!.width)).toBe(28);
  expect(Math.round((await box.boundingBox())!.height)).toBe(28);
  expect(await box.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
    "rgb(43, 41, 34)",
  );
  expect(await icon.evaluate((node) => getComputedStyle(node).color)).toBe("rgb(255, 206, 91)");
  expect(Math.round((await icon.boundingBox())!.width)).toBe(16);
  expect(Math.round((await icon.boundingBox())!.height)).toBe(16);
  expect(await icon.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
  const label = page.locator(".launcherOpenButtonLabel > span:last-child");
  expect(await label.evaluate((node) => getComputedStyle(node).fontSize)).toBe("13px");
  expect(await label.evaluate((node) => getComputedStyle(node).fontWeight)).toBe("700");
});

test("F10 the drop hint label is an opaque pill", async ({ page }) => {
  await prepare(page);
  const style = await page.evaluate(() => {
    const label = document.createElement("span");
    label.className = "dropHintLabel";
    label.textContent = "test";
    document.body.append(label);
    const computed = getComputedStyle(label);
    const result = {
      background: computed.backgroundColor,
      weight: computed.fontWeight,
      radius: computed.borderRadius,
    };
    label.remove();
    return result;
  });
  expect(style.background).toBe("rgb(33, 31, 26)");
  expect(style.weight).toBe("700");
  expect(style.radius).toBe("999px");
});

test("F13 the Do Now heading uses the Project colour, not the old blue", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].colorId = "green";
  await prepare(page, fixture);
  const heading = page.locator("#do-now-title").first();
  const dot = page.locator(".doNowStatusDot").first();
  expect(await heading.evaluate((node) => getComputedStyle(node).color)).toBe(
    await dot.evaluate((node) => getComputedStyle(node).backgroundColor),
  );
});

test("P10-15c J1 the Do Now start buttons lift and cast the same shadow as the Today cards", async ({
  page,
}) => {
  await prepare(page);
  const doNowShort = page.locator(".doNowActions .doNowStartSecondary").first();
  const doNowNormal = page.locator(".doNowActions .doNowStartPrimary").first();
  const todayStart = page.locator(".todayStartButton").first();
  const read = (locator: typeof doNowShort) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return { boxShadow: style.boxShadow, transform: style.transform };
    });
  await todayStart.hover();
  await expect
    .poll(async () => (await read(todayStart)).boxShadow)
    .not.toBe("none");
  await waitForAnimations(todayStart);
  const today = await read(todayStart);
  expect(today.transform).not.toBe("none");
  expect(today.boxShadow).not.toBe("none");
  for (const button of [doNowShort, doNowNormal]) {
    await button.hover();
    await waitForAnimations(button);
    await expect.poll(() => read(button)).toEqual(today);
  }
});