import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture, width = 1280) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".focusBand")).toBeVisible();
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

async function setSaveFailure(page: Page, shouldFail: boolean) {
  await page.evaluate((value) => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          setSaveConfigFailure: (next: boolean) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(value);
  }, shouldFail);
}

function picker(page: Page) {
  return page.getByRole("dialog", { name: "今日やるものを選ぶ" });
}

for (const count of [0, 1, 2]) {
  test(`P84-01 Today ${count}/3 exposes the Picker entry and removes the permanent Builder`, async ({
    page,
  }) => {
    const fixture = createPublicFixture();
    fixture.config.today.items = fixture.config.today.items.slice(0, count);
    await prepare(page, fixture);

    await expect(page.locator(".todayBuilderBand")).toHaveCount(0);
    const entry = page.getByRole("button", { name: "今日やるものを選ぶ" });
    await expect(entry).toBeVisible();
    await entry.click();
    await expect(picker(page)).toBeVisible();
  });
}

test("P84 Picker entry matches Today card height in the two-column small window", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 2);
  await prepare(page, fixture, 1000);

  const card = page.locator(".todayRow").first();
  const entry = page.locator(".todayPickerEntry");
  const visual = entry.locator(".todayPickerEntryVisual");
  const cardBox = await card.boundingBox();
  const entryBox = await entry.boundingBox();
  const visualBox = await visual.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(entryBox).not.toBeNull();
  expect(visualBox).not.toBeNull();
  expect(entryBox!.height).toBeGreaterThanOrEqual(154);
  expect(Math.abs(entryBox!.height - cardBox!.height)).toBeLessThanOrEqual(2);
  expect(visualBox!.width).toBeLessThan(entryBox!.width * 0.6);
  expect(visualBox!.height).toBeLessThan(entryBox!.height);

  await entry.click({ position: { x: 8, y: 8 } });
  await expect(picker(page)).toBeVisible();
});

test("P84-01 Today 3/3 does not expose the Picker entry", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items.push({
    text: "満杯の確認",
    done: false,
    sourceKey: "manual:full",
  });
  await prepare(page, fixture);

  await expect(page.getByRole("button", { name: "今日やるものを選ぶ" })).toHaveCount(0);
  await expect(page.locator(".todayBuilderBand")).toHaveCount(0);
});

test("P84-01 Picker shows NextStep and Wishlist candidates and ignores legacy dismissal", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.today.candidateExcludedSourceKeys = [
    "project:sample-stretch",
    "wishlist:sample-later",
  ];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  await expect(dialog.getByRole("heading", { name: "次の一手" })).toBeVisible();
  await expect(dialog.getByRole("heading", { name: "やりたいこと" })).toBeVisible();
  await expect(dialog).toContainText("5分だけ体を動かす");
  await expect(dialog).toContainText("あとで確認するサンプル");
});

test("P84 Picker groups Wishlist by project, starts expanded, and uses a danger cancel", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.inbox.push({
    id: "sample-weekend-2",
    text: "同じプロジェクトの候補",
    projectId: "sample-learning",
  });
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const projectGroup = dialog.locator(
    '[data-today-picker-wishlist-group="project:sample-learning"]',
  );
  const header = projectGroup.locator(".todayPickerWishlistGroupHeader");
  await expect(header).toHaveAttribute("aria-expanded", "true");
  await expect(projectGroup.locator(".todayPickerRow")).toHaveCount(2);
  await expect(header).toContainText("サンプル学習");
  await expect(header).toContainText("2件");

  await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "false");
  await expect(projectGroup.locator(".todayPickerRow")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "キャンセル" })).toHaveClass(/dangerButton/);
});

test("P84-01 selection preserves source and snapshot while marking the candidate selected", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  const source = fixture.config.projects.find((project) => project.id === "sample-learning")!;
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const row = dialog.locator(".todayPickerRow", { hasText: source.nextStep!.text });
  await row.getByRole("button", { name: "今日へ" }).click();

  await expect(row.getByText("✓ 今日の3件")).toBeVisible();
  const config = await currentConfig(page);
  expect(config.projects.find((project) => project.id === source.id)?.nextStep?.text).toBe(
    source.nextStep!.text,
  );
  expect(config.today.items[0]).toMatchObject({
    text: source.nextStep!.text,
    sourceKey: `project:${source.id}`,
    projectId: source.id,
    trigger: source.nextStep!.trigger,
    buttonIds: source.nextStep!.buttonIds,
    instructionPath: source.nextStep!.instructionPath,
    instructionOpenOnStart: false,
    defaultTimerMinutes: source.nextStep!.defaultTimerMinutes,
    shortTimerMinutes: source.nextStep!.shortTimerMinutes,
  });
});

test("P84-01 reaching 3/3 closes the Picker and prevents duplicate selection", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);

  const entry = page.getByRole("button", { name: "今日やるものを選ぶ" });
  await entry.click();
  const dialog = picker(page);
  await expect(dialog.getByText("✓ 今日の3件")).toHaveCount(1);
  await dialog
    .locator(".todayPickerRow", { hasText: "5分だけ体を動かす" })
    .getByRole("button", { name: "今日へ" })
    .click();

  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".todayRow")).toHaveCount(3);
  expect((await currentConfig(page)).today.items).toHaveLength(3);
});

test("P84-01 save failure rolls back and leaves the Picker usable", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  await setSaveFailure(page, true);
  await dialog
    .locator(".todayPickerRow", { hasText: "5分だけ体を動かす" })
    .getByRole("button", { name: "今日へ" })
    .click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("✓ 今日の3件")).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toHaveLength(0);
  await setSaveFailure(page, false);
  await expect(
    dialog
      .locator(".todayPickerRow", { hasText: "5分だけ体を動かす" })
      .getByRole("button", { name: "今日へ" }),
  ).toBeEnabled();
});

test("P84-01 Escape closes the Picker and returns focus to its entry", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  const entry = page.getByRole("button", { name: "今日やるものを選ぶ" });
  await entry.focus();
  await entry.press("Enter");
  const dialog = picker(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "今日やるものを選ぶを閉じる" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(entry).toBeFocused();
});

test("P84 Picker aligns project, task, and action columns with readable long content", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].name = "とても長いプロジェクト名を表示幅の中で安全に省略する確認用";
  fixture.config.inbox[0].text =
    "長い候補名でもタスク列と操作列が重ならず二行まで読めることを確認する";
  await prepare(page, fixture, 1280);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const taskXs = await dialog
    .locator(".todayPickerCopy strong")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().x));
  expect(Math.max(...taskXs) - Math.min(...taskXs)).toBeLessThanOrEqual(1);
  const actionRights = await dialog
    .locator(".todayPickerRow > button, .todayPickerSelectedStatus")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().right));
  expect(Math.max(...actionRights) - Math.min(...actionRights)).toBeLessThanOrEqual(1);
  await expect(dialog.locator(".todayPickerRow").first()).toHaveCSS("min-height", "54px");
  await dialog.screenshot({ path: "dist/visual-qa/phase84/picker-aligned-1280.png" });
});

test("P84 Picker selection preserves collapsed Wishlist groups", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const projectHeader = dialog
    .locator('[data-today-picker-wishlist-group="project:sample-learning"]')
    .locator(".todayPickerWishlistGroupHeader");
  await projectHeader.click();
  await expect(projectHeader).toHaveAttribute("aria-expanded", "false");

  const row = dialog.locator(".todayPickerRow", { hasText: "5分だけ体を動かす" });
  await row.getByRole("button", { name: "今日へ" }).click();
  await expect(row.getByText("✓ 今日の3件")).toBeVisible();
  await expect(projectHeader).toHaveAttribute("aria-expanded", "false");
  expect((await currentConfig(page)).today.items).toHaveLength(1);
});

test("P84 Picker remains contained and keeps actions visible at narrow width", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.projects[0].name = "長いプロジェクト名の狭幅表示確認";
  await prepare(page, fixture, 520);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const dialogBox = await dialog.boundingBox();
  const actionBoxes = await dialog
    .locator(".todayPickerRow > button")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
  expect(dialogBox).not.toBeNull();
  expect(actionBoxes.every((box) => box.right <= dialogBox!.x + dialogBox!.width + 1)).toBe(true);
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await dialog.screenshot({ path: "dist/visual-qa/phase84/picker-narrow-520.png" });
});
