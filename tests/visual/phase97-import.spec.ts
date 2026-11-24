import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppConfig, ImportPreviewResponse } from "../../src/types";
import { IMPORT_PROMPT_FIRST, IMPORT_PROMPT_REPEAT } from "../../src/content/importPrompt";
import { buildImportCurrentState } from "../../src/importCurrentState";
import { extractImportJson } from "../../src/importJson";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

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
        {
          key: "p0",
          name: "英語",
          color: "lime",
          goal: "字幕なしで楽しむ",
          nextStep: "音声モードで話す",
        },
      ],
      existingProjects: [],
      nextSteps: [
        {
          key: "p0.step",
          projectKey: "p0",
          project: "英語",
          text: "音声モードで話す",
          action: "insert",
          reason: null,
          minutes: 25,
          shortMinutes: 5,
        },
      ],
      wishes: [{ key: "p0.w0", projectKey: "p0", text: "歌詞を訳す", project: "英語" }],
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

async function prepare(page: Page, fixture = createFullTodayFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
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

test("V163-B2 reads an answer whose Markdown copy broke the lines and spaces", () => {
  const expected = {
    lifeLauncherImport: 1,
    projects: [
      {
        name: "英語",
        nextStep: { text: "単語帳を開いて10個読む", minutes: 20, shortMinutes: 5 },
        wishes: ["音声を1本聞く"],
      },
    ],
    wishes: ["机の上を片付ける"],
  };
  // A copied Markdown answer: a hard line break "\" at each line end, &#x20; for the indent,
  // and "\[" "\]" for brackets.
  const br = "\\";
  const broken = [
    `{${br}`,
    `&#x20; "lifeLauncherImport": 1,${br}`,
    `&#x20; "projects": ${br}[${br}`,
    `&#x20;   {${br}`,
    `&#x20;     "name": "英語",${br}`,
    `&#x20;     "nextStep": { "text": "単語帳を開いて10個読む", "minutes": 20, "shortMinutes": 5 },${br}`,
    `&#x20;     "wishes": ${br}["音声を1本聞く"${br}]${br}`,
    `&#x20;   }${br}`,
    `&#x20; ${br}],${br}`,
    `&#x20; "wishes": ${br}["机の上を片付ける"${br}]${br}`,
    "}",
  ].join("\n");
  const result = extractImportJson(broken);
  expect(result.ok).toBe(true);
  if (result.ok) expect(JSON.parse(result.json)).toEqual(expected);

  for (const space of ["&nbsp;", "&NBSP;", "&#32;", "&#160;", "&#xA0;", " ", "﻿"]) {
    const text = `{\n${space}"lifeLauncherImport": 1,\n${space}"wishes": ["机の上を片付ける"]\n}`;
    const read = extractImportJson(text);
    expect(read.ok, JSON.stringify(space)).toBe(true);
    if (read.ok) {
      expect(JSON.parse(read.json)).toEqual({ lifeLauncherImport: 1, wishes: ["机の上を片付ける"] });
    }
  }
});

test("V163-B2 never rewrites the text inside JSON strings", () => {
  // The fallback runs (the JSON is broken outside strings), but the strings keep
  // &#x20; and backslashes exactly as written.
  const br = "\\";
  const text = `{${br}\n&#x20;"lifeLauncherImport": 1,${br}\n&#x20;"wishes": ["a&#x20;b", "c${br}${br}d", "e${br}${br}${br}n"]\n}`;
  const result = extractImportJson(text);
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(JSON.parse(result.json).wishes).toEqual(["a&#x20;b", `c${br}d`, `e${br}\n`]);
  }
  // A correct answer is read as it is, entities in strings included.
  const clean = '{"lifeLauncherImport":1,"wishes":["&nbsp;そのまま"]}';
  expect(extractImportJson(clean)).toEqual({ ok: true, json: clean });
});

test("V163-B2 opens the import from the wishlist header, band, and menu", async ({ page }) => {
  await prepare(page);
  const dialog = page.getByRole("dialog", { name: "まとめて取り込む" });

  await page.locator("[data-inbox-header]").click({ button: "right" });
  await expect(page.getByRole("menuitem")).toHaveCount(2);
  await page.getByRole("menuitem", { name: "まとめて取り込む" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toHaveCount(0);

  await page.getByRole("button", { name: "やりたいことの操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "まとめて取り込む" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル" }).click();

  // The band itself (its padding above the header): not the header and not a row.
  await page.locator(".inboxBand").click({ button: "right", position: { x: 8, y: 4 } });
  await page.getByRole("menuitem", { name: "まとめて取り込む" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル" }).click();

  const disclosure = page.locator(".inboxBand .disclosureHeader button[aria-expanded]").first();
  if ((await disclosure.getAttribute("aria-expanded")) === "false") await disclosure.click();
  await expect(page.locator(".inboxBody")).toBeVisible();
  // A wishlist row keeps its own menu (no section items).
  await page.locator(".inboxRow").first().click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "まとめて取り込む" })).toHaveCount(0);
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
  await page.clock.runFor(300);
  await expect(dialog.getByText("✓ 読み取りました")).toBeVisible();
  await expect(dialog.locator(".importItem").filter({ hasText: "歌詞を訳す" })).toBeVisible();

  await dialog.getByRole("button", { name: /^取り込む(\(\d+件\))?$/ }).click();
  await expect(page.getByText("3件を取り込みました")).toBeVisible();
  await expect(dialog).not.toBeVisible();

  await page.getByRole("button", { name: "元に戻す" }).click();
  await expect(page.getByText("元に戻しました")).toBeVisible();
});

test("import dialog footer uses the same cancel and save colors as settings", async ({
  page,
}) => {
  const fixture = await prepare(page);
  await stubImport(page, { preview: preview(), original: fixture.config });
  const readColors = (locator: Locator) =>
    locator.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        backgroundColor: style.backgroundColor,
        color: style.color,
        borderColor: style.borderColor,
      };
    });

  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  const settingsCancel = settings.getByRole("button", { name: "キャンセル" });
  const settingsSave = settings.getByRole("button", { name: "保存", exact: true });
  const cancelColors = await readColors(settingsCancel);
  const saveColors = await readColors(settingsSave);
  await settingsCancel.click();
  await expect(settings).not.toBeVisible();

  await page.getByRole("button", { name: "次の一手の操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "まとめて取り込む" }).click();
  const dialog = page.getByRole("dialog", { name: "まとめて取り込む" });
  const importCancel = dialog.getByRole("button", { name: "キャンセル" });
  const importCommit = dialog.locator(".importDialogCommitButton");

  for (const [property, value] of Object.entries(cancelColors)) {
    await expect(importCancel).toHaveCSS(
      property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
      value,
    );
  }
  for (const [property, value] of Object.entries(saveColors)) {
    await expect(importCommit).toHaveCSS(
      property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
      value,
    );
  }

  await page.getByLabel("取り込みのJSON").fill(IMPORT_JSON);
  await page.clock.runFor(300);
  // After reading, the button also says how many items it imports.
  await expect(importCommit).toHaveText("取り込む(2件)");
  // V163-C10: let the read finish (and its own focus move land) before taking the focus over,
  // so the Tab below starts from 取り込む every time.
  await expect(dialog.getByText("✓ 読み取りました")).toBeVisible();
  await page.clock.runFor(50);
  await expect(importCommit).toBeEnabled();
  const commitBox = await importCommit.boundingBox();
  const cancelBox = await importCancel.boundingBox();
  expect(commitBox).not.toBeNull();
  expect(cancelBox).not.toBeNull();
  expect(commitBox!.x).toBeLessThan(cancelBox!.x);
  await importCommit.focus();
  await page.keyboard.press("Tab");
  await expect(importCancel).toBeFocused();
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
  await page.clock.runFor(300);
  await page.getByRole("button", { name: /^取り込む(\(\d+件\))?$/ }).click();
  await expect(page.getByText("3件を取り込みました")).toBeVisible();

  const sourceCard = page.locator(".nextStepCard[data-project-id='import-english']");
  await expect(sourceCard).toContainText("音声モードで話す");
  await sourceCard.getByRole("button", { name: /今日へ/ }).click();
  const todayCard = page.locator(".todayRow", { hasText: "音声モードで話す" });
  await expect(todayCard).toBeVisible();
  await todayCard.getByRole("button", { name: "短時間タイマー1分で開始" }).click();
  await page.clock.fastForward(60_500);
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

test("copies the first-time prompt exactly", async ({ page }) => {
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
  await page.getByRole("button", { name: "初回作成用をコピー" }).click();
  // P10-12 (D36): the button swaps its own label instead of showing a success toast.
  await expect(page.getByRole("button", { name: "コピーしました" })).toBeVisible();
  await expect(
    page.locator(".toast", { hasText: "はじめて用のプロンプトをコピーしました" }),
  ).toHaveCount(0);
  const copied = await page.evaluate(
    () => (window as typeof window & { __copiedPrompt?: string }).__copiedPrompt ?? "",
  );
  expect(copied).toBe(IMPORT_PROMPT_FIRST);
  // V163-B2: the prompt asks for one ```json code block (the backticks survive the template string).
  expect(copied).toContain("JSON は必ず ```json のコードブロック1つだけで出力し");
});

test("copies the current app state with the 2nd-and-later prompt", async ({ page }) => {
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
  const dialog = page.getByRole("dialog", { name: "まとめて取り込む" });
  // V163-B2: the note under the button was removed; the button name says what it is for.
  await expect(dialog.getByText("コピーする文には", { exact: false })).toHaveCount(0);
  await page.getByRole("button", { name: "追加・見直し用をコピー" }).click();
  await expect(page.getByRole("button", { name: "コピーしました" })).toBeVisible();

  const copied = await page.evaluate(
    () => (window as typeof window & { __copiedPrompt?: string }).__copiedPrompt ?? "",
  );
  const expectedState = buildImportCurrentState(fixture.config);
  expect(copied).toBe(IMPORT_PROMPT_REPEAT.replace("{CURRENT_STATE}", expectedState));
  expect(copied).toContain("サンプル学習(色: blue)");
  expect(copied).toContain("目標: 小さな一手から理解を深める");
  expect(copied).toContain("次の一手: 資料を1ページ読む");
  expect(copied).toContain("やりたいこと: 週末に試すアイデア");
  expect(copied).toContain("プロジェクトなしのやりたいこと: あとで確認するサンプル");
  expect(copied).not.toContain("sample-documents");
  expect(copied).not.toContain("C:\\");
  // The app state part has no finished items (the prompt's own rules may use the word).
  const statePart = copied.slice(IMPORT_PROMPT_REPEAT.indexOf("{CURRENT_STATE}"));
  expect(statePart).not.toContain("完了");
  expect(copied).not.toContain("今日の3件");
});

test("builds the current state without empty lines or a missing color", () => {
  const fixture = createFullTodayFixture();
  const config = structuredClone(fixture.config);
  config.projects = [
    { id: "plain", name: "色なし" },
    {
      id: "full",
      name: "全部あり",
      colorId: "blue",
      northStar: "目指すこと",
      nextStep: {
        text: "次にやる",
        buttonIds: [],
        defaultTimerMinutes: 25,
        shortTimerMinutes: 5,
      },
    },
  ];
  config.inbox = [
    { id: "wish-full", text: "やりたい1", projectId: "full" },
    { id: "wish-plain", text: "やりたい2", projectId: "plain" },
    { id: "wish-none", text: "プロジェクトなし" },
  ];
  expect(buildImportCurrentState(config)).toBe(
    [
      "色なし",
      "やりたいこと: やりたい2",
      "全部あり(色: blue)",
      "目標: 目指すこと",
      "次の一手: 次にやる",
      "やりたいこと: やりたい1",
      "プロジェクトなしのやりたいこと: プロジェクトなし",
    ].join("\n"),
  );
});

test("uses (まだ何もありません) when the app has no projects or wishes", async ({ page }) => {  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as typeof window & { __copiedPrompt?: string }).__copiedPrompt = text;
        },
      },
    });
  });
  const fixture = createFullTodayFixture();
  fixture.config.projects = [];
  fixture.config.inbox = [];
  await prepare(page, fixture);
  await stubImport(page, { preview: preview(), original: fixture.config });

  await page.getByRole("button", { name: "次の一手の操作", exact: true }).click();
  await page.getByRole("menuitem", { name: "まとめて取り込む" }).click();
  await page.getByRole("button", { name: "追加・見直し用をコピー" }).click();

  const copied = await page.evaluate(
    () => (window as typeof window & { __copiedPrompt?: string }).__copiedPrompt ?? "",
  );
  expect(copied).toBe(
    IMPORT_PROMPT_REPEAT.replace("{CURRENT_STATE}", "(まだ何もありません)"),
  );
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

  await emitDrop(page, "dragEnter", ["C:\\PublicDemo\\import-main.json"], { x: 900, y: 300 });
  await emitDrop(page, "drop", ["C:\\PublicDemo\\import-main.json"], { x: 900, y: 300 });
  const dialog = page.getByRole("dialog", { name: "まとめて取り込む" });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("✓ 読み取りました")).toBeVisible();
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
