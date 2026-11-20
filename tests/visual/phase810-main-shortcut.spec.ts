import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

type MainWindowState = { visible: boolean; minimized: boolean; focused: boolean };
type ShortcutControl = {
  setMainWindowState: (state: MainWindowState) => void;
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
  await waitForBundledFonts(page);
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
    const commands = await page.evaluate((count) => {
      const qa = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: ShortcutControl })
        .__LIFE_LAUNCHER_VISUAL_QA__;
      return qa.invokeCalls.slice(count).map((call) => call.command);
    }, callStart);
    expect(commands.includes("plugin:window|close"), name).toBe(name === "foreground");
  }
});

test("Main shortcut badge sits beside the app name and follows its configured value", async ({
  page,
}) => {
  await prepare(page);
  const badge = page.locator(".topBrand .uiKey");
  await expect(badge).toHaveText("Ctrl+Alt+Space");
  const dictionaryBadge = page.locator(".launcherOpenButton .uiKey");
  for (const property of ["color", "border-top-color", "font-weight"] as const) {
    const expected = await dictionaryBadge.evaluate(
      (element, name) => getComputedStyle(element).getPropertyValue(name),
      property,
    );
    await expect(badge).toHaveCSS(property, expected);
  }
  await expect(badge).toHaveAttribute("title", /Life Launcherを表示\/隠す: Ctrl\+Alt\+Space/);
  const brand = page.locator(".topBrand");
  const [brandBox, badgeBox] = await Promise.all([brand.boundingBox(), badge.boundingBox()]);
  expect(brandBox).not.toBeNull();
  expect(badgeBox).not.toBeNull();
  expect(badgeBox!.x).toBeGreaterThanOrEqual(brandBox!.x);
  expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(brandBox!.x + brandBox!.width);

  await page.evaluate(() => {
    const qa = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: ShortcutControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    const config = qa.currentConfig();
    qa.updateConfig({ ...config, settings: { ...config.settings, focusHotkey: null } });
  });
  await expect(badge).toHaveCount(0);
});
