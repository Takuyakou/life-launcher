import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture = createPublicFixture(), width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.emulateMedia({ reducedMotion: "no-preference" });
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

async function saveCount(page: Page) {
  return page.evaluate(
    () =>
      (
        window as Window & {
          __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string }> };
        }
      ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === "save_config")
        .length,
  );
}

async function beginDrag(page: Page, source: Locator, distance: number) {
  const box = await source.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.45;
  const y = box!.y + box!.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + distance, y);
}

test("follow-up: Today3 body is a drag surface and editing stays in canonical actions", async ({
  page,
}) => {
  await prepare(page);
  const row = page.locator(".todayRow").first();
  const body = row.locator(".todayTextButton");
  const before = await saveCount(page);

  await body.click();
  await expect(page.getByRole("textbox", { name: "今日の項目" })).toHaveCount(0);
  expect(await saveCount(page)).toBe(before);

  const box = await body.boundingBox();
  expect(box).not.toBeNull();
  await beginDrag(page, body, 4);
  await expect(page.locator(".todayDragGhost")).toHaveCount(0);
  await page.mouse.move(box!.x + box!.width * 0.45 + 8, box!.y + box!.height * 0.5);
  await expect(page.locator(".todayDragGhost")).toBeVisible();
  await page.mouse.up();

  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "プロジェクト編集", exact: true })).toBeVisible();
  await page.getByRole("dialog").getByRole("button", { name: "キャンセル", exact: true }).click();

  await row.hover();
  await row.locator(".todayRowMenu").click();
  await page.getByRole("menuitem", { name: "編集", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "プロジェクト編集", exact: true })).toBeVisible();
});

test("follow-up: waiting clock shares vertical drag state and is disabled once active", async ({
  page,
}) => {
  await prepare(page);
  const clock = page.locator(".timerDock .timerClock");
  const input = page.getByRole("spinbutton", { name: "通常タイマーの分数" });
  await expect(clock).toHaveText("25分");
  await expect(clock).toHaveAttribute("title", "上下にドラッグして分数を変更");
  await expect(clock).toHaveCSS("cursor", "ns-resize");

  const beforeClick = await saveCount(page);
  await clock.click();
  expect(await saveCount(page)).toBe(beforeClick);
  await expect(input).toHaveValue("25");

  const box = await clock.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width / 2;
  const y = box!.y + box!.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y - 16);
  await expect(clock).toHaveText("27分");
  await expect(input).toHaveValue("27");
  expect(await saveCount(page)).toBe(beforeClick);
  await page.mouse.up();
  await expect.poll(() => saveCount(page)).toBe(beforeClick + 1);
  expect((await currentConfig(page)).settings.defaultTimerMinutes).toBe(27);

  const updatedBox = await clock.boundingBox();
  expect(updatedBox).not.toBeNull();
  const updatedX = updatedBox!.x + updatedBox!.width / 2;
  const updatedY = updatedBox!.y + updatedBox!.height / 2;
  await page.mouse.move(updatedX, updatedY);
  await page.mouse.down();
  await page.mouse.move(updatedX, updatedY + 16);
  await expect(clock).toHaveText("25分");
  await expect(input).toHaveValue("25");
  expect(await saveCount(page)).toBe(beforeClick + 1);
  await page.mouse.up();
  await expect.poll(() => saveCount(page)).toBe(beforeClick + 2);
  expect((await currentConfig(page)).settings.defaultTimerMinutes).toBe(25);

  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: /通常タイマー25分で開始/ })
    .click();
  await expect(clock).not.toHaveClass(/timerClock--adjustable/);
  await expect(clock).not.toHaveAttribute("title");
  await page.locator(".timerDock").getByRole("button", { name: "一時停止" }).click();
  await expect(clock).toHaveClass(/timerClock--paused/);
  await expect(clock).not.toHaveClass(/timerClock--adjustable/);
});

test("follow-up: excluded source reveals Builder guidance only after the 6px threshold", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.candidateExcludedSourceKeys = ["project:sample-stretch"];
  await prepare(page, fixture);
  const source = page.locator(".nextStepRow", { hasText: "5分だけ体を動かす" });
  const before = await saveCount(page);
  const box = await source.boundingBox();
  expect(box).not.toBeNull();

  await beginDrag(page, source, 4);
  await expect(page.locator(".projectDragGhost")).toHaveCount(0);
  await expect(page.locator(".todayBuilderBand--restoreTarget")).toHaveCount(0);
  await page.mouse.move(box!.x + box!.width * 0.45 + 8, box!.y + box!.height * 0.5);
  await expect(page.locator(".projectDragGhost")).toBeVisible();
  await expect(page.locator(".todayBuilderBand--restoreTarget")).toBeVisible();
  await expect(page.locator(".todayBuilderRestoreDropZone")).toHaveText(
    /ここにドロップして今日の候補に戻す/,
  );
  await expect(page.locator(".todayBuilderBand--restoreHover")).toHaveCount(0);
  expect(await saveCount(page)).toBe(before);
  await page.screenshot({
    path: "dist/visual-qa/followup-dnd-guidance-1440.png",
    fullPage: true,
  });
  await page.keyboard.press("Escape");
  await expect(page.locator(".todayBuilderBand--restoreTarget")).toHaveCount(0);
  await page.mouse.up();
  expect(await saveCount(page)).toBe(before);
});

test("follow-up: Builder guidance is absent for an existing member", async ({ page }) => {
  await prepare(page);
  const source = page.locator(".nextStepRow", { hasText: "5分だけ体を動かす" });
  await beginDrag(page, source, 8);
  await expect(page.locator(".projectDragGhost")).toBeVisible();
  await expect(page.locator(".todayBuilderBand--restoreTarget")).toHaveCount(0);
  await expect(page.locator(".todayBuilderRestoreDropZone")).toHaveCount(0);
  await page.mouse.up();
});

test("follow-up: valid Builder candidate reveals Today guidance before target hover", async ({
  page,
}) => {
  await prepare(page);
  await page.locator(".todayBuilderDisclosure").click();
  const source = page.locator(".todayBuilderRow", { hasText: "5分だけ体を動かす" });
  const todayGrid = page.locator(".todayGrid");
  const gridBefore = await todayGrid.boundingBox();
  const before = await saveCount(page);
  await beginDrag(page, source, 8);
  await expect(page.locator(".todayBuilderDragGhost")).toBeVisible();
  await expect(page.locator(".todayBuilderDragGhost button")).toHaveCount(0);
  await expect(todayGrid).toHaveClass(/todayGrid--dropGuidance/);
  const guidance = page.locator(".todayDropGuidanceOverlay");
  await expect(guidance).toBeVisible();
  await expect(guidance).toHaveText(/ここにドロップして「今日の3件」に追加/);
  const guidanceStyle = await guidance.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      backgroundColor: style.backgroundColor,
      borderStyle: style.borderStyle,
      display: style.display,
    };
  });
  expect(guidanceStyle).toMatchObject({
    borderStyle: "dashed",
    display: "flex",
  });
  expect(guidanceStyle.backgroundColor).toMatch(/^rgba\(231, 185, 77, 0\.0/);
  const gridAfter = await todayGrid.boundingBox();
  expect(gridAfter).toEqual(gridBefore);
  await expect(page.locator(".todayGrid--dropTarget")).toHaveCount(0);
  await expect(page.locator(".todayDropIndicator")).toHaveCount(0);
  expect(await saveCount(page)).toBe(before);
  await page.screenshot({
    path: "dist/visual-qa/followup-builder-to-today-guidance-1440.png",
    fullPage: true,
  });
  await page.mouse.up();
  await expect(page.locator(".todayDropGuidanceOverlay")).toHaveCount(0);
  expect(await saveCount(page)).toBe(before);
});

test("follow-up: full Today suppresses destination guidance", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items.push({ text: "3件目", done: false, sourceKey: "manual:third" });
  await prepare(page, fixture);
  await page.locator(".todayBuilderDisclosure").click();
  await beginDrag(page, page.locator(".todayBuilderRow", { hasText: "5分だけ体を動かす" }), 8);
  await expect(page.locator(".todayBuilderDragGhost")).toBeVisible();
  await expect(page.locator(".todayGrid--dropGuidance")).toHaveCount(0);
  await expect(page.locator(".todayDropGuidanceOverlay")).toHaveCount(0);
  await page.mouse.up();
});

test("follow-up: duplicate Today source suppresses destination guidance", async ({ page }) => {
  await prepare(page);
  await page.locator(".todayBuilderDisclosure").click();
  await beginDrag(page, page.locator(".todayBuilderRow", { hasText: "資料を1ページ読む" }), 8);
  await expect(page.locator(".todayBuilderDragGhost")).toBeVisible();
  await expect(page.locator(".todayGrid--dropGuidance")).toHaveCount(0);
  await expect(page.locator(".todayDropGuidanceOverlay")).toHaveCount(0);
  await page.mouse.up();
});

test("follow-up: key controls remain contained at 100, 125 and 150 percent DPI", async ({
  browser,
}) => {
  for (const deviceScaleFactor of [1, 1.25, 1.5]) {
    const context = await browser.newContext({
      colorScheme: "dark",
      deviceScaleFactor,
      locale: "ja-JP",
      reducedMotion: "no-preference",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await prepare(page);
    const clock = page.locator(".timerDock .timerClock");
    await expect(clock).toHaveCSS("cursor", "ns-resize");
    await page
      .locator(".todayRow")
      .first()
      .getByRole("button", { name: "今日の3件から外す" })
      .click();
    const toast = page.locator(".toast").last();
    await toast.evaluate((node) => {
      for (const animation of node.getAnimations()) animation.finish();
    });
    const toastBox = await toast.boundingBox();
    expect(toastBox).not.toBeNull();
    expect(toastBox!.x + toastBox!.width).toBeLessThanOrEqual(1440);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(1440);
    await context.close();
  }
});

for (const width of [1440, 860]) {
  test(
    "follow-up: Warm Rich Toast and forward lifetime remain contained at " + width,
    async ({ page }) => {
      await prepare(page, createPublicFixture(), width);
      await page
        .locator(".todayRow")
        .first()
        .getByRole("button", { name: "今日の3件から外す" })
        .click();
      const toast = page.locator(".toast", { hasText: "今日の3件から外しました" }).last();
      await expect(toast).toBeVisible();
      await expect(toast).toHaveCSS("--toast-duration", "8000ms");
      await expect(toast.locator(".toastIconBadge")).toHaveCSS("width", "34px");
      await expect(toast.locator(".toastIconBadge")).toHaveCSS("height", "34px");
      await expect(toast).toHaveCSS("border-radius", "11px");
      const borderColors = await toast.evaluate((node) => {
        const style = getComputedStyle(node);
        return [style.borderTopColor, style.borderRightColor, style.borderBottomColor];
      });
      expect(new Set(borderColors).size).toBe(1);
      const railInsets = await toast.locator(".toastAccent").evaluate((node) => {
        const style = getComputedStyle(node);
        return [style.top, style.bottom];
      });
      expect(railInsets).toEqual(["10px", "10px"]);
      const frames = await toast.locator(".toastLifetime").evaluate((node) => {
        const animation = node.getAnimations()[0];
        const effect = animation?.effect as KeyframeEffect | null;
        return effect?.getKeyframes().map((frame) => frame.transform);
      });
      expect(frames?.[0]).toBe("scaleX(0)");
      expect(frames?.at(-1)).toBe("scaleX(1)");
      const stackBox = await page.locator(".toastStack").boundingBox();
      expect(stackBox).not.toBeNull();
      expect(Math.abs(width - (stackBox!.x + stackBox!.width) - 18)).toBeLessThan(1);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
      await page.screenshot({
        path: "dist/visual-qa/followup-warm-rich-" + width + ".png",
        fullPage: true,
      });
      await toast.getByRole("button", { name: "元に戻す" }).click();
      await expect(page.locator(".toast", { hasText: "元に戻しました" }).last()).toHaveCSS(
        "--toast-duration",
        "4000ms",
      );
    },
  );
}
