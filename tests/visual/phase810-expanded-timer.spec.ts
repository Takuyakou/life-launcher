import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page) {
  await prepareFixture(page, createPublicFixture());
}

async function prepareFixture(page: Page, fixture: VisualQaFixture) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowStartPrimary")).toBeVisible();
}

async function expectExpandedTimerFits(page: Page) {
  const viewport = page.viewportSize()!;
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  for (const selector of [".expandedTimerClock", ".expandedTimerActions", ".expandedTimerClose"]) {
    const box = await overlay.locator(selector).boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
  }
}

test("P8.10 TX-01 manual expand shares timer state and Esc keeps it running", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await page.setViewportSize({ width: 1920, height: 1080 });
  await prepareFixture(page, fixture);
  await expect(page.getByRole("button", { name: "タイマーを大きく表示" })).toHaveCount(0);
  await page.locator(".doNowStartPrimary").click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toHaveCount(0);
  const expand = page.getByRole("button", { name: "タイマーを大きく表示" });
  await expect(expand).toBeVisible();
  await expand.click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  await expect(overlay).toBeVisible();
  for (const viewport of [
    { width: 1920, height: 1080 },
    { width: 1200, height: 800 },
    { width: 430, height: 380 },
  ]) {
    await page.setViewportSize(viewport);
    await expectExpandedTimerFits(page);
  }
  await page.setViewportSize({ width: 1920, height: 1080 });
  await expect(overlay.locator(".expandedTimerClock")).toHaveText(await page.locator(".timerDock .timerClock").innerText());
  await page.clock.runFor(5_000);
  await expect(overlay.locator(".expandedTimerClock")).toHaveText(await page.locator(".timerDock .timerClock").innerText());
  await overlay.getByRole("button", { name: "一時停止" }).click();
  await expect(overlay.getByText("一時停止中")).toBeVisible();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("一時停止");
  await overlay.getByRole("button", { name: "再開" }).click();
  await expect(overlay.getByText("実行中")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
  await expect(expand).toBeFocused();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
  await expand.click();
  await overlay.locator(".expandedTimerClock").click();
  await page.evaluate(() => (document.activeElement as HTMLElement)?.blur());
  await page.keyboard.press("Escape");
  await expect(overlay).toHaveCount(0);
  await expect(expand).toBeFocused();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
});

test("P8.10 TX-01 overlay traps Tab, closes without backdrop click, and can end timer", async ({ page }) => {
  await prepare(page);
  await page.locator(".doNowStartPrimary").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  const close = overlay.getByRole("button", { name: "拡大表示を閉じる" });
  await expect(close).toBeFocused();
  await expect(overlay.locator(".expandedTimerClock")).toHaveCSS("user-select", "none");
  await page.keyboard.press("ArrowDown");
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest(".expandedTimerActions")))).toBe(true);
  await close.focus();
  await page.keyboard.press("Shift+Tab");
  await expect(overlay.getByRole("button", { name: "終了" })).toBeFocused();
  await page.locator(".expandedTimerBackdrop").click({ position: { x: 3, y: 3 } });
  await expect(overlay).toBeVisible();
  await overlay.getByRole("button", { name: "終了" }).click();
  await expect(overlay).toHaveCount(0);
});

test("P8.10 TX-01 measure mode has no progress bar and fits narrow window", async ({ page }) => {
  await page.setViewportSize({ width: 430, height: 380 });
  await prepare(page);
  await page.locator(".doNowMeasureButton").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  await expect(overlay.locator(".expandedTimerProgress")).toHaveCount(0);
  await expect(overlay.locator(".expandedTimerClock")).toHaveText("00:00");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await expectExpandedTimerFits(page);
});

test("P8.10 TX-02 expiry keeps overlay and existing continue/finish flow", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].nextStep!.shortTimerMinutes = 1;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await page.locator(".doNowStartPrimary").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  const overlay = page.getByRole("dialog", { name: "拡大タイマー" });
  await page.clock.runFor(60_500);
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText("時間になりました")).toBeVisible();
  const prompt = page.getByRole("dialog", { name: "タイマー満了" });
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: /続ける/ }).click();
  await expect(prompt).toHaveCount(0);
  await expect(overlay).toBeVisible();
  await expect(overlay.getByText("実行中")).toBeVisible();
  await page.clock.runFor(15 * 60_000);
  await expect(prompt).toBeVisible();
  await prompt.getByRole("button", { name: "終わる" }).click();
  await expect(overlay).toHaveCount(0);
});

test("P8.10 TX-02 early stop uses the existing Today confirmation", async ({ page }) => {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  fixture.config.today.items = [{
    text: project.nextStep!.text,
    done: false,
    sourceKey: `project:${project.id}`,
    projectId: project.id,
    shortTimerMinutes: 3,
    defaultTimerMinutes: 25,
  }];
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await page.locator(".todayRow").first().getByRole("button", { name: "通常タイマー25分で開始" }).click();
  await page.clock.fastForward(180_000);
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  await page.getByRole("dialog", { name: "拡大タイマー" }).getByRole("button", { name: "終了" }).click();
  const confirmation = page.getByRole("dialog", { name: "今日の分は完了にしますか？" });
  await expect(confirmation).toBeVisible();
  await expect(confirmation.getByRole("button", { name: "今日の分は完了" })).toHaveClass(/confirmDialogButton--positive/);
  await expect(confirmation.getByRole("button", { name: "未完了のまま終了" })).toHaveClass(/settingsButton--neutral/);
  await expect(confirmation.getByRole("heading")).toHaveCSS("user-select", "none");
  await page.getByRole("button", { name: "未完了のまま終了" }).click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toHaveCount(0);
});

test("P8.10 TX-03 NextStep auto-expand is off by default and can be saved", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepareFixture(page, fixture);
  await page.locator('[data-project-id="sample-learning"]').first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手を編集", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "次の一手を編集", exact: true });
  const preference = editor.getByRole("checkbox", { name: "開始時にタイマーを大きく表示" });
  await expect(preference).not.toBeChecked();
  await preference.check();
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editor).toHaveCount(0);
  const saved = await page.evaluate(() =>
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => VisualQaFixture["config"] } })
      .__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
  expect(saved.projects[0].nextStep?.expandTimerOnStart).toBe(true);
  await page.locator(".doNowStartPrimary").click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toBeVisible();
});

test("P8.10 TX-03 Today picker snapshots the NextStep preference", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.projects[0].nextStep!.expandTimerOnStart = true;
  await prepareFixture(page, fixture);
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const picker = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  await picker.locator(".todayPickerRow", { hasText: "資料を1ページ読む" })
    .getByRole("button", { name: "今日へ" }).click();
  await picker.getByRole("button", { name: "決定" }).click();
  const saved = await page.evaluate(() =>
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => VisualQaFixture["config"] } })
      .__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
  expect(saved.today.items[0].expandTimerOnStart).toBe(true);
  await page.locator(".todayRow").first().getByRole("button", { name: /短時間タイマー/ }).click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toBeVisible();
});

for (const [snapshot, source] of [[true, false], [false, true]] as const) {
  test(`P8.10 TX-03 Today3 uses saved ${snapshot} rather than source ${source}`, async ({ page }) => {
    const fixture = createPublicFixture();
    fixture.config.projects[0].nextStep!.expandTimerOnStart = source;
    fixture.config.today.items[0].expandTimerOnStart = snapshot;
    await prepareFixture(page, fixture);
    await page.locator(".todayRow").first().getByRole("button", { name: /短時間タイマー/ }).click();
    await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toHaveCount(snapshot ? 1 : 0);
  });
}

test("P8.10 TX-03 Wishlist Today item never auto-expands", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items[0] = {
    text: "週末に試すアイデア",
    done: false,
    sourceKey: "wishlist:sample-weekend",
    projectId: "sample-learning",
    expandTimerOnStart: true,
  };
  await prepareFixture(page, fixture);
  await page.locator(".todayRow").first().getByRole("button", { name: /短時間タイマー/ }).click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toHaveCount(0);
});

test("P8.10 TX-03 explicit auto-expand requests focus for a hidden Main", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].nextStep!.expandTimerOnStart = true;
  fixture.config.today.items = [];
  await prepareFixture(page, fixture);
  const before = await page.evaluate(() =>
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string }> } })
      .__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.length,
  );
  await page.evaluate(() => {
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: { setMainWindowState: (state: { visible: boolean; minimized: boolean; focused: boolean }) => void } })
      .__LIFE_LAUNCHER_VISUAL_QA__.setMainWindowState({ visible: false, minimized: false, focused: false });
  });
  await page.locator(".doNowStartPrimary").click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toBeVisible();
  await expect.poll(() => page.evaluate((count) =>
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string }> } })
      .__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.slice(count)
      .some((call) => call.command === "focus_dashboard_window"), before,
  )).toBe(true);
});

test("P8.10 TX-04 display request follows expanded timer and releases on close", async ({ page }) => {
  await prepare(page);
  const calls = () => page.evaluate(() =>
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string; args: { leaseId?: string; active?: boolean } }> } })
      .__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === "set_display_awake"),
  );
  await page.locator(".doNowStartPrimary").click();
  expect(await calls()).toEqual([]);
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  await expect.poll(async () => (await calls()).filter((call) => call.args.active).length).toBe(1);
  const acquired = (await calls())[0].args.leaseId;
  await page.getByRole("dialog", { name: "拡大タイマー" }).getByRole("button", { name: "拡大表示を閉じる" }).click();
  await expect.poll(async () => (await calls()).filter((call) => !call.args.active).length).toBe(1);
  expect((await calls())[1].args.leaseId).toBe(acquired);
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  await expect.poll(async () => (await calls()).filter((call) => call.args.active).length).toBe(2);
  await page.getByRole("dialog", { name: "拡大タイマー" }).getByRole("button", { name: "終了" }).click();
  await expect.poll(async () => (await calls()).filter((call) => !call.args.active).length).toBe(2);
  expect((await calls())[2].args.leaseId).not.toBe(acquired);
});

for (const state of [
  { visible: false, minimized: false, focused: false },
  { visible: true, minimized: true, focused: false },
]) {
test(`P8.10 TX-04 ${state.visible ? "minimizing" : "hiding"} Main releases display request`, async ({ page }) => {
  await prepare(page);
  await page.locator(".doNowStartPrimary").click();
  await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toBeVisible();
  await page.evaluate((nextState) => {
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: { setMainWindowState: (state: { visible: boolean; minimized: boolean; focused: boolean }) => void } })
      .__LIFE_LAUNCHER_VISUAL_QA__.setMainWindowState(nextState);
  }, state);
  await page.clock.runFor(1_100);
  await expect(page.getByRole("dialog", { name: "拡大タイマー" })).toHaveCount(0);
  await expect.poll(() => page.evaluate(() =>
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string; args: { active?: boolean } }> } })
      .__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === "set_display_awake" && call.args.active === false).length,
  )).toBe(1);
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
});
}
