import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { findShortcutConflicts } from "../../src/shortcutConflicts";

async function prepare(page: Page, fixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".sidebar")).toBeVisible();
}

async function currentConfig(page: Page) {
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => VisualQaFixture["config"] };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

test("Builder preserves each source and user label across mode round-trips", async ({ page }) => {
  await prepare(page);
  await page.locator(".brandBlock").click({ button: "right" });
  await page.getByRole("menuitem", { name: "ボタンを追加" }).click();
  const dialog = page.getByRole("dialog", { name: "Button Builder" });
  await dialog.getByRole("textbox", { name: "ファイル", exact: true }).fill("X:\\notes\\a.txt");
  await dialog.getByRole("textbox", { name: "ラベル" }).fill("自分で決めた名前");
  await dialog.getByRole("combobox", { name: "既存のグループ" }).selectOption("資料");
  await dialog.getByRole("checkbox", { name: /左サイドバーに表示/ }).uncheck();
  await dialog.getByRole("button", { name: "フォルダ" }).click();
  await dialog.getByRole("textbox", { name: "フォルダ", exact: true }).fill("X:\\notes\\folder");
  await dialog.getByRole("button", { name: "URL" }).click();
  await dialog.getByRole("textbox", { name: "URL", exact: true }).fill("https://example.com/help");
  await dialog.getByRole("button", { name: "ファイル" }).click();
  await expect(dialog.getByRole("textbox", { name: "ファイル", exact: true })).toHaveValue("X:\\notes\\a.txt");
  await expect(dialog.getByRole("textbox", { name: "ラベル" })).toHaveValue("自分で決めた名前");
  await dialog.getByRole("textbox", { name: "ファイル", exact: true }).fill("X:\\notes\\b.txt");
  await expect(dialog.getByRole("textbox", { name: "ラベル" })).toHaveValue("自分で決めた名前");
  await dialog.getByRole("button", { name: "フォルダ" }).click();
  await expect(dialog.getByRole("textbox", { name: "フォルダ", exact: true })).toHaveValue("X:\\notes\\folder");
  await dialog.getByRole("button", { name: "URL" }).click();
  await expect(dialog.getByRole("textbox", { name: "URL", exact: true })).toHaveValue("https://example.com/help");
  await expect(dialog.getByRole("textbox", { name: "ラベル" })).toHaveValue("example.com");
  await expect(dialog.getByRole("combobox", { name: "既存のグループ" })).toHaveValue("資料");
  await expect(dialog.getByRole("checkbox", { name: /左サイドバーに表示/ })).not.toBeChecked();
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toHaveCount(0);
  await page.locator(".brandBlock").click({ button: "right" });
  await page.getByRole("menuitem", { name: "ボタンを追加" }).click();
  await expect(page.getByRole("dialog", { name: "Button Builder" }).getByRole("textbox", { name: "ファイル", exact: true })).toHaveValue("");
  expect((await currentConfig(page)).buttons.some((button) => button.label === "自分で決めた名前")).toBe(false);
});

test("Wishlist self-drop does not duplicate or save, including after repeated drops", async ({ page }) => {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  fixture.config.today.items = fixture.config.today.items.map((item) => ({ ...item, done: true }));
  fixture.config.inbox = [{ id: "same-wish", text: "同じ一手", projectId: project.id, buttonIds: [] }];
  project.nextStep = { ...project.nextStep!, text: "同じ一手", sourceWishlistId: "same-wish" };
  await prepare(page, fixture);
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  const source = page.locator('[data-inbox-id="same-wish"]');
  const target = page.locator(`.nextStepCard[data-project-id="${project.id}"]`);
  const before = await currentConfig(page);
  for (let index = 0; index < 5; index += 1) {
    await source.scrollIntoViewIfNeeded();
    const from = (await source.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + 20, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 32, from.y + from.height / 2, { steps: 2 });
    await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
    await page.mouse.up();
    await expect(page.getByText("すでに次の一手に設定されています").last()).toBeVisible();
  }
  expect(await currentConfig(page)).toEqual(before);
  await page.reload();
  expect((await currentConfig(page)).inbox.filter((item) => item.id === "same-wish")).toHaveLength(1);
});

test("Wishlist replacement uses identity, not display text", async ({ page }) => {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  fixture.config.today.items = fixture.config.today.items.map((item) => ({ ...item, done: true }));
  fixture.config.inbox = [
    { id: "old-wish", text: "同じ表示名", projectId: project.id, buttonIds: [] },
    { id: "new-wish", text: "同じ表示名", projectId: project.id, buttonIds: [] },
  ];
  project.nextStep = { ...project.nextStep!, text: "同じ表示名", sourceWishlistId: "old-wish" };
  await prepare(page, fixture);
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  const source = page.locator('[data-inbox-id="new-wish"]');
  const target = page.locator(`.nextStepCard[data-project-id="${project.id}"]`);
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 32, from.y + from.height / 2, { steps: 2 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect.poll(async () => (await currentConfig(page)).projects[0].nextStep?.sourceWishlistId).toBe("new-wish");
  expect((await currentConfig(page)).inbox.map((item) => item.id)).toEqual(["old-wish", "new-wish"]);
});

test("Today total, execution list and selection roll over together at local midnight", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.settings.dayStartHour = 0;
  await page.clock.install({ time: new Date("2026-08-13T23:59:59+09:00").getTime() });
  await installTauriMock(page, fixture, "main", null, { rolloverOnLoadConfig: true });
  await page.goto("/");
  await expect(page.locator(".topTitle")).toContainText("今日 25分");
  await page.locator(".todayActivityBand .disclosure").click();
  await expect(page.locator(".todayActivityRow")).toHaveCount(1);
  await page.clock.runFor(2_000);
  await expect(page.locator(".topTitle")).toContainText("今日 0分");
  await expect(page.locator(".topDateLabel")).toContainText("8月14日");
  await expect(page.locator(".todayActivityRow")).toHaveCount(0);
  await expect(page.locator(".todayActivityBody")).toContainText("今日はまだ実行記録がありません");
  const saved = await currentConfig(page);
  expect(saved.today.date).toBe("2026-08-14");
  expect(saved.today.items).toHaveLength(0);
  expect(fixture.sessionEntries.entries.some((entry) => entry.date === "2026-08-13")).toBe(true);
});

test("Today refreshes on focus after a suspended configured-day boundary", async ({ page }) => {
  const fixture = createPublicFixture();
  await page.clock.install({ time: new Date("2026-08-14T03:59:59+09:00").getTime() });
  await installTauriMock(page, fixture, "main", null, { rolloverOnLoadConfig: true });
  await page.goto("/");
  await expect(page.locator(".topTitle")).toContainText("今日 25分");
  await page.clock.setFixedTime(new Date("2026-08-14T04:15:00+09:00"));
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(page.locator(".topDateLabel")).toContainText("8月14日");
  await expect(page.locator(".topTitle")).toContainText("今日 0分");
  expect((await currentConfig(page)).today.date).toBe("2026-08-14");
});

test("shortcut conflict names every action and clears when the duplicate is removed", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.settings.focusHotkey = "Ctrl+K";
  fixture.config.settings.miniHotkey = "Ctrl+K";
  await prepare(page, fixture);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const dialog = page.getByRole("dialog", { name: "設定" });
  await dialog.getByRole("tab", { name: "ショートカット" }).click();
  await expect(dialog.getByRole("alert")).toContainText("メイン呼び出し");
  await expect(dialog.getByRole("alert")).toContainText("辞書");
  await expect(dialog.getByRole("alert")).toContainText("ミニモード切替");
  await expect(dialog.locator(".shortcutCaptureField--conflict")).toHaveCount(3);
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "ミニモード切替のショートカットを解除" }).click();
  await expect(dialog.locator(".shortcutCaptureField--conflict")).toHaveCount(2);
  await dialog.getByRole("button", { name: "メイン呼び出しのショートカットを解除" }).click();
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

test("shortcut matching ignores modifier order and alias spelling", () => {
  const conflicts = findShortcutConflicts([
    { field: "main", label: "メイン呼び出し", value: "Ctrl+Alt+K" },
    { field: "dictionary", label: "辞書", value: "Alt+Ctrl+K" },
    { field: "mini", label: "ミニモード切替", value: "Ctrl+K" },
    { field: "instructions", label: "手順書", value: "Command+Shift+J" },
  ]);
  expect(conflicts).toHaveLength(1);
  expect(conflicts[0].bindings.map((binding) => binding.field)).toEqual(["main", "dictionary"]);
});

test("auxiliary static text is nonselectable while Settings and Builder inputs remain editable", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  expect(await settings.getByRole("heading", { name: "設定" }).evaluate((element) => getComputedStyle(element).userSelect)).toBe("none");
  await settings.getByRole("tab", { name: "バックアップ" }).click();
  expect(await settings.getByRole("heading", { name: "バックアップ" }).evaluate((element) => getComputedStyle(element).userSelect)).toBe("none");
  await settings.getByRole("button", { name: "設定を閉じる" }).click();
  await page.locator(".brandBlock").click({ button: "right" });
  await page.getByRole("menuitem", { name: "ボタンを追加" }).click();
  const builder = page.getByRole("dialog", { name: "Button Builder" });
  expect(await builder.getByRole("heading", { name: "ボタンを追加" }).evaluate((element) => getComputedStyle(element).userSelect)).toBe("none");
  const input = builder.getByRole("textbox", { name: "ラベル" });
  await input.fill("選択可");
  await input.selectText();
  expect(await input.evaluate((element) => (element as HTMLInputElement).selectionStart)).toBe(0);
});

test("Sidebar background menu orders group before button for pointer and Shift+F10", async ({ page }) => {
  await prepare(page);
  await page.locator(".brandBlock").click({ button: "right" });
  await expect(page.getByRole("menuitem")).toHaveText(["グループを追加", "ボタンを追加"]);
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /辞書を開く/ }).focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem")).toHaveText(["グループを追加", "ボタンを追加"]);
  await expect(page.getByRole("menuitem", { name: "グループを追加" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "ボタンを追加" })).toBeFocused();
  await page.keyboard.press("Escape");
  await page.clock.runFor(32);
  await expect(page.getByRole("button", { name: /辞書を開く/ })).toBeFocused();
});

test("mouse-free arrows traverse Sidebar, Dictionary, Main, toolbar, Settings and menu", async ({ page }) => {
  await prepare(page);
  await page.keyboard.press("ArrowDown");
  const dictionaryButton = page.getByRole("button", { name: /辞書を開く/ });
  await expect(dictionaryButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string }> } })
      .__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.some((call) => call.command === "plugin:webview|create_webview_window"),
  )).toBe(true);
  await page.goto("/?view=dictionary");
  await expect(page.locator(".dictionaryWindowShell")).toBeVisible();
  const titleAction = page.locator(".dictionaryWindowTitleActions button").first();
  await titleAction.focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".dictionaryWindowLock")).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".dictionaryPageTabs [role=tab]").first()).toBeFocused();
  await page.locator(".dictionarySearchInput").focus();
  await page.keyboard.type("サンプル");
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".dictionarySearchInput")).toHaveAttribute("aria-activedescendant", /dictionary-search-result-/);
  await page.keyboard.press("Escape");
  await page.goto("/");
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press("ArrowDown");
  await expect(dictionaryButton).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.locator(".quickGroupHeader").first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".mainScrollArea")))).toBe(true);
  await page.keyboard.press("ArrowUp");
  await expect(page.locator(".viewToggleButton").first()).toBeFocused();
  const settingsButton = page.getByRole("button", { name: "設定を開く" });
  for (let index = 0; index < 10; index += 1) {
    if (await settingsButton.evaluate((element) => document.activeElement === element)) break;
    await page.keyboard.press("ArrowRight");
  }
  await expect(settingsButton).toBeFocused();
  await page.keyboard.press("Enter");
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await expect(settings.getByRole("tab", { name: "基本" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(settings.getByRole("tab", { name: "ショートカット" })).toBeFocused();
  await expect(settings.getByRole("tab", { name: "ショートカット" })).toHaveAttribute("aria-selected", "true");
  await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".settingsSection:not(.settingsSection--hidden)")))).toBe(true);
  await settings.getByRole("button", { name: "キャンセル" }).focus();
  await page.keyboard.press("Enter");
  await expect(settings).toHaveCount(0);
  await dictionaryButton.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "グループを追加" })).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("menuitem", { name: "ボタンを追加" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dictionaryButton).toBeFocused();
});

test("Settings number input keeps native arrow behavior", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const input = page.getByRole("spinbutton", { name: "日付切替時刻" });
  await input.fill("4");
  await input.focus();
  await page.keyboard.press("ArrowUp");
  await expect(input).toHaveValue("5");
  await expect(input).toBeFocused();
});

test("representative hover controls have no transition delay", async ({ page }) => {
  await prepare(page);
  const measure = async (selector: string) => page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { delay: style.transitionDelay, duration: style.transitionDuration };
  });
  const main = await Promise.all([
    measure(".quickButton"),
    measure(".doNowStartPrimary"),
    measure(".nextStepCard"),
    measure(".topBar .viewToggleButton"),
  ]);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = await measure(".settingsTab");
  await page.getByRole("dialog", { name: "設定" }).getByRole("button", { name: "設定を閉じる" }).click();
  await page.locator(".brandBlock").click({ button: "right" });
  await page.getByRole("menuitem", { name: "ボタンを追加" }).click();
  const builder = await measure(".builderSourceMode");
  const samples = [...main, settings, builder];
  for (const sample of samples) {
    expect(sample.delay.split(",").every((value) => Number.parseFloat(value) === 0)).toBe(true);
    expect(sample.duration.split(",").every((value) => Number.parseFloat(value) <= 0.25)).toBe(true);
  }
  console.log("P133B hover computed styles:", JSON.stringify(samples));
});

test("early completion uses positive completion and neutral unfinished actions", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items[0].shortTimerMinutes = 3;
  await prepare(page, fixture);
  const row = page.locator(".todayRow").first();
  await row.getByRole("button", { name: /通常タイマー/ }).click();
  await page.clock.fastForward(180_000);
  await row.getByRole("button", { name: "終了", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "今日の分は完了にしますか？" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "今日の分は完了" })).toHaveClass(/confirmDialogButton--positive/);
  await expect(dialog.getByRole("button", { name: "未完了のまま終了" })).toHaveClass(/settingsButton--neutral/);
  expect(await dialog.getByRole("heading").evaluate((element) => getComputedStyle(element).userSelect)).toBe("none");
});

test("large Timer chrome remains nonselectable while its actions stay focusable", async ({ page }) => {
  await prepare(page);
  await page.locator(".doNowStartPrimary").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const timer = page.getByRole("dialog", { name: "拡大タイマー" });
  await expect(timer).toBeVisible();
  expect(await timer.locator(".expandedTimerClock").evaluate((element) => getComputedStyle(element).userSelect)).toBe("none");
  await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".expandedTimerActions")))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(timer).toHaveCount(0);
});
