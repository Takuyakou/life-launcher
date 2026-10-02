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
  fixture.config.projects[0].nextStep = {
    ...fixture.config.projects[0].nextStep!,
    sourceWishlistId: selectedWishlist.id,
  };
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
  const selectedNextStepStatus = selected.locator(".wishlistNextStepStatus");

  await expect(plain.locator(".wishlistTodayStatus")).toHaveCount(0);
  await expect(selectedStatus).toHaveText("✓ 今日の3件に設定済み");
  await expect(selectedNextStepStatus).toHaveText("✓ 次の一手に設定済み");
  await expect(plainAction).toHaveCSS("opacity", "0");
  await expect(selectedAction).toHaveCount(0);
  await expect(selected.locator(".sourceLockBadge--wishlist")).toHaveCount(1);
  await expect(plainMenu).toHaveCSS("opacity", "1");
  await expect(selectedMenu).toHaveCSS("opacity", "1");
  await selected.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "次の一手に設定済み" })).toBeDisabled();
  await page.keyboard.press("Escape");

  await page.mouse.move(1, 1);

  const plainBefore = await style(plain);
  const plainMenuBefore = await style(plainMenu);
  await plain.hover();
  await page.waitForTimeout(140);
  await expect(plainAction).toHaveCSS("opacity", "1");

  const plainAfter = await style(plain);
  const plainMenuAfter = await style(plainMenu);
  expect(plainAfter.height).toBe(plainBefore.height);
  expect(plainMenuAfter.right).toBeCloseTo(plainMenuBefore.right, 1);

  const selectedMenuBefore = await style(selectedMenu);
  const selectedStatusBefore = await style(selectedStatus);
  await selected.hover();
  await page.waitForTimeout(140);
  await expect(selectedAction).toHaveCount(0);
  expect((await style(selectedMenu)).right).toBeCloseTo(selectedMenuBefore.right, 1);
  expect((await style(selectedStatus)).right).toBeCloseTo(selectedStatusBefore.right, 1);

  await page.mouse.move(1, 1);
  await page.waitForTimeout(140);
  await expect(plainAction).toHaveCSS("opacity", "0");
  await plainAction.focus();
  await expect(plainAction).toBeFocused();
  await expect(plainAction).toHaveCSS("opacity", "1");
  await plainAction.press("Enter");
  const dialog = page.getByRole("dialog", { name: /次の一手を(設定|変更)/ });
  await expect(dialog).toBeVisible();
  expect((await currentConfig(page)).today).toEqual(originalToday);
  await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();

  await page.setViewportSize({ width: 520, height: 900 });
  await expect(selected.locator(".wishlistNextStepSlot")).toHaveCSS("display", "none");
  await expect(selectedNextStepStatus).toBeVisible();
  await expect(selectedStatus).toBeVisible();
  await expect(selectedMenu).toBeVisible();
  const actions = await selected.locator(".wishlistRowActions > *:visible").evaluateAll((nodes) =>
    nodes.map((node) => {
      const rect = node.getBoundingClientRect();
      return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
    }),
  );
  for (let i = 0; i < actions.length; i += 1) {
    for (const other of actions.slice(i + 1)) {
      const current = actions[i];
      expect(
        Math.min(current.right, other.right) - Math.max(current.left, other.left) > 1 &&
        Math.min(current.bottom, other.bottom) - Math.max(current.top, other.top) > 1,
      ).toBe(false);
    }
  }
  expect(
    await page.locator(".inboxBand").evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
});
