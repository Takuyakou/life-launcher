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
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function expectBarEdgeClick(
  page: Page,
  headerSelector: string,
  buttonName: string,
  dialogName: string,
) {
  const header = page.locator(headerSelector);
  const button = page.getByRole("button", { name: buttonName, exact: true });
  for (const edge of ["top", "bottom"] as const) {
    await button.scrollIntoViewIfNeeded();
    const headerBox = await header.boundingBox();
    const buttonBox = await button.boundingBox();
    if (!headerBox || !buttonBox) throw new Error("Header add action is not measurable");
    await page.mouse.click(
      buttonBox.x + buttonBox.width / 2,
      edge === "top" ? headerBox.y + 2 : headerBox.y + headerBox.height - 2,
    );
    const dialog = page.getByRole("dialog", { name: dialogName });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
  }
}

test("Phase 8.1 separates Project metadata from the NextStep execution package", async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await expect(dialog.getByRole("textbox", { name: "プロジェクト名" })).toBeFocused();
  await expect(dialog.getByText("目標（任意）", { exact: true })).toBeVisible();
  const headings = await dialog.getByRole("heading", { level: 3 }).allTextContents();
  expect(headings).toEqual(["基本", "見た目"]);
  await expect(dialog.getByRole("textbox", { name: "行動" })).toHaveCount(0);
  await dialog.getByRole("textbox", { name: "プロジェクト名" }).fill("監査用プロジェクト");
  await dialog.getByRole("textbox", { name: "目標（任意）" }).fill("1つ完成する");
  await dialog.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  let saved = (await config(page)).projects.at(-1)!;
  expect(saved).toMatchObject({
    name: "監査用プロジェクト",
    northStar: "1つ完成する",
  });
  expect(saved.nextStep).toBeUndefined();

  const row = page.locator(`[data-project-id="${saved.id}"]`);
  await row.getByRole("button", { name: "次の一手を設定" }).click();
  const nextStepDialog = page.getByRole("dialog", { name: "次の一手を設定" });
  await expect(nextStepDialog.getByRole("textbox", { name: "行動" })).toBeFocused();
  expect(await nextStepDialog.getByRole("heading", { level: 3 }).allTextContents()).toEqual([
    "プロジェクト",
    "次の一手の決め方",
    "開始環境",
    "手順書",
    "タイマー",
  ]);
  await nextStepDialog.getByRole("textbox", { name: "行動" }).fill("最初の行を書く");
  await nextStepDialog
    .getByRole("textbox", { name: "始めるきっかけ（任意）" })
    .fill("PCを開いたら");
  await nextStepDialog.getByRole("button", { name: "保存", exact: true }).click();
  saved = (await config(page)).projects.at(-1)!;
  expect(saved.nextStep).toMatchObject({ text: "最初の行を書く", trigger: "PCを開いたら" });
});

test("P8 instruction picker searches, applies and cancels a draft", async ({ page }) => {
  await prepare(page);
  await page
    .locator('[data-project-id="sample-learning"] .nextStepActionRegion')
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手を編集", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "次の一手を編集" });
  await editor.getByRole("button", { name: "手順書を選ぶ" }).click();
  let picker = page.getByRole("dialog", { name: "手順書を選ぶ" });
  await expect(picker.getByRole("searchbox", { name: "手順書を検索" })).toBeFocused();
  await picker.getByRole("searchbox", { name: "手順書を検索" }).fill("guide");
  await expect(picker.getByRole("option", { name: /guide\.md/ })).toBeVisible();
  await picker.getByRole("option", { name: "手順書なし" }).click();
  const instructionCancel = picker.getByRole("button", { name: "キャンセル" });
  await instructionCancel.hover();
  await expect(instructionCancel).toHaveCSS("background-color", "rgb(74, 48, 42)");
  await instructionCancel.click();
  await expect(editor.locator(".instructionPickerSelection")).toContainText("guide.md");
  await editor.getByRole("button", { name: "手順書を選ぶ" }).click();
  picker = page.getByRole("dialog", { name: "手順書を選ぶ" });
  await picker.getByRole("option", { name: "手順書なし" }).click();
  const instructionApply = picker.getByRole("button", { name: "選択", exact: true });
  await instructionApply.hover();
  await expect(instructionApply).toHaveCSS("background-color", "rgb(48, 66, 53)");
  await instructionApply.click();
  await expect(editor.locator(".instructionPickerSelection")).toContainText("選択されていません");
  await expect(editor.getByRole("checkbox", { name: "開始時に手順書を開く" })).toBeDisabled();

  await editor.getByRole("button", { name: "開始環境を選ぶ" }).click();
  const environmentPicker = page.getByRole("dialog", { name: "開始環境を選ぶ" });
  const environmentApply = environmentPicker.getByRole("button", { name: "選択", exact: true });
  const environmentCancel = environmentPicker.getByRole("button", { name: "キャンセル" });
  await environmentApply.hover();
  await expect(environmentApply).toHaveCSS("background-color", "rgb(48, 66, 53)");
  await environmentCancel.hover();
  await expect(environmentCancel).toHaveCSS("background-color", "rgb(74, 48, 42)");
  await environmentCancel.click();
});

test("P8 add actions are independent and available from source bars", async ({ page }) => {
  await prepare(page);
  const projectDisclosure = page.locator(".projectsBand .disclosure");
  const projectAdd = page.getByRole("button", { name: "プロジェクトを追加", exact: true });
  await expect(projectDisclosure).toHaveAttribute("aria-expanded", "true");
  await expectBarEdgeClick(
    page,
    ".projectsBand .disclosureHeader",
    "プロジェクトを追加",
    "プロジェクトを追加",
  );
  await expect(projectDisclosure).toHaveAttribute("aria-expanded", "true");
  await projectAdd.click();
  await expect(projectDisclosure).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("dialog", { name: "プロジェクトを追加" })
    .getByRole("button", { name: "キャンセル" })
    .click();
  await page.locator(".projectsBand .disclosureHeader").click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを追加" }).click();
  await expect(page.getByRole("dialog", { name: "プロジェクトを追加" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".nextStepProjectRegion").first().click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "やりたいことを追加" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator(".nextStepActionRegion").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手を編集" }).click();
  await expect(page.getByRole("dialog", { name: "次の一手を編集" })).toBeVisible();
  await page.keyboard.press("Escape");

  const wishlistDisclosure = page.locator(".inboxBand .disclosure");
  if ((await wishlistDisclosure.getAttribute("aria-expanded")) === "false") {
    await wishlistDisclosure.click();
  }
  await expect(wishlistDisclosure).toHaveAttribute("aria-expanded", "true");
  await expectBarEdgeClick(
    page,
    ".inboxBand .disclosureHeader",
    "やりたいことを追加",
    "やりたいことを追加",
  );
  await expect(wishlistDisclosure).toHaveAttribute("aria-expanded", "true");
  await page.locator("[data-inbox-header]").click({ button: "right" });
  await page.getByRole("menuitem", { name: "やりたいことを追加" }).click();
  await expect(page.getByRole("dialog", { name: "やりたいことを追加" })).toBeVisible();
  await page.keyboard.press("Escape");
  if ((await wishlistDisclosure.getAttribute("aria-expanded")) === "false")
    await wishlistDisclosure.click();
  await expect(page.locator(".inboxBody")).toBeVisible();
  await page.locator(".inboxRow").first().click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "やりたいことを追加" })).toHaveCount(0);
});

test("P8 form actions fit at 860 and use apply/cancel semantics", async ({ page }) => {
  await prepare(page, 860);
  await page.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await dialog.getByRole("textbox", { name: "プロジェクト名" }).fill("hover確認");
  const actions = dialog.locator(".formDialogActions");
  const save = actions.getByRole("button", { name: "プロジェクトを追加" });
  const cancel = actions.getByRole("button", { name: "キャンセル" });
  await expect(save).toHaveClass(/primaryButton/);
  await expect(cancel).toHaveClass(/dialogCancelButton/);
  await save.hover();
  await expect(save).toHaveCSS("background-color", "rgb(48, 66, 53)");
  await cancel.hover();
  await expect(cancel).toHaveCSS("background-color", "rgb(74, 48, 42)");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
});
