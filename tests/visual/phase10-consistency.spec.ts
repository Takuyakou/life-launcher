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

test("P10-14e 12-2 the key caps share uiKey and the search cap is Ctrl+F", async ({ page }) => {
  await prepare(page);
  const searchKey = page.locator(".topSearchButton .uiKey");
  await expect(searchKey).toHaveText("Ctrl+F");
  const keys = page.locator(".uiKey");
  expect(await keys.count()).toBeGreaterThanOrEqual(2);
  for (let index = 0; index < (await keys.count()); index += 1) {
    const key = keys.nth(index);
    if (!(await key.isVisible())) continue;
    expect(await key.evaluate((node) => getComputedStyle(node).fontSize)).toBe("11px");
    expect(await key.evaluate((node) => getComputedStyle(node).fontWeight)).toBe("700");
    expect(await key.evaluate((node) => getComputedStyle(node).borderRadius)).toBe("5px");
    expect(await key.evaluate((node) => getComputedStyle(node).backgroundColor)).toBe(
      "rgba(0, 0, 0, 0)",
    );
    expect(await key.evaluate((node) => getComputedStyle(node).paddingLeft)).toBe("6px");
    expect(await key.evaluate((node) => getComputedStyle(node).paddingRight)).toBe("6px");
  }
});

test("P10-14e 12-3 the small buttons have the 28px / 11px / 700 base", async ({ page }) => {
  await prepare(page);
  for (const selector of [
    ".nextStepRowAction",
    ".doNowAlternateButton",
    ".sectionAddButton",
    ".nextStepFreshnessButton",
  ]) {
    const button = page.locator(selector).first();
    if ((await button.count()) === 0) continue;
    const box = (await button.boundingBox())!;
    expect(Math.abs(box.height - 28), `${selector} height`).toBeLessThanOrEqual(1);
    expect(await style(page, selector, "font-size"), `${selector} font size`).toBe("11px");
    expect(await style(page, selector, "font-weight"), `${selector} weight`).toBe("700");
    expect(await style(page, selector, "border-radius"), `${selector} radius`).toBe("8px");
  }
  for (const selector of [".todayInstructionButton", ".todayRemoveButton", ".todayTriggerButton"]) {
    const button = page.locator(selector).first();
    if ((await button.count()) === 0) continue;
    expect(await style(page, selector, "font-size"), `${selector} font size`).toBe("11px");
    expect(await style(page, selector, "font-weight"), `${selector} weight`).toBe("700");
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
    [".quickButton", "400"],
    [".quickGroupHeader strong", "700"],
  ];
  for (const [selector, weight] of expected) {
    const locator = page.locator(selector).first();
    if ((await locator.count()) === 0) continue;
    expect(await style(page, selector, "font-weight"), selector).toBe(weight);
  }
});

test("P10-14e 5 the Enter hint sits left of the menu, after いまここ, and only on focus", async ({
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

test("P10-14e 6 the sidebar and search letter icons share the 22px uiLetterIcon", async ({
  page,
}) => {
  await prepare(page);
  const icon = page.locator(".quickButton .uiLetterIcon").first();
  await expect(icon).toBeVisible();
  const box = (await icon.boundingBox())!;
  expect(Math.round(box.width)).toBe(22);
  expect(Math.round(box.height)).toBe(22);
  expect(await icon.evaluate((node) => getComputedStyle(node).fontWeight)).toBe("700");
  expect(await icon.evaluate((node) => getComputedStyle(node).fontSize)).toBe("11px");
  expect(await icon.evaluate((node) => getComputedStyle(node).borderRadius)).toBe("6px");
  const color = await icon.getAttribute("data-project-color");
  expect(color).toBeTruthy();
  expect(await icon.evaluate((node) => getComputedStyle(node).color)).not.toBe("rgba(0, 0, 0, 0)");

  await page.locator(".topSearchButton").click();
  await page.locator(".searchPaletteInput").fill("サンプル");
  const searchIcon = page.locator(".searchPaletteItemIcon.uiLetterIcon").first();
  await expect(searchIcon).toBeVisible();
  const searchBox = (await searchIcon.boundingBox())!;
  expect(Math.round(searchBox.width)).toBe(22);
  expect(Math.round(searchBox.height)).toBe(22);
  expect(await searchIcon.evaluate((node) => getComputedStyle(node).fontWeight)).toBe("700");
});

test("P10-14e 7 the remove button is 28x28 icon-only below the per-size threshold", async ({
  page,
}) => {
  await prepare(page);
  const sizes = ["standard", "large", "xlarge"] as const;
  const thresholds = { standard: 359, large: 369, xlarge: 379 } as const;
  const widths = [860, 960, 1080, 1280, 1440] as const;

  for (const width of widths) {
    await page.setViewportSize({ width, height: 680 });
    for (const size of sizes) {
      await setDisplaySize(page, size);
      const cards = page.locator(".todayRow");
      await expect(cards.first()).toBeVisible();
      const cardCount = await cards.count();
      for (let index = 0; index < cardCount; index += 1) {
        const card = cards.nth(index);
        const cardBox = (await card.boundingBox())!;
        const contentWidth = await card.evaluate((node) => {
          const style = getComputedStyle(node);
          return (
            node.clientWidth -
            Number.parseFloat(style.paddingLeft) -
            Number.parseFloat(style.paddingRight)
          );
        });
        const button = card.getByRole("button", { name: "今日の3件から外す" });
        const buttonBox = (await button.boundingBox())!;
        const label = button.locator(".todayRemoveLabel");
        const labelVisible = await label.isVisible();
        if (contentWidth <= thresholds[size]) {
          expect(labelVisible, `${width}/${size} label hidden at ${contentWidth}`).toBe(false);
          expect(Math.round(buttonBox.width), `${width}/${size} width`).toBe(28);
          expect(Math.round(buttonBox.height), `${width}/${size} height`).toBe(28);
        } else {
          expect(labelVisible, `${width}/${size} label shown at ${contentWidth}`).toBe(true);
        }
        expect(buttonBox.x + buttonBox.width).toBeLessThanOrEqual(cardBox.x + cardBox.width + 1);
        expect(buttonBox.y + buttonBox.height).toBeLessThanOrEqual(cardBox.y + cardBox.height + 1);
        await expect(button).toHaveAttribute("title");
      }
    }
  }
});

test("P10-14e 2 the mini clock uses the same 700 weight as the sidebar clock", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 340, height: 120 });
  await installTauriMock(page, createPublicFixture(), "life-launcher-mini");
  await page.goto("/?view=mini");
  await page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { emit: (event: string, payload?: unknown) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.emit("mini-timer-snapshot", {
      active: true,
      label: "サンプル学習",
      actionText: "資料を1ページ読む",
      mode: "countdown",
      remainingClock: "24:55",
      paused: false,
      progressPercent: 0.33,
      projectId: "sample-learning",
      projectName: "サンプル学習",
      projectColorId: "blue",
    }),
  );
  const clock = page.locator(".timerPanel--mini .timerClock");
  await expect(clock).toBeVisible();
  expect(await clock.evaluate((node) => getComputedStyle(node).fontWeight)).toBe("700");
});
