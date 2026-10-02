import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test.describe.configure({ mode: "serial" });

async function prepare(page: Page, fixture: VisualQaFixture, width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

test("Phase 8.4 keeps legacy candidate exclusions inert and removes restore actions", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.inbox = [
    { id: "same-a", text: "同じ本文" },
    { id: "same-b", text: "同じ本文" },
  ];
  fixture.config.today.candidateExcludedSourceKeys = ["project:sample-learning", "wishlist:same-b"];
  await prepare(page, fixture);

  const nextStep = page.locator(".nextStepRow").first().locator(".nextStepActionRegion");
  await nextStep.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "次の一手を編集" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "今日を組み立てるに登録する" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const inboxDisclosure = page.locator(".inboxBand .disclosure");
  if ((await inboxDisclosure.getAttribute("aria-expanded")) !== "true")
    await inboxDisclosure.click();
  await page.locator('[data-inbox-id="same-b"]').click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "今日の候補に戻す" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const picker = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  await expect(picker).toContainText("資料を1ページ読む");
  await picker.getByRole("tab", { name: /やりたいこと/ }).click();
  await expect(picker.locator(".todayPickerRow", { hasText: "同じ本文" })).toHaveCount(2);
  expect((await currentConfig(page)).today.candidateExcludedSourceKeys).toEqual([
    "project:sample-learning",
    "wishlist:same-b",
  ]);
});

test("Phase 8.4 opening the Picker does not rewrite legacy exclusion state", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.candidateExcludedSourceKeys = ["wishlist:sample-later"];
  await prepare(page, fixture);
  await page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { setSaveConfigFailure: (value: boolean) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true),
  );

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const picker = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  await picker.getByRole("tab", { name: /やりたいこと/ }).click();
  await expect(picker).toContainText("あとで確認するサンプル");
  expect((await currentConfig(page)).today.candidateExcludedSourceKeys).toEqual([
    "wishlist:sample-later",
  ]);
  await expect(page.locator(".toast")).toHaveCount(0);
});
test("v1.3 Do Now switches candidates from the copy area and context menu", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const band = page.locator(".doNowContent");
  const actions = band.locator(".doNowActions");
  const alternate = band.locator(".doNowCopy").getByRole("button", {
    name: "他の一手",
    exact: true,
  });
  await expect(alternate).toBeVisible();
  await expect(actions.getByRole("button", { name: "他の一手", exact: true })).toHaveCount(0);
  const labels = await actions.getByRole("button").allTextContents();
  expect(labels[0]?.trim()).toBe("5分で始める");

  await alternate.click();
  await expect(band.locator(".doNowCopy > strong")).toHaveText("5分だけ体を動かす");
  await band.click({ button: "right" });
  await page.getByRole("menuitem", { name: "他の一手", exact: true }).click();
  await expect(band.locator(".doNowCopy > strong")).toHaveText("資料を1ページ読む");
});

test("v1.3 Do Now hides alternate actions when there is no other candidate", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.doNowCandidates = fixture.doNowCandidates.slice(0, 1);
  await prepare(page, fixture);
  const band = page.locator(".doNowContent");
  await expect(band.getByRole("button", { name: "他の一手", exact: true })).toHaveCount(0);
  await band.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "他の一手", exact: true })).toHaveCount(0);
});

test("Do Now timer labels and glyphs remain separate on hover and keyboard focus", async ({ page }) => {
  await prepare(page, createPublicFixture());
  const short = page.locator(".doNowStartPrimary");
  const normal = page.locator(".doNowStartSecondary");
  await expect(short.locator(".timerStartDuration")).toHaveText("5分で始める");
  await expect(normal.locator(".timerStartDuration")).toHaveText("通常 25分");
  const before = await short.boundingBox();
  await short.hover();
  await expect(short.locator(".timerStartDuration")).toHaveCSS("opacity", "1");
  await expect(short.locator(".timerStartHoverGlyph")).toHaveCSS("opacity", "1");
  expect(await short.boundingBox()).toEqual(before);
  const glyph = (await short.locator(".timerStartHoverGlyph").boundingBox())!;
  const label = (await short.locator(".timerStartDuration").boundingBox())!;
  expect(glyph.x + glyph.width).toBeLessThanOrEqual(label.x);
  await page.mouse.move(0, 0);
  await normal.focus();
  await expect(normal.locator(".timerStartDuration")).toHaveCSS("opacity", "1");
  await expect(normal.locator(".timerStartHoverGlyph")).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  await expect(page.locator(".doNowBand").getByRole("button", { name: "このセッションを一時停止" })).toBeVisible();
});
