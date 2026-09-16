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
  await row.getByRole("button", { name: "選ぶ" }).click();

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
    .getByRole("button", { name: "選ぶ" })
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
    .getByRole("button", { name: "選ぶ" })
    .click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("✓ 今日の3件")).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toHaveLength(0);
  await setSaveFailure(page, false);
  await expect(
    dialog
      .locator(".todayPickerRow", { hasText: "5分だけ体を動かす" })
      .getByRole("button", { name: "選ぶ" }),
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
