import { expect, test, type Page } from "@playwright/test";
import type { AppConfig, LauncherButton } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

function withDictionaryItems(count = 120): VisualQaFixture {
  const fixture = createPublicFixture();
  const buttons: LauncherButton[] = Array.from({ length: count }, (_, index) => ({
    id: `focus-item-${index + 1}`,
    label: `フォーカス項目 ${String(index + 1).padStart(3, "0")}`,
    icon: "◇",
    group: "資料",
    showInSidebar: false,
    showInOverlay: true,
    overlayPageId: "tools",
    aliases: [],
    description: "Dictionary state fixture",
    actions: [{ type: "open_file", payload: { path: `C:\\PublicDemo\\item-${index + 1}.txt` } }],
  }));
  fixture.config.buttons = buttons;
  fixture.config.dictionaryOrder = buttons.map((button) => button.id);
  return fixture;
}

async function prepare(
  page: Page,
  fixture: VisualQaFixture = withDictionaryItems(),
  viewport = { width: 1000, height: 640 },
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, "dictionary");
  await page.goto("/?view=dictionary");
  await expect(page.locator(".dictionaryTile").first()).toBeFocused();
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
}

async function emitDictionaryShown(page: Page) {
  await page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { emit: (event: string, payload?: unknown) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    control.emit("dictionary-shown");
  });
}

async function removeButton(page: Page, buttonId: string) {
  await page.evaluate(
    (id) => {
      const control = (
        window as Window & {
          __LIFE_LAUNCHER_VISUAL_QA__?: {
            currentConfig: () => AppConfig;
            updateConfig: (config: AppConfig) => void;
          };
        }
      ).__LIFE_LAUNCHER_VISUAL_QA__;
      if (!control) throw new Error("Visual QA control is unavailable");
      const config = control.currentConfig();
      control.updateConfig({
        ...config,
        buttons: config.buttons.filter((button) => button.id !== id),
        dictionaryOrder: config.dictionaryOrder.filter((itemId) => itemId !== id),
      });
    },
    buttonId,
  );
}

test("active page and keyboard focus are independent, and ArrowDown restores the last tile", async ({
  page,
}) => {
  await prepare(page);
  const allTab = page.getByRole("tab", { name: /すべて/ });
  const toolsTab = page.getByRole("tab", { name: /ツール/ });
  await toolsTab.click();
  const tiles = page.locator(".dictionaryTile");
  await tiles.nth(1).focus();
  await page.keyboard.press("ArrowUp");

  await expect(toolsTab).toBeFocused();
  await expect(toolsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".dictionaryTile--selected")).toHaveCount(0);
  await expect(toolsTab).toHaveCSS("outline-style", "solid");
  await expect(toolsTab).toHaveCSS("box-shadow", /inset/);

  await page.keyboard.press("ArrowDown");
  await expect(tiles.nth(1)).toBeFocused();
  await expect(tiles.nth(1)).toHaveClass(/dictionaryTile--selected/);

  await allTab.focus();
  await expect(allTab).toHaveCSS("outline-style", "solid");
  await expect(toolsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".dictionaryTile--selected")).toHaveCount(0);
});

test("reopen restores the active page, focused item and body scroll position", async ({ page }) => {
  await prepare(page);
  const toolsTab = page.getByRole("tab", { name: /ツール/ });
  await toolsTab.click();
  const target = page.locator('[data-dictionary-button-id="focus-item-81"] .dictionaryTile');
  await target.focus();
  const body = page.locator(".dictionaryWindowBody");
  const savedScroll = await body.evaluate((element) => element.scrollTop);
  expect(savedScroll).toBeGreaterThan(0);

  await page.getByRole("button", { name: "辞書ウィンドウを閉じる" }).click();
  await emitDictionaryShown(page);

  await expect(toolsTab).toHaveAttribute("aria-selected", "true");
  await expect(target).toBeFocused();
  await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBe(savedScroll);
});

test("reopen restores the page focus layer but clears temporary search", async ({ page }) => {
  await prepare(page);
  const allTab = page.getByRole("tab", { name: /すべて/ });
  const toolsTab = page.getByRole("tab", { name: /ツール/ });
  await toolsTab.click();
  await allTab.focus();
  const search = page.getByRole("searchbox", { name: "辞書を検索" });
  await search.fill("フォーカス項目 100");

  await page.getByRole("button", { name: "辞書ウィンドウを閉じる" }).click();
  await emitDictionaryShown(page);

  await expect(search).toHaveValue("");
  await expect(toolsTab).toHaveAttribute("aria-selected", "true");
  await expect(allTab).toBeFocused();
  await expect(page.locator(".dictionaryTile--selected")).toHaveCount(0);
});

test("a deleted remembered item falls back to the first valid tile", async ({ page }) => {
  await prepare(page);
  const toolsTab = page.getByRole("tab", { name: /ツール/ });
  await toolsTab.click();
  const removed = page.locator('[data-dictionary-button-id="focus-item-81"] .dictionaryTile');
  await removed.focus();
  await page.getByRole("button", { name: "辞書ウィンドウを閉じる" }).click();

  await removeButton(page, "focus-item-81");

  await page.clock.runFor(300);
  await expect(removed).toHaveCount(0);
  await emitDictionaryShown(page);

  await expect(toolsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.locator(".dictionaryTile").first()).toBeFocused();
  await expect(removed).toHaveCount(0);
});

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 860, height: 700 },
]) {
  test(`dictionary focus states stay bounded at ${viewport.width}px and hover remains weak`, async ({
    page,
  }) => {
    await prepare(page, withDictionaryItems(), viewport);
    const toolsTab = page.getByRole("tab", { name: /ツール/ });
    await toolsTab.click();
    const tile = page.locator(".dictionaryTile").nth(2);
    await toolsTab.focus();
    await tile.hover();
    await expect(tile).not.toHaveClass(/dictionaryTile--selected/);
    await expect(toolsTab).toHaveAttribute("aria-selected", "true");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}