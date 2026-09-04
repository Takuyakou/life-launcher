import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import type { LauncherButton } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_DIR = resolve("docs/phase6/screenshots");

test.describe.configure({ mode: "serial" });

function withDictionaryGrid(): VisualQaFixture {
  const fixture = createPublicFixture();
  const tiles: LauncherButton[] = Array.from({ length: 12 }, (_, index) => ({
    id: `grid-file-${index + 1}`,
    label: `グリッド項目 ${index + 1}`,
    icon: "◇",
    group: "資料",
    showInSidebar: index < 2,
    showInOverlay: true,
    overlayPageId: "tools",
    aliases: [],
    description: "Keyboard navigation fixture",
    actions: [
      {
        type: "open_file",
        payload: { path: `C:\\PublicDemo\\Grid\\item-${index + 1}.txt` },
      },
    ],
  }));
  const url = fixture.config.buttons.find((button) => button.id === "reference-site");
  fixture.config.buttons = [...tiles, ...(url ? [{ ...url, showInSidebar: true }] : [])];
  fixture.config.dictionaryOrder = fixture.config.buttons.map((button) => button.id);
  return fixture;
}

async function prepare(
  page: Page,
  view: "main" | "dictionary",
  fixture: VisualQaFixture = withDictionaryGrid(),
  viewport = { width: 1000, height: 640 },
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, view);
  await page.goto(view === "dictionary" ? "/?view=dictionary" : "/");
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
}

async function invokeCalls(page: Page) {
  return page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: {
          invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    return control?.invokeCalls ?? [];
  });
}

async function tabStyle(tab: ReturnType<Page["getByRole"]>) {
  return tab.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      boxShadow: style.boxShadow,
      color: style.color,
    };
  });
}

test("category focus moves independently and selection style is shared", async ({ page }) => {
  await prepare(page, "dictionary");
  const allTab = page.getByRole("tab", { name: /すべて/ });
  const uncategorizedTab = page.getByRole("tab", { name: /未分類/ });
  const toolsTab = page.getByRole("tab", { name: /ツール/ });

  await allTab.click();
  const allSelected = await tabStyle(allTab);
  await allTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(uncategorizedTab).toBeFocused();
  await expect(allTab).toHaveAttribute("aria-selected", "true");
  await expect(uncategorizedTab).toHaveAttribute("aria-selected", "false");
  await page.keyboard.press("ArrowLeft");
  await expect(allTab).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(uncategorizedTab).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(uncategorizedTab).toHaveAttribute("aria-selected", "true");

  await page.keyboard.press("ArrowRight");
  await expect(toolsTab).toBeFocused();
  await page.keyboard.press("Space");
  await expect(toolsTab).toHaveAttribute("aria-selected", "true");
  expect(await tabStyle(toolsTab)).toEqual(allSelected);
  await toolsTab.hover();
  expect(await tabStyle(toolsTab)).toEqual(allSelected);
  await allTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(uncategorizedTab).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(toolsTab).toBeFocused();
  await expect(toolsTab).toHaveCSS("outline-style", "solid");
  expect((await tabStyle(toolsTab)).backgroundColor).toBe(allSelected.backgroundColor);
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "p6-02-dictionary-selected-focus.png"),
  });

  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".dictionaryTile:focus")).toHaveCount(1);
});

test("tile arrows follow visual rows and adapt after resize", async ({ page }) => {
  await prepare(page, "dictionary");
  const toolsTab = page.getByRole("tab", { name: /ツール/ });
  await toolsTab.click();
  const first = page.locator(".dictionaryTile").first();
  await first.focus();
  const firstBox = await first.boundingBox();
  expect(firstBox).not.toBeNull();

  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".dictionaryTile").nth(1)).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(first).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(async () => (await page.locator(".dictionaryTile:focus").boundingBox())?.y ?? 0)
    .toBeGreaterThan(firstBox!.y);
  const downBox = await page.locator(".dictionaryTile:focus").boundingBox();
  expect(downBox).not.toBeNull();
  await page.keyboard.press("ArrowUp");
  await expect
    .poll(async () => (await page.locator(".dictionaryTile:focus").boundingBox())?.y ?? Infinity)
    .toBeLessThan(downBox!.y);

  await first.focus();
  await page.keyboard.press("ArrowUp");
  await expect(toolsTab).toBeFocused();

  await page.setViewportSize({ width: 640, height: 640 });
  await first.focus();
  const narrowFirstBox = await first.boundingBox();
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(async () => (await page.locator(".dictionaryTile:focus").boundingBox())?.y ?? 0)
    .toBeGreaterThan(narrowFirstBox!.y);
  const narrowDownBox = await page.locator(".dictionaryTile:focus").boundingBox();
  expect(narrowDownBox).not.toBeNull();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "p6-02-dictionary-narrow.png") });

  await page.setViewportSize({ width: 1200, height: 700 });
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "p6-02-dictionary-wide.png") });
});

test("Enter launches a tile while search input keeps native arrow behavior", async ({ page }) => {
  await prepare(page, "dictionary");
  await page.getByRole("tab", { name: /ツール/ }).click();
  const first = page.locator(".dictionaryTile").first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(async () => (await invokeCalls(page)).filter((call) => call.command === "execute_actions"))
    .toHaveLength(1);

  const search = page.getByRole("searchbox", { name: "辞書を検索" });
  await search.fill("グリッド");
  await expect(search).toHaveAttribute("aria-activedescendant", "dictionary-search-result-0");
  await search.press("ArrowDown");
  await expect(search).toBeFocused();
  await expect(search).toHaveAttribute("aria-activedescendant", "dictionary-search-result-0");
});

test("Dictionary keyboard menu reveals local items but not URLs", async ({ page }) => {
  await prepare(page, "dictionary");
  await page.getByRole("tab", { name: /ツール/ }).click();
  const localTile = page.locator(".dictionaryTile").first();
  await localTile.focus();
  await localTile.press("Shift+F10");
  await expect(
    page.getByRole("menuitem", { name: "エクスプローラーで表示する" }),
  ).toBeVisible();
  await page.screenshot({
    path: resolve(SCREENSHOT_DIR, "p6-02-dictionary-context-menu.png"),
  });
  await page.getByRole("menuitem", { name: "エクスプローラーで表示する" }).click();
  await expect
    .poll(async () =>
      (await invokeCalls(page)).find((call) => call.command === "reveal_launcher_item"),
    )
    .toMatchObject({ args: { buttonId: "grid-file-1" } });

  await page.getByRole("tab", { name: /参考資料/ }).click();
  const urlTile = page.locator(".dictionaryTile").first();
  await urlTile.focus();
  await urlTile.press("Shift+F10");
  await expect(
    page.getByRole("menuitem", { name: "エクスプローラーで表示する" }),
  ).toHaveCount(0);
});

test("Quick keyboard menu uses the same reveal command and hides it for URLs", async ({ page }) => {
  await prepare(page, "main");
  const localButton = page.locator(".quickButton", { hasText: "グリッド項目 1" });
  await localButton.focus();
  await localButton.press("Shift+F10");
  await expect(
    page.getByRole("menuitem", { name: "エクスプローラーで表示する" }),
  ).toBeVisible();
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "p6-02-quick-context-menu.png") });
  await page.getByRole("menuitem", { name: "エクスプローラーで表示する" }).click();
  await expect
    .poll(async () =>
      (await invokeCalls(page)).find((call) => call.command === "reveal_launcher_item"),
    )
    .toMatchObject({ args: { buttonId: "grid-file-1" } });

  const urlButton = page.locator(".quickButton", { hasText: "参考サイト" });
  await urlButton.focus();
  await urlButton.press("Shift+F10");
  await expect(
    page.getByRole("menuitem", { name: "エクスプローラーで表示する" }),
  ).toHaveCount(0);
});
