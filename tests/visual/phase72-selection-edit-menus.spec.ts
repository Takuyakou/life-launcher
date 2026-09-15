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

test("Phase 8.1 separates NextStep actions from Wishlist candidate restore", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.inbox = [
    { id: "same-a", text: "同じ本文" },
    { id: "same-b", text: "同じ本文" },
  ];
  fixture.config.today.candidateExcludedSourceKeys = [
    "project:sample-learning",
    "wishlist:same-b",
  ];
  await prepare(page, fixture);

  const nextStep = page.locator(".nextStepRow").first().locator(".nextStepActionRegion");
  await nextStep.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "次の一手を編集" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "次の一手を変更" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "次の一手を未設定にする" })).toBeVisible();
  await expect(
    page.getByRole("menuitem", { name: "今日を組み立てるに登録する" }),
  ).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "今日の候補に戻す" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  expect((await currentConfig(page)).today.candidateExcludedSourceKeys).toEqual([
    "project:sample-learning",
    "wishlist:same-b",
  ]);

  const inboxDisclosure = page.locator(".inboxBand .disclosure");
  if ((await inboxDisclosure.getAttribute("aria-expanded")) !== "true") await inboxDisclosure.click();
  await page.locator(".inboxRow").first().click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "今日の候補に戻す" })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "編集", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menu")).toHaveCount(0);
  await page.locator(".inboxRow").nth(1).click({ button: "right" });
  await page.getByRole("menuitem", { name: "今日の候補に戻す" }).click();
  expect((await currentConfig(page)).today.candidateExcludedSourceKeys).toEqual([
    "project:sample-learning",
  ]);
  await expect(page.locator(".todayRow")).toHaveCount(fixture.config.today.items.length);
});


test("P72-01 empty Today CTA opens Builder and focuses a candidate", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture, 860);
  const empty = page.locator(".focusBand .todayEmptyState");
  await expect(empty).toContainText("今日やるものを選びましょう");
  await empty.getByRole("button", { name: "今日を組み立てる" }).click();
  await expect(page.locator(".todayBuilderDisclosure")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".todayBuilderRow").first()).toBeFocused();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test("P72-01 Today and Builder expose the same menu through ellipsis and keyboard", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const todayMenu = page.locator(".todayRow").first().locator(".todayRowMenu");
  await todayMenu.click();
  await expect(page.getByRole("menuitem", { name: "今日の3件から外す" })).toBeVisible();
  await page.getByRole("menuitem", { name: "編集", exact: true }).focus();
  await page.keyboard.press("Escape");
  await expect(todayMenu).toBeFocused();
  await page.locator(".todayBuilderDisclosure").click();
  const builder = page.locator(".todayBuilderRow").first();
  await builder.focus();
  await page.keyboard.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "編集", exact: true })).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Escape");
  await expect(builder).toBeFocused();
});

test("P72-01 failed Wishlist restore keeps exclusion and does not show success", async ({ page }) => {
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
  const inboxDisclosure = page.locator(".inboxBand .disclosure");
  if ((await inboxDisclosure.getAttribute("aria-expanded")) !== "true") {
    await inboxDisclosure.click();
  }
  await page.locator('[data-inbox-id="sample-later"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "今日の候補に戻す" }).click();
  await expect(page.locator(".toast").last()).toContainText("保存できません");
  expect((await currentConfig(page)).today.candidateExcludedSourceKeys).toEqual([
    "wishlist:sample-later",
  ]);
  await expect(page.getByText("今日の候補に戻しました", { exact: true })).toHaveCount(0);
});

test("v1.3 Do Now switches candidates from the action row and context menu", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const band = page.locator(".doNowContent");
  const actions = band.locator(".doNowActions");
  const alternate = actions.getByRole("button", { name: "他の一手", exact: true });
  await expect(alternate).toBeVisible();
  const labels = await actions.getByRole("button").allTextContents();
  expect(labels[0]?.trim()).toBe("他の一手");
  expect(labels[1]?.trim()).toBe("5分で始める");

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

test("timer actions keep time subtly right of center and slide play in from the left", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const doNowShort = page.locator(".doNowStartPrimary");
  const doNowNormal = page.locator(".doNowStartSecondary");
  await expect(doNowShort.locator(".timerStartDuration")).toHaveText("5分で始める");
  await expect(doNowNormal.locator(".timerStartDuration")).toHaveText("通常 25分");
  expect((await doNowShort.boundingBox())?.width).toBe((await doNowNormal.boundingBox())?.width);
  expect((await doNowShort.boundingBox())?.width).toBe(112);
  expect((await doNowShort.boundingBox())?.height).toBe(38);
  await expect(doNowShort.locator(".timerStartDuration")).toHaveCSS("opacity", "1");
  await expect(doNowShort.locator(".timerStartHoverGlyph")).toHaveCSS("opacity", "1");
  const doNowBefore = await doNowShort.boundingBox();
  const doNowTimeBefore = await doNowShort.locator(".timerStartDuration").boundingBox();
  const doNowPlayBefore = await doNowShort.locator(".timerStartHoverGlyph").boundingBox();
  const accentBefore = await doNowShort.evaluate(
    (node) => getComputedStyle(node, "::after").transform,
  );
  await doNowShort.hover();
  await expect(doNowShort.locator(".timerStartDuration")).toHaveCSS("opacity", "1");
  await expect(doNowShort.locator(".timerStartHoverGlyph")).toHaveCSS("opacity", "1");
  const doNowAfter = await doNowShort.boundingBox();
  const doNowTimeAfter = await doNowShort.locator(".timerStartDuration").boundingBox();
  const doNowPlayAfter = await doNowShort.locator(".timerStartHoverGlyph").boundingBox();
  expect(doNowBefore && doNowAfter && doNowTimeBefore && doNowTimeAfter).toBeTruthy();
  expect(doNowTimeBefore!.x + doNowTimeBefore!.width / 2 - (doNowBefore!.x + doNowBefore!.width / 2)).toBeCloseTo(5, 1);
  expect(doNowTimeAfter!.x + doNowTimeAfter!.width / 2 - (doNowAfter!.x + doNowAfter!.width / 2)).toBeCloseTo(5, 1);
  expect(doNowPlayAfter!.x).toBeCloseTo(doNowPlayBefore!.x, 1);
  expect(doNowPlayAfter!.x + doNowPlayAfter!.width).toBeLessThan(doNowTimeAfter!.x);
  expect(doNowAfter!.y).toBeCloseTo(doNowBefore!.y, 1);
  expect(accentBefore).toContain("0");
  expect(await doNowShort.evaluate((node) => getComputedStyle(node, "::after").transform)).not.toBe(
    accentBefore,
  );
  await page.locator(".doNowBand").screenshot({
    path: "dist/visual-qa/v13-nextstep-wishlist/do-now-timer-hover.png",
  });
  await page.mouse.move(0, 0);
  await doNowNormal.focus();
  await expect(doNowNormal.locator(".timerStartDuration")).toHaveCSS("opacity", "1");
  await expect(doNowNormal.locator(".timerStartHoverGlyph")).toHaveCSS("opacity", "1");

  const todayShort = page.locator(".todayRow").first().getByRole("button", {
    name: "短時間タイマー5分で開始",
  });
  const todayNormal = page.locator(".todayRow").first().getByRole("button", {
    name: "通常タイマー25分で開始",
  });
  await expect(todayShort.locator(".nextStepStartDuration")).toHaveText("5分");
  await expect(todayNormal.locator(".nextStepStartDuration")).toHaveText("25分");
  expect((await doNowShort.boundingBox())?.width).toBe(112);
  expect((await todayShort.boundingBox())?.width).toBe(88);
  expect((await doNowShort.boundingBox())?.height).toBe((await todayShort.boundingBox())?.height);
  await expect(todayShort.locator(".nextStepStartDuration")).toHaveCSS("opacity", "1");
  await expect(todayShort.locator(".nextStepStartGlyph")).toHaveCSS("opacity", "0");
  const todayBefore = await todayShort.boundingBox();
  const todayTimeBefore = await todayShort.locator(".nextStepStartDuration").boundingBox();
  await todayShort.hover();
  await expect(todayShort.locator(".nextStepStartDuration")).toHaveCSS("opacity", "1");
  await expect(todayShort.locator(".nextStepStartGlyph")).toHaveCSS("opacity", "1");
  const todayAfter = await todayShort.boundingBox();
  const todayTimeAfter = await todayShort.locator(".nextStepStartDuration").boundingBox();
  expect(todayBefore && todayAfter && todayTimeBefore && todayTimeAfter).toBeTruthy();
  expect(todayTimeBefore!.x + todayTimeBefore!.width / 2 - (todayBefore!.x + todayBefore!.width / 2)).toBeCloseTo(2, 1);
  expect(todayTimeAfter!.x + todayTimeAfter!.width / 2 - (todayAfter!.x + todayAfter!.width / 2)).toBeCloseTo(2, 1);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(todayShort).toHaveCSS("transform", "none");
  await expect(todayShort.locator(".nextStepStartGlyph")).toHaveCSS("transition-duration", "0s");
  await todayShort.click();
  const row = page.locator(".todayRow").first();
  const pause = row.getByRole("button", { name: "このセッションを一時停止" });
  const stop = row.getByRole("button", { name: "終了", exact: true });
  expect((await pause.boundingBox())?.width).toBe((await stop.boundingBox())?.width);
  await expect(stop.locator("svg")).toHaveCount(1);
});
