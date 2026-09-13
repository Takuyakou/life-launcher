import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function config(page: Page): Promise<AppConfig> {
  return page.evaluate(() => (window as Window & {
    __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => AppConfig };
  }).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig());
}

test("P8 entry form uses user vocabulary and preserves schema fields", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "取り組みを追加", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "取り組みを追加" });
  await expect(dialog.getByRole("textbox", { name: "取り組み名" })).toBeFocused();
  await expect(dialog.getByText("目標（任意）", { exact: true })).toBeVisible();
  await expect(dialog.getByText("次にこの取り組みを開いたとき、最初にやる1つだけ決めます")).toBeVisible();
  const headings = await dialog.getByRole("heading", { level: 3 }).allTextContents();
  expect(headings).toEqual(["基本", "次にやること", "開始環境", "タイマー", "見た目"]);
  await dialog.getByRole("textbox", { name: "取り組み名" }).fill("監査用の取り組み");
  await dialog.getByRole("textbox", { name: "目標（任意）" }).fill("1つ完成する");
  await dialog.getByRole("textbox", { name: "次にやること", exact: true }).fill("最初の行を書く");
  await dialog.getByRole("textbox", { name: "始めるきっかけ（任意）" }).fill("PCを開いたら");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  const saved = (await config(page)).projects.at(-1)!;
  expect(saved).toMatchObject({
    name: "監査用の取り組み",
    northStar: "1つ完成する",
    nextStep: "最初の行を書く",
    nextStepTrigger: "PCを開いたら",
  });
  expect(saved).not.toHaveProperty("goal");
  expect(saved).not.toHaveProperty("nextAction");
});

test("P8 instruction picker searches, applies and cancels a draft", async ({ page }) => {
  await prepare(page);
  await page.locator('[data-project-id="sample-learning"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "取り組みを編集" });
  await editor.getByRole("button", { name: "手順書を選ぶ" }).click();
  let picker = page.getByRole("dialog", { name: "手順書を選ぶ" });
  await expect(picker.getByRole("searchbox", { name: "手順書を検索" })).toBeFocused();
  await picker.getByRole("searchbox", { name: "手順書を検索" }).fill("guide");
  await expect(picker.getByRole("option", { name: /guide\.md/ })).toBeVisible();
  await picker.getByRole("option", { name: "手順書なし" }).click();
  await picker.getByRole("button", { name: "キャンセル" }).click();
  await expect(editor.locator(".instructionPickerSelection")).toContainText("guide.md");
  await editor.getByRole("button", { name: "手順書を選ぶ" }).click();
  picker = page.getByRole("dialog", { name: "手順書を選ぶ" });
  await picker.getByRole("option", { name: "手順書なし" }).click();
  await picker.getByRole("button", { name: "選択を反映" }).click();
  await expect(editor.locator(".instructionPickerSelection")).toContainText("選択されていません");
  await expect(editor.getByRole("checkbox", { name: "開始時に手順書を開く" })).toBeDisabled();
});

test("P8 add actions are independent and available from bars and rows", async ({ page }) => {
  await prepare(page);
  const projectDisclosure = page.locator(".projectsBand .disclosure");
  const projectAdd = page.getByRole("button", { name: "取り組みを追加", exact: true });
  await expect(projectDisclosure).toHaveAttribute("aria-expanded", "true");
  await projectAdd.click();
  await expect(projectDisclosure).toHaveAttribute("aria-expanded", "true");
  await page.getByRole("dialog", { name: "取り組みを追加" }).getByRole("button", { name: "キャンセル" }).click();
  await page.locator(".projectsBand .disclosureHeader").click({ button: "right" });
  await page.getByRole("menuitem", { name: "取り組みを追加" }).click();
  await expect(page.getByRole("dialog", { name: "取り組みを追加" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".nextStepRow").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "取り組みを追加" }).click();
  await expect(page.getByRole("dialog", { name: "取り組みを追加" })).toBeVisible();
  await page.keyboard.press("Escape");

  const wishlistDisclosure = page.locator(".inboxBand .disclosure");
  await expect(wishlistDisclosure).toHaveAttribute("aria-expanded", "false");
  await page.locator("[data-inbox-header]").click({ button: "right" });
  await page.getByRole("menuitem", { name: "やりたいことを追加" }).click();
  await expect(page.getByRole("dialog", { name: "やりたいことを追加" })).toBeVisible();
  await page.keyboard.press("Escape");
  if (await wishlistDisclosure.getAttribute("aria-expanded") === "false") await wishlistDisclosure.click();
  await expect(page.locator(".inboxBody")).toBeVisible();
  await page.locator(".inboxRow").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "やりたいことを追加" }).click();
  await expect(page.getByRole("dialog", { name: "やりたいことを追加" })).toBeVisible();
});

test("P8 form actions fit at 860 and use apply/cancel semantics", async ({ page }) => {
  await prepare(page, 860);
  await page.getByRole("button", { name: "取り組みを追加", exact: true }).click();
  const actions = page.getByRole("dialog", { name: "取り組みを追加" }).locator(".formDialogActions");
  await expect(actions.getByRole("button", { name: "保存" })).toHaveClass(/primaryButton/);
  await expect(actions.getByRole("button", { name: "キャンセル" })).toHaveClass(/dialogCancelButton/);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});