import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import {
  groupWishlist,
  groupWishlistForDisplay,
  reorderWishlistGroups,
} from "../../src/nextStepWishlist";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type Control = {
  currentConfig: () => AppConfig;
};

async function prepare(
  page: Page,
  fixture = createFullTodayFixture(),
  size: "standard" | "large" | "xlarge" = "standard",
) {
  fixture.config.settings.mainDisplaySize = size;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") {
    await disclosure.click();
  }
  await expect(page.locator(".inboxBody")).toBeVisible();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() => {
    const control = (
      window as typeof window & { __LIFE_LAUNCHER_VISUAL_QA__: Control }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    return control.currentConfig();
  });
}

test("the display puts 未分類 last without changing config.inbox", () => {
  const config = createFullTodayFixture().config;
  const before = structuredClone(config.inbox);
  const display = groupWishlistForDisplay(config);

  expect(groupWishlist(config).map((group) => group.key)).toEqual([
    "unassigned",
    "project:sample-learning",
    "project:sample-writing",
    "project:sample-stretch",
    "project:sample-home",
  ]);
  expect(display.map((group) => group.key)).toEqual([
    "project:sample-learning",
    "project:sample-writing",
    "project:sample-stretch",
    "project:sample-home",
    "unassigned",
  ]);
  expect(config.inbox).toEqual(before);
});

test("未分類 cannot be dragged, and a group dropped after it goes before it", () => {
  const config = createFullTodayFixture().config;
  const learning = "project:sample-learning";

  expect(reorderWishlistGroups(config, "unassigned", learning, "before")).toBe(config);

  const moved = reorderWishlistGroups(config, learning, "unassigned", "after");
  expect(moved.inbox[0]).toMatchObject({ id: "sample-weekend", projectId: "sample-learning" });
  expect(groupWishlistForDisplay(moved).at(-1)?.key).toBe("unassigned");
  expect(groupWishlist(moved).map((group) => group.key)).toEqual([
    learning,
    "unassigned",
    "project:sample-writing",
    "project:sample-stretch",
    "project:sample-home",
  ]);
});

test("the wishlist section shows the new hierarchy and color lines", async ({ page }) => {
  await prepare(page);
  const groups = page.locator(".wishlistGroup");
  await expect(groups).toHaveCount(5);
  await expect(groups.last()).toHaveAttribute("data-wishlist-group", "unassigned");
  await expect(groups.last().locator(".wishlistGroupHeader")).toContainText("未分類");
  expect(
    await groups
      .last()
      .evaluate((element) => element === element.parentElement?.lastElementChild),
  ).toBe(true);

  const learningHeader = page.locator(
    '[data-wishlist-group="project:sample-learning"] .wishlistGroupHeader',
  );
  await expect(learningHeader).toHaveCSS("border-bottom-width", "0px");
  await expect(learningHeader).toHaveCSS("color", "rgb(184, 176, 160)");
  await expect(learningHeader).toHaveCSS("font-weight", "600");

  const learningItem = page.locator('[data-inbox-id="sample-weekend"]');
  await expect(learningItem).toHaveCSS("border-left-color", "rgb(112, 167, 255)");
  await expect(learningItem).toHaveCSS("border-radius", "0px");
  await expect(learningItem).toHaveCSS("min-height", "40px");
  await expect(learningItem.locator(".inboxItemText")).toHaveCSS("font-weight", "500");

  const unassignedItem = page.locator('[data-inbox-id="sample-later"]');
  await expect(unassignedItem).toHaveCSS("border-left-color", "rgb(74, 70, 57)");
});

for (const size of ["standard", "large", "xlarge"] as const) {
  test(`header names and item text share the body size (${size})`, async ({ page }) => {
    await prepare(page, createFullTodayFixture(), size);
    const headerName = page.locator(
      '[data-wishlist-group="project:sample-learning"] .wishlistGroupHeader .projectIdentityName',
    );
    const unassignedName = page.locator(
      '[data-wishlist-group="unassigned"] .wishlistGroupHeader > strong',
    );
    const itemText = page.locator('[data-inbox-id="sample-weekend"] .inboxItemText');
    const headerRow = page.locator('[data-inbox-id="sample-weekend"]');

    const metrics = async (locator: typeof headerName) =>
      locator.evaluate((element) => {
        const style = getComputedStyle(element);
        return {
          fontSize: style.fontSize,
          fontWeight: Number(style.fontWeight),
          color: style.color,
        };
      });
    const header = await metrics(headerName);
    const unassigned = await metrics(unassignedName);
    const item = await metrics(itemText);

    expect(header.fontSize, size).toBe(item.fontSize);
    expect(unassigned.fontSize, size).toBe(header.fontSize);
    expect(unassigned.fontWeight, size).toBe(header.fontWeight);
    expect(unassigned.color, size).toBe(header.color);
    expect(header.fontWeight, size).toBeGreaterThan(item.fontWeight);
    await expect(headerRow).toHaveCSS("border-radius", "0px");
    await expect(headerRow).toHaveCSS("min-height", "40px");
  });
}

test("the wishlist section keeps the new layout", async ({ page }) => {
  await prepare(page);
  await expect(page.locator(".inboxBand")).toHaveScreenshot("phase97-wishlist-layout.png", {
    maxDiffPixels: 12,
  });
});

test("the keyboard order ends at 未分類", async ({ page }) => {
  await prepare(page);
  const unassignedHeader = page.locator(
    '[data-wishlist-group="unassigned"] .wishlistGroupHeader',
  );
  await unassignedHeader.focus();
  await page.keyboard.press("Shift+Tab");
  const previousGroup = await page.evaluate(() =>
    document.activeElement?.closest(".wishlistGroup")?.getAttribute("data-wishlist-group"),
  );
  expect(previousGroup).not.toBe("unassigned");
  await page.keyboard.press("Tab");
  await expect(unassignedHeader).toBeFocused();
});

test("the 未分類 header cannot start a group drag", async ({ page }) => {
  await prepare(page);
  const unassignedHeader = page.locator(
    '[data-wishlist-group="unassigned"] .wishlistGroupHeader',
  );
  const learningHeader = page.locator(
    '[data-wishlist-group="project:sample-learning"] .wishlistGroupHeader',
  );
  await unassignedHeader.scrollIntoViewIfNeeded();
  const from = (await unassignedHeader.boundingBox())!;
  const to = (await learningHeader.boundingBox())!;

  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + 20, to.y + 5, { steps: 5 });
  await expect(page.locator(".wishlistGroupDragGhost")).toHaveCount(0);
  await page.mouse.up();
  expect((await currentConfig(page)).inbox[0]?.id).toBe("sample-later");
});

test("dragging a group after 未分類 keeps 未分類 last on screen", async ({ page }) => {
  await prepare(page);
  const learningHeader = page.locator(
    '[data-wishlist-group="project:sample-learning"] .wishlistGroupHeader',
  );
  const unassignedHeader = page.locator(
    '[data-wishlist-group="unassigned"] .wishlistGroupHeader',
  );
  await learningHeader.scrollIntoViewIfNeeded();
  const from = (await learningHeader.boundingBox())!;
  const to = (await unassignedHeader.boundingBox())!;

  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 32, from.y + from.height / 2, { steps: 2 });
  await expect(page.locator(".wishlistGroupDragGhost")).toBeVisible();
  await page.mouse.move(to.x + 20, to.y + to.height - 3, { steps: 5 });
  await expect(page.locator(".wishlistGroupDropIndicator")).toBeVisible();
  await page.mouse.up();

  await expect.poll(async () => (await currentConfig(page)).inbox[0]?.id).toBe("sample-weekend");
  const keys = await page
    .locator(".wishlistGroup")
    .evaluateAll((elements) => elements.map((element) => element.getAttribute("data-wishlist-group")));
  expect(keys.at(-1)).toBe("unassigned");
});
