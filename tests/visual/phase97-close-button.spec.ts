import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const VIEWER_DOCUMENT_PATH = "C:\\PublicDemo\\Instructions\\welcome.md";

type Control = {
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
) {
  const fixture = createFullTodayFixture();
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
