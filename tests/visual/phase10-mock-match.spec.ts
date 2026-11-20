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
  const narrowMainWidth = await page
    .locator(".mainScrollArea")
    .evaluate((element) => element.clientWidth);
  expect(Math.round(narrow.width)).toBe(Math.round(narrowMainWidth));
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
  expect(await button.evaluate((element) => getComputedStyle(element).fontWeight)).toBe("500");
  const heading = page.locator(".quickGroupHeader strong").first();
  await expect(heading).toHaveCSS("font-size", "11px");
  await expect(heading).toHaveCSS("font-weight", "700");
  await expect(heading).toHaveCSS("color", "rgb(163, 156, 142)");
  const sidebarBox = (await page.locator(".sidebar").boundingBox())!;
  expect(sidebarBox.width).toBeLessThanOrEqual(232);
});

test("P10-14d P1 the picker shows both groups without tabs", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  await expect(dialog.getByRole("tab")).toHaveCount(0);
  await expect(dialog.locator('[data-today-picker-section="next-step"]')).toBeVisible();
  await expect(dialog.locator('[data-today-picker-section="wishlist"]')).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "次の一手", exact: true })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "やりたいこと", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "決定", exact: true })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "キャンセル", exact: true })).toBeVisible();
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

test("P10-14e 1 the play icon sits left of the label on both start buttons", async ({ page }) => {
  await prepare(page);
  for (const selector of [".doNowStartPrimary", ".doNowStartSecondary"]) {
    const button = page.locator(selector);
    const glyph = (await button.locator(".timerStartHoverGlyph").boundingBox())!;
    const label = (await button.locator(".timerStartDuration").boundingBox())!;
    expect(glyph.x + glyph.width).toBeLessThanOrEqual(label.x);
    const glyphCenter = glyph.y + glyph.height / 2;
    const labelCenter = label.y + label.height / 2;
    expect(Math.abs(glyphCenter - labelCenter)).toBeLessThanOrEqual(2);
  }
  await expect(page.locator(".doNowStartPrimary .timerStartDuration")).toHaveText("5分で始める");
  await expect(page.locator(".doNowStartSecondary .timerStartDuration")).toHaveText("通常 25分");
  // F2: the same centring holds while the pointer is on the button.
  for (const selector of [".doNowStartPrimary", ".doNowStartSecondary"]) {
    const button = page.locator(selector);
    await button.hover();
    await button.evaluate((node) =>
      Promise.allSettled(node.getAnimations().map((animation) => animation.finished)),
    );
    await expect
      .poll(async () => {
        const glyph = (await button.locator(".timerStartHoverGlyph").boundingBox())!;
        const label = (await button.locator(".timerStartDuration").boundingBox())!;
        return Math.abs(glyph.y + glyph.height / 2 - (label.y + label.height / 2));
      })
      .toBeLessThanOrEqual(2);
    await page.mouse.move(1, 1);
    await button.evaluate((node) =>
      Promise.allSettled(node.getAnimations().map((animation) => animation.finished)),
    );
  }
});

test("G5/G6 the expanded timer header matches the main top bar and logo", async ({ page }) => {
  await prepare(page, { width: 1440, height: 900 });
  const mainLogo = (await page.locator(".topBar .topBrandIcon").boundingBox())!;
  expect(Math.round(mainLogo.width)).toBe(26);
  expect(Math.round(mainLogo.height)).toBe(26);
  expect(Math.round((await page.locator(".topBar .topBrandIcon img").boundingBox())!.width)).toBe(20);

  await page.locator(".doNowStartPrimary").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  await expect(overlay).toBeVisible();
  const header = (await overlay.locator(".expandedTimerHeader").boundingBox())!;
  expect(Math.round(header.x)).toBe(0);
  expect(Math.round(header.y)).toBe(0);
  expect(Math.round(header.width)).toBe(1440);
  expect(Math.round(header.height)).toBe(44);
  const logo = (await overlay.locator(".topBrandIcon").boundingBox())!;
  expect(Math.round(logo.x - mainLogo.x)).toBe(0);
  expect(Math.round(logo.y - mainLogo.y)).toBe(0);
  expect(Math.round(logo.width)).toBe(26);
  expect(Math.round(logo.height)).toBe(26);

  const windowButton = (await page.locator(".windowControlsButtons .windowControlButton").first().boundingBox())!;
  const windowCenter = windowButton.y + windowButton.height / 2;
  for (const selector of [".expandedTimerClose", ".expandedTimerMiniButton"]) {
    const control = overlay.locator(selector);
    if ((await control.count()) === 0) continue;
    const box = (await control.boundingBox())!;
    expect(Math.abs(box.y + box.height / 2 - windowCenter)).toBeLessThanOrEqual(1);
  }
});

test("P10-14e 2 the mini window is 340x120, two rows, with the Project colour on the left", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 340, height: 120 });
  await installTauriMock(page, createPublicFixture(), "life-launcher-mini");
  await page.goto("/?view=mini");
  const panel = page.locator(".timerPanel--mini");
  await expect(panel).toBeVisible();

  const panelBox = (await panel.boundingBox())!;
  expect(Math.round(panelBox.width)).toBe(340);
  expect(Math.round(panelBox.height)).toBe(120);
  // Idle: no Project, so the left edge is the frame colour.
  await expect(panel).toHaveCSS("border-left-width", "3px");
  await expect(panel).toHaveCSS("border-left-color", "rgb(74, 70, 57)");
  await expect(page.locator(".miniRow--top")).toContainText("タイマー");
  await expect(page.locator(".miniRow--bottom")).toContainText("開始ボタンから計測できます");
  expect(await page.locator(".miniRow--bottom .miniIconButton").count()).toBe(1);

  await page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { emit: (event: string, payload?: unknown) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.emit("mini-timer-snapshot", {
      active: true,
      label: "サンプル学習",
      actionText: "ChatGPTの音声モードで10分話す",
      mode: "countdown",
      remainingClock: "24:55",
      paused: false,
      progressPercent: 0.33,
      projectId: "sample-learning",
      projectName: "サンプル学習",
      projectColorId: "blue",
    }),
  );

  await expect(panel).toHaveCSS("border-left-color", "rgb(112, 167, 255)");
  await expect(page.locator(".miniProjectLine")).toContainText("サンプル学習");
  await expect(page.locator(".timerPanel--mini .timerClock")).toHaveText("24:55");
  const topBox = (await page.locator(".miniRow--top").boundingBox())!;
  const bottomBox = (await page.locator(".miniRow--bottom").boundingBox())!;
  expect(topBox.y).toBeLessThan(bottomBox.y);
  const nameBox = (await page.locator(".miniProjectLine").boundingBox())!;
  const clockBox = (await page.locator(".timerPanel--mini .timerClock").boundingBox())!;
  expect(nameBox.x + nameBox.width).toBeLessThanOrEqual(clockBox.x);
  expect(Math.abs(nameBox.y - clockBox.y)).toBeLessThanOrEqual(8);
  const actionBox = (await page.locator(".timerActionText").boundingBox())!;
  expect(actionBox.y).toBeGreaterThanOrEqual(clockBox.y + clockBox.height);
  const action = page.locator(".timerActionText");
  await expect(action).toHaveText("ChatGPTの音声モードで10分話す");
  await expect(action).toHaveCSS("white-space", "nowrap");
  await expect(action).toHaveCSS("text-overflow", "ellipsis");
  const actionStyle = await action.evaluate((node) => {
    const style = getComputedStyle(node);
    return { whiteSpace: style.whiteSpace, textOverflow: style.textOverflow };
  });
  expect(actionStyle).toEqual({ whiteSpace: "nowrap", textOverflow: "ellipsis" });

  const buttons = page.locator(".miniRow--bottom .miniIconButton");
  await expect(buttons).toHaveCount(3);
  await expect(buttons.nth(0)).toHaveAttribute("aria-label", "一時停止");
  await expect(buttons.nth(1)).toHaveAttribute("aria-label", "終了");
  await expect(buttons.nth(2)).toHaveAttribute("aria-label", "タイマーを大きく表示");
  const buttonBoxes = [];
  for (let index = 0; index < 3; index += 1) {
    buttonBoxes.push((await buttons.nth(index).boundingBox())!);
    expect(Math.round(buttonBoxes[index].width)).toBe(32);
    expect(Math.round(buttonBoxes[index].height)).toBe(32);
  }
  expect(buttonBoxes[0].x + buttonBoxes[0].width).toBeLessThanOrEqual(buttonBoxes[1].x);
  expect(buttonBoxes[1].x + buttonBoxes[1].width).toBeLessThanOrEqual(buttonBoxes[2].x);
  expect(buttonBoxes[2].x + buttonBoxes[2].width).toBeLessThanOrEqual(panelBox.x + panelBox.width);
  expect(buttonBoxes[0].y).toBeGreaterThanOrEqual(panelBox.y);
  expect(buttonBoxes[0].y + buttonBoxes[0].height).toBeLessThanOrEqual(panelBox.y + panelBox.height);
});
