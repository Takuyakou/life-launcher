import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => VisualQaFixture["config"];
    updateConfig: (config: VisualQaFixture["config"]) => void;
    emit: (event: string, payload?: unknown) => void;
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
  };
};

const PROJECT = "サンプル学習";
const NEXT_STEP = "資料を1ページ読む";
const LONG_TEXT =
  "とても長い行動文をここに書いても、タイマーの表示が崩れたり時計や操作ボタンに重なったりしないことを確かめるための文章です";

async function prepare(page: Page, fixture: VisualQaFixture, route = "/", windowLabel = "main") {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, windowLabel);
  await page.goto(route);
}

const calls = (page: Page, command: string) =>
  page.evaluate(
    (name) =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === name,
      ),
    command,
  );

async function lastMiniSnapshot(page: Page) {
  const emits = await calls(page, "plugin:event|emit");
  const snapshots = emits.filter((call) => call.args.event === "mini-timer-snapshot");
  return snapshots.at(-1)?.args.payload as { actionText?: string; active: boolean };
}

async function expectActionTextEverywhere(page: Page, expected: string) {
  const dock = page.locator(".timerDock");
  await expect(dock.locator(".timerActionText")).toHaveText(expected);
  // The Project name is shown once as the identity, not repeated as the action text.
  await expect(dock.getByText(PROJECT, { exact: true })).toHaveCount(1);

  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  await expect(overlay.locator(".expandedTimerTask")).toHaveText(expected);
  await expect(overlay.getByText(PROJECT, { exact: true })).toHaveCount(1);
  await overlay.getByRole("button", { name: "拡大表示を閉じる" }).click();

  expect((await lastMiniSnapshot(page)).actionText).toBe(expected);
}

function withoutToday(fixture: VisualQaFixture) {
  fixture.config.today.items = [];
  return fixture;
}

test("P9-02 Today3 start shows the item text in sidebar, expanded Timer and mini snapshot", async ({
  page,
}) => {
  await prepare(page, createFullTodayFixture());
  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: "短時間タイマー1分で開始" })
    .click();
  await expectActionTextEverywhere(page, NEXT_STEP);
});

for (const [name, template] of [
  ["with a start note template", "テンプレート本文: ここから始める"],
  ["without a start note template", undefined],
] as const) {
  test(`P9-02 Do Now start ${name} shows the Next Step text and records the same note`, async ({
    page,
  }) => {
    const fixture = withoutToday(createFullTodayFixture());
    fixture.config.projects[0].nextStep!.startNoteTemplate = template;
    await prepare(page, fixture);
    await page.locator(".doNowStartPrimary").click();
    await expectActionTextEverywhere(page, NEXT_STEP);
    await expect(page.locator(".timerDock")).not.toContainText("テンプレート本文");

    await page.clock.fastForward(61_000);
    await page.locator(".timerDock").getByRole("button", { name: "終了" }).click();
    const records = await calls(page, "record_session");
    expect(records).toHaveLength(1);
    // What is written to sessions.jsonl is unchanged: the template when there is one.
    expect(records[0].args.session).toMatchObject({ note: template ?? NEXT_STEP });
  });
}

test("P9-02 editing the Next Step after start does not change the running display", async ({
  page,
}) => {
  await prepare(page, withoutToday(createFullTodayFixture()));
  await page.locator(".doNowStartPrimary").click();
  await expect(page.locator(".timerDock .timerActionText")).toHaveText(NEXT_STEP);

  await page.evaluate(() => {
    const qa = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = structuredClone(qa.currentConfig());
    config.projects[0].nextStep!.text = "あとから書き換えた次の一手";
    qa.updateConfig(config);
  });
  await expect
    .poll(async () =>
      page.evaluate(
        () => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().projects[0].nextStep!.text,
      ),
    )
    .toBe("あとから書き換えた次の一手");
  await expect(page.locator(".timerDock .timerActionText")).toHaveText(NEXT_STEP);
  await page.clock.fastForward(1_000);
  expect((await lastMiniSnapshot(page)).actionText).toBe(NEXT_STEP);
});

test("P9-02 a long action text is clamped to two lines with the full text in title", async ({
  page,
}) => {
  const fixture = createFullTodayFixture();
  fixture.config.today.items[0].text = LONG_TEXT;
  await prepare(page, fixture);
  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: "短時間タイマー1分で開始" })
    .click();

  const sidebarText = page.locator(".timerDock .timerActionText");
  await expect(sidebarText).toHaveAttribute("title", LONG_TEXT);
  await expect(sidebarText).toHaveCSS("-webkit-line-clamp", "2");
  const sidebar = await sidebarText.evaluate((element) => ({
    clamped: element.scrollHeight > element.clientHeight,
    lines: Math.round(element.clientHeight / parseFloat(getComputedStyle(element).lineHeight)),
  }));
  expect(sidebar).toEqual({ clamped: true, lines: 2 });

  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const task = page.locator(".expandedTimerTask");
  await expect(task).toHaveAttribute("title", LONG_TEXT);
  await expect(task).toHaveCSS("-webkit-line-clamp", "2");
  const box = await task.boundingBox();
  const clock = await page.locator(".expandedTimerClock").boundingBox();
  expect(box!.y + box!.height).toBeLessThanOrEqual(clock!.y);
});

test("P9-02 mini keeps a long action text on one line without overlapping anything", async ({
  page,
}) => {
  await page.setViewportSize({ width: 288, height: 136 });
  await prepare(page, createFullTodayFixture(), "/?view=mini", "life-launcher-mini");
  await page.evaluate((actionText) => {
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("mini-timer-snapshot", {
      active: true,
      label: "サンプル学習",
      actionText,
      mode: "countdown",
      remainingClock: "24:55",
      paused: false,
      progressPercent: 1,
      projectId: "sample-learning",
      projectName: "サンプル学習",
      projectColorId: "blue",
    });
  }, LONG_TEXT);

  const action = page.locator(".timerPanel--mini .timerActionText");
  await expect(action).toHaveAttribute("title", LONG_TEXT);
  await expect(action).toHaveCSS("text-overflow", "ellipsis");
  expect(await action.evaluate((element) => element.scrollWidth > element.clientWidth)).toBe(true);

  const names = [".projectIdentity", ".timerActionText", ".timerStateBadge", ".timerClock", ".timerControls"];
  const boxes = [];
  for (const name of names) {
    const box = await page.locator(`.timerPanel--mini ${name}`).boundingBox();
    expect(box, name).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(288);
    expect(box!.y + box!.height).toBeLessThanOrEqual(136);
    boxes.push({ name, ...box! });
  }
  for (const [index, a] of boxes.entries()) {
    for (const b of boxes.slice(index + 1)) {
      const overlaps =
        a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlaps, `${a.name} overlaps ${b.name}`).toBe(false);
    }
  }
  expect(
    await page.locator(".miniShell").evaluate((el) => el.scrollHeight <= el.clientHeight),
  ).toBe(true);
});
