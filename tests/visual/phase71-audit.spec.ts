import { expect, test } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

for (const width of [1440, 860]) {
  test(`P71 edit surface audit at ${width}`, async ({ page }, testInfo) => {
    await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
    await page.setViewportSize({ width, height: 900 });
    await installTauriMock(page, createPublicFixture(), "main");
    await page.goto("/");
    const today = page.locator(".todayRow").first();
    await expect(today).toBeVisible();
    await today.click({ button: "right" });
    await expect(page.getByRole("menuitem", { name: "今日の3件から外す" })).toBeVisible();
    await page.screenshot({ path: testInfo.outputPath("today-menu.png") });
    await page.keyboard.press("Escape");
    await page.locator(".nextStepRow").first().click({ button: "right" });
    await page.getByRole("menuitem", { name: "編集", exact: true }).click();
    const editor = page.getByRole("dialog", { name: "プロジェクト編集", exact: true });
    await expect(editor).toBeVisible();
    await editor.getByRole("button", { name: "保存", exact: true }).scrollIntoViewIfNeeded();
    await editor.screenshot({ path: testInfo.outputPath("project-editor.png") });
    expect(await editor.evaluate(node => node.scrollWidth - node.clientWidth)).toBeLessThanOrEqual(1);
    await editor.getByRole("button", { name: "キャンセル", exact: true }).click();
    await expect(editor).toHaveCount(0);
  });
}
