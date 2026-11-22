import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V163-C4: with 「範囲外クリックで閉じる: オフ」 (the dictionary lock) the main screen is blocked
// while the dictionary is visible: the scrim takes the clicks, Tab cannot enter, and the focus
// goes back to the dictionary. Without the lock nothing changes.

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    emit: (event: string, payload?: unknown) => void;
    setDictionaryWindowExists: (exists: boolean) => void;
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
  };
};

const VISIBILITY_EVENT = "dictionary-visibility-changed";
const LOCK_EVENT = "dictionary-lock-changed";

async function openMain(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1366, height: 768 });
  await installTauriMock(page, createFullTodayFixture(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(() => {
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setDictionaryWindowExists(true);
  });
}

const emit = (page: Page, event: string, payload: unknown) =>
  page.evaluate(
    ([name, value]) => {
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit(name, value);
    },
    [event, payload] as const,
  );

const showCalls = (page: Page) =>
  page.evaluate(() =>
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
      (call) => call.command === "plugin:window|show" || call.command === "plugin:window|set_focus",
    ).length,
  );

const scrim = (page: Page) => page.locator(".dictionaryMainScrim");
const addProjectButton = (page: Page) =>
  page.locator(".projectsBand .disclosureHeader").getByRole("button", { name: "プロジェクトを追加" });

async function clickThroughScrim(page: Page) {
  const box = await addProjectButton(page).boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.click(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.clock.runFor(100);
}

test("V163-C4 1 the lock stops clicks and Tab on the main screen, and brings the dictionary back", async ({
  page,
}) => {
  await openMain(page);
  await emit(page, VISIBILITY_EVENT, true);
  await emit(page, LOCK_EVENT, true);
  await expect(scrim(page)).toHaveClass(/dictionaryMainScrim--locked/);

  const showsBefore = await showCalls(page);
  await clickThroughScrim(page);
  // Nothing opened behind the scrim, and the dictionary was brought forward once.
  await expect(page.getByRole("dialog", { name: "プロジェクトを追加" })).toHaveCount(0);
  expect(await showCalls(page)).toBeGreaterThan(showsBefore);

  // Tab cannot reach the screen under the scrim.
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  await page.keyboard.press("Tab");
  const active = await page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    return {
      inHeader: Boolean(element?.closest(".topBar")),
      inMainPanel: Boolean(element?.closest(".mainPanel")),
      inSidebar: Boolean(element?.closest(".sidebar")),
    };
  });
  expect(active).toEqual({ inHeader: false, inMainPanel: false, inSidebar: false });
  expect(
    await page.evaluate(() => document.querySelectorAll(".appShell [inert]").length),
  ).toBeGreaterThan(0);
});

test("V163-C4 2 without the lock the main screen still takes the clicks", async ({ page }) => {
  await openMain(page);
  await emit(page, VISIBILITY_EVENT, true);
  await emit(page, LOCK_EVENT, false);
  await expect(scrim(page)).toBeVisible();
  await expect(scrim(page)).not.toHaveClass(/dictionaryMainScrim--locked/);

  await addProjectButton(page).click();
  await expect(page.getByRole("dialog", { name: "プロジェクトを追加" })).toBeVisible();
});

test("V163-C4 3 hiding the dictionary always drops the lock and the scrim", async ({ page }) => {
  await openMain(page);
  await emit(page, VISIBILITY_EVENT, true);
  await emit(page, LOCK_EVENT, true);
  await expect(scrim(page)).toHaveClass(/dictionaryMainScrim--locked/);

  await emit(page, VISIBILITY_EVENT, false);
  await expect(scrim(page)).toHaveCount(0);
  expect(await page.evaluate(() => document.querySelectorAll(".appShell [inert]").length)).toBe(0);

  await addProjectButton(page).click();
  await expect(page.getByRole("dialog", { name: "プロジェクトを追加" })).toBeVisible();
});

test("V163-C4 4 the dictionary tells the main window the lock state when it changes", async ({
  page,
}) => {
  const fixture: VisualQaFixture = createFullTodayFixture();
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1000, height: 640 });
  await installTauriMock(page, fixture, "dictionary");
  await page.goto("/?view=dictionary");
  const lockButton = page.getByRole("button", { name: /範囲外クリックで閉じる/ });
  await expect(lockButton).toBeVisible();
  const lockCalls = () =>
    page.evaluate(() =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls
        .filter(
          (call) =>
            call.command === "plugin:event|emit_to" && call.args.event === "dictionary-lock-changed",
        )
        .map((call) => call.args.payload),
    );

  // The lock starts on, so the first press turns it off.
  const initial = (await lockButton.getAttribute("aria-pressed")) === "true";
  await lockButton.click();
  await expect.poll(async () => (await lockCalls()).at(-1)).toBe(!initial);
  await lockButton.click();
  await expect.poll(async () => (await lockCalls()).at(-1)).toBe(initial);
});
