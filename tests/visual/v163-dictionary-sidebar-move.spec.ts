import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V163-C8: the main window saved the config (a sidebar button moved to the Dictionary, a rename,
// …) but the Dictionary window never heard about it, so its copy stayed old and 「サイドバーに移動」
// stayed disabled. The main window now tells the Dictionary window on every save, and the
// Dictionary window also re-reads the config whenever it comes forward.

const BUTTON_LABEL = "サンプルエディター";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => AppConfig;
    emit: (event: string, payload?: unknown) => void;
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
    setConfigSilently: (config: AppConfig) => void;
  };
};

const config = (page: Page) => page.evaluate(() => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig());
const calls = (page: Page) =>
  page.evaluate(() => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls);

async function openMain(page: Page, fixture: VisualQaFixture) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1366, height: 768 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function openDictionary(context: BrowserContext, fixture: VisualQaFixture) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1000, height: 640 });
  await installTauriMock(page, fixture, "dictionary");
  await page.goto("/?view=dictionary");
  await waitForBundledFonts(page);
  await expect(page.locator(".dictionaryTile").first()).toBeVisible();
  return page;
}

/**
 * The test's stand-in for the real event bus between the two windows: anything one window emitted
 * to the other's label is delivered there. Returns how many events were delivered.
 */
async function relay(pageFrom: Page, targetLabel: string, pageTo: Page): Promise<number> {
  const emitted = (await calls(pageFrom)).filter((call) => {
    if (call.command !== "plugin:event|emit_to") return false;
    const target = call.args.target as string | { label?: string } | null;
    const label = typeof target === "string" ? target : (target?.label ?? "");
    return label === targetLabel;
  });
  const delivered = await pageTo.evaluate(
    (events) => {
      const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
      let count = 0;
      for (const event of events) {
        control.emit(event.name, event.payload);
        count += 1;
      }
      return count;
    },
    emitted.map((call) => ({ name: String(call.args.event), payload: call.args.payload })),
  );
  return delivered;
}

/** Deliver whatever the main window emitted to the Dictionary window so far. */
async function syncToDictionary(main: Page, dictionary: Page) {
  return relay(main, "dictionary", dictionary);
}

async function syncToMain(dictionary: Page, main: Page) {
  return relay(dictionary, "main", main);
}

async function openTileMenu(page: Page, label: string) {
  const tile = page.locator(".dictionaryTile", { hasText: label }).first();
  await expect(tile).toBeVisible();
  await tile.focus();
  await tile.press("Shift+F10");
  return tile;
}

test("V163-C8 1 a move to the Dictionary reaches it and 「サイドバーに移動」 becomes pressable", async ({
  page,
  context,
}) => {
  const fixture = createPublicFixture();
  await openMain(page, fixture);
  const dictionary = await openDictionary(context, fixture);

  const quick = page.locator(".quickButton", { hasText: BUTTON_LABEL });
  await quick.focus();
  await quick.press("Shift+F10");
  await page.getByRole("menuitem", { name: "辞書に移動" }).click();
  await expect.poll(async () => (await config(page)).buttons.find((b) => b.label === BUTTON_LABEL)?.showInSidebar).toBe(false);

  // The main window told the Dictionary window about the save.
  expect(await syncToDictionary(page, dictionary)).toBeGreaterThan(0);
  await expect
    .poll(async () =>
      (await config(dictionary)).buttons.find((button) => button.label === BUTTON_LABEL)
        ?.showInSidebar,
    )
    .toBe(false);

  await openTileMenu(dictionary, BUTTON_LABEL);
  await expect(dictionary.getByRole("menuitem", { name: "サイドバーに移動" })).toBeEnabled();
});

test("V163-C8 2 a move back to the sidebar reaches the main window", async ({ page, context }) => {
  const fixture = createPublicFixture();
  await openMain(page, fixture);
  const dictionary = await openDictionary(context, fixture);

  // Get the button into the Dictionary first (main window move + the notification).
  const quick = page.locator(".quickButton", { hasText: BUTTON_LABEL });
  await quick.focus();
  await quick.press("Shift+F10");
  await page.getByRole("menuitem", { name: "辞書に移動" }).click();
  await syncToDictionary(page, dictionary);
  await expect(page.locator(".quickButton", { hasText: BUTTON_LABEL })).toHaveCount(0);
  await expect
    .poll(async () =>
      (await config(dictionary)).buttons.find((button) => button.label === BUTTON_LABEL)
        ?.showInSidebar,
    )
    .toBe(false);

  await openTileMenu(dictionary, BUTTON_LABEL);
  await dictionary.getByRole("menuitem", { name: "サイドバーに移動" }).click();
  await expect
    .poll(async () =>
      (await config(dictionary)).buttons.find((button) => button.label === BUTTON_LABEL)
        ?.showInSidebar,
    )
    .toBe(true);
  expect(await syncToMain(dictionary, page)).toBeGreaterThan(0);
  await expect(page.locator(".quickButton", { hasText: BUTTON_LABEL })).toBeVisible();
});

test("V163-C8 3 moving back and forth twice keeps exactly one button", async ({ page, context }) => {
  const fixture = createPublicFixture();
  await openMain(page, fixture);
  const dictionary = await openDictionary(context, fixture);
  const before = (await config(page)).buttons.length;

  for (let round = 0; round < 2; round += 1) {
    await page.locator(".quickButton", { hasText: BUTTON_LABEL }).focus();
    await page.keyboard.press("Shift+F10");
    await page.getByRole("menuitem", { name: "辞書に移動" }).click();
    await syncToDictionary(page, dictionary);
    await expect
      .poll(async () =>
        (await config(dictionary)).buttons.find((button) => button.label === BUTTON_LABEL)
          ?.showInSidebar,
      )
      .toBe(false);
    await openTileMenu(dictionary, BUTTON_LABEL);
    await dictionary.getByRole("menuitem", { name: "サイドバーに移動" }).click();
    await syncToMain(dictionary, page);
    await expect(page.locator(".quickButton", { hasText: BUTTON_LABEL })).toBeVisible();
  }

  expect((await config(page)).buttons.length).toBe(before);
  expect((await config(dictionary)).buttons.length).toBe(before);
  expect(
    (await config(page)).buttons.filter((button) => button.label === BUTTON_LABEL),
  ).toHaveLength(1);
});

test("V163-C8 4 renaming a button in the main window renames it in the Dictionary window", async ({
  page,
  context,
}) => {
  const fixture = createPublicFixture();
  await openMain(page, fixture);
  const dictionary = await openDictionary(context, fixture);

  await page.locator(".quickButton", { hasText: BUTTON_LABEL }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "ボタン編集" });
  await expect(dialog).toBeVisible();
  const label = dialog.locator(".textInput").first();
  await label.fill("サンプルエディター2");
  await dialog.getByRole("button", { name: /保存|決定/ }).first().click();
  await expect(dialog).toHaveCount(0);

  await syncToDictionary(page, dictionary);
  await expect
    .poll(async () => (await config(dictionary)).buttons.some((button) => button.label === "サンプルエディター2"))
    .toBe(true);
  await expect(dictionary.locator(".dictionaryTile", { hasText: "サンプルエディター2" })).toBeVisible();
});

test("V163-C8 5 the Dictionary window re-reads the config when it comes forward", async ({
  page,
  context,
}) => {
  const fixture = createPublicFixture();
  await openMain(page, fixture);
  const dictionary = await openDictionary(context, fixture);

  // Another window saved while the Dictionary window was in the background: its own copy is
  // changed silently (no config-changed), then the window is brought forward.
  const changed = structuredClone(fixture.config);
  changed.buttons = changed.buttons.map((button) =>
    button.label === BUTTON_LABEL ? { ...button, label: "静かに変わった名前" } : button,
  );
  await dictionary.evaluate((next) => {
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setConfigSilently(next);
  }, changed);
  await dictionary.evaluate(() => {
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("dictionary-shown");
  });

  // The window itself re-read the config: the tile shows the new name.
  await expect(
    dictionary.locator(".dictionaryTile", { hasText: "静かに変わった名前" }),
  ).toBeVisible();
});
