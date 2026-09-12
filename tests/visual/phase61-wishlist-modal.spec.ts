import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test.describe.configure({ mode: "serial" });

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

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    return control.currentConfig();
  });
}

async function setSaveFailure(page: Page, failed: boolean) {
  await page.evaluate((nextFailed) => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: {
          setSaveConfigFailure: (shouldFail: boolean) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    control?.setSaveConfigFailure(nextFailed);
  }, failed);
}

async function saveConfigCount(page: Page): Promise<number> {
  return page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { invokeCalls: Array<{ command: string }> };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    return control?.invokeCalls.filter((call) => call.command === "save_config").length ?? 0;
  });
}

function wishlistAddButton(page: Page) {
  return page.getByRole("button", { name: "やりたいことを追加" });
}

function wishlistDialog(page: Page) {
  return page.getByRole("dialog", { name: "やりたいことを追加" });
}

test("Wishlist add uses one compact modal and saves once on a double click", async ({ page }) => {
  const fixture = createPublicFixture();
  const initialCount = fixture.config.inbox.length;
  await prepare(page, fixture);
  const opener = wishlistAddButton(page);
  await opener.click();

  const dialog = wishlistDialog(page);
  const input = dialog.getByRole("textbox", { name: "やりたいこと" });
  await expect(dialog).toBeVisible();
  await expect(page.locator(".inboxAddRow")).toHaveCount(0);
  await expect(input).toBeFocused();
  await expect(input).toHaveAttribute("maxlength", "120");
  await expect(dialog.getByRole("button", { name: "保存" })).toBeDisabled();
  await input.fill("気になっていた本を読む");
  const beforeSaves = await saveConfigCount(page);
  await dialog.getByRole("button", { name: "保存" }).evaluate((button) => {
    button.click();
    button.click();
  });

  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect(await saveConfigCount(page)).toBe(beforeSaves + 1);
  const config = await currentConfig(page);
  expect(config.inbox).toHaveLength(initialCount + 1);
  expect(config.inbox.at(-1)).toMatchObject({ text: "気になっていた本を読む" });
  expect(config.inbox.at(-1)?.id).toBeTruthy();

  await page.locator(".todayBuilderDisclosure").click();
  await expect(page.locator(".todayBuilderRow", { hasText: "気になっていた本を読む" })).toBeVisible();
});

test("Wishlist cancel, Escape, and backdrop discard the draft and return focus", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  const initialItems = structuredClone(fixture.config.inbox);
  await prepare(page, fixture);
  const opener = wishlistAddButton(page);

  await opener.click();
  let dialog = wishlistDialog(page);
  const firstInput = dialog.getByRole("textbox", { name: "やりたいこと" });
  const cancelButton = dialog.getByRole("button", { name: "キャンセル" });
  await page.keyboard.press("Shift+Tab");
  await expect(cancelButton).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(firstInput).toBeFocused();
  await firstInput.fill("キャンセルする入力");
  await cancelButton.click();
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  await opener.click();
  dialog = wishlistDialog(page);
  const reopenedInput = dialog.getByRole("textbox", { name: "やりたいこと" });
  await expect(reopenedInput).toHaveValue("");
  await reopenedInput.fill("Escapeで閉じる入力");
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();

  await opener.click();
  dialog = wishlistDialog(page);
  await dialog.getByRole("textbox", { name: "やりたいこと" }).fill("外側で閉じる入力");
  await page.locator(".modalBackdrop").click({ position: { x: 2, y: 2 } });
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  expect((await currentConfig(page)).inbox).toEqual(initialItems);
});

test("Wishlist IME confirmation does not submit until a later Enter", async ({ page }) => {
  const fixture = createPublicFixture();
  const initialCount = fixture.config.inbox.length;
  await prepare(page, fixture);
  await wishlistAddButton(page).click();
  const dialog = wishlistDialog(page);
  const input = dialog.getByRole("textbox", { name: "やりたいこと" });
  await input.fill("日本語変換中の入力");
  const beforeSaves = await saveConfigCount(page);

  await input.dispatchEvent("compositionstart");
  await input.dispatchEvent("keydown", {
    key: "Enter",
    code: "Enter",
    keyCode: 13,
    isComposing: true,
    bubbles: true,
    cancelable: true,
  });
  await expect(dialog).toBeVisible();
  expect(await saveConfigCount(page)).toBe(beforeSaves);

  await input.dispatchEvent("compositionend");
  await input.press("Enter");
  await expect(dialog).toHaveCount(0);
  expect((await currentConfig(page)).inbox).toHaveLength(initialCount + 1);
});

test("Wishlist save failure keeps the dialog and draft for retry", async ({ page }) => {
  const fixture = createPublicFixture();
  const initialCount = fixture.config.inbox.length;
  await prepare(page, fixture);
  await setSaveFailure(page, true);
  await wishlistAddButton(page).click();
  const dialog = wishlistDialog(page);
  const input = dialog.getByRole("textbox", { name: "やりたいこと" });
  await input.fill("失敗後も残す入力");
  await dialog.getByRole("button", { name: "保存" }).click();

  await expect(dialog).toBeVisible();
  await expect(input).toHaveValue("失敗後も残す入力");
  await expect(dialog.getByRole("alert")).toContainText("内容を残したまま");
  expect((await currentConfig(page)).inbox).toHaveLength(initialCount);

  await setSaveFailure(page, false);
  await dialog.getByRole("button", { name: "保存" }).click();
  await expect(dialog).toHaveCount(0);
  expect((await currentConfig(page)).inbox).toHaveLength(initialCount + 1);
});

test("Wishlist modal stays within the narrow viewport without horizontal overflow", async ({
  page,
}) => {
  await prepare(page, createPublicFixture(), { width: 860, height: 700 });
  for (const viewport of [{ width: 860, height: 700 }]) {
    await page.setViewportSize(viewport);
    await wishlistAddButton(page).click();
    const dialog = wishlistDialog(page);
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(box!.y + box!.height).toBeLessThanOrEqual(viewport.height);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).toHaveCount(0);
  }
});

test("Project add labels describe the real target and editing preserves unrelated fields", async ({ page }) => {
  await prepare(page);
  const projectOpener = page.getByRole("button", { name: "プロジェクトを追加" });
  await projectOpener.click();
  let projectDialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await expect(projectDialog).toContainText("取り組みと、次にやることを登録します。");
  await expect(projectDialog.getByRole("textbox", { name: "プロジェクト名" })).toBeFocused();
  await expect(projectDialog.getByRole("textbox", { name: "次の一手", exact: true })).toBeVisible();
  await expect(projectDialog.getByRole("spinbutton", { name: "プロジェクトの短時間タイマー分数" })).toBeVisible();
  await projectDialog.getByRole("button", { name: "キャンセル" }).click();

  const before = (await currentConfig(page)).projects.find(
    (project) => project.id === "sample-learning",
  );
  expect(before).toBeTruthy();
  await page.locator('[data-project-id="sample-learning"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集" }).click();
  projectDialog = page.getByRole("dialog", { name: "プロジェクト編集" });
  await projectDialog.getByRole("textbox", { name: /^次の一手/ }).fill("更新した一手");
  await projectDialog.getByRole("button", { name: "保存" }).click();
  const after = (await currentConfig(page)).projects.find(
    (project) => project.id === "sample-learning",
  );
  expect(after).toMatchObject({
    id: before!.id,
    buttonIds: before!.buttonIds,
    instructionPath: before!.instructionPath,
    instructionOpenOnStart: before!.instructionOpenOnStart,
    nextStep: "更新した一手",
  });
});
