import { expect, test, type Page } from "@playwright/test";
import { completeTodayItemAndPrepareSource } from "../../src/completionFollowup";
import { earlyCompletionItem } from "../../src/earlyCompletion";
import { resnapshotSource } from "../../src/sourceEdit";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const PROJECT_KEY = "project:sample-learning";

function replacementFixture(sameText = false): VisualQaFixture {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  const oldText = "世代Aの一手";
  project.nextStep = {
    ...project.nextStep!,
    text: sameText ? oldText : "世代Bの一手",
    generationId: "gen-b",
    defaultTimerMinutes: 1,
    shortTimerMinutes: 1,
  };
  fixture.config.today.items = [
    {
      text: oldText,
      done: false,
      sourceKey: PROJECT_KEY,
      sourceGenerationId: "gen-a",
      projectId: project.id,
      defaultTimerMinutes: 1,
      shortTimerMinutes: 1,
    },
  ];
  fixture.doNowCandidates = [
    { projectId: project.id, reason: "manualOrder", restartEligible: false },
  ];
  return fixture;
}

async function prepare(page: Page, fixture: VisualQaFixture, expectedTodayCount = 1) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".todayRow")).toHaveCount(expectedTodayCount);
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    return control.currentConfig();
  });
}

async function finishExpiredTimer(page: Page) {
  await page.clock.runFor(60_500);
  await page
    .getByRole("dialog", { name: "タイマー満了" })
    .getByRole("button", { name: "終わる" })
    .click();
}

test("generation boundary: editing B does not resnapshot adopted A", () => {
  const previous = replacementFixture().config;
  const oldToday = structuredClone(previous.today.items[0]);
  const next = structuredClone(previous);
  next.projects[0].nextStep!.text = "編集後の世代B";

  const result = resnapshotSource(previous, next, PROJECT_KEY);

  expect(result.projects[0].nextStep?.text).toBe("編集後の世代B");
  expect(result.today.items[0]).toEqual(oldToday);
});

test("generation boundary: same-text A completion leaves B and history unchanged", () => {
  const config = replacementFixture(true).config;
  const result = completeTodayItemAndPrepareSource(
    config,
    PROJECT_KEY,
    "2026-08-13T10:00:00+09:00",
    "must-not-be-used",
  );

  expect(result.source).toMatchObject({ kind: "nextStep", isCurrentSnapshot: false });
  expect(result.config.today.items[0].done).toBe(true);
  expect(result.config.projects[0].nextStep).toEqual(config.projects[0].nextStep);
  expect(result.config.sourceCompletions).toEqual(config.sourceCompletions);
});

test("generation boundary: Do Now B cannot select A for early completion", () => {
  const config = replacementFixture().config;
  const project = config.projects[0];

  expect(
    earlyCompletionItem(
      config.today.items,
      {
        sourceId: project.id,
        sourceGenerationId: "gen-b",
        projectId: project.id,
        targetMinutes: 25,
      },
      300,
    ),
  ).toBeUndefined();
  expect(
    earlyCompletionItem(
      config.today.items,
      {
        sourceId: `today:${PROJECT_KEY}`,
        sourceGenerationId: "gen-a",
        projectId: project.id,
        targetMinutes: 25,
      },
      60,
    ),
  ).toBe(config.today.items[0]);
});

test("generation boundary: unmarked legacy source still completes and resnapshots", () => {
  const config = createPublicFixture().config;
  const project = config.projects[0];
  delete project.nextStep!.generationId;
  config.today.items = [
    {
      text: project.nextStep!.text,
      done: false,
      sourceKey: `project:${project.id}`,
      projectId: project.id,
    },
  ];
  const edited = structuredClone(config);
  edited.projects[0].nextStep!.text = "legacy edit";
  const resnapshotted = resnapshotSource(config, edited, PROJECT_KEY);
  expect(resnapshotted.today.items[0].text).toBe("legacy edit");
  expect(resnapshotted.today.items[0].sourceGenerationId).toBeUndefined();

  const completed = completeTodayItemAndPrepareSource(
    resnapshotted,
    PROJECT_KEY,
    "2026-08-13T10:00:00+09:00",
    "legacy-completion",
  );
  expect(completed.config.projects[0].nextStep).toBeUndefined();
  expect(completed.config.sourceCompletions.at(-1)?.id).toBe("legacy-completion");
});

test("generation boundary: adoption copies the marker and editing preserves it", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  project.nextStep!.generationId = "gen-a";
  fixture.config.today.items = [];
  await prepare(page, fixture, 0);

  await page.locator(".todayBuilderDisclosure").click();
  await page
    .locator(".todayBuilderRow", { hasText: project.nextStep!.text })
    .getByRole("button", { name: "今日へ", exact: true })
    .click();

  let saved = await currentConfig(page);
  expect(saved.today.items).toHaveLength(1);
  expect(saved.today.items[0]).toMatchObject({
    sourceKey: PROJECT_KEY,
    sourceGenerationId: "gen-a",
  });

  const action = page.locator('[data-project-id="sample-learning"] .nextStepActionRegion');
  await action.click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手を編集", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "次の一手を編集", exact: true });
  await editor.getByRole("textbox", { name: "行動", exact: true }).fill("編集した世代Aの一手");
  await editor.getByRole("button", { name: "保存", exact: true }).click();

  saved = await currentConfig(page);
  expect(saved.projects[0].nextStep).toMatchObject({
    text: "編集した世代Aの一手",
    generationId: "gen-a",
  });
  expect(saved.today.items[0]).toMatchObject({
    text: "編集した世代Aの一手",
    sourceGenerationId: "gen-a",
  });
});

test("generation boundary: clearing A and recreating same-text B leaves adopted A unchanged", async ({
  page,
}) => {
  const fixture = replacementFixture(true);
  fixture.config.projects[0].nextStep!.generationId = "gen-a";
  fixture.config.today.items[0].sourceGenerationId = "gen-a";
  const adoptedA = structuredClone(fixture.config.today.items[0]);
  await prepare(page, fixture);

  const action = page.locator('[data-project-id="sample-learning"] .nextStepActionRegion');
  await action.click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手を未設定にする", exact: true }).click();
  await page
    .getByRole("dialog", { name: "次の一手を未設定にしますか？", exact: true })
    .getByRole("button", { name: "削除して未設定にする", exact: true })
    .click();
  expect((await currentConfig(page)).today.items[0]).toEqual(adoptedA);

  await action.getByRole("button", { name: "次の一手を設定", exact: true }).click();
  const setup = page.getByRole("dialog", { name: "次の一手を設定", exact: true });
  await setup.getByRole("textbox", { name: "行動", exact: true }).fill(adoptedA.text);
  await setup.getByRole("button", { name: "保存", exact: true }).click();

  let saved = await currentConfig(page);
  const generationB = saved.projects[0].nextStep?.generationId;
  expect(generationB).toBeTruthy();
  expect(generationB).not.toBe("gen-a");
  expect(saved.today.items[0]).toEqual(adoptedA);

  await action.click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手を編集", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "次の一手を編集", exact: true });
  await editor.getByRole("textbox", { name: "行動", exact: true }).fill("編集した世代Bの一手");
  await editor.getByRole("button", { name: "保存", exact: true }).click();

  saved = await currentConfig(page);
  expect(saved.projects[0].nextStep).toMatchObject({
    text: "編集した世代Bの一手",
    generationId: generationB,
  });
  expect(saved.today.items[0]).toEqual(adoptedA);
});

test("generation boundary: Do Now B planned completion does not mark adopted A", async ({
  page,
}) => {
  await prepare(page, replacementFixture());
  await page.locator(".doNowStartSecondary").click();
  await finishExpiredTimer(page);

  const saved = await currentConfig(page);
  expect(saved.today.items[0].done).toBe(false);
  expect(saved.projects[0].nextStep).toMatchObject({ text: "世代Bの一手", generationId: "gen-b" });
  expect(saved.sourceCompletions).toEqual([]);
});

test("generation boundary: Do Now B early stop does not offer completion for A", async ({
  page,
}) => {
  const fixture = replacementFixture();
  fixture.config.projects[0].nextStep!.defaultTimerMinutes = 25;
  await prepare(page, fixture);
  await page.locator(".doNowStartSecondary").click();
  await page.clock.fastForward(60_000);
  await page.locator(".doNowBand").getByRole("button", { name: "終了", exact: true }).click();

  await expect(page.getByRole("dialog", { name: "今日の分は完了にしますか？" })).toHaveCount(0);
  expect((await currentConfig(page)).today.items[0].done).toBe(false);
});
