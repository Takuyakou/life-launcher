import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaControl = {
  currentConfig: () => AppConfig;
  setSaveConfigFailure: (failed: boolean) => void;
};

type QaWindow = Window & { __LIFE_LAUNCHER_VISUAL_QA__: QaControl };

const INSTRUCTION_PATH = "C:\\PublicDemo\\Instructions\\guide.md";

async function prepare(page: Page) {
  const fixture = createPublicFixture();
  fixture.config.projects[0].nextStep = {
    text: "資料を1ページ読む",
    generationId: "gen-edit-1",
    trigger: "サンプル資料",
    buttonIds: ["sample-documents"],
    shortTimerMinutes: 7,
    defaultTimerMinutes: 30,
    instructionPath: INSTRUCTION_PATH,
    instructionOpenOnStart: true,
    startNoteTemplate: "メモ",
    expandTimerOnStart: true,
  };
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".focusBand")).toBeVisible();
  return fixture;
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    return control.currentConfig();
  });
}

async function setSaveFailure(page: Page, shouldFail: boolean) {
  await page.evaluate((value) => {
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(value);
  }, shouldFail);
}

async function openEditor(page: Page) {
  await page
    .locator('.nextStepRow[data-project-id="sample-learning"]')
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手を編集", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "次の一手を編集" });
  await expect(editor).toBeVisible();
  return editor;
}

const actionInput = (editor: ReturnType<typeof openEditor>) =>
  editor.locator('input[aria-label="行動"]');

test("P10-10 the editor loads every field it already has", async ({ page }) => {
  await prepare(page);
  const editor = await openEditor(page);

  await expect(actionInput(editor)).toHaveValue("資料を1ページ読む");
  await expect(editor.getByLabel(/始めるきっかけ/)).toHaveValue("サンプル資料");
  await expect(editor.locator('input[aria-label="短時間タイマー分数"]')).toHaveValue("7");
  await expect(editor.locator('input[aria-label="通常タイマー分数"]')).toHaveValue("30");
  await expect(editor.locator(".nextStepOpenChip", { hasText: "サンプル資料" })).toHaveCount(1);
  await expect(editor.locator(".nextStepOpenChip", { hasText: "guide.md" })).toHaveCount(1);
  await expect(editor.getByRole("checkbox", { name: "開始時に手順書を開く" })).toBeChecked();
  await expect(
    editor.getByRole("checkbox", { name: "開始時にタイマーを大きく表示" }),
  ).toBeChecked();
  await expect(editor.getByLabel(/開始noteテンプレート/)).toHaveValue("メモ");
  await expect(editor.getByText(/Ctrl\s*\+\s*Enter/)).toHaveCount(0);
});

test("P10-10 saving the editor changes only its own Next Step fields", async ({ page }) => {
  const before = await prepare(page);
  const editor = await openEditor(page);

  await actionInput(editor).fill("資料を2ページ読む");
  await editor.getByLabel(/始めるきっかけ/).fill("夜");
  await editor.locator('input[aria-label="短時間タイマー分数"]').fill("8");
  await editor.locator('input[aria-label="通常タイマー分数"]').fill("31");
  await editor.locator(".nextStepOpenChip", { hasText: "guide.md" })
    .getByRole("button", { name: /を外す/ })
    .click();
  await editor.getByRole("checkbox", { name: "開始時にタイマーを大きく表示" }).uncheck();
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editor).toHaveCount(0);

  const saved = await currentConfig(page);
  expect(saved.projects[0].nextStep).toMatchObject({
    text: "資料を2ページ読む",
    trigger: "夜",
    buttonIds: ["sample-documents"],
    shortTimerMinutes: 8,
    defaultTimerMinutes: 31,
    startNoteTemplate: "メモ",
    generationId: "gen-edit-1",
  });
  expect(saved.projects[0].nextStep?.instructionPath).toBeUndefined();
  expect(saved.projects[0].nextStep?.instructionOpenOnStart).toBeUndefined();
  expect(saved.projects[0].nextStep?.expandTimerOnStart).toBeUndefined();
  expect(saved.projects.slice(1)).toEqual(before.config.projects.slice(1));
  expect(saved.inbox).toEqual(before.config.inbox);
  expect(saved.today).toEqual(before.config.today);
});

test("P10-10 the editor save failure keeps the form open", async ({ page }) => {
  await prepare(page);
  const editor = await openEditor(page);
  await actionInput(editor).fill("保存に失敗する一手");

  await setSaveFailure(page, true);
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editor).toBeVisible();
  await expect(page.locator(".toast", { hasText: "保存できません" })).toBeVisible();
  expect((await currentConfig(page)).projects[0].nextStep?.text).toBe("資料を1ページ読む");

  await setSaveFailure(page, false);
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect((await currentConfig(page)).projects[0].nextStep?.text).toBe("保存に失敗する一手");
});

test("P10-10 the add menu opens the existing button and instruction pickers", async ({ page }) => {
  await prepare(page);
  const editor = await openEditor(page);
  await expect(editor.locator(".nextStepOpenChip")).toHaveCount(2);

  await editor.getByRole("button", { name: "＋ ボタン・手順書を足す" }).click();
  await editor.getByRole("menuitem", { name: "ボタンを選ぶ" }).click();
  const buttonPicker = page.getByRole("dialog", { name: "開始環境を選ぶ" });
  await expect(buttonPicker).toBeVisible();
  await buttonPicker.getByRole("option", { name: /参考サイト/ }).click();
  await buttonPicker.getByRole("button", { name: "選択", exact: true }).click();
  await expect(buttonPicker).toHaveCount(0);
  await expect(editor.locator(".nextStepOpenChip")).toHaveCount(3);
  await expect(editor.locator(".nextStepOpenChip", { hasText: "参考サイト" })).toHaveCount(1);

  await editor.getByRole("button", { name: "＋ ボタン・手順書を足す" }).click();
  await editor.getByRole("menuitem", { name: "手順書を選ぶ" }).click();
  const instructionPicker = page.getByRole("dialog", { name: "手順書を選ぶ" });
  await expect(instructionPicker).toBeVisible();
  await instructionPicker.getByRole("option", { name: "手順書なし" }).click();
  await instructionPicker.getByRole("button", { name: "選択", exact: true }).click();
  await expect(instructionPicker).toHaveCount(0);
  await expect(editor.locator(".nextStepOpenChip")).toHaveCount(2);
  await expect(editor.getByRole("checkbox", { name: "開始時に手順書を開く" })).toBeDisabled();

  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editor).toHaveCount(0);
  const saved = (await currentConfig(page)).projects[0].nextStep!;
  expect(saved.buttonIds).toEqual(["sample-documents", "reference-site"]);
  expect(saved.instructionPath).toBeUndefined();
});
