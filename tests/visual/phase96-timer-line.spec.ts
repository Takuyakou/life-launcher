import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P96-02: 窓の上端のタイマーの線(メイン画面の窓だけ)。
// 予定時間のあるタイマー(countdown)が実行中・一時停止中のときだけ、上端に 2px の線を出す。

const SHORT_MINUTES = 5;
const SHORT_SECONDS = SHORT_MINUTES * 60;

async function open(page: Page, fixture: VisualQaFixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1200, height: 680 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  // 時計を止めて、runFor で進めた分だけが経過時間になるようにする
  await page.clock.pauseAt(new Date(FIXTURE_NOW).getTime() + 600_000);
}

/** 短時間タイマー(5分)を始める。 */
const startShortTimer = (page: Page) => page.locator(".doNowStartPrimary").click();
const startMeasureTimer = (page: Page) => page.locator(".doNowMeasureButton").click();

const lineState = (page: Page) =>
  page.evaluate(() => {
    const line = document.querySelector<HTMLElement>(".windowTimerLine");
    if (!line) return null;
    const fill = line.querySelector<HTMLElement>(".windowTimerLineFill");
    const groove = line.querySelector<HTMLElement>(".windowTimerLineGroove");
    const style = getComputedStyle(line);
    const grooveStyle = groove ? getComputedStyle(groove) : null;
    return {
      running: line.classList.contains("windowTimerLine--running"),
      paused: line.classList.contains("windowTimerLine--paused"),
      groove: grooveStyle ? grooveStyle.backgroundColor : null,
      grooveOpacity: grooveStyle ? Number(grooveStyle.opacity) : null,
      fillColor: fill ? getComputedStyle(fill).backgroundColor : null,
      pointerEvents: style.pointerEvents,
      zIndex: style.zIndex,
      height: Math.round(line.getBoundingClientRect().height),
      top: Math.round(line.getBoundingClientRect().top),
      ariaHidden: line.getAttribute("aria-hidden"),
      stylePercent: fill ? Number.parseFloat(fill.style.width) : null,
      renderedPercent: fill
        ? (fill.getBoundingClientRect().width / line.getBoundingClientRect().width) * 100
        : null,
    };
  });

/** タイマーの時計から、予定時間に対する進み具合(%)を出す。 */
const progressFromClock = async (page: Page, totalSeconds: number) => {
  const text = await page.locator(".timerDock .timerClock").innerText();
  const [minutes, seconds] = text.split(":").map(Number);
  const remaining = minutes * 60 + seconds;
  return ((totalSeconds - remaining) / totalSeconds) * 100;
};

test.describe("P96-02 window timer line", () => {
  test("there is no line while idle or while measuring", async ({ page }) => {
    await open(page);
    await expect(page.locator(".windowTimerLine")).toHaveCount(0);
    await startMeasureTimer(page);
    await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("計測中");
    await page.clock.runFor(61_000);
    await expect(page.locator(".windowTimerLine")).toHaveCount(0);
  });

  test("a countdown timer shows the line and it follows the clock", async ({ page }) => {
    await open(page);
    await startShortTimer(page);
    await expect(page.locator(".windowTimerLine")).toHaveCount(1);
    const started = (await lineState(page))!;
    expect(started.running, "running class").toBe(true);
    expect(started.height, "height").toBe(3);
    expect(started.top, "sits on the top edge").toBe(0);
    expect(started.ariaHidden, "hidden from screen readers").toBe("true");
    expect(started.pointerEvents, "does not take clicks").toBe("none");
    expect(Number(started.zIndex), "in front of the window buttons").toBeGreaterThan(140);
    // 線は --accent、溝は --accent の 12%
    await expect
      .poll(() => page.locator(".windowTimerLineFill").evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe("rgb(231, 185, 77)");
    expect(started.groove, "groove uses --accent").toBe("rgb(231, 185, 77)");
    expect(started.grooveOpacity, "groove is 12%").toBeCloseTo(0.12, 2);

    await page.clock.runFor(60_000);
    const expected = await progressFromClock(page, SHORT_SECONDS);
    await expect
      .poll(async () => (await lineState(page))!.renderedPercent, { timeout: 4000 })
      .toBeGreaterThan(expected - 1.5);
    expect((await lineState(page))!.renderedPercent).toBeLessThan(expected + 3);
  });

  test("pausing stops the line and turns it orange; resuming keeps going", async ({ page }) => {
    await open(page);
    await startShortTimer(page);
    await page.clock.runFor(60_000);
    await page.locator(".timerDock").getByRole("button", { name: "一時停止" }).click();
    const paused = (await lineState(page))!;
    expect(paused.paused, "paused class").toBe(true);
    await expect
      .poll(() => page.locator(".windowTimerLineFill").evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe("rgb(242, 166, 90)");
    expect(paused.groove, "groove uses --warn").toBe("rgb(242, 166, 90)");
    const frozen = paused.renderedPercent;
    // 一時停止中は時間が進んでも長さが変わらない
    await page.clock.runFor(30_000);
    expect((await lineState(page))!.renderedPercent).toBeCloseTo(frozen, 1);
    // 再開すると黄色に戻って続きから伸びる
    await page.locator(".timerDock").getByRole("button", { name: "再開" }).click();
    await expect
      .poll(() => page.locator(".windowTimerLineFill").evaluate((el) => getComputedStyle(el).backgroundColor))
      .toBe("rgb(231, 185, 77)");
    await page.clock.runFor(60_000);
    const expected = await progressFromClock(page, SHORT_SECONDS);
    await expect
      .poll(async () => (await lineState(page))!.renderedPercent, { timeout: 4000 })
      .toBeGreaterThan(expected - 1.5);
  });

  test("pausing and resuming many times never moves the line backwards", async ({ page }) => {
    await open(page);
    await startShortTimer(page);
    let previous = 0;
    for (let index = 0; index < 4; index += 1) {
      await page.clock.runFor(20_000);
      await page.locator(".timerDock").getByRole("button", { name: "一時停止" }).click();
      const paused = (await lineState(page))!.renderedPercent;
      expect(paused, `pause ${index}`).toBeGreaterThanOrEqual(previous - 0.5);
      previous = paused;
      await page.locator(".timerDock").getByRole("button", { name: "再開" }).click();
      const resumed = (await lineState(page))!.renderedPercent;
      expect(resumed, `resume ${index}`).toBeGreaterThanOrEqual(previous - 0.5);
      previous = resumed;
    }
  });

  test("the line stays at 100% while the completion prompt waits, then disappears", async ({ page }) => {
    await open(page);
    await startShortTimer(page);
    await page.clock.runFor(SHORT_SECONDS * 1000 + 2_000);
    const dialog = page.getByRole("dialog", { name: "タイマー満了" });
    await expect(dialog).toBeVisible();
    expect((await lineState(page))!.stylePercent).toBe(100);
    await expect
      .poll(async () => (await lineState(page))!.renderedPercent, { timeout: 4000 })
      .toBeGreaterThan(99);
    await dialog.getByRole("button", { name: "終わる" }).click();
    await expect(page.locator(".windowTimerLine")).toHaveCount(0);
  });

  test("continuing with +15 minutes recalculates the length", async ({ page }) => {
    await open(page);
    await startShortTimer(page);
    await page.clock.runFor(SHORT_SECONDS * 1000 + 2_000);
    const dialog = page.getByRole("dialog", { name: "タイマー満了" });
    await dialog.getByRole("button", { name: "続ける(+15分)" }).click();
    await expect(dialog).toHaveCount(0);
    // 予定 5 分 + 15 分 = 20 分。経過 5 分なので 25%
    const state = (await lineState(page))!;
    expect(state.stylePercent).toBeGreaterThan(24.5);
    expect(state.stylePercent).toBeLessThan(25.5);
    await expect
      .poll(async () => (await lineState(page))!.renderedPercent, { timeout: 4000 })
      .toBeGreaterThan(24);
    expect((await lineState(page))!.renderedPercent).toBeLessThan(26.5);
  });

  test("records keeps the line; the viewer and the mini timer have none", async ({ page }) => {
    await open(page);
    await startShortTimer(page);
    await page.clock.runFor(60_000);
    await page.locator(".timerDock").getByRole("button", { name: "一時停止" }).click();
    const before = (await lineState(page))!.renderedPercent;
    await page.getByRole("button", { name: "記録ビューを開く" }).click();
    await expect(page.locator(".recordsView")).toBeVisible();
    const inRecords = (await lineState(page))!;
    expect(inRecords.paused).toBe(true);
    expect(inRecords.renderedPercent).toBeCloseTo(before, 0);

    const viewer = createPublicFixture();
    await installTauriMock(page, viewer, "life-launcher-instruction");
    await page.goto("/?view=instruction");
    await expect(page.locator(".windowTimerLine")).toHaveCount(0);

    await installTauriMock(page, createPublicFixture(), "life-launcher-mini");
    await page.goto("/?view=mini");
    await expect(page.locator(".windowTimerLine")).toHaveCount(0);
  });

  test("the line does not block the window buttons or the drag regions", async ({ page }) => {
    await open(page);
    await startShortTimer(page);
    await expect(page.locator(".windowTimerLine")).toHaveCount(1);
    const hits = await page.evaluate(() => {
      const line = document.querySelector<HTMLElement>(".windowTimerLine")!;
      const rect = line.getBoundingClientRect();
      const at = (x: number, y: number) => document.elementFromPoint(x, y);
      const minimize = document.querySelector<HTMLElement>('.windowControlButton[aria-label="最小化"]');
      const minimizeRect = minimize?.getBoundingClientRect();
      const middleHit = at(window.innerWidth / 2, rect.top + 1);
      const buttonHit = minimizeRect
        ? at(minimizeRect.left + minimizeRect.width / 2, minimizeRect.top + minimizeRect.height / 2)
        : null;
      const overButtonAtLine = minimizeRect
        ? at(minimizeRect.left + minimizeRect.width / 2, rect.top + 1)
        : null;
      return {
        buttonInside: buttonHit ? minimize!.contains(buttonHit) : false,
        middleTag: middleHit?.tagName ?? null,
        middleInLine: middleHit === line || (middleHit ? line.contains(middleHit) : false),
        middleDragRegion: middleHit
          ? middleHit.getAttribute("data-tauri-drag-region") === "" ||
            middleHit.closest("[data-tauri-drag-region]") !== null
          : false,
        overButtonAtLineInLine:
          overButtonAtLine === line || (overButtonAtLine ? line.contains(overButtonAtLine) : false),
      };
    });
    expect(hits.buttonInside, "the window button is still clickable").toBe(true);
    expect(hits.middleInLine, "the line is not the hit target").toBe(false);
    expect(hits.middleDragRegion, "the drag region is below the line").toBe(true);
    expect(hits.overButtonAtLineInLine, "the line does not cover the window buttons").toBe(false);
  });

  test("reduced motion removes the transition", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await open(page);
    await startShortTimer(page);
    const transition = await page
      .locator(".windowTimerLineFill")
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { property: style.transitionProperty, duration: style.transitionDuration };
      });
    expect(transition.duration === "0s" || transition.property === "none").toBe(true);
  });

  test("the length does not change with the display size or the view", async ({ page }) => {
    await open(page);
    await startShortTimer(page);
    await page.clock.runFor(90_000);
    await page.locator(".timerDock").getByRole("button", { name: "一時停止" }).click();
    const base = (await lineState(page))!.renderedPercent;
    await page.evaluate(() => {
      const control = (
        window as unknown as {
          __LIFE_LAUNCHER_VISUAL_QA__: {
            currentConfig: () => { settings: { mainDisplaySize: string } };
            updateConfig: (config: unknown) => void;
          };
        }
      ).__LIFE_LAUNCHER_VISUAL_QA__;
      const config = control.currentConfig();
      config.settings.mainDisplaySize = "xlarge";
      control.updateConfig(config);
    });
    // 設定の反映はタイマーで走るので、止めた時計を少し進める
    await page.clock.runFor(500);
    await expect(page.locator(".mainPanel")).toHaveAttribute("data-main-display-size", "xlarge");
    expect((await lineState(page))!.renderedPercent).toBeCloseTo(base, 0);
    await page.getByRole("button", { name: "記録ビューを開く" }).click();
    await expect(page.locator(".recordsView")).toBeVisible();
    expect((await lineState(page))!.renderedPercent).toBeCloseTo(base, 0);
  });
});
