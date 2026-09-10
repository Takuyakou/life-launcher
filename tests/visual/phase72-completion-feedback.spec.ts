import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type Control = {
  currentConfig: () => AppConfig;
  setSaveConfigFailure: (failed: boolean) => void;
  updateConfig: (config: AppConfig) => void;
};

async function prepare(page: Page, fixture: VisualQaFixture, reducedMotion = false) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.emulateMedia({ reducedMotion: reducedMotion ? "reduce" : "no-preference" });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function currentConfig(page: Page) {
  return page.evaluate(
    () =>
      (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control })
        .__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function setSaveFailure(page: Page, failed: boolean) {
  await page.evaluate(
    (value) =>
      (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control })
        .__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(value),
    failed,
  );
}

function plannedFixture(completedBefore = 0) {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  project.shortTimerMinutes = 1;
  fixture.config.today.items = [
    {
      text: "先に終えた一手 A",
      done: completedBefore >= 1,
      sourceKey: "manual:done-a",
      shortTimerMinutes: 1,
      defaultTimerMinutes: 1,
    },
    {
      text: "先に終えた一手 B",
      done: completedBefore >= 2,
      sourceKey: "manual:done-b",
      shortTimerMinutes: 1,
      defaultTimerMinutes: 1,
    },
    {
      text: project.nextStep,
      done: false,
      sourceKey: `project:${project.id}`,
      projectId: project.id,
      shortTimerMinutes: 1,
      defaultTimerMinutes: 1,
    },
  ];
  return fixture;
}

async function finishPlannedToday(page: Page, rowIndex = 2) {
  const row = page.locator(".todayRow").nth(rowIndex);
  await row.getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await page.clock.runFor(60_500);
  await expect(page.getByRole("dialog", { name: "タイマー満了" })).toBeVisible();
  await page.getByRole("button", { name: "終わる" }).click();
  return row;
}

test("P72-05 Victory feedback fires only for the first saved false-to-true transition", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const checkbox = page.getByRole("checkbox", { name: "勝利条件を達成" });
  await checkbox.focus();
  await checkbox.check();
  await expect(page.getByText("今日の勝利、達成", { exact: true })).toBeVisible();
  await expect(page.locator(".completionParticle")).toHaveCount(6);
  await expect(checkbox).toBeFocused();
  await page.clock.fastForward(1_200);
  await expect(page.getByText("今日の勝利、達成", { exact: true })).toHaveCount(0);
  await checkbox.uncheck();
  await checkbox.check();
  await expect(page.getByText("今日の勝利、達成", { exact: true })).toHaveCount(0);
});

test("P72-05 failed Victory save never rewards", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  await setSaveFailure(page, true);
  await page.getByRole("checkbox", { name: "勝利条件を達成" }).click();
  await expect(page.locator(".victoryRewardLabel")).toHaveCount(0);
  expect((await currentConfig(page)).today.victory.done).toBe(false);
});

test("P72-05 a new day may reward its own first saved Victory completion", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const victory = page.getByRole("checkbox", { name: "勝利条件を達成" });
  await victory.check();
  await expect(page.locator(".victoryRewardLabel")).toBeVisible();
  await page.clock.fastForward(1_100);
  await page.evaluate(() => {
    const qa = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    const current = qa.currentConfig();
    qa.updateConfig({
      ...current,
      today: {
        ...current.today,
        date: "2026-08-14",
        victory: { ...current.today.victory, done: false },
      },
    });
  });
  await expect(victory).not.toBeChecked();
  await victory.check();
  await expect(page.locator(".victoryRewardLabel")).toBeVisible();
});

test("P72-05 existing completed state on initial load is static", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.victory.done = true;
  fixture.config.today.items = fixture.config.today.items.map((item) => ({ ...item, done: true }));
  await prepare(page, fixture);
  await expect(page.locator(".victoryBadge")).toHaveText("達成");
  await expect(page.locator(".victoryRewardLabel, .todayAllCompletionReward, .completionParticle"))
    .toHaveCount(0);
});

test("P72-05 removing and undoing a completed Today item never replays completion feedback", async ({
  page,
}) => {
  const fixture = plannedFixture(2);
  fixture.config.today.items[2].done = true;
  await prepare(page, fixture);
  await page.locator(".todayRemoveButton").last().click();
  const toast = page.locator(".toast", { hasText: "今日の3件から外しました" });
  await toast.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.locator(".todayRow")).toHaveCount(3);
  await expect(
    page.locator(
      ".todayRow--justCompleted, .todayAllCompletionReward, .doNowCompletionEcho, .completionParticle",
    ),
  ).toHaveCount(0);
});

test("P72-05 individual planned completion shows one green feedback then keeps static done", async ({
  page,
}) => {
  await prepare(page, plannedFixture(0));
  const row = await finishPlannedToday(page);
  await expect(row).toHaveClass(/todayRow--justCompleted/);
  await expect(page.locator(".todayAllCompletionReward, .doNowCompletionEcho")).toHaveCount(0);
  await expect(page.locator(".completionParticle")).toHaveCount(0);
  await page.clock.fastForward(1_200);
  await expect(row).not.toHaveClass(/todayRow--justCompleted/);
  await expect(row).toHaveClass(/todayRow--complete/);
});

test("P72-05 the third completion prioritizes one 3-of-3 milestone and keeps next batch usable", async ({
  page,
}) => {
  await prepare(page, plannedFixture(2));
  await finishPlannedToday(page);
  await expect(page.locator(".todayRow--justCompleted")).toHaveCount(0, { timeout: 500 });
  const milestone = page.locator(".todayAllCompletionReward");
  await expect(milestone).toBeVisible();
  await expect(milestone).toContainText("今日の3件、完了！");
  await expect(page.locator(".completionParticle")).toHaveCount(6);
  await expect(page.locator(".doNowCompletionEcho")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "次の3件を選ぶ" })).toBeEnabled();
});

test("P72-05 early completion yes rewards", async ({ page }) => {
  const yesFixture = plannedFixture(0);
  yesFixture.config.projects[0].shortTimerMinutes = 3;
  yesFixture.config.today.items[2].shortTimerMinutes = 3;
  yesFixture.config.today.items[2].defaultTimerMinutes = 25;
  await prepare(page, yesFixture);
  const row = page.locator(".todayRow").nth(2);
  await row.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.fastForward(180_000);
  await row.getByRole("button", { name: "終了", exact: true }).click();
  await page.getByRole("button", { name: "今日の分は完了", exact: true }).click();
  await expect(row).toHaveClass(/todayRow--justCompleted/);
});

test("P72-05 early completion no leaves no feedback", async ({ page }) => {
  const fixture = plannedFixture(0);
  fixture.config.projects[0].shortTimerMinutes = 3;
  fixture.config.today.items[2].shortTimerMinutes = 3;
  fixture.config.today.items[2].defaultTimerMinutes = 25;
  await prepare(page, fixture);
  const row = page.locator(".todayRow").nth(2);
  await row.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.fastForward(180_000);
  await row.getByRole("button", { name: "終了", exact: true }).click();
  await page.getByRole("button", { name: "未完了のまま終了", exact: true }).click();
  await expect(page.locator(".todayRow--justCompleted, .todayAllCompletionReward"))
    .toHaveCount(0);
});

test("P72-05 completion save failure records no feedback", async ({ page }) => {
  await prepare(page, plannedFixture(0));
  await setSaveFailure(page, true);
  await finishPlannedToday(page);
  await expect(page.locator(".todayRow--justCompleted, .todayAllCompletionReward, .completionParticle"))
    .toHaveCount(0);
  expect((await currentConfig(page)).today.items[2].done).toBe(false);
});

test("P72-05 Do Now-only completion uses a separate snapshot echo", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].shortTimerMinutes = 1;
  fixture.config.today.items = [{ text: "別の項目", done: false, sourceKey: "manual:other" }];
  await prepare(page, fixture);
  await page.locator(".doNowStartPrimary").click();
  await page.clock.runFor(60_500);
  await page.getByRole("button", { name: "終わる" }).click();
  const echo = page.locator(".doNowCompletionEcho");
  await expect(echo).toContainText("一手進みました");
  await expect(echo).toContainText(fixture.config.projects[0].nextStep);
  await expect(page.locator(".todayRow--justCompleted, .todayAllCompletionReward"))
    .toHaveCount(0);
});

test("P72-05 a Do Now session linked to Today emits only the Today feedback", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].shortTimerMinutes = 1;
  fixture.config.today.items = [{
    text: fixture.config.projects[0].nextStep,
    done: false,
    sourceKey: `project:${fixture.config.projects[0].id}`,
    projectId: fixture.config.projects[0].id,
    shortTimerMinutes: 1,
    defaultTimerMinutes: 1,
  }];
  await prepare(page, fixture);
  await page.locator(".doNowStartPrimary").click();
  await page.clock.runFor(60_500);
  await page.getByRole("button", { name: "終わる" }).click();
  await expect(page.locator(".todayRow--justCompleted")).toHaveCount(1);
  await expect(page.locator(".doNowCompletionEcho, .todayAllCompletionReward"))
    .toHaveCount(0);
});

test("P72-05 reduced motion keeps labels and colors without animation", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture, true);
  await page.getByRole("checkbox", { name: "勝利条件を達成" }).check();
  const reward = page.locator(".victoryBar--reward");
  await expect(reward).toBeVisible();
  await expect(page.getByText("今日の勝利、達成", { exact: true })).toBeVisible();
  await expect(page.locator(".completionParticleLayer")).toBeHidden();
  expect(await reward.evaluate((node) => getComputedStyle(node).animationName)).toBe("none");
});

for (const width of [1440, 860]) {
  test(`P72-05 long completion feedback stays bounded and leaves controls usable at ${width}`, async ({
    page,
  }) => {
    const fixture = plannedFixture(0);
    fixture.config.today.items[2].text =
      "とても長い次の一手でも完了フィードバック中に本文とタイマー操作が押し合わず読みやすさと操作可能性を保つ";
    await page.setViewportSize({ width, height: 900 });
    await prepare(page, fixture);
    const row = await finishPlannedToday(page);
    await expect(row).toHaveClass(/todayRow--justCompleted/);
    await expect(row.locator(".todayRemoveButton")).toBeVisible();
    await expect(page.locator(".todayStartButton").first()).toBeVisible();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
  });
}
