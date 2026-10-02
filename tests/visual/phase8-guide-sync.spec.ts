import { expect, test } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test("Guide navigation focuses the requested section and closing restores its opener", async ({ page }) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  const opener = page.getByRole("button", { name: "使い方", exact: true });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "使い方" });
  await expect(dialog).toBeVisible();

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
