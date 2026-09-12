import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture, width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function config(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function saveCount(page: Page) {
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string }> };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === "save_config")
      .length,
  );
}

async function drag(
  page: Page,
  source: Locator,
  target: Locator,
  xRatio = 0.5,
  yRatio = 0.5,
  autoScroll = false,
) {
  if (autoScroll) await source.scrollIntoViewIfNeeded();
  const from = await source.boundingBox();
  let to = await target.boundingBox();
  expect(from).not.toBeNull();
  expect(to).not.toBeNull();
  await page.mouse.move(from!.x + from!.width * 0.45, from!.y + from!.height * 0.5);
  await page.mouse.down();
  await page.mouse.move(from!.x + from!.width * 0.45 + 12, from!.y + from!.height * 0.5, {
    steps: 2,
  });
  if (autoScroll) {
    const scrollArea = page.locator(".mainScrollArea");
    const scrollBox = await scrollArea.boundingBox();
    const before = await scrollArea.evaluate((node) => node.scrollTop);
    expect(scrollBox).not.toBeNull();
    await page.mouse.move(scrollBox!.x + scrollBox!.width * 0.5, scrollBox!.y + 4, { steps: 4 });
    await page.clock.fastForward(650);
    await expect.poll(() => scrollArea.evaluate((node) => node.scrollTop)).toBeLessThan(before);
    await target.scrollIntoViewIfNeeded();
    to = await target.boundingBox();
  }
  await page.mouse.move(to!.x + to!.width * xRatio, to!.y + to!.height * yRatio, { steps: 6 });
}

for (const width of [1920, 860]) {
  test(`P72-04 Builder adopts into Today by actual card geometry at ${width}`, async ({ page }) => {
    const fixture = createPublicFixture();
    await prepare(page, fixture, width);
    await page.locator(".todayBuilderDisclosure").click();
    const source = page.locator(".todayBuilderRow", { hasText: "5分だけ体を動かす" });
    const target = page.locator(".todayRow").first();
    const before = await saveCount(page);
    await drag(page, source, target, 0.2, 0.35, width === 860);
    await expect(page.locator(".todayBuilderDragGhost--today")).toBeVisible();
    await expect(page.locator(".todayBuilderDragGhost button")).toHaveCount(0);
    await expect(page.locator(".todayGrid--dropTarget")).toBeVisible();
    await expect(page.locator(".todayDropIndicator")).toBeVisible();
    expect(await saveCount(page)).toBe(before);
    await page.mouse.up();
    await expect.poll(() => saveCount(page)).toBe(before + 1);
    const current = await config(page);
    expect(current.today.items[0].sourceKey).toBe("project:sample-stretch");
    expect(current.projects.some((project) => project.id === "sample-stretch")).toBe(true);
  });
}

test("P72-04 excluded source restores to a closed Builder after 500ms and saves once", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.candidateExcludedSourceKeys = ["project:sample-stretch"];
  await prepare(page, fixture);
  const source = page.locator(".nextStepRow", { hasText: "5分だけ体を動かす" });
  const target = page.locator(".todayBuilderHeader");
  const before = await saveCount(page);
  await drag(page, source, target);
  await expect(page.locator(".todayBuilderBand--restoreTarget")).toBeVisible();
  await expect(page.locator(".todayBuilderBand--restoreHover")).toBeVisible();
  await expect(page.locator(".todayBuilderRestoreDropZone--active")).toBeVisible();
  await expect(page.locator(".todayBuilderRestoreDropZone")).toHaveText(
    /ここにドロップして今日の候補に戻す/,
  );
  expect(await saveCount(page)).toBe(before);
  await page.clock.fastForward(510);
  await expect(page.locator(".todayBuilderDisclosure")).toHaveAttribute("aria-expanded", "true");
  await page.mouse.up();
  await expect.poll(() => saveCount(page)).toBe(before + 1);
  const current = await config(page);
  expect(current.today.candidateExcludedSourceKeys).not.toContain("project:sample-stretch");
  expect(current.projects.some((project) => project.id === "sample-stretch")).toBe(true);
  await expect(page.locator(".todayBuilderRow", { hasText: "5分だけ体を動かす" })).toBeVisible();
});


test("P72-04 Builder membership is checked across non-visible pages", async ({ page }) => {
  const fixture = createPublicFixture();
  const template = fixture.config.projects[0];
  fixture.config.projects = [
    ...Array.from({ length: 5 }, (_, index) => ({
      ...template,
      id: `extra-${index}`,
      name: `追加 ${index}`,
      nextStep: `追加候補 ${index}`,
      weeklyFocus: false,
    })),
    ...fixture.config.projects,
  ];
  await prepare(page, fixture);
  await page.locator(".projectsBand .sourceListControls button").click();
  await expect(page.locator(".todayBuilderHeader")).toContainText("9件");
  const before = await saveCount(page);
  await drag(
    page,
    page.locator(".nextStepRow", { hasText: "5分だけ体を動かす" }),
    page.locator(".todayBuilderHeader"),
  );
  await expect(page.locator(".todayBuilderBand--restoreTarget")).toHaveCount(0);
  await page.mouse.up();
  expect(await saveCount(page)).toBe(before);
});

test("P72-04 restore failure keeps exclusion and source, with no optimistic move", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.candidateExcludedSourceKeys = ["wishlist:sample-later"];
  await prepare(page, fixture);
  await page.locator(".inboxBand .disclosure").click();
  await page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { setSaveConfigFailure: (value: boolean) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true),
  );
  const before = await saveCount(page);
  await drag(
    page,
    page.locator(".inboxRow", { hasText: "あとで確認するサンプル" }),
    page.locator(".todayBuilderHeader"),
    0.5,
    0.5,
    true,
  );
  await page.mouse.up();
  await expect.poll(() => saveCount(page)).toBe(before + 1);
  const current = await config(page);
  expect(current.today.candidateExcludedSourceKeys).toContain("wishlist:sample-later");
  expect(current.inbox.some((item) => item.id === "sample-later")).toBe(true);
  await expect(page.locator(".toast").last()).toContainText("保存できません");
});

test("P72-04 Escape cancels a restore drag and closes only its temporary Builder", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.candidateExcludedSourceKeys = ["project:sample-stretch"];
  await prepare(page, fixture);
  const before = await saveCount(page);
  await drag(
    page,
    page.locator(".nextStepRow", { hasText: "5分だけ体を動かす" }),
    page.locator(".todayBuilderHeader"),
  );
  await page.clock.fastForward(510);
  await expect(page.locator(".todayBuilderDisclosure")).toHaveAttribute("aria-expanded", "true");
  await page.keyboard.press("Escape");
  await expect(page.locator(".projectDragGhost")).toHaveCount(0);
  await expect(page.locator(".todayBuilderBand--restoreTarget")).toHaveCount(0);
  await expect(page.locator(".todayBuilderDisclosure")).toHaveAttribute("aria-expanded", "false");
  await page.mouse.up();
  expect(await saveCount(page)).toBe(before);
});

test("P72-04 full Today and action buttons reject cross drag without mutation", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items.push({ text: "3件目", done: false, sourceKey: "manual:third" });
  await prepare(page, fixture);
  await page.locator(".todayBuilderDisclosure").click();
  const before = await saveCount(page);
  await drag(
    page,
    page.locator(".todayBuilderRow", { hasText: "5分だけ体を動かす" }),
    page.locator(".todayRow").first(),
  );
  await expect(page.locator(".todayDropIndicator")).toHaveCount(0);
  await page.mouse.up();
  expect(await saveCount(page)).toBe(before);
  expect((await config(page)).today.items).toHaveLength(3);

  await page.locator(".todayBuilderRow", { hasText: "5分だけ体を動かす" })
    .getByRole("button", { name: /の操作/ })
    .hover();
  await page.mouse.down();
  await page.mouse.move(20, 20, { steps: 3 });
  await expect(page.locator(".todayBuilderDragGhost")).toHaveCount(0);
  await page.mouse.up();
});

test("P72-04 active Timer source rejects Builder adoption", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  await prepare(page, fixture);
  await page.locator(".todayBuilderDisclosure").click();
  const builderRow = page.locator(".todayBuilderRow", { hasText: "5分だけ体を動かす" });
  await builderRow.getByRole("button", { name: "今日へ", exact: true }).click();
  const todayRow = page.locator(".todayRow", { hasText: "5分だけ体を動かす" });
  await todayRow.getByRole("button", { name: /短時間タイマー5分で開始/ }).click();
  await expect(todayRow).toHaveClass(/todayRow--running/);
  const before = await saveCount(page);
  await drag(page, builderRow, page.locator(".todayRow").first());
  await expect(page.locator(".todayGrid--dropGuidance")).toHaveCount(0);
  await expect(page.locator(".todayDropIndicator")).toHaveCount(0);
  await page.mouse.up();
  expect(await saveCount(page)).toBe(before);
  expect((await config(page)).today.items).toHaveLength(2);
});

test("P72-04 date change at drop rejects a stale drag", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  await page.locator(".todayBuilderDisclosure").click();
  const before = await saveCount(page);
  await drag(
    page,
    page.locator(".todayBuilderRow", { hasText: "5分だけ体を動かす" }),
    page.locator(".todayRow").first(),
  );
  await page.evaluate(() => {
    const qa = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          currentConfig: () => AppConfig;
          updateConfig: (config: AppConfig) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    const next = structuredClone(qa.currentConfig());
    next.today.date = "2026-08-14";
    qa.updateConfig(next);
  });
  await page.clock.fastForward(260);
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );
  await page.mouse.up();
  expect(await saveCount(page)).toBe(before);
  expect((await config(page)).today.items).toHaveLength(2);
});

test("P72-04 pointercancel clears preview and never saves", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  await page.locator(".todayBuilderDisclosure").click();
  const source = page.locator(".todayBuilderRow", { hasText: "5分だけ体を動かす" });
  const before = await saveCount(page);
  await drag(page, source, page.locator(".todayRow").first());
  await expect(page.locator(".todayBuilderDragGhost")).toBeVisible();
  await source.dispatchEvent("pointercancel", { pointerId: 1 });
  await expect(page.locator(".todayBuilderDragGhost")).toHaveCount(0);
  await page.mouse.up();
  expect(await saveCount(page)).toBe(before);
});
