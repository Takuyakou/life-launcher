import { expect, test } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test("Today timers follow global settings only when the source has no timer override", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  const linked = fixture.config.projects[0].nextStep!;
  delete linked.defaultTimerMinutes;
  delete linked.shortTimerMinutes;
  fixture.config.today.items[0].defaultTimerMinutes = 25;
  fixture.config.today.items[0].shortTimerMinutes = 5;
  fixture.config.today.items[1].done = false;
  fixture.config.today.items[1].defaultTimerMinutes = 42;
  fixture.config.today.items.push({
    text: fixture.config.projects[1].nextStep!.text,
    done: false,
    sourceKey: `project:${fixture.config.projects[1].id}`,
    projectId: fixture.config.projects[1].id,
    defaultTimerMinutes: 20,
  });

  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture);
  await page.goto("/");

  const rows = page.locator(".todayRow");
  await expect(rows.nth(0).getByRole("button", { name: "通常タイマー25分で開始" })).toBeVisible();
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings.getByRole("spinbutton", { name: "通常タイマー分数" }).fill("37");
  await settings.getByRole("spinbutton", { name: "短時間タイマー分数" }).fill("7");
  await settings.getByRole("button", { name: "保存", exact: true }).click();

  await expect(rows.nth(0).getByRole("button", { name: "通常タイマー37分で開始" })).toBeVisible();
  await expect(rows.nth(0).getByRole("button", { name: "短時間タイマー7分で開始" })).toBeVisible();
  await expect(rows.nth(1).getByRole("button", { name: "通常タイマー42分で開始" })).toBeVisible();
  await expect(rows.nth(2).getByRole("button", { name: "通常タイマー20分で開始" })).toBeVisible();

  const globalTimer = page.getByRole("spinbutton", { name: "通常タイマーの分数" });
  await globalTimer.fill("39");
  await globalTimer.blur();
  await expect(rows.nth(0).getByRole("button", { name: "通常タイマー39分で開始" })).toBeVisible();

  await page.reload();
  await expect(rows.nth(0).getByRole("button", { name: "通常タイマー39分で開始" })).toBeVisible();
  await rows.nth(0).getByRole("button", { name: "通常タイマー39分で開始" }).click();
  await expect(page.locator(".timerDock .timerClock")).toHaveText(/^39:/);
});

test("Wishlist Today timer follows global settings while an orphaned snapshot stays fixed", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [
    {
      text: fixture.config.inbox[0].text,
      done: false,
      sourceKey: `wishlist:${fixture.config.inbox[0].id}`,
      defaultTimerMinutes: 25,
    },
    {
      text: "Previously selected step",
      done: false,
      sourceKey: "project:removed-project",
      defaultTimerMinutes: 42,
    },
  ];
  fixture.config.settings.defaultTimerMinutes = 31;

  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture);
  await page.goto("/");

  const rows = page.locator(".todayRow");
  await expect(rows.nth(0).getByRole("button", { name: "通常タイマー31分で開始" })).toBeVisible();
  await expect(rows.nth(1).getByRole("button", { name: "通常タイマー42分で開始" })).toBeVisible();
});
