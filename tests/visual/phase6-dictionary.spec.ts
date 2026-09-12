import { expect, test, type Page } from "@playwright/test";
import type { AppConfig, LauncherButton } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test.describe.configure({ mode: "serial" });

function withDictionaryGrid(count = 12): VisualQaFixture {
  const fixture = createPublicFixture();
  const tiles: LauncherButton[] = Array.from({ length: count }, (_, index) => ({
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

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    return control.currentConfig();
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

  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".dictionaryTile:focus")).toHaveCount(1);
});

test("dictionary opens on a tile and arrow keys move immediately", async ({ page }) => {
  await prepare(page, "dictionary", withDictionaryGrid(12));
  const tiles = page.locator(".dictionaryTile");
  await expect(tiles.first()).toBeFocused();
  const firstBox = await tiles.first().boundingBox();
  expect(firstBox).not.toBeNull();
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await expect(page.locator(".dictionaryTile:focus")).toHaveCount(0);
  await page.keyboard.press("ArrowRight");
  await expect(tiles.nth(1)).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(async () => (await page.locator(".dictionaryTile:focus").boundingBox())?.y ?? 0)
    .toBeGreaterThan(firstBox!.y);
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

  await page.setViewportSize({ width: 1200, height: 700 });
});

test("Enter launches a tile while search input keeps native arrow behavior", async ({ page }) => {
  await prepare(page, "dictionary");
  await page.getByRole("tab", { name: /ツール/ }).click();
  const first = page.locator(".dictionaryTile").first();
  await first.focus();
  await page.keyboard.press("Enter");
  await expect
    .poll(async () =>
      (await invokeCalls(page)).filter((call) => call.command === "execute_actions"),
    )
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
  await expect(page.getByRole("menuitem", { name: "編集" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "削除" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "エクスプローラーで表示する" })).toBeVisible();
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
  await expect(page.getByRole("menuitem", { name: "エクスプローラーで表示する" })).toHaveCount(0);
});

test("Quick keyboard menu uses the same reveal command and hides it for URLs", async ({ page }) => {
  await prepare(page, "main");
  const localButton = page.locator(".quickButton", { hasText: "グリッド項目 1" });
  await localButton.focus();
  await localButton.press("Enter");
  await expect
    .poll(async () =>
      (await invokeCalls(page)).filter((call) => call.command === "execute_actions"),
    )
    .toHaveLength(1);
  await localButton.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "編集" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "削除" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "エクスプローラーで表示する" })).toBeVisible();
  await page.getByRole("menuitem", { name: "エクスプローラーで表示する" }).click();
  await expect
    .poll(async () =>
      (await invokeCalls(page)).find((call) => call.command === "reveal_launcher_item"),
    )
    .toMatchObject({ args: { buttonId: "grid-file-1" } });

  const urlButton = page.locator(".quickButton", { hasText: "参考サイト" });
  await urlButton.focus();
  await urlButton.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "エクスプローラーで表示する" })).toHaveCount(0);

  await page.keyboard.press("Escape");
  const group = page.locator(".quickGroup").first();
  const groupHeader = group.locator(".quickGroupHeader");
  await expect(groupHeader).toHaveAttribute("aria-expanded", "true");
  await groupHeader.focus();
  await groupHeader.press("Enter");
  await expect(groupHeader).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await expect(page.locator(".quickGroup").first().locator(".quickGroupHeader")).toHaveAttribute(
    "aria-expanded",
    "false",
  );
});

test("Dictionary drag saves the reordered tile order and survives reload", async ({ page }) => {
  await prepare(page, "dictionary");
  await page.getByRole("tab", { name: /ツール/ }).click();
  const tiles = page.locator(".dictionaryTile");
  const source = await tiles.nth(0).boundingBox();
  const target = await tiles.nth(2).boundingBox();
  expect(source).not.toBeNull();
  expect(target).not.toBeNull();

  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(source!.x + source!.width / 2 + 12, source!.y + source!.height / 2, {
    steps: 2,
  });
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
    steps: 5,
  });
  await page.mouse.up();

  await expect
    .poll(async () => (await currentConfig(page)).dictionaryOrder?.indexOf("grid-file-1") ?? -1)
    .toBeGreaterThan(0);
  const savedOrder = (await currentConfig(page)).dictionaryOrder;
  await page.reload();
  await page.getByRole("tab", { name: /ツール/ }).click();
  const renderedOrder = await page
    .locator("[data-dictionary-button-id]")
    .evaluateAll((items) => items.map((item) => item.getAttribute("data-dictionary-button-id")));
  expect(renderedOrder).toEqual(savedOrder?.filter((id) => id.startsWith("grid-file-")));
});

test("Dictionary remains responsive with more than one hundred items", async ({ page }) => {
  await prepare(page, "dictionary", withDictionaryGrid(120));
  await page.getByRole("tab", { name: /ツール/ }).click();
  await expect(page.locator(".dictionaryTile")).toHaveCount(120);
  await page.locator(".dictionaryTile").first().focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".dictionaryTile").nth(1)).toBeFocused();
  const search = page.getByRole("searchbox", { name: "辞書を検索" });
  await search.fill("グリッド項目 120");
  await expect(page.locator(".dictionarySearchResult")).toHaveCount(1);
});

test("Quick button and group drag save only on drop and survive reload", async ({ page }) => {
  await prepare(page, "main");
  const saveCount = async () =>
    (await invokeCalls(page)).filter((call) => call.command === "save_config").length;

  const quickButtons = page.locator(".quickGroup", { hasText: "資料" }).locator(".quickButton");
  const source = await quickButtons.nth(0).boundingBox();
  const target = await quickButtons.nth(1).boundingBox();
  expect(source).not.toBeNull();
  expect(target).not.toBeNull();
  const beforeButtonDrag = await saveCount();
  await page.mouse.move(source!.x + source!.width / 2, source!.y + source!.height / 2);
  await page.mouse.down();
  await page.mouse.move(source!.x + source!.width / 2 + 12, source!.y + source!.height / 2, {
    steps: 2,
  });
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height - 3, {
    steps: 5,
  });
  expect(await saveCount()).toBe(beforeButtonDrag);
  await page.mouse.up();
  await expect.poll(saveCount).toBe(beforeButtonDrag + 1);
  await expect
    .poll(async () => {
      const ids = (await currentConfig(page)).buttons
        .filter((button) => button.group === "資料")
        .map((button) => button.id);
      return ids.indexOf("grid-file-1") > ids.indexOf("grid-file-2");
    })
    .toBe(true);

  await page.reload();
  const renderedButtonLabels = await page
    .locator(".quickGroup", { hasText: "資料" })
    .locator(".quickButton")
    .allTextContents();
  expect(renderedButtonLabels[0]).toContain("グリッド項目 2");

  const headers = page.locator(".quickGroupHeader");
  const firstGroup = await headers.nth(0).boundingBox();
  const secondGroup = await page.locator(".quickGroup").nth(1).boundingBox();
  expect(firstGroup).not.toBeNull();
  expect(secondGroup).not.toBeNull();
  const beforeGroupDrag = await saveCount();
  await page.mouse.move(
    firstGroup!.x + firstGroup!.width / 2,
    firstGroup!.y + firstGroup!.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    firstGroup!.x + firstGroup!.width / 2 + 12,
    firstGroup!.y + firstGroup!.height / 2,
    { steps: 2 },
  );
  await page.mouse.move(
    secondGroup!.x + secondGroup!.width / 2,
    secondGroup!.y + secondGroup!.height - 3,
    { steps: 5 },
  );
  expect(await saveCount()).toBe(beforeGroupDrag);
  await page.mouse.up();
  await expect.poll(saveCount).toBe(beforeGroupDrag + 1);
  await expect
    .poll(async () => {
      const groups = (await currentConfig(page)).groups;
      return groups.indexOf("資料") > groups.indexOf("リンク");
    })
    .toBe(true);
  await page.reload();
  await expect(page.locator(".quickGroupHeader").first()).toContainText("リンク");
});
