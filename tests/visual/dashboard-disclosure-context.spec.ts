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

test("confirmation actions place the destructive or completion action before cancel", async ({
  page,
}) => {
  await prepare(page);
  const inbox = page.locator(".inboxBand");
  if ((await inbox.locator(".disclosure").getAttribute("aria-expanded")) === "false") {
    await inbox.locator(".disclosure").click();
  }
  const wishlistItem = inbox.locator(".inboxRow").first();

  await wishlistItem.click({ button: "right" });
  await page.getByRole("menuitem", { name: "完了にする" }).click();
  let dialog = page.getByRole("dialog", { name: "完了にしますか？" });
  await expect(dialog.locator(".confirmDialogActions button")).toHaveText([
    "完了にする",
    "キャンセル",
  ]);
  await expect(dialog.getByRole("button", { name: "キャンセル" })).toBeFocused();
  await page.keyboard.press("Escape");

  await wishlistItem.click({ button: "right" });
  await page.getByRole("menuitem", { name: "削除" }).click();
  dialog = page.getByRole("dialog", { name: "削除しますか？" });
  await expect(dialog.locator(".confirmDialogActions button")).toHaveText(["削除", "キャンセル"]);
});

test.skip("dashboard disclosure bars toggle from their count and description areas", async ({
  page,
}) => {
  await prepare(page);

  const cases = [
    { band: ".todayBuilderBand", target: ".disclosureCount" },
    { band: ".projectsBand", target: ".disclosureDescription" },
    { band: ".inboxBand", target: ".disclosureCount" },
    { band: ".todayActivityBand", target: ".disclosureDescription" },
  ];

  for (const item of cases) {
    const band = page.locator(item.band);
    const disclosure = band.locator(".disclosure");
    const before = await disclosure.getAttribute("aria-expanded");
    await band.locator(item.target).click();
    await expect(disclosure).toHaveAttribute("aria-expanded", before === "true" ? "false" : "true");
  }
});

test("a NextStep context menu exposes edit, change and unset without legacy registration", async ({
  page,
}) => {
  await prepare(page);
  const row = page
    .locator(".nextStepRow", { hasText: "5分だけ体を動かす" })
    .locator(".nextStepActionRegion");

  await row.click({ button: "right" });
  await expect(page.getByRole("menuitem")).toHaveText([
    "プロジェクトを編集",
    "プロジェクトを管理",
    "次の一手を編集",
    "次の一手を変更",
    "次の一手を未設定にする",
    "プロジェクトを削除…",
  ]);
  await expect(page.getByRole("menuitem", { name: "やりたいことを追加" })).toHaveCount(0);
});

test.skip("Builder bar menu smoothly navigates to each candidate source", async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    const target = window as Window & {
      __builderScrollCalls?: Array<{ className: string; behavior?: ScrollBehavior }>;
    };
    target.__builderScrollCalls = [];
    Element.prototype.scrollIntoView = function (options?: boolean | ScrollIntoViewOptions) {
      const behavior = typeof options === "object" ? options.behavior : undefined;
      target.__builderScrollCalls?.push({
        className: (this as HTMLElement).className,
        behavior,
      });
    };
  });

  const builderHeader = page.locator(".todayBuilderHeader");
  await builderHeader.click({ button: "right" });
  await expect(page.getByRole("menuitem")).toHaveText(["次の一手から追加", "やりたいことから追加"]);
  await page.getByRole("menuitem", { name: "次の一手から追加" }).click();
  await expect(page.locator(".projectsBand .disclosure")).toBeFocused();

  await builderHeader.click({ button: "right" });
  await page.getByRole("menuitem", { name: "やりたいことから追加" }).click();
  await expect(page.locator(".inboxBand .disclosure")).toBeFocused();

  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as Window & {
              __builderScrollCalls?: Array<{ className: string; behavior?: ScrollBehavior }>;
            }
          ).__builderScrollCalls,
      ),
    )
    .toEqual([
      { className: "projectsBand", behavior: "smooth" },
      { className: "inboxBand", behavior: "smooth" },
    ]);
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
});
