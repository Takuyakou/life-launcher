import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test.describe.configure({ mode: "serial" });

async function prepare(
  page: Page,
  fixture: VisualQaFixture = createPublicFixture(),
  viewport = { width: 1440, height: 900 },
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
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

async function invokeCommands(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { invokeCalls: Array<{ command: string }> };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    return control?.invokeCalls.map((call) => call.command) ?? [];
  });
}

function withTodayState(activeCount: number, completedCount = 0): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.today.items = Array.from({ length: activeCount }, (_, index) => ({
    text: `今日の候補 ${index + 1}`,
    done: index < completedCount,
    sourceKey: `manual:p6-03-${index + 1}`,
  }));
  return fixture;
}

for (const completedCount of [2, 3]) {
  test(`Today3 completion count ${completedCount} of 3 has the correct batch state`, async ({
    page,
  }) => {
    await prepare(page, withTodayState(3, completedCount));
    await expect(page.locator(".todayCompletionStatus--complete")).toHaveCount(completedCount);
    await expect(
      page.locator(".todayCompletionStatus:not(.todayCompletionStatus--complete)"),
    ).toHaveCount(3 - completedCount);
    const summary = page.locator(".todayCompletionSummary");
    await expect(summary).toHaveText(`${completedCount} / 3 完了`);
    await expect(summary).toHaveClass(
      completedCount === 3 ? /todayCompletionSummary--complete/ : /todayCompletionSummary$/,
    );
    await expect(page.getByRole("button", { name: /次の3件を選ぶ/ })).toHaveCount(
      completedCount === 3 ? 1 : 0,
    );
  });
}

test("switching from a sub-minute timer warns without recording or resizing manual cards", async ({
  page,
}) => {
  const fixture = withTodayState(2);
  fixture.config.settings.shortTimerMinutes = 2;
  await prepare(page, fixture, { width: 860, height: 900 });
  const cards = page.locator(".todayRow");
  const first = cards.nth(0);
  const second = cards.nth(1);
  const firstIdleHeight = (await first.boundingBox())?.height;
  const secondIdleHeight = (await second.boundingBox())?.height;

  await first.getByRole("button", { name: "短時間タイマー2分で開始" }).click();
  await expect(first.getByText("実行中", { exact: true })).toBeVisible();
  expect((await first.boundingBox())?.height).toBe(firstIdleHeight);
  await page.clock.runFor(30_000);
  await second.getByRole("button", { name: "短時間タイマー2分で開始" }).click();

  await expect(page.getByText("1分未満なので記録しませんでした", { exact: true })).toBeVisible();
  await expect(second.getByText("実行中", { exact: true })).toBeVisible();
  await expect(first.getByText("実行中", { exact: true })).toHaveCount(0);
  expect((await second.boundingBox())?.height).toBe(secondIdleHeight);
  expect(
    (await invokeCommands(page)).filter((command) => command === "record_session"),
  ).toHaveLength(0);
});

test("starting another timer ends a paused timer before the new timer runs", async ({ page }) => {
  const fixture = withTodayState(2);
  fixture.config.settings.shortTimerMinutes = 2;
  await prepare(page, fixture);
  const cards = page.locator(".todayRow");
  await cards.nth(0).getByRole("button", { name: "短時間タイマー2分で開始" }).click();
  await page.clock.runFor(70_000);
  await cards.nth(0).getByRole("button", { name: "このセッションを一時停止" }).click();
  await expect(cards.nth(0).getByText("一時停止", { exact: true })).toBeVisible();
  await cards.nth(1).getByRole("button", { name: "短時間タイマー2分で開始" }).click();
  await expect(cards.nth(1).getByText("実行中", { exact: true })).toBeVisible();
  await expect(cards.nth(0).getByText("一時停止", { exact: true })).toHaveCount(0);
  await expect(page.locator(".runningBadge")).toHaveCount(1);
  expect(
    (await invokeCommands(page)).filter((command) => command === "record_session"),
  ).toHaveLength(1);
});

test("manual next batch accepts one, two, and three new items but no fourth", async ({ page }) => {
  await prepare(page, withTodayState(3, 3));
  await page.getByRole("button", { name: /次の3件を選ぶ/ }).click();
  await expect(page.locator(".todayRow")).toHaveCount(0);
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();

  for (let index = 0; index < 3; index += 1) {
    if (index === 2) {
      await page.getByRole("tab", { name: /やりたいこと/ }).click();
    }
    await page
      .locator(".todayPickerRow")
      .nth(index)
      .getByRole("button", { name: "＋ 今日へ", exact: true })
      .click();
    await expect(page.locator(".todayRow")).toHaveCount(index + 1);
  }
  const picker = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  await expect(picker).toHaveCount(0);
  await expect(page.getByRole("button", { name: "今日やるものを選ぶ", exact: true })).toHaveCount(0);

  await page.locator(".inboxBand .disclosure").click();
  await expect(page.locator(".inboxRow .moveTodayButton")).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toHaveLength(3);
});

test("registration stays in source sections and persists after reload", async ({ page }) => {
  await prepare(page, withTodayState(0));

  await expect(page.getByRole("button", { name: "今日の3件に追加" })).toHaveCount(0);
  await page
    .locator(".focusBand .todayEmptyState")
    .getByRole("button", { name: "今日やるものを選ぶ" })
    .click();
  const pickerCloseButton = page.getByRole("button", {
    name: "今日やるものを選ぶを閉じる",
  });
  await expect(pickerCloseButton).toBeFocused();
  await pickerCloseButton.click();
  await expect(page.getByRole("button", { name: "今日を組み立てるに次の一手を追加" })).toHaveCount(
    0,
  );
  await expect(page.locator(".todayBuilderDestination")).toHaveCount(0);

  const projects = page.locator(".projectsBand");
  await projects.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  const projectDialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await expect(projectDialog).toBeVisible();
  const projectName = projectDialog.getByRole("textbox", { name: "プロジェクト名" });
  await expect(projectName).toBeFocused();
  await projectName.fill("再起動確認プロジェクト");
  await projectDialog.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  await expect(projectDialog).toHaveCount(0);

  const addedProject = (await currentConfig(page)).projects.at(-1)!;
  const addedProjectRow = page.locator(`[data-project-id="${addedProject.id}"]`);
  await addedProjectRow.getByRole("button", { name: "次の一手を設定" }).click();
  const nextStepDialog = page.getByRole("dialog", { name: "次の一手を設定" });
  await nextStepDialog.getByRole("tab", { name: "＋ 新しく入力" }).click();
  await nextStepDialog.getByRole("textbox", { name: "行動" }).fill("再起動後も残る一手");
  await nextStepDialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(nextStepDialog).toHaveCount(0);

  const wishlist = page.locator(".inboxBand");
  await wishlist.getByRole("button", { name: "やりたいことを追加" }).click();
  const wishlistDialog = page.getByRole("dialog", { name: "やりたいことを追加" });
  const wishlistInput = wishlistDialog.getByRole("textbox", { name: "やりたいこと" });
  await expect(wishlistInput).toBeFocused();
  await wishlistInput.fill("再起動後も残るやりたいこと");
  await wishlistInput.press("Enter");
  await expect(wishlistDialog).toHaveCount(0);

  await addedProjectRow.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "次の一手を編集", exact: true })).toBeEnabled();
  await page.keyboard.press("Escape");

  await page.reload();
  expect(
    (await currentConfig(page)).projects.some(
      (project) => project.nextStep?.text === "再起動後も残る一手",
    ),
  ).toBe(true);
  expect(
    (await currentConfig(page)).inbox.some((item) => item.text === "再起動後も残るやりたいこと"),
  ).toBe(true);
  expect(
    (await currentConfig(page)).inbox.find((item) => item.text === "再起動後も残るやりたいこと")
      ?.id,
  ).toBeTruthy();
  expect((await currentConfig(page)).today.items).toEqual([]);
});

test("Today3 changes from three to two to one column without horizontal overflow", async ({
  page,
}) => {
  await prepare(page, withTodayState(3));
  const rowCount = async () =>
    page
      .locator(".todayRow")
      .evaluateAll(
        (rows) => new Set(rows.map((row) => Math.round(row.getBoundingClientRect().y))).size,
      );
  expect(await rowCount()).toBe(1);

  await page.setViewportSize({ width: 1000, height: 900 });
  expect(await rowCount()).toBe(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );

  await page.setViewportSize({ width: 860, height: 900 });
  expect(await rowCount()).toBe(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});
