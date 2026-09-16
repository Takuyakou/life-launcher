import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SECTION_TITLES = [
  "まず始める",
  "毎日の基本",
  "今日やるものを選ぶ",
  "今日の3件",
  "Timerと完了",
  "開始環境と手順書",
  "辞書 / Quick",
  "記録と今週の見直し",
  "設定とデータ",
  "Life Launcherがしないこと",
];

async function openGuide(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await page.getByRole("button", { name: "使い方" }).click();
  const dialog = page.getByRole("dialog", { name: "使い方" });
  await expect(dialog).toBeVisible();
  return dialog;
}

test("Guide has the current ten-section structure and a three-step start", async ({ page }) => {
  const dialog = await openGuide(page);
  const navigation = dialog.getByRole("navigation", { name: "使い方の目次" });
  const buttons = navigation.getByRole("button");
  const sections = dialog.locator(".helpGuideSection");

  await expect(buttons).toHaveCount(SECTION_TITLES.length);
  await expect(sections).toHaveCount(SECTION_TITLES.length);

  for (let index = 0; index < SECTION_TITLES.length; index += 1) {
    await expect(buttons.nth(index)).toContainText(SECTION_TITLES[index]);
    await expect(
      sections.nth(index).getByRole("heading", { name: SECTION_TITLES[index] }),
    ).toBeVisible();
  }

  await expect(sections.first().locator(".helpGuideSteps > li")).toHaveCount(3);
  await expect(sections.first()).toContainText("今やる一手をそのまま始めます");
  await expect(sections.first()).toContainText("今日やるものを選ぶ");
  await expect(sections.first()).toContainText("実行記録を残します");
});

test("Guide uses current labels and explains the Phase 8.2 state contracts", async ({ page }) => {
  const dialog = await openGuide(page);
  const text = await dialog.innerText();

  for (const label of [
    "プロジェクト",
    "目標",
    "次の一手",
    "始めるきっかけ",
    "実行記録",
    "他の一手",
    "✓ 今日の3件",
    "ふりかえり",
    "今週を決める",
    "すべての記録",
  ]) {
    expect(text).toContain(label);
  }

  expect(text).toContain("候補が2件以上");
  expect(text).toContain("優先順や保存データは書き換えません");
  expect(text).toContain("今週の重点は優先順位を上げますが、候補を限定しません");
  expect(text).toContain("↓ ここにドロップして今日の3件から外す");
  expect(text).toContain("各プロジェクト0〜1件の再開地点");
  expect(text).toContain("次の一手とは独立した順");
  expect(text).toContain("所属のない項目は「未分類」にまとまります");
  expect(text).toContain("やりたいことへ戻す");
  expect(text).toContain("「計測」は0:00から実行時間を数え");
  expect(text).toContain("計測を含む現在の1本を終了してから");
  expect(text).toContain("選択ページ、focus層、最後の項目、スクロール位置を復元");
  expect(text).toContain("次の一手の右クリックには完了操作はありません");
  expect(text).not.toContain(
    "次の一手・やりたいこと自体を候補から終える場合は、それぞれの右クリック",
  );

  for (const stale of [
    "初回セットアップ",
    "30秒で分かる毎日の使い方",
    "週次コーチ用プロンプト",
    "最近のセッション",
    "セッションを追加",
  ]) {
    expect(text).not.toContain(stale);
  }
});

test("Overview and current spec stay concise and synchronized", () => {
  const overview = readFileSync("docs/OVERVIEW.md", "utf8");
  const specification = readFileSync("docs/spec/current-spec.md", "utf8");

  expect(overview.trimEnd().split(/\r?\n/).length).toBeLessThanOrEqual(100);
  for (const text of [
    "v1.3候補",
    "プロジェクト",
    "実行記録",
    "ふりかえり",
    "今週を決める",
    "すべての記録",
    "計測",
  ]) {
    expect(overview).toContain(text);
    expect(specification).toContain(text);
  }

  expect(specification).toContain("active pageは表示対象を決める状態");
  expect(specification).toContain("再表示時の検索語は復元せず空に戻す");
  expect(specification).toContain("章は「まず始める」");
  expect(specification).toContain("迷ったときに戻る「再開地点」");
  expect(specification).toContain("＋ 今日やるものを選ぶ");
  expect(specification).toContain("候補を限定するfilterにはしない");
  expect(specification).toContain("次の一手のProject表示順とは同期しない");
  expect(specification).toContain("所属のない項目は同じ独立順の「未分類」");
  expect(specification).toContain("古い一手を「やりたいことへ戻す」「完了にする」「キャンセル」");
  expect(specification).toContain("計測は0:00から実効経過時間を増やし");
  expect(specification).toContain("計測に架空の予定時間や進捗率を作らない");
  expect(specification).not.toContain("初期状態は再生アイコン、ホバー時は分数");
});
