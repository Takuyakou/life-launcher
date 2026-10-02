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

test("Main remains interactive while Dictionary is visible", async ({ page }) => {
  await prepare(page, "main");
  await page.evaluate(() => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { emit: (event: string, payload: boolean) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__?.emit("dictionary-visibility-changed", true);
  });
  await expect(page.locator(".dictionaryMainScrim")).toHaveCSS("pointer-events", "none");
  await page.getByRole("button", { name: "使い方" }).click();
  await expect(page.getByRole("dialog", { name: "使い方" })).toBeVisible();
});

test("Dictionary button edit keeps its footer visible and matches the Drop Register group UI", async ({
  page,
}) => {
  await prepare(page, "dictionary", 420);
  await page.setViewportSize({ width: 420, height: 300 });
  const tile = page.locator(".dictionaryTile").first();
  await tile.focus();
  await tile.press("Shift+F10");
  await page.getByRole("menuitem", { name: "編集" }).click();

  const dialog = page.getByRole("dialog", { name: "ボタン編集" });
  const footer = dialog.locator(".buttonEditDialogFooter");
  await expect(dialog).not.toHaveAttribute("aria-modal");
  await expect(dialog.getByRole("button", { name: "既存から選ぶ" })).toBeVisible();
  await expect(dialog.getByRole("button", { name: "新規グループを作成" })).toBeVisible();
  await expect(dialog.getByLabel("既存のグループ")).toHaveValue("資料");
  await expect(dialog.getByText("アイコン", { exact: true })).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "アクションを上へ" })).toHaveCount(0);
  await expect(dialog.getByText("検索・説明（任意）")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "ボタン編集を閉じる" })).toBeVisible();
  await expect(footer).toBeVisible();
  const footerBox = await footer.boundingBox();
  expect(footerBox).not.toBeNull();
  expect(footerBox!.y + footerBox!.height).toBeLessThanOrEqual(300);

  const buttons = footer.getByRole("button");
  await expect(buttons).toHaveText(["保存", "キャンセル"]);
  await expect(buttons.first()).toHaveCSS("color", "rgb(111, 207, 151)");
  await expect(buttons.last()).toHaveCSS("color", "rgb(255, 180, 173)");
  await buttons.first().click();
  await expect(dialog).toHaveCount(0);
  await expect(page.getByText("設定を再読み込みしました", { exact: true })).toHaveCount(0);
});

test("Dictionary settings opens from the icon and titlebar context menu", async ({ page }) => {
  await prepare(page, "dictionary");
  const settings = page.getByRole("button", { name: "辞書の設定" });
  await expect(settings).toHaveAttribute("title", "辞書の設定");
  await settings.click();
  const dialog = page.getByRole("dialog", { name: "辞書の設定" });
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveAttribute("aria-modal");
  await expect(page.locator(".dictionarySettingsBackdrop")).toHaveCSS("pointer-events", "none");
  const save = dialog.getByRole("button", { name: "保存" });
  await expect(save).toHaveCSS("color", "rgb(111, 207, 151)");
  await save.hover();
  await expect(save).toHaveCSS("background-color", "rgb(48, 66, 53)");
  await page.getByRole("button", { name: "辞書の設定を閉じる" }).click();

  await page
    .locator(".dictionaryWindowTitlebar")
    .click({ button: "right", position: { x: 190, y: 20 } });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await menu.getByRole("menuitem", { name: "辞書の設定" }).click();
  await expect(page.getByRole("dialog", { name: "辞書の設定" })).toBeVisible();
});

test("Dictionary defaults to auto, cancels drafts, and persists every tile size", async ({ page }) => {
  await prepare(page, "dictionary", 520);
  const shell = page.locator(".dictionaryWindowShell");
  await expect(shell).toHaveAttribute("data-tile-size", "auto");
  await page.getByRole("button", { name: "辞書の設定" }).click();
  await expect(page.getByRole("radio", { name: "自動" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: "大" }).click();
  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(shell).toHaveAttribute("data-tile-size", "auto");

  await page.setViewportSize({ width: 720, height: 640 });
  for (const [size, label] of [["small", "小"], ["medium", "中"], ["large", "大"]] as const) {
    await page.getByRole("button", { name: "辞書の設定" }).click();
    await page.getByRole("radio", { name: label }).click();
    await page.getByRole("button", { name: "保存" }).click();
    await expect(shell).toHaveAttribute("data-tile-size", size);
    await expect(page.locator(".dictionaryTile").first()).toBeVisible();
    await page.reload();
    await expect(shell).toHaveAttribute("data-tile-size", size);
    await expect(page.locator(".dictionaryTile").first()).toBeVisible();
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    )).toBe(true);
  }
});

test("Dictionary list mode is compact, independent from icon size, and persists", async ({
  page,
}) => {
  await prepare(page, "dictionary", 720);
  await page.getByRole("button", { name: "辞書の設定" }).click();
  await page.getByRole("radio", { name: "リスト" }).click();
  await page.getByRole("radio", { name: "大" }).click();
  await page.getByRole("button", { name: "保存" }).click();

  const shell = page.locator(".dictionaryWindowShell");
  const first = page.locator(".dictionaryTile").first();
  await expect(shell).toHaveAttribute("data-view-mode", "list");
  await expect(shell).toHaveAttribute("data-tile-size", "large");
  expect((await first.boundingBox())?.height).toBeLessThanOrEqual(48);

  await page.reload();
  await expect(shell).toHaveAttribute("data-view-mode", "list");
  await expect(shell).toHaveAttribute("data-tile-size", "large");
});
