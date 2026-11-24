import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
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
