import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type InvokeCall = { command: string; args: Record<string, unknown> };

type VisualQaControl = {
  invokeCalls: InvokeCall[];
  currentConfig: () => AppConfig;
  emit: (event: string, payload?: unknown) => void;
  setSaveConfigFailure: (failed: boolean) => void;
  updateConfig: (config: AppConfig) => void;
  releasePendingConfigSave?: () => void;
  setLoadSaveBlocked?: (blocked: boolean) => void;
};

type TauriRuntime = {
  invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
};

async function prepare(
  page: Page,
  fixture: VisualQaFixture = createPublicFixture(),
  route = "/",
  windowLabel = "main",
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, windowLabel);
  await page.goto(route);
  await expect(page.locator("main, [role=main]").first()).toBeVisible();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function saveConfigCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (
        window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
      ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === "save_config")
        .length,
  );
}

async function setSaveFailure(page: Page, failed: boolean) {
  await page.evaluate(
    (value) =>
      (
        window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
      ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(value),
    failed,
  );
}

async function delayNextConfigSave(page: Page) {
  await page.evaluate(() => {
    const runtime = (window as Window & { __TAURI_INTERNALS__: TauriRuntime }).__TAURI_INTERNALS__;
    const control = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    const originalInvoke = runtime.invoke.bind(runtime);
    let release: (() => void) | null = null;
    runtime.invoke = async (command, args = {}) => {
      if (command === "save_config") {
        await new Promise<void>((resolve) => {
          release = resolve;
        });
      }
      return originalInvoke(command, args);
    };
    control.releasePendingConfigSave = () => {
      const pending = release;
      release = null;
      pending?.();
    };
  });
}

async function openProjectEditor(page: Page, projectId: string) {
  await page
    .locator(`[data-project-id="${projectId}"] .nextStepProjectRegion`)
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを編集" }).click();
  return page.getByRole("dialog", { name: "プロジェクトを編集" });
}

async function openNextStepSetter(page: Page, projectId: string) {
  await page
    .locator(`[data-project-id="${projectId}"]`)
    .getByRole("button", { name: "次の一手を設定" })
    .click();
  return page.getByRole("dialog", { name: "次の一手を設定" });
}

async function openWishlistSection(page: Page) {
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") {
    await disclosure.click();
  }
  await expect(page.locator(".inboxBody")).toBeVisible();
}

test("Phase 8.1 creates metadata-only Projects once and keeps a pending save modal open", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  const initialCount = fixture.config.projects.length;
  await prepare(page, fixture);
  await page.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await dialog.getByRole("textbox", { name: "プロジェクト名" }).fill("契約確認プロジェクト");
  await dialog.getByRole("textbox", { name: "目標（任意）" }).fill("入口を分離する");
  await delayNextConfigSave(page);

  const beforeSaves = await saveConfigCount(page);
  await dialog
    .getByRole("button", { name: "プロジェクトを追加", exact: true })
    .evaluate((button) => {
      button.click();
      button.click();
    });
  await expect(dialog.getByRole("button", { name: "保存しています…" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page
    .locator(".modalBackdrop")
    .filter({ has: dialog })
    .click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeVisible();

  await page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.releasePendingConfigSave?.(),
  );
  await expect(dialog).toHaveCount(0);
  expect(await saveConfigCount(page)).toBe(beforeSaves + 1);
  const projects = (await currentConfig(page)).projects;
  expect(projects).toHaveLength(initialCount + 1);
  expect(projects.at(-1)).toMatchObject({
    name: "契約確認プロジェクト",
    northStar: "入口を分離する",
  });
  expect(projects.at(-1)?.nextStep).toBeUndefined();
});

test("Phase 8.1 Project save failure rolls back and leaves the draft available", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  const initialProjects = structuredClone(fixture.config.projects);
  await prepare(page, fixture);
  await page.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await dialog.getByRole("textbox", { name: "プロジェクト名" }).fill("保存失敗プロジェクト");
  await setSaveFailure(page, true);
  await dialog.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();

  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "プロジェクト名" })).toHaveValue(
    "保存失敗プロジェクト",
  );
  expect((await currentConfig(page)).projects).toEqual(initialProjects);
  await setSaveFailure(page, false);
});

test("Phase 8.1 Project metadata edit clears optional values without touching NextStep", async ({
  page,
}) => {
  await prepare(page);
  const before = (await currentConfig(page)).projects.find(
    (project) => project.id === "sample-learning",
  );
  const dialog = await openProjectEditor(page, "sample-learning");
  await dialog.getByRole("textbox", { name: "目標（任意）" }).fill("");
  await dialog.getByRole("checkbox", { name: "今週の重点にする" }).uncheck();
  await dialog.getByRole("radio", { name: "ローズ" }).click();
  await dialog.getByRole("button", { name: "保存", exact: true }).click();

  const after = (await currentConfig(page)).projects.find(
    (project) => project.id === "sample-learning",
  );
  expect(after?.northStar).toBeUndefined();
  expect(after?.weeklyFocus).toBeUndefined();
  expect(after?.colorId).toBe("rose");
  expect(after?.nextStep).toEqual(before?.nextStep);
});

test("Phase 8.1 resolves pending legacy execution settings only after a successful choice", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.projects.push(
    {
      id: "legacy-inherit",
      name: "旧設定を引き継ぐ",
      colorId: "violet",
      legacyNextStepSettings: {
        buttonIds: ["sample-editor"],
        defaultTimerMinutes: 41,
        shortTimerMinutes: 8,
        startNoteTemplate: "旧テンプレート",
        instructionPath: "C:\\PublicDemo\\Instructions\\notes.txt",
        instructionOpenOnStart: false,
      },
    },
    {
      id: "legacy-discard",
      name: "旧設定を破棄する",
      colorId: "cyan",
      legacyNextStepSettings: {
        buttonIds: ["sample-documents"],
        defaultTimerMinutes: 55,
        shortTimerMinutes: 9,
        startNoteTemplate: "破棄対象",
      },
    },
  );
  await prepare(page, fixture);

  let dialog = await openNextStepSetter(page, "legacy-inherit");
  await dialog.getByRole("tab", { name: "＋ 新しく入力" }).click();
  await dialog.getByRole("button", { name: "引き継ぐ" }).click();
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  const pendingAfterCancel = (await currentConfig(page)).projects.find(
    (project) => project.id === "legacy-inherit",
  );
  expect(pendingAfterCancel?.nextStep).toBeUndefined();
  expect(pendingAfterCancel?.legacyNextStepSettings).toMatchObject({
    defaultTimerMinutes: 41,
  });

  dialog = await openNextStepSetter(page, "legacy-inherit");
  await dialog.getByRole("tab", { name: "＋ 新しく入力" }).click();
  await dialog.getByRole("button", { name: "引き継ぐ" }).click();
  await expect(dialog.getByLabel("選択済みの開始環境")).toContainText("サンプルエディター");
  await expect(dialog.getByRole("spinbutton", { name: "通常タイマー分数" })).toHaveValue("41");
  await expect(dialog.getByRole("spinbutton", { name: "短時間タイマー分数" })).toHaveValue("8");
  await dialog.getByRole("textbox", { name: "行動" }).fill("旧設定から始める");
  await setSaveFailure(page, true);
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toBeVisible();
  expect(
    (await currentConfig(page)).projects.find((project) => project.id === "legacy-inherit")
      ?.nextStep,
  ).toBeUndefined();
  await setSaveFailure(page, false);
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  expect(
    (await currentConfig(page)).projects.find((project) => project.id === "legacy-inherit"),
  ).toMatchObject({
    legacyNextStepSettings: undefined,
    nextStep: {
      text: "旧設定から始める",
      buttonIds: ["sample-editor"],
      defaultTimerMinutes: 41,
      shortTimerMinutes: 8,
      startNoteTemplate: "旧テンプレート",
      instructionPath: "C:\\PublicDemo\\Instructions\\notes.txt",
      instructionOpenOnStart: false,
    },
  });

  dialog = await openNextStepSetter(page, "legacy-discard");
  await dialog.getByRole("tab", { name: "＋ 新しく入力" }).click();
  await dialog.getByRole("button", { name: "破棄して全体設定を使う" }).click();
  await dialog.getByRole("textbox", { name: "行動" }).fill("全体設定から始める");
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  const discarded = (await currentConfig(page)).projects.find(
    (project) => project.id === "legacy-discard",
  );
  expect(discarded?.legacyNextStepSettings).toBeUndefined();
  expect(discarded?.nextStep).toMatchObject({ text: "全体設定から始める", buttonIds: [] });
  expect(discarded?.nextStep?.defaultTimerMinutes).toBeUndefined();
  expect(discarded?.nextStep?.shortTimerMinutes).toBeUndefined();
  expect(discarded?.nextStep?.startNoteTemplate).toBeUndefined();
});

test("Phase 8.1 Wishlist promotion starts from a reset execution package", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  const todayBefore = structuredClone(fixture.config.today);
  await prepare(page, fixture);
  await openWishlistSection(page);
  await page.locator('[data-inbox-id="sample-weekend"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手にする" }).click();
  const dialog = page.getByRole("dialog", { name: "次の一手を変更" });

  await expect(dialog.getByRole("textbox", { name: "行動" })).toHaveCount(0);
  await expect(dialog.getByRole("radio", { name: "週末に試すアイデア" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(dialog.getByText("開始環境は選択されていません", { exact: true })).toBeVisible();
  await expect(dialog.getByRole("spinbutton", { name: "通常タイマー分数" })).toHaveValue("");
  await expect(dialog.getByRole("spinbutton", { name: "短時間タイマー分数" })).toHaveValue("");
  await expect(dialog.locator(".instructionPickerSelection")).toContainText("選択されていません");
  await dialog.getByRole("button", { name: "やりたいことへ戻す" }).click();
  await dialog.getByRole("button", { name: "保存", exact: true }).click();

  const config = await currentConfig(page);
  const promoted = config.projects.find((project) => project.id === "sample-learning")?.nextStep;
  expect(promoted).toMatchObject({ text: "週末に試すアイデア", buttonIds: [] });
  expect(promoted?.trigger).toBeUndefined();
  expect(promoted?.instructionPath).toBeUndefined();
  expect(promoted?.defaultTimerMinutes).toBeUndefined();
  expect(promoted?.shortTimerMinutes).toBeUndefined();
  expect(config.inbox.map((item) => item.id)).toEqual(["sample-later", expect.any(String)]);
  expect(config.inbox.at(-1)).toMatchObject({
    text: "資料を1ページ読む",
    projectId: "sample-learning",
  });
  expect(config.sourceCompletions).toEqual([]);
  expect(config.today).toEqual(todayBefore);
  const nativeCalls = await page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) =>
      ["execute_actions", "record_session"].includes(call.command),
    ),
  );
  expect(nativeCalls).toEqual([]);
});

test("Phase 8.1 instruction linking persists, excludes empty Projects, and rejects a stale NextStep", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.projects.push({
    id: "metadata-only",
    name: "次の一手なし",
    colorId: "slate",
  });
  await prepare(page, fixture, "/?view=instruction", "life-launcher-instruction");
  const root = page.locator('.instructionTreeRow[aria-level="1"]').first();
  await root.getByRole("button", { name: "Instructionsを展開する" }).click();
  let notes = page.locator('.instructionTreeRow[aria-level="2"]').filter({ hasText: "notes.txt" });
  await notes.click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手に紐づける" }).click();
  let dialog = page.getByRole("dialog", { name: "次の一手に手順書を紐づける" });
  const select = dialog.getByRole("combobox", { name: "次の一手" });
  await expect(select.locator("option")).toHaveText(["サンプル学習", "ストレッチ"]);
  await expect(select.locator('option[value="metadata-only"]')).toHaveCount(0);
  await select.selectOption("sample-learning");
  await dialog.getByRole("button", { name: "紐づける" }).click();
  expect(
    (await currentConfig(page)).projects.find((project) => project.id === "sample-learning")
      ?.nextStep,
  ).toMatchObject({
    instructionPath: "C:\\PublicDemo\\Instructions\\notes.txt",
    instructionOpenOnStart: true,
  });

  await page.reload();
  const reloadedRoot = page.locator('.instructionTreeRow[aria-level="1"]').first();
  if ((await reloadedRoot.getAttribute("aria-expanded")) !== "true") {
    await reloadedRoot.getByRole("button", { name: "Instructionsを展開する" }).click();
  }
  notes = page.locator('.instructionTreeRow[aria-level="2"]').filter({ hasText: "notes.txt" });
  await notes.click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手に紐づける" }).click();
  dialog = page.getByRole("dialog", { name: "次の一手に手順書を紐づける" });
  await expect(dialog.getByRole("combobox", { name: "次の一手" })).toHaveValue("sample-learning");
  await dialog.getByRole("combobox", { name: "次の一手" }).selectOption("sample-stretch");
  const beforeStaleSave = await saveConfigCount(page);
  await page.evaluate(() => {
    const control = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    control.updateConfig({
      ...config,
      projects: config.projects.map((project) =>
        project.id === "sample-stretch" ? { ...project, nextStep: undefined } : project,
      ),
    });
  });
  await dialog.getByRole("button", { name: "紐づける" }).click();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("status")).toContainText("選択した次の一手が見つかりません");
  expect(await saveConfigCount(page)).toBe(beforeStaleSave);
});

test("Phase 8.1 reload and restore both clear a recovered saveBlocked state", async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    const runtime = (window as Window & { __TAURI_INTERNALS__: TauriRuntime }).__TAURI_INTERNALS__;
    const control = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    const originalInvoke = runtime.invoke.bind(runtime);
    let blocked = false;
    runtime.invoke = async (command, args = {}) => {
      if (command === "select_backup_zip") return "C:\\PublicDemo\\Backups\\restore.zip";
      if (command === "restore_backup") {
        blocked = false;
        const response = (await originalInvoke("load_config", {})) as Record<string, unknown>;
        return { ...response, saveBlocked: false, error: null };
      }
      const response = await originalInvoke(command, args);
      if (command !== "load_config") return response;
      return {
        ...(response as Record<string, unknown>),
        saveBlocked: blocked,
        error: blocked ? "設定ファイルを読み込めません" : null,
      };
    };
    control.setLoadSaveBlocked = (value) => {
      blocked = value;
      control.emit("config-changed");
    };
  });

  await page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setLoadSaveBlocked?.(true),
  );
  await expect(page.locator(".banner")).toContainText("設定ファイルを読み込めません");
  await page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setLoadSaveBlocked?.(false),
  );
  await expect(page.locator(".banner")).toHaveCount(0);
  await page.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  let dialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await dialog.getByRole("textbox", { name: "プロジェクト名" }).fill("再読込後に保存");
  await dialog.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  await expect(dialog).toHaveCount(0);

  await page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setLoadSaveBlocked?.(true),
  );
  await expect(page.locator(".banner")).toBeVisible();
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings.getByRole("tab", { name: "バックアップ" }).click();
  await settings.getByRole("button", { name: "バックアップから復元", exact: true }).click();
  const confirm = page.getByRole("dialog", { name: "バックアップから復元しますか？" });
  await confirm.getByRole("button", { name: "復元する" }).click();
  await expect(settings).toHaveCount(0);

  await page.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  dialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await dialog.getByRole("textbox", { name: "プロジェクト名" }).fill("復元後に保存");
  await dialog.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await currentConfig(page)).projects.map((project) => project.name)).toEqual(
    expect.arrayContaining(["再読込後に保存", "復元後に保存"]),
  );
});
