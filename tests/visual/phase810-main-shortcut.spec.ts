import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type MainWindowState = { visible: boolean; minimized: boolean; focused: boolean };
type ShortcutControl = {
  setMainWindowState: (state: MainWindowState) => void;
  mainWindowState: () => MainWindowState;
  emit: (event: string) => void;
  invokeCalls: { command: string }[];
  currentConfig: () => ReturnType<typeof createPublicFixture>["config"];
  updateConfig: (config: ReturnType<typeof createPublicFixture>["config"]) => void;
};

async function prepare(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 760, height: 520 });
  const fixture = createPublicFixture();
  fixture.config.settings.focusHotkey = "Ctrl+Alt+Space";
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await page.evaluate(async () => document.fonts.ready);
}

test("Main shortcut hides only a visible focused window", async ({ page }) => {
  await prepare(page);
  const cases: { name: string; before: MainWindowState; expectedCommand: string }[] = [
    {
      name: "foreground",
      before: { visible: true, minimized: false, focused: true },
      expectedCommand: "plugin:window|close",
    },
    {
      name: "background",
      before: { visible: true, minimized: false, focused: false },
      expectedCommand: "focus_dashboard_window",
    },
    {
      name: "minimized",
      before: { visible: true, minimized: true, focused: false },
      expectedCommand: "focus_dashboard_window",
    },
    {
      name: "hidden",
      before: { visible: false, minimized: false, focused: false },
      expectedCommand: "focus_dashboard_window",
    },
  ];

  for (const { name, before, expectedCommand } of cases) {
    const callStart = await page.evaluate((state) => {
      const qa = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: ShortcutControl })
        .__LIFE_LAUNCHER_VISUAL_QA__;
      qa.setMainWindowState(state);
      const count = qa.invokeCalls.length;
      qa.emit("main-shortcut-toggle");
      return count;
    }, before);
    await expect
      .poll(async () =>
        page.evaluate(
          ({ count, command }) => {
            const qa = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: ShortcutControl })
              .__LIFE_LAUNCHER_VISUAL_QA__;
            return qa.invokeCalls.slice(count).some((call) => call.command === command);
          },
          { count: callStart, command: expectedCommand },
        ),
      )
      .toBe(true);
    const actual = await page.evaluate(() =>
      (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: ShortcutControl })
        .__LIFE_LAUNCHER_VISUAL_QA__.mainWindowState(),
    );
    expect(actual.visible, name).toBe(name !== "foreground");
    if (name !== "foreground") {
      expect(actual.minimized, name).toBe(false);
      expect(actual.focused, name).toBe(true);
    }
    const commands = await page.evaluate((count) => {
      const qa = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: ShortcutControl })
        .__LIFE_LAUNCHER_VISUAL_QA__;
      return qa.invokeCalls.slice(count).map((call) => call.command);
    }, callStart);
    expect(commands.includes("plugin:window|close"), name).toBe(name === "foreground");
  }
});

test("Main shortcut badge fits beside Quick and follows its configured value", async ({ page }) => {
  await prepare(page);
  const badge = page.locator(".brandCopy .shortcutBadge");
  await expect(badge).toHaveText("Ctrl+Alt+Space");
  await expect(badge).toHaveAttribute("title", /Life Launcherを表示\/隠す: Ctrl\+Alt\+Space/);
  const quick = page.locator(".brandCopy strong");
  const [quickBox, badgeBox, sidebarBox] = await Promise.all([
    quick.boundingBox(),
    badge.boundingBox(),
    page.locator(".sidebar").boundingBox(),
  ]);
  expect(quickBox).not.toBeNull();
  expect(badgeBox).not.toBeNull();
  expect(sidebarBox).not.toBeNull();
  expect(badgeBox!.x).toBeGreaterThanOrEqual(quickBox!.x + quickBox!.width);
  expect(badgeBox!.x + badgeBox!.width).toBeLessThan(sidebarBox!.x + sidebarBox!.width);

  await page.evaluate(() => {
    const qa = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: ShortcutControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    const config = qa.currentConfig();
    qa.updateConfig({ ...config, settings: { ...config.settings, focusHotkey: null } });
  });
  await expect(badge).toHaveCount(0);
});
