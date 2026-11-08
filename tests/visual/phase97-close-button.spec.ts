import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const VIEWER_DOCUMENT_PATH = "C:\\PublicDemo\\Instructions\\welcome.md";

type Control = {
  invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
  currentConfig: () => { settings: { launcherHotkey: string | null } };
  setMainWindowState: (state: {
    visible: boolean;
    minimized: boolean;
    focused: boolean;
    maximized: boolean;
  }) => void;
  emit: (event: string, payload: unknown) => void;
  mainWindowState: () => { visible: boolean; maximized: boolean };
};

async function prepare(
  page: Page,
  width = 1440,
  size: "standard" | "large" | "xlarge" = "standard",
  fixture = createFullTodayFixture(),
) {
  fixture.config.settings.mainDisplaySize = size;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function prepareViewer(page: Page, width = 1000) {
  const fixture = createPublicFixture();
  fixture.instructionDocuments = {
    [VIEWER_DOCUMENT_PATH]: "# ようこそ\n\n最初の内容です。",
  };
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 680 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture, "life-launcher-instruction");
  await page.goto(
    "/?view=instruction&path=" + encodeURIComponent(VIEWER_DOCUMENT_PATH),
  );
  await expect(page.getByRole("heading", { name: "ようこそ" })).toBeVisible();
}

async function hitAt(page: Page, x: number, y: number): Promise<string | null> {
  return page.evaluate(
    ({ x, y }) =>
      document
        .elementFromPoint(x, y)
        ?.closest<HTMLElement>(".windowControlButton")
        ?.getAttribute("aria-label") ?? null,
    { x, y },
  );
}

async function closeCenterY(page: Page): Promise<number> {
  const box = await page.locator(".windowControlButton--close").boundingBox();
  if (!box) throw new Error("close button is missing");
  return box.y + box.height / 2;
}

async function closeCalls(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (
        window as typeof window & {
          __LIFE_LAUNCHER_VISUAL_QA__: Control;
        }
      ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        ({ command }) => command === "plugin:window|close",
      ).length,
  );
}

test("the close button is wider than minimize and maximize", async ({ page }) => {
  await prepare(page);
  const buttons = page.locator(".windowControlsButtons .windowControlButton");
  await expect(buttons.nth(0)).toHaveCSS("width", "36px");
  await expect(buttons.nth(1)).toHaveCSS("width", "36px");
  await expect(buttons.nth(2)).toHaveCSS("width", "44px");
  await expect(buttons.nth(2)).toHaveCSS("height", "32px");
});

test("the right edge of the window hits the close button", async ({ page }) => {
  await prepare(page);
  const y = await closeCenterY(page);
  expect(await hitAt(page, 1439, y)).toBe("閉じる");

  const close = page.locator(".windowControlButton--close");
  await page.mouse.move(1439, y);
  await expect
    .poll(() => close.evaluate((element) => getComputedStyle(element).backgroundColor))
    .toBe("rgb(240, 111, 104)");
});

test("the top-right corner is not the close button unless maximized", async ({ page }) => {
  await prepare(page);
  expect(await hitAt(page, 1439, 1)).not.toBe("閉じる");

  await page.evaluate(() => {
    const control = (
      window as typeof window & { __LIFE_LAUNCHER_VISUAL_QA__: Control }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    control.setMainWindowState({
      visible: true,
      minimized: false,
      focused: true,
      maximized: true,
    });
    control.emit("tauri://resize", { width: 1440, height: 900 });
  });
  await expect(page.locator(".windowControls")).toHaveClass(/windowControls--maximized/);
  expect(await hitAt(page, 1439, 1)).toBe("閉じる");
});

test("clicking the extended right edge closes the window", async ({ page }) => {
  await prepare(page);
  const y = await closeCenterY(page);
  await page.mouse.click(1439, y);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __LIFE_LAUNCHER_VISUAL_QA__: Control;
            }
          ).__LIFE_LAUNCHER_VISUAL_QA__.mainWindowState().visible,
      ),
    )
    .toBe(false);
});

for (const size of ["large", "xlarge"] as const) {
  test(`maximized top-right corner hits close at ${size}`, async ({ page }) => {
    await prepare(page, 1440, size);
    await page.evaluate(() => {
      const control = (
        window as typeof window & { __LIFE_LAUNCHER_VISUAL_QA__: Control }
      ).__LIFE_LAUNCHER_VISUAL_QA__;
      control.setMainWindowState({
        visible: true,
        minimized: false,
        focused: true,
        maximized: true,
      });
      control.emit("tauri://resize", { width: 1440, height: 900 });
    });
    await expect(page.locator(".windowControls")).toHaveClass(/windowControls--maximized/);
    expect(await hitAt(page, 1439, 1)).toBe("閉じる");
  });
}

test("the instruction viewer close button has the same width and right-edge hit", async ({
  page,
}) => {
  await prepareViewer(page);
  const close = page.locator(".windowControlButton--close");
  await expect(close).toHaveCSS("width", "44px");
  const y = await closeCenterY(page);
  expect(await hitAt(page, 999, y)).toBe("閉じる");
});

test("Ctrl+W requests exactly one close", async ({ page }) => {
  await prepare(page);
  await page.keyboard.press("Control+W");
  await expect.poll(() => closeCalls(page)).toBe(1);
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __LIFE_LAUNCHER_VISUAL_QA__: Control;
            }
          ).__LIFE_LAUNCHER_VISUAL_QA__.mainWindowState().visible,
      ),
    )
    .toBe(false);
});

test("Ctrl+W prevents the WebView default action", async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    const probe = window as typeof window & { __ctrlWPrevented?: boolean };
    probe.__ctrlWPrevented = false;
    window.addEventListener(
      "keydown",
      (event) => {
        if (
          event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey &&
          event.key.toLowerCase() === "w"
        ) {
          probe.__ctrlWPrevented = event.defaultPrevented;
        }
      },
      true,
    );
  });
  await page.keyboard.press("Control+W");
  expect(
    await page.evaluate(
      () => (window as typeof window & { __ctrlWPrevented?: boolean }).__ctrlWPrevented,
    ),
  ).toBe(true);
});

test("Ctrl+W closes even while a dialog input has focus", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();
  await settings.getByRole("spinbutton", { name: "短時間タイマー分数" }).focus();
  await page.keyboard.press("Control+W");
  await expect.poll(() => closeCalls(page)).toBe(1);
});

test("Ctrl+W closes a clean instruction viewer", async ({ page }) => {
  await prepareViewer(page);
  await page.keyboard.press("Control+W");
  await expect.poll(() => closeCalls(page)).toBe(1);
});

test("Ctrl+W asks before closing a dirty instruction viewer", async ({ page }) => {
  await prepareViewer(page);
  await page.getByRole("button", { name: "手順書を編集" }).click();
  const editor = page.getByRole("textbox", { name: /を編集/ });
  await editor.fill("# ようこそ\n\n変更した内容です。");
  await page.keyboard.press("Control+W");
  await expect.poll(() => closeCalls(page)).toBe(1);
  await page.evaluate(() => {
    (
      window as typeof window & { __LIFE_LAUNCHER_VISUAL_QA__: Control }
    ).__LIFE_LAUNCHER_VISUAL_QA__.emit("tauri://close-requested");
  });
  await expect(page.getByRole("dialog", { name: "変更を保存しますか？" })).toBeVisible();
});

test("Ctrl+W cannot be saved as a configurable shortcut", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings.getByRole("tab", { name: "ショートカット" }).click();
  const dictionaryField = settings
    .locator(".shortcutCaptureField")
    .filter({ hasText: "辞書" });
  await dictionaryField.getByRole("button", { name: "登録" }).click();
  await expect(dictionaryField.locator(".shortcutCaptureValue")).toContainText("入力待ち");
  await page.keyboard.press("Control+W");
  await expect(dictionaryField).toContainText("Ctrl+W はアプリの『閉じる』で使っています");

  const readLauncherHotkey = () =>
    page.evaluate(
      () =>
        (
          window as typeof window & {
            __LIFE_LAUNCHER_VISUAL_QA__: Control;
          }
        ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().settings.launcherHotkey,
    );
  const before = await readLauncherHotkey();
  await settings.getByRole("button", { name: "保存" }).click();
  await expect(
    page.locator(".toast", { hasText: "Ctrl+W はアプリの『閉じる』で使っています" }),
  ).toBeVisible();
  expect(await readLauncherHotkey()).toBe(before);
  await expect(settings).toBeVisible();
});

for (const field of [
  "focusHotkey",
  "launcherHotkey",
  "miniHotkey",
  "instructionHotkey",
] as const) {
  test(`config ${field} Ctrl+W takes priority over closing`, async ({ page }) => {
    const fixture = createFullTodayFixture();
    fixture.config.settings[field] = "Ctrl+W";
    await prepare(page, 1440, "standard", fixture);
    await page.keyboard.press("Control+W");
    await expect.poll(() => closeCalls(page)).toBe(0);
  });
}

test("an existing Ctrl+W config can still save other settings", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.config.settings.launcherHotkey = "Ctrl+W";
  await prepare(page, 1440, "standard", fixture);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings.getByRole("tab", { name: "ショートカット" }).click();
  await settings.getByRole("tab", { name: "基本" }).click();
  await settings.getByRole("spinbutton", { name: "短時間タイマー分数" }).fill("6");
  await settings.getByRole("button", { name: "保存" }).click();
  const saved = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __LIFE_LAUNCHER_VISUAL_QA__: {
            currentConfig: () => {
              settings: { launcherHotkey: string | null; shortTimerMinutes: number };
            };
          };
        }
      ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().settings,
  );
  expect(saved.launcherHotkey).toBe("Ctrl+W");
  expect(saved.shortTimerMinutes).toBe(6);
});
