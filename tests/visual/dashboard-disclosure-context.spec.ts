import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

test("a NextStep context menu exposes edit, change and unset without legacy registration", async ({
  page,
}) => {
  await prepare(page);
  const row = page
    .locator(".nextStepRow", { hasText: "5分だけ体を動かす" })
    .locator(".nextStepActionRegion");

  await row.click({ button: "right" });
  for (const name of ["次の一手を編集", "次の一手を変更", "次の一手を未設定にする"]) {
    await expect(page.getByRole("menuitem", { name, exact: true })).toBeEnabled();
  }
  await expect(page.getByRole("menuitem", { name: "やりたいことを追加" })).toHaveCount(0);
});

test("Today3 menus are always visible and use horizontal move labels", async ({ page }) => {
  await prepare(page);
  const menuButton = page.locator(".todayRow").first().locator(".todayRowMenu");
  await expect(menuButton).toHaveCSS("opacity", "1");
  await menuButton.click();
  await expect(page.getByRole("menuitem", { name: "左へ移動" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "右へ移動" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "上へ移動" })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "下へ移動" })).toHaveCount(0);
  const original = await page.locator(".todayTextButton").allTextContents();
  await page.getByRole("menuitem", { name: "右へ移動" }).click();
  await expect(page.locator(".todayTextButton")).toHaveText([...original].reverse());
  await page.locator(".todayRow").last().locator(".todayRowMenu").click();
  await page.getByRole("menuitem", { name: "左へ移動" }).click();
  await expect(page.locator(".todayTextButton")).toHaveText(original);
});
