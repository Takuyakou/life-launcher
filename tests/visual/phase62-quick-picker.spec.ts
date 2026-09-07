import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import type { AppConfig, LauncherButton } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_DIR = resolve("docs/phase6.2/screenshots");

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
  await page.evaluate((value) => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: {
          setSaveConfigFailure: (shouldFail: boolean) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    control?.setSaveConfigFailure(value);
  }, failed);
}

function buttonSnapshot(config: AppConfig, buttonId: string) {
  const button = config.buttons.find((item) => item.id === buttonId);
  if (!button) throw new Error(`${buttonId} not found`);
  return structuredClone(button);
}

test("Quick and Dictionary move the same item without deleting its action", async ({ page }) => {
  const fixture = createPublicFixture();
  const original = buttonSnapshot(fixture.config, "sample-editor");
  await prepare(page, fixture);

  const quick = page.locator(".quickButton", { hasText: "サンプルエディター" });
  await quick.focus();
  await quick.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "辞書に移動" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "削除" })).toBeVisible();
  await page.getByRole("menuitem", { name: "辞書に移動" }).click();

  await expect(quick).toHaveCount(0);
  let moved = buttonSnapshot(await currentConfig(page), "sample-editor");
  expect(moved).toMatchObject({ showInSidebar: false, showInOverlay: true });
  expect(moved.actions).toEqual(original.actions);
  expect((await currentConfig(page)).buttons).toHaveLength(fixture.config.buttons.length);

  await page.reload();
  await expect(page.locator(".quickButton", { hasText: "サンプルエディター" })).toHaveCount(0);
  await page.goto("/?view=dictionary");
  const dictionaryTile = page.locator(".dictionaryTile", { hasText: "サンプルエディター" });
  await expect(dictionaryTile).toBeVisible();
  await dictionaryTile.focus();
  await dictionaryTile.press("Shift+F10");
  const moveBack = page.getByRole("menuitem", { name: "サイドバーに移動" });
  await expect(moveBack).toBeEnabled();
  await moveBack.click();

  moved = buttonSnapshot(await currentConfig(page), "sample-editor");
  expect(moved).toMatchObject({ showInSidebar: true, showInOverlay: true });
  expect(moved.actions).toEqual(original.actions);
  await page.goto("/");
  await expect(page.locator(".quickButton", { hasText: "サンプルエディター" })).toBeVisible();
  await page.goto("/?view=dictionary");
  await dictionaryTile.focus();
  await dictionaryTile.press("Shift+F10");
  await expect(page.getByRole("menuitem", { name: "サイドバーに移動" })).toBeDisabled();
});

test("Quick to Dictionary move rolls the display back when saving fails", async ({ page }) => {
  await prepare(page);
  await setSaveFailure(page, true);
  const quick = page.locator(".quickButton", { hasText: "サンプルエディター" });
  await quick.focus();
  await quick.press("Shift+F10");
  await page.getByRole("menuitem", { name: "辞書に移動" }).click();

  await expect(page.getByText(/保存できません/).first()).toBeVisible();
  await expect(quick).toBeVisible();
  const button = buttonSnapshot(await currentConfig(page), "sample-editor");
  expect(button).toMatchObject({ showInSidebar: true, showInOverlay: true });

  await page.goto("/?view=dictionary");
  await setSaveFailure(page, true);
  const dictionaryOnlyTile = page.locator(".dictionaryTile", { hasText: "参考サイト" });
  await dictionaryOnlyTile.focus();
  await dictionaryOnlyTile.press("Shift+F10");
  await page.getByRole("menuitem", { name: "サイドバーに移動" }).click();
  await expect(page.getByRole("alert")).toContainText("保存できません");
  const dictionaryOnly = buttonSnapshot(await currentConfig(page), "reference-site");
  expect(dictionaryOnly).toMatchObject({ showInSidebar: false, showInOverlay: true });
  await setSaveFailure(page, false);
});

test("Project picker preserves order, enforces two selections, and restores focus", async ({
  page,
}) => {
  await prepare(page);
  await page.locator('[data-project-id="sample-learning"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集" }).click();
  const projectDialog = page.getByRole("dialog", { name: "プロジェクト編集" });
  const opener = projectDialog.getByRole("button", { name: "開始環境を選ぶ" });
  await expect(projectDialog.locator(".startEnvironmentSelectedItem")).toHaveCount(1);
  await opener.click();

  let picker = page.getByRole("dialog", { name: "開始環境を選ぶ" });
  await expect(picker.getByRole("searchbox", { name: "開始環境を検索" })).toBeFocused();
  await picker.getByRole("searchbox", { name: "開始環境を検索" }).fill("参考サイト");
  const referenceOption = picker.getByRole("option", { name: /参考サイト/ });
  await referenceOption.press("Enter");
  await expect(referenceOption).toHaveAttribute("aria-selected", "true");
  await picker.getByRole("searchbox", { name: "開始環境を検索" }).fill("");
  const blocked = picker.getByRole("option", { name: /サンプルエディター/ });
  await expect(blocked).toHaveAttribute("aria-disabled", "true");
  await blocked.press("Space");
  await expect(blocked).toHaveAttribute("aria-selected", "false");
  await picker.getByRole("button", { name: "選択を反映" }).click();
  await expect(picker).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(projectDialog.locator(".startEnvironmentSelectedItem")).toHaveCount(2);

  await opener.click();
  picker = page.getByRole("dialog", { name: "開始環境を選ぶ" });
  await picker.getByRole("option", { name: /参考サイト/ }).click();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await expect(opener).toBeFocused();
  await expect(projectDialog.locator(".startEnvironmentSelectedItem")).toHaveCount(2);

  await projectDialog.getByRole("button", { name: "保存" }).click();
  const project = (await currentConfig(page)).projects.find(
    (item) => item.id === "sample-learning",
  );
  expect(project?.buttonIds).toEqual(["sample-documents", "reference-site"]);
});

test("Wishlist edit uses the shared picker and keeps a cancelled picker draft", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.inbox[0].buttonIds = ["sample-editor"];
  await prepare(page, fixture);
  await page.getByRole("button", { name: "やりたいこと", exact: true }).click();
  const row = page.locator(".inboxRow", { hasText: "あとで確認するサンプル" });
  await row.click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集" }).click();
  const wishlistDialog = page.getByRole("dialog", { name: "やりたいこと編集" });
  const opener = wishlistDialog.getByRole("button", { name: "開始環境を選ぶ" });
  await opener.click();
  const picker = page.getByRole("dialog", { name: "開始環境を選ぶ" });
  await picker.getByRole("option", { name: /サンプル資料/ }).click();
  await picker.getByRole("button", { name: "キャンセル" }).click();
  await expect(opener).toBeFocused();
  await expect(wishlistDialog.locator(".startEnvironmentSelectedItem")).toHaveCount(1);
  await wishlistDialog.getByRole("button", { name: "キャンセル" }).click();
  expect((await currentConfig(page)).inbox[0].buttonIds).toEqual(["sample-editor"]);
});

test("Legacy selections over the limit are preserved and picker fits 860 and 1440", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  const longButton: LauncherButton = {
    id: "long-start-environment",
    label: "非常に長い日本語の開始環境名でも横方向にはみ出さず省略表示される確認項目",
    icon: "□",
    group: "長いカテゴリ名の確認用グループ",
    showInSidebar: true,
    showInOverlay: true,
    aliases: [],
    actions: [{ type: "open_file", payload: { path: "C:\\PublicDemo\\long.txt" } }],
  };
  fixture.config.buttons.push(longButton);
  fixture.config.projects[0].buttonIds = ["sample-documents", "sample-editor", "reference-site"];
  await prepare(page, fixture, { width: 860, height: 700 });
  await page.locator('[data-project-id="sample-learning"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集" }).click();
  const projectDialog = page.getByRole("dialog", { name: "プロジェクト編集" });
  await expect(projectDialog.locator(".startEnvironmentCount")).toContainText("3 / 2");
  await projectDialog.getByRole("button", { name: "開始環境を選ぶ" }).click();
  const picker = page.getByRole("dialog", { name: "開始環境を選ぶ" });
  const longOption = picker.getByRole("option", { name: /非常に長い日本語/ });
  await expect(longOption).toHaveAttribute("aria-disabled", "true");
  await longOption.dispatchEvent("click");
  await expect(picker.locator('[role="option"][aria-selected="true"]')).toHaveCount(3);

  for (const viewport of [
    { width: 860, height: 700 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport);
    const box = await picker.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await picker.screenshot({
      path: resolve(SCREENSHOT_DIR, `p62-03-start-environment-${viewport.width}.png`),
    });
  }

  await picker.getByRole("button", { name: "キャンセル" }).click();
  await projectDialog.getByRole("button", { name: "保存" }).click();
  const project = (await currentConfig(page)).projects.find(
    (item) => item.id === "sample-learning",
  );
  expect(project?.buttonIds).toEqual(["sample-documents", "sample-editor", "reference-site"]);
});
