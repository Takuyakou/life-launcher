import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test.describe.configure({ mode: "serial" });

async function prepare(page: Page, fixture: VisualQaFixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
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

test("completing a NextStep keeps the Project and stores an immutable snapshot", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.candidateExcludedSourceKeys = ["project:sample-learning"];
  await prepare(page, fixture);
  const row = page.locator(".nextStepRow", { hasText: "資料を1ページ読む" });
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "完了にする" }).click();
  const dialog = page.getByRole("dialog", { name: "完了にしますか？" });
  await expect(dialog.getByRole("button", { name: "キャンセル" })).toBeFocused();
  await expect(dialog).toContainText("これまでの実行記録は残ります");
  await page.keyboard.press("Escape");
  expect((await currentConfig(page)).projects[0].nextStep).toBe("資料を1ページ読む");

  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "完了にする" }).click();
  await page
    .getByRole("dialog", { name: "完了にしますか？" })
    .getByRole("button", { name: "完了にする" })
    .dblclick();
  let config = await currentConfig(page);
  expect(config.projects.some((project) => project.id === "sample-learning")).toBe(true);
  expect(config.projects[0].nextStep).toBe("");
  expect(config.today.items.some((item) => item.sourceKey === "project:sample-learning")).toBe(
    false,
  );
  expect(config.today.candidateExcludedSourceKeys).not.toContain("project:sample-learning");
  expect(config.sourceCompletions).toHaveLength(1);
  expect(config.sourceCompletions[0]).toMatchObject({
    sourceType: "nextStep",
    sourceIdentity: "project:sample-learning",
    textSnapshot: "資料を1ページ読む",
    projectId: "sample-learning",
    projectNameSnapshot: "サンプル学習",
  });

  const completedProject = page.locator(".nextStepRow", { hasText: "サンプル学習" });
  await completedProject.click({ button: "right" });
  await page.getByRole("menuitem", { name: "削除" }).click();
  await page
    .getByRole("dialog", { name: "削除しますか？" })
    .getByRole("button", { name: "削除", exact: true })
    .click();
  config = await currentConfig(page);
  expect(config.projects.some((project) => project.id === "sample-learning")).toBe(false);
  expect(config.sourceCompletions).toHaveLength(1);
  expect(config.sourceCompletions[0].projectNameSnapshot).toBe("サンプル学習");

  await page.reload();
  config = await currentConfig(page);
  expect(config.sourceCompletions).toHaveLength(1);
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  await expect(page.locator(".sourceCompletionSection")).toContainText("資料を1ページ読む");
  await expect(page.locator(".sourceCompletionSection")).toContainText("次の一手");
});

test("completing a Wishlist item removes only its active source and records its Project snapshot", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [
    {
      text: fixture.config.inbox[1].text,
      done: false,
      sourceKey: "wishlist:sample-weekend",
      projectId: "sample-learning",
    },
  ];
  await prepare(page, fixture);
  await page.locator(".inboxBand .disclosure").click();
  const item = page.locator(".inboxRow", { hasText: "週末に試すアイデア" });
  await item.click({ button: "right" });
  await page.getByRole("menuitem", { name: "完了にする" }).click();
  await page
    .getByRole("dialog", { name: "完了にしますか？" })
    .getByRole("button", { name: "完了にする" })
    .click();

  const config = await currentConfig(page);
  expect(config.inbox.some((entry) => entry.id === "sample-weekend")).toBe(false);
  expect(config.today.items).toEqual([]);
  expect(config.projects[0].nextStep).toBe("資料を1ページ読む");
  expect(config.sourceCompletions[0]).toMatchObject({
    sourceType: "wishlist",
    sourceIdentity: "wishlist:sample-weekend",
    textSnapshot: "週末に試すアイデア",
    projectNameSnapshot: "サンプル学習",
  });
});

test("deleting a source removes linked Today3 without creating completion history", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const row = page.locator(".nextStepRow", { hasText: "資料を1ページ読む" });
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "削除" }).click();
  const dialog = page.getByRole("dialog", { name: "削除しますか？" });
  await expect(dialog.getByRole("button", { name: "キャンセル" })).toBeFocused();
  await expect(dialog).toContainText("完了としては記録されません");
  await dialog.getByRole("button", { name: "削除", exact: true }).click();

  const config = await currentConfig(page);
  expect(config.projects.some((project) => project.id === "sample-learning")).toBe(false);
  expect(config.today.items.some((item) => item.sourceKey === "project:sample-learning")).toBe(
    false,
  );
  expect(config.sourceCompletions).toEqual([]);
});

test("completion save failure rolls back source, Today3, and history together", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  await setSaveFailure(page, true);
  const row = page.locator(".nextStepRow", { hasText: "資料を1ページ読む" });
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "完了にする" }).click();
  const dialog = page.getByRole("dialog", { name: "完了にしますか？" });
  await dialog.getByRole("button", { name: "完了にする" }).click();

  await expect(dialog).toBeVisible();
  const config = await currentConfig(page);
  expect(config.projects[0].nextStep).toBe("資料を1ページ読む");
  expect(config.today.items.some((item) => item.sourceKey === "project:sample-learning")).toBe(
    true,
  );
  expect(config.sourceCompletions).toEqual([]);
});

test("active source timer disables complete and delete actions", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [fixture.config.today.items[0]];
  await prepare(page, fixture);
  await page
    .locator(".todayRow")
    .getByRole("button", { name: /短時間タイマー5分で開始/ })
    .click();
  await page.locator(".nextStepRow", { hasText: "資料を1ページ読む" }).click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "完了にする" })).toBeDisabled();
  await expect(page.getByRole("menuitem", { name: "削除" })).toBeDisabled();
});

test("Today3 planned completion does not complete its reusable source", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].shortTimerMinutes = 1;
  fixture.config.today.items = [fixture.config.today.items[0]];
  await prepare(page, fixture);
  await page
    .locator(".todayRow")
    .getByRole("button", { name: /短時間タイマー1分で開始/ })
    .click();
  await page.clock.runFor(60_500);
  await page
    .getByRole("dialog", { name: "タイマー満了" })
    .getByRole("button", { name: "終わる" })
    .click();

  const config = await currentConfig(page);
  expect(config.today.items[0].done).toBe(true);
  expect(config.projects[0].nextStep).toBe("資料を1ページ読む");
  expect(config.sourceCompletions).toEqual([]);
});
