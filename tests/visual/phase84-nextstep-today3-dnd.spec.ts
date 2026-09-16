import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture, width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 1600 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".nextStepCard").first()).toBeVisible();
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

async function beginDrag(page: Page, source: Locator) {
  const box = await source.boundingBox();
  expect(box).not.toBeNull();
  const x = box!.x + box!.width * 0.45;
  const y = box!.y + box!.height * 0.5;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 12, y, { steps: 3 });
}

test("NextStep drag guides and adds into Today3 without removing its source", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [
    {
      text: "机の上を5分だけ整える",
      done: false,
      sourceKey: "manual:fixture-cleanup",
    },
  ];
  await prepare(page, fixture, 860);

  const before = await saveCount(page);
  const source = page.locator('.nextStepCard[data-project-id="sample-stretch"]');
  const target = page.locator(".todayRow").first();
  await beginDrag(page, source);

  const grid = page.locator(".todayGrid");
  await expect(grid).toHaveClass(/todayGrid--dropGuidance/);
  await expect(page.locator(".todayDropGuidanceOverlay")).toHaveText(
    /ここにドロップして「今日の3件」に追加/,
  );
  await expect(page.locator(".projectDragGhost")).toBeVisible();

  const targetBox = await target.boundingBox();
  expect(targetBox).not.toBeNull();
  await page.mouse.move(
    targetBox!.x + targetBox!.width * 0.75,
    targetBox!.y + targetBox!.height * 0.5,
    { steps: 6 },
  );
  await expect(grid).toHaveClass(/todayGrid--dropTarget/);
  await expect(page.locator(".todayDropIndicator")).toBeVisible();
  await expect(page.locator(".projectDragGhost")).toHaveClass(/projectDragGhost--today/);
  await page.mouse.up();

  await expect.poll(() => saveCount(page)).toBe(before + 1);
  const saved = await currentConfig(page);
  expect(saved.today.items).toHaveLength(2);
  expect(saved.today.items[1]).toMatchObject({
    projectId: "sample-stretch",
    sourceKey: "project:sample-stretch",
    text: "5分だけ体を動かす",
  });
  expect(saved.projects.find((project) => project.id === "sample-stretch")?.nextStep?.text).toBe(
    "5分だけ体を動かす",
  );
  await expect(page.locator(".todayDropGuidanceOverlay")).toHaveCount(0);
});

test("NextStep already selected in Today3 does not show yellow adoption guidance", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);

  const before = await saveCount(page);
  const source = page.locator('.nextStepCard[data-project-id="sample-learning"]');
  await beginDrag(page, source);
  await expect(page.locator(".todayGrid--dropGuidance")).toHaveCount(0);
  await expect(page.locator(".todayDropGuidanceOverlay")).toHaveCount(0);
  await page.mouse.up();
  expect(await saveCount(page)).toBe(before);
});
