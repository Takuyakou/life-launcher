import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type InvokeCall = { command: string; args: Record<string, unknown> };
type VisualQaControl = {
  currentConfig: () => AppConfig;
  invokeCalls: InvokeCall[];
};

function measureFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.today.items[1].done = false;
  fixture.config.today.items.push({
    text: "長い行動文".repeat(18),
    done: false,
    sourceKey: "manual:measure-third",
  });
  return fixture;
}

async function prepare(page: Page, fixture = measureFixture(), width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function calls(page: Page, command: string): Promise<InvokeCall[]> {
  return page.evaluate(
    (name) =>
      (
        window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
      ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === name),
    command,
  );
}

test("P82-03 Measure ticks, pauses, resumes, records and emits elapsed mini state", async ({
  page,
}) => {
  await prepare(page);
  const measure = page.locator(".doNowMeasureButton");
  await expect(measure).toHaveAttribute("title", "時間を決めずに計測");
  await measure.click();
  const dock = page.locator(".timerDock");
  await expect(dock.locator(".timerClock")).toHaveText("00:00");
  await expect(dock.locator(".timerProgress")).toHaveCount(0);
  await expect(page.locator(".doNowContent .runningBadge")).toHaveText("計測中");

  await page.clock.fastForward(65_000);
  await expect(dock.locator(".timerClock")).toHaveText("01:05");
  await page
    .locator(".doNowActions")
    .getByRole("button", { name: "このセッションを一時停止" })
    .click();
  await page.clock.fastForward(120_000);
  await expect(dock.locator(".timerClock")).toHaveText("01:05");
  await page.locator(".doNowActions").getByRole("button", { name: "このセッションを再開" }).click();
  await page.clock.fastForward(5_000);
  await expect(dock.locator(".timerClock")).toHaveText("01:10");

  const miniEvents = await calls(page, "plugin:event|emit");
  expect(
    miniEvents.some((call) => {
    const payload = call.args.payload as { mode?: string; remainingClock?: string } | undefined;
      return (
        call.args.event === "mini-timer-snapshot" &&
        payload?.mode === "measure" &&
        payload.remainingClock === "01:10"
      );
    }),
  ).toBe(true);
  await page.locator(".doNowActions .runningStopButton").click();
  await expect(page.locator(".doNowMeasureButton")).toBeVisible();
  expect((await calls(page, "record_session")).at(-1)?.args.session).toMatchObject({ minutes: 1 });
});

test("P82-03 sub-minute Measure does not record and immediately releases its source", async ({
  page,
}) => {
  await prepare(page);
  const card = page.locator(".todayRow").first();
  await card.locator(".todayMeasureButton").click();
  await page.clock.fastForward(59_000);
  await card.locator(".runningStopButton").click();
  await expect(card.locator(".todayMeasureButton")).toBeVisible();
  expect(await calls(page, "record_session")).toHaveLength(0);
  await expect(page.getByText("1分未満なので記録しませんでした", { exact: true })).toBeVisible();
});

test("P82-03 sub-minute Measure switch skips recording and starts the clicked Timer", async ({
  page,
}) => {
  await prepare(page);
  const cards = page.locator(".todayRow");
  await cards.nth(0).locator(".todayMeasureButton").click();
  await page.clock.fastForward(59_000);
  await cards.nth(1).locator(".todayStartButton--normal").click();
  expect(await calls(page, "record_session")).toHaveLength(0);
  await expect(
    cards.nth(1).getByRole("button", { name: "このセッションを一時停止" }),
  ).toBeVisible();
  await expect(page.getByText("1分未満なので記録しませんでした", { exact: true })).toBeVisible();
});

test("P82-03 Measure and countdown switch in every direction with one active Timer", async ({
  page,
}) => {
  await prepare(page);
  const cards = page.locator(".todayRow");
  await cards.nth(0).locator(".todayMeasureButton").click();
  await page.clock.fastForward(61_000);
  await cards.nth(1).locator(".todayStartButton--short").click();
  await expect(
    cards.nth(1).getByRole("button", { name: "このセッションを一時停止" }),
  ).toBeVisible();
  await page.clock.fastForward(61_000);
  await cards.nth(2).locator(".todayMeasureButton").click();
  await expect(cards.nth(2).locator(".measureElapsedClock")).toHaveText("00:00");
  await page.clock.fastForward(61_000);
  await cards.nth(0).locator(".todayMeasureButton").click();
  await expect(cards.nth(0).locator(".measureElapsedClock")).toHaveText("00:00");
  expect(await calls(page, "record_session")).toHaveLength(3);
  await expect(page.locator(".todayTimerActions--running")).toHaveCount(1);
});

test("P82-03 Measure manual end reuses Today3 early completion", async ({ page }) => {
  await prepare(page);
  const card = page.locator(".todayRow").first();
  await card.locator(".todayMeasureButton").click();
  await page.clock.fastForward(300_000);
  await card.locator(".runningStopButton").click();
  await expect(page.getByRole("button", { name: "未完了のまま終了" })).toBeFocused();
  expect(await calls(page, "record_session")).toHaveLength(0);
  await page.getByRole("button", { name: "未完了のまま終了" }).click();
  expect((await calls(page, "record_session")).at(-1)?.args.session).toMatchObject({ minutes: 5 });
  const config = await page.evaluate(() =>
    (
    window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
  expect(config.today.items[0].done).toBe(false);
});

async function expectControlsFit(container: Locator) {
  const bounds = await container.boundingBox();
  expect(bounds).not.toBeNull();
  const controls = await container.locator("button:visible").evaluateAll((nodes) =>
    nodes.map((node) => {
      const box = node.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom };
    }),
  );
  expect(controls.length).toBeGreaterThan(0);
  for (let index = 0; index < controls.length; index += 1) {
    const box = controls[index];
    expect(box.left).toBeGreaterThanOrEqual(bounds!.x - 1);
    expect(box.right).toBeLessThanOrEqual(bounds!.x + bounds!.width + 1);
    expect(box.top).toBeGreaterThanOrEqual(bounds!.y - 1);
    expect(box.bottom).toBeLessThanOrEqual(bounds!.y + bounds!.height + 1);
    for (const other of controls.slice(index + 1)) {
      expect(
        Math.min(box.right, other.right) - Math.max(box.left, other.left) > 1 &&
        Math.min(box.bottom, other.bottom) - Math.max(box.top, other.top) > 1,
      ).toBe(false);
    }
  }
}

for (const [width, columns] of [
  [1440, 3],
  [1000, 2],
  [860, 1],
] as const) {
  test(`P82-03 Measure layout stays bounded in ${columns} column mode at ${width}`, async ({
    page,
  }) => {
    await prepare(page, measureFixture(), width);
    const card = page.locator(".todayRow").first();
    const inactiveHeight = await card.evaluate((node) => (node as HTMLElement).offsetHeight);
    await expect(card.locator(".todayMeasureButton")).toHaveAttribute(
      "title",
      "時間を決めずに計測",
    );
    await expect(card.getByRole("button", { name: /手順書を開く/ })).toBeVisible();

    const timerButton = card.locator(".todayStartButton--short");
    const underlineBefore = await timerButton.evaluate(
      (node) => getComputedStyle(node, "::after").transform,
    );
    await timerButton.hover();
    await page.waitForTimeout(180);
    const underlineAfter = await timerButton.evaluate(
      (node) => getComputedStyle(node, "::after").transform,
    );
    expect(underlineAfter).not.toBe(underlineBefore);

    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
    expect(await page.locator(".todayGrid").evaluate((node) =>
      getComputedStyle(node).gridTemplateColumns.split(" ").length,
    )).toBe(columns);
    for (const container of [card, page.locator(".doNowContent")]) {
      await expectControlsFit(container);
    }
    const hoverControls = [
      card.locator(".todayStartButton--short"),
      card.locator(".todayStartButton--normal"),
      card.locator(".todayMeasureButton"),
      card.locator(".todayInstructionButton"),
      card.locator(".todayRemoveButton"),
      page.locator(".doNowStartPrimary"),
      page.locator(".doNowStartSecondary"),
      page.locator(".doNowMeasureButton"),
    ];
    for (const button of hoverControls) {
      await expect(button).toBeVisible();
      const before = await button.evaluate((node) => ({
        width: (node as HTMLElement).offsetWidth,
        height: (node as HTMLElement).offsetHeight,
      }));
      await button.hover();
      expect(await button.evaluate((node) => ({
        width: (node as HTMLElement).offsetWidth,
        height: (node as HTMLElement).offsetHeight,
      }))).toEqual(before);
    }
    await card.locator(".todayMeasureButton").focus();
    await expect(card.locator(".todayMeasureButton")).toBeFocused();
    await card.locator(".todayMeasureButton").press("Enter");
    await page.clock.fastForward(5_000);
    const measureActions = card.locator(".todayTimerActions--measure");
    const pause = card.getByRole("button", { name: "このセッションを一時停止" });
    const stop = card.getByRole("button", { name: "終了", exact: true });
    await expect(pause).toHaveText("停止");
    await expect(stop).toHaveText("終了");
    await expect(card.locator(".measureElapsedClock")).toHaveText("00:05");
    await expect(measureActions).toBeVisible();
    await expectControlsFit(card);
    const activeHeight = await card.evaluate((node) => (node as HTMLElement).offsetHeight);
    expect(activeHeight).toBe(inactiveHeight);
  });
}
