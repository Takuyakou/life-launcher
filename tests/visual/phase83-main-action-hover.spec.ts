import { expect, test, type Locator, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type ActionStyle = {
  backgroundColor: string;
  borderColor: string;
  boxShadow: string;
  color: string;
  filter: string;
  height: number;
  transform: string;
  transitionDuration: string;
  transitionProperty: string;
  width: number;
};

function actionFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.projects[1].nextStep = undefined;
  fixture.config.today.candidateExcludedSourceKeys = ["wishlist:sample-later"];
  fixture.doNowCandidates = fixture.doNowCandidates.filter(
    (candidate) => candidate.projectId === "sample-learning",
  );
  fixture.staleProjectIds = ["sample-learning"];
  return fixture;
}

async function prepare(
  page: Page,
  fixture = actionFixture(),
  width = 1440,
  reducedMotion: "no-preference" | "reduce" = "no-preference",
) {
  await page.emulateMedia({ reducedMotion });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function readStyle(locator: Locator): Promise<ActionStyle> {
  return locator.evaluate((element) => {
    const style = getComputedStyle(element);
    const htmlElement = element as HTMLElement;
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      color: style.color,
      filter: style.filter,
      height: htmlElement.offsetHeight,
      transform: style.transform,
      transitionDuration: style.transitionDuration,
      transitionProperty: style.transitionProperty,
      width: htmlElement.offsetWidth,
    };
  });
}

async function openDisclosure(disclosure: Locator) {
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") {
    await disclosure.click();
  }
}

async function pressStyle(page: Page, locator: Locator): Promise<ActionStyle> {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(140);
  const style = await readStyle(locator);
  await page.mouse.up();
  return style;
}

async function expectActionHover(page: Page, locator: Locator) {
  const initial = await readStyle(locator);
  await locator.hover();
  await page.waitForTimeout(140);
  const hovered = await readStyle(locator);
  expect(hovered.transform).not.toBe("none");
  expect(hovered.backgroundColor).not.toBe(initial.backgroundColor);
  expect(hovered.borderColor).not.toBe(initial.borderColor);
  expect(hovered.boxShadow).not.toBe("none");
  expect(hovered.width).toBe(initial.width);
  expect(hovered.height).toBe(initial.height);
  return { hovered, initial };
}

async function expectExcludedHover(
  page: Page,
  locator: Locator,
  colorBehavior: "stable" | "weak-change" = "stable",
) {
  await expect(locator).not.toHaveClass(/mainActionButton/);
  const initial = await readStyle(locator);
  await locator.hover({ force: true });
  await page.waitForTimeout(140);
  const hovered = await readStyle(locator);
  expect(hovered.transform).toBe(initial.transform);
  expect(hovered.boxShadow).toBe(initial.boxShadow);
  expect(hovered.width).toBe(initial.width);
  expect(hovered.height).toBe(initial.height);
  if (colorBehavior === "stable") {
    expect(hovered.color).toBe(initial.color);
  } else {
    expect(hovered.color).not.toBe(initial.color);
  }
}

async function expectNoOverlap(container: Locator, selector: string) {
  const overlaps = await container.locator(selector).evaluateAll((elements) => {
    const visible = elements
      .filter((element) => {
        const style = getComputedStyle(element);
        return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0;
      })
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
      });
    return visible.flatMap((a, index) =>
      visible.slice(index + 1).filter((b) => {
        const overlapX = Math.min(a.right, b.right) - Math.max(a.left, b.left);
        const overlapY = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
        return overlapX > 0.5 && overlapY > 0.5;
      }),
    ).length;
  });
  expect(overlaps).toBe(0);
}

test("P83-03 semantic modifiers win existing selector specificity", async ({ page }) => {
  await prepare(page);
  await page.locator(".mainScrollArea").evaluate((container) => {
    const banner = document.createElement("section");
    banner.className = "banner";
    banner.innerHTML =
      '<button class="bannerButton mainActionButton mainActionButton--neutral">復元</button>';
    container.prepend(banner);
  });
  const syntheticBanner = page.locator(".bannerButton");
  expect(await readStyle(syntheticBanner)).toMatchObject({
    backgroundColor: "rgb(33, 31, 26)",
    borderColor: "rgb(74, 70, 57)",
    color: "rgb(163, 156, 142)",
  });
});

test("P83-03 Today empty CTA receives the neutral normal palette", async ({ page }) => {
  const fixture = actionFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);
  expect(await readStyle(page.locator(".todayEmptyStateContent > button"))).toMatchObject({
    backgroundColor: "rgb(33, 31, 26)",
    borderColor: "rgb(74, 70, 57)",
    color: "rgb(163, 156, 142)",
  });
});

test("P83-03 Records positive action wins its existing neutral rule", async ({ page }) => {
  await prepare(page);
  await page.locator(".topPills .viewToggleButton").filter({ hasText: "記録" }).click();
  await page.getByRole("tab", { name: "今週を決める" }).click();
  const shortAction = page.getByRole("button", { name: "短時間で試す" });
  expect(await readStyle(shortAction)).toMatchObject({
    backgroundColor: "rgb(39, 52, 43)",
    borderColor: "rgba(111, 207, 151, 0.45)",
    color: "rgb(111, 207, 151)",
  });
});

test("P83-03 gold and neutral actions share the 120ms interaction primitive", async ({
  page,
}) => {
  await prepare(page);
  const gold = page.locator(".nextStepHeaderAdd--project");
  const neutral = page.locator(".nextStepRowAction").first();
  const initialGold = await readStyle(gold);
  const initialNeutral = await readStyle(neutral);

  await expect(gold).toHaveClass(/mainActionButton--gold/);
  await expect(neutral).toHaveClass(/mainActionButton--neutral/);
  expect(initialGold.transitionProperty).toContain("transform");
  expect(initialGold.transitionDuration.split(",").map((value) => value.trim())).toContain("0.12s");
  expect(initialGold.backgroundColor).not.toBe(initialNeutral.backgroundColor);

  await expectActionHover(page, neutral);

  await page.mouse.move(1, 1);
  await neutral.focus();
  await page.waitForTimeout(140);
  const focused = await readStyle(neutral);
  expect(focused.transform).not.toBe("none");
  expect(focused.boxShadow).not.toBe("none");

  const pressed = await pressStyle(page, neutral);
  expect(pressed.transform).toContain("0.985");
  expect(pressed.width).toBe(initialNeutral.width);
  expect(pressed.height).toBe(initialNeutral.height);
  await page.mouse.up();
});

test("P83-03 edit and configure buttons use one neutral grammar", async ({ page }) => {
  await prepare(page);
  const change = page.getByRole("button", { name: "変更", exact: true });
  const configure = page.getByRole("button", { name: "次の一手を設定", exact: true });
  await expect(change).toHaveCount(1);
  await expect(configure).toHaveCount(1);
  await expect(change).toHaveClass(/mainActionButton--neutral/);
  await expect(configure).toHaveClass(/mainActionButton--neutral/);

  const changeStyle = await readStyle(change);
  const configureStyle = await readStyle(configure);
  expect(configureStyle.backgroundColor).toBe(changeStyle.backgroundColor);
  expect(configureStyle.borderColor).toBe(changeStyle.borderColor);
  expect(configureStyle.color).toBe(changeStyle.color);
});

test("P83-03 adoption and restore actions preserve the positive semantic", async ({ page }) => {
  await prepare(page);
  await openDisclosure(page.locator(".todayBuilderDisclosure"));
  await openDisclosure(page.locator(".inboxBand .disclosure"));

  const adoption = page.locator(".todayBuilderAddButton").first();
  const restore = page.locator(".wishlistRestoreButton");
  await expect(adoption).toBeVisible();
  await expect(restore).toBeVisible();
  await expect(adoption).toHaveClass(/mainActionButton--positive/);
  await expect(restore).toHaveClass(/mainActionButton--positive/);

  const adoptionStyle = await readStyle(adoption);
  const restoreStyle = await readStyle(restore);
  expect(adoptionStyle.color).toBe(restoreStyle.color);
  expect(adoptionStyle.backgroundColor).toBe(restoreStyle.backgroundColor);

  const { initial, hovered } = await expectActionHover(page, adoption);
  expect(hovered.backgroundColor).toBe("rgb(48, 66, 53)");
  const pressed = await pressStyle(page, adoption);
  expect(pressed.backgroundColor).toBe("rgb(34, 49, 40)");
  expect(pressed.transform).toContain("0.985");
  expect(pressed.width).toBe(initial.width);
  expect(pressed.height).toBe(initial.height);
});

test("P83-03 gold create hover and active keep their dimensions", async ({ page }) => {
  await prepare(page);
  const gold = page.locator(".nextStepHeaderAdd--project");
  const { initial, hovered } = await expectActionHover(page, gold);
  expect(hovered.backgroundColor).toBe("rgba(231, 185, 77, 0.18)");
  expect(hovered.borderColor).toBe("rgb(231, 185, 77)");
  const pressed = await pressStyle(page, gold);
  expect(pressed.backgroundColor).toBe("rgba(231, 185, 77, 0.08)");
  expect(pressed.transform).toContain("0.985");
  expect(pressed.width).toBe(initial.width);
  expect(pressed.height).toBe(initial.height);
  await page.keyboard.press("Escape");
});

test("P83-03 Do Now alternate is neutral without an accent important override", async ({
  page,
}) => {
  await prepare(page, createPublicFixture());
  const alternate = page.getByRole("button", { name: "他の一手" });
  expect(await readStyle(alternate)).toMatchObject({
    backgroundColor: "rgb(33, 31, 26)",
    borderColor: "rgb(74, 70, 57)",
    color: "rgb(163, 156, 142)",
  });
  const { hovered } = await expectActionHover(page, alternate);
  expect(hovered.borderColor).toBe("rgb(184, 176, 160)");
  expect(hovered.borderColor).not.toBe("rgb(231, 185, 77)");
});

test("P83-03 Today instruction and remove actions keep neutral geometry", async ({ page }) => {
  await prepare(page);
  const card = page.locator(".todayRow").first();
  const cardSize = await readStyle(card);
  for (const action of [
    card.locator(".todayInstructionButton"),
    card.locator(".todayRemoveButton"),
  ]) {
    expect(await readStyle(action)).toMatchObject({
      backgroundColor: "rgb(33, 31, 26)",
      borderColor: "rgb(74, 70, 57)",
      color: "rgb(163, 156, 142)",
    });
    await expectActionHover(page, action);
    expect((await readStyle(card)).width).toBe(cardSize.width);
    expect((await readStyle(card)).height).toBe(cardSize.height);
  }
});

test("P83-03 reduced motion and disabled actions never move", async ({ page }) => {
  const fixture = actionFixture();
  fixture.config.today.items.push({
    text: "3件目のサンプル",
    done: false,
    sourceKey: "manual:p83-disabled",
  });
  await prepare(page, fixture, 1440, "reduce");
  await openDisclosure(page.locator(".todayBuilderDisclosure"));

  const enabled = page.locator(".nextStepRowAction").first();
  await enabled.hover();
  await page.waitForTimeout(140);
  const reduced = await readStyle(enabled);
  expect(reduced.transform).toBe("none");
  expect(reduced.transitionProperty).not.toContain("transform");

  const disabled = page.locator(".todayBuilderAddButton").first();
  await expect(disabled).toBeDisabled();
  await disabled.hover({ force: true });
  const disabledStyle = await readStyle(disabled);
  expect(disabledStyle.transform).toBe("none");
  expect(disabledStyle.boxShadow).toBe("none");
});

test("P83-03 excluded controls retain their weak hover geometry and colors", async ({ page }) => {
  await prepare(page);
  await openDisclosure(page.locator(".todayBuilderDisclosure"));

  await expectExcludedHover(page, page.locator(".quickButton").first());
  await expectExcludedHover(page, page.locator(".todayBuilderDisclosure"));
  await expectExcludedHover(page, page.locator(".todayBuilderRow").first());
  await expectExcludedHover(page, page.locator(".todayBuilderSelectedStatus"));
  await expectExcludedHover(
    page,
    page.locator(".topPills .viewToggleButton").first(),
    "weak-change",
  );
  await expectExcludedHover(
    page,
    page.locator(".todayBuilderRow .sourceRowMenu").first(),
    "weak-change",
  );

  await page.locator(".nextStepActionRegion").first().click({ button: "right" });
  const contextRow = page.locator(".contextMenu button").first();
  await expect(contextRow).toBeVisible();
  await expectExcludedHover(page, contextRow);
});

test("P83-03 timer controls and NextStep cards keep their established dimensions", async ({
  page,
}) => {
  await prepare(page);
  const timerContracts: Array<{
    backgroundColor: string;
    button: Locator;
    color: string;
    height: number;
    width: number;
  }> = [
    {
      backgroundColor: "rgb(32, 49, 38)",
      button: page.locator(".doNowStartPrimary"),
      color: "rgb(111, 207, 151)",
      height: 38,
      width: 100,
    },
    {
      backgroundColor: "rgb(37, 45, 56)",
      button: page.locator(".doNowStartSecondary"),
      color: "rgb(169, 208, 255)",
      height: 38,
      width: 100,
    },
    {
      backgroundColor: "rgba(190, 181, 164, 0.08)",
      button: page.locator(".doNowMeasureButton"),
      color: "rgb(209, 201, 187)",
      height: 38,
      width: 82,
    },
    {
      backgroundColor: "rgb(39, 52, 43)",
      button: page.locator(".todayRow").first().locator(".todayStartButton--short"),
      color: "rgb(111, 207, 151)",
      height: 38,
      width: 88,
    },
    {
      backgroundColor: "rgb(37, 45, 56)",
      button: page.locator(".todayRow").first().locator(".todayStartButton--normal"),
      color: "rgb(169, 208, 255)",
      height: 38,
      width: 88,
    },
    {
      backgroundColor: "rgba(190, 181, 164, 0.08)",
      button: page.locator(".todayRow").first().locator(".todayMeasureButton"),
      color: "rgb(209, 201, 187)",
      height: 38,
      width: 36,
    },
  ];
  for (const { backgroundColor, button, color, height, width } of timerContracts) {
    await expect(button).not.toHaveClass(/mainActionButton/);
    const initial = await readStyle(button);
    expect(initial.backgroundColor).toBe(backgroundColor);
    expect(initial.color).toBe(color);
    expect(initial.width).toBe(width);
    expect(initial.height).toBe(height);
    await button.hover();
    await page.waitForTimeout(140);
    const hovered = await readStyle(button);
    expect(hovered.width).toBe(width);
    expect(hovered.height).toBe(height);
  }

  const card = page.locator(".nextStepRow").first();
  const before = await readStyle(card);
  await card.locator(".nextStepRowAction").hover();
  await page.waitForTimeout(140);
  const after = await readStyle(card);
  expect(after.width).toBe(before.width);
  expect(after.height).toBe(before.height);
});

test("P83-03 Records actions use semantic classes without changing tabs or filters", async ({
  page,
}) => {
  await prepare(page);
  await page
    .locator(".topPills .viewToggleButton")
    .filter({ hasText: "記録" })
    .click();
  await expect(page.locator(".recordsBackButton")).toHaveClass(/mainActionButton--neutral/);
  await expect(page.locator(".recordsTab").first()).not.toHaveClass(/mainActionButton/);

  await page.getByRole("tab", { name: "今週を決める" }).click();
  await expect(page.getByRole("button", { name: "書き直す" })).toHaveClass(
    /mainActionButton--neutral/,
  );
  await expect(page.getByRole("button", { name: "短時間で試す" })).toHaveClass(
    /mainActionButton--positive/,
  );

  await page.getByRole("tab", { name: "すべての記録" }).click();
  await expect(page.getByRole("button", { name: "実行記録を追加" })).toHaveClass(
    /mainActionButton--gold/,
  );
  await expect(page.locator(".segmentButton").first()).not.toHaveClass(/mainActionButton/);
  await expect(page.locator(".filterChip").first()).not.toHaveClass(/mainActionButton/);
});

for (const width of [1920, 1440, 1000, 860, 620]) {
  test(`P83-03 Main actions remain bounded at ${width}px`, async ({ page }) => {
    await prepare(page, actionFixture(), width);
    await openDisclosure(page.locator(".todayBuilderDisclosure"));
    await expect(page.locator(".nextStepHeaderAdd--project")).toBeVisible();
    await expect(page.locator(".nextStepRowAction").first()).toBeVisible();
    expect(
      await page.locator(".mainScrollArea").evaluate(
        (element) => element.scrollWidth <= element.clientWidth + 1,
      ),
    ).toBe(true);
    await expectNoOverlap(
      page.locator(".todayRow").first(),
      ".todayCardFooter button:not(.todayRowMenu)",
    );
    await expectNoOverlap(
      page.locator(".todayBuilderRow").first(),
      ".todayBuilderActions > button",
    );
    const horizontalOverflow = await page.locator(
      ".nextStepRow, .todayRow, .todayBuilderRow",
    ).evaluateAll((elements) =>
      elements.some((element) => {
        const rect = element.getBoundingClientRect();
        const section = element.closest(
          ".projectsBand, .focusBand, .todayBuilderBand",
        )?.getBoundingClientRect();
        return Boolean(section && (rect.left < section.left - 1 || rect.right > section.right + 1));
      }),
    );
    expect(horizontalOverflow).toBe(false);
  });
}
