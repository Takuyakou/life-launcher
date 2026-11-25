import { expect, test } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

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
  expect(bodyText).toContain("「続ける(+〇分)」か「終わる」を選べます");
  expect(bodyText).toContain("ふだんの分数(初めは15分)は、設定の「基本」の「延長タイマー分数」で変えられます。");
  expect(bodyText).toContain("オレンジ色の「見つかりません」が付きます");
  expect(bodyText).toContain("やりかけで終えたときは？");
});
