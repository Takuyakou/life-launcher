import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SECTION_TITLES = [
  "3分で使ってみる",
  "最初に覚える5つ",
  "今日やるものを選ぶ",
  "今日の使い方",
  "Timerと完了",
  "開始環境と手順書ビューアー",
  "Quickと辞書",
  "記録を見る",
  "設定とデータを守る",
  "困ったとき",
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

test("Guide has the beginner ten-section structure and a five-step start", async ({ page }) => {
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

  await expect(sections.first().locator(".helpGuideSteps > li")).toHaveCount(5);
  await expect(sections.first()).toContainText("＋ プロジェクト");
  await expect(sections.first()).toContainText("次の一手を設定");
  await expect(sections.first()).toContainText("＋ 今日やるものを選ぶ");
  await expect(sections.first()).toContainText("5分");
  await expect(sections.first()).toContainText("実行記録へ残ります");
});

test("Guide uses current labels and explains the first journey without internal contracts", async ({
  page,
}) => {
  const dialog = await openGuide(page);
  const text = await dialog.innerText();

  for (const label of [
    "プロジェクト",
    "次の一手",
    "やりたいこと",
    "今日の3件",
    "今やる一手",
    "実行記録",
    "ふりかえり",
    "今週を決める",
    "すべての記録",
    "手順書ビューアー",
  ]) {
    expect(text).toContain(label);
  }

  expect(text).toContain("本を10ページ読む");
  expect(text).toContain("今日の3件へ選んでも、元の次の一手・やりたいことは消えません");
  expect(text).toContain("3件目を選ぶと、その内容で自動的に決定");
  expect(text).toContain("終了時刻を決めず、0:00から取り組んだ時間を数えます");
  expect(text).toContain("Mainの「辞書を開く」か設定したショートカット（初期値はCtrl+K）");
  expect(text).toContain("Escや閉じるボタンは表示だけを閉じ、Timerは続きます");
  expect(text).toContain("初期状態ではオフです");
  expect(text).toContain("「次の一手を見る」を押すと次の候補へ進みます");
  expect(text).toContain("表示をタイル・リスト");
  expect(text).toContain("アイコンサイズを自動・小・中・大");
  expect(text).toContain("ZIPから復元");
  expect(text).toContain("Mainを閉じてもtrayで動作を続けます");
  expect(text).not.toContain("source identity");
  expect(text).not.toContain("rollback");
  expect(text).not.toContain("legacy");
  expect(text).not.toContain("手順書ビューワー");
  expect(text).not.toContain("作曲");
  expect(text).not.toContain("ChatGPTへの自動送信");
  expect(text).not.toContain("外部サービスへ自動送信");

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
    "1.3.0",
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
  expect(specification).toContain("章は「3分で使ってみる」");
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
