import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P96-01: 一体型タイトルバー(窓のボタン・ドラッグ領域・ダイアログの帯)。

const WIDTHS = [860, 1080, 1200, 1440, 1920] as const;
const SIZES = ["standard", "large", "xlarge"] as const;
const VIEWER_DOCUMENT_PATH = "C:\\PublicDemo\\Instructions\\welcome.md";

type VisualQaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
    mainWindowState: () => { visible: boolean; minimized: boolean; maximized: boolean };
    setMainWindowState: (state: {
      visible: boolean;
      minimized: boolean;
      focused: boolean;
      maximized: boolean;
    }) => void;
    updateConfig: (config: unknown) => void;
    emit: (event: string, payload?: unknown) => void;
  };
};

const qa = (page: Page) =>
  page.evaluate(() => (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls);

async function prepare(
  page: Page,
  width: number,
  size: (typeof SIZES)[number] = "standard",
  label = "main",
  fixtureOverride?: ReturnType<typeof createPublicFixture>,
) {
  const fixture = fixtureOverride ?? createPublicFixture();
  fixture.config.settings.mainDisplaySize = size;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 680 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture, label);
  await page.goto("/");
  await expect(page.locator(".focusBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
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
  await page.evaluate(async () => document.fonts.ready);
}

type LayoutProbe = {
  dockLeft: number;
  dockRight: number;
  dockTop: number;
  dockBottom: number;
  dockCenterY: number;
  rowCenterY: number;
  pillsRight: number;
  topBarOverflow: boolean;
  pillsOverflow: boolean;
  summaryOverflow: boolean;
  titleLineCount: number;
  viewportWidth: number;
  labelLevel: number;
  visibleLabels: number;
  clippedLabels: string[];
  hiddenButtonsWithoutName: string[];
};

async function probeLayout(page: Page): Promise<LayoutProbe> {
  return page.evaluate(() => {
    const topBar = document.querySelector<HTMLElement>(".mainPanel > .topBar");
    const pills = topBar?.querySelector<HTMLElement>(".topPills");
    const title = topBar?.querySelector<HTMLElement>(".topTitle");
    const summary = topBar?.querySelector<HTMLElement>(".topSummary");
    const dock = document.querySelector<HTMLElement>(".windowControls");
    if (!topBar || !pills || !title || !summary || !dock) {
      throw new Error("header parts are missing");
    }
    const titleRect = title.getBoundingClientRect();
    const lineHeight = Number.parseFloat(getComputedStyle(title).lineHeight) || 1;
    const dockRect = dock.getBoundingClientRect();
    const rowRect = topBar.getBoundingClientRect();
    // P96-01 追加修正: 上部メニューの文字は実測で隠れる。隠れたボタンは
    // title と aria-label で名前が分かること、出ている文字はボタンからはみ出さないこと。
    const labels = Array.from(topBar.querySelectorAll<HTMLElement>(".viewToggleButtonLabel"));
    const visible = labels.filter((label) => getComputedStyle(label).display !== "none");
    const clippedLabels = visible
      .filter((label) => {
        const labelRect = label.getBoundingClientRect();
        const buttonRect = label.closest("button")!.getBoundingClientRect();
        return labelRect.right > buttonRect.right + 0.5 || labelRect.left < buttonRect.left - 0.5;
      })
      .map((label) => label.textContent?.trim() ?? "");
    const hiddenButtonsWithoutName = labels
      .filter((label) => getComputedStyle(label).display === "none")
      .map((label) => label.closest("button")!)
      .filter(
        (button) =>
          !(button.getAttribute("title") ?? "").trim() ||
          !(button.getAttribute("aria-label") ?? "").trim(),
      )
      .map((button) => button.outerHTML.slice(0, 60));
    return {
      dockLeft: dockRect.left,
      dockRight: dockRect.right,
      dockTop: dockRect.top,
      dockBottom: dockRect.bottom,
      dockCenterY: dockRect.top + dockRect.height / 2,
      rowCenterY: rowRect.top + rowRect.height / 2,
      pillsRight: pills.getBoundingClientRect().right,
      topBarOverflow: topBar.scrollWidth > topBar.clientWidth + 1,
      pillsOverflow: pills.scrollWidth > pills.clientWidth + 1,
      summaryOverflow: summary.scrollWidth > summary.clientWidth + 1,
      titleLineCount: titleRect.height / lineHeight,
      viewportWidth: window.innerWidth,
      labelLevel: Number(topBar.getAttribute("data-top-menu-labels") ?? "0"),
      visibleLabels: visible.length,
      clippedLabels,
      hiddenButtonsWithoutName,
    };
  });
}

// 実測で決まる段階(0=すべて出す / 1=自動起動・ミニ・使い方・設定を隠す / 2=すべて隠す)。
// 段階はメイン画面の見出し(「今日 N分」＋日付)の幅で決めるので、記録画面でも同じ値になる
// (オーナー決定 2026-11-06)。1200px では標準・大・特大のすべてで6つとも出る。
const EXPECTED_LABEL_LEVEL: Record<number, readonly [number, number, number]> = {
  860: [2, 2, 2],
  1080: [0, 1, 1],
  1200: [0, 0, 0],
  1440: [0, 0, 0],
  1920: [0, 0, 0],
};

test.describe("P96-01 header layout budget (30 combos)", () => {
  // 同じ30通りを、段階の値と配置の両方で確かめる(以前は2つのテストで同じ30通りを回していた)。
  for (const view of ["main", "records"] as const) {
    test(`window controls fit and the hiding step matches at every width and display size (${view})`, async ({ page }) => {
      await prepare(page, WIDTHS[0]);
      for (const width of WIDTHS) {
        await page.setViewportSize({ width, height: 680 });
        for (const [index, size] of SIZES.entries()) {
          await page.evaluate((next) => {
            const control = (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
            const config = control.currentConfig() as {
              settings: { mainDisplaySize: string };
            };
            config.settings.mainDisplaySize = next;
            control.updateConfig(config);
          }, size);
          await expect(page.locator(".mainPanel")).toHaveAttribute(
            "data-main-display-size",
            size,
          );
          if (view === "records") {
            const recordsActive = await page
              .locator(".topTitle--records")
              .isVisible()
              .catch(() => false);
            if (!recordsActive) {
              await page.getByRole("button", { name: "記録ビューを開く" }).click();
            }
          } else {
            const backButton = page.getByRole("button", { name: "メイン画面に戻る" });
            if ((await backButton.count()) > 0) await backButton.click();
          }
          const label = `w=${width} size=${size} view=${view}`;
          await expect
            .poll(
              async () =>
                Number(
                  (await page.locator(".mainPanel > .topBar").getAttribute("data-top-menu-labels")) ??
                    "0",
                ),
              { message: `level (${label})` },
            )
            .toBe(EXPECTED_LABEL_LEVEL[width][index]);
          const probe = await probeLayout(page);
          // 隠す段階(0=すべて出す / 1=自動起動・ミニ・使い方・設定を隠す / 2=すべて隠す)と、
          // 実際に出ている文字の数が合っていること。
          const expectedVisible = probe.labelLevel === 0 ? 6 : probe.labelLevel === 1 ? 2 : 0;
          expect(probe.visibleLabels, `visible label count (${label})`).toBe(expectedVisible);
          expect(probe.clippedLabels, `labels stay inside their buttons (${label})`).toEqual([]);
          expect(
            probe.hiddenButtonsWithoutName,
            `hidden buttons keep title and aria-label (${label})`,
          ).toEqual([]);
          expect(probe.dockRight, `dock right edge (${label})`).toBeGreaterThanOrEqual(
            probe.viewportWidth - 9,
          );
          expect(probe.dockRight, `dock inside window (${label})`).toBeLessThanOrEqual(
            probe.viewportWidth - 7,
          );
          expect(probe.dockLeft, `dock left edge inside window (${label})`).toBeGreaterThan(0);
          expect(probe.pillsRight, `menu does not overlap dock (${label})`).toBeLessThanOrEqual(
            probe.dockLeft + 1,
          );
          expect(probe.topBarOverflow, `top bar does not overflow (${label})`).toBe(false);
          expect(probe.pillsOverflow, `menu does not wrap (${label})`).toBe(false);
          expect(probe.summaryOverflow, `title and date not squeezed (${label})`).toBe(false);
          expect(probe.titleLineCount, `title stays on one line (${label})`).toBeLessThan(1.2);
          expect(
            Math.abs(probe.dockCenterY - probe.rowCenterY),
            `dock is vertically centered with the row (${label})`,
          ).toBeLessThanOrEqual(2);
          // 重なる幅(窓の右端から約1470px以内)では右に空きを取り、
          // 重ならない幅(1920 など中央寄せが効く幅)では空きを取らない。
          const reserved = await page.evaluate(() => {
            const topBar = document.querySelector<HTMLElement>(".mainPanel > .topBar")!;
            return Number.parseFloat(getComputedStyle(topBar).paddingRight);
          });
          if (width >= 1920) {
            expect(reserved, `no reservation when centered (${label})`).toBe(0);
          } else if (view === "main") {
            expect(reserved, `reservation while overlapping (${label})`).toBeGreaterThan(100);
          }
        }
      }
    });
  }
});

test.describe("P96-01 top menu labels follow what fits", () => {
  test("switching between main and records never changes the labels", async ({ page }) => {
    await prepare(page, 1200);
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 680 });
      for (const size of SIZES) {
        await page.evaluate((next) => {
          const control = (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
          const config = control.currentConfig() as { settings: { mainDisplaySize: string } };
          config.settings.mainDisplaySize = next;
          control.updateConfig(config);
        }, size);
        const back = page.getByRole("button", { name: "メイン画面に戻る" });
        if ((await back.count()) > 0) await back.click();
        const openRecords = page.getByRole("button", { name: "記録ビューを開く" });
        const readLevel = () =>
          page
            .locator(".mainPanel > .topBar")
            .getAttribute("data-top-menu-labels")
            .then((value) => Number(value ?? "0"));
        await expect.poll(readLevel, { message: `main level at w=${width} ${size}` }).toBe(
          EXPECTED_LABEL_LEVEL[width][SIZES.indexOf(size)],
        );
        const mainLevel = await readLevel();
        const labelsInMain = await page
          .locator(".mainPanel > .topBar .viewToggleButtonLabel")
          .evaluateAll((elements) =>
            elements.map((element) => getComputedStyle(element).display !== "none"),
          );
        await openRecords.click();
        await expect(page.locator(".recordsView")).toBeVisible();
        await expect.poll(readLevel, { message: `records level at w=${width} ${size}` }).toBe(
          mainLevel,
        );
        const labelsInRecords = await page
          .locator(".mainPanel > .topBar .viewToggleButtonLabel")
          .evaluateAll((elements) =>
            elements.map((element) => getComputedStyle(element).display !== "none"),
          );
        // 表示切替のボタン(3番目)以外は、文字の出方がそのまま同じ
        expect(labelsInRecords.filter((_, index) => index !== 2)).toEqual(
          labelsInMain.filter((_, index) => index !== 2),
        );
      }
    }
  });

  test("resizing after load re-measures at every step (main and records)", async ({ page }) => {
    // 読み込んだ後に窓の幅を変えても段階が追従すること(実機で「起動時の段階のまま」に
    // なる不具合が出たため)。幅は 1200 → 1070 → 930 → 860 → 1200 と動かし、戻るときも戻る。
    const EXPECTED: Record<"standard" | "large" | "xlarge", readonly number[]> = {
      standard: [0, 0, 1, 2, 0],
      large: [0, 1, 1, 2, 0],
      xlarge: [0, 1, 1, 2, 0],
    };
    const STEPS = [1200, 1070, 930, 860, 1200] as const;

    for (const view of ["main", "records"] as const) {
      for (const size of SIZES) {
        await prepare(page, 1200);
        await page.evaluate((next) => {
          const control = (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
          const config = control.currentConfig() as { settings: { mainDisplaySize: string } };
          config.settings.mainDisplaySize = next;
          control.updateConfig(config);
        }, size);
        await expect(page.locator(".mainPanel")).toHaveAttribute("data-main-display-size", size);
        if (view === "records") {
          await page.getByRole("button", { name: "記録ビューを開く" }).click();
          await expect(page.locator(".recordsView")).toBeVisible();
        }
        for (const [index, width] of STEPS.entries()) {
          await page.setViewportSize({ width, height: 680 });
          const label = `w=${width} size=${size} view=${view}`;
          await expect
            .poll(
              () =>
                page
                  .locator(".mainPanel > .topBar")
                  .getAttribute("data-top-menu-labels")
                  .then((value) => Number(value ?? "0")),
              { message: `level (${label})` },
            )
            .toBe(EXPECTED[size][index]);
          const probe = await probeLayout(page);
          expect(probe.visibleLabels, `labels shown (${label})`).toBe(
            probe.labelLevel === 0 ? 6 : probe.labelLevel === 1 ? 2 : 0,
          );
          expect(probe.titleLineCount, `title stays on one line (${label})`).toBeLessThan(1.2);
          expect(probe.topBarOverflow, `top bar does not overflow (${label})`).toBe(false);
          expect(probe.pillsOverflow, `menu does not wrap (${label})`).toBe(false);
          expect(probe.summaryOverflow, `title and date not squeezed (${label})`).toBe(false);
          expect(probe.clippedLabels, `labels stay inside their buttons (${label})`).toEqual([]);
          expect(probe.pillsRight, `menu does not overlap dock (${label})`).toBeLessThanOrEqual(
            probe.dockLeft + 1,
          );
        }
      }
    }
  });

  test("changing the display size in settings re-measures at once", async ({ page }) => {
    // 幅はそのままで表示サイズだけ変えた場合も測り直すこと。
    await prepare(page, 1070);
    const level = () =>
      page
        .locator(".mainPanel > .topBar")
        .getAttribute("data-top-menu-labels")
        .then((value) => Number(value ?? "0"));
    const setSize = async (next: "standard" | "large" | "xlarge") => {
      await page.evaluate((value) => {
        const control = (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
        const config = control.currentConfig() as { settings: { mainDisplaySize: string } };
        config.settings.mainDisplaySize = value;
        control.updateConfig(config);
      }, next);
      await expect(page.locator(".mainPanel")).toHaveAttribute("data-main-display-size", next);
    };
    await expect.poll(level, { message: "standard at 1070" }).toBe(0);
    await setSize("large");
    await expect.poll(level, { message: "large at 1070" }).toBe(1);
    await setSize("xlarge");
    await expect.poll(level, { message: "xlarge at 1070" }).toBe(1);
    await setSize("standard");
    await expect.poll(level, { message: "standard again at 1070" }).toBe(0);
    // 切替のあとも、幅の変化に追従し続けること。
    await page.setViewportSize({ width: 860, height: 680 });
    await expect.poll(level, { message: "860 after size changes" }).toBe(2);
    await page.setViewportSize({ width: 1200, height: 680 });
    await expect.poll(level, { message: "back to 1200" }).toBe(0);
  });

  test("1200px shows all six labels at every display size", async ({ page }) => {
    await prepare(page, 1200);
    for (const size of SIZES) {
      await page.evaluate((next) => {
        const control = (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
        const config = control.currentConfig() as { settings: { mainDisplaySize: string } };
        config.settings.mainDisplaySize = next;
        control.updateConfig(config);
      }, size);
      const labels = await page
        .locator(".mainPanel > .topBar .viewToggleButtonLabel")
        .evaluateAll((elements) =>
          elements.map((element) => ({
            text: element.textContent?.trim() ?? "",
            display: getComputedStyle(element).display,
          })),
        );
      expect(labels.map((label) => label.display), `size=${size}`).toEqual([
        "block",
        "block",
        "block",
        "block",
        "block",
        "block",
      ]);
      expect(labels.map((label) => label.text)).toEqual([
        "自動起動",
        "ミニ",
        "記録",
        "手順書",
        "使い方",
        "設定",
      ]);
    }
  });
});

test.describe("P96-01 window control buttons", () => {
  test("three buttons with correct labels exist on main, records and viewer", async ({ page }) => {
    await prepare(page, 1080);
    const expected = ["最小化", "最大化", "閉じる"];
    for (const name of expected) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }
    await page.getByRole("button", { name: "記録ビューを開く" }).click();
    for (const name of expected) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }

    await prepareViewer(page);
    for (const name of expected) {
      await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
    }
  });

  test("maximize button switches to restore while maximized", async ({ page }) => {
    await prepare(page, 1080);
    await page.evaluate(() => {
      const control = (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
      control.setMainWindowState({
        visible: true,
        minimized: false,
        focused: true,
        maximized: true,
      });
      control.emit("tauri://resize", { width: 1080, height: 680 });
    });
    const maximize = page.getByRole("button", { name: "元に戻す", exact: true });
    await expect(maximize).toBeVisible();
    await page.evaluate(() => {
      const control = (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
      control.setMainWindowState({
        visible: true,
        minimized: false,
        focused: true,
        maximized: false,
      });
      control.emit("tauri://resize", { width: 1080, height: 680 });
    });
    await expect(page.getByRole("button", { name: "最大化", exact: true })).toBeVisible();
    await expect(maximize).toHaveCount(0);
  });

  test("hover and pressed backgrounds follow the color roles", async ({ page }) => {
    await prepare(page, 1080);
    const minimize = page.getByRole("button", { name: "最小化", exact: true });
    const close = page.getByRole("button", { name: "閉じる", exact: true });
    await expect
      .poll(() => minimize.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe("rgba(0, 0, 0, 0)");
    await minimize.hover();
    await expect
      .poll(() => minimize.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe("rgb(74, 70, 57)");
    // アイコン(--text)も乗せた色に合わせる
    await expect
      .poll(() => minimize.evaluate((el) => getComputedStyle(el).color))
      .toBe("rgb(244, 240, 232)");
    await close.hover();
    await expect
      .poll(() => close.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe("rgb(240, 111, 104)");
    await expect
      .poll(() => close.evaluate((el) => getComputedStyle(el).color))
      .toBe("rgb(24, 23, 19)");
    await page.mouse.down();
    await expect
      .poll(() => close.evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe("rgb(53, 49, 38)");
    await page.mouse.up();
  });

  test("dimmed while the window is not focused", async ({ page }) => {
    await prepare(page, 1080);
    const buttons = page.locator(".windowControlsButtons");
    await expect(buttons).toHaveCSS("opacity", "1");
    await page.evaluate(() => {
      (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("tauri://blur");
    });
    await expect(buttons).toHaveCSS("opacity", "0.45");
    await page.evaluate(() => {
      (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("tauri://focus");
    });
    await expect(buttons).toHaveCSS("opacity", "1");
  });

  test("the hover colour does not stay after the window is restored", async ({ page }) => {
    await prepare(page, 1080);
    const minimize = page.getByRole("button", { name: "最小化", exact: true });
    const close = page.getByRole("button", { name: "閉じる", exact: true });
    const background = (locator: typeof minimize) =>
      locator.evaluate((element) => getComputedStyle(element).backgroundColor);
    const restoreWindow = () =>
      page.evaluate(() => {
        const control = (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
        control.emit("tauri://blur");
        control.emit("tauri://focus");
      });

    await minimize.hover();
    await expect.poll(() => background(minimize)).toBe("rgb(74, 70, 57)");
    // 窓が戻ったときは、マウスが動くまで乗せた色を出さない
    await restoreWindow();
    await expect.poll(() => background(minimize)).toBe("rgba(0, 0, 0, 0)");
    const minimizeBox = (await minimize.boundingBox())!;
    await page.mouse.move(
      minimizeBox.x + minimizeBox.width - 2,
      minimizeBox.y + minimizeBox.height / 2,
    );
    await expect.poll(() => background(minimize)).toBe("rgb(74, 70, 57)");

    // 閉じるの赤も残らない
    await close.hover();
    await expect.poll(() => background(close)).toBe("rgb(240, 111, 104)");
    await restoreWindow();
    await expect.poll(() => background(close)).toBe("rgba(0, 0, 0, 0)");
    const closeBox = (await close.boundingBox())!;
    await page.mouse.move(closeBox.x + closeBox.width - 2, closeBox.y + closeBox.height / 2);
    await expect.poll(() => background(close)).toBe("rgb(240, 111, 104)");
  });

  test("the hover colour does not stay after the window is restored (viewer)", async ({ page }) => {
    await prepareViewer(page, 1000);
    const minimize = page.getByRole("button", { name: "最小化", exact: true });
    await minimize.hover();
    await expect
      .poll(() => minimize.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe("rgb(74, 70, 57)");
    await page.evaluate(() => {
      const control = (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
      control.emit("tauri://blur");
      control.emit("tauri://focus");
    });
    await expect
      .poll(() => minimize.evaluate((element) => getComputedStyle(element).backgroundColor))
      .toBe("rgba(0, 0, 0, 0)");
  });

  test("keyboard focus shows a single yellow ring", async ({ page }) => {
    await prepare(page, 1080);
    await page.getByRole("button", { name: "設定を開く" }).focus();
    await page.keyboard.press("Tab");
    const focused = await page.evaluate(() => {
      const element = document.activeElement as HTMLElement | null;
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        label: element.getAttribute("aria-label"),
        outlineWidth: style.outlineWidth,
        outlineStyle: style.outlineStyle,
      };
    });
    expect(focused?.label).toBe("最小化");
    expect(focused?.outlineStyle).toBe("solid");
    expect(Number.parseFloat(focused?.outlineWidth ?? "0")).toBeGreaterThan(0);
  });

  test("buttons invoke the window commands and nothing else", async ({ page }) => {
    await prepare(page, 1080);
    const state = () => page.evaluate(() => (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.mainWindowState());
    await page.getByRole("button", { name: "最小化", exact: true }).click();
    expect((await state()).minimized).toBe(true);
    await page.getByRole("button", { name: "最大化", exact: true }).click();
    expect((await state()).maximized).toBe(true);
    await page.getByRole("button", { name: "最小化", exact: true }).click();
    expect((await state()).minimized).toBe(true);
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    expect((await state()).visible).toBe(false);
    const commands = (await qa(page))
      .filter(({ command }) => command.startsWith("plugin:window|"))
      .map(({ command }) => command);
    expect(commands).toContain("plugin:window|minimize");
    expect(commands).toContain("plugin:window|toggle_maximize");
    expect(commands).toContain("plugin:window|close");
  });
});

test.describe("P96-01 drag regions", () => {
  test("drag region covers the header, brand block and top margins only", async ({ page }) => {
    await prepare(page, 1080);
    const state = await page.evaluate(() => {
      const has = (selector: string) =>
        Boolean(document.querySelector(selector)?.hasAttribute("data-tauri-drag-region"));
      return {
        present: {
          // P97-02 B: 窓を動かせるのは上端の余白とブランド表示だけ。
          // パネル・サイドバーの要素そのものには付けない（内側の余白まで動いてしまうため）。
          mainPanelDragStrip: has(".panelDragStrip--main"),
          sidebarDragStrip: has(".panelDragStrip--sidebar"),
          topBar: has(".mainPanel > .topBar"),
          topSummary: has(".topSummary"),
          topTitle: has(".topTitle"),
          topDateLabel: has(".topDateLabel"),
          topPills: has(".topPills"),
          brandBlock: has(".brandBlock"),
          brandIcon: has(".brandIcon"),
          brandCopy: has(".brandCopy"),
          eyebrow: has(".brandCopy .eyebrow"),
          brandStrong: has(".brandCopy strong"),
        },
        absent: {
          mainPanel: has(".mainPanel"),
          sidebar: has(".sidebar"),
          menuButton: document
            .querySelector(".topPills .viewToggleButton")
            ?.hasAttribute("data-tauri-drag-region"),
          windowButton: document
            .querySelector(".windowControlButton")
            ?.hasAttribute("data-tauri-drag-region"),
          quickList: has(".quickList"),
          launcherOpenButton: has(".launcherOpenButton"),
          shortcutBadge: has(".shortcutBadge"),
        },
      };
    });
    for (const [key, value] of Object.entries(state.present)) {
      expect(value, `drag region on ${key}`).toBe(true);
    }
    for (const [key, value] of Object.entries(state.absent)) {
      expect(value, `no drag region on ${key}`).toBe(false);
    }
  });

  test("viewer header carries the drag region but its buttons do not", async ({ page }) => {
    await prepareViewer(page);
    const state = await page.evaluate(() => {
      const has = (selector: string) =>
        Boolean(document.querySelector(selector)?.hasAttribute("data-tauri-drag-region"));
      return {
        header: has(".instructionHeader"),
        title: has(".instructionHeaderTitle"),
        eyebrow: has(".instructionHeaderEyebrow"),
        strong: has(".instructionHeaderTitle strong"),
        actionButton: document
          .querySelector(".instructionHeaderActions .instructionIconButton")
          ?.hasAttribute("data-tauri-drag-region"),
      };
    });
    expect(state.header).toBe(true);
    expect(state.title).toBe(true);
    expect(state.eyebrow).toBe(true);
    expect(state.strong).toBe(true);
    expect(state.actionButton).toBe(false);
  });
});

test.describe("P96-01 dialogs and the window controls", () => {
  test("dock stays above the dialog scrim and stays clickable", async ({ page }) => {
    await prepare(page, 1080);
    await page.getByRole("button", { name: "設定を開く" }).click();
    const dialog = page.getByRole("dialog", { name: "設定" });
    await expect(dialog).toBeVisible();
    const hit = await page.evaluate(() => {
      const dock = document.querySelector<HTMLElement>(".windowControls")!;
      const rect = dock.getBoundingClientRect();
      const target = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return dock.contains(target);
    });
    expect(hit).toBe(true);
    await expect(page.locator(".windowControlsButtons")).toHaveCSS("opacity", "1");
    // 幕の上端の帯
    const band = page.locator(".modalBackdrop .modalDragBand").first();
    await expect(band).toHaveAttribute("data-tauri-drag-region", "");
    await expect(band).toHaveCSS("height", "58px");
    // キーボードはダイアログの中に閉じ込められたまま(窓のボタンは Tab に入らない)
    await dialog.getByRole("button", { name: "保存", exact: true }).focus();
    await page.keyboard.press("Tab");
    const activeLabel = await page.evaluate(() => {
      const dialogElement = document.querySelector<HTMLElement>('[role="dialog"]');
      return dialogElement?.contains(document.activeElement)
        ? (document.activeElement as HTMLElement).textContent?.trim() ?? ""
        : "(outside dialog)";
    });
    expect(activeLabel).toBe("キャンセル");
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  });

  test("closing the dialog returns focus to the opener", async ({ page }) => {
    await prepare(page, 1080);
    const opener = page.getByRole("button", { name: "設定を開く" });
    await opener.click();
    const dialog = page.getByRole("dialog", { name: "設定" });
    await expect(dialog).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
    await expect(opener).toBeFocused();
  });

  test("dialog controls are not hidden behind the window controls (860 / 1080)", async ({
    page,
  }) => {
    for (const width of [860, 1080] as const) {
      await prepare(page, width);

      // 設定
      await page.getByRole("button", { name: "設定を開く" }).click();
      await expectControlsReachable(page, ".modalBackdrop");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "設定" })).toHaveCount(0);

      // 破棄確認
      await page.getByRole("button", { name: "設定を開く" }).click();
      await page
        .getByRole("dialog", { name: "設定" })
        .getByRole("checkbox", { name: "常に手前" })
        .check();
      await page
        .getByRole("dialog", { name: "設定" })
        .getByRole("button", { name: "キャンセル", exact: true })
        .click();
      const discard = page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" });
      await expect(discard).toBeVisible();
      await expectControlsReachable(page, ".confirmBackdrop");
      await discard.getByRole("button", { name: /破棄/ }).click();
      await expect(discard).toHaveCount(0);

      // 使い方
      await page.getByRole("button", { name: "使い方", exact: true }).click();
      await expect(page.getByRole("dialog", { name: "使い方" })).toBeVisible();
      await expectControlsReachable(page, ".helpGuideBackdrop");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "使い方" })).toHaveCount(0);

      // 今日やるものを選ぶ
      await page.getByRole("button", { name: "今日やるものを選ぶ" }).first().click();
      await expect(page.getByRole("dialog", { name: "今日やるものを選ぶ" })).toBeVisible();
      await expectControlsReachable(page, ".modalBackdrop");
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog", { name: "今日やるものを選ぶ" })).toHaveCount(0);

      // 拡大タイマー
      await page.getByRole("button", { name: /タイマー\d+分で開始/ }).first().click();
      await page.getByRole("button", { name: "タイマーを大きく表示" }).click();
      await expect(page.locator(".expandedTimer")).toBeVisible();
      await expectControlsReachable(page, ".expandedTimerBackdrop");
      await page.keyboard.press("Escape");
      await expect(page.locator(".expandedTimer")).toHaveCount(0);
    }
  });

  test("timer-complete dialog controls are not hidden (860 / 1080)", async ({ page }) => {
    for (const width of [860, 1080] as const) {
      await prepare(page, width, "standard", "main", createFullTodayFixture());
      await page.getByRole("button", { name: "短時間タイマー1分で開始" }).first().click();
      await page.clock.runFor(60_500);
      const expired = page.getByRole("dialog", { name: "タイマー満了" });
      await expect(expired).toBeVisible();
      await expectControlsReachable(page, ".modalBackdrop");
      await expired.getByRole("button", { name: /続ける/ }).click();
      await expect(expired).toHaveCount(0);
    }
  });

  test("viewer unsaved dialog keeps its controls reachable and the edit intact", async ({
    page,
  }) => {
    for (const width of [860, 1080] as const) {
      await prepareViewer(page, width);
      await page.getByRole("button", { name: "手順書を編集" }).click();
      const editor = page.getByRole("textbox", { name: /を編集/ });
      await editor.fill("# ようこそ\n\n変更した内容です。");
      await page.evaluate(() => {
        (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("tauri://close-requested");
      });
      const dialog = page.getByRole("dialog", { name: "変更を保存しますか？" });
      await expect(dialog).toBeVisible();
      await expect(editor).toHaveValue(/変更した内容です。/);
      await expectControlsReachable(page, ".instructionUnsavedBackdrop");
      await dialog.locator("button.secondaryButton", { hasText: "編集を続ける" }).click();
      await expect(dialog).toHaveCount(0);
      await expect(editor).toHaveValue(/変更した内容です。/);
    }
  });

  test("viewer close button sends a close request instead of destroying", async ({ page }) => {
    await prepareViewer(page);
    await page.getByRole("button", { name: "閉じる", exact: true }).click();
    const closeCalls = (await qa(page)).filter(
      ({ command }) => command === "plugin:window|close",
    );
    expect(closeCalls.length).toBe(1);
    // 非dirty なので閉じる要求をそのまま受け入れて壊す
    await page.evaluate(() => {
      (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("tauri://close-requested");
    });
    await expect
      .poll(() =>
        page.evaluate(
          () => (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.mainWindowState().visible,
        ),
      )
      .toBe(false);
  });
});

async function expectControlsReachable(page: Page, scopeSelector: string) {
  const problems = await page.evaluate((selector) => {
    const scope = document.querySelector(selector);
    if (!scope) return [`scope not found: ${selector}`];
    const elements = Array.from(
      scope.querySelectorAll<HTMLElement>("button, input, textarea, select, [role='tab']"),
    ).filter((element) => {
      if (element.hasAttribute("disabled")) return false;
      if (element.getAttribute("aria-disabled") === "true") return false;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return false;
      if (
        rect.left < 0 ||
        rect.top < 0 ||
        rect.right > window.innerWidth ||
        rect.bottom > window.innerHeight
      ) {
        return false; // 画面外はスクロールで届くので対象外
      }
      const style = getComputedStyle(element);
      return style.visibility !== "hidden" && style.display !== "none";
    });
    // 窓のボタン・幕の帯・幕そのものに隠れる部品だけを問題とする。
    // (ダイアログ内の重なりや pointer-events の扱いはこの確認の対象外)
    const occluder = (hit: Element | null) => {
      if (!hit) return "nothing";
      if (hit.closest(".windowControls")) return "window controls";
      if (hit.classList.contains("modalDragBand")) return "drag band";
      if (
        hit.classList.contains("modalBackdrop") ||
        hit.classList.contains("expandedTimerBackdrop")
      ) {
        return "dialog scrim";
      }
      return null;
    };
    const issues: string[] = [];
    for (const element of elements) {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      const blocker = occluder(hit);
      if (blocker) {
        const label = element.textContent?.trim().slice(0, 24) || element.tagName;
        issues.push(`"${label}" is hidden behind ${blocker}`);
      }
    }
    return issues;
  }, scopeSelector);
  expect(problems, `all controls reachable in ${scopeSelector}`).toEqual([]);
}
