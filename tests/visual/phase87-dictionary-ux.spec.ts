import { expect, test, type Page } from "@playwright/test";
import type { LauncherButton } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

function dictionaryFixture() {
  const fixture = createPublicFixture();
  const buttons: LauncherButton[] = Array.from({ length: 16 }, (_, index) => ({
    id: `p87-item-${index}`,
    label: index === 0 ? "長い名前でも収まりを確認する辞書項目" : `辞書項目 ${index + 1}`,
    icon: "◇",
    group: "資料",
    showInSidebar: index < 2,
    showInOverlay: true,
    overlayPageId: "tools",
    actions: [{ type: "open_file", payload: { path: `C:\\PublicDemo\\item-${index}.txt` } }],
  }));
  fixture.config.buttons = buttons;
  fixture.config.dictionaryOrder = buttons.map((button) => button.id);
  return fixture;
}

async function prepare(page: Page, view: "main" | "dictionary", width = 1000) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 640 });
  await installTauriMock(page, dictionaryFixture(), view);
  await page.goto(view === "dictionary" ? "/?view=dictionary" : "/");
  await page.evaluate(async () => document.fonts.ready);
}

test("Main dictionary entry uses a window icon without changing shortcut text", async ({
  page,
}) => {
  await prepare(page, "main");
  const entry = page.getByRole("button", { name: /辞書を開く/ });
  await expect(entry.locator(".uiIcon")).toHaveCount(1);
  await expect(entry.locator("kbd")).toHaveText("Ctrl+K");
});

test("Dictionary settings opens from the icon and titlebar context menu", async ({ page }) => {
  await prepare(page, "dictionary");
  const settings = page.getByRole("button", { name: "辞書の設定" });
  await expect(settings).toHaveAttribute("title", "辞書の設定");
  await settings.click();
  await expect(page.getByRole("dialog", { name: "辞書の設定" })).toBeVisible();
  await page.getByRole("button", { name: "辞書の設定を閉じる" }).click();

  await page
    .locator(".dictionaryWindowTitlebar")
    .click({ button: "right", position: { x: 190, y: 20 } });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "辞書の設定" }).click();
  await expect(page.getByRole("dialog", { name: "辞書の設定" })).toBeVisible();
});

for (const size of ["small", "medium", "large"] as const) {
  test(`Dictionary ${size} size applies and persists`, async ({ page }) => {
    await prepare(page, "dictionary", 720);
    await page.getByRole("button", { name: "辞書の設定" }).click();
    await page
      .getByRole("radio", {
        name: size === "small" ? "小" : size === "medium" ? "中" : "大",
      })
      .click();
    await page.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".dictionaryWindowShell")).toHaveAttribute("data-tile-size", size);
    await expect(page.locator(".dictionaryTile").first()).toBeVisible();

    await page.reload();
    await expect(page.locator(".dictionaryWindowShell")).toHaveAttribute("data-tile-size", size);
    await expect(page.locator(".dictionaryTile").first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
  });
}

test("Dictionary defaults to auto and Cancel keeps the saved preference", async ({ page }) => {
  await prepare(page, "dictionary", 520);
  await expect(page.locator(".dictionaryWindowShell")).toHaveAttribute("data-tile-size", "auto");
  await page.getByRole("button", { name: "辞書の設定" }).click();
  await expect(page.getByRole("radio", { name: "自動" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: "大" }).click();
  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(page.locator(".dictionaryWindowShell")).toHaveAttribute("data-tile-size", "auto");
});
