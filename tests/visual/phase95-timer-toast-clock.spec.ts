import { expect, test, type Page } from "@playwright/test";
import {
  createFullTodayFixture,
  createPickerFixture,
  createPublicFixture,
  FIXTURE_NOW,
  type VisualQaFixture,
} from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P95-01: no start/pause toasts, pause/resume clock, top menu in Records, Records heading insets,
// empty victory hover, aligned section-bar counts.

type Display = "standard" | "large" | "xlarge";
const DISPLAYS: Display[] = ["standard", "large", "xlarge"];

type Control = {
  currentConfig: () => unknown;
  emit: (event: string, payload?: unknown) => void;
  invokeCalls: { command: string; args: Record<string, unknown> }[];
};
type QaWindow = Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control };

async function open(
  page: Page,
  fixture: VisualQaFixture,
  display: Display = "standard",
  viewport = { width: 1080, height: 680 },
) {
  fixture.config.settings.mainDisplaySize = display;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

/**
 * `clock.install` keeps real time flowing; pause it so that only runFor / fastForward move the app's clock and the
 * running time of a timer can be computed exactly.
 */
const freezeClock = (page: Page) => page.clock.pauseAt(new Date(FIXTURE_NOW).getTime() + 600_000);

const calls = (page: Page, command: string) =>
  page.evaluate(
    (name) =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === name,
      ),
    command,
  );

async function lastMiniClock(page: Page) {
  const emits = await calls(page, "plugin:event|emit");
  const snapshots = emits.filter((call) => call.args.event === "mini-timer-snapshot");
  return (snapshots.at(-1)?.args.payload as { remainingClock: string }).remainingClock;
}

/** The countdown length (seconds) shown by the sidebar Timer right after a start. */
const initialSeconds = async (page: Page) => {
  const text = await page.locator(".timerDock .timerClock").innerText();
  const [minutes, seconds] = text.split(":").map(Number);
  return minutes * 60 + seconds;
};

const clockText = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

// ---------------------------------------------------------------------------------------------
// 1. Start / pause notifications

const NOTIFICATIONS = ["タイマーを開始しました", "タイマーを一時停止しました"];

test("P95-01 starting from Do Now shows no start or pause toast", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await open(page, fixture);
  await page.locator(".doNowStartPrimary").click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  await page.locator(".timerDock").getByRole("button", { name: "一時停止" }).click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("一時停止");
  await page.locator(".timerDock").getByRole("button", { name: "再開" }).click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  await page.clock.runFor(500);
  for (const text of NOTIFICATIONS) await expect(page.getByText(text)).toHaveCount(0);
  await expect(page.locator(".toastStack [role='status']")).toHaveCount(0);
});

test("P95-01 starting from a Today card shows no start or pause toast", async ({ page }) => {
  await open(page, createFullTodayFixture());
  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: /通常タイマー25分で開始/ })
    .click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  await overlay.getByRole("button", { name: "一時停止" }).click();
  await expect(overlay.getByText("一時停止中")).toBeVisible();
  await page.clock.runFor(500);
  for (const text of NOTIFICATIONS) await expect(page.getByText(text)).toHaveCount(0);
});

test("P95-01 the record result toast stays after finishing a 1+ minute timer", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await open(page, fixture);
  await page.locator(".doNowStartPrimary").click();
  await page.clock.fastForward(120_000);
  await page.locator(".timerDock").getByRole("button", { name: "終了" }).click();
  await expect(page.getByText(/2分を記録しました/)).toBeVisible();
  for (const text of NOTIFICATIONS) await expect(page.getByText(text)).toHaveCount(0);
});

test("P95-01 finishing under a minute still says nothing was recorded", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await open(page, fixture);
  await page.locator(".doNowStartPrimary").click();
  await page.clock.fastForward(20_000);
  await page.locator(".timerDock").getByRole("button", { name: "終了" }).click();
  await expect(page.getByText("1分未満なので記録しませんでした")).toBeVisible();
});

// ---------------------------------------------------------------------------------------------
// 2. Pause / resume clock

test("P95-01 rapid pause/resume never rewinds the clock (sidebar, expanded and mini)", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await open(page, fixture);
  await freezeClock(page);
  await page.locator(".doNowStartPrimary").click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  const targetSeconds = await initialSeconds(page);
  // Let a few real ticks run first so that `now` is well past the start.
  await page.clock.runFor(3_000);
  let runningMs = 3_000;
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  const dock = page.locator(".timerDock .timerClock");
  const target = targetSeconds;
  const expanded = overlay.locator(".expandedTimerClock");
  // Right after a press the display is exact. After free-running ticks it may trail by less than one second (the 1s
  // interval keeps its own phase), which is the pre-existing behaviour and is not what this test is about.
  const check = async (label: string, mayTrail = false) => {
    const exact = clockText(target - Math.floor(runningMs / 1000));
    const expected = mayTrail ? new RegExp(`^(${exact}|${clockText(target - Math.floor(runningMs / 1000) + 1)})$`) : exact;
    await expect(dock, label).toHaveText(expected);
    await expect(expanded, label).toHaveText(expected);
    expect(await lastMiniClock(page), `${label} (mini)`).toMatch(mayTrail ? expected : new RegExp(`^${exact}$`));
  };
  await check("before");
  for (let index = 1; index <= 24; index += 1) {
    // Running for less than one tick between presses: the 1s interval cannot fire in between.
    await page.clock.runFor(900);
    runningMs += 900;
    await overlay.getByRole("button", { name: "一時停止" }).click();
    await check(`pause #${index}`);
    await page.clock.runFor(300);
    await overlay.getByRole("button", { name: "再開" }).click();
    await check(`resume #${index}`);
  }
  // The clock keeps counting normally afterwards.
  await page.clock.runFor(5_000);
  runningMs += 5_000;
  await check("after", true);
});

test("P95-01 pausing from the mini window uses the same fixed path", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await open(page, fixture);
  await freezeClock(page);
  await page.locator(".doNowStartPrimary").click();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  const target = await initialSeconds(page);
  await page.clock.runFor(3_000);
  let runningMs = 3_000;
  for (let index = 1; index <= 20; index += 1) {
    await page.clock.runFor(700);
    runningMs += 700;
    await page.evaluate(() =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("mini-timer-command", { action: "pause" }),
    );
    await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("一時停止");
    await page.clock.runFor(300);
    await page.evaluate(() =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("mini-timer-command", { action: "pause" }),
    );
    await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
    const expected = clockText(target - Math.floor(runningMs / 1000));
    await expect(page.locator(".timerDock .timerClock"), `#${index}`).toHaveText(expected);
    expect(await lastMiniClock(page), `#${index} mini`).toBe(expected);
  }
});

function earlyFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  project.nextStep!.shortTimerMinutes = 3;
  fixture.config.today.items = [
    {
      text: project.nextStep!.text,
      done: false,
      sourceKey: `project:${project.id}`,
      projectId: project.id,
      shortTimerMinutes: 3,
      defaultTimerMinutes: 25,
    },
    { text: "Wishlist audit", done: false, sourceKey: "wishlist:sample-later", shortTimerMinutes: 3, defaultTimerMinutes: 25 },
    { text: "Third audit", done: false, sourceKey: "manual:third", shortTimerMinutes: 3, defaultTimerMinutes: 25 },
  ];
  return fixture;
}

const records = (page: Page) => calls(page, "record_session");

test("P95-01 resume then finish at once: under a minute records nothing and asks nothing", async ({ page }) => {
  await open(page, earlyFixture());
  await freezeClock(page);
  const card = page.locator(".todayRow").first();
  await card.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.runFor(30_000);
  await card.getByRole("button", { name: "一時停止" }).click();
  await page.clock.runFor(5_000);
  await card.getByRole("button", { name: "再開" }).click();
  await card.getByRole("button", { name: "終了", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByText("1分未満なので記録しませんでした")).toBeVisible();
  expect(await records(page)).toHaveLength(0);
});

test("P95-01 resume then finish at once: at the early-completion threshold asks and records 3 minutes", async ({ page }) => {
  await open(page, earlyFixture());
  await freezeClock(page);
  const card = page.locator(".todayRow").first();
  await card.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.runFor(100_000);
  await card.getByRole("button", { name: "一時停止" }).click();
  await page.clock.runFor(1_000);
  await card.getByRole("button", { name: "再開" }).click();
  await page.clock.runFor(80_500);
  await card.getByRole("button", { name: "一時停止" }).click();
  await card.getByRole("button", { name: "再開" }).click();
  await card.getByRole("button", { name: "終了", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "今日の分は完了にしますか？" });
  await expect(dialog).toBeVisible();
  await page.getByRole("button", { name: "未完了のまま終了" }).press("Enter");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const saved = await records(page);
  expect(saved).toHaveLength(1);
  expect(saved[0].args.session).toMatchObject({ minutes: 3 });
});

test("P95-01 resume right before the planned time still shows the time-up dialog and records 25 minutes", async ({ page }) => {
  await open(page, earlyFixture());
  await freezeClock(page);
  const card = page.locator(".todayRow").first();
  await card.getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.runFor(1_400_000);
  await card.getByRole("button", { name: "一時停止" }).click();
  await page.clock.runFor(2_000);
  await card.getByRole("button", { name: "再開" }).click();
  await expect(page.getByRole("dialog", { name: "タイマー満了" })).toHaveCount(0);
  await page.clock.runFor(100_500);
  const dialog = page.getByRole("dialog", { name: "タイマー満了" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "終わる" }).click();
  await expect.poll(async () => (await records(page)).length).toBe(1);
  expect((await records(page))[0].args.session).toMatchObject({ minutes: 25 });
});

// ---------------------------------------------------------------------------------------------
// 3. Top menu keeps its size in Records

/** Buttons of the top menu (everything except the leading summary), measured in the current view. */
const topMenu = (page: Page) =>
  page.locator(".mainPanel > .topBar .topPills").evaluate((pills) =>
    Array.from(pills.querySelectorAll<HTMLElement>("button")).map((button) => {
      const rect = button.getBoundingClientRect();
      const label = button.querySelector<HTMLElement>(".viewToggleButtonLabel");
      return {
        name: button.getAttribute("aria-label") ?? button.textContent ?? "",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        fontSize: getComputedStyle(label ?? button).fontSize,
      };
    }),
  );

// Records body text (the statistics numbers) at every display size; the display size only enlarges Main.
const RECORDS_BODY_FONT_SIZE = "24px";

async function openRecords(page: Page) {
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  await expect(page.locator(".recordsView")).toBeVisible();
}

for (const [display, viewport] of [
  ...DISPLAYS.map((display) => [display, { width: 1440, height: 900 }] as const),
  ["large", { width: 1040, height: 800 }] as const,
  ["xlarge", { width: 1040, height: 800 }] as const,
]) {
  test(`P95-01 the top menu has the same size and place in Main and Records (${display}, ${viewport.width}px)`, async ({ page }) => {
    await open(page, createFullTodayFixture(), display, viewport);
    const main = await topMenu(page);
    expect(main.length).toBeGreaterThan(3);
    await openRecords(page);
    await expect(page.locator(".recordsView")).toBeVisible();
    const inRecords = await topMenu(page);
    expect(inRecords).toHaveLength(main.length);
    for (const [index, before] of main.entries()) {
      const after = inRecords[index];
      const isViewToggle = before.name !== after.name;
      expect(after.fontSize, `${before.name} font`).toBe(before.fontSize);
      expect(Math.abs(after.height - before.height), `${before.name} height`).toBeLessThanOrEqual(0.5);
      expect(Math.abs(after.y - before.y), `${before.name} y`).toBeLessThanOrEqual(1);
      if (!isViewToggle) {
        expect(Math.abs(after.width - before.width), `${before.name} width`).toBeLessThanOrEqual(0.5);
      }
    }
  });
}

for (const display of DISPLAYS) {
  test(`P95-01 the Records body text size does not change with the display size (${display})`, async ({ page }) => {
    await open(page, createFullTodayFixture(), display, { width: 1440, height: 900 });
    await openRecords(page);
    const size = await page.locator(".recordsStats strong").first().evaluate((el) => getComputedStyle(el).fontSize);
    expect(size).toBe(RECORDS_BODY_FONT_SIZE);
  });
}

// ---------------------------------------------------------------------------------------------
// 4. Records heading right-hand insets

function recordsFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  const project = fixture.config.projects.find((item) => item.id === "sample-learning")!;
  fixture.config.sourceCompletions = [
    {
      id: "completion-p95",
      sourceType: "nextStep",
      sourceIdentity: "project:completed-copy",
      textSnapshot: "完了履歴に表示する項目",
      projectId: project.id,
      projectNameSnapshot: project.name,
      completedAt: "2026-08-13T08:15:00+09:00",
    },
  ];
  fixture.sessionSummary.projects = [
    { projectId: project.id, label: project.name, activeDays: 7, totalMinutes: 91 },
  ];
  fixture.sessionSummary.allTimeProjects = [
    { projectId: project.id, label: project.name, activeDays: 7, totalMinutes: 91 },
  ];
  return fixture;
}

const rightEdge = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((element) => element.getBoundingClientRect().right);
const leftEdge = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((element) => element.getBoundingClientRect().left);

test("P95-01 Records headings: the right text lines up with the text inside the frame below", async ({ page }) => {
  await open(page, recordsFixture(), "standard", { width: 1440, height: 900 });
  await openRecords(page);
  const sections = page.locator(".recordsView .recordsSection");

  // プロジェクト別（今週）: the date ends at the frame's inner edge (1px border + 12px row padding).
  const weekSection = sections.nth(0);
  const weekDate = await weekSection.locator(".sectionHeading > span").evaluate((el) => el.getBoundingClientRect().right);
  const weekFrameRight = await weekSection.locator(".recordsAccordionList").evaluate((el) => el.getBoundingClientRect().right);
  expect(Math.abs(weekFrameRight - 13 - weekDate), "week heading vs the frame's inner edge").toBeLessThanOrEqual(1);

  // プロジェクト別累計: "すべての記録" vs the minutes.
  const cumulative = sections.nth(1);
  const allText = await cumulative.locator(".sectionHeading > span").evaluate((el) => el.getBoundingClientRect().right);
  const allMinutes = await cumulative
    .locator(".recordsAccordionSummary > strong")
    .first()
    .evaluate((el) => el.getBoundingClientRect().right);
  expect(Math.abs(allText - allMinutes), "cumulative heading vs row text").toBeLessThanOrEqual(1);

  // 完了した項目: "N件" is inset by the row padding (10px) from the section edge.
  const completed = page.locator(".sourceCompletionSection");
  const count = await completed.locator(".sectionHeading > span").evaluate((el) => el.getBoundingClientRect().right);
  const rowRight = await completed.locator(".sourceCompletionRow").first().evaluate((el) => el.getBoundingClientRect().right);
  expect(Math.abs(rowRight - 10 - count), "completed heading vs row padding").toBeLessThanOrEqual(1);

  // Left sides did not move: the heading text starts at the section's left edge.
  for (const section of [weekSection, cumulative, completed]) {
    const delta = await section.evaluate((el) => {
      const heading = el.querySelector(".sectionHeading h2")!.getBoundingClientRect().left;
      return heading - el.getBoundingClientRect().left;
    });
    expect(Math.abs(delta), "heading left").toBeLessThanOrEqual(1);
  }
});

test("P95-01 Records headings: this week's focus count lines up with the checklist chips", async ({ page }) => {
  await open(page, recordsFixture(), "standard", { width: 1440, height: 900 });
  await openRecords(page);
  await page.getByRole("tab", { name: "今週を決める" }).click();
  const count = await rightEdge(page, ".weeklyReviewBlockHeading > span");
  const list = await rightEdge(page, ".weeklyFocusChecklist");
  // The right-hand chip has a 1px border and 9px padding.
  expect(Math.abs(list - 10 - count)).toBeLessThanOrEqual(1);
  const left = await page.locator(".weeklyReviewBlockHeading h3").evaluate((el) => el.getBoundingClientRect().left);
  const frameLeft = await leftEdge(page, ".weeklyFocusChecklist");
  expect(Math.abs(left - frameLeft)).toBeLessThanOrEqual(1);
});

test("P95-01 Records headings without right-hand text or with a button are unchanged", async ({ page }) => {
  await open(page, recordsFixture(), "standard", { width: 1440, height: 900 });
  await openRecords(page);
  await page.getByRole("tab", { name: "すべての記録" }).click();
  const heading = page.locator(".recordsSection > .sectionHeading").first();
  await expect(heading.locator(".sectionLinkButton")).toBeVisible();
  await expect(heading).toHaveCSS("padding-right", "0px");
  const button = await heading.locator(".sectionLinkButton").evaluate((el) => el.getBoundingClientRect().right);
  const frameRight = await heading.evaluate((el) => el.getBoundingClientRect().right);
  expect(Math.abs(frameRight - button)).toBeLessThanOrEqual(1);
});

// ---------------------------------------------------------------------------------------------
// 5. Empty victory hover

const empty = () => {
  const fixture = createFullTodayFixture();
  fixture.config.today.victory.text = "";
  fixture.config.today.victory.done = false;
  return fixture;
};

test("P95-01 an empty victory reacts on hover with its frame only", async ({ page }) => {
  await open(page, empty());
  const bar = page.locator(".victoryBar");
  const text = page.locator(".victoryTextButton");
  await expect(bar).toHaveClass(/victoryBar--empty/);
  await page.mouse.move(2, 2);
  const restColor = await text.evaluate((el) => getComputedStyle(el).color);
  const restBorder = await bar.evaluate((el) => getComputedStyle(el).borderTopColor);
  expect(restBorder).not.toBe("rgb(231, 185, 77)");
  await bar.hover({ position: { x: 4, y: 4 } });
  await expect(bar).toHaveCSS("border-top-color", "rgb(231, 185, 77)");
  await expect(bar).toHaveCSS("transform", "matrix(1, 0, 0, 1, 0, -1)");
  await expect(text).toHaveCSS("color", restColor);
  await page.mouse.move(2, 2);
  await expect(bar).toHaveCSS("border-top-color", restBorder);
  await expect(bar).toHaveCSS("transform", "none");
});

test("P95-01 an empty victory being edited keeps the strong frame from the first moment", async ({ page }) => {
  await open(page, empty());
  const bar = page.locator(".victoryBar");
  await page.mouse.move(2, 2);
  await page.locator(".victoryTextButton").click();
  const input = page.locator(".victoryInput");
  await expect(input).toBeFocused();
  await page.mouse.move(2, 2);
  await expect(bar).toHaveCSS("border-top-color", "rgb(231, 185, 77)");
  await input.fill("ア");
  await expect(bar).toHaveCSS("border-top-color", "rgb(231, 185, 77)");
});

test("P95-01 an empty victory: no frame reaction or ring for the automatic focus; keyboard shows the ring only", async ({ page }) => {
  await open(page, empty());
  const bar = page.locator(".victoryBar");
  const text = page.locator(".victoryTextButton");
  await expect(text).toBeFocused();
  await page.mouse.move(2, 2);
  await expect(text).toHaveCSS("outline-style", "none");
  await expect(bar).not.toHaveCSS("border-top-color", "rgb(231, 185, 77)");
  // A key press makes the ring show; the frame stays as it was.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(text).toBeFocused();
  await expect(text).toHaveCSS("outline-style", "solid");
  await expect(bar).not.toHaveCSS("border-top-color", "rgb(231, 185, 77)");
});

// ---------------------------------------------------------------------------------------------
// 6. Section bar counts start at the same x

const BARS = [
  ".todaySectionBar",
  ".projectsBand .disclosureHeader",
  ".inboxBand .disclosureHeader",
  ".todayActivityBand .disclosureHeader",
];
const BAR_HEIGHTS: Record<Display, number[]> = {
  standard: [48, 48, 48, 44],
  large: [53, 53, 53, 53],
  xlarge: [57, 57, 57, 57],
};

/** Left edge of the count, right edge of the name text (not its box), left edge of the description, bar height. */
const barGeometry = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((bar) => {
    const nameElement = bar.querySelector("h2, strong")!;
    const range = document.createRange();
    range.selectNodeContents(nameElement);
    // Only the real text node: the hidden width reference is a pseudo-element and has no node.
    const nameRight = range.getBoundingClientRect().right;
    const count = bar.querySelector(".todayCompletionSummary, .todaySectionCount, .disclosureCount")!.getBoundingClientRect();
    const description = bar.querySelector(".todaySectionDescription, .disclosureDescription")!.getBoundingClientRect();
    const barRect = bar.getBoundingClientRect();
    return {
      textRight: nameRight,
      countLeft: count.left,
      countRight: count.right,
      descriptionLeft: description.left,
      height: barRect.height,
    };
  });

for (const display of DISPLAYS) {
  test(`P95-01 the four section bars start their counts at the same x (${display})`, async ({ page }) => {
    await open(page, createFullTodayFixture(), display);
    const geometry = [];
    for (const selector of BARS) {
      await expect.poll(async () => (await barGeometry(page, selector)).height, { message: selector }).toBeCloseTo(BAR_HEIGHTS[display][geometry.length], 0);
      geometry.push(await barGeometry(page, selector));
    }
    const first = geometry[0].countLeft;
    for (const [index, found] of geometry.entries()) {
      expect(Math.abs(found.countLeft - first), `${BARS[index]} count left`).toBeLessThanOrEqual(1);
      expect(Math.abs(found.descriptionLeft - found.countRight - 8), `${BARS[index]} count->description`).toBeLessThanOrEqual(1);
    }
    // The baseline is 「やりたいこと」 (the inbox bar): its text ends 18px before the counts (P9-14). A longer name may sit closer
    // (a few px) but never touches its count.
    expect(Math.abs(first - geometry[2].textRight - 18), "やりたいこと -> count").toBeLessThanOrEqual(1);
    for (const [index, found] of geometry.entries()) {
      expect(first - found.textRight, `${BARS[index]} name -> count`).toBeGreaterThanOrEqual(10);
    }
  });

  test(`P95-01 the Today bar with 0 items has its count at the same x (${display})`, async ({ page }) => {
    await open(page, createPickerFixture(), display);
    await expect(page.locator(".todaySectionCount")).toHaveText("0件");
    const today = await barGeometry(page, BARS[0]);
    const inbox = await barGeometry(page, BARS[2]);
    expect(Math.abs(today.countLeft - inbox.countLeft)).toBeLessThanOrEqual(1);
    expect(Math.abs(today.descriptionLeft - today.countRight - 8)).toBeLessThanOrEqual(1);
  });
}

for (const width of [860, 700, 560]) {
  test(`P95-01 on a narrow window (${width}px) the name and the count of every bar never overlap`, async ({ page }) => {
    await open(page, createFullTodayFixture(), "xlarge", { width, height: 680 });
    for (const selector of BARS) {
      const found = await barGeometry(page, selector);
      expect(found.textRight, selector).toBeLessThanOrEqual(found.countLeft);
    }
  });
}
