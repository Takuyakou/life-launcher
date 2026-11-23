import { expect, test, type Page } from "@playwright/test";
import type { ImportPreviewResponse } from "../../src/types";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V163-B6: the 「まとめて取り込む」 dialog is three numbered steps; a pasted answer is read by itself,
// shown project by project, and items can be left out with checkboxes.

const ANSWER = JSON.stringify({ lifeLauncherImport: 1, projects: [], wishes: [] });

function previewResponse(): ImportPreviewResponse {
  return {
    preview: {
      newProjects: [
        {
          key: "p0",
          name: "英語",
          color: "lime",
          goal: "字幕なしで映画を楽しむ",
          nextStep: "音声モードを開いて5分だけ話す",
        },
        {
          key: "p1",
          name: "部屋づくり",
          color: "cyan",
          goal: "机に向かうとすぐ始められる部屋",
          nextStep: "机の上の紙類を要・不要の2山に分ける",
        },
      ],
      existingProjects: [
        {
          key: "p2",
          name: "サンプル学習",
          fillColor: null,
          fillGoal: null,
          nextStepAction: "wishlist",
          nextStepReason: "すでに次の一手があるので、やりたいことに入れます",
          nextStepText: "問題集の間違えた3問を解き直す",
        },
      ],
      nextSteps: [
        {
          key: "p0.step",
          projectKey: "p0",
          project: "英語",
          text: "音声モードを開いて5分だけ話す",
          action: "insert",
          reason: null,
          minutes: 20,
          shortMinutes: 5,
        },
        {
          key: "p1.step",
          projectKey: "p1",
          project: "部屋づくり",
          text: "机の上の紙類を要・不要の2山に分ける",
          action: "insert",
          reason: null,
          minutes: null,
          shortMinutes: null,
        },
        {
          key: "p2.step",
          projectKey: "p2",
          project: "サンプル学習",
          text: "問題集の間違えた3問を解き直す",
          action: "wishlist",
          reason: "すでに次の一手があるので、やりたいことに入れます",
          minutes: null,
          shortMinutes: null,
        },
      ],
      wishes: [
        { key: "p0.w0", projectKey: "p0", text: "好きな曲の歌詞を1曲だけ訳す", project: "英語" },
        { key: "p0.w1", projectKey: "p0", text: "単語アプリを開いて10分進める", project: "英語" },
        { key: "p1.w0", projectKey: "p1", text: "本棚の1段だけ並べ直す", project: "部屋づくり" },
        {
          key: "p2.step",
          projectKey: "p2",
          text: "問題集の間違えた3問を解き直す",
          project: "サンプル学習",
        },
        { key: "p2.w0", projectKey: "p2", text: "資料の次の見出しまで読む", project: "サンプル学習" },
        { key: "w0", projectKey: null, text: "週末に試すレシピを1つ選ぶ", project: null },
      ],
      rejected: [],
      ignored: [],
      merged: [],
      skipped: [],
      counts: { newProjects: 2, existingProjects: 1, nextSteps: 3, wishes: 6, rejected: 0 },
    },
    fingerprint: "fp-before",
  };
}

async function openDialog(page: Page, width = 1366, height = 900) {
  await page.addInitScript(() => {
    (window as typeof window & { __copied: string[] }).__copied = [];
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (value: string) => {
          (window as typeof window & { __copied: string[] }).__copied.push(value);
        },
      },
    });
  });
  const fixture = createFullTodayFixture();
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(
    ({ response, config }) => {
      const target = window as typeof window & {
        __TAURI_INTERNALS__: {
          invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
        };
        __importCalls: Array<{ command: string; args: Record<string, unknown> }>;
      };
      target.__importCalls = [];
      const original = target.__TAURI_INTERNALS__.invoke;
      target.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
        if (command === "preview_import" || command === "commit_import") {
          target.__importCalls.push({ command, args });
        }
        if (command === "preview_import") return response;
        if (command === "commit_import") {
          return {
            config,
            path: "C:/PublicDemo/config.json",
            importId: "import-test",
            fingerprint: "fp-after",
            preview: response.preview,
          };
        }
        return original(command, args);
      };
    },
    { response: previewResponse(), config: fixture.config },
  );
  const opener = page.getByRole("button", { name: "次の一手の操作", exact: true });
  await opener.click();
  await page.getByRole("menuitem", { name: "まとめて取り込む" }).click();
  const dialog = page.getByRole("dialog", { name: "まとめて取り込む" });
  await expect(dialog).toBeVisible();
  return { dialog, fixture };
}

const calls = (page: Page, command: string) =>
  page.evaluate(
    (name) =>
      (
        window as typeof window & {
          __importCalls: Array<{ command: string; args: Record<string, unknown> }>;
        }
      ).__importCalls.filter((call) => call.command === name),
    command,
  );

async function pasteAnswer(page: Page, dialog: ReturnType<Page["getByRole"]>) {
  await page.getByLabel("取り込みのJSON").fill(ANSWER);
  await page.clock.runFor(300);
  await expect(dialog.getByText("✓ 読み取りました")).toBeVisible();
}

test("V163-B6 1 three steps in order, no プレビュー button, both copy buttons work", async ({
  page,
}) => {
  const { dialog } = await openDialog(page);
  await expect(dialog.locator(".importStepHead h3")).toHaveText([
    "AI に聞く",
    "答えを貼る",
    "取り込むものを選ぶ",
  ]);
  await expect(dialog.locator(".importStepNumber")).toHaveText(["1", "2", "3"]);
  await expect(dialog.getByRole("button", { name: "プレビュー" })).toHaveCount(0);
  await expect(dialog.getByText("貼ると、取り込む中身が下に出ます。")).toBeVisible();
  await expect(dialog.getByText("答えを貼ると、ここに出ます。")).toBeVisible();
  await expect(dialog.getByLabel("取り込みのJSON")).toHaveAttribute(
    "placeholder",
    "AI の答えを、ここに貼ります(Ctrl+V)。JSON のファイルは、メインの画面に落としても読めます。",
  );
  // Before reading only step 1 is the accent one.
  expect(
    await dialog.locator(".importStepNumber").evaluateAll((items) => items.map((item) => item.getAttribute("data-state"))),
  ).toEqual(["active", "pending", "pending"]);

  await dialog.getByRole("button", { name: "初回作成用をコピー" }).click();
  await expect(page.getByRole("button", { name: "コピーしました" })).toBeVisible();
  await page.clock.runFor(2_000);
  await dialog.getByRole("button", { name: "追加・見直し用をコピー" }).click();
  const copied = await page.evaluate(
    () => (window as typeof window & { __copied: string[] }).__copied,
  );
  expect(copied).toHaveLength(2);
  expect(copied[0]).toContain("あなたは、私の人生");
  expect(copied[1]).not.toContain("{CURRENT_STATE}");
});

test("V163-B6 2 pasting reads once after 300ms, folds the box, and 貼り直す opens it again", async ({
  page,
}) => {
  const { dialog } = await openDialog(page);
  const box = page.getByLabel("取り込みのJSON");
  await box.fill(ANSWER);
  await page.clock.runFor(200);
  expect(await calls(page, "preview_import")).toHaveLength(0);
  await page.clock.runFor(120);
  await expect(dialog.getByText("✓ 読み取りました")).toBeVisible();
  expect(await calls(page, "preview_import")).toHaveLength(1);
  await expect(dialog.getByText("プロジェクト 3・次の一手 2・やりたいこと 6")).toBeVisible();
  await expect(box).toHaveCount(0);
  expect(
    await dialog.locator(".importStepNumber").evaluateAll((items) => items.map((item) => item.getAttribute("data-state"))),
  ).toEqual(["done", "done", "active"]);
  await expect(dialog.getByText("いらないものは、チェックを外します。今あるものは上書きしません。")).toBeVisible();

  await dialog.getByRole("button", { name: "貼り直す" }).click();
  await expect(box).toHaveValue(ANSWER);
  await expect(box).toBeFocused();
  await expect(dialog.getByText("✓ 読み取りました")).toHaveCount(0);
  await expect(dialog.locator(".importGroup")).toHaveCount(0);
});

test("V163-B6 3 a broken answer keeps the box open with an alert, and clearing it removes the alert", async ({
  page,
}) => {
  const { dialog } = await openDialog(page);
  const box = page.getByLabel("取り込みのJSON");
  await box.fill("これは JSON ではありません");
  await page.clock.runFor(300);
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(box).toBeVisible();
  expect(await calls(page, "preview_import")).toHaveLength(0);
  await box.fill("");
  await page.clock.runFor(300);
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});

test("V163-B6 4 one frame per project, with tags, colors, times and the reason, no row twice", async ({
  page,
}) => {
  const { dialog } = await openDialog(page);
  await pasteAnswer(page, dialog);
  const groups = dialog.locator(".importGroup");
  await expect(groups).toHaveCount(4);
  await expect(groups.nth(0).locator(".importGroupName")).toHaveText("英語");
  await expect(groups.nth(0).locator(".importGroupTag")).toHaveText("新しいプロジェクト");
  await expect(groups.nth(0)).toHaveAttribute("data-project-color", "lime");
  await expect(groups.nth(0).locator(".importGroupGoal")).toHaveText("字幕なしで映画を楽しむ");
  await expect(groups.nth(1)).toHaveAttribute("data-project-color", "cyan");
  await expect(groups.nth(2).locator(".importGroupTag")).toHaveText("今あるプロジェクト");
  // An existing project shows its own color from the settings.
  await expect(groups.nth(2)).toHaveAttribute("data-project-color", "blue");
  await expect(groups.nth(3).locator(".importGroupName")).toHaveText("プロジェクトなし");
  await expect(groups.nth(3).locator(".importGroupTag")).toHaveCount(0);

  const firstRows = groups.nth(0).locator(".importItem");
  await expect(firstRows.nth(0).locator(".importItemKind")).toHaveText("次の一手");
  await expect(firstRows.nth(0).locator(".importItemMinutes")).toHaveText("20分・短く 5分");
  await expect(firstRows.nth(1).locator(".importItemKind")).toHaveText("やりたいこと");
  await expect(groups.nth(1).locator(".importItemMinutes")).toHaveCount(0);
  // A next step that goes to the wishlist is one row, with the reason under it.
  const existingRows = groups.nth(2).locator(".importItem");
  await expect(existingRows).toHaveCount(2);
  await expect(existingRows.nth(0).locator(".importItemKind")).toHaveText("やりたいこと");
  await expect(existingRows.nth(0).locator(".importItemNote")).toHaveText(
    "すでに次の一手があるので、やりたいことに入れます",
  );
  await expect(dialog.getByText("問題集の間違えた3問を解き直す")).toHaveCount(1);
  await expect(dialog.locator(".importItem")).toHaveCount(8);
  // The old summary line and the four lists are gone.
  await expect(dialog.getByText("新規プロジェクト")).toHaveCount(0);
  await expect(dialog.getByRole("heading", { name: "新しく足すプロジェクト" })).toHaveCount(0);
});

test("V163-B6 5 leaving rows out dims them, counts, and a project head switches its rows", async ({
  page,
}) => {
  const { dialog } = await openDialog(page);
  await pasteAnswer(page, dialog);
  const commit = dialog.locator(".importDialogCommitButton");
  await expect(commit).toHaveText("取り込む(8件)");
  await expect(dialog.getByText("件のうち")).toHaveCount(0);

  const row = dialog.getByRole("checkbox", { name: "「単語アプリを開いて10分進める」を取り込む" });
  await row.uncheck();
  const rowBox = dialog.locator(".importItem", { hasText: "単語アプリを開いて10分進める" });
  await expect(rowBox).toHaveClass(/importItem--off/);
  await expect(rowBox).toHaveCSS("opacity", "0.45");
  await expect(rowBox.locator(".importItemTitle")).toHaveCSS("text-decoration-line", "line-through");
  await expect(commit).toHaveText("取り込む(7件)");
  await expect(dialog.getByText("8件のうち 7件を取り込みます")).toBeVisible();

  // The head switches the whole project: its rows dim and cannot be pressed, and they come back as they were.
  const head = dialog.getByRole("checkbox", { name: "「英語」を取り込む" });
  await head.uncheck();
  await expect(commit).toHaveText("取り込む(5件)");
  await expect(
    dialog.getByRole("checkbox", { name: "「音声モードを開いて5分だけ話す」を取り込む" }),
  ).toBeDisabled();
  await head.check();
  await expect(commit).toHaveText("取り込む(7件)");
  await expect(row).not.toBeChecked();
  await expect(
    dialog.getByRole("checkbox", { name: "「音声モードを開いて5分だけ話す」を取り込む" }),
  ).toBeChecked();

  // Everything left out: nothing to import.
  for (const name of ["英語", "部屋づくり", "サンプル学習", "プロジェクトなし"]) {
    await dialog.getByRole("checkbox", { name: `「${name}」を取り込む` }).uncheck();
  }
  await expect(commit).toHaveText("取り込む(0件)");
  await expect(commit).toBeDisabled();
});

test("V163-B6 6 the excluded keys that are sent are exactly the ones left out", async ({ page }) => {
  const { dialog } = await openDialog(page);
  await pasteAnswer(page, dialog);
  await dialog.getByRole("checkbox", { name: "「単語アプリを開いて10分進める」を取り込む" }).uncheck();
  await dialog.getByRole("checkbox", { name: "「部屋づくり」を取り込む" }).uncheck();
  await dialog.getByRole("checkbox", { name: "「週末に試すレシピを1つ選ぶ」を取り込む" }).uncheck();
  await dialog
    .getByRole("checkbox", { name: "「問題集の間違えた3問を解き直す」を取り込む" })
    .uncheck();
  await dialog.locator(".importDialogCommitButton").click();
  await expect(page.getByText(/件を取り込みました/)).toBeVisible();
  const commit = await calls(page, "commit_import");
  expect(commit).toHaveLength(1);
  expect(commit[0].args.fingerprint).toBe("fp-before");
  expect([...(commit[0].args.excluded as string[])].sort()).toEqual(
    ["p0.w1", "p1", "p2.step", "w0"].sort(),
  );
});

test("V163-B6 7 Tab and Space alone leave a row out and import; Esc closes and focus returns", async ({
  page,
}) => {
  const { dialog } = await openDialog(page);
  await pasteAnswer(page, dialog);
  await expect(dialog.getByRole("button", { name: "貼り直す" })).toBeFocused();
  // 貼り直す → head of 英語 → its three rows
  await page.keyboard.press("Tab");
  await expect(dialog.getByRole("checkbox", { name: "「英語」を取り込む" })).toBeFocused();
  await page.keyboard.press("Tab");
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("checkbox", { name: "「好きな曲の歌詞を1曲だけ訳す」を取り込む" }),
  ).toBeFocused();
  await page.keyboard.press("Space");
  await expect(
    dialog.getByRole("checkbox", { name: "「好きな曲の歌詞を1曲だけ訳す」を取り込む" }),
  ).not.toBeChecked();
  await dialog.locator(".importDialogCommitButton").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/件を取り込みました/)).toBeVisible();
  const commit = await calls(page, "commit_import");
  expect(commit[0].args.excluded).toEqual(["p0.w0"]);

  // Reopen from the heading button and close with Esc: focus goes back to that button.
  await page.clock.runFor(100);
  const opener = page.locator(".projectsBand .disclosureHeader").getByRole("button", {
    name: "まとめて取り込む",
    exact: true,
  });
  await opener.focus();
  await page.keyboard.press("Enter");
  const again = page.getByRole("dialog", { name: "まとめて取り込む" });
  await expect(again).toBeVisible();
  await expect(page.getByLabel("取り込みのJSON")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(again).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("V163-B6 8 at 860px nothing sticks out of its frame", async ({ page }) => {
  const { dialog } = await openDialog(page, 860, 720);
  await pasteAnswer(page, dialog);
  const overflow = await dialog.evaluate((root) => {
    const dialogBox = root.getBoundingClientRect();
    const bad: string[] = [];
    for (const group of Array.from(root.querySelectorAll<HTMLElement>(".importGroup"))) {
      const groupBox = group.getBoundingClientRect();
      if (groupBox.right > dialogBox.right + 0.5) bad.push("group " + group.textContent?.slice(0, 20));
      for (const part of Array.from(group.querySelectorAll<HTMLElement>("*"))) {
        const box = part.getBoundingClientRect();
        if (box.width === 0) continue;
        if (box.right > groupBox.right + 0.5 || box.left < groupBox.left - 0.5) {
          bad.push(part.className + " " + part.textContent?.slice(0, 20));
        }
      }
    }
    const body = root.querySelector<HTMLElement>(".importDialogBody")!;
    return { bad, scrollsSideways: body.scrollWidth > body.clientWidth };
  });
  expect(overflow.bad).toEqual([]);
  expect(overflow.scrollsSideways).toBe(false);
});

test("V163-B6 9 a .json dropped on the open dialog is not read (the placeholder says so)", async ({
  page,
}) => {
  const { dialog } = await openDialog(page);
  await page.evaluate(() => {
    const target = window as typeof window & {
      __LIFE_LAUNCHER_VISUAL_QA__: { emit: (event: string, value: unknown) => void };
    };
    target.__LIFE_LAUNCHER_VISUAL_QA__.emit("main-shell-drop-result", {
      windowLabel: "main",
      stage: "drop",
      paths: ["C:\\PublicDemo\\import.json"],
      url: null,
      label: null,
      shellSpecial: null,
      position: { x: 900, y: 300 },
      message: "",
    });
  });
  await page.clock.runFor(300);
  await expect(page.getByLabel("取り込みのJSON")).toHaveValue("");
  expect(await calls(page, "preview_import")).toHaveLength(0);
  await expect(dialog).toBeVisible();
});
