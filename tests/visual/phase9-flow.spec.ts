import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => { today: { items: Array<{ done: boolean }> } };
    invokeCalls: Array<{ command: string }>;
  };
};

const recordSessionCount = (page: Page) =>
  page.evaluate(
    () =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === "record_session",
      ).length,
  );

test("P9-00 flow: Today3 short Timer expires, continues, pauses, resumes, ends and records once", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createFullTodayFixture(), "main");
  await page.goto("/");

  await expect(page.locator(".doNowBand")).toContainText("資料を1ページ読む");

  const row = page.locator(".todayRow").first();
  await expect(row).not.toHaveClass(/todayRow--complete/);
  await row.getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await expect(row).toHaveClass(/todayRow--running/);

  await page.clock.runFor(60_500);
  const expired = page.getByRole("dialog", { name: "タイマー満了" });
  await expect(expired).toBeVisible();
  await expired.getByRole("button", { name: /続ける/ }).click();
  await expect(expired).toHaveCount(0);

  const timer = page.locator(".timerDock");
  await timer.getByRole("button", { name: "一時停止" }).click();
  await expect(timer.locator(".timerStateBadge")).toHaveText("一時停止");
  await timer.getByRole("button", { name: "再開" }).click();
  await expect(timer.locator(".timerStateBadge")).toHaveText("実行中");

  await page.clock.runFor(1_000);
  await timer.getByRole("button", { name: "終了" }).click();
  const confirmation = page.getByRole("dialog", { name: "今日の分は完了にしますか？" });
  await confirmation.getByRole("button", { name: "今日の分は完了" }).click();
  await expect(confirmation).toHaveCount(0);

  await expect(row).toHaveClass(/todayRow--complete/);
  expect(
    await page.evaluate(
      () => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().today.items[0].done,
    ),
  ).toBe(true);
  expect(await recordSessionCount(page)).toBe(1);
});
