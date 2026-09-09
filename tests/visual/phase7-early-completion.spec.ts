import { expect, test, type Page } from "@playwright/test";
import { earlyCompletionItem, earlyCompletionThresholdSeconds } from "../../src/earlyCompletion";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type Control = {
  currentConfig: () => AppConfig;
  updateConfig: (config: AppConfig) => void;
  setSaveConfigFailure: (fail: boolean) => void;
  setRecordSessionFailure: (fail: boolean) => void;
  emit: (event: string, payload: unknown) => void;
  invokeCalls: { command: string; args: Record<string, unknown> }[];
};
const dialogName = "今日の分は完了にしますか？";

function fixtureForEarly(completed = 0) {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  project.shortTimerMinutes = 3;
  fixture.config.today.items = [
    {
      text: project.nextStep,
      done: false,
      sourceKey: `project:${project.id}`,
      projectId: project.id,
      shortTimerMinutes: 3,
      defaultTimerMinutes: 25,
    },
    {
      text: "Wishlist audit",
      done: completed >= 1,
      sourceKey: "wishlist:sample-later",
      shortTimerMinutes: 3,
      defaultTimerMinutes: 25,
    },
    {
      text: "Third audit",
      done: completed >= 2,
      sourceKey: "manual:third",
      shortTimerMinutes: 3,
      defaultTimerMinutes: 25,
    },
  ];
  return fixture;
}

async function prepare(page: Page, fixture = fixtureForEarly()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function state(page: Page) {
  return page.evaluate(() => {
    const c = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    return {
      config: c.currentConfig(),
      records: c.invokeCalls.filter((call) => call.command === "record_session"),
      calls: c.invokeCalls,
    };
  });
}

async function stopAtThreshold(page: Page, index = 0) {
  const card = page.locator(".todayRow").nth(index);
  await card.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.fastForward(180_000);
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await card.getByRole("button", { name: "終了", exact: true }).click();
  await expect(page.getByRole("dialog", { name: dialogName })).toBeVisible();
}

test("threshold uses validated snapshot minutes and defensive fallback, never a ratio", () => {
  for (const [snapshot, seconds] of [
    [1, 60],
    [2, 120],
    [3, 180],
    [5, 300],
    [10, 300],
    [240, 300],
  ]) {
    expect(earlyCompletionThresholdSeconds(snapshot)).toBe(seconds);
  }
  for (const invalid of [undefined, null, 0, -1, 241, 1.5, "3", NaN, Infinity]) {
    expect(earlyCompletionThresholdSeconds(invalid)).toBe(300);
  }
  const items = fixtureForEarly().config.today.items;
  const id = items[0].projectId!;
  const timer = { sourceId: id, projectId: id, targetMinutes: 25 };
  expect(earlyCompletionItem(items, timer, 179)).toBeUndefined();
  expect(earlyCompletionItem(items, timer, 180)).toBe(items[0]);
  expect(earlyCompletionItem([...items].reverse(), timer, 180)).toBe(items[0]);
  expect(earlyCompletionItem(items, timer, 1500)).toBeUndefined();
  expect(
    earlyCompletionItem(
      items,
      { ...timer, sourceId: "not-adopted", projectId: "not-adopted" },
      600,
    ),
  ).toBeUndefined();
  expect(earlyCompletionItem([{ ...items[0], done: true }], timer, 600)).toBeUndefined();
  expect(earlyCompletionItem([items[0], items[0]], timer, 600)).toBeUndefined();
});

for (const action of ["left", "right", "escape"]) {
  test(`early ${action} preserves sources and order, records once without dialog wait time`, async ({
    page,
  }) => {
    await prepare(page);
    const before = await state(page);
    await stopAtThreshold(page);
    await expect(page.getByRole("button", { name: "未完了のまま終了" })).toBeFocused();
    await page.clock.fastForward(600_000);
    if (action === "escape") await page.keyboard.press("Escape");
    else
      await page
        .getByRole("button", {
          name: action === "left" ? "今日の分は完了" : "未完了のまま終了",
          exact: true,
        })
        .press("Enter");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    const after = await state(page);
    expect(after.records).toHaveLength(1);
    expect(after.records[0].args.session).toMatchObject({ minutes: 3 });
    expect(after.config.today.items).toEqual(
      before.config.today.items.map((item, index) =>
        index === 0 ? { ...item, done: action === "left" } : item,
      ),
    );
    expect(after.config.projects).toEqual(before.config.projects);
    expect(after.config.inbox).toEqual(before.config.inbox);
    expect(after.config.sourceCompletions).toEqual(before.config.sourceCompletions);
    expect(after.config.today.candidateExcludedSourceKeys).toEqual(
      before.config.today.candidateExcludedSourceKeys,
    );
    expect(after.calls.filter((c) => /delete.*session/.test(c.command))).toHaveLength(0);
    await page.reload();
    expect((await state(page)).config.today.items).toEqual(after.config.today.items);
  });
}

for (const completed of [1, 2]) {
  test(`early completion with ${completed} previously completed keeps manual batch rules`, async ({
    page,
  }) => {
    await prepare(page, fixtureForEarly(completed));
    await stopAtThreshold(page);
    await page.getByRole("button", { name: "今日の分は完了", exact: true }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("button", { name: /次の3件を選ぶ/ })).toHaveCount(
      completed === 2 ? 1 : 0,
    );
    await expect(page.locator(".todayRow")).toHaveCount(3);
  });
}

test("adopted snapshot survives Project change and Do Now maps to the adopted item", async ({
  page,
}) => {
  await prepare(page);
  await page.evaluate(() => {
    const c = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    const next = c.currentConfig();
    next.projects[0].shortTimerMinutes = 10;
    c.updateConfig(next);
  });
  await expect(
    page.locator(".todayRow").first().getByRole("button", { name: "短時間タイマー3分で開始" }),
  ).toBeVisible();
  await page.locator(".doNowStartSecondary").click();
  await page.clock.fastForward(180_000);
  await page.locator(".doNowBand").getByRole("button", { name: "終了", exact: true }).click();
  await expect(page.getByRole("dialog", { name: dialogName })).toBeVisible();
  await page.getByRole("button", { name: "今日の分は完了", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).config.today.items[0]).toMatchObject({
    done: true,
    shortTimerMinutes: 3,
  });
});

test("Do Now without Today adoption records without early dialog", async ({ page }) => {
  const fixture = fixtureForEarly();
  fixture.config.today.items = [];
  await prepare(page, fixture);
  await page.locator(".doNowStartSecondary").click();
  await page.clock.fastForward(600_000);
  await page.locator(".doNowBand").getByRole("button", { name: "終了", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).records).toHaveLength(1);
});

test("Wishlist direct identity does not complete the associated Project adoption", async ({
  page,
}) => {
  const fixture = fixtureForEarly();
  fixture.config.today.items[1].projectId = fixture.config.projects[0].id;
  await prepare(page, fixture);
  await stopAtThreshold(page, 1);
  await page.getByRole("button", { name: "今日の分は完了", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).config.today.items.map((item) => item.done)).toEqual([
    false,
    true,
    false,
  ]);
});

test("failed Today save rolls back Today only while retaining the Session", async ({ page }) => {
  await prepare(page);
  const before = await state(page);
  await stopAtThreshold(page);
  await page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true),
  );
  await page.getByRole("button", { name: "今日の分は完了", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await state(page);
  expect(after.records).toHaveLength(1);
  expect(after.config.today).toEqual(before.config.today);
  await expect(page.locator(".toast").last()).toContainText("保存");
  await page.reload();
  expect((await state(page)).config.today).toEqual(before.config.today);
});

test("Session failure keeps the frozen dialog for retry, without marking Today done", async ({
  page,
}) => {
  await prepare(page);
  await stopAtThreshold(page);
  await page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setRecordSessionFailure(true),
  );
  await page.getByRole("button", { name: "今日の分は完了", exact: true }).click();
  await expect(page.locator(".toast").last()).toContainText("記録できません");
  expect((await state(page)).config.today.items[0].done).toBe(false);
  await page.clock.fastForward(600_000);
  await page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setRecordSessionFailure(false),
  );
  await page.getByRole("button", { name: "今日の分は完了", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const after = await state(page);
  expect(after.records).toHaveLength(2);
  expect(after.records[1].args.session).toMatchObject({ minutes: 3 });
  expect(after.config.today.items[0].done).toBe(true);
});

test("double handler dispatch cannot record twice; composing Enter and backdrop do not submit", async ({
  page,
}) => {
  await prepare(page);
  await stopAtThreshold(page);
  await page
    .getByRole("button", { name: "未完了のまま終了" })
    .dispatchEvent("keydown", { key: "Enter", isComposing: true });
  await page.locator(".confirmBackdrop").click({ position: { x: 3, y: 3 } });
  await expect(page.getByRole("dialog", { name: dialogName })).toBeVisible();
  expect((await state(page)).records).toHaveLength(0);
  await page.getByRole("button", { name: "今日の分は完了", exact: true }).evaluate((node) => {
    const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"))!;
    const props = (node as unknown as Record<string, { onClick: () => void }>)[key];
    props.onClick();
    props.onClick();
  });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).records).toHaveLength(1);
});

test("switch skips early confirmation and a stale stop cannot stop a restarted source", async ({
  page,
}) => {
  await prepare(page);
  const first = page.locator(".todayRow").first();
  await first.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await first.getByRole("button", { name: "終了", exact: true }).evaluate((node) => {
    const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"))!;
    (window as Window & { p7OldStop?: () => void }).p7OldStop = (
      node as unknown as Record<string, { onClick: () => void }>
    )[key].onClick;
  });
  await page.clock.fastForward(180_000);
  await page
    .locator(".todayRow")
    .nth(1)
    .getByRole("button", { name: "通常タイマー25分で開始" })
    .click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await first.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.evaluate(() => (window as Window & { p7OldStop?: () => void }).p7OldStop?.());
  await expect(first.getByText("実行中", { exact: true })).toBeVisible();
  expect((await state(page)).records).toHaveLength(1);
});

test("extension uses the current planned duration instead of the original snapshot", async ({
  page,
}) => {
  const fixture = fixtureForEarly();
  fixture.config.today.items[0].defaultTimerMinutes = 3;
  await prepare(page, fixture);
  const card = page.locator(".todayRow").first();
  await card.getByRole("button", { name: "通常タイマー3分で開始" }).click();
  await page.clock.fastForward(180_000);
  await page.getByRole("button", { name: "続ける(+15分)", exact: true }).click();
  await card.getByRole("button", { name: "終了", exact: true }).click();
  await expect(page.getByRole("dialog", { name: dialogName })).toBeVisible();
  await page.getByRole("button", { name: "未完了のまま終了" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).records).toHaveLength(1);
});

test("paused time cannot cross the early threshold, resume can", async ({ page }) => {
  await prepare(page);
  const card = page.locator(".todayRow").first();
  await card.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.fastForward(179_000);
  await card.getByRole("button", { name: "このセッションを一時停止" }).click();
  await page.clock.fastForward(600_000);
  await card.getByRole("button", { name: "このセッションを再開" }).click();
  await page.clock.fastForward(1_000);
  await card.getByRole("button", { name: "終了", exact: true }).click();
  await expect(page.getByRole("dialog", { name: dialogName })).toBeVisible();
  await page.getByRole("button", { name: "未完了のまま終了" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect((await state(page)).records[0].args.session).toMatchObject({ minutes: 3 });
});

test("missing runtime short snapshot uses five minutes, not the live Project short", async ({
  page,
}) => {
  const fixture = fixtureForEarly();
  fixture.config.today.items[0].shortTimerMinutes = undefined;
  fixture.config.projects[0].shortTimerMinutes = 1;
  await prepare(page, fixture);
  const card = page.locator(".todayRow").first();
  await card.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.fastForward(299_000);
  await card.getByRole("button", { name: "終了", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await card.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.fastForward(300_000);
  await card.getByRole("button", { name: "終了", exact: true }).click();
  await expect(page.getByRole("dialog", { name: dialogName })).toBeVisible();
});

test("mini finish opens the topmost dialog and repeated mini commands cannot resume or commit it", async ({
  page,
}) => {
  await prepare(page);
  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: "通常タイマー25分で開始" })
    .click();
  await page.clock.fastForward(180_000);
  await page.getByRole("button", { name: "使い方", exact: true }).click();
  await page.evaluate(() =>
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control }).__LIFE_LAUNCHER_VISUAL_QA__.emit(
      "mini-timer-command",
      { action: "finish" },
    ),
  );
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog.getByRole("button", { name: "未完了のまま終了" })).toBeFocused();
  await page.evaluate(() => {
    const c = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    c.emit("mini-timer-command", { action: "pause" });
    c.emit("mini-timer-command", { action: "finish" });
  });
  await page.clock.fastForward(600_000);
  expect((await state(page)).records).toHaveLength(0);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect((await state(page)).records[0].args.session).toMatchObject({ minutes: 3 });
  await expect(page.getByRole("dialog")).toHaveCount(1);
});

for (const width of [1366, 1440, 860]) {
  test(`early dialog visual and keyboard layout at ${width}`, async ({ page }, testInfo) => {
    await page.setViewportSize({ width, height: 900 });
    const fixture = fixtureForEarly();
    fixture.config.today.items[0].text =
      "長い行動文でも確認とタイマーの操作領域が重ならないことを確認するための公開サンプル";
    await prepare(page, fixture);
    await stopAtThreshold(page);
    const dialog = page.getByRole("dialog", { name: dialogName });
    const left = await dialog
      .getByRole("button", { name: "今日の分は完了", exact: true })
      .boundingBox();
    const right = await dialog.getByRole("button", { name: "未完了のまま終了" }).boundingBox();
    expect(left!.x + left!.width).toBeLessThanOrEqual(right!.x);
    await expect(dialog.getByRole("button", { name: "未完了のまま終了" })).toBeFocused();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "未完了のまま終了" })).toBeFocused();
    expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`early-${width}-focus.png`) });
    await dialog.getByRole("button", { name: "今日の分は完了", exact: true }).hover();
    await page.screenshot({ path: testInfo.outputPath(`early-${width}-hover.png`) });
    await page.keyboard.press("Tab");
    await expect(dialog.getByRole("button", { name: "確認を閉じる" })).toBeFocused();
  });
}
