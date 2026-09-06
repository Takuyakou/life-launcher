import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_DIR = resolve("docs/phase6.1/screenshots");

test.describe.configure({ mode: "serial" });

async function prepare(page: Page, viewport = { width: 1440, height: 900 }) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize(viewport);
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
}

function guideOpener(page: Page) {
  return page.getByRole("button", { name: "使い方" });
}

function guideDialog(page: Page) {
  return page.getByRole("dialog", { name: "使い方" });
}

async function openGuide(page: Page) {
  await guideOpener(page).click();
  const dialog = guideDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "使い方", exact: true })).toBeFocused();
  return dialog;
}

test("Guide states the current registration, selection, and completion flow", async ({ page }) => {
  await prepare(page);
  const dialog = await openGuide(page);

  await expect(dialog).toContainText("自分で選ぶときは「今日を組み立てる」で候補の「今日へ」を押し");

  const today = dialog.locator('[data-help-section-id="today"]');
  await expect(today).toContainText("プロジェクトの次の一手とやりたいことだけを5件ずつ表示");
  await expect(today).toContainText("新規登録、送付先の選択、候補の削除を行いません");
  await expect(today).toContainText("元の次の一手ややりたいことは残ります");
  await expect(today).toContainText("小型ダイアログで追加します");
  await expect(today).toContainText("タイマー満了後に「終わる」で確定した項目だけ完了");
  await expect(today).toContainText("次の3件を選ぶ");

  const projects = dialog.locator('[data-help-section-id="projects"]');
  await expect(projects).toContainText("「プロジェクトを追加」ではプロジェクトと最初の次の一手を登録");
  await expect(projects).toContainText("次の一手の一覧にはタイマー開始ボタンを置きません");

  const timer = dialog.locator('[data-help-section-id="timer"]');
  await expect(timer).toContainText("続ける(+15分)");
  await expect(timer).toContainText("予定時間前の手動終了は記録だけを残し");

  await expect(dialog).not.toContainText("通常の次の一手カードからも開始できます");
  await expect(dialog).not.toContainText("昨日の勝利条件");
  await expect(dialog).not.toContainText("一覧の末尾に表示されます");
});

test("Guide contents move focus to a section and return to the first contents item", async ({
  page,
}) => {
  await prepare(page);
  const dialog = await openGuide(page);
  const navigation = dialog.getByRole("navigation", { name: "使い方の目次" });
  const todayButton = navigation.getByRole("button", { name: /今日の画面/ });

  await todayButton.click();
  const todayHeading = dialog
    .locator('[data-help-section-id="today"]')
    .getByRole("heading", { name: "今日の画面" });
  await expect(todayHeading).toBeFocused();
  await expect(todayButton).toHaveAttribute("aria-current", "location");

  await dialog
    .locator('[data-help-section-id="today"]')
    .getByRole("button", { name: "目次へ戻る" })
    .click();
  await expect(navigation.getByRole("button").first()).toBeFocused();
});

test("Guide traps focus and returns it after Escape or backdrop dismissal", async ({ page }) => {
  await prepare(page);
  const opener = guideOpener(page);
  let dialog = await openGuide(page);

  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "閉じる", exact: true })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("button", { name: "使い方を閉じる" })).toBeFocused();

  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  dialog = await openGuide(page);
  await page.locator(".helpGuideBackdrop").click({ position: { x: 2, y: 2 } });
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("Guide remains bounded at 860px and exposes the collapsed contents below 760px", async ({
  page,
}) => {
  await prepare(page, { width: 860, height: 700 });
  let dialog = await openGuide(page);
  const box = await dialog.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(860);
  expect(box!.y + box!.height).toBeLessThanOrEqual(700);
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).toBe(true);
  await dialog.screenshot({ path: resolve(SCREENSHOT_DIR, "p61-03-guide-860.png") });

  await page.keyboard.press("Escape");
  await page.setViewportSize({ width: 700, height: 700 });
  dialog = await openGuide(page);
  const toggle = dialog.getByRole("button", { name: "目次を開く" });
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await toggle.click();
  await expect(dialog.getByRole("navigation", { name: "使い方の目次" })).toBeVisible();
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
  ).resolves.toBe(true);
});
