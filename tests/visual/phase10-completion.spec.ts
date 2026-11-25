import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppConfig, LauncherNextStep } from "../../src/types";
import { pauseClock } from "./clock";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaControl = {
  currentConfig: () => AppConfig;
  setSaveConfigFailure: (failed: boolean) => void;
  updateConfig: (config: AppConfig) => void;
  invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
};

type QaWindow = Window & { __LIFE_LAUNCHER_VISUAL_QA__: QaControl };

async function prepare(page: Page, fixture: VisualQaFixture, expectedTodayCount = 1) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".todayRow")).toHaveCount(expectedTodayCount);
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    return control.currentConfig();
  });
}

async function saveConfigCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === "save_config",
      ).length,
  );
}

function snapshotCurrentNextStep(fixture: VisualQaFixture) {
  const project = fixture.config.projects[0];
  const nextStep = project.nextStep!;
  fixture.config.today.items = [
    {
      text: nextStep.text.trim(),
      done: false,
      sourceKey: `project:${project.id}`,
      ...(nextStep.generationId ? { sourceGenerationId: nextStep.generationId } : {}),
      projectId: project.id,
      ...(nextStep.trigger?.trim() ? { trigger: nextStep.trigger.trim() } : {}),
      ...(nextStep.buttonIds.length ? { buttonIds: [...nextStep.buttonIds] } : {}),
      ...(nextStep.instructionPath
        ? {
            instructionPath: nextStep.instructionPath,
            instructionOpenOnStart: nextStep.instructionOpenOnStart !== false,
          }
        : {}),
      defaultTimerMinutes:
        nextStep.defaultTimerMinutes ?? fixture.config.settings.defaultTimerMinutes,
      shortTimerMinutes: nextStep.shortTimerMinutes ?? fixture.config.settings.shortTimerMinutes,
    },
  ];
}

function completionFixture(options: { wishlist?: boolean; nextStep?: LauncherNextStep } = {}) {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  project.nextStep = options.nextStep ?? {
    text: "資料を1ページ読む",
    generationId: "gen-p10-09",
    buttonIds: [],
    defaultTimerMinutes: 25,
    shortTimerMinutes: 1,
  };
  snapshotCurrentNextStep(fixture);
  if (options.wishlist === false) {
    fixture.config.inbox = fixture.config.inbox.filter((item) => item.projectId !== project.id);
  }
  return fixture;
}

async function finishPlannedTimer(page: Page, shortTimerMinutes = 1) {
  await page
    .locator(".todayRow")
    .getByRole("button", { name: `短時間タイマー${shortTimerMinutes}分で開始` })
    .click();
  await page.clock.fastForward(shortTimerMinutes * 60_000 + 500);
  await page
    .getByRole("dialog", { name: "タイマー満了" })
    .getByRole("button", { name: "終わる" })
    .click();
}

async function openFollowup(page: Page, shortTimerMinutes = 1): Promise<Locator> {
  await finishPlannedTimer(page, shortTimerMinutes);
  await expect(page.locator(".todayRow")).toHaveClass(/todayRow--justCompleted/);
  await page.clock.fastForward(1_100);
  const followup = page.getByRole("dialog", { name: "一手進みました" });
  await expect(followup).toBeVisible();
  return followup;
}

async function setNextStepExternally(page: Page, projectId: string, text: string) {
  await page.evaluate(
    ({ projectId: id, text: value }) => {
      const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
      const config = control.currentConfig();
      const project = config.projects.find((item) => item.id === id);
      if (!project) throw new Error(`Project ${id} was not found`);
      project.nextStep = {
        text: value,
        generationId: "gen-external",
        buttonIds: [],
        defaultTimerMinutes: 25,
        shortTimerMinutes: 5,
      };
      control.updateConfig(config);
    },
    { projectId, text },
  );
  await page.clock.runFor(250);
  await expect(page.locator(`.nextStepRow[data-project-id="${projectId}"]`)).toContainText(text);
}

const actionInput = (dialog: Locator) => dialog.locator('input[aria-label="行動"]');
const shortTimerInput = (dialog: Locator) =>
  dialog.locator('input[aria-label="短時間タイマー分数"]');
const defaultTimerInput = (dialog: Locator) =>
  dialog.locator('input[aria-label="通常タイマー分数"]');

test("P10-09 asks where to start even when the Project has no Wishlist", async ({ page }) => {
  const fixture = completionFixture({ wishlist: false });
  await prepare(page, fixture);
  const followup = await openFollowup(page);

  await expect(followup).toContainText("一手進みました");
  await expect(followup).toContainText("次はどこから始めますか");
  await expect(followup).toContainText("資料を1ページ読む");
  await expect(followup).toContainText(/1分 ・ \d{2}:\d{2}–\d{2}:\d{2}/);
  await expect(followup.getByRole("radio")).toHaveCount(3);
  const repeat = followup.getByRole("radio", { name: /同じ一手をもう一度（資料を1ページ読む）/ });
  await expect(repeat).toBeVisible();
  await expect(repeat).toBeChecked();
  await expect(followup.getByRole("radio", { name: "自分で書く" })).toBeVisible();
  await expect(followup.getByRole("radio", { name: "今は決めない" })).toBeVisible();
  await expect(followup.locator("small", { hasText: "やりたいことから" })).toHaveCount(0);
  await expect(followup.getByRole("button", { name: "決定" })).toBeEnabled();
  await expect(followup.getByRole("button", { name: "閉じる" })).toBeVisible();
});

test("P10-09 決定 opens the promoting editor on the chosen Wishlist item", async ({ page }) => {
  const fixture = completionFixture();
  await prepare(page, fixture);
  const followup = await openFollowup(page);
  await expect(followup.getByRole("radio")).toHaveCount(4);

  await expect(followup.getByRole("radio", { name: "週末に試すアイデア" })).toBeChecked();
  await followup.getByRole("button", { name: "決定" }).click();
  await expect(followup).toHaveCount(0);

  const editor = page.getByRole("dialog", { name: "次の一手を設定" });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("tab", { name: /やりたいことから選ぶ/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(editor.locator(".nextStepWishlistCandidate")).toHaveCount(1);
  await expect(editor.getByRole("radio", { name: "週末に試すアイデア" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(editor.locator(".nextStepWishlistSelection")).toContainText("週末に試すアイデア");
  await expect(editor.locator(".nextStepWishlistSelection")).toContainText("選択済み");
});

test("P10-09 same step again prefills the 9 copied fields and saves a new generation", async ({
  page,
}) => {
  const fixture = completionFixture({
    nextStep: {
      text: "資料を1ページ読む",
      generationId: "gen-p10-09-before",
      trigger: "サンプル資料",
      buttonIds: ["sample-documents", "sample-gone"],
      defaultTimerMinutes: 25,
      shortTimerMinutes: 1,
      instructionPath: "C:\\PublicDemo\\Instructions\\guide.md",
      instructionOpenOnStart: true,
      startNoteTemplate: "開始メモ",
      expandTimerOnStart: true,
    },
  });
  await prepare(page, fixture);
  const followup = await openFollowup(page);

  await followup.getByRole("radio", { name: /同じ一手をもう一度/ }).check();
  await followup.getByRole("button", { name: "決定" }).click();
  await expect(followup).toHaveCount(0);

  const editor = page.getByRole("dialog", { name: "次の一手を設定" });
  await expect(editor).toBeVisible();
  await expect(editor.getByRole("tab", { name: /新しく入力/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(actionInput(editor)).toHaveValue("資料を1ページ読む");
  await expect(editor.getByLabel(/始めるきっかけ/)).toHaveValue("サンプル資料");
  await expect(editor.locator(".nextStepOpenChip", { hasText: "サンプル資料" })).toHaveCount(1);
  await expect(editor.locator(".nextStepOpenChip", { hasText: "登録が見つかりません" })).toHaveCount(
    0,
  );
  await expect(editor.locator(".nextStepOpenChip")).toHaveCount(2);
  await expect(editor.locator(".nextStepOpenChip", { hasText: "guide.md" })).toHaveCount(1);
  await expect(editor.getByRole("checkbox", { name: "開始時に手順書を開く" })).toBeChecked();
  await expect(shortTimerInput(editor)).toHaveValue("1");
  await expect(defaultTimerInput(editor)).toHaveValue("25");
  await expect(
    editor.getByRole("checkbox", { name: "開始時にタイマーを大きく表示" }),
  ).toBeChecked();
  await expect(editor.getByLabel(/開始noteテンプレート/)).toHaveValue("開始メモ");

  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editor).toHaveCount(0);
  const saved = (await currentConfig(page)).projects[0].nextStep!;
  expect(saved).toMatchObject({
    text: "資料を1ページ読む",
    trigger: "サンプル資料",
    buttonIds: ["sample-documents"],
    defaultTimerMinutes: 25,
    shortTimerMinutes: 1,
    instructionPath: "C:\\PublicDemo\\Instructions\\guide.md",
    instructionOpenOnStart: true,
    startNoteTemplate: "開始メモ",
    expandTimerOnStart: true,
  });
  expect(saved.generationId).toBeTruthy();
  expect(saved.generationId).not.toBe("gen-p10-09-before");
  expect(saved.reviewedAt).toBeUndefined();
  expect(saved.sourceWishlistId).toBeUndefined();
});

test("P10-09 自分で書く opens an empty Next Step editor", async ({ page }) => {
  const fixture = completionFixture();
  await prepare(page, fixture);
  const followup = await openFollowup(page);

  await followup.getByRole("radio", { name: "自分で書く" }).check();
  await followup.getByRole("button", { name: "決定" }).click();
  await expect(followup).toHaveCount(0);

  const editor = page.getByRole("dialog", { name: "次の一手を設定" });
  await expect(editor).toBeVisible();
  await expect(editor.locator(".nextStepWishlistSelection")).toHaveCount(0);
  await expect(editor.locator(".nextStepDecisionHint")).toHaveText("1件選択してください。");
  await expect(editor.getByRole("button", { name: "保存", exact: true })).toBeDisabled();

  await editor.getByRole("tab", { name: /新しく入力/ }).click();
  await expect(actionInput(editor)).toHaveValue("");
  await expect(editor.getByLabel(/始めるきっかけ/)).toHaveValue("");
  await expect(editor.locator(".nextStepOpenChip")).toHaveCount(0);
  await expect(shortTimerInput(editor)).toHaveValue("");
  await expect(defaultTimerInput(editor)).toHaveValue("");
  await expect(editor.getByRole("checkbox", { name: "開始時に手順書を開く" })).not.toBeChecked();
  await expect(
    editor.getByRole("checkbox", { name: "開始時にタイマーを大きく表示" }),
  ).not.toBeChecked();
  await expect(editor.getByLabel(/開始noteテンプレート/)).toHaveValue("");
  await expect(editor.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
});

test("P10-09 radio choices, 今は決めない and 閉じる never save", async ({ page }) => {
  const fixture = completionFixture();
  await prepare(page, fixture);
  const followup = await openFollowup(page);
  const before = await saveConfigCount(page);

  const wishlist = followup.getByRole("radio", { name: "週末に試すアイデア" });
  await expect(wishlist).toBeChecked();
  await wishlist.check();
  await expect(page.locator(".nextStepEditDialog")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "一手進みました" })).toBeVisible();
  await followup.getByRole("radio", { name: "自分で書く" }).check();
  await expect(followup.getByRole("radio", { name: "自分で書く" })).toBeChecked();
  await expect(page.locator(".nextStepEditDialog")).toHaveCount(0);
  await followup.getByRole("radio", { name: "今は決めない" }).check();
  await expect(followup.getByRole("radio", { name: "今は決めない" })).toBeChecked();

  await followup.getByRole("button", { name: "閉じる" }).click();
  await expect(followup).toHaveCount(0);
  await expect(page.locator(".nextStepEditDialog")).toHaveCount(0);
  expect(await saveConfigCount(page)).toBe(before);
  expect((await currentConfig(page)).projects[0].nextStep).toBeUndefined();
});

test("P10-09 Escape closes without saving", async ({ page }) => {
  const fixture = completionFixture();
  await prepare(page, fixture);
  const followup = await openFollowup(page);
  const before = await saveConfigCount(page);

  await page.keyboard.press("Escape");
  await expect(followup).toHaveCount(0);
  await expect(page.locator(".nextStepEditDialog")).toHaveCount(0);
  expect(await saveConfigCount(page)).toBe(before);
  expect((await currentConfig(page)).projects[0].nextStep).toBeUndefined();
});

test("P10-09 does not ask when the Next Step is set while the 1100ms wait runs", async ({
  page,
}) => {
  const fixture = completionFixture();
  await prepare(page, fixture);
  await pauseClock(page);
  await finishPlannedTimer(page);
  await expect(page.locator(".todayRow")).toHaveClass(/todayRow--justCompleted/);

  await setNextStepExternally(page, "sample-learning", "外から決めた次の一手");
  await page.clock.fastForward(1_100);
  await expect(page.getByRole("dialog", { name: "一手進みました" })).toHaveCount(0);
  expect((await currentConfig(page)).projects[0].nextStep?.text).toBe("外から決めた次の一手");
});

test("P10-09 決定 warns when the Next Step was set while the dialog is open", async ({
  page,
}) => {
  const fixture = completionFixture();
  await prepare(page, fixture);
  const followup = await openFollowup(page);

  await setNextStepExternally(page, "sample-learning", "外から決めた次の一手");
  await expect(followup).toBeVisible();
  await followup.getByRole("button", { name: "決定" }).click();
  await expect(followup).toHaveCount(0);
  await expect(
    page.locator(".toast", { hasText: "次の一手はもう決まっています" }),
  ).toBeVisible();
  await expect(page.locator(".nextStepEditDialog")).toHaveCount(0);
  expect((await currentConfig(page)).projects[0].nextStep?.text).toBe("外から決めた次の一手");
});

test("P10-09 a manually added Today card completion never opens the dialog", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [
    {
      text: "手で足した札",
      done: false,
      sourceKey: "manual:p10-09",
      shortTimerMinutes: 1,
      defaultTimerMinutes: 25,
    },
  ];
  await prepare(page, fixture);
  await finishPlannedTimer(page);
  await expect(page.locator(".todayRow")).toHaveClass(/todayRow--justCompleted/);

  await page.clock.fastForward(2_000);
  await expect(page.getByRole("dialog", { name: "一手進みました" })).toHaveCount(0);
  await expect(page.locator(".nextStepEditDialog")).toHaveCount(0);
  const saved = await currentConfig(page);
  expect(saved.today.items[0].done).toBe(true);
  expect(saved.projects[0].nextStep?.text).toBe("資料を1ページ読む");
});

test("P10-14 a chosen Wishlist item removed while open warns and keeps the dialog", async ({
  page,
}) => {
  const fixture = completionFixture();
  await prepare(page, fixture);
  const followup = await openFollowup(page);
  await expect(followup.getByRole("radio", { name: "週末に試すアイデア" })).toBeChecked();

  await page.evaluate(() => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    config.inbox = config.inbox.filter((item) => item.text !== "週末に試すアイデア");
    control.updateConfig(config);
  });
  await page.clock.fastForward(400);
  await expect(followup.getByRole("radio", { name: "週末に試すアイデア" })).toHaveCount(0);

  await followup.getByRole("button", { name: "決定" }).click();
  await expect(
    page.locator(".toast", { hasText: "選んだやりたいことが見つかりません" }),
  ).toBeVisible();
  await expect(page.getByRole("dialog", { name: "一手進みました" })).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "一手進みました" }).getByRole("radio", { name: /同じ一手をもう一度/ }),
  ).toBeChecked();
});

test("P10-14e 3 the completion follow-up shows the start and end time", async ({ page }) => {
  const fixture = completionFixture();
  await prepare(page, fixture);
  const followup = await openFollowup(page);
  await expect(followup.locator(".completionDoneMinutes")).toHaveText("1分 ・ 09:30–09:31");
});
