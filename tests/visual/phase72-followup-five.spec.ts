import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture = createPublicFixture(), width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function saveCount(page: Page) {
  return page.evaluate(
    () =>
      (
        window as Window & {
          __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string }> };
        }
      ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === "save_config")
        .length,
  );
}

async function beginDrag(page: Page, source: Locator, distance: number) {
  const box = await source.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.45;
  const y = box!.y + box!.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + distance, y);
}

test("follow-up: Today3 body is a drag surface and editing stays in canonical actions", async ({
  page,
}) => {
  await prepare(page);
  const row = page.locator(".todayRow").first();
  const body = row.locator(".todayTextButton");
  const before = await saveCount(page);

  await body.click();
  await expect(page.getByRole("textbox", { name: "今日の項目" })).toHaveCount(0);
  expect(await saveCount(page)).toBe(before);

  const box = await body.boundingBox();
  expect(box).not.toBeNull();
  await beginDrag(page, body, 4);
  await expect(page.locator(".todayDragGhost")).toHaveCount(0);
  await page.mouse.move(box!.x + box!.width * 0.45 + 8, box!.y + box!.height * 0.5);
  await expect(page.locator(".todayDragGhost")).toBeVisible();
  await page.mouse.up();

  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "次の一手を編集", exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "キャンセル", exact: true }).click();

  await row.hover();
  await row.locator(".todayRowMenu").click();
  await page.getByRole("menuitem", { name: "編集", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "次の一手を編集", exact: true })).toBeVisible();
});

test("follow-up: waiting clock shares vertical drag state and is disabled once active", async ({
  page,
}) => {
  await prepare(page);
  const clock = page.locator(".timerDock .timerClock");
  const input = page.getByRole("spinbutton", { name: "通常タイマーの分数" });
  await expect(clock).toHaveText("25分");
  await expect(clock).toHaveAttribute("title", "上下にドラッグして分数を変更");
  await expect(clock).toHaveCSS("cursor", "ns-resize");
  await expect(clock).toHaveCSS("user-select", "none");

  const beforeClick = await saveCount(page);
  await clock.click();
  expect(await saveCount(page)).toBe(beforeClick);
  await expect(input).toHaveValue("25");

  const box = await clock.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 16);
  await expect(clock).toHaveText("27分");
  await expect(input).toHaveValue("27");
  expect(await page.evaluate(() => window.getSelection()?.toString() ?? "")).toBe("");
  expect(await saveCount(page)).toBe(beforeClick);
  await page.mouse.up();
  await expect.poll(() => saveCount(page)).toBe(beforeClick + 1);
  expect((await currentConfig(page)).settings.defaultTimerMinutes).toBe(27);

  const updatedBox = await clock.boundingBox();
  expect(updatedBox).not.toBeNull();
  const updatedX = updatedBox!.x + updatedBox!.width / 2;
  const updatedY = updatedBox!.y + updatedBox!.height / 2;
  await page.mouse.move(updatedX, updatedY);
  await page.mouse.down();
  await page.mouse.move(updatedX, updatedY + 16);
  await expect(clock).toHaveText("25分");
  await expect(input).toHaveValue("25");
  expect(await saveCount(page)).toBe(beforeClick + 1);
  await page.mouse.up();
  await expect.poll(() => saveCount(page)).toBe(beforeClick + 2);
  expect((await currentConfig(page)).settings.defaultTimerMinutes).toBe(25);

  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: /通常タイマー25分で開始/ })
    .click();
  await expect(clock).not.toHaveClass(/timerClock--adjustable/);
  await expect(clock).not.toHaveAttribute("title");
  await page.locator(".timerDock").getByRole("button", { name: "一時停止" }).click();
  await expect(clock).toHaveClass(/timerClock--paused/);
  await expect(clock).not.toHaveClass(/timerClock--adjustable/);
});

for (const width of [860]) {
  test(
    "follow-up: Undo remains usable before expiry and its acknowledgement expires at " + width,
    async ({ page }) => {
      await prepare(page, createPublicFixture(), width);
      await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
      await page
        .locator(".todayRow")
        .first()
        .getByRole("button", { name: "今日の3件から外す" })
        .click();
      const toast = page.locator(".toast", { hasText: "今日の3件から外しました" }).last();
      await expect(toast).toBeVisible();
      // The native CSS entrance animation does not follow the mocked JS clock.
      await expect.poll(async () => {
        const box = await toast.boundingBox();
        return box ? box.x + box.width : Infinity;
      }).toBeLessThanOrEqual(width);
      const box = (await toast.boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.y + box.height).toBeLessThanOrEqual(900);
      expect(await toast.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      await page.mouse.move(1, 1);
      await page.getByRole("button", { name: "使い方", exact: true }).focus();
      await page.clock.runFor(7900);
      await expect(toast).toBeVisible();
      await toast.getByRole("button", { name: "元に戻す" }).click();
      const restored = page.locator(".toast", { hasText: "元に戻しました" }).last();
      await expect(restored).toBeVisible();
      await page.mouse.move(1, 1);
      await page.getByRole("button", { name: "使い方", exact: true }).focus();
      await page.clock.runFor(3900);
      await expect(restored).toBeVisible();
      await page.clock.runFor(400);
      await expect(restored).toHaveCount(0);
    },
  );
}
