import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P97-01: テスト用の起動（普段のデータから切り離した起動）の見分けと、自動起動を触らないこと。

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: { command: string; args: Record<string, unknown> }[] };
};

async function open(page: Page, testProfile: boolean) {
  const fixture = createPublicFixture();
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1200, height: 680 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture, "main", null, { testProfile });
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

const autostartCalls = (page: Page) =>
  page.evaluate(
    () =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) =>
        call.command.includes("autostart"),
      ).length,
  );

test("the normal start shows no test badge", async ({ page }) => {
  await open(page, false);
  await expect(page.locator(".testProfileBadge")).toHaveCount(0);
});

test("the test profile shows the badge and the note, and never touches autostart", async ({
  page,
}) => {
  await open(page, true);
  await expect(page.locator(".testProfileBadge")).toHaveText("テスト");
  await expect(page.locator(".testProfileBadge")).toBeVisible();

  // 設定画面を開くと、自動起動の欄に「登録しない」ことが書いてある
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings.getByText("テスト用の起動では、自動起動に登録しません")).toBeVisible();

  // 自動起動を切り替えても、OS への登録（autostart のコマンド）を呼ばない
  const autostartToggle = settings.getByRole("checkbox", { name: /Windows自動起動/ });
  const before = await autostartToggle.isChecked();
  await autostartToggle.click();
  await expect(autostartToggle).toBeChecked({ checked: !before });
  expect(await autostartCalls(page)).toBe(0);

  await settings.getByRole("button", { name: "キャンセル", exact: true }).click();
});
