import { expect, test, type Page } from "@playwright/test";
import type { AppConfig, ImportPreviewResponse } from "../../src/types";
import { extractImportJson } from "../../src/importJson";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const IMPORT_JSON = JSON.stringify({
  lifeLauncherImport: 1,
  projects: [
    {
      name: "英語",
      color: "lime",
      goal: "字幕なしで楽しむ",
      nextStep: {
        text: "音声モードで話す",
        trigger: "夕食のあと",
        minutes: 25,
        shortMinutes: 5,
      },
      wishes: ["歌詞を訳す"],
    },
  ],
  wishes: [],
});

function preview(): ImportPreviewResponse {
  return {
    preview: {
      newProjects: [
        { name: "英語", color: "lime", goal: "字幕なしで楽しむ", nextStep: "音声モードで話す" },
      ],
      existingProjects: [],
      nextSteps: [
        { project: "英語", text: "音声モードで話す", action: "insert", reason: null },
      ],
      wishes: [{ text: "歌詞を訳す", project: "英語" }],
      rejected: [],
      ignored: [],
      merged: [],
      skipped: [],
      counts: {
        newProjects: 1,
        existingProjects: 0,
        nextSteps: 1,
        wishes: 1,
        rejected: 0,
      },
    },
    fingerprint: "fp-before",
  };
}

function importedConfig(base: AppConfig): AppConfig {
  const config = structuredClone(base);
  config.projects.push({
    id: "import-english",
    name: "英語",
    northStar: "字幕なしで楽しむ",
    colorId: "lime",
    nextStep: {
      text: "音声モードで話す",
      generationId: "generation-1a2b3c4d-0",
      trigger: "夕食のあと",
      updatedAt: "2026-11-07T00:00:00.000Z",
      reviewedAt: "2026-11-07T00:00:00.000Z",
      buttonIds: [],
      defaultTimerMinutes: 25,
      shortTimerMinutes: 5,
    },
  });
  config.inbox.push({
    id: "import-wish",
    text: "歌詞を訳す",
    projectId: "import-english",
    buttonIds: [],
  });
  return config;
}

function importedConfigForToday(base: AppConfig): AppConfig {
  const config = importedConfig(base);
  config.today.items = [];
  config.today.candidateExcludedSourceKeys = [];
  const project = config.projects.find((candidate) => candidate.id === "import-english");
  if (!project?.nextStep) throw new Error("imported project is missing its next step");
  project.nextStep.shortTimerMinutes = 1;
  return config;
}

async function prepare(page: Page) {
  const fixture = createFullTodayFixture();
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.waitForTimeout(150);
  return fixture;
}

type StubOptions = {
  text?: string;
  readError?: string;
  preview?: ImportPreviewResponse;
  imported?: AppConfig;
  original: AppConfig;
};

async function stubImport(page: Page, options: StubOptions) {
  await page.evaluate((stub) => {
    const target = window as typeof window & {
      __TAURI_INTERNALS__: {
        invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
    };
    const originalInvoke = target.__TAURI_INTERNALS__.invoke;
    target.__TAURI_INTERNALS__.invoke = async (
      command: string,
      args: Record<string, unknown> = {},
    ) => {
      if (command === "read_import_json") {
        if (stub.readError) throw new Error(stub.readError);
        return stub.text ?? "";
      }
      if (command === "preview_import") return stub.preview;
      if (command === "commit_import") {
        return {
          config: stub.imported ?? stub.original,
          path: "C:/PublicDemo/config.json",
          importId: "import-test",
          fingerprint: "fp-after",
          preview: stub.preview?.preview,
        };
      }
      if (command === "undo_import") {
        return { config: stub.original, path: "C:/PublicDemo/config.json" };
      }
      return originalInvoke(command, args);
    };
  }, options);
}

async function emitDrop(
  page: Page,
  stage: "dragEnter" | "dragOver" | "dragLeave" | "drop",
  paths: string[],
  position: { x: number; y: number } | null = null,
) {
  await page.evaluate(
    (payload) => {
      const target = window as typeof window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { emit: (event: string, value: unknown) => void };
      };
      target.__LIFE_LAUNCHER_VISUAL_QA__.emit("main-shell-drop-result", {
        windowLabel: "main",
        stage: payload.stage,
        paths: payload.paths,
        url: null,
        label: null,
        shellSpecial: null,
        position: payload.position,
        message: "",
      });
    },
    { stage, paths, position },
  );
}

test("extracts one import JSON from prose, code fences, and strings", () => {
  const wrapped = `説明です。\n\`\`\`json\n${IMPORT_JSON}\n\`\`\`\n以上です。`;
  expect(extractImportJson(wrapped)).toEqual({ ok: true, json: IMPORT_JSON });
  expect(extractImportJson('{"lifeLauncherImport":1,"wishes":["a } b"]}')).toEqual({
    ok: true,
    json: '{"lifeLauncherImport":1,"wishes":["a } b"]}',
  });
  expect(extractImportJson('{"a":{"b":1}}')).toMatchObject({ ok: false });
  expect(extractImportJson(`${IMPORT_JSON}\n${IMPORT_JSON}`)).toMatchObject({ ok: false });
  expect(extractImportJson("JSONはありません")).toMatchObject({ ok: false });
  expect(extractImportJson(`説明に " が1つだけあります。\n${IMPORT_JSON}`)).toEqual({
    ok: true,
    json: IMPORT_JSON,
  });
});

test("previews, imports, and undoes from the section menu", async ({ page }) => {
  const fixture = await prepare(page);
  await stubImport(page, {
    preview: preview(),
    imported: importedConfig(fixture.config),
    original: fixture.config,
  });

  await page.getByRole("button", { name: "次の一手の操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "まとめて取り込む" }).click();
  const dialog = page.getByRole("dialog", { name: "まとめて取り込む" });
  await expect(dialog).toBeVisible();

  await page.getByLabel("取り込みのJSON").fill(`\`\`\`json\n${IMPORT_JSON}\n\`\`\``);
  await page.getByRole("button", { name: "プレビュー" }).click();
  await expect(dialog.getByText("新規プロジェクト 1件")).toBeVisible();
  await expect(dialog.locator("li").filter({ hasText: "歌詞を訳す" })).toBeVisible();

  await dialog.getByRole("button", { name: "取り込む", exact: true }).click();
  await expect(page.getByText("3件を取り込みました")).toBeVisible();
  await expect(dialog).not.toBeVisible();

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByText("元に戻しました")).toBeVisible();
});

test("an imported next step completes in Today3 like a screen-set next step", async ({
  page,
}) => {
  const fixture = await prepare(page);
  await stubImport(page, {
    preview: preview(),
    imported: importedConfigForToday(fixture.config),
    original: fixture.config,
  });

  await page.getByRole("button", { name: "次の一手の操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "まとめて取り込む" }).click();
  await page.getByLabel("取り込みのJSON").fill(IMPORT_JSON);
  await page.getByRole("button", { name: "プレビュー" }).click();
  await page.getByRole("button", { name: "取り込む", exact: true }).click();
  await expect(page.getByText("3件を取り込みました")).toBeVisible();

  const sourceCard = page.locator(".nextStepCard[data-project-id='import-english']");
  await expect(sourceCard).toContainText("音声モードで話す");
  await sourceCard.getByRole("button", { name: /今日へ/ }).click();
  const todayCard = page.locator(".todayRow", { hasText: "音声モードで話す" });
  await expect(todayCard).toBeVisible();
  await todayCard.getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await page.clock.runFor(60_500);
  const expired = page.getByRole("dialog", { name: "タイマー満了" });
  await expect(expired).toBeVisible();
  await expired.getByRole("button", { name: "終わる" }).click();
  await expect(expired).toHaveCount(0);
  await expect(todayCard).toHaveClass(/todayRow--justCompleted/);

  const result = await page.evaluate(() => {
    const control = (
      window as typeof window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          currentConfig: () => AppConfig;
          invokeCalls: { command: string; args: Record<string, unknown> }[];
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    return { config: control.currentConfig(), calls: control.invokeCalls };
  });
  const project = result.config.projects.find((candidate) => candidate.id === "import-english");
  expect(project?.nextStep).toBeUndefined();
  expect(result.config.today.items).toEqual([
    expect.objectContaining({
      text: "音声モードで話す",
      done: true,
      sourceKey: "project:import-english",
      sourceGenerationId: "generation-1a2b3c4d-0",
      projectId: "import-english",
    }),
  ]);
  expect(result.config.sourceCompletions.at(-1)).toMatchObject({
    sourceType: "nextStep",
    sourceIdentity: "project:import-english",
    textSnapshot: "音声モードで話す",
    projectId: "import-english",
  });
  const records = result.calls.filter((call) => call.command === "record_session");
  expect(records).toHaveLength(1);
  expect(records[0].args.session).toMatchObject({
    minutes: 1,
    projectId: "import-english",
  });
});

test("copies the prompt from the import dialog", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as typeof window & { __copiedPrompt?: string }).__copiedPrompt = text;
        },
      },
    });
  });
  const fixture = await prepare(page);
  await stubImport(page, { preview: preview(), original: fixture.config });

  await page.getByRole("button", { name: "次の一手の操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "まとめて取り込む" }).click();
  await page.getByRole("button", { name: "プロンプトをコピー" }).click();
  await expect(page.getByText("プロンプトをコピーしました")).toBeVisible();
  const copied = await page.evaluate(
    () => (window as typeof window & { __copiedPrompt?: string }).__copiedPrompt ?? "",
  );
  expect(copied).toContain("Life Launcher に取り込める JSON");
  expect(copied).toContain("lifeLauncherImport");
});

test("routes a JSON drop by the side and shows the two-zone overlay", async ({ page }) => {
  const fixture = await prepare(page);
  await stubImport(page, {
    text: IMPORT_JSON,
    preview: preview(),
    imported: importedConfig(fixture.config),
    original: fixture.config,
  });

  await emitDrop(page, "dragEnter", ["C:\\PublicDemo\\import.json"], { x: 900, y: 300 });
  const overlay = page.locator(".importDropOverlay");
  await expect(overlay).toBeVisible();
  await expect(page.locator(".importDropZone--main.importDropZone--active")).toBeVisible();
  await expect(overlay).toHaveScreenshot("phase97-import-drop-main.png", {
    maxDiffPixels: 12,
  });

  await emitDrop(page, "dragOver", ["C:\\PublicDemo\\import.json"], { x: 100, y: 300 });
  await expect(page.locator(".importDropZone--sidebar.importDropZone--active")).toBeVisible();
  await expect(overlay).toHaveScreenshot("phase97-import-drop-sidebar.png", {
    maxDiffPixels: 12,
  });

  await emitDrop(page, "dragEnter", ["C:\\PublicDemo\\import-main.json"], { x: 900, y: 300 });
  await emitDrop(page, "drop", ["C:\\PublicDemo\\import-main.json"], { x: 900, y: 300 });
  const dialog = page.getByRole("dialog", { name: "まとめて取り込む" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("新規プロジェクト 1件")).toBeVisible();
  await page.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).not.toBeVisible();

  await emitDrop(page, "dragEnter", ["C:\\PublicDemo\\import-side.json"], { x: 100, y: 300 });
  await emitDrop(page, "drop", ["C:\\PublicDemo\\import-side.json"], { x: 100, y: 300 });
  await expect(page.locator(".dropDialog")).toBeVisible();
});

test("keeps non-JSON and multiple drops on the button builder", async ({ page }) => {
  const fixture = await prepare(page);
  await stubImport(page, { preview: preview(), original: fixture.config });

  await emitDrop(page, "drop", ["C:\\PublicDemo\\notes.txt"], { x: 900, y: 300 });
  const dropDialog = page.locator(".dropDialog");
  await expect(dropDialog).toBeVisible();
  await dropDialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dropDialog).not.toBeVisible();

  await emitDrop(
    page,
    "drop",
    ["C:\\PublicDemo\\a.txt", "C:\\PublicDemo\\b.txt"],
    { x: 900, y: 300 },
  );
  await expect(page.getByText("複数ドロップ時は先頭の1件だけ登録します")).toBeVisible();
  await expect(page.locator(".dropDialog")).toBeVisible();
});

test("shows the reason when a JSON file cannot be read", async ({ page }) => {
  const fixture = await prepare(page);
  await stubImport(page, {
    readError: "ファイルが256 KBを超えています",
    preview: preview(),
    original: fixture.config,
  });

  await emitDrop(page, "drop", ["C:\\PublicDemo\\big.json"], { x: 900, y: 300 });
  const dialog = page.getByRole("dialog", { name: "まとめて取り込む" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("ファイルが256 KBを超えています")).toBeVisible();
});
