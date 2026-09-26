import { mkdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const CAPTURE_DIR = "dist/visual-qa/post-v133b";

async function capture(page: Page, name: string) {
  mkdirSync(CAPTURE_DIR, { recursive: true });
  await page.screenshot({ path: `${CAPTURE_DIR}/${name}.png` });
}

test("P133B visual QA: keyboard, menus, Settings and Builder", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.settings.focusHotkey = "Ctrl+K";
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.getByRole("button", { name: /辞書を開く/ })).toBeVisible();
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.keyboard.press("ArrowDown");
  await expect(page.getByRole("button", { name: /辞書を開く/ })).toBeFocused();
  await capture(page, "01-sidebar-keyboard-focus");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".mainScrollArea :focus")).toHaveCount(1);
  await capture(page, "02-main-keyboard-focus");
  await page.locator(".brandBlock").click({ button: "right" });
  await expect(page.getByRole("menuitem")).toHaveText(["グループを追加", "ボタンを追加"]);
  await capture(page, "03-sidebar-context-menu");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /辞書を開く/ }).focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "グループを追加" })).toBeFocused();
  await capture(page, "04-context-menu-keyboard-focus");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();
  await capture(page, "05-settings-basic");
  await settings.getByRole("tab", { name: "ショートカット" }).focus();
  await capture(page, "06-settings-tab-keyboard-focus");
  await settings.getByRole("tab", { name: "ショートカット" }).click();
  await expect(settings.getByRole("alert")).toContainText("Ctrl+K");
  await capture(page, "07-shortcut-conflict");
  await settings.getByRole("tab", { name: "バックアップ" }).click();
  await capture(page, "08-settings-backup");
  await settings.getByRole("button", { name: "設定を閉じる" }).click();
  await page.locator(".brandBlock").click({ button: "right" });
  await page.getByRole("menuitem", { name: "ボタンを追加" }).click();
  const builder = page.getByRole("dialog", { name: "Button Builder" });
  await builder.getByRole("textbox", { name: "ファイル", exact: true }).fill("X:\\notes\\capture.txt");
  await builder.getByRole("textbox", { name: "ラベル" }).fill("確認用");
  await builder.getByRole("button", { name: "フォルダ" }).click();
  await builder.getByRole("button", { name: "ファイル" }).click();
  await expect(builder.getByRole("textbox", { name: "ラベル" })).toHaveValue("確認用");
  await capture(page, "09-builder-mode-roundtrip");
});

test("P133B visual QA: large Timer and positive completion", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items[0].shortTimerMinutes = 3;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  const row = page.locator(".todayRow").first();
  await row.getByRole("button", { name: /通常タイマー/ }).click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toBeVisible();
  await capture(page, "10-large-timer");
  await page.keyboard.press("Escape");
  await page.clock.fastForward(180_000);
  await row.getByRole("button", { name: "終了", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "今日の分は完了にしますか？" })).toBeVisible();
  await capture(page, "11-completion-confirmation");
});

test("P133B visual QA: Wishlist self-drop and post-midnight Today", async ({ page }) => {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  fixture.config.today.items = fixture.config.today.items.map((item) => ({ ...item, done: true }));
  fixture.config.inbox = [{ id: "same-wish", text: "同じ一手", projectId: project.id, buttonIds: [] }];
  project.nextStep = { ...project.nextStep!, text: "同じ一手", sourceWishlistId: "same-wish" };
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  const source = page.locator('[data-inbox-id="same-wish"]');
  const target = page.locator(`.nextStepCard[data-project-id="${project.id}"]`);
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 32, from.y + from.height / 2, { steps: 2 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect(page.getByText("すでに次の一手に設定されています").last()).toBeVisible();
  await capture(page, "12-wishlist-self-drop");
});

test("P133B visual QA: Today after the configured local midnight", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.settings.dayStartHour = 0;
  await page.clock.install({ time: new Date("2026-08-13T23:59:59+09:00").getTime() });
  await installTauriMock(page, fixture, "main", null, { rolloverOnLoadConfig: true });
  await page.goto("/");
  await page.locator(".todayActivityBand .disclosure").click();
  await page.clock.runFor(2_000);
  await expect(page.locator(".topTitle")).toContainText("今日 0分");
  await expect(page.locator(".todayActivityRow")).toHaveCount(0);
  await capture(page, "13-today-after-midnight");
});
