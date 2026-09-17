import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 1000 });
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

function picker(page: Page) {
  return page.getByRole("dialog", { name: "今日やるものを選ぶ" });
}

async function selectCandidate(page: Page, text: string) {
  const row = picker(page).locator(".todayPickerRow", { hasText: text });
  await row.getByRole("button", { name: "今日へ" }).click();
  return picker(page).locator('[data-today-picker-section="selected"] .todayPickerRow', {
    hasText: text,
  });
}

async function dragToRemoveZone(page: Page, row: Locator) {
  const handle = row.locator(".todayTextButton");
  const from = await handle.boundingBox();
  expect(from).not.toBeNull();
  const x = from!.x + Math.min(80, from!.width * 0.4);
  const y = from!.y + from!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y, { steps: 2 });
  const zone = page.locator(".todayRemoveDropZone");
  await expect(zone).toContainText("↓ ここにドロップして今日の3件から外す");
  const target = await zone.boundingBox();
  expect(target).not.toBeNull();
  await page.mouse.move(target!.x + target!.width / 2, target!.y + target!.height / 2, {
    steps: 5,
  });
  await expect(zone).toHaveClass(/todayRemoveDropZone--active/);
  await page.mouse.up();
}

test("P84-04 empty Today selects NextStep then Wishlist while preserving sources and snapshots", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.today.candidateExcludedSourceKeys = [
    "project:sample-learning",
    "wishlist:sample-later",
  ];
  const projectsBefore = structuredClone(fixture.config.projects);
  const inboxBefore = structuredClone(fixture.config.inbox);
  await prepare(page, fixture);

  await expect(page.locator(".todayBuilderBand")).toHaveCount(0);
  const entry = page.getByRole("button", { name: "今日やるものを選ぶ" });
  await entry.click();
  await expect(picker(page).getByRole("tab", { name: /^次の一手/ })).toBeVisible();
  await expect(picker(page).getByRole("tab", { name: /^やりたいこと/ })).toBeVisible();

  const nextStepText = projectsBefore[0].nextStep!.text;
  const nextStepRow = await selectCandidate(page, nextStepText);
  await expect(nextStepRow.getByText("✓ 選択済み")).toBeVisible();
  await picker(page).getByRole("button", { name: "決定", exact: true }).click();
  await expect(page.locator(".todayRow")).toHaveCount(1);

  await entry.click();
  await expect(
    picker(page)
      .locator('[data-today-picker-section="selected"] .todayPickerRow', {
        hasText: nextStepText,
      })
      .getByText("✓ 選択済み"),
  ).toBeVisible();
  const wishlistText = inboxBefore[0].text;
  await picker(page).getByRole("tab", { name: /^やりたいこと/ }).click();
  const wishlistRow = await selectCandidate(page, wishlistText);
  await expect(wishlistRow.getByText("✓ 選択済み")).toBeVisible();

  let saved = await currentConfig(page);
  expect(saved.projects).toEqual(projectsBefore);
  expect(saved.inbox).toEqual(inboxBefore);
  expect(saved.today.items).toHaveLength(2);
  expect(saved.today.items[0]).toMatchObject({
    sourceKey: `project:${projectsBefore[0].id}`,
    text: nextStepText,
    projectId: projectsBefore[0].id,
    trigger: projectsBefore[0].nextStep!.trigger,
    buttonIds: projectsBefore[0].nextStep!.buttonIds,
    instructionPath: projectsBefore[0].nextStep!.instructionPath,
    defaultTimerMinutes: projectsBefore[0].nextStep!.defaultTimerMinutes,
    shortTimerMinutes: projectsBefore[0].nextStep!.shortTimerMinutes,
  });
  expect(saved.today.items[1]).toMatchObject({
    sourceKey: `wishlist:${inboxBefore[0].id}`,
    text: wishlistText,
  });
  expect(new Set(saved.today.items.map((item) => item.sourceKey)).size).toBe(2);

  await picker(page).getByRole("tab", { name: /^次の一手/ }).click();
  await selectCandidate(page, projectsBefore[1].nextStep!.text);
  await expect(picker(page)).toHaveCount(0);
  await expect(page.locator(".todayRow")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "今日やるものを選ぶ", exact: true })).toHaveCount(
    0,
  );
  saved = await currentConfig(page);
  expect(saved.today.items).toHaveLength(3);
  expect(new Set(saved.today.items.map((item) => item.sourceKey)).size).toBe(3);
});

for (const source of [
  { name: "NextStep", index: 0 },
  { name: "Wishlist", index: 1 },
]) {
  test(`P84-04 ${source.name} removal Drop Zone preserves source and Undo restores adoption`, async ({
    page,
  }) => {
    const fixture = createPublicFixture();
    fixture.config.today.items = [
      { ...fixture.config.today.items[0] },
      {
        text: fixture.config.inbox[0].text,
        done: false,
        sourceKey: `wishlist:${fixture.config.inbox[0].id}`,
      },
    ];
    await prepare(page, fixture);
    const before = await currentConfig(page);
    const sourceKey = before.today.items[source.index].sourceKey;

    await dragToRemoveZone(page, page.locator(".todayRow").nth(source.index));
    await expect(page.locator(".todayRow")).toHaveCount(1);
    let saved = await currentConfig(page);
    expect(saved.today.items.some((item) => item.sourceKey === sourceKey)).toBe(false);
    expect(saved.projects).toEqual(before.projects);
    expect(saved.inbox).toEqual(before.inbox);

    await page
      .locator(".toast", { hasText: "今日の3件から外しました" })
      .getByRole("button", { name: "元に戻す" })
      .click();
    await expect(page.locator(".todayRow")).toHaveCount(2);
    saved = await currentConfig(page);
    expect(saved.today.items.map((item) => item.sourceKey)).toEqual(
      before.today.items.map((item) => item.sourceKey),
    );
    expect(saved.projects).toEqual(before.projects);
    expect(saved.inbox).toEqual(before.inbox);
  });
}

test("P84-04 Do Now remains available with zero focus and reaches non-focus candidates", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.projects.forEach((project) => {
    project.weeklyFocus = undefined;
  });
  fixture.doNowCandidates = fixture.config.projects.map((project, index) => ({
    projectId: project.id,
    reason: index === 0 ? "noToday" : "oldestSession",
    restartEligible: false,
  }));
  await prepare(page, fixture);

  const action = page.locator(".doNowCopy > strong");
  await expect(action).toHaveText(fixture.config.projects[0].nextStep!.text);
  await page.getByRole("button", { name: "他の一手", exact: true }).click();
  await expect(action).toHaveText(fixture.config.projects[1].nextStep!.text);
});

test("P84-04 mixed focus ranks the focus Project first and Other Step reaches focus-OFF", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].weeklyFocus = false;
  fixture.config.projects[1].weeklyFocus = true;
  fixture.doNowCandidates = [
    { projectId: fixture.config.projects[1].id, reason: "noToday", restartEligible: false },
    { projectId: fixture.config.projects[0].id, reason: "noToday", restartEligible: false },
  ];
  await prepare(page, fixture);

  const action = page.locator(".doNowCopy > strong");
  await expect(action).toHaveText(fixture.config.projects[1].nextStep!.text);
  await expect(page.locator(".doNowReason")).toContainText("今週の重点");
  await page.getByRole("button", { name: "他の一手", exact: true }).click();
  await expect(action).toHaveText(fixture.config.projects[0].nextStep!.text);
});
