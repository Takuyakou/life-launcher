import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, viewport = { width: 1280, height: 900 }) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function css(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((element, name) => getComputedStyle(element).getPropertyValue(name), property);
}

test("P10-14d M1 the date and the victory band share the first row", async ({ page }) => {
  await prepare(page);
  const date = page.locator(".mainHeaderDate");
  const band = page.locator(".mainHeaderRow .victoryBar");
  const dateBox = (await date.boundingBox())!;
  const bandBox = (await band.boundingBox())!;
  expect(Math.abs(dateBox.y + dateBox.height / 2 - (bandBox.y + bandBox.height / 2))).toBeLessThan(6);
  expect(await css(page, ".mainHeaderRow .victoryBar", "border-top-color")).toContain("231");
  await expect(band.locator("svg").first()).toBeVisible();
  await expect(band.locator(".victoryLabel")).toHaveText("今日の勝利条件");
  // The top bar's h1 is not visible on the main screen but stays for screen readers.
  await expect(page.locator(".topTitle--main")).toHaveCount(1);
  expect(await css(page, ".topTitle--main", "position")).toBe("absolute");
});

test("P10-14d M2 the Do Now box has no left line and shows the open-with chips", async ({
  page,
}) => {
  await prepare(page);
  const box = page.locator(".doNowContent").first();
  const border = await box.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      left: style.borderLeftWidth + style.borderLeftColor,
      top: style.borderTopWidth + style.borderTopColor,
    };
  });
  expect(border.left).toBe(border.top);
  await expect(box.locator(".doNowMetaLabel")).toHaveText("始めると一緒に開く");
  await expect(box.locator(".doNowMetaTimer")).toHaveCount(0);
  const start = box.locator(".doNowStartPrimary");
  expect(parseFloat(await start.evaluate((element) => getComputedStyle(element).fontSize))).toBe(15);
  // The handbook entry is a real button (the static chips are spans), so it can open
  // the instruction window. Opening it spawns a second Tauri webview, which this
  // single-page harness cannot observe; the window path is covered by native QA.
  const chip = box.locator(".doNowOpenChip--button");
  await expect(chip).toHaveCount(1);
  expect(await chip.evaluate((element) => element.tagName)).toBe("BUTTON");
  await expect(chip).toHaveText("guide.md");
  await expect(box.locator(".doNowOpenChip").first()).toHaveText("サンプル資料");
  expect(await box.locator(".doNowOpenChip").first().evaluate((element) => element.tagName)).toBe(
    "SPAN",
  );
});

test("P10-14d M3 the main content is capped at 1200px and centered", async ({ page }) => {
  await prepare(page, { width: 1920, height: 1000 });
  const content = page.locator(".mainScrollContent");
  const box = (await content.boundingBox())!;
  expect(Math.round(box.width)).toBe(1200);
  const mainBox = (await page.locator(".mainScrollArea").boundingBox())!;
  const leftGap = box.x - mainBox.x;
  const rightGap = mainBox.x + mainBox.width - (box.x + box.width);
  expect(Math.abs(leftGap - rightGap)).toBeLessThan(2);

  await page.setViewportSize({ width: 1000, height: 900 });
  const narrow = (await content.boundingBox())!;
  const narrowMain = (await page.locator(".mainScrollArea").boundingBox())!;
  expect(Math.round(narrow.width)).toBe(Math.round(narrowMain.width));
});

test("P10-14d M4 the section headers have no frame and keep their arrow", async ({ page }) => {
  await prepare(page);
  const header = page.locator(".todaySectionBar");
  expect(await css(page, ".todaySectionBar", "border-top-width")).toBe("0px");
  const disclosure = header.locator(".todaySectionDisclosure");
  const before = await disclosure.getAttribute("aria-expanded");
  await disclosure.click();
  await expect(disclosure).toHaveAttribute("aria-expanded", before === "true" ? "false" : "true");
});

test("P10-14d M5 the Next Step edit button shows only on hover or focus", async ({ page }) => {
  await prepare(page);
  const row = page.locator(".nextStepRow").filter({ hasText: "ストレッチ" });
  await page.mouse.move(2, 2);
  const edit = row.locator(".nextStepRowAction--change");
  await expect.poll(() => edit.evaluate((element) => getComputedStyle(element).opacity)).toBe("0");
  await row.hover();
  await expect.poll(() => edit.evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
});

test("P10-14d M6 sidebar buttons are frameless rows", async ({ page }) => {
  await prepare(page);
  const button = page.locator(".quickButton").first();
  expect(await button.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("0px");
  expect(
    parseFloat(await button.evaluate((element) => getComputedStyle(element).fontSize)),
  ).toBeGreaterThanOrEqual(14);
});

test("P10-14d P1 the picker shows both groups without tabs", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  await expect(dialog.getByRole("tab")).toHaveCount(0);
  await expect(dialog.locator('[data-today-picker-section="next-step"]')).toBeVisible();
  await expect(dialog.locator('[data-today-picker-section="wishlist"]')).toBeVisible();
  await expect(dialog.locator(".todayPickerNote")).toContainText("明日に繰り越されません");
});

test("P10-14d P2 the chosen slot has the project color line", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  const slot = dialog.locator(".todayPickerSlot--selected").first();
  await expect(slot).toHaveAttribute("data-project-color");
  expect(await slot.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("2px");
});

test("P10-14d C1 the menu key hints are text and delete items are red", async ({ page }) => {
  await prepare(page);
  await page.locator(".nextStepRow").filter({ hasText: "ストレッチ" }).getByRole("button", {
    name: /の次の一手の操作/,
  }).click();
  const menu = page.getByRole("menu");
  const hint = menu.locator(".contextMenuShortcut").first();
  expect(await hint.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("0px");
  expect(await hint.evaluate((element) => getComputedStyle(element).backgroundColor)).toBe(
    "rgba(0, 0, 0, 0)",
  );
  const danger = menu.locator(".contextMenuDanger").first();
  expect(await danger.evaluate((element) => getComputedStyle(element).color)).not.toBe(
    await menu.locator(".contextMenuItemLabel").first().evaluate(
      (element) => getComputedStyle(element).color,
    ),
  );
});

test("P10-14d K1 keyboard focus shows one yellow ring", async ({ page }) => {
  await prepare(page);
  await page.keyboard.press("Tab");
  const focused = page.locator(":focus-visible").first();
  const outline = await focused.evaluate((element) => {
    const style = getComputedStyle(element);
    return { color: style.outlineColor, width: style.outlineWidth, offset: style.outlineOffset };
  });
  expect(outline.color).toContain("255");
  expect(outline.width).toBe("2px");
  expect(outline.offset).toBe("2px");
});
