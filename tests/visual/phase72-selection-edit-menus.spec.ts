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

test("P72-01 lower source menus restore only explicitly excluded stable sources", async ({ page }) => {
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

  const project = page.locator(".nextStepRow").first();
  await project.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "今日へ", exact: true })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "今日の候補に戻す" }).click();
  expect((await currentConfig(page)).today.candidateExcludedSourceKeys).toEqual([
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
  expect((await currentConfig(page)).today.candidateExcludedSourceKeys).toEqual([]);
  await expect(page.locator(".todayRow")).toHaveCount(fixture.config.today.items.length);
});


test("P72-01 empty Today CTA opens Builder and focuses a candidate", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture, 860);
  const empty = page.locator(".focusBand .sectionEmptyActions");
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

test("P72-01 failed restore keeps exclusion and does not show success", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.candidateExcludedSourceKeys = ["project:sample-learning"];
  await prepare(page, fixture);
  await page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { setSaveConfigFailure: (value: boolean) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true),
  );
  await page.locator(".nextStepRow").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "今日の候補に戻す" }).click();
  await expect(page.locator(".toast").last()).toContainText("保存できません");
  expect((await currentConfig(page)).today.candidateExcludedSourceKeys).toEqual([
    "project:sample-learning",
  ]);
  await expect(page.getByText("今日の候補に戻しました", { exact: true })).toHaveCount(0);
});
