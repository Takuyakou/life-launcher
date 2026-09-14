import { expect, test, type Page } from "@playwright/test";
import {
  completeTodayItemAndPrepareSource,
  completeWishlistAfterToday,
  resolveTodayCompletionSource,
} from "../../src/completionFollowup";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepareUi(page: Page, fixture: VisualQaFixture, expectedTodayCount = 1) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
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

async function setSaveFailure(page: Page, failed: boolean) {
  await page.evaluate((value) => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { setSaveConfigFailure: (failed: boolean) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    control.setSaveConfigFailure(value);
  }, failed);
}

async function finishPlannedTimer(page: Page) {
  await page.locator(".todayRow").getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await page.clock.runFor(60_500);
  await page
    .getByRole("dialog", { name: "タイマー満了" })
    .getByRole("button", { name: "終わる" })
    .click();
}

function snapshotCurrentNextStep(fixture: VisualQaFixture, todayIndex = 0) {
  const project = fixture.config.projects[0];
  const nextStep = project.nextStep!;
  const existing = fixture.config.today.items[todayIndex];
  fixture.config.today.items[todayIndex] = {
    text: nextStep.text.trim(),
    done: existing.done,
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
  };
}

function nextStepUiFixture(withSameProjectWishlist = true) {
  const fixture = createPublicFixture();
  fixture.config.projects[0].nextStep!.shortTimerMinutes = 1;
  fixture.config.today.items = [{ ...fixture.config.today.items[0] }];
  snapshotCurrentNextStep(fixture);
  if (!withSameProjectWishlist) {
    fixture.config.inbox = fixture.config.inbox.filter(
      (item) => item.projectId !== "sample-learning",
    );
  }
  return fixture;
}

function wishlistUiFixture() {
  const fixture = createPublicFixture();
  const item = fixture.config.inbox.find((entry) => entry.id === "sample-weekend")!;
  fixture.config.today.items = [
    {
      text: item.text,
      done: false,
      sourceKey: `wishlist:${item.id}`,
      projectId: item.projectId,
      shortTimerMinutes: 1,
      defaultTimerMinutes: 25,
    },
  ];
  return fixture;
}

test("Phase 8.1 NextStep Today completion keeps snapshot and project but clears current step", () => {
  const fixture = createPublicFixture();
  snapshotCurrentNextStep(fixture);
  const before = fixture.config;
  const today = before.today.items[0];
  const result = completeTodayItemAndPrepareSource(
    before,
    today.sourceKey!,
    "2026-08-13T10:00:00+09:00",
    "completion-next-step",
  );

  expect(result.source).toMatchObject({
    kind: "nextStep",
    projectId: "sample-learning",
    sourceKey: "project:sample-learning",
  });
  expect(result.config.today.items[0]).toEqual({ ...today, done: true });
  expect(result.config.projects[0].nextStep).toBeUndefined();
  expect(result.config.projects[0].name).toBe(before.projects[0].name);
  expect(result.config.inbox).toEqual(before.inbox);
  expect(result.config.sourceCompletions.at(-1)).toMatchObject({
    id: "completion-next-step",
    sourceType: "nextStep",
    sourceIdentity: "project:sample-learning",
    textSnapshot: today.text,
  });
});

test("Phase 8.1 Wishlist Today completion waits for explicit source decision", () => {
  const before = createPublicFixture().config;
  const wishlist = before.inbox[1];
  before.today.items = [
    {
      text: wishlist.text,
      done: false,
      sourceKey: `wishlist:${wishlist.id}`,
      projectId: wishlist.projectId,
    },
  ];
  const source = resolveTodayCompletionSource(before, before.today.items[0]);
  expect(source).toMatchObject({ kind: "wishlist", itemId: wishlist.id });

  const prepared = completeTodayItemAndPrepareSource(
    before,
    before.today.items[0].sourceKey!,
    "2026-08-13T10:00:00+09:00",
    "unused-until-choice",
  );
  expect(prepared.config.today.items[0].done).toBe(true);
  expect(prepared.config.inbox).toEqual(before.inbox);
  expect(prepared.config.sourceCompletions).toEqual(before.sourceCompletions);

  if (!prepared.source || prepared.source.kind !== "wishlist") {
    throw new Error("Wishlist source was not resolved");
  }
  const completed = completeWishlistAfterToday(
    prepared.config,
    prepared.source,
    before.today.items[0].text,
    "2026-08-13T10:01:00+09:00",
    "completion-wishlist",
  );
  expect(completed?.inbox.some((item) => item.id === wishlist.id)).toBe(false);
  expect(completed?.today.items[0].done).toBe(true);
  expect(completed?.sourceCompletions.at(-1)).toMatchObject({
    id: "completion-wishlist",
    sourceType: "wishlist",
    sourceIdentity: `wishlist:${wishlist.id}`,
  });
});

test("Phase 8.1 completion uses stable identity and is idempotent for done cards", () => {
  const before = createPublicFixture().config;
  before.inbox = [
    { id: "same-a", text: "同じ文面" },
    { id: "same-b", text: "同じ文面" },
  ];
  before.today.items = [{ text: "同じ文面", done: false, sourceKey: "wishlist:same-b" }];
  const first = completeTodayItemAndPrepareSource(
    before,
    "wishlist:same-b",
    "2026-08-13T10:00:00+09:00",
    "first",
  );
  expect(first.source).toMatchObject({ kind: "wishlist", itemId: "same-b" });
  const second = completeTodayItemAndPrepareSource(
    first.config,
    "wishlist:same-b",
    "2026-08-13T10:01:00+09:00",
    "second",
  );
  expect(second.config).toBe(first.config);
  expect(second.source).toBeNull();
});

test("Phase 8.1 old Today snapshot never clears its replacement NextStep", () => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].nextStep!.generationId = "gen-a";
  snapshotCurrentNextStep(fixture);
  const before = fixture.config;
  const today = before.today.items[0];
  before.projects[0].nextStep = {
    ...before.projects[0].nextStep!,
    text: "差し替え後の次の一手",
    generationId: "gen-b",
  };

  const result = completeTodayItemAndPrepareSource(
    before,
    today.sourceKey!,
    "2026-08-13T10:00:00+09:00",
    "old-snapshot",
  );

  expect(result.source).toMatchObject({ kind: "nextStep", isCurrentSnapshot: false });
  expect(result.config.today.items[0]).toEqual({ ...today, done: true });
  expect(result.config.projects[0].nextStep?.text).toBe("差し替え後の次の一手");
  expect(result.config.sourceCompletions).toEqual(before.sourceCompletions);
});

test("Phase 8.1 NextStep snapshot guard allows legacy fields and execution-setting edits", () => {
  const fixture = createPublicFixture();
  const today = fixture.config.today.items[0];
  expect(resolveTodayCompletionSource(fixture.config, fixture.config.today.items[0])).toMatchObject(
    {
      kind: "nextStep",
      isCurrentSnapshot: true,
    },
  );

  const changedSettings = structuredClone(fixture.config);
  changedSettings.projects[0].nextStep = {
    ...changedSettings.projects[0].nextStep!,
    trigger: "別のきっかけ",
    buttonIds: ["sample-browser"],
    instructionPath: "C:\\PublicDemo\\other.md",
    instructionOpenOnStart: true,
    defaultTimerMinutes: 36,
    shortTimerMinutes: 7,
  };
  expect(resolveTodayCompletionSource(changedSettings, today)).toMatchObject({
    kind: "nextStep",
    isCurrentSnapshot: true,
  });

  const legacyWithoutProjectId = { ...today, projectId: undefined };
  expect(resolveTodayCompletionSource(fixture.config, legacyWithoutProjectId)).toMatchObject({
    kind: "nextStep",
    isCurrentSnapshot: true,
  });

  const wrongProject = { ...today, projectId: "sample-stretch" };
  expect(resolveTodayCompletionSource(fixture.config, wrongProject)).toMatchObject({
    kind: "nextStep",
    isCurrentSnapshot: false,
  });
});

test("Phase 8.1 old Today A and current NextStep B stay separate in the real UI", async ({
  page,
}) => {
  const fixture = nextStepUiFixture();
  fixture.config.projects[0].nextStep!.generationId = "gen-a";
  snapshotCurrentNextStep(fixture);
  fixture.config.projects[0].nextStep!.text = "差し替え後の次の一手";
  fixture.config.projects[0].nextStep!.generationId = "gen-b";
  await prepareUi(page, fixture);
  await finishPlannedTimer(page);
  await page.clock.fastForward(2_000);

  const saved = await currentConfig(page);
  expect(saved.today.items[0].done).toBe(true);
  expect(saved.projects[0].nextStep?.text).toBe("差し替え後の次の一手");
  expect(saved.sourceCompletions).toEqual([]);
  await expect(page.getByRole("dialog", { name: "次の一手を決めますか？" })).toHaveCount(0);
});

test("Phase 8.1 direct Wishlist timer completion cannot select same-project NextStep", async ({
  page,
}) => {
  const fixture = wishlistUiFixture();
  fixture.config.today.items.unshift({
    ...createPublicFixture().config.today.items[0],
    shortTimerMinutes: 1,
  });
  await prepareUi(page, fixture, 2);
  const wishlistCard = page.locator(".todayRow").nth(1);
  await wishlistCard.getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await page.clock.runFor(60_500);
  await page
    .getByRole("dialog", { name: "タイマー満了" })
    .getByRole("button", { name: "終わる" })
    .click();

  const saved = await currentConfig(page);
  expect(saved.today.items[0].done).toBe(false);
  expect(saved.today.items[1].done).toBe(true);
  expect(saved.projects[0].nextStep?.text).toBeTruthy();
});

test("Phase 8.1 shows reward before NextStep follow-up and does not replay after reload", async ({
  page,
}) => {
  await prepareUi(page, nextStepUiFixture());
  await finishPlannedTimer(page);
  await expect(page.locator(".todayRow")).toHaveClass(/todayRow--justCompleted/);
  await expect(page.getByRole("dialog", { name: "次の一手を決めますか？" })).toHaveCount(0);

  await page.clock.fastForward(1_100);
  const followup = page.getByRole("dialog", { name: "次の一手を決めますか？" });
  await expect(followup).toBeVisible();
  await expect(followup).toContainText("サンプル学習のやりたいこと");
  await followup.getByRole("button", { name: "今は決めない" }).click();
  expect((await currentConfig(page)).projects[0].nextStep).toBeUndefined();

  await page.reload();
  await page.clock.fastForward(2_000);
  expect((await currentConfig(page)).today.items[0].done).toBe(true);
  await expect(page.locator(".todayRow")).not.toHaveClass(/todayRow--justCompleted/);
  await expect(page.getByRole("dialog", { name: "次の一手を決めますか？" })).toHaveCount(0);
});

test("Phase 8.1 Wishlist follow-up can keep the source", async ({ page }) => {
  await prepareUi(page, wishlistUiFixture());
  await finishPlannedTimer(page);
  await expect(page.locator(".todayRow")).toHaveClass(/todayRow--justCompleted/);
  await expect(
    page.getByRole("dialog", { name: "この「やりたいこと」はどうしますか？" }),
  ).toHaveCount(0);

  await page.clock.fastForward(1_100);
  const followup = page.getByRole("dialog", { name: "この「やりたいこと」はどうしますか？" });
  await expect(followup).toBeVisible();
  await followup.getByRole("button", { name: "まだやりたい" }).click();
  expect((await currentConfig(page)).inbox.some((item) => item.id === "sample-weekend")).toBe(true);
  expect((await currentConfig(page)).today.items[0].done).toBe(true);
});

test("Phase 8.1 Wishlist follow-up waits while another confirm dialog is busy", async ({
  page,
}) => {
  await prepareUi(page, wishlistUiFixture());
  await finishPlannedTimer(page);
  await page.locator(".inboxBand .disclosure").click();
  const otherWishlist = page.locator(".inboxRow", { hasText: "あとで確認するサンプル" });
  await otherWishlist.click({ button: "right" });
  await page.getByRole("menuitem", { name: "削除" }).evaluate((button: HTMLButtonElement) => {
    button.click();
  });
  const busyDialog = page.getByRole("dialog", { name: "削除しますか？" });
  await expect(busyDialog).toBeVisible();

  await page.clock.fastForward(1_100);
  await expect(busyDialog).toBeVisible();
  await expect(
    page.getByRole("dialog", { name: "この「やりたいこと」はどうしますか？" }),
  ).toHaveCount(0);
  await busyDialog.getByRole("button", { name: "キャンセル" }).click();
  await page.clock.fastForward(250);
  await expect(
    page.getByRole("dialog", { name: "この「やりたいこと」はどうしますか？" }),
  ).toBeVisible();
});

test("Phase 8.1 Wishlist follow-up rolls back on save failure and completes on retry", async ({
  page,
}) => {
  await prepareUi(page, wishlistUiFixture());
  await finishPlannedTimer(page);
  await page.clock.fastForward(1_100);
  const followup = page.getByRole("dialog", { name: "この「やりたいこと」はどうしますか？" });
  await setSaveFailure(page, true);
  await followup.getByRole("button", { name: "完了にする" }).click();
  await expect(followup).toBeVisible();
  expect((await currentConfig(page)).inbox.some((item) => item.id === "sample-weekend")).toBe(true);

  await setSaveFailure(page, false);
  await followup.getByRole("button", { name: "完了にする" }).click();
  await expect(followup).toHaveCount(0);
  const saved = await currentConfig(page);
  expect(saved.inbox.some((item) => item.id === "sample-weekend")).toBe(false);
  expect(saved.today.items[0].done).toBe(true);
  expect(saved.sourceCompletions.at(-1)).toMatchObject({
    sourceType: "wishlist",
    sourceIdentity: "wishlist:sample-weekend",
  });
});

test("Phase 8.1 skips NextStep follow-up when the Project has no Wishlist", async ({ page }) => {
  await prepareUi(page, nextStepUiFixture(false));
  await finishPlannedTimer(page);
  await page.clock.fastForward(2_000);
  await expect(page.getByRole("dialog", { name: "次の一手を決めますか？" })).toHaveCount(0);
  expect((await currentConfig(page)).projects[0].nextStep).toBeUndefined();
});

test("Phase 8.1 incomplete early stop never opens a completion follow-up", async ({ page }) => {
  const fixture = nextStepUiFixture();
  fixture.config.today.items[0].shortTimerMinutes = 3;
  await prepareUi(page, fixture);
  const row = page.locator(".todayRow");
  await row.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.fastForward(180_000);
  await row.getByRole("button", { name: "終了", exact: true }).click();
  await page
    .getByRole("dialog", { name: "今日の分は完了にしますか？" })
    .getByRole("button", { name: "未完了のまま終了" })
    .click();
  await page.clock.fastForward(2_000);
  await expect(page.getByRole("dialog", { name: "次の一手を決めますか？" })).toHaveCount(0);
  expect((await currentConfig(page)).projects[0].nextStep?.text).toBe("資料を1ページ読む");
  expect((await currentConfig(page)).today.items[0].done).toBe(false);
});
