import { expect, test } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test("Guide navigation focuses the requested section and closing restores its opener", async ({ page }) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  // P10-02: the Guide opens from Settings, and the Settings row is the opener.
  await page.getByRole("button", { name: "設定を開く" }).click();
  const opener = page.getByRole("button", { name: "使い方を開く" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "使い方" });
  await expect(dialog).toBeVisible();
  // V151-S6: click only after the open animation ends; clicking a 目次 item while the dialog is
  // still growing made Playwright scroll the outer dialog to reach it.
  await dialog.evaluate((node) =>
    Promise.allSettled(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );

  const navigation = dialog.getByRole("navigation", { name: "使い方の目次" });
  const records = navigation.getByRole("button", { name: /記録を見る/ });
  await records.click();
  await expect(records).toHaveAttribute("aria-current", "location");
  const heading = dialog.getByRole("heading", { name: "記録を見る", exact: true });
  await expect(heading).toBeFocused();
  await expect(heading).toBeInViewport();
  await expect.poll(() => dialog.locator(".helpGuideBody").evaluate((node) => node.scrollTop)).toBeGreaterThan(0);

  await dialog.getByRole("button", { name: "使い方を閉じる", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("P10-17 N6 the guide matches the current timer completion, missing target, and resume note behavior", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.keyboard.press("F1");
  const dialog = page.getByRole("dialog", { name: "使い方" });
  await expect(dialog).toBeVisible();
  const bodyText = await dialog.innerText();
  expect(bodyText).not.toContain("5つから選べます");
  expect(bodyText).toContain("「続ける(+15分)」か「終わる」を選べます");
  expect(bodyText).toContain("オレンジ色の「見つかりません」が付きます");
  expect(bodyText).toContain("やりかけで終えたときは？");
});
