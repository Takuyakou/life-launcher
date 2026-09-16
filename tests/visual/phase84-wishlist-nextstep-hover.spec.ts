import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type VisualQaControl = {
  currentConfig: () => AppConfig;
};

async function prepare(page: Page, fixture: VisualQaFixture, width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  await expect(page.locator(".inboxRow")).toHaveCount(fixture.config.inbox.length);
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function style(locator: Locator) {
  return locator.evaluate((node) => {
    const computed = getComputedStyle(node);
    const rect = node.getBoundingClientRect();
    return {
      opacity: computed.opacity,
      display: computed.display,
      backgroundColor: computed.backgroundColor,
      borderColor: computed.borderColor,
      color: computed.color,
      borderRadius: computed.borderRadius,
      fontWeight: computed.fontWeight,
      right: rect.right,
      height: rect.height,
    };
  });
}

test("P84 Wishlist promote action is status-aware, stable, keyboard reachable, and reuses promotion", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.projects.push({
    id: "sample-unset",
    name: "未設定プロジェクト",
    weeklyFocus: false,
    colorId: "amber",
  });
  const selectedWishlist = fixture.config.inbox.find((item) => item.id === "sample-weekend")!;
  fixture.config.today.items.push({
    text: selectedWishlist.text,
    done: false,
    sourceKey: `wishlist:${selectedWishlist.id}`,
    projectId: selectedWishlist.projectId,
  });
  const originalToday = structuredClone(fixture.config.today);
  await prepare(page, fixture);

  const plain = page.locator('[data-inbox-id="sample-later"]');
  const selected = page.locator('[data-inbox-id="sample-weekend"]');
  const plainAction = plain.getByRole("button", { name: "あとで確認するサンプルの次の一手を設定" });
  const selectedAction = selected.getByRole("button", {
    name: "週末に試すアイデアの次の一手を設定",
  });
  const plainMenu = plain.locator(".sourceRowMenu");
  const selectedMenu = selected.locator(".sourceRowMenu");
  const selectedStatus = selected.locator(".wishlistTodayStatus");

  await expect(plain.locator(".wishlistTodayStatus")).toHaveCount(0);
  await expect(selectedStatus).toHaveText("✓ 今日の3件");
  await expect(plainAction).toHaveCSS("opacity", "0");
  await expect(selectedAction).toHaveCSS("opacity", "0");
  await expect(plainMenu).toHaveCSS("opacity", "1");
  await expect(selectedMenu).toHaveCSS("opacity", "1");
  expect(
    await plain
      .locator(".wishlistRowActions > *")
      .evaluateAll((nodes) => nodes.map((node) => node.className)),
  ).toEqual(["wishlistNextStepSlot", "sourceRowMenu"]);
  expect(
    await selected
      .locator(".wishlistRowActions > *")
      .evaluateAll((nodes) => nodes.map((node) => node.className)),
  ).toEqual(["wishlistNextStepSlot", "wishlistTodayStatus", "sourceRowMenu"]);

  const setButton = page.getByRole("button", { name: "次の一手を設定", exact: true });
  const setBase = await style(setButton);
  await setButton.hover();
  await page.waitForTimeout(140);
  const setHover = await style(setButton);
  await page.mouse.move(1, 1);

  const plainBefore = await style(plain);
  const plainMenuBefore = await style(plainMenu);
  await page.locator(".inboxBand").screenshot({
    path: "dist/visual-qa/phase84/wishlist-promote-normal.png",
  });
  await plain.hover();
  await page.waitForTimeout(140);
  await expect(plainAction).toHaveCSS("opacity", "1");
  const revealedAction = await style(plainAction);
  expect(revealedAction.backgroundColor).toBe(setBase.backgroundColor);
  expect(revealedAction.borderColor).toBe(setBase.borderColor);
  expect(revealedAction.color).toBe(setBase.color);
  expect(revealedAction.borderRadius).toBe("8px");
  expect(revealedAction.fontWeight).toBe(setHover.fontWeight);
  const plainAfter = await style(plain);
  const plainMenuAfter = await style(plainMenu);
  expect(plainAfter.height).toBe(plainBefore.height);
  expect(plainMenuAfter.right).toBeCloseTo(plainMenuBefore.right, 1);

  const selectedMenuBefore = await style(selectedMenu);
  const selectedStatusBefore = await style(selectedStatus);
  await selected.hover();
  await page.waitForTimeout(140);
  await expect(selectedAction).toHaveCSS("opacity", "1");
  expect((await style(selectedMenu)).right).toBeCloseTo(selectedMenuBefore.right, 1);
  expect((await style(selectedStatus)).right).toBeCloseTo(selectedStatusBefore.right, 1);
  await page.locator(".inboxBand").screenshot({
    path: "dist/visual-qa/phase84/wishlist-promote-selected-hover.png",
  });

  await selected.hover();
  await selectedAction.hover();
  await page.waitForTimeout(140);
  const promoteHover = await style(selectedAction);
  expect(promoteHover.backgroundColor).toBe(setHover.backgroundColor);
  expect(promoteHover.borderColor).toBe(setHover.borderColor);
  expect(promoteHover.color).toBe(setHover.color);

  await page.mouse.move(1, 1);
  await page.waitForTimeout(140);
  await expect(selectedAction).toHaveCSS("opacity", "0");
  await selectedAction.focus();
  await expect(selectedAction).toBeFocused();
  await expect(selectedAction).toHaveCSS("opacity", "1");
  await selectedAction.press("Enter");
  const dialog = page.getByRole("dialog", { name: /次の一手を(設定|変更)/ });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "やりたいことへ戻す" })).toBeVisible();
  expect((await currentConfig(page)).today).toEqual(originalToday);
  await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();

  await page.setViewportSize({ width: 520, height: 900 });
  await expect(selected.locator(".wishlistNextStepSlot")).toHaveCSS("display", "none");
  await expect(selectedStatus).toBeVisible();
  await expect(selectedMenu).toBeVisible();
  expect(
    await page.locator(".inboxBand").evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.locator(".inboxBand").screenshot({
    path: "dist/visual-qa/phase84/wishlist-promote-narrow.png",
  });
});

test("P84 Today activity reserves the standard trailing action space", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);

  const header = page.locator(".todayActivityBand .disclosureHeader");
  const badge = header.locator(".todayActivityAutoBadge");
  const [headerBox, badgeBox] = await Promise.all([header.boundingBox(), badge.boundingBox()]);
  expect(headerBox).not.toBeNull();
  expect(badgeBox).not.toBeNull();
  const trailingSpace = headerBox!.x + headerBox!.width - (badgeBox!.x + badgeBox!.width);
  expect(trailingSpace).toBeGreaterThanOrEqual(36);
  expect(trailingSpace).toBeLessThanOrEqual(58);
  await header.screenshot({ path: "dist/visual-qa/phase84/today-activity-trailing-space.png" });
});
