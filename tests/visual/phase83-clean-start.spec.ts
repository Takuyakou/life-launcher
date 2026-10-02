import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import {
  createPublicFixture,
  FIXTURE_NOW,
  type VisualQaFixture,
} from "./fixtures";
import { installTauriMock } from "./tauriMock";

type VisualQaControl = {
  currentConfig: () => AppConfig;
  invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
};

async function prepare(page: Page, fixture: VisualQaFixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main", null, {
    cleanStartReset: true,
    cleanStartNow: FIXTURE_NOW,
  });
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function commandCalls(page: Page, command: string) {
  return page.evaluate((name) =>
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl })
      .__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === name),
    command,
  );
}

async function openResetChoice(page: Page) {
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings.getByRole("tab", { name: "メンテナンス" }).click();
  await settings.getByRole("button", { name: "ソフトウェアリセット..." }).click();
  const choice = page.getByRole("dialog", { name: "リセット前にバックアップしますか？" });
  await expect(choice).toBeVisible();
  return choice;
}

async function resetWithBackup(page: Page) {
  const choice = await openResetChoice(page);
  await choice.getByRole("button", { name: "バックアップして続行" }).click();
  const final = page.getByRole("dialog", { name: "ソフトウェアリセットを実行しますか？" });
  await final.getByRole("button", { name: "ソフトウェアリセット", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Life Launcherを再起動しています" })).toBeVisible();
}

async function openDisclosure(disclosure: ReturnType<Page["locator"]>) {
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
}

test("P83-04 clean start remains usable through Session recording", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  expect((await currentConfig(page)).projects).toHaveLength(2);

  await resetWithBackup(page);
  expect(await commandCalls(page, "create_software_reset_backup")).toHaveLength(1);
  expect(await commandCalls(page, "software_reset")).toHaveLength(1);

  await page.reload();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".doNowBand")).toBeVisible();

  await expect(page.locator(".projectsBand .disclosureCount")).toHaveText("0件");

  await page
    .locator(".projectsBand")
    .getByRole("button", { name: "プロジェクトを追加", exact: true })
    .click();
  const projectDialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await projectDialog
    .getByRole("textbox", { name: "プロジェクト名" })
    .fill("Clean Start Project");
  await projectDialog.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  const config = await currentConfig(page);
  const project = config.projects.at(-1)!;
  expect(project.name).toBe("Clean Start Project");

  const projectCard = page.locator(`[data-project-id="${project.id}"]`);
  await projectCard.getByRole("button", { name: "次の一手を設定" }).click();
  const nextStepDialog = page.getByRole("dialog", { name: "次の一手を設定" });
  await nextStepDialog.getByRole("tab", { name: "＋ 新しく入力" }).click();
  await nextStepDialog.getByRole("textbox", { name: "行動" }).fill("Clean Start Action");
  await nextStepDialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(projectCard).toContainText("Clean Start Action");

  await openDisclosure(page.locator(".inboxBand .disclosure"));
  await page
    .locator(".inboxBand")
    .getByRole("button", { name: "やりたいことを追加", exact: true })
    .click();
  const wishlistDialog = page.getByRole("dialog", { name: "やりたいことを追加" });
  await wishlistDialog
    .getByRole("textbox", { name: "やりたいこと" })
    .fill("Clean Start Wishlist");
  await wishlistDialog
    .getByRole("combobox", { name: "プロジェクト（任意）" })
    .selectOption(project.id);
  await wishlistDialog.getByRole("button", { name: "保存", exact: true }).click();
  expect((await currentConfig(page)).inbox).toEqual([
    expect.objectContaining({ text: "Clean Start Wishlist", projectId: project.id }),
  ]);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const candidate = page.locator(".todayPickerRow", { hasText: "Clean Start Action" });
  await expect(candidate).toBeVisible();
  await candidate.getByRole("button", { name: "今日へ" }).click();
  const todayCard = page.locator(".todayRow", { hasText: "Clean Start Action" });
  await expect(todayCard).toBeVisible();
  expect((await currentConfig(page)).today.items).toHaveLength(1);
  await page.getByRole("button", { name: "決定", exact: true }).click();

  await todayCard.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.fastForward(65_000);
  await todayCard.locator(".runningStopButton").click();
  await expect(page.locator(".toast").last()).toContainText(
    "Clean Start Project 1分を記録しました",
  );

  const sessions = await commandCalls(page, "record_session");
  expect(sessions).toHaveLength(1);
  expect(sessions[0].args).toMatchObject({
    session: {
      projectId: project.id,
      label: "Clean Start Project",
      minutes: 1,
      note: "Clean Start Action",
    },
  });

  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  const records = page.locator(".recordsView");
  await expect(records).toBeVisible();
  await expect(records.locator(".recordsStats")).toContainText("1分");
  await expect(records.getByText("Clean Start Project", { exact: true }).first()).toBeVisible();
  await records.getByRole("tab", { name: "すべての記録" }).click();
  await expect(records.getByText("Clean Start Action", { exact: true })).toBeVisible();
});

test("P83-04 reset backup remains selectable and restores the original state", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);

  await resetWithBackup(page);
  await page.reload();
  await expect(page.locator(".projectsBand .disclosureCount")).toHaveText("0件");

  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings.getByRole("tab", { name: "バックアップ" }).click();
  await settings.getByRole("button", { name: "バックアップから復元", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "バックアップから復元しますか？" });
  await expect(confirm).toContainText("lifelauncher-clean-start.zip");
  await confirm.getByRole("button", { name: "復元する", exact: true }).click();
  await expect(settings).toHaveCount(0);

  const restores = await commandCalls(page, "restore_backup");
  expect(restores).toHaveLength(1);
  expect(restores[0].args).toMatchObject({
    zipPath: "C:\\PublicDemo\\Backups\\lifelauncher-clean-start.zip",
  });
  await expect(page.locator('[data-project-id="sample-learning"]')).toBeVisible();
});
