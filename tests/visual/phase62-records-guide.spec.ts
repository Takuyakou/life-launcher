import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test.describe.configure({ mode: "serial" });

function withRecordsDetails(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.staleProjectIds = ["sample-learning"];
  fixture.config.sourceCompletions = [
    {
      id: "completion-records-copy",
      sourceType: "nextStep",
      sourceIdentity: "project:completed-copy",
      textSnapshot: "完了履歴に表示する長い日本語の項目名を確認する",
      projectId: "sample-learning",
      projectNameSnapshot: "サンプル学習",
      completedAt: "2026-08-13T08:15:00+09:00",
    },
  ];
  return fixture;
}

async function prepare(
  page: Page,
  fixture: VisualQaFixture = withRecordsDetails(),
  viewport = { width: 1440, height: 900 },
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
}

async function openRecords(page: Page) {
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  const records = page.locator(".recordsView");
  await expect(records).toBeVisible();
  return records;
}


test("Records explanations wrap without horizontal overflow at 860px", async ({ page }) => {
  await prepare(page, withRecordsDetails(), { width: 860, height: 700 });
  const records = await openRecords(page);
  for (const heading of await records.locator(".recordsInlineHeading").all()) {
    const box = await heading.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(860);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});

test("Guide remains bounded at the narrow viewport", async ({ page }) => {
  await prepare(page, withRecordsDetails(), { width: 860, height: 700 });
  await page.getByRole("button", { name: "使い方" }).click();
  const guide = page.getByRole("dialog", { name: "使い方" });
  await expect(guide).toBeVisible();


  const box = await guide.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(860);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
