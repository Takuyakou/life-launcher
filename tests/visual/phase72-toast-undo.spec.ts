import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test.describe.configure({ mode: "serial" });

type UndoTestWindow = Window & {
  __TAURI_INTERNALS__: { invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown> };
  __undoTest: { calls: Record<string, unknown>[]; release?: () => void };
};

async function stubUndo(page: Page, response: AppConfig, rejectFirst = false, delayed = false) {
  await page.evaluate(({ response, rejectFirst, delayed }) => {
    const target = window as UndoTestWindow;
    const invoke = target.__TAURI_INTERNALS__.invoke;
    target.__undoTest = { calls: [] };
    target.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      if (command !== "undo_today_selection") return invoke(command, args);
      target.__undoTest.calls.push(args);
      if (rejectFirst && target.__undoTest.calls.length === 1) throw new Error("conflicting update");
      if (delayed) await new Promise<void>((resolve) => { target.__undoTest.release = resolve; });
      return { config: response, path: "D:/PublicDemo/config.json" };
    };
  }, { response, rejectFirst, delayed });
}

async function prepare(page: Page, fixture: VisualQaFixture = createPublicFixture(), width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
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

async function removeFirstToday(page: Page) {
  await page.locator(".todayRow").first().getByRole("button", { name: "今日の3件から外す" }).click();
  const toast = page.locator(".toast", { hasText: "今日の3件から外しました" }).last();
  await expect(toast).toBeVisible();
  return toast;
}

test("P72-02 Undo sends the removed snapshot, neighbors and token, then renders the response", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items.push({ text: "Third item", done: false, sourceKey: "manual:third" });
  await prepare(page, fixture);
  const removed = fixture.config.today.items[1];
  await page.locator(".todayRemoveButton").nth(1).click();
  const afterRemoval = await currentConfig(page);
  const response = structuredClone(fixture.config);
  response.today.items[1].text = "Restored by backend";
  await stubUndo(page, response);
  await page.locator(".toast").getByRole("button", { name: "元に戻す" }).click();
  const calls = await page.evaluate(() => (window as UndoTestWindow).__undoTest.calls);
  expect(calls).toEqual([{ input: {
    operationId: afterRemoval.today.selectionMutationTokens[removed.sourceKey!],
    dayKey: fixture.config.today.date,
    sourceKey: removed.sourceKey,
    item: removed,
    previousSourceKey: fixture.config.today.items[0].sourceKey,
    nextSourceKey: fixture.config.today.items[2].sourceKey,
    sourceSnapshot: null,
    restoreExclusion: false,
  } }]);
  expect(afterRemoval.today.selectionMutationTokens[removed.sourceKey!]).toBeTruthy();
  await expect(page.locator(".todayTextButton")).toHaveText(response.today.items.map((item) => item.text));
  await expect(page.locator(".toast", { hasText: "元に戻しました" })).toBeVisible();
});

test("P72-02 rejected Undo keeps the action retryable and pending double clicks invoke once", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const toast = await removeFirstToday(page);
  await stubUndo(page, fixture.config, true, true);
  const undo = toast.getByRole("button", { name: "元に戻す" });
  await undo.click();
  await expect(page.locator(".toast", { hasText: "元に戻せません" })).toBeVisible();
  await expect(page.locator(".todayRow")).toHaveCount(1);
  await expect(undo).toBeEnabled();
  await undo.dblclick();
  await expect(toast.getByRole("button", { name: "処理中…" })).toBeDisabled();
  expect(await page.evaluate(() => (window as UndoTestWindow).__undoTest.calls.length)).toBe(2);
  await page.evaluate(() => {
    const control = (window as UndoTestWindow).__undoTest;
    if (!control.release) throw new Error("Undo was not pending");
    control.release();
  });
  await expect(page.locator(".todayTextButton")).toHaveText(fixture.config.today.items.map((item) => item.text));
  await expect(page.locator(".toast", { hasText: "元に戻しました" })).toBeVisible();
});

test("P72-02 Undo lifetime pauses while either hover or focus remains", async ({ page }) => {
  await prepare(page);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  const toast = await removeFirstToday(page);
  const undo = toast.getByRole("button", { name: "元に戻す" });
  await toast.hover();
  await page.clock.runFor(9000);
  await expect(toast).toBeVisible();
  await undo.focus();
  await page.mouse.move(1, 1);
  await page.clock.runFor(9000);
  await expect(toast).toBeVisible();
  await page.getByRole("button", { name: "使い方", exact: true }).focus();
  await page.clock.runFor(7900);
  await expect(toast).toBeVisible();
  await page.clock.runFor(400);
  await expect(toast).toHaveCount(0);
});

test("P72-02 document hidden pauses the remaining Undo time", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const toast = await removeFirstToday(page);
  await page.clock.fastForward(3_000);
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: true });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(12_000);
  await expect(toast).toBeVisible();
  await page.evaluate(() => {
    Object.defineProperty(document, "hidden", { configurable: true, value: false });
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await page.clock.fastForward(4_900);
  await expect(toast).toBeVisible();
  await page.clock.fastForward(400);
  await expect(toast).toHaveCount(0);
});

test("P72-02 keeps three visible Toasts and starts queued Undo lifetime only on promotion", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = ["A", "B", "C"].map((text) => ({ text, done: false, sourceKey: "manual:" + text }));
  await prepare(page, fixture, 860);
  await page.clock.pauseAt((await page.evaluate(() => Date.now())) + 1000);
  for (let index = 0; index < 3; index += 1) await removeFirstToday(page);
  const visibleIds = await page.locator(".toast").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-toast-id")));
  // A config notification supplies another removable item without creating an extra toast.
  await page.evaluate(() => {
    const qa = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: {
      currentConfig: () => AppConfig; updateConfig: (config: AppConfig) => void;
    } }).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = structuredClone(qa.currentConfig());
    config.today.items = [{ text: "D", done: false, sourceKey: "manual:D" }];
    qa.updateConfig(config);
  });
  // Advance the production config-change debounce without aging the toast queue unpredictably.
  await page.clock.runFor(250);
  await expect(page.locator(".todayTextButton")).toHaveText(["D"]);
  await page.locator(".todayRemoveButton").click();
  await expect(page.locator(".todayRow")).toHaveCount(0);
  await expect(page.locator(".toast")).toHaveCount(3);
  await page.mouse.move(1, 1);
  await page.getByRole("button", { name: "使い方", exact: true }).focus();
  await page.clock.runFor(7000);
  await page.locator(".toast").first().getByRole("button", { name: "通知を閉じる" }).click();
  await page.mouse.move(1, 1);
  await page.getByRole("button", { name: "使い方", exact: true }).focus();
  await page.clock.runFor(200);
  const queued = page.locator(".toast" + visibleIds.map((id) => ':not([data-toast-id="' + id + '"])').join(""));
  await expect(queued).toHaveCount(1);
  await expect(page.locator(".toast")).toHaveCount(3);
  await page.clock.runFor(7700);
  await expect(queued).toBeVisible();
  await queued.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.locator(".todayTextButton")).toHaveText(["D"]);
  await expect(page.locator(".toast", { hasText: "元に戻しました" })).toBeVisible();
});
