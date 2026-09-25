import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".todayRow")).toHaveCount(fixture.config.today.items.length);
}

test("unfinished Today3 locks its current NextStep source and removal unlocks it", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);

  const card = page.locator('.nextStepCard[data-project-id="sample-learning"]');
  await expect(card.locator(".sourceLockBadge")).toHaveCount(1);
  await expect(card.locator(".sourceLockBadge")).toHaveCSS("color", "rgb(255, 206, 91)");
  await expect(card.locator(".nextStepTodayStatus")).toHaveText("✓ 今日の3件");
  const lockBox = await card.locator(".sourceLockBadge").boundingBox();
  const statusBox = await card.locator(".nextStepTodayStatus").boundingBox();
  const identityBox = await card.locator(".nextStepProjectRegion .projectIdentity").boundingBox();
  const cardBox = await card.boundingBox();
  expect(lockBox && statusBox).toBeTruthy();
  expect(identityBox && cardBox).toBeTruthy();
  expect(lockBox!.x).toBeLessThanOrEqual(identityBox!.x + identityBox!.width + 8);
  expect(statusBox!.x).toBeGreaterThan(lockBox!.x + lockBox!.width - 1);
  expect(statusBox!.x + statusBox!.width).toBeLessThan(cardBox!.x + cardBox!.width - 40);
  await expect(card.locator(".nextStepLockedStatus")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "今日へ" })).toHaveCount(0);
  await expect(card.getByRole("button", { name: "変更", exact: true })).toHaveCount(0);

  await card.click({ button: "right" });
  const edit = page.getByRole("menuitem", { name: "次の一手を編集", exact: true });
  await expect(edit).toBeDisabled();
  await expect(edit).toHaveAttribute("title", /未完了の「今日の3件」/);
  await page.keyboard.press("Escape");

  await page.locator(".todayRow").first().locator(".todayRemoveButton").click();
  await expect(card.locator(".sourceLockBadge")).toHaveCount(0);
  await expect(card.locator(".nextStepTodayStatus")).toHaveCount(0);
  await expect(card.getByRole("button", { name: "今日へ" })).toBeVisible();
  await expect(card.getByRole("button", { name: "変更", exact: true })).toBeVisible();
});

test("unfinished Today3 locks only the matching Wishlist identity", async ({ page }) => {
  const fixture = createPublicFixture();
  const wishlist = fixture.config.inbox.find((item) => item.id === "sample-weekend")!;
  fixture.config.today.items[1] = {
    text: wishlist.text,
    done: false,
    sourceKey: `wishlist:${wishlist.id}`,
    projectId: wishlist.projectId,
  };
  await prepare(page, fixture);

  await page.getByRole("button", { name: "やりたいこと", exact: true }).click();
  const lockedRow = page.locator('[data-inbox-id="sample-weekend"]');
  const unlockedRow = page.locator('[data-inbox-id="sample-later"]');
  await expect(lockedRow.locator(".sourceLockBadge--wishlist")).toHaveCount(1);
  await expect(lockedRow.locator(".sourceLockBadge--wishlist")).toHaveCSS(
    "color",
    "rgb(255, 206, 91)",
  );
  await expect(lockedRow.locator(".wishlistNextStepAction")).toHaveCount(0);
  await expect(lockedRow.locator(".wishlistTodayStatus")).toHaveText("✓ 今日の3件に設定済み");
  await expect(unlockedRow.locator(".sourceLockBadge--wishlist")).toHaveCount(0);
  const rowBox = await lockedRow.boundingBox();
  const menuBox = await lockedRow.locator(".sourceRowMenu").boundingBox();
  expect(rowBox && menuBox).toBeTruthy();
  expect(rowBox!.x + rowBox!.width - (menuBox!.x + menuBox!.width)).toBeLessThanOrEqual(1);

  await lockedRow.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "次の一手にする" })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "編集", exact: true })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "完了にする" })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "削除", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");

  await page.locator(".todayRow", { hasText: wishlist.text }).locator(".todayRemoveButton").click();
  await expect(lockedRow.locator(".sourceLockBadge--wishlist")).toHaveCount(0);
  await expect(lockedRow.locator(".wishlistNextStepAction")).toHaveCount(1);
});

test("Do Now, Today3, and NextStep use their Project hover color", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);

  const hoverBorder = async (selector: string) => {
    const target = page.locator(selector).first();
    await target.hover();
    await page.waitForTimeout(140);
    return target.evaluate((node) => getComputedStyle(node).borderRightColor);
  };
  const doNow = page.locator(".doNowContent");
  await doNow.hover();
  await page.waitForTimeout(140);
  const doNowBorders = await doNow.evaluate((node) => {
    const style = getComputedStyle(node);
    return { left: style.borderLeftColor, right: style.borderRightColor };
  });
  const todayBorder = await hoverBorder(".todayRow");
  const nextStepBorder = await hoverBorder(".nextStepCard");
  expect(doNowBorders.right).toBe(doNowBorders.left);
  expect(todayBorder).toBe(doNowBorders.right);
  expect(nextStepBorder).toBe(todayBorder);

  for (const selector of [".doNowMeasureButton", ".todayMeasureButton"]) {
    const button = page.locator(selector).first();
    await button.hover();
    await expect
      .poll(() => button.evaluate((node) => getComputedStyle(node, "::after").transform))
      .not.toBe("matrix(0, 0, 0, 1, 0, 0)");
  }

  const remove = page.locator(".todayRemoveButton").first();
  const change = page.locator('.nextStepCard[data-project-id="sample-stretch"] .nextStepRowAction');
  await remove.hover();
  await page.waitForTimeout(180);
  const removeStyle = await remove.evaluate((node) => {
    const style = getComputedStyle(node);
    return [style.backgroundColor, style.borderColor, style.color];
  });
  await change.hover();
  await page.waitForTimeout(180);
  const changeStyle = await change.evaluate((node) => {
    const style = getComputedStyle(node);
    return [style.backgroundColor, style.borderColor, style.color];
  });
  expect(removeStyle).toEqual(changeStyle);
});

test("wide side gutters belong to the main scroll surface", async ({ page }) => {
  const fixture = createPublicFixture();
  for (let index = 0; index < 16; index += 1) {
    fixture.config.inbox.push({ id: `scroll-${index}`, text: `スクロール確認 ${index}` });
  }
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1920, height: 700 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");

  const scrollArea = page.locator(".mainScrollArea");
  const content = page.locator(".mainScrollContent");
  const scrollBox = await scrollArea.boundingBox();
  const contentBox = await content.boundingBox();
  expect(scrollBox && contentBox).toBeTruthy();
  expect(contentBox!.x - scrollBox!.x).toBeGreaterThan(20);
  await page.mouse.move(scrollBox!.x + 8, scrollBox!.y + 180);
  await page.mouse.wheel(0, 600);
  await expect.poll(() => scrollArea.evaluate((node) => node.scrollTop)).toBeGreaterThan(0);
});
