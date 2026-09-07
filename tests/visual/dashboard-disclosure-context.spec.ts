import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main");
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

test("confirmation actions place the destructive or completion action before cancel", async ({
  page,
}) => {
  await prepare(page);
  const project = page.locator(".nextStepRow", { hasText: "資料を1ページ読む" });

  await project.click({ button: "right" });
  await page.getByRole("menuitem", { name: "完了にする" }).click();
  let dialog = page.getByRole("dialog", { name: "完了にしますか？" });
  await expect(dialog.locator(".confirmDialogActions button")).toHaveText([
    "完了にする",
    "キャンセル",
  ]);
  await expect(dialog.getByRole("button", { name: "キャンセル" })).toBeFocused();
  await page.keyboard.press("Escape");

  await project.click({ button: "right" });
  await page.getByRole("menuitem", { name: "削除" }).click();
  dialog = page.getByRole("dialog", { name: "削除しますか？" });
  await expect(dialog.locator(".confirmDialogActions button")).toHaveText(["削除", "キャンセル"]);
});

test("dashboard disclosure bars toggle from their count and description areas", async ({
  page,
}) => {
  await prepare(page);

  const cases = [
    { band: ".todayBuilderBand", target: ".disclosureCount" },
    { band: ".projectsBand", target: ".disclosureDescription" },
    { band: ".inboxBand", target: ".disclosureCount" },
    { band: ".todayActivityBand", target: ".disclosureDescription" },
  ];

  for (const item of cases) {
    const band = page.locator(item.band);
    const disclosure = band.locator(".disclosure");
    const before = await disclosure.getAttribute("aria-expanded");
    await band.locator(item.target).click();
    await expect(disclosure).toHaveAttribute("aria-expanded", before === "true" ? "false" : "true");
  }
});

test("a NextStep context menu can add that source to Today3", async ({ page }) => {
  await prepare(page);
  const row = page.locator(".nextStepRow", { hasText: "5分だけ体を動かす" });

  await row.click({ button: "right" });
  const addToToday = page.getByRole("menuitem", { name: "今日へ" });
  await expect(addToToday).toBeEnabled();
  await addToToday.click();

  const config = await currentConfig(page);
  expect(config.today.items).toContainEqual(
    expect.objectContaining({
      sourceKey: "project:sample-stretch",
      projectId: "sample-stretch",
      text: "5分だけ体を動かす",
      defaultTimerMinutes: 20,
      shortTimerMinutes: 5,
    }),
  );
  await expect(page.locator(".todayRow", { hasText: "5分だけ体を動かす" })).toBeVisible();
});
