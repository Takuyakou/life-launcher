import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type Control = {
  currentConfig: () => AppConfig;
  setSaveConfigFailure: (failed: boolean) => void;
};

function dropFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.today.items = [
    { ...fixture.config.today.items[0] },
    {
      text: fixture.config.inbox[0].text,
      done: false,
      sourceKey: "wishlist:sample-later",
      projectId: fixture.config.inbox[0].projectId,
    },
    { ...fixture.config.today.items[1] },
  ];
  return fixture;
}

async function prepare(page: Page, fixture = dropFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".todayRow")).toHaveCount(fixture.config.today.items.length);
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: Control;
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function beginTodayDrag(page: Page, row: Locator, distance = 12) {
  const body = row.locator(".todayTextButton");
  const box = await body.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + Math.min(80, box!.width * 0.45);
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + distance, y, { steps: 2 });
}

async function dropOnRemoveZone(page: Page, row: Locator) {
  await beginTodayDrag(page, row);
  const zone = page.locator(".todayRemoveDropZone");
  await expect(zone).toBeVisible();
  const box = await zone.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 5 });
  await expect(zone).toHaveClass(/todayRemoveDropZone--active/);
  await page.mouse.up();
}

test("P84-02 remove Drop Zone stays hidden until the actual drag threshold and Escape hides it", async ({
  page,
}) => {
  await prepare(page);
  const row = page.locator(".todayRow").first();
  const body = row.locator(".todayTextButton");
  const box = await body.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + Math.min(80, box!.width * 0.45);
  const y = box!.y + box!.height / 2;

  await expect(page.locator(".todayRemoveDropZone")).toHaveCount(0);
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 4, y);
  await expect(page.locator(".todayRemoveDropZone")).toHaveCount(0);
  await page.mouse.move(x + 12, y);
  await expect(page.locator(".todayRemoveDropZone")).toContainText(
    "↓ ここにドロップして今日の3件から外す",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".todayRemoveDropZone")).toHaveCount(0);
  await expect(page.locator(".todayRow")).toHaveCount(3);
});

for (const source of [
  { name: "NextStep", index: 0 },
  { name: "Wishlist", index: 1 },
]) {
  test("P84-02 " + source.name + " drop removes only Today adoption and Undo restores only Today", async ({
    page,
  }) => {
    const fixture = dropFixture();
    await prepare(page, fixture);
    const before = await currentConfig(page);
    const sourceKey = before.today.items[source.index].sourceKey;

    await dropOnRemoveZone(page, page.locator(".todayRow").nth(source.index));

    await expect(page.locator(".todayRemoveDropZone")).toHaveCount(0);
    await expect(page.locator(".todayRow")).toHaveCount(2);
    let after = await currentConfig(page);
    expect(after.today.items.some((item) => item.sourceKey === sourceKey)).toBe(false);
    expect(after.projects).toEqual(before.projects);
    expect(after.inbox).toEqual(before.inbox);
    expect(after.sourceCompletions).toEqual(before.sourceCompletions);

    const toast = page.locator(".toast", { hasText: "今日の3件から外しました" });
    await expect(toast).toBeVisible();
    await toast.getByRole("button", { name: "元に戻す" }).click();
    await expect(page.locator(".todayRow")).toHaveCount(3);
    after = await currentConfig(page);
    expect(after.today.items.map((item) => item.sourceKey)).toEqual(
      before.today.items.map((item) => item.sourceKey),
    );
    expect(after.projects).toEqual(before.projects);
    expect(after.inbox).toEqual(before.inbox);
  });
}

test("P84-02 save failure rolls the dropped card back and closes the Drop Zone", async ({ page }) => {
  await prepare(page);
  const before = await currentConfig(page);
  await page.evaluate(() => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: Control;
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true);
  });

  await dropOnRemoveZone(page, page.locator(".todayRow").nth(1));

  await expect(page.locator(".todayRemoveDropZone")).toHaveCount(0);
  await expect(page.locator(".todayRow")).toHaveCount(3);
  await expect(page.locator(".toast").last()).toContainText("保存できません");
  expect(await currentConfig(page)).toEqual(before);
});

test("P84-02 running and paused Today items cannot activate or use the Drop Zone", async ({
  page,
}) => {
  await prepare(page);
  const row = page.locator(".todayRow").first();
  await row.getByRole("button", { name: /短時間タイマー5分で開始/ }).click();

  for (const paused of [false, true]) {
    if (paused) {
      await row.getByRole("button", { name: "このセッションを一時停止" }).click();
    }
    await beginTodayDrag(page, row);
    const zone = page.locator(".todayRemoveDropZone");
    await expect(zone).toBeVisible();
    await expect(zone).toHaveAttribute("aria-disabled", "true");
    const box = await zone.boundingBox();
    expect(box).not.toBeNull();
    await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2, { steps: 4 });
    await expect(zone).not.toHaveClass(/todayRemoveDropZone--active/);
    await page.mouse.up();
    await expect(page.locator(".todayRow")).toHaveCount(3);
    await expect(row).toHaveClass(/todayRow--running/);
  }
});

test("P84-02 invalid drop keeps Today unchanged and normal Today reorder still works", async ({
  page,
}) => {
  await prepare(page);
  const before = await currentConfig(page);
  const first = page.locator(".todayRow").first();
  await beginTodayDrag(page, first);
  const projects = await page.locator(".projectsBand").boundingBox();
  expect(projects).not.toBeNull();
  await page.mouse.move(projects!.x + 20, projects!.y + 20, { steps: 4 });
  await page.mouse.up();
  expect((await currentConfig(page)).today.items).toEqual(before.today.items);

  const source = page.locator(".todayRow").first();
  const target = page.locator(".todayRow").nth(2);
  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await beginTodayDrag(page, source);
  await page.mouse.move(
    targetBox!.x + targetBox!.width * 0.8,
    targetBox!.y + targetBox!.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(page.locator(".todayTextButton")).toHaveText([
    before.today.items[1].text,
    before.today.items[2].text,
    before.today.items[0].text,
  ]);
});

test("P84-02 completed card and keyboard context fallback share the remove handler", async ({
  page,
}) => {
  const fixture = dropFixture();
  fixture.config.today.items[0].done = true;
  await prepare(page, fixture);
  const first = page.locator(".todayRow").first();
  await dropOnRemoveZone(page, first);
  await expect(page.locator(".todayRow")).toHaveCount(2);

  const remaining = page.locator(".todayRow").first();
  await remaining.focus();
  await page.keyboard.press("Shift+F10");
  const remove = page.getByRole("menuitem", { name: "今日の3件から外す" });
  await expect(remove).toBeVisible();
  await remove.click();
  await expect(page.locator(".todayRow")).toHaveCount(1);
});
