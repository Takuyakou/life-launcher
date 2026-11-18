import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(
  page: Page,
  fixture = createPublicFixture(),
  viewport = { width: 1280, height: 900 },
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, "main");
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
      await page.waitForTimeout(80);
      const cards = page.locator(".todayRow");
      await expect(cards.first()).toBeVisible();
      const cardCount = await cards.count();
      for (let index = 0; index < cardCount; index += 1) {
        const card = cards.nth(index);
        const cardBox = (await card.boundingBox())!;
        const button = card.getByRole("button", { name: "今日の3件から外す" });
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

test("P10-14e 2 the mini clock uses the same 700 weight as the sidebar clock", async ({
  page,
}) => {  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
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

test("F7 いまここ uses the same Project colour as its dot", async ({ page }) => {
  await prepare(page);
  const badge = page.locator(".todayHereBadge");
  const dot = page
    .locator(".todayRow")
    .filter({ has: badge })
    .locator(".todayProjectIdentity .projectIdentityDot")
    .first();
  const badgeColor = await badge.evaluate((node) => getComputedStyle(node).color);
  const dotColor = await dot.evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(badgeColor).toBe(dotColor);
  expect(await badge.evaluate((node) => getComputedStyle(node).borderTopColor)).not.toBe(
    "rgb(74, 70, 57)",
  );
});

test("F8 the long Project name, state pill, いまここ and Enter never overlap", async ({ page }) => {
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

test("F9 Do Now and Today running buttons match the buttons beside them", async ({ page }) => {
  await prepare(page);
  const sizes = [
    ["standard", 1280],
    ["large", 1600],
    ["xlarge", 1920],
  ] as const;
  for (const [size, width] of sizes) {
    await page.setViewportSize({ width, height: 900 });
    await setDisplaySize(page, size);
    const doNowBefore = await page
      .locator(".doNowStartPrimary, .doNowStartSecondary, .doNowMeasureButton")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          height: node.getBoundingClientRect().height,
          font: getComputedStyle(node).fontSize,
          weight: getComputedStyle(node).fontWeight,
        })),
      );
    await page.locator(".doNowStartPrimary").click();
    await expect(page.locator(".doNowActions .runningPauseButton")).toBeVisible();
    await page.clock.fastForward(1000);
    const doNowAfter = await page
      .locator(".doNowActions .runningPauseButton, .doNowActions .runningStopButton")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          height: node.getBoundingClientRect().height,
          font: getComputedStyle(node).fontSize,
          weight: getComputedStyle(node).fontWeight,
        })),
      );
    const doNow = [...doNowBefore, ...doNowAfter];
    expect(new Set(doNow.map((item) => Math.round(item.height))).size).toBe(1);
    expect(new Set(doNow.map((item) => item.font)).size).toBe(1);
    expect(doNow.every((item) => item.weight === "700")).toBe(true);

    await page.locator(".doNowActions .runningStopButton").click();
    await page.clock.fastForward(500);
    await page.keyboard.press("Escape");
    const card = page.locator(".todayRow").first();
    const todayBefore = await card
      .locator(".todayStartButton--short, .todayStartButton--normal, .todayMeasureButton")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          height: node.getBoundingClientRect().height,
          width: node.getBoundingClientRect().width,
          font: getComputedStyle(node).fontSize,
          weight: getComputedStyle(node).fontWeight,
          radius: getComputedStyle(node).borderRadius,
        })),
      );
    await card.locator(".todayStartButton--short").click();
    await expect(card.locator(".runningPauseButton")).toBeVisible();
    await page.clock.fastForward(3000);
    const todayAfter = await card
      .locator(".runningPauseButton, .runningStopButton")
      .evaluateAll((nodes) =>
        nodes.map((node) => ({
          height: node.getBoundingClientRect().height,
          width: node.getBoundingClientRect().width,
          font: getComputedStyle(node).fontSize,
          weight: getComputedStyle(node).fontWeight,
          radius: getComputedStyle(node).borderRadius,
        })),
      );
    const today = [...todayBefore, ...todayAfter];
    expect(new Set(today.map((item) => Math.round(item.height))).size).toBe(1);
    const labelled = today.filter((item) => item.width > 40);
    expect(new Set(labelled.map((item) => Math.round(item.width))).size).toBe(1);
    expect(new Set(labelled.map((item) => item.font)).size).toBe(1);
    expect(labelled.every((item) => item.weight === "700")).toBe(true);
    expect(today.every((item) => item.radius === "8px")).toBe(true);
    await card.locator(".runningStopButton").click();
    await page.keyboard.press("Escape");
  }
});
