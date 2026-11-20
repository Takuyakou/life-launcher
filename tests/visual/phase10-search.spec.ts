import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => VisualQaFixture["config"];
    updateConfig: (config: VisualQaFixture["config"]) => void;
    invokeCalls: Array<{ command: string; args?: unknown }>;
  };
};

async function open(page: Page, fixture: VisualQaFixture = createFullTodayFixture()) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1200, height: 780 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".topSearchButton")).toBeVisible();
}

const palette = (page: Page) => page.getByRole("dialog", { name: "検索" });
const input = (page: Page) => palette(page).getByRole("combobox");

test("P10-03 the field opens the palette and puts the caret in the input", async ({ page }) => {
  await open(page);
  await page.locator(".topSearchButton").click();
  await expect(palette(page)).toBeVisible();
  await expect(input(page)).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(palette(page)).toHaveCount(0);

  await page.keyboard.press("Control+f");
  await expect(palette(page)).toBeVisible();
  await expect(input(page)).toBeFocused();

  // A dialog swallows Ctrl+F.
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  await page.keyboard.press("Control+f");
  await expect(palette(page)).toHaveCount(0);
});

test("P10-03 an empty query starts with this moment's step", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Control+f");
  const first = palette(page).getByRole("option").first();
  await expect(first).toHaveAttribute("aria-selected", "true");
  const groupTitles = await palette(page).locator(".searchPaletteGroupTitle > span:first-child").allTextContents();
  expect(groupTitles[0]).toBe("今やる一手");
  // Only the top step and the steps linked to Today3 are listed.
  expect(groupTitles.every((title) => title === "今やる一手" || title === "今日の3件の次の一手")).toBe(true);
});

test("P10-03 typing lists the five groups in order with five each", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Control+f");
  await input(page).fill("a");
  const groups = await palette(page)
    .locator(".searchPaletteGroupTitle > span:first-child")
    .allTextContents();
  const order = ["次の一手", "やりたいこと", "ボタン", "手順書", "操作"];
  const filtered = groups.filter((title) => order.includes(title));
  expect(filtered).toEqual([...filtered].sort((left, right) => order.indexOf(left) - order.indexOf(right)));
  for (const group of await palette(page).locator(".searchPaletteGroup").all()) {
    expect(await group.getByRole("option").count()).toBeLessThanOrEqual(5);
  }
});

test("P10-03 the matcher treats case, kana and width as the same", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Control+f");
  const countFor = async (query: string) => {
    await input(page).fill(query);
    return palette(page).getByRole("option").count();
  };
  const upper = await countFor("A");
  const lower = await countFor("a");
  expect(lower).toBe(upper);

  // ひらがな / カタカナ / 全角半角 for the same word
  const hira = await countFor("さぷる");
  const kata = await countFor("サプル");
  const half = await countFor("ｻﾌﾟﾙ");
  expect(kata).toBe(hira);
  expect(half).toBe(hira);
});

test("P10-03 Enter starts a Next Step in the short timer and Shift+Enter in the normal one", async ({
  page,
}) => {
  await open(page);
  await page.keyboard.press("Control+f");
  await input(page).fill("サンプル");
  await page.keyboard.press("Enter");
  await expect(palette(page)).toHaveCount(0);
  const dock = page.locator(".timerDock");
  await expect(dock.locator(".timerClock")).toHaveText("05:00");

  // Shift+Enter starts the same step with the normal minutes instead.
  await page.keyboard.press("Control+f");
  await input(page).fill("サンプル");
  await page.keyboard.press("Shift+Enter");
  await expect(palette(page)).toHaveCount(0);
  await expect(page.locator(".todayRow").first().getByRole("button", { name: "終了", exact: true })).toBeVisible();
  await page.locator(".todayRow").first().getByRole("button", { name: "終了", exact: true }).click();
});

test("P10-03 Escape closes the palette and gives the focus back", async ({ page }) => {
  await open(page);
  await page.locator(".topSearchButton").focus();
  await page.keyboard.press("Enter");
  await expect(palette(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(palette(page)).toHaveCount(0);
  await expect(page.locator(".topSearchButton")).toBeFocused();
});

test("P10-03 the list is announced as a listbox with the active option", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Control+f");
  await expect(palette(page).getByRole("combobox")).toHaveAttribute("aria-expanded", "true");
  await expect(palette(page).getByRole("listbox")).toBeVisible();
  const selectedId = await palette(page).getByRole("option").first().getAttribute("id");
  await expect(palette(page).getByRole("combobox")).toHaveAttribute("aria-activedescendant", selectedId!);
  await page.keyboard.press("ArrowDown");
  const second = await palette(page).getByRole("option").nth(1).getAttribute("id");
  await expect(palette(page).getByRole("combobox")).toHaveAttribute("aria-activedescendant", second!);
});

test("P10-03 no key hints are shown under the list", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Control+f");
  await expect(palette(page).locator("kbd")).toHaveCount(0);
  await expect(palette(page)).not.toContainText("Enter");
  await expect(palette(page)).not.toContainText("↑↓");
});

test("P10-03 the highlight follows the selection", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Control+f");
  await input(page).fill("サンプル");
  await expect
    .poll(async () => {
      const option = palette(page).getByRole("option").first();
      const highlight = palette(page).locator(".searchPaletteHighlight").last();
      const a = await option.boundingBox();
      const b = await highlight.boundingBox();
      if (!a || !b) return 999;
      return Math.abs(a.y - b.y) + Math.abs(a.height - b.height);
    })
    .toBeLessThanOrEqual(1);
  await page.keyboard.press("ArrowDown");
  await expect
    .poll(async () => {
      const option = palette(page).getByRole("option").nth(1);
      const highlight = palette(page).locator(".searchPaletteHighlight").last();
      const a = await option.boundingBox();
      const b = await highlight.boundingBox();
      if (!a || !b) return 999;
      return Math.abs(a.y - b.y) + Math.abs(a.height - b.height);
    })
    .toBeLessThanOrEqual(1);
});

test("P10-03 a composing Enter never runs anything", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Control+f");
  await input(page).fill("サンプル");
  await input(page).evaluate((element) => {
    element.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, isComposing: true, key: "Enter" }));
  });
  await expect(palette(page)).toBeVisible();
  await expect(page.locator(".timerDock .timerClock")).toHaveText("25分");
});

test("P10-03 an entry that disappeared is not run and the list is rebuilt", async ({ page }) => {
  const fixture = createFullTodayFixture();
  await open(page, fixture);
  const step = fixture.config.projects.find((project) => project.nextStep?.text.trim())!.nextStep!;
  await page.keyboard.press("Control+f");
  // A whole sentence: only the Next Step matches it.
  await input(page).fill(step.text);
  await expect(palette(page).getByRole("option").first()).toBeVisible();
  await page.evaluate(() => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    config.projects = config.projects.map((project) => ({ ...project, nextStep: undefined }));
    control.updateConfig(config);
  });
  await expect(palette(page).getByRole("option")).toHaveCount(0);
  // Enter still tries the entry that was selected before the list emptied, and the app warns
  // because the Next Step is gone from the reloaded config.
  await page.keyboard.press("Enter");
  await expect(page.locator(".toast", { hasText: "見つかりません。一覧を作り直しました" })).toBeVisible();
  await expect(page.locator(".timerDock .timerClock")).toHaveText("25分");
});

test("P10-03 an action runs from the palette", async ({ page }) => {
  await open(page);
  await page.keyboard.press("Control+f");
  await input(page).fill("記録を開く");
  const option = palette(page).getByRole("option", { name: /記録を開く/ }).first();
  await expect(option).toBeVisible();
  await option.click();
  await expect(palette(page)).toHaveCount(0);
  await expect(page.locator(".recordsView")).toBeVisible();
});

test("P10-03 Ctrl+F is swallowed even when the search window cannot open", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await expect(page.getByRole("dialog", { name: "設定" })).toBeVisible();
  // A listener added after the app's own capture handler sees whether it was cancelled.
  await page.evaluate(() => {
    (window as Window & { __ctrlF?: boolean }).__ctrlF = false;
    window.addEventListener("keydown", (event) => {
      if (event.key.toLowerCase() === "f" && event.ctrlKey) {
        (window as Window & { __ctrlF?: boolean }).__ctrlF = event.defaultPrevented;
      }
    });
  });
  await page.keyboard.press("Control+f");
  await expect(palette(page)).toHaveCount(0);
  expect(
    await page.evaluate(() => (window as Window & { __ctrlF?: boolean }).__ctrlF),
  ).toBe(true);
});
