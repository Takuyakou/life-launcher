import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P97-02 A/C/D/E/F: ビューアーの最初のフォーカス、記録画面の「今日」の更新、
// ミニタイマーのダブルクリック、設定画面の ↑、窓の大きさが変わった直後の乗せた色。

type TauriInternals = {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
};

type InvokeCall = { command: string; args: Record<string, unknown> };

type VisualQaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    emit: (event: string, payload?: unknown) => void;
    invokeCalls: InvokeCall[];
    setRecordSessionFailure: (fail: boolean) => void;
  };
};

type ViewerWindow = Window & { __viewerShown: boolean };

async function open(page: Page) {
  const fixture = createPublicFixture();
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1200, height: 680 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

test("ArrowUp at the top of a settings section returns to the selected tab", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();

  const selectedTab = settings.locator('.settingsTabs [role="tab"][aria-selected="true"]');
  await expect(selectedTab).toHaveCount(1);
  const tabName = await selectedTab.getAttribute("aria-label");

  // タブで ↓ → 節の一番上へ
  await selectedTab.focus();
  await page.keyboard.press("ArrowDown");
  const inSection = await page.evaluate(() =>
    Boolean(
      (document.activeElement as HTMLElement | null)?.closest(
        ".settingsSection:not(.settingsSection--hidden)",
      ),
    ),
  );
  expect(inSection, "focus moved into the section").toBe(true);

  // 節の一番上で ↑ → 選んでいるタブへ戻る（タブは切り替わらない）
  await page.keyboard.press("ArrowUp");
  const after = await page.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    return {
      isTab: Boolean(active?.matches('.settingsTabs [role="tab"]')),
      selected: active?.getAttribute("aria-selected"),
      label: active?.getAttribute("aria-label"),
    };
  });
  expect(after.isTab, "focus is on a tab").toBe(true);
  expect(after.selected, "the tab stays the selected one").toBe("true");
  expect(after.label).toBe(tabName);
});

test("hover colours stay off after the window is resized until the mouse moves", async ({
  page,
}) => {
  await open(page);
  const button = page.locator(".windowControlButton").first();
  const style = () =>
    button.evaluate((element) => {
      const computed = getComputedStyle(element);
      return `${computed.backgroundColor}|${computed.color}`;
    });
  await page.mouse.move(2, 2);
  const resting = await style();
  await button.hover();
  const hovered = await style();
  expect(hovered, "a hovered window button shows a colour").not.toBe(resting);

  // 大きさが変わった直後: 乗せた色を出さない
  await page.evaluate(() => window.dispatchEvent(new Event("resize")));
  await expect(page.locator("body")).toHaveClass(/hover-suppressed/);
  const suppressed = await style();
  expect(suppressed, "no hover colour right after a resize").toBe(resting);

  // マウスを動かすと今までどおり
  await page.mouse.move(600, 300);
  await expect(page.locator("body")).not.toHaveClass(/hover-suppressed/);
  await button.hover();
  const released = await style();
  expect(released, "the hover colour comes back").toBe(hovered);
});

// ---------------------------------------------------------------------------------------------
// A. 窓を新しく作った直後の一覧のフォーカス

const INSTRUCTION_ROOT = "C:\\PublicDemo\\Instructions";
const GUIDE = `${INSTRUCTION_ROOT}\\guide.md`;

/**
 * 窓を新しく作った直後を再現する。窓は `visible: false`・`focus: false` で作られ、
 * あとから前に出る。WebView2 は前に出る前の要素のフォーカスを受け付けないため、
 * 前に出るまでは `focus()` を無視し、前に出たことを `visibilitychange` で伝える。
 */
async function openNewViewer(page: Page, listDelayMs: number) {
  const fixture = createPublicFixture();
  fixture.instructionDocuments = { [GUIDE]: "# 手順書\n\n本文です。" };
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture, "life-launcher-instruction");
  await page.addInitScript(() => {
    const originalFocus = HTMLElement.prototype.focus;
    (window as unknown as ViewerWindow).__viewerShown = false;
    HTMLElement.prototype.focus = function (this: HTMLElement, options?: FocusOptions) {
      if (!(window as unknown as ViewerWindow).__viewerShown) return;
      originalFocus.call(this, options);
    };
  });
  // 一覧の読み込みを遅らせる（初めて開いたときの遅い読み込み）。
  await page.addInitScript((delay: number) => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: TauriInternals })
      .__TAURI_INTERNALS__;
    const invoke = internals.invoke;
    internals.invoke = async (command, args = {}) => {
      if (command === "list_instruction_roots" || command === "list_instruction_directory") {
        await new Promise((resolve) => window.setTimeout(resolve, delay));
      }
      return invoke(command, args);
    };
  }, listDelayMs);
  await page.goto(`/?view=instruction&path=${encodeURIComponent(GUIDE)}`);
  await expect(page.locator(".instructionTreeRow").first()).toBeVisible();
  // 一覧ができたあとに窓が前に出た、という順番を再現する。
  await page.evaluate(() => {
    (window as unknown as ViewerWindow).__viewerShown = true;
    document.dispatchEvent(new Event("visibilitychange"));
  });
}

for (const listDelayMs of [0, 400]) {
  test(`a newly created viewer focuses the tree row when the list takes ${listDelayMs}ms`, async ({
    page,
  }) => {
    await openNewViewer(page, listDelayMs);
    const rows = page.locator(".instructionTreeRow");
    // 開いているファイルの行（まだ閉じているので先頭の行）へフォーカスが置かれる。
    await expect(rows.first()).toBeFocused();

    await page.keyboard.press("ArrowRight");
    await expect(rows).toHaveCount(4);
    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(1)).toBeFocused();
    await expect(rows.nth(1)).toContainText("guide.md");
  });
}

// ---------------------------------------------------------------------------------------------
// C. 記録画面を開いたままタイマーを終えたときの「今日」の更新

async function prepareRecords(page: Page) {
  const fixture = createPublicFixture();
  fixture.config.today.items[0].shortTimerMinutes = 1;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main", null, {
    cleanStartReset: true,
    cleanStartNow: FIXTURE_NOW,
  });
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

const recordsStat = (page: Page, label: string) =>
  page
    .locator(".recordsView .recordsStats > div")
    .filter({ hasText: label })
    .locator("strong");

const recordSessionCalls = (page: Page) =>
  page.evaluate(() =>
    (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
      (call) => call.command === "record_session",
    ),
  );

async function openRecordsWhileTimerRuns(page: Page) {
  const todayRow = page.locator(".todayRow").filter({ hasText: "資料を1ページ読む" });
  await todayRow.getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  await expect(page.locator(".recordsView")).toBeVisible();
  await expect(recordsStat(page, "今日")).toHaveText("25分");
  await expect(recordsStat(page, "今週")).toHaveText("35分");
  await expect(recordsStat(page, "活動日数")).toHaveText("2日");
}

test("a finished timer updates the open Records view immediately and records exactly once", async ({
  page,
}) => {
  await prepareRecords(page);
  await openRecordsWhileTimerRuns(page);

  await page.clock.runFor(60_500);
  const dialog = page.getByRole("dialog", { name: "タイマー満了" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "終わる" }).click();

  // 画面を開き直さずに、その場で新しい値になる。
  await expect(recordsStat(page, "今日")).toHaveText("26分");
  await expect(recordsStat(page, "今週")).toHaveText("36分");
  await expect(recordsStat(page, "活動日数")).toHaveText("2日");
  const learning = page
    .locator(".recordsView .recordsAccordionSummary")
    .filter({ hasText: "サンプル学習" })
    .first();
  await expect(learning.locator("strong")).toHaveText("26分");

  // 記録は1件だけ。重なって2件にならない。
  expect(await recordSessionCalls(page)).toHaveLength(1);
  await page.locator(".recordsView").getByRole("tab", { name: "すべての記録" }).click();
  await expect(page.locator(".recordsView .recordsCompactRow")).toHaveCount(3);
});

test("a failed recording leaves the open Records view values unchanged", async ({ page }) => {
  await prepareRecords(page);
  await openRecordsWhileTimerRuns(page);
  await page.evaluate(() =>
    (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setRecordSessionFailure(true),
  );

  await page.clock.runFor(60_500);
  const dialog = page.getByRole("dialog", { name: "タイマー満了" });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "終わる" }).click();
  await expect(page.locator(".toast").last()).toContainText("記録できません");

  // 記録に失敗したときは読み直しで値が変わらない。
  await expect(recordsStat(page, "今日")).toHaveText("25分");
  await expect(recordsStat(page, "今週")).toHaveText("35分");
  await expect(recordsStat(page, "活動日数")).toHaveText("2日");
  expect(await recordSessionCalls(page)).toHaveLength(1);
});

// ---------------------------------------------------------------------------------------------
// D. ミニタイマーのボタンのダブルクリック

const MINI_SNAPSHOT = {
  active: true,
  label: "サンプル学習",
  actionText: "資料を1ページ読む",
  mode: "countdown",
  remainingClock: "24:55",
  paused: false,
  progressPercent: 1,
  projectId: "sample-learning",
  projectName: "サンプル学習",
  projectColorId: "blue",
};

async function openRunningMini(page: Page) {
  await page.setViewportSize({ width: 288, height: 136 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createFullTodayFixture(), "life-launcher-mini");
  // メインウィンドウの代わりに、一時停止の指示へ snapshot を返す。
  await page.addInitScript((snapshot: typeof MINI_SNAPSHOT) => {
    const internals = (window as unknown as { __TAURI_INTERNALS__: TauriInternals })
      .__TAURI_INTERNALS__;
    const invoke = internals.invoke;
    let paused = false;
    (window as unknown as { __miniPauseStates: boolean[] }).__miniPauseStates = [];
    internals.invoke = async (command, args = {}) => {
      const result = await invoke(command, args);
      const payload = args.payload as { action?: string } | undefined;
      if (
        command === "plugin:event|emit" &&
        args.event === "mini-timer-command" &&
        payload?.action === "pause"
      ) {
        paused = !paused;
        (window as unknown as { __miniPauseStates: boolean[] }).__miniPauseStates.push(paused);
        await invoke("plugin:event|emit", {
          event: "mini-timer-snapshot",
          payload: { ...snapshot, paused },
        });
      }
      return result;
    };
  }, MINI_SNAPSHOT);
  await page.goto("/?view=mini");
  await expect(page.locator(".miniShell")).toBeVisible();
  await page.evaluate(
    (snapshot) =>
      (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("mini-timer-snapshot", snapshot),
    MINI_SNAPSHOT,
  );
  await expect(page.locator(".timerStateBadge")).toHaveText("実行中");
}

const miniReturnRequests = (page: Page) =>
  page.evaluate(() =>
    (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
      (call) =>
        call.command === "plugin:event|emit" &&
        call.args.event === "mini-return-requested",
    ),
  );

test("double-clicking pause/resume keeps the mini window and toggles twice", async ({ page }) => {
  await openRunningMini(page);
  await page.getByRole("button", { name: "一時停止" }).dblclick();

  // 一時停止と再開が2回起きて、ミニタイマーのまま。
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __miniPauseStates: boolean[] }).__miniPauseStates),
    )
    .toEqual([true, false]);
  await expect(page.locator(".timerStateBadge")).toHaveText("実行中");
  await expect(page.locator(".miniShell")).toBeVisible();
  expect(await miniReturnRequests(page)).toHaveLength(0);
});

test("double-clicking an empty part of the mini returns to the main window", async ({ page }) => {
  await openRunningMini(page);
  await page.locator(".miniTopline > span").first().dblclick();
  await expect.poll(async () => (await miniReturnRequests(page)).length).toBe(1);
});
