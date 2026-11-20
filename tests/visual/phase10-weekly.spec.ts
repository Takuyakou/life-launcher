import { expect, test, type Page } from "@playwright/test";
import { IMPORT_PROMPT_FIRST, IMPORT_PROMPT_REPEAT, IMPORT_JSON_FORMAT } from "../../src/content/importPrompt";
import { formatDuration } from "../../src/weeklyPlanning";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { waitForStableRects } from "./helpers";
import { installTauriMock } from "./tauriMock";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => VisualQaFixture["config"];
    invokeCalls: Array<{ command: string; args?: unknown }>;
    updateConfig: (config: VisualQaFixture["config"]) => void;
  };
  __copiedText?: string;
};

async function openWeekly(
  page: Page,
  fixture: VisualQaFixture,
  viewport = { width: 1280, height: 980 },
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  await expect(page.locator(".recordsView")).toBeVisible();
  await page.getByRole("tab", { name: "今週を決める" }).click();
  await expect(page.locator(".weeklyPlanning")).toBeVisible();
}

function weeklyFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.weeklyReview = {
    weekKey: "2026-W33",
    previousWeekStart: "2026-08-03",
    previousWeekEnd: "2026-08-09",
    totalMinutes: 250,
    activeDays: 3,
    projects: [
      { projectId: "sample-learning", label: "サンプル学習", sessionCount: 2, totalMinutes: 150 },
      { projectId: "sample-stretch", label: "ストレッチ", sessionCount: 3, totalMinutes: 100 },
    ],
  };
  fixture.config.sourceCompletions = [
    {
      id: "done-1",
      sourceType: "nextStep",
      sourceIdentity: "project:sample-learning:1",
      textSnapshot: "資料を1ページ読む",
      projectId: "sample-learning",
      completedAt: "2026-08-04T10:00:00+09:00",
    },
    {
      id: "done-2",
      sourceType: "wishlist",
      sourceIdentity: "wishlist:sample-weekend",
      textSnapshot: "週末に試すアイデア",
      projectId: "sample-learning",
      completedAt: "2026-08-06T10:00:00+09:00",
    },
    {
      id: "done-3",
      sourceType: "nextStep",
      sourceIdentity: "project:sample-stretch:1",
      textSnapshot: "5分だけ体を動かす",
      projectId: "sample-stretch",
      completedAt: "2026-08-08T10:00:00+09:00",
    },
    {
      id: "done-other",
      sourceType: "wishlist",
      sourceIdentity: "wishlist:other",
      textSnapshot: "別の週の完了",
      completedAt: "2026-07-20T10:00:00+09:00",
    },
  ];
  fixture.config.projects = fixture.config.projects.map((project, index) => ({
    ...project,
    weeklyFocus: index < 2,
  }));
  fixture.config.projects.push(
    {
      id: "weekly-extra-1",
      name: "追加プロジェクト1",
      colorId: "amber",
      weeklyFocus: false,
    },
    {
      id: "weekly-extra-2",
      name: "追加プロジェクト2",
      colorId: "cyan",
      weeklyFocus: false,
    },
  );
  const stale = fixture.config.projects.find((project) => project.id === "sample-stretch")!;
  stale.nextStep = {
    ...stale.nextStep!,
    reviewedAt: "2026-07-20T10:00:00+09:00",
    updatedAt: "2026-07-20T10:00:00+09:00",
  };
  fixture.staleProjectIds = ["sample-stretch"];
  return fixture;
}

test("P10-15 1 the weekly tab has the facts, focus and stale cards", async ({ page }) => {
  await openWeekly(page, weeklyFixture());
  await expect(page.getByRole("heading", { name: "今週を決める" })).toBeVisible();
  await expect(page.locator(".weeklyPlanningKicker").first()).toHaveText(
    "先週の事実 ― 8月3日〜9日",
  );
  await expect(page.locator(".weeklyPlanningStats strong").nth(0)).toHaveText("4時間10分");
  await expect(page.locator(".weeklyPlanningStats strong").nth(1)).toHaveText("3日");
  await expect(page.locator(".weeklyPlanningStats strong").nth(2)).toHaveText("5回");
  const rows = page.locator(".weeklyPlanningProjectRow");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toContainText("サンプル学習");
  await expect(rows.nth(0)).toContainText("2回");
  await expect(rows.nth(0)).toContainText("2時間30分");
  await expect(rows.nth(1)).toContainText("ストレッチ");
  await expect(page.locator(".weeklyPlanningCompleted .weeklyPlanningKicker")).toHaveText(
    "完了にした項目 3件",
  );
  await expect(page.locator(".weeklyPlanningCompleted li")).toHaveCount(3);
  await expect(page.locator(".weeklyPlanningCompleted")).not.toContainText("別の週の完了");
  await expect(page.locator(".weeklyPlanningFocusHead span")).toHaveText("2 / 3");
  await expect(page.locator(".weeklyPlanningStaleRow")).toContainText(
    "「5分だけ体を動かす」のまま",
  );
});

test("P10-15 2 the weekly typography and controls follow the values", async ({ page }) => {
  await openWeekly(page, weeklyFixture());
  await expect(page.locator(".weeklyPlanningTitle")).toHaveCSS("font-size", "26px");
  await expect(page.locator(".weeklyPlanningTitle")).toHaveCSS("font-weight", "700");
  const statNumber = page.locator(".weeklyPlanningStats strong > span").first();
  await expect(statNumber).toHaveCSS("font-size", "24px");
  await expect(statNumber).toHaveCSS("font-weight", "700");
  await expect(statNumber).toHaveCSS("color", "rgb(244, 240, 232)");
  await expect(page.locator(".weeklyPlanningStats > div > span").first()).toHaveCSS(
    "font-size",
    "12px",
  );
  expect(Math.round((await page.locator(".weeklyPlanningProjectRow").first().boundingBox())!.height)).toBeGreaterThanOrEqual(48);
  const selected = page.locator('.weeklyPlanningFocusButton[aria-pressed="true"]').first();
  await expect(selected).toHaveCSS("border-top-color", "rgb(255, 206, 91)");
  expect(Math.round((await selected.boundingBox())!.height)).toBe(44);
  await expect(page.locator(".weeklyPlanningAi")).toHaveCSS("background-color", "rgb(33, 31, 26)");
  await expect(page.locator(".weeklyPlanningAi")).toHaveCSS("border-radius", "14px");
});

test("P10-15 3 the focus buttons save, update the count and stop at three", async ({ page }) => {
  await openWeekly(page, weeklyFixture());
  const count = page.locator(".weeklyPlanningFocusHead span");
  await expect(count).toHaveText("2 / 3");
  const off = page.locator('.weeklyPlanningFocusButton[aria-pressed="false"]').first();
  const name = (await off.textContent())!.trim();
  await off.click();
  await expect(page.locator(".weeklyPlanningFocusHead span")).toHaveText("3 / 3");
  await expect(page.locator(".weeklyPlanningFocusButton", { hasText: name }).first()).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const fourth = page.locator('.weeklyPlanningFocusButton[aria-pressed="false"]').first();
  await fourth.click();
  await expect(page.locator(".toast").last()).toContainText("今週の重点は最大3件まで選べます");
  await expect(page.locator(".weeklyPlanningFocusHead span")).toHaveText("3 / 3");
});

test("P10-15 4 stale actions open the editor and mark reviewed", async ({ page }) => {
  await openWeekly(page, weeklyFixture());
  await page.locator(".weeklyPlanningStaleRow").getByRole("button", { name: "小さくする" }).click();
  await expect(page.getByRole("dialog", { name: "次の一手を編集" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".weeklyPlanningStaleRow").getByRole("button", { name: "このまま" }).click();
  await expect
    .poll(async () =>
      page.evaluate(() => {
        const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
        return control
          .currentConfig()
          .projects.find((project) => project.id === "sample-stretch")?.nextStep?.reviewedAt;
      }),
    )
    .not.toBe("2026-07-20T10:00:00+09:00");
  await expect(page.getByRole("button", { name: "短時間で試す" })).toHaveCount(0);
});

test("P10-15 5 the copied prompt has the format, facts and current state", async ({ page }) => {
  await openWeekly(page, weeklyFixture());
  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as QaWindow).__copiedText = text;
        },
      },
    });
  });
  await page.getByRole("button", { name: "先週の事実を付けてコピー" }).click();
  await expect(page.getByRole("button", { name: /コピーしました/ })).toBeVisible();
  const copied = await page.evaluate(() => (window as QaWindow).__copiedText ?? "");
  expect(copied).toContain('"lifeLauncherImport": 1');
  expect(copied).toContain("合計: 4時間10分 / 動いた日: 3日 / 始めた回数: 5回");
  expect(copied).toContain("完了にした項目: 資料を1ページ読む / 週末に試すアイデア / 5分だけ体を動かす");
  expect(copied).toContain("今週の重点: サンプル学習、ストレッチ");
  expect(copied).toContain("しばらく動いていないもの: ストレッチ");
  expect(copied).toContain("先週の事実(8月3日〜9日)");
  expect(copied).toContain("今のアプリの内容:");
  expect(copied).not.toContain("{IMPORT_JSON_FORMAT}");
  expect(copied).not.toContain("{WEEKLY_FACTS}");
});

test("P10-15 6 import and done move to the next screens", async ({ page }) => {
  await openWeekly(page, weeklyFixture());
  await page.getByRole("button", { name: "貼り付けて、足す内容を確かめる" }).click();
  await expect(page.getByRole("dialog").filter({ hasText: "まとめて取り込む" })).toBeVisible();
  await page.getByRole("button", { name: "まとめて取り込むを閉じる" }).click();
  await page.getByRole("button", { name: "この重点で決定" }).click();
  await expect(page.locator(".doNowBand")).toBeVisible();
});

test("P10-15 7 formats the range and duration from the fixture", async ({ page }) => {
  for (const [minutes, label] of [
    [0, "0分"],
    [55, "55分"],
    [120, "2時間"],
    [125, "2時間5分"],
    [250, "4時間10分"],
  ] as const) {
    expect(formatDuration(minutes)).toBe(label);
  }
  const fixture = weeklyFixture();
  fixture.weeklyReview = {
    ...fixture.weeklyReview,
    previousWeekStart: "2026-12-28",
    previousWeekEnd: "2027-01-03",
    totalMinutes: 55,
  };
  await openWeekly(page, fixture);
  await expect(page.locator(".weeklyPlanningKicker").first()).toHaveText(
    "先週の事実 ― 2026年12月28日〜2027年1月3日",
  );
  await expect(page.locator(".weeklyPlanningStats strong").first()).toHaveText("55分");

  await page.evaluate(() => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    config.sourceCompletions = [
      {
        id: "boundary-in",
        sourceType: "nextStep",
        sourceIdentity: "project:sample-learning:boundary",
        textSnapshot: "境界の内側",
        completedAt: "2027-01-04T03:30:00+09:00",
      },
      {
        id: "boundary-out-end",
        sourceType: "nextStep",
        sourceIdentity: "project:sample-learning:boundary2",
        textSnapshot: "境界の外側",
        completedAt: "2027-01-04T04:30:00+09:00",
      },
      {
        id: "boundary-out-start",
        sourceType: "nextStep",
        sourceIdentity: "project:sample-learning:boundary3",
        textSnapshot: "最初の日の外側",
        completedAt: "2026-12-28T03:30:00+09:00",
      },
    ];
    config.settings.dayStartHour = 4;
    control.updateConfig(config);
  });
  await expect(page.locator(".weeklyPlanningCompleted .weeklyPlanningKicker")).toHaveText(
    "完了にした項目 1件",
  );
  await expect(page.locator(".weeklyPlanningCompleted")).toContainText("境界の内側");
  await expect(page.locator(".weeklyPlanningCompleted")).not.toContainText("境界の外側");
  await expect(page.locator(".weeklyPlanningCompleted")).not.toContainText("最初の日の外側");
});

test("P10-15 8 empty words are shown", async ({ page }) => {
  const fixture = weeklyFixture();
  fixture.weeklyReview = {
    ...fixture.weeklyReview,
    totalMinutes: 0,
    activeDays: 0,
    projects: [],
  };
  fixture.config.sourceCompletions = [];
  fixture.config.projects = fixture.config.projects.map((project) => ({
    ...project,
    weeklyFocus: false,
  }));
  fixture.staleProjectIds = [];
  await openWeekly(page, fixture);
  await expect(page.locator(".weeklyPlanningStats strong").nth(0)).toHaveText("0分");
  await expect(page.locator(".weeklyPlanningStats strong").nth(1)).toHaveText("0日");
  await expect(page.locator(".weeklyPlanningStats strong").nth(2)).toHaveText("0回");
  await expect(page.getByText("先週の実行記録はありません。")).toBeVisible();
  await expect(page.locator(".weeklyPlanningCompleted .weeklyPlanningKicker")).toHaveText(
    "完了にした項目 0件",
  );
  await expect(page.getByText("先週、完了にした項目はありません。")).toBeVisible();
  await expect(page.locator(".weeklyPlanningFocusHead span")).toHaveText("0 / 3");
  await expect(page.locator(".weeklyPlanningStale")).toHaveCount(0);
});

test("P10-15 9 narrow windows stack the columns without sideways scroll", async ({ page }) => {
  for (const size of ["standard", "large", "xlarge"] as const) {
    const fixture = weeklyFixture();
    fixture.config.settings.mainDisplaySize = size;
    await openWeekly(page, fixture, { width: 860, height: 560 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
      true,
    );
    const facts = (await page.locator(".weeklyPlanningFacts").boundingBox())!;
    const plan = (await page.locator(".weeklyPlanningPlan").boundingBox())!;
    expect(Math.abs(facts.x - plan.x)).toBeLessThanOrEqual(1);
    expect(plan.y).toBeGreaterThanOrEqual(facts.y + facts.height - 1);
  }
});

test("P10-15b H2 the stale buttons use the main-screen button colours", async ({ page }) => {
  const fixture = weeklyFixture();
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  const mainButton = page.locator(".nextStepFreshnessButton").first();
  await expect(mainButton).toBeVisible();
  // The bundled font swaps in after first paint and moves the freshness button sideways.
  // Settle the font and the layout before the pointer is moved, or the button can slide out
  // from under the already-positioned pointer and never enter its hover state.
  await page.evaluate(async () => document.fonts.ready);
  await waitForStableRects(page, [".nextStepFreshnessButton"]);
  const read = (locator: typeof mainButton) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        borderTopColor: style.borderTopColor,
        borderRadius: style.borderRadius,
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        height: Math.round(element.getBoundingClientRect().height),
      };
    });
  const mainStyle = await read(mainButton);
  await mainButton.hover();
  await expect(mainButton).toHaveCSS("color", "rgb(255, 206, 91)");
  const mainHover = (await mainButton.evaluate((element) => getComputedStyle(element).color)) ?? "";
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  await page.getByRole("tab", { name: "今週を決める" }).click();
  const weeklyButtons = page.locator(".weeklyPlanningStaleActions .nextStepFreshnessButton");
  await expect(weeklyButtons).toHaveCount(2);
  for (let index = 0; index < 2; index += 1) {
    const weekly = weeklyButtons.nth(index);
    expect(await read(weekly)).toEqual(mainStyle);
    await weekly.hover();
    await expect(weekly).toHaveCSS("color", mainHover);
  }
  await weeklyButtons.first().hover();
  await expect(weeklyButtons.first()).toHaveCSS("color", "rgb(255, 206, 91)");
});

test("P10-15 10 the repeated import prompt contains the JSON format", () => {
  expect(IMPORT_PROMPT_REPEAT).toContain(IMPORT_JSON_FORMAT);
  expect(IMPORT_PROMPT_REPEAT).toContain('"lifeLauncherImport": 1');
  expect(IMPORT_PROMPT_REPEAT).not.toContain("はじめて用と同じ");
  expect(IMPORT_PROMPT_FIRST).toContain(IMPORT_JSON_FORMAT);
  expect(IMPORT_PROMPT_FIRST).not.toContain("(はじめて用と同じ");
  expect(IMPORT_PROMPT_FIRST.startsWith("あなたは、私が「今これをやる」を決めて始めるのを手伝うアシスタントです。")).toBe(true);
  expect(IMPORT_PROMPT_FIRST).toContain("私の状況:");
});
