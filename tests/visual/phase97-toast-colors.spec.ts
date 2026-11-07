import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture = createFullTodayFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function toast(page: Page, text: string) {
  const locator = page.locator(".toast", { hasText: text }).last();
  await expect(locator).toBeVisible();
  return locator;
}

async function expectNeutral(page: Page, text: string) {
  const locator = await toast(page, text);
  await expect(locator).toHaveClass(/toast--neutral/);
  await expect(locator).not.toHaveClass(/toast--ok/);
  return locator;
}

test("turning autostart off uses a neutral toast and turning it on stays green", async ({
  page,
}) => {
  const fixture = createFullTodayFixture();
  fixture.config.settings.autoStart = true;
  await prepare(page, fixture);

  const toggle = page.getByRole("button", { name: /Windows自動起動/ }).first();
  await expect(toggle).toHaveAttribute("title", "Windows自動起動: ON");
  await toggle.click();
  await expectNeutral(page, "PC起動時の起動を止めました");

  await toggle.click();
  const on = await toast(page, "PC起動時に開くようにしました");
  await expect(on).toHaveClass(/toast--ok/);
});

test("unregistering an instruction folder uses a neutral toast", async ({ page }) => {
  await prepare(page);

  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings.getByRole("tab", { name: "手順書" }).click();
  await settings.getByRole("button", { name: "解除", exact: true }).click();

  const confirm = page.getByRole("dialog", { name: "手順書フォルダの登録を解除しますか？" });
  await confirm.getByRole("button", { name: "登録を解除" }).click();
  await expectNeutral(page, "手順書フォルダの登録を解除しました");
});

test("deleting an execution record uses a neutral toast", async ({ page }) => {
  await prepare(page, createPublicFixture());

  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  const records = page.locator(".recordsView");
  await expect(records).toBeVisible();
  await records.getByRole("tab", { name: "すべての記録" }).click();
  const row = records.locator(".recordsCompactRow").first();
  await expect(row).toBeVisible();
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "削除", exact: true }).click();

  const confirm = page.getByRole("dialog", { name: "実行記録を削除しますか？" });
  await confirm.getByRole("button", { name: "削除する" }).click();
  await expectNeutral(page, "実行記録を削除しました");
});

test("unsetting a next step uses a neutral toast for both choices", async ({ page }) => {
  await prepare(page);

  await page
    .locator('.nextStepCard[data-project-id="sample-stretch"]')
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手を未設定にする" }).click();
  const returnConfirm = page.getByRole("dialog", { name: "次の一手を未設定にしますか？" });
  await returnConfirm.getByRole("button", { name: "やりたいことへ戻す" }).click();
  await expectNeutral(page, "やりたいことへ戻しました");

  await page
    .locator('.nextStepCard[data-project-id="sample-writing"]')
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手を未設定にする" }).click();
  const deleteConfirm = page.getByRole("dialog", { name: "次の一手を未設定にしますか？" });
  await deleteConfirm.getByRole("button", { name: "削除して未設定にする" }).click();
  await expectNeutral(page, "次の一手を未設定にしました");
});

test("deleting a project uses a danger toast", async ({ page }) => {
  await prepare(page);

  await page
    .locator('.nextStepCard[data-project-id="sample-writing"]')
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを削除…" }).click();
  const confirm = page.getByRole("dialog", { name: "プロジェクトを削除しますか？" });
  await confirm.getByRole("button", { name: "関連項目も削除" }).click();

  const deleted = await toast(page, "プロジェクト「文章づくり」を削除しました");
  await expect(deleted).toHaveClass(/toast--danger/);
  await expect(deleted).not.toHaveClass(/toast--ok/);
});

test("undoing a removal uses a neutral toast", async ({ page }) => {
  await prepare(page, createPublicFixture());

  await page.locator(".todayRemoveButton").first().click();
  await expectNeutral(page, "今日の3件から外しました");

  const undo = page.locator(".toast", { hasText: "今日の3件から外しました" }).last();
  await undo.getByRole("button", { name: "元に戻す" }).click();
  await expectNeutral(page, "元に戻しました");
});
