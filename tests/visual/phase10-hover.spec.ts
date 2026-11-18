import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
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
  await page.waitForTimeout(180);
  expect(await box.evaluate((node) => getComputedStyle(node).borderTopColor)).toBe(dotColor);
  expect(await box.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
    "rgb(43, 41, 34)",
  );
  expect(await box.evaluate((node) => getComputedStyle(node).transform)).not.toBe("none");
});

test("F1 row buttons turn yellow on hover, and 他の一手 only changes its colour", async ({
  page,
}) => {
  await prepare(page);
  const edit = page.locator(".nextStepRowAction").first();
  await edit.hover();
  await page.waitForTimeout(180);
  expect(await edit.evaluate((node) => getComputedStyle(node).borderTopColor)).toBe(
    "rgba(231, 185, 77, 0.48)",
  );
  expect(await edit.evaluate((node) => getComputedStyle(node).color)).toBe("rgb(255, 206, 91)");

  const alternate = page.locator(".doNowAlternateButton");
  await alternate.hover();
  await page.waitForTimeout(180);
  expect(await alternate.evaluate((node) => getComputedStyle(node).borderTopColor)).toBe(
    "rgba(0, 0, 0, 0)",
  );
  expect(await alternate.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
    "rgb(43, 41, 34)",
  );
  expect(await alternate.evaluate((node) => getComputedStyle(node).color)).toBe(
    "rgb(255, 206, 91)",
  );
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
  await button.hover();
  await page.waitForTimeout(180);
  expect(await button.evaluate((node) => getComputedStyle(node).borderTopColor)).toBe(
    "rgba(231, 185, 77, 0.48)",
  );
  expect(await button.evaluate((node) => getComputedStyle(node).color)).toBe("rgb(255, 206, 91)");
});

test("F1 the dictionary and the top-bar buttons turn yellow on hover", async ({ page }) => {
  await prepare(page);
  const dictionary = page.locator(".launcherOpenButton");
  await dictionary.hover();
  await page.waitForTimeout(180);
  expect(await dictionary.evaluate((node) => getComputedStyle(node).borderTopColor)).toBe(
    "rgb(184, 176, 160)",
  );
  expect(await dictionary.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
    "rgb(43, 41, 34)",
  );
  expect(await dictionary.evaluate((node) => getComputedStyle(node).color)).toBe(
    "rgb(244, 240, 232)",
  );

  for (const selector of [
    ".topPills .viewToggleButton:not(.viewToggleButton--active)",
    ".topSearchButton",
  ]) {
    const button = page.locator(selector).first();
    await button.hover();
    await page.waitForTimeout(180);
    const icon = button.locator("svg").first();
    expect(await button.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
      "rgb(43, 41, 34)",
    );
    expect(await icon.evaluate((node) => getComputedStyle(node).color)).toBe("rgb(255, 206, 91)");
    const label = button.locator(".viewToggleButtonLabel");
    if ((await label.count()) > 0) {
      expect(await label.evaluate((node) => getComputedStyle(node).color)).toBe(
        "rgb(255, 206, 91)",
      );
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
