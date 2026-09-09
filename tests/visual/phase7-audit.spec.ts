import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { TodayItemSchema } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type Control = {
  currentConfig: () => AppConfig;
  invokeCalls: { command: string; args: Record<string, unknown> }[];
};

async function state(page: Page) {
  return page.evaluate(() => {
    const control = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    return { config: control.currentConfig(), calls: control.invokeCalls };
  });
}

async function prepare(page: Page, short: number, planned: number) {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  project.shortTimerMinutes = 10;
  fixture.config.today.items = [
    {
      text: project.nextStep,
      done: false,
      sourceKey: `project:${project.id}`,
      projectId: project.id,
      shortTimerMinutes: short,
      defaultTimerMinutes: planned,
    },
  ];
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".todayRow")).toHaveCount(1);
  return fixture;
}

test("P7 audit: actual Today schema accepts 1..240 integer minutes, not invalid legacy values", () => {
  for (const shortTimerMinutes of [1, 2, 3, 5, 10, 240, undefined]) {
    expect(
      TodayItemSchema.safeParse({ text: "Audit", done: false, shortTimerMinutes }).success,
    ).toBe(true);
  }
  for (const shortTimerMinutes of [null, 0, -1, 241, 1.5, "3", NaN, Infinity]) {
    expect(
      TodayItemSchema.safeParse({ text: "Audit", done: false, shortTimerMinutes }).success,
    ).toBe(false);
  }
});

// P7.0 boundary fixtures now exercise the implemented P7.1 manual-stop flow.
const boundaries = [
  { short: 3, planned: 25, elapsed: [179, 180, 1499, 1500] },
  { short: 5, planned: 25, elapsed: [299, 300, 1499, 1500] },
  { short: 10, planned: 25, elapsed: [299, 300, 1499, 1500] },
  { short: 3, planned: 3, elapsed: [179, 180] },
];

for (const { short, planned, elapsed } of boundaries) {
  for (const seconds of elapsed) {
    test(`P7 baseline short=${short} planned=${planned} elapsed=${seconds}`, async ({ page }) => {
      const fixture = await prepare(page, short, planned);
      const card = page.locator(".todayRow");
      await expect(
        card.getByRole("button", { name: `短時間タイマー${short}分で開始` }),
      ).toBeVisible();
      await card.getByRole("button", { name: `通常タイマー${planned}分で開始` }).click();
      await page.clock.fastForward(seconds * 1000);
      const reachedPlanned = seconds >= planned * 60;
      if (reachedPlanned) {
        await expect(page.getByText("予定時間になりました", { exact: true })).toBeVisible();
        expect(
          (await state(page)).calls.filter((c) => c.command === "record_session"),
        ).toHaveLength(0);
        await page.getByRole("button", { name: "終わる", exact: true }).click();
      } else {
        await expect(page.getByRole("dialog")).toHaveCount(0);
        await card.getByRole("button", { name: "終了", exact: true }).click();
        if (seconds >= Math.min(5, short) * 60) {
          await expect(
            page.getByRole("dialog", { name: "今日の分は完了にしますか？" }),
          ).toBeVisible();
          await page.getByRole("button", { name: "未完了のまま終了", exact: true }).click();
        }
      }
      await expect(
        card.getByRole("status", {
          name: reachedPlanned ? "今日の分は完了" : "未完了",
          exact: true,
        }),
      ).toBeVisible();
      const after = await state(page);
      const records = after.calls.filter((c) => c.command === "record_session");
      expect(records).toHaveLength(1);
      expect(records[0].args.session).toMatchObject({ minutes: Math.floor(seconds / 60) });
      expect(after.config.projects).toEqual(fixture.config.projects);
      expect(after.config.inbox).toEqual(fixture.config.inbox);
      expect(after.config.today.items[0].shortTimerMinutes).toBe(short);
      await expect(page.getByText("今日の分は完了にしますか？", { exact: true })).toHaveCount(0);
    });
  }
}

test("P7 baseline: paused time is excluded before and after resume", async ({ page }) => {
  await prepare(page, 3, 25);
  const card = page.locator(".todayRow");
  await card.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.fastForward(59_000);
  await card.getByRole("button", { name: "このセッションを一時停止" }).click();
  await page.clock.fastForward(600_000);
  await card.getByRole("button", { name: "終了", exact: true }).click();
  expect((await state(page)).calls.filter((c) => c.command === "record_session")).toHaveLength(0);
  await card.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.fastForward(59_000);
  await card.getByRole("button", { name: "このセッションを一時停止" }).click();
  await page.clock.fastForward(600_000);
  await card.getByRole("button", { name: "このセッションを再開", exact: true }).click();
  await page.clock.fastForward(1_000);
  await card.getByRole("button", { name: "終了", exact: true }).click();
  const records = (await state(page)).calls.filter((c) => c.command === "record_session");
  expect(records).toHaveLength(1);
  expect(records[0].args.session).toMatchObject({ minutes: 1 });
});

test("P7 baseline: a wall-clock jump counts as elapsed unless paused", async ({ page }) => {
  await prepare(page, 3, 25);
  const card = page.locator(".todayRow");
  await card.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.setSystemTime(new Date(new Date(FIXTURE_NOW).getTime() + 600_000));
  await page.clock.runFor(1_000);
  await card.getByRole("button", { name: "終了", exact: true }).click();
  await page.getByRole("button", { name: "未完了のまま終了", exact: true }).click();
  const records = (await state(page)).calls.filter((c) => c.command === "record_session");
  expect(records).toHaveLength(1);
  expect(records[0].args.session).toMatchObject({ minutes: 10 });
});
