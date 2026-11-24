import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

async function prepare(
  page: Page,
  fixture = createPublicFixture(),
  viewport = { width: 1280, height: 900 },
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function style(page: Page, selector: string, property: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((node, name) => getComputedStyle(node).getPropertyValue(name), property);
}

async function setDisplaySize(page: Page, size: "standard" | "large" | "xlarge") {
  await page.evaluate((next) => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          currentConfig: () => { settings: { mainDisplaySize: string } };
          updateConfig: (config: unknown) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    config.settings.mainDisplaySize = next;
    control.updateConfig(config);
  }, size);
  await expect(page.locator(".mainScrollContent")).toHaveAttribute("data-main-display-size", size);
}

test("P10-14e 12-1 every status pill uses the 20px / 11px / 700 base", async ({ page }) => {
  await prepare(page);
  const selectors = [
    ".timerStateBadge",
    ".doNowProjectChip",
    ".nextStepTodayStatus",
    ".todayActivityAutoBadge",
    ".todayHereBadge",
  ];
  for (const selector of selectors) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) continue;
    await expect(locator, selector).toBeVisible();
    const box = (await locator.boundingBox())!;
    expect(Math.abs(box.height - 20), `${selector} height`).toBeLessThanOrEqual(1);
    expect(await style(page, selector, "font-size"), `${selector} font size`).toBe("11px");
    expect(await style(page, selector, "font-weight"), `${selector} weight`).toBe("700");
    expect(await style(page, selector, "padding-left"), `${selector} left padding`).toBe("7px");
    expect(await style(page, selector, "padding-right"), `${selector} right padding`).toBe("7px");
  }

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const selected = page.locator(".todayPickerSelectedStatus").first();
  await expect(selected).toBeVisible();
  const selectedBox = (await selected.boundingBox())!;
  expect(Math.abs(selectedBox.height - 20)).toBeLessThanOrEqual(1);
  expect(await style(page, ".todayPickerSelectedStatus", "font-size")).toBe("11px");
  expect(await style(page, ".todayPickerSelectedStatus", "font-weight")).toBe("700");
});

test("P10-14e 12-2 / F4 the key caps keep one height; only Ctrl+F is muted", async ({ page }) => {
  await prepare(page);
  const searchKey = page.locator(".topSearchButton .uiKey");
  await expect(searchKey).toHaveText("Ctrl+F");
  await expect(searchKey).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(searchKey).toHaveCSS("color", "rgb(184, 176, 160)");
  const dictionaryKey = page.locator(".launcherOpenButton .uiKey");
  await expect(dictionaryKey).toHaveCSS("background-color", "rgba(231, 185, 77, 0.12)");
  await expect(dictionaryKey).toHaveCSS("color", "rgb(231, 185, 77)");
  await expect(dictionaryKey).toHaveCSS("border-top-color", "rgba(231, 185, 77, 0.48)");
  const keys = page.locator(".uiKey");
  const heights = await keys.evaluateAll((nodes) =>
    nodes.filter((node) => (node as HTMLElement).offsetParent !== null).map((node) => node.offsetHeight),
  );
  expect(new Set(heights).size).toBe(1);
  for (const key of await keys.all()) {
    if (!(await key.isVisible())) continue;
    expect(await key.evaluate((node) => getComputedStyle(node).fontSize)).toBe("11px");
    expect(await key.evaluate((node) => getComputedStyle(node).fontWeight)).toBe("700");
    expect(await key.evaluate((node) => getComputedStyle(node).borderRadius)).toBe("5px");
    expect(await key.evaluate((node) => getComputedStyle(node).paddingLeft)).toBe("6px");
    expect(await key.evaluate((node) => getComputedStyle(node).paddingRight)).toBe("6px");
  }
});

test("P10-14e 12-4 the Phase 10 weights are only 400, 500 or 700", async ({ page }) => {
  await prepare(page);
  const expected: Array<[string, "400" | "500" | "700"]> = [
    [".doNowMetaItem", "400"],
    [".doNowReason", "400"],
    [".doNowAlternateButton", "700"],
    [".sectionAddButton", "700"],
    [".todayRow .projectIdentityName", "400"],
    [".wishlistGroupHeader .projectIdentityName", "700"],
    [".todayActivityAutoBadge", "700"],
    [".todayInstructionButton", "700"],
    [".todayRemoveButton", "700"],
    [".todayCompletedLabel", "700"],
    [".viewToggleButtonLabel", "400"],
    [".doNowMeasureButton span", "700"],
    [".todayTextButton", "700"],
    [".nextStepTextRegion p", "400"],
    [".quickButton", "500"],
    [".quickGroupHeader strong", "700"],
  ];
  for (const [selector, weight] of expected) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) continue;
    expect(await style(page, selector, "font-weight"), selector).toBe(weight);
  }
});

test("P10-14e 5 the Enter hint sits left of the menu, after 今やる一手, and only on focus", async ({
  page,
}) => {
  await prepare(page);
  const card = page.locator(".todayRow").filter({ hasText: "資料を1ページ読む" });
  const hint = card.locator(".rowKeyHint");
  await expect(hint).toBeHidden();
  const order = await card.locator(".todayRowTopActions > *").evaluateAll((nodes) =>
    nodes.map((node) => node.className),
  );
  const hereIndex = order.findIndex((name) => name.includes("todayHereBadge"));
  const hintIndex = order.findIndex((name) => name.includes("rowKeyHint"));
  const menuIndex = order.findIndex((name) => name.includes("todayRowMenu"));
  expect(hereIndex).toBeGreaterThanOrEqual(0);
  expect(hintIndex).toBe(hereIndex + 1);
  expect(menuIndex).toBe(hintIndex + 1);

  await card.focus();
  await page.keyboard.press("Shift+Tab");
  for (let index = 0; index < 80; index += 1) {
    await page.keyboard.press("Tab");
    if (await card.evaluate((node) => node === document.activeElement)) break;
  }
  await expect(card).toBeFocused();
  await expect(hint).toBeVisible();
  const hintBox = (await hint.boundingBox())!;
  const menuBox = (await card.locator(".todayRowMenu").boundingBox())!;
  expect(hintBox.x + hintBox.width + 4).toBeLessThanOrEqual(menuBox.x);
  expect(Math.abs(hintBox.y + hintBox.height / 2 - (menuBox.y + menuBox.height / 2))).toBeLessThanOrEqual(
    2,
  );
});

test("P10-14e 7 / G3 every size shows the 外す label with room beside the timer", async ({
  page,
}) => {
  await prepare(page);
  const sizes = ["standard", "large", "xlarge"] as const;
  const widths = [1920, 1440, 1280, 960, 860] as const;

  for (const width of widths) {
    await page.setViewportSize({ width, height: 680 });
    for (const size of sizes) {
      await setDisplaySize(page, size);
      await page.evaluate(async () => document.fonts.ready);
      const cards = page.locator(".todayRow");
      await expect(cards.first()).toBeVisible();
      const cardCount = await cards.count();
      for (let index = 0; index < cardCount; index += 1) {
        const card = cards.nth(index);
        await card.hover();
        const cardBox = (await card.boundingBox())!;
        const button = card.getByRole("button", { name: "今日の3件から外す" });
        await expect(button).toHaveCSS("opacity", "1");
        const buttonBox = (await button.boundingBox())!;
        const label = button.locator(".todayRemoveLabel");
        await expect(label, `${width}/${size} label`).toBeVisible();
        await expect(label).toHaveText("外す");
        expect((await label.boundingBox())!.width).toBeGreaterThan(0);
        const timerBox = (await card.locator(".todayTimerCluster").boundingBox())!;
        expect(
          timerBox.x - (buttonBox.x + buttonBox.width),
          `${width}/${size} gap`,
        ).toBeGreaterThanOrEqual(4);
        expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
        expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
        await expect(button).toHaveAttribute("title");
      }
    }
  }
});

test("P10-18c R1 Today card remove button appears only on card hover or focus-within, and dims to 0.45 while running", async ({
  page,
}) => {
  await prepare(page);
  await page.mouse.move(4, 4);
  const firstCard = page.locator(".todayRow").first();
  const removeButton = firstCard.locator(".todayRemoveButton");
  const timerStart = firstCard.locator(".todayStartButton--short");

  // Resting (no hover, no focus): opacity 0, layout space preserved.
  const restTimerBox = (await timerStart.boundingBox())!;
  const restRemoveBox = (await removeButton.boundingBox())!;
  await expect(removeButton).toHaveCSS("opacity", "0");
  expect(restRemoveBox.width).toBeGreaterThan(0);

  // Card hover: opacity 1, sibling buttons do not shift.
  await firstCard.hover();
  await expect(removeButton).toHaveCSS("opacity", "1");
  const hoverTimerBox = (await timerStart.boundingBox())!;
  expect(Math.abs(hoverTimerBox.x - restTimerBox.x)).toBeLessThanOrEqual(0.5);

  // Move pointer away -> back to 0.
  await page.mouse.move(4, 4);
  await expect(removeButton).toHaveCSS("opacity", "0");

  // Tab focus inside the card -> opacity 1.
  await firstCard.focus();
  await page.keyboard.press("Tab");
  expect(await firstCard.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await expect(removeButton).toHaveCSS("opacity", "1");

  // Running card: disabled remove stays 0 at rest, 0.45 on hover.
  await timerStart.click();
  await expect(removeButton).toBeDisabled();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.mouse.move(4, 4);
  await expect(removeButton).toHaveCSS("opacity", "0");
  await firstCard.hover();
  await expect(removeButton).toHaveCSS("opacity", "0.45");
});

test("F8 the long Project name, state pill, 今やる一手 and Enter never overlap", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].name = "とても長いプロジェクト名が入っている確認用のプロジェクト";
  await prepare(page, fixture, { width: 1440, height: 900 });
  const card = page.locator(".todayRow").first();
  await card.locator(".todayShortTimerButton, .todayStartButton--short").first().click();
  await page.clock.fastForward(3000);

  for (const width of [1440, 960]) {
    await page.setViewportSize({ width, height: 900 });
    await card.focus();
    await page.keyboard.press("Shift+Tab");
    for (let index = 0; index < 80; index += 1) {
      await page.keyboard.press("Tab");
      if (await card.evaluate((node) => node === document.activeElement)) break;
    }
    const boxes = await card
      .locator(
        ".todayItemMeta .projectIdentityName, .todayItemMeta .runningBadge, .todayHereBadge, .rowKeyHint, .todayRowMenu",
      )
      .evaluateAll((nodes) =>
        nodes
          .filter((node) => (node as HTMLElement).offsetParent !== null)
          .map((node) => node.getBoundingClientRect()),
      );
    for (let index = 0; index < boxes.length; index += 1) {
      for (const other of boxes.slice(index + 1)) {
        expect(
          Math.min(boxes[index].right, other.right) - Math.max(boxes[index].left, other.left),
          `${width}px`,
        ).toBeLessThanOrEqual(1);
      }
    }
  }
});
