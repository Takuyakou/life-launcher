import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type InvokeCall = { command: string; args: Record<string, unknown> };

type VisualQaControl = {
  invokeCalls: InvokeCall[];
};

const SCREENSHOT_DIR = resolve("dist/visual-qa/phase83-settings-maintenance");

async function prepare(page: Page, width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => undefined },
    });
  });
  await installTauriMock(page, createPublicFixture());
  await page.goto("/");
  await expect(page.locator("main, [role=main]").first()).toBeVisible();
}

async function openMaintenance(page: Page) {
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings.getByRole("tab", { name: "メンテナンス" }).click();
  return settings;
}

async function commandCount(page: Page, command: string) {
  return page.evaluate(
    (target) =>
      (
        window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
      ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === target).length,
    command,
  );
}

test("P83-01 Settings footer preserves behavior with Save left and Cancel right", async ({
  page,
}) => {
  await prepare(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  const footer = settings.locator(".settingsDialogActions");
  const save = footer.getByRole("button", { name: "保存", exact: true });
  const cancel = footer.getByRole("button", { name: "キャンセル", exact: true });

  await expect(footer.getByRole("button")).toHaveText(["保存", "キャンセル"]);
  const saveBox = await save.boundingBox();
  const cancelBox = await cancel.boundingBox();
  expect(saveBox).not.toBeNull();
  expect(cancelBox).not.toBeNull();
  expect(saveBox!.x).toBeLessThan(cancelBox!.x);
  await expect(save).toHaveClass(/settingsSaveButton/);
  await expect(cancel).toHaveClass(/settingsCancelButton/);
  await expect(save).toBeEnabled();

  await settings.getByRole("tab", { name: "ショートカット" }).click();
  await settings.getByRole("button", { name: "登録", exact: true }).first().click();
  await expect(save).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(save).toBeEnabled();

  await settings.getByRole("tab", { name: "基本" }).click();
  await settings.getByRole("checkbox", { name: "常に手前" }).click();
  await cancel.click();
  await expect(page.getByRole("dialog", { name: "変更を破棄しますか？" })).toBeVisible();
});

test("P83-01 Maintenance groups keep immediate and confirmed handlers", async ({ page }) => {
  await prepare(page);
  const settings = await openMaintenance(page);
  const groups = settings.locator(".maintenanceGroup");

  await expect(groups).toHaveCount(4);
  await expect(groups.locator("h4")).toHaveText([
    "データ・フォルダ",
    "表示・キャッシュ",
    "手順書",
    "初期化",
  ]);

  const data = settings.getByRole("region", { name: "データ・フォルダ" });
  const display = settings.getByRole("region", { name: "表示・キャッシュ" });
  const instructions = settings.getByRole("region", { name: "手順書", exact: true });
  const reset = settings.getByRole("region", { name: "初期化" });

  await expect(data.getByRole("button")).toHaveText([
    "今日の活動ログをコピー",
    "configフォルダを開く",
    "バックアップフォルダを開く",
  ]);
  await expect(display.getByRole("button")).toHaveText([
    "アイコンキャッシュ再生成",
    "ミニウィンドウ位置をリセット",
    "手順書ウィンドウ位置をリセット",
  ]);
  await expect(instructions.getByRole("button")).toHaveText(["手順書一覧を再読み込み"]);
  await expect(reset).toContainText("Life Launcherを初回起動時の状態へ戻します。");
  await expect(reset.getByRole("button")).toHaveText("ソフトウェアリセット...");
  await expect(reset).toHaveClass(/maintenanceGroup--reset/);

  await data.getByRole("button", { name: "今日の活動ログをコピー" }).click();
  await expect(page.locator(".toast").last()).toContainText("今日の活動ログをコピーしました");
  expect(await commandCount(page, "load_session_entries")).toBeGreaterThan(0);

  await data.getByRole("button", { name: "configフォルダを開く" }).click();
  expect(await commandCount(page, "open_data_folder")).toBe(1);
  await expect(page.locator(".toast").last()).toContainText("データフォルダを開きました");
  await data.getByRole("button", { name: "バックアップフォルダを開く" }).click();
  expect(await commandCount(page, "open_config_backups")).toBe(1);
  await expect(page.locator(".toast").last()).toContainText("バックアップフォルダを開きました");

  await display.getByRole("button", { name: "アイコンキャッシュ再生成" }).click();
  let confirmation = page.getByRole("dialog", { name: "アイコンキャッシュを再生成しますか？" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "再生成する", exact: true }).click();
  await expect(page.locator(".toast").last()).toContainText("アイコンキャッシュを再生成しました");
  expect(await commandCount(page, "delete_button_icon_cache")).toBeGreaterThan(0);
  await display.getByRole("button", { name: "ミニウィンドウ位置をリセット" }).click();
  confirmation = page.getByRole("dialog", { name: "ミニウィンドウ位置をリセットしますか？" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "リセットする", exact: true }).click();
  await expect(page.locator(".toast").last()).toContainText("ミニウィンドウ位置をリセットしました");
  expect(await commandCount(page, "save_config")).toBeGreaterThan(0);
  await display.getByRole("button", { name: "手順書ウィンドウ位置をリセット" }).click();
  confirmation = page.getByRole("dialog", {
    name: "手順書ウィンドウ位置をリセットしますか？",
  });
  await expect(confirmation).toBeVisible();
  await expect(
    confirmation.getByRole("button", { name: "リセットする", exact: true }),
  ).toBeEnabled();
  await page.keyboard.press("Escape");

  await instructions.getByRole("button", { name: "手順書一覧を再読み込み" }).click();
  await expect(page.locator(".toast").last()).toContainText("手順書一覧を再読み込みしました");
  expect(await commandCount(page, "plugin:event|emit")).toBeGreaterThan(0);

  const beforeResetClick = await commandCount(page, "software_reset");
  await reset.getByRole("button", { name: "ソフトウェアリセット..." }).click();
  expect(await commandCount(page, "software_reset")).toBe(beforeResetClick);
});

test("P83-01 Maintenance controls follow a complete keyboard tab sequence", async ({ page }) => {
  await prepare(page);
  const settings = await openMaintenance(page);
  const expected = [
    "今日の活動ログをコピー",
    "configフォルダを開く",
    "バックアップフォルダを開く",
    "アイコンキャッシュ再生成",
    "ミニウィンドウ位置をリセット",
    "手順書ウィンドウ位置をリセット",
    "手順書一覧を再読み込み",
    "ソフトウェアリセット...",
    "保存",
    "キャンセル",
  ];

  const first = settings.getByRole("button", { name: expected[0], exact: true });
  await first.focus();
  await expect(first).toBeFocused();
  for (const label of expected.slice(1)) {
    await page.keyboard.press("Tab");
    await expect(settings.getByRole("button", { name: label, exact: true })).toBeFocused();
  }
});

for (const width of [1440, 860] as const) {
  test(`P83-01 Maintenance visual QA at ${width}px`, async ({ page }) => {
    await prepare(page, width);
    const settings = await openMaintenance(page);
    await expect(settings.locator(".maintenanceGroup--reset")).toBeVisible();
    await expect(settings.locator(".settingsDialogActions")).toBeVisible();
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, `maintenance-${width}x900.png`),
    });
  });
}
