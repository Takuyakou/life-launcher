import { expect, test, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const captureDir = "dist/visual-qa/post-v133c";

async function prepare(page: Page, fixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".sidebar")).toBeVisible();
}

async function capture(page: Page, name: string) {
  await mkdir(captureDir, { recursive: true });
  await page.screenshot({ path: `${captureDir}/${name}.png` });
}

async function currentConfig(page: Page): Promise<VisualQaFixture["config"]> {
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          currentConfig: () => VisualQaFixture["config"];
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function expectGroupThenButton(page: Page) {
  const items = await page.getByRole("menuitem").allTextContents();
  expect(items.slice(0, 2)).toEqual(["グループを追加", "ボタンを追加"]);
}

test("Sidebar menu order and pointer anchor stay consistent across group gaps and keys", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.buttons.splice(1, 0, {
    ...fixture.config.buttons[0],
    id: "second-sidebar-button",
    label: "二つ目",
  });
  await prepare(page, fixture);
  await page.locator(".brandBlock").click({ button: "right" });
  await expectGroupThenButton(page);
  await capture(page, "01-sidebar-background-menu");
  await page.keyboard.press("Escape");

  const group = page.locator(".quickGroup").first();
  const header = group.locator(".quickGroupHeader");
  await header.click({ button: "right" });
  await expectGroupThenButton(page);
  await capture(page, "02-sidebar-group-menu");
  await page.keyboard.press("Escape");

  const headerBox = (await header.boundingBox())!;
  const firstButtonBox = (await group.locator(".quickButton").first().boundingBox())!;
  const gapX = headerBox.x + 22;
  const gapY = (headerBox.y + headerBox.height + firstButtonBox.y) / 2;
  await page.mouse.click(gapX, gapY, { button: "right" });
  await expectGroupThenButton(page);
  const gapMenu = (await page.getByRole("menu").boundingBox())!;
  expect(gapMenu.width).toBeLessThanOrEqual(240);
  expect(Math.abs(gapMenu.x - gapX)).toBeLessThan(12);
  expect(Math.abs(gapMenu.y - gapY)).toBeLessThan(12);
  await capture(page, "03-sidebar-group-gap-menu");
  await page.keyboard.press("Escape");

  const buttons = group.locator(".quickButton");
  const first = (await buttons.nth(0).boundingBox())!;
  const second = (await buttons.nth(1).boundingBox())!;
  await page.mouse.click(first.x + 22, (first.y + first.height + second.y) / 2, { button: "right" });
  await expectGroupThenButton(page);
  await page.keyboard.press("Escape");

  const emptyGroup = page.locator(".quickGroup").last().locator(".quickGroupHeader");
  await emptyGroup.click({ button: "right" });
  await expectGroupThenButton(page);
  await page.keyboard.press("Escape");
  await header.focus();
  await page.keyboard.press("Shift+F10");
  await expectGroupThenButton(page);
  await page.keyboard.press("Escape");
  await header.focus();
  await page.keyboard.press("ContextMenu");
  await expectGroupThenButton(page);
});

test("Sidebar menu remains inside a narrow viewport after scrolling and near the bottom", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 380 });
  const fixture = createPublicFixture();
  for (let index = 0; index < 12; index += 1) {
    fixture.config.buttons.push({
      ...fixture.config.buttons[0],
      id: `extra-sidebar-${index}`,
      label: `追加項目 ${index}`,
    });
  }
  await prepare(page, fixture);
  const quickList = page.locator(".quickList");
  await quickList.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  const lastButton = page.locator(".quickButton").last();
  await lastButton.click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(320);
  expect(box.y + box.height).toBeLessThanOrEqual(380);
  await capture(page, "04-sidebar-narrow-bottom-menu");
});

test("Victory navigation enters editing and returns after Enter or Escape", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.victory = { text: "", done: false };
  await prepare(page, fixture);
  const navigation = page.locator(".victoryTextButton");
  await expect(navigation).toBeVisible();
  await page.clock.runFor(32);
  await page.getByRole("button", { name: "設定を開く" }).focus();
  await page.keyboard.press("ArrowDown");
  await expect(navigation).toBeFocused();
  await capture(page, "05-victory-navigation-focus");
  await page.keyboard.press("Enter");
  const editor = page.getByRole("textbox", { name: "今日の勝利条件" });
  await expect(editor).toBeFocused();
  await page.keyboard.type("test");
  await page.keyboard.press("ArrowLeft");
  await expect(editor).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await capture(page, "06-victory-editing");
  await page.keyboard.press("Enter");
  await expect(navigation).toBeFocused();
  await expect.poll(async () => (await currentConfig(page)).today.victory.text).toBe("test");
  await capture(page, "07-victory-confirmed");
  await page.keyboard.press("ArrowDown");
  await expect(navigation).not.toBeFocused();
  await navigation.focus();
  await page.keyboard.press("Enter");
  await editor.fill("test2");
  await page.keyboard.press("Enter");
  await expect(navigation).toBeFocused();
  await expect.poll(async () => (await currentConfig(page)).today.victory.text).toBe("test2");
  await navigation.focus();
  await page.keyboard.press("Enter");
  await editor.fill("test3");
  await page.keyboard.press("Escape");
  await expect(navigation).toBeFocused();
  await expect.poll(async () => (await currentConfig(page)).today.victory.text).toBe("test3");
  await page.keyboard.press("ArrowDown");
  await expect(navigation).not.toBeFocused();
});

test("active lower-left Timer actions have an Arrow path and disappear after End", async ({ page }) => {
  await prepare(page);
  await page.locator(".doNowStartPrimary").click();
  const timer = page.locator(".timerDock");
  const lastGroup = page.locator(".quickGroupHeader").last();
  await lastGroup.focus();
  await page.keyboard.press("ArrowDown");
  await expect(timer.getByRole("button", { name: "一時停止" })).toBeFocused();
  await capture(page, "08-normal-timer-keyboard-focus");
  await page.keyboard.press("ArrowRight");
  await expect(timer.getByRole("button", { name: "終了" })).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(timer.getByRole("button", { name: "一時停止" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(timer.getByRole("button", { name: "再開" })).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(lastGroup).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(timer.getByRole("button", { name: "一時停止" })).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Enter");
  await expect(timer.locator(".timerControls")).toHaveCount(0);
});

for (const [name, todayLinked, pauseAfterContinue] of [
  ["Today3 source", true, false],
  ["NextStep source with pause", false, true],
] as const) {
  test(`Do Now Continue then normal Timer End retains A completion snapshot: ${name}`, async ({ page }) => {
    const fixture = createPublicFixture();
    fixture.config.projects[0].nextStep!.shortTimerMinutes = 1;
    if (!todayLinked) fixture.config.today.items = [];
    await prepare(page, fixture);
    await expect(page.locator(".doNowBand")).toContainText("資料を1ページ読む");
    await page.locator(".doNowStartPrimary").click();
    await page.clock.runFor(60_500);
    const prompt = page.getByRole("dialog", { name: "タイマー満了" });
    await expect(prompt).toBeVisible();
    await prompt.getByRole("button", { name: /続ける/ }).click();
    await expect(prompt).toHaveCount(0);
    const timer = page.locator(".timerDock");
    if (pauseAfterContinue) {
      await timer.getByRole("button", { name: "一時停止" }).click();
      await timer.getByRole("button", { name: "再開" }).click();
    }
    await page.clock.runFor(1_000);
    await timer.getByRole("button", { name: "終了" }).click();
    const hold = page.locator(".doNowContent--hold");
    await expect(hold).toContainText("✓ 一手進みました");
    await expect(hold).toContainText("資料を1ページ読む");
    await expect(hold.getByRole("button", { name: "次の一手を見る" })).toBeEnabled();
    await expect(timer.locator(".timerControls")).toHaveCount(0);
    const recordCalls = await page.evaluate(() =>
      (
        window as Window & {
          __LIFE_LAUNCHER_VISUAL_QA__: {
            invokeCalls: Array<{ command: string }>;
          };
        }
      ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === "record_session").length,
    );
    expect(recordCalls).toBe(1);
    if (todayLinked) expect((await currentConfig(page)).today.items[0]?.done).toBe(true);
    else expect((await currentConfig(page)).today.items).toHaveLength(0);
    await capture(page, todayLinked ? "09-do-now-today-completed" : "10-do-now-next-step-completed");
    await hold.getByRole("button", { name: "次の一手を見る" }).click();
    await expect(hold).toHaveCount(0);
    await expect(page.locator(".doNowBand")).not.toContainText("資料を1ページ読む");
  });
}

test("Record tabs stay opaque while scrolling at desktop and narrow widths", async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 420 });
  await prepare(page);
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  const header = page.locator(".recordsViewHeader");
  const scrollArea = page.locator(".mainScrollArea");
  await expect(header).toHaveCSS("background-color", "rgb(22, 21, 18)");
  await capture(page, "11-record-tabs-top");
  await scrollArea.evaluate((element) => { element.scrollTop = 350; });
  await expect.poll(() => scrollArea.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(header).toHaveCSS("background-color", "rgb(22, 21, 18)");
  await capture(page, "12-record-tabs-mid-scroll");
  await scrollArea.evaluate((element) => { element.scrollTop = element.scrollHeight; });
  await capture(page, "13-record-tabs-bottom");
  await page.getByRole("tab", { name: "今週を決める" }).focus();
  await capture(page, "14-record-tabs-focused");
  await page.setViewportSize({ width: 800, height: 540 });
  await capture(page, "15-record-tabs-narrow");
});
