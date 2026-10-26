import { expect, test, type Locator, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => { today: { items: Array<{ done: boolean }> } };
    updateConfig: (config: unknown) => void;
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

// ---- P9-04: Do Now and Today3 show one running state from the single activeTimer ----

const NEXT_STEP_TEXT = "資料を1ページ読む";

const doNowCard = (page: Page) => page.locator(".doNowContent");
const firstRow = (page: Page) => page.locator(".todayRow").first();

async function prepare(page: Page, fixture = createFullTodayFixture()) {
  fixture.config.projects[0].nextStep!.shortTimerMinutes = 1;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(doNowCard(page)).toContainText(NEXT_STEP_TEXT);
}

/** Both cards show the same state; "idle" means neither shows a running badge. */
async function expectBothCards(page: Page, state: "idle" | "running" | "paused") {
  const row = firstRow(page);
  if (state === "idle") {
    await expect(row).not.toHaveClass(/todayRow--running/);
    await expect(row.locator(".runningBadge")).toHaveCount(0);
    await expect(doNowCard(page).locator(".runningBadge")).toHaveCount(0);
    await expect(doNowCard(page).locator(".doNowStartPrimary")).toBeVisible();
    await expect(row.getByRole("button", { name: "短時間タイマー1分で開始" })).toBeVisible();
    await expect(doNowCard(page).locator(".doNowMetaTimer")).toContainText("通常");
    return;
  }
  const badge = state === "running" ? "実行中" : "一時停止";
  const pauseLabel = state === "running" ? "このセッションを一時停止" : "このセッションを再開";
  await expect(row).toHaveClass(/todayRow--running/);
  await expect(row.locator(".runningBadge")).toHaveText(badge);
  await expect(doNowCard(page).locator(".runningBadge")).toHaveText(badge);
  for (const card of [row, doNowCard(page)]) {
    await expect(card.getByRole("button", { name: pauseLabel })).toBeVisible();
    await expect(card.locator(".runningStopButton")).toBeVisible();
    await expect(card.locator(".todayStartButton, .doNowStartPrimary")).toHaveCount(0);
  }
  // The remaining time replaces "通常 N分" while the Timer runs.
  await expect(doNowCard(page).locator(".doNowMetaTimer")).toContainText("残り");
  await expect(doNowCard(page).locator(".doNowMetaTimer")).not.toContainText("通常");
}

async function expectNotRunning(card: Locator) {
  await expect(card.locator(".runningBadge")).toHaveCount(0);
}

test("P9-04 flow: started from Do Now, Today3 follows to completion", async ({ page }) => {
  await prepare(page);
  await expectBothCards(page, "idle");

  await doNowCard(page).locator(".doNowStartPrimary").click();
  await expectBothCards(page, "running");

  // Either card controls the same single Timer.
  await doNowCard(page).getByRole("button", { name: "このセッションを一時停止" }).click();
  await expectBothCards(page, "paused");
  await firstRow(page).getByRole("button", { name: "このセッションを再開" }).click();
  await expectBothCards(page, "running");

  await page.clock.runFor(60_500);
  const expired = page.getByRole("dialog", { name: "タイマー満了" });
  await expired.getByRole("button", { name: /続ける/ }).click();
  await expectBothCards(page, "running");

  await firstRow(page).locator(".runningStopButton").click();
  await expect(firstRow(page)).toHaveClass(/todayRow--complete/);
  await expect(page.locator(".doNowContent--hold")).toContainText("✓ 一手進みました");
  expect(await recordSessionCount(page)).toBe(1);
});

test("P9-04 flow: started from Today3, Do Now follows to completion", async ({ page }) => {
  await prepare(page);
  await expectBothCards(page, "idle");

  await firstRow(page).getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await expectBothCards(page, "running");

  await firstRow(page).getByRole("button", { name: "このセッションを一時停止" }).click();
  await expectBothCards(page, "paused");
  await doNowCard(page).getByRole("button", { name: "このセッションを再開" }).click();
  await expectBothCards(page, "running");

  await page.clock.runFor(60_500);
  await page
    .getByRole("dialog", { name: "タイマー満了" })
    .getByRole("button", { name: /続ける/ })
    .click();
  await expectBothCards(page, "running");

  await doNowCard(page).locator(".runningStopButton").click();
  await page
    .getByRole("dialog", { name: "今日の分は完了にしますか？" })
    .getByRole("button", { name: "今日の分は完了" })
    .click();
  await expect(firstRow(page)).toHaveClass(/todayRow--complete/);
  await expect(firstRow(page)).not.toHaveClass(/todayRow--running/);
  await expect(doNowCard(page).locator(".runningBadge")).toHaveCount(0);
  expect(await recordSessionCount(page)).toBe(1);
});

test("P9-04 Measure shows the elapsed time in Do Now", async ({ page }) => {
  await prepare(page);
  await doNowCard(page).locator(".doNowMeasureButton").click();
  await page.clock.runFor(65_000);
  await expect(doNowCard(page).locator(".doNowMetaTimer")).toContainText("経過 01:05");
  await expect(firstRow(page)).toHaveClass(/todayRow--running/);
});

// ---- the seven cases ----

test("P9-04 case 1: same Project and same generation sync (both directions)", async ({ page }) => {
  await prepare(page);
  await doNowCard(page).locator(".doNowStartPrimary").click();
  await expectBothCards(page, "running");
  await doNowCard(page).locator(".runningStopButton").click();
  await expectBothCards(page, "idle");
  await firstRow(page).getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await expectBothCards(page, "running");
});

test("P9-04 case 2: same Project with a different generation does not sync", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.config.today.items[0].sourceGenerationId = "gen-learning-old";
  await prepare(page, fixture);

  await doNowCard(page).locator(".doNowStartPrimary").click();
  await expect(doNowCard(page).locator(".runningBadge")).toHaveText("実行中");
  await expect(firstRow(page)).not.toHaveClass(/todayRow--running/);
  await expectNotRunning(firstRow(page));
  await expect(firstRow(page).getByRole("button", { name: "短時間タイマー1分で開始" })).toBeVisible();
  await doNowCard(page).locator(".runningStopButton").click();

  await firstRow(page).getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await expect(firstRow(page)).toHaveClass(/todayRow--running/);
  await expectNotRunning(doNowCard(page));
  await expect(doNowCard(page).locator(".doNowStartPrimary")).toBeVisible();
});

test("P9-04 case 3: swapping the Next Step while running never makes the new action run", async ({
  page,
}) => {
  await prepare(page);
  await firstRow(page).getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await expectBothCards(page, "running");

  // Source Lock: the running Project's Next Step cannot be swapped from the UI.
  const learningCard = page.locator(".nextStepCard").filter({ hasText: NEXT_STEP_TEXT }).first();
  await expect(learningCard.getByLabel("今日の3件で使用中のためロック中")).toBeVisible();
  await expect(learningCard.getByRole("button", { name: "変更" })).toHaveCount(0);

  // Even if the config changes underneath (e.g. an external edit), a new generation is not "running".
  await page.evaluate(() => {
    const qa = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = structuredClone(qa.currentConfig()) as {
      projects: Array<{ nextStep: { text: string; generationId?: string } }>;
    };
    config.projects[0].nextStep = {
      ...config.projects[0].nextStep,
      text: "別の行動に入れ替えた",
      generationId: "gen-learning-new",
    };
    qa.updateConfig(config);
  });
  await expect(doNowCard(page)).toContainText("別の行動に入れ替えた");
  await expectNotRunning(doNowCard(page));
  await expect(doNowCard(page).locator(".doNowStartPrimary")).toBeVisible();
  await expect(firstRow(page)).toHaveClass(/todayRow--running/);
  await expect(firstRow(page).locator(".runningBadge")).toHaveText("実行中");
});

test("P9-04 case 4: switching candidates with the other-step button never marks an unrelated candidate running", async ({
  page,
}) => {
  await prepare(page);
  await doNowCard(page).locator(".doNowStartPrimary").click();
  await expectBothCards(page, "running");

  await doNowCard(page).locator(".doNowAlternateButton").click();
  await expect(doNowCard(page)).not.toContainText(NEXT_STEP_TEXT);
  await expectNotRunning(doNowCard(page));
  await expect(doNowCard(page).locator(".doNowStartPrimary")).toBeVisible();
  // The Timer itself, and its Today3 item, keep running.
  await expect(firstRow(page)).toHaveClass(/todayRow--running/);
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
});

test("P9-04 case 5: a manually added Today item never syncs", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.config.today.items[1].done = false; // manual:fixture-cleanup
  await prepare(page, fixture);
  const manual = page.locator(".todayRow").nth(1);
  await manual.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await expect(manual).toHaveClass(/todayRow--running/);
  await expectNotRunning(doNowCard(page));
  await expect(doNowCard(page).locator(".doNowStartPrimary")).toBeVisible();
  await expect(firstRow(page)).not.toHaveClass(/todayRow--running/);
  await expectNotRunning(firstRow(page));
});

test("P9-04 case 6: legacy data without generation ids on both sides still syncs", async ({
  page,
}) => {
  const fixture = createFullTodayFixture();
  delete fixture.config.projects[0].nextStep!.generationId;
  delete fixture.config.today.items[0].sourceGenerationId;
  await prepare(page, fixture);
  await doNowCard(page).locator(".doNowStartPrimary").click();
  await expectBothCards(page, "running");
  await doNowCard(page).locator(".runningStopButton").click();
  await expectBothCards(page, "idle");
  await firstRow(page).getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await expectBothCards(page, "running");
});

for (const [name, projectGeneration, itemGeneration] of [
  ["only the Today item has a generation id", undefined, "gen-learning-1"],
  ["only the Next Step has a generation id", "gen-learning-1", undefined],
] as const) {
  test(`P9-04 case 7: ${name} does not sync`, async ({ page }) => {
    const fixture = createFullTodayFixture();
    const nextStep = fixture.config.projects[0].nextStep!;
    if (projectGeneration) nextStep.generationId = projectGeneration;
    else delete nextStep.generationId;
    if (itemGeneration) fixture.config.today.items[0].sourceGenerationId = itemGeneration;
    else delete fixture.config.today.items[0].sourceGenerationId;
    await prepare(page, fixture);

    await doNowCard(page).locator(".doNowStartPrimary").click();
    await expect(doNowCard(page).locator(".runningBadge")).toHaveText("実行中");
    await expectNotRunning(firstRow(page));
    await expect(firstRow(page)).not.toHaveClass(/todayRow--running/);
    await doNowCard(page).locator(".runningStopButton").click();

    await firstRow(page).getByRole("button", { name: "短時間タイマー1分で開始" }).click();
    await expect(firstRow(page)).toHaveClass(/todayRow--running/);
    await expectNotRunning(doNowCard(page));
  });
}
