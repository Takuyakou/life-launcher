import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_OPTIONS = {
  maxDiffPixelRatio: 0.001,
  animations: "disabled",
  caret: "hide",
} as const;

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
    currentConfig: () => VisualQaFixture["config"];
    setSaveConfigFailure: (shouldFail: boolean) => void;
  };
};

function createStandaloneNextStepFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.projects = [
    {
      ...fixture.config.projects[0],
      nextStep: {
        ...fixture.config.projects[0].nextStep!,
        generationId: "gen-learning-1",
        shortTimerMinutes: 1,
        updatedAt: "2026-08-10T09:00:00+09:00",
        reviewedAt: "2026-08-10T09:00:00+09:00",
      },
    },
  ];
  fixture.doNowCandidates = [
    { projectId: fixture.config.projects[0].id, reason: "noToday", restartEligible: false },
  ];
  return fixture;
}

async function open(
  page: Page,
  fixture: VisualQaFixture,
  size = { width: 1080, height: 680 },
  freezeAnimations = false,
) {
  const now = new Date(FIXTURE_NOW).getTime();
  await page.setViewportSize(size);
  await page.clock.install({ time: now });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  if (freezeAnimations) {
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;cursor:none!important}",
    });
  }
}

async function startDoNowAndExpire(page: Page) {
  await page.locator(".doNowBand .doNowStartPrimary").click();
  await page.clock.fastForward(61_000);
  const dialog = page.getByRole("dialog", { name: "タイマー満了" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function commandCalls(page: Page, command: string) {
  return page.evaluate(
    (name) =>
      (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === name,
      ),
    command,
  );
}

test("P10-17 N3-5 1 & 2 saves resumeNote on completion without changing metadata and shows it in Do Now", async ({
  page,
}) => {
  await open(page, createStandaloneNextStepFixture());
  const dialog = await startDoNowAndExpire(page);
  const input = dialog.getByLabel("次はここから(任意)");
  await expect(input).toBeVisible();
  await input.fill("3章の途中から");
  await dialog.getByRole("button", { name: "終わる", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  const saveCalls = await commandCalls(page, "save_config");
  const recordCalls = await commandCalls(page, "record_session");
  expect(saveCalls).toHaveLength(1);
  expect(recordCalls).toHaveLength(1);

  const savedStep = await page.evaluate(
    () => (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().projects[0].nextStep,
  );
  expect(savedStep?.resumeNote).toBe("3章の途中から");
  expect(savedStep?.generationId).toBe("gen-learning-1");
  expect(savedStep?.updatedAt).toBe("2026-08-10T09:00:00+09:00");
  expect(savedStep?.reviewedAt).toBe("2026-08-10T09:00:00+09:00");

  // Dismiss the "一手進みました" hold card and show the candidate again so resumeNote renders.
  await page.getByRole("button", { name: "次の一手を見る" }).click();
  await page.getByRole("button", { name: "候補をもう一度見る" }).click();
  const resume = page.locator(".doNowResume");
  await expect(resume).toBeVisible();
  await expect(resume.locator(".doNowResumeLabel")).toHaveText("次はここから");
  await expect(resume.locator(".doNowResumeText")).toHaveText("3章の途中から");
  await expect(resume.locator(".doNowResumeLabel")).toHaveCSS("font-size", "12px");
  await expect(resume.locator(".doNowResumeLabel")).toHaveCSS("color", "rgb(163, 156, 142)");
  await expect(resume.locator(".doNowResumeText")).toHaveCSS("font-size", "14px");
  await expect(resume.locator(".doNowResumeText")).toHaveCSS("color", "rgb(232, 226, 214)");
});

test("P10-17 N3-5 3 finishing without typing skips save_config and still records the session", async ({
  page,
}) => {
  await open(page, createStandaloneNextStepFixture());
  const dialog = await startDoNowAndExpire(page);
  await expect(dialog.getByLabel("次はここから(任意)")).toHaveValue("");
  await dialog.getByRole("button", { name: "終わる", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await commandCalls(page, "save_config")).toHaveLength(0);
  expect(await commandCalls(page, "record_session")).toHaveLength(1);
});

test("P10-17 N3-5 4 Enter commits resumeNote while composing Enter does not finish", async ({
  page,
}) => {
  await open(page, createStandaloneNextStepFixture());
  const dialog = await startDoNowAndExpire(page);
  const input = dialog.getByLabel("次はここから(任意)");
  await input.fill("3章の途中から");
  await input.focus();

  // Composing Enter must be ignored.
  await input.evaluate((node) => {
    node.dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "Enter",
        bubbles: true,
        cancelable: true,
        isComposing: true,
      }),
    );
  });
  await expect(dialog).toBeVisible();
  expect(await commandCalls(page, "save_config")).toHaveLength(0);

  // Regular Enter submits and finishes.
  await input.press("Enter");
  await expect(dialog).toHaveCount(0);
  expect(await commandCalls(page, "save_config")).toHaveLength(1);
  expect(await commandCalls(page, "record_session")).toHaveLength(1);
  const savedStep = await page.evaluate(
    () => (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().projects[0].nextStep,
  );
  expect(savedStep?.resumeNote).toBe("3章の途中から");
});

test("P10-17 N3-5 5 Today3 Next Step card completion hides resume input and keeps followup flow", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].nextStep = {
    ...fixture.config.projects[0].nextStep!,
    generationId: "gen-today-1",
    shortTimerMinutes: 1,
  };
  fixture.config.today.items = [
    {
      ...fixture.config.today.items[0],
      done: false,
      projectId: fixture.config.projects[0].id,
      sourceKey: `project:${fixture.config.projects[0].id}`,
      sourceGenerationId: "gen-today-1",
      shortTimerMinutes: 1,
    },
  ];
  await open(page, fixture);
  await page.locator(".todayRow").first().getByRole("button", { name: "1分" }).click();
  await page.clock.fastForward(61_000);
  const dialog = page.getByRole("dialog", { name: "タイマー満了" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByLabel("次はここから(任意)")).toHaveCount(0);
  await dialog.getByRole("button", { name: "終わる", exact: true }).click();
  await page.clock.fastForward(1_100);
  const followup = page.getByRole("dialog", { name: "一手進みました" });
  await expect(followup).toBeVisible();
  await expect(followup).toContainText("次はどこから始めますか");
});

test("P10-17 N3-5 6 continuing (+15 min) does not save typed resumeNote", async ({ page }) => {
  await open(page, createStandaloneNextStepFixture());
  const dialog = await startDoNowAndExpire(page);
  await dialog.getByLabel("次はここから(任意)").fill("まだ続けるメモ");
  await dialog.getByRole("button", { name: "続ける(+15分)" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await commandCalls(page, "save_config")).toHaveLength(0);
  const savedStep = await page.evaluate(
    () => (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().projects[0].nextStep,
  );
  expect(savedStep?.resumeNote).toBeUndefined();
});

test("P10-17 N3-5 7 save failure shows one error toast and still records the session", async ({
  page,
}) => {
  await open(page, createStandaloneNextStepFixture());
  const dialog = await startDoNowAndExpire(page);
  await page.evaluate(() => {
    (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true);
  });
  await dialog.getByLabel("次はここから(任意)").fill("保存失敗テスト");
  await dialog.getByRole("button", { name: "終わる", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await commandCalls(page, "record_session")).toHaveLength(1);
  const errorToasts = page.locator(".toast--error");
  await expect(errorToasts).toHaveCount(1);
  await expect(errorToasts.first()).toContainText("次はここからを保存できませんでした");
});

test("P10-17 N3-5 8, 9 & 10 Next Step edit updates/clears resumeNote, maxLength is 80, and replacement/completion clears it", async ({
  page,
}) => {
  const fixture = createStandaloneNextStepFixture();
  fixture.config.projects[0].nextStep!.resumeNote = "最初のメモ";
  await open(page, fixture);

  // Edit existing Next Step: check maxLength, update, then clear.
  const row = page.locator(".projectGrid .nextStepCard").first();
  await row.hover();
  await row.getByRole("button", { name: "編集", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "次の一手を編集" });
  const input = editDialog.getByLabel("次はここから(任意)");
  await expect(input).toHaveValue("最初のメモ");
  await expect(input).toHaveAttribute("maxlength", "80");

  await input.fill("あ".repeat(90));
  expect((await input.inputValue()).length).toBe(80);

  await input.fill("4章の練習問題から");
  await editDialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editDialog).toHaveCount(0);
  await expect(page.locator(".doNowResumeText")).toHaveText("4章の練習問題から");

  // Clear resumeNote in edit.
  await row.hover();
  await row.getByRole("button", { name: "編集", exact: true }).click();
  await editDialog.getByLabel("次はここから(任意)").fill("");
  await editDialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editDialog).toHaveCount(0);
  await expect(page.locator(".doNowResume")).toHaveCount(0);
  let savedStep = await page.evaluate(
    () => (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().projects[0].nextStep,
  );
  expect(savedStep?.resumeNote).toBeUndefined();

  // Set again, then replace with another action (new generation) -> resumeNote is cleared.
  await row.hover();
  await row.getByRole("button", { name: "編集", exact: true }).click();
  await editDialog.getByLabel("次はここから(任意)").fill("入れ替え前メモ");
  await editDialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".doNowResumeText")).toHaveText("入れ替え前メモ");

  await row.locator(".sourceRowMenu").click();
  await page.getByRole("menuitem", { name: "別の行動に入れ替える" }).click();
  const replaceDialog = page.getByRole("dialog", { name: "次の一手を入れ替える" });
  await expect(replaceDialog.getByLabel("次はここから(任意)")).toHaveCount(0);
  await replaceDialog.locator('input[aria-label="行動"]').fill("新しい一手");
  await replaceDialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(replaceDialog).toHaveCount(0);
  savedStep = await page.evaluate(
    () => (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().projects[0].nextStep,
  );
  expect(savedStep?.resumeNote).toBeUndefined();
  expect(savedStep?.generationId).not.toBe("gen-learning-1");

  // Set again, then complete the Next Step -> resumeNote disappears with the completed step.
  await row.hover();
  await row.getByRole("button", { name: "編集", exact: true }).click();
  await editDialog.getByLabel("次はここから(任意)").fill("完了前メモ");
  await editDialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.locator(".doNowResumeText")).toHaveText("完了前メモ");

  // Clear Next Step (unsetting it removes resumeNote together with nextStep).
  await row.locator(".sourceRowMenu").click();
  await page.getByRole("menuitem", { name: "次の一手を未設定にする" }).click();
  await page.getByRole("button", { name: "削除して未設定にする" }).click();
  await expect(page.locator(".doNowResume")).toHaveCount(0);
  savedStep = await page.evaluate(
    () => (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().projects[0].nextStep,
  );
  expect(savedStep).toBeUndefined();
});

test("P10-18 O1 initial focus lands on Continue (+15 min) with or without resume input, Enter continues, and Shift+Tab moves to input", async ({
  page,
}) => {
  // With resume input (standalone Next Step).
  await open(page, createStandaloneNextStepFixture());
  const dialogWithInput = await startDoNowAndExpire(page);
  const continueButton = dialogWithInput.getByRole("button", { name: "続ける(+15分)" });
  const input = dialogWithInput.getByLabel("次はここから(任意)");
  await expect(continueButton).toBeFocused();

  // Shift+Tab moves focus to the resume input.
  await page.keyboard.press("Shift+Tab");
  await expect(input).toBeFocused();

  // Tab returns focus to Continue (+15 min), and pressing Enter extends the timer by +15 min.
  await page.keyboard.press("Tab");
  await expect(continueButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialogWithInput).toHaveCount(0);
  expect(await commandCalls(page, "save_config")).toHaveLength(0);
  expect(await commandCalls(page, "record_session")).toHaveLength(0);
  await expect(page.locator(".timerPanel .timerClock")).toHaveText(/^(14:5\d|15:00)$/);

  // Without resume input (Today3 Next Step card).
  const todayFixture = createPublicFixture();
  todayFixture.config.projects[0].nextStep = {
    ...todayFixture.config.projects[0].nextStep!,
    generationId: "gen-today-focus",
    shortTimerMinutes: 1,
  };
  todayFixture.config.today.items = [
    {
      ...todayFixture.config.today.items[0],
      done: false,
      projectId: todayFixture.config.projects[0].id,
      sourceKey: `project:${todayFixture.config.projects[0].id}`,
      sourceGenerationId: "gen-today-focus",
      shortTimerMinutes: 1,
    },
  ];
  await open(page, todayFixture);
  await page.locator(".todayRow").first().getByRole("button", { name: "1分" }).click();
  await page.clock.fastForward(61_000);
  const dialogWithoutInput = page.getByRole("dialog", { name: "タイマー満了" });
  await expect(dialogWithoutInput).toBeVisible();
  await expect(dialogWithoutInput.getByLabel("次はここから(任意)")).toHaveCount(0);
  await expect(dialogWithoutInput.getByRole("button", { name: "続ける(+15分)" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(dialogWithoutInput).toHaveCount(0);
  await expect(page.locator(".timerPanel .timerClock")).toHaveText(/^(14:5\d|15:00)$/);
});

test("P10-17 N3-5 11 baseline screenshots for timer-complete-resume and main-do-now-resume", async ({
  page,
}) => {
  const fixture = createStandaloneNextStepFixture();
  fixture.config.projects[0].nextStep!.resumeNote = "3章の途中から";
  await open(page, fixture, { width: 1080, height: 680 }, true);
  await expect(page.locator(".doNowResume")).toBeVisible();
  await expect(page).toHaveScreenshot("main-do-now-resume.png", SCREENSHOT_OPTIONS);

  const dialog = await startDoNowAndExpire(page);
  await expect(dialog.getByLabel("次はここから(任意)")).toHaveValue("3章の途中から");
  await expect(page).toHaveScreenshot("timer-complete-resume.png", SCREENSHOT_OPTIONS);
});
