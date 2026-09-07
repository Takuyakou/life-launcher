import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_DIR = resolve("docs/phase6.2/screenshots");

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

test("Records headings explain their exact data scope", async ({ page }) => {
  await prepare(page);
  const records = await openRecords(page);

  await expect(records).toContainText("先週のセッションに記録されたプロジェクト");
  await expect(records).toContainText("今週優先して進めるプロジェクトを最大3件まで選びます");
  await expect(records).toContainText("次の一手を14日以上更新・確認していないプロジェクト");
  await expect(records).toContainText("今後の候補から外した、完了済みの項目");
  await expect(records.locator(".recordsInlineHeading")).toHaveCount(4);

  await records.screenshot({ path: resolve(SCREENSHOT_DIR, "p62-04-records-1440.png") });
});

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
  await records.screenshot({ path: resolve(SCREENSHOT_DIR, "p62-04-records-860.png") });
});

test("Guide describes the Phase 6.2 lifecycle and remains bounded", async ({ page }) => {
  await prepare(page, withRecordsDetails(), { width: 860, height: 700 });
  await page.getByRole("button", { name: "使い方" }).click();
  const guide = page.getByRole("dialog", { name: "使い方" });
  await expect(guide).toBeVisible();

  const daily = guide.locator('[data-help-section-id="daily-flow"]');
  await expect(daily).toContainText(
    "やりたいことや各Projectの次の一手を登録しておくと、「今日を組み立てる」に候補として表示されます。",
  );
  const launcher = guide.locator('[data-help-section-id="launcher"]');
  await expect(launcher).toContainText("辞書に移動");
  await expect(launcher).toContainText("サイドバーに移動");
  const today = guide.locator('[data-help-section-id="today"]');
  await expect(today).toContainText("今日の候補から外す");
  await expect(today).toContainText("翌日に候補へ戻ります");
  const projects = guide.locator('[data-help-section-id="projects"]');
  await expect(projects).toContainText("完了にする");
  await expect(projects).toContainText("右クリックして「今日へ」");
  await expect(projects).toContainText("開始環境は検索できる選択画面で最大2件");
  const records = guide.locator('[data-help-section-id="records"]');
  await expect(records).toContainText("今日の3件の完了やSessionとは別の履歴");

  const box = await guide.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x + box!.width).toBeLessThanOrEqual(860);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
  await guide.screenshot({ path: resolve(SCREENSHOT_DIR, "p62-04-guide-860.png") });
});

test("Canonical spec contains current labels and the NextStep context Today path", async () => {
  const spec = await readFile(resolve("docs/spec/current-spec.md"), "utf8");
  expect(spec).toContain("今日の候補から外す");
  expect(spec).toContain("辞書に移動");
  expect(spec).toContain("サイドバーに移動");
  expect(spec).toContain("完了snapshot");
  expect(spec).toContain("最大2件");
  expect(spec).toContain("行の右クリックにある「今日へ」");
  expect(spec).not.toContain("サイドバーへ追加");
  expect(spec).not.toContain("「今日へ」で今日の3件へ移せる");
});
