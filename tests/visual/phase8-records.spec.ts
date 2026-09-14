import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(
  page: Page,
  fixture: VisualQaFixture = createPublicFixture(),
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

function withHistory(): VisualQaFixture {
  const fixture = createPublicFixture();
  const project = fixture.config.projects.find((item) => item.id === "sample-learning");
  if (!project) throw new Error("sample project is missing");
  project.nextStep = {
    ...project.nextStep!,
    text: "現在の次の一手は履歴へ表示しない",
  };
  fixture.sessionEntries.entries = Array.from({ length: 7 }, (_, index) => ({
    rowKey: `history-${index + 1}`,
    id: `history-${index + 1}`,
    date: `2026-08-${String(13 - index).padStart(2, "0")}`,
    projectId: project.id,
    label: project.name,
    startedAt: `0${8 + (index % 2)}:40`,
    minutes: 10 + index,
    note: index === 1 ? "" : `保存済みの実行内容 ${index + 1}`,
    manual: false,
  }));
  fixture.sessionSummary.projects = [
    { projectId: project.id, label: project.name, activeDays: 7, totalMinutes: 91 },
  ];
  fixture.sessionSummary.allTimeProjects = [
    { projectId: project.id, label: project.name, activeDays: 7, totalMinutes: 91 },
  ];
  return fixture;
}

test("records opens on review and keeps the three information layers separate", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.sourceCompletions = [];
  await prepare(page, fixture);
  const records = await openRecords(page);

  await expect(records.getByRole("tab", { name: "ふりかえり" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(records.getByText("今日", { exact: true })).toBeVisible();
  await expect(records.getByText("今週", { exact: true })).toBeVisible();
  await expect(records.getByText("活動日数", { exact: true })).toBeVisible();
  await expect(records.getByText("完了した項目", { exact: true })).toHaveCount(0);

  await records.getByRole("tab", { name: "今週を決める" }).click();
  await expect(records.getByRole("heading", { name: "先週のふりかえり" })).toBeVisible();
  await expect(records.getByRole("heading", { name: "今週の重点" })).toBeVisible();
  await expect(records.getByText("今日", { exact: true })).toHaveCount(0);

  await records.getByRole("button", { name: "メイン" }).click();
  await expect(page.locator(".doNowBand")).toBeVisible();
});

test("project histories use stored action snapshots and paginate each cumulative list by five", async ({
  page,
}) => {
  await prepare(page, withHistory());
  const records = await openRecords(page);
  const summaries = records.locator(".recordsAccordionSummary").filter({ hasText: "サンプル学習" });

  await summaries.nth(0).click();
  await expect(records.getByText("保存済みの実行内容 1", { exact: true })).toBeVisible();
  await expect(records.getByText("実行内容の記録なし", { exact: true })).toBeVisible();
  await expect(records.getByText("現在の次の一手は履歴へ表示しない", { exact: true })).toHaveCount(0);

  await summaries.nth(1).click();
  const cumulativeSection = records.locator(".recordsSection").filter({
    hasText: "プロジェクト別累計",
  });
  const cumulative = cumulativeSection.locator(".recordsAccordion").first();
  await expect(cumulative.locator(".recordsActionHistoryRow")).toHaveCount(5);
  await expect(cumulative.getByText("保存済みの実行内容 1", { exact: true })).toBeVisible();
  await cumulative.getByRole("button", { name: "2", exact: true }).click();
  await expect(cumulative.locator(".recordsActionHistoryRow")).toHaveCount(2);
  await expect(cumulative.getByText("保存済みの実行内容 7", { exact: true })).toBeVisible();
  await expect(records.locator(".recordsAccordion").nth(0).getByText("保存済みの実行内容 1", { exact: true })).toBeVisible();
});

test("all records supports filters, keyboard context actions and execution-record dialogs", async ({
  page,
}) => {
  await prepare(page);
  const records = await openRecords(page);
  await records.getByRole("tab", { name: "すべての記録" }).click();

  const search = records.getByRole("textbox", { name: "実行記録を検索" });
  await search.fill("資料の要点");
  await expect(records.locator(".recordsCompactRow")).toHaveCount(1);
  await search.fill("");
  await records.getByRole("button", { name: "ストレッチ", exact: true }).click();
  await expect(records.locator(".recordsCompactRow")).toHaveCount(1);

  const row = records.locator(".recordsCompactRow").first();
  await row.focus();
  await row.press("Shift+F10");
  await page.getByRole("menuitem", { name: "編集" }).click();
  const editDialog = page.getByRole("dialog", { name: "実行記録を編集" });
  await expect(editDialog.getByText("プロジェクト", { exact: true })).toBeVisible();
  await expect(editDialog.getByText("実行内容", { exact: true })).toBeVisible();
  await expect(editDialog.locator(".formDialogActions button")).toHaveText(["保存", "キャンセル"]);
  await editDialog.getByRole("button", { name: "キャンセル" }).click();

  await records.getByRole("button", { name: "実行記録を追加" }).click();
  const addDialog = page.getByRole("dialog", { name: "実行記録を追加" });
  await expect(addDialog.getByText("プロジェクト", { exact: true })).toBeVisible();
  await expect(addDialog.getByText("実行内容", { exact: true })).toBeVisible();
  await expect(addDialog.locator(".formDialogActions button")).toHaveText(["追加", "キャンセル"]);
});

test("older notes stay collapsed until requested", async ({ page }) => {
  await prepare(page);
  const records = await openRecords(page);
  await records.getByRole("tab", { name: "すべての記録" }).click();
  const older = records.locator(".recordsOlderNotes");

  await expect(older).not.toHaveAttribute("open", "");
  await expect(older.locator("input")).toHaveCount(3);
  await expect(older.locator("input").first()).not.toBeVisible();
  await older.getByText("以前のメモ", { exact: true }).click();
  await expect(older.getByRole("textbox").first()).toBeVisible();
});

for (const viewport of [
  { width: 860, height: 700 },
  { width: 520, height: 760 },
]) {
  test(`records remains within ${viewport.width}px and exposes row actions on focus`, async ({ page }) => {
    await prepare(page, withHistory(), viewport);
    const records = await openRecords(page);
    await records.getByRole("tab", { name: "すべての記録" }).click();
    const row = records.locator(".recordsCompactRow").first();
    const menu = row.locator(".recordsSessionMenuButton");
    await row.focus();
    await expect(menu).toHaveCSS("opacity", "1");
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
}
