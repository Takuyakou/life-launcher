import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P96-03: 手順書ビューアーを十字キーで操作する。

const ROOT = "C:\\PublicDemo\\Instructions";
const GUIDE = `${ROOT}\\guide.md`;
const NOTES = `${ROOT}\\notes.txt`;
const REFERENCE = `${ROOT}\\reference.html`;

const LONG_MARKDOWN = [
  "# 長い手順書",
  ...Array.from({ length: 80 }, (_, index) => `- ${index + 1}行目の手順です。`),
].join("\n\n");

const LONG_HTML = `<!doctype html><html><head><style>body{margin:0;font-family:Arial}main{padding:24px}</style></head><body><main>${Array.from(
  { length: 80 },
  (_, index) => `<p>${index + 1}行目の手順です。</p>`,
).join("")}</main></body></html>`;

type Options = {
  path?: string;
  documents?: Record<string, string>;
};

async function openViewer(page: Page, options: Options = {}) {
  const fixture = createPublicFixture();
  fixture.instructionDocuments = {
    [GUIDE]: LONG_MARKDOWN,
    [NOTES]: Array.from({ length: 60 }, (_, index) => `${index + 1}行目のメモです。`).join("\n"),
    [REFERENCE]: LONG_HTML,
    ...options.documents,
  };
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1100, height: 700 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture, "life-launcher-instruction");
  const query = options.path
    ? `/?view=instruction&path=${encodeURIComponent(options.path)}`
    : "/?view=instruction";
  await page.goto(query);
  await expect(page.locator(".instructionTreeRow").first()).toBeVisible();
}

/** 一覧の先頭のフォルダーを開いて、ファイルの行を出す。 */
async function expandRoot(page: Page) {
  const rows = page.locator(".instructionTreeRow");
  await expect(rows.first()).toBeFocused();
  await page.keyboard.press("ArrowRight");
  await expect(rows).toHaveCount(4);
}

const activeElementInfo = (page: Page) =>
  page.evaluate(() => {
    const element = document.activeElement as HTMLElement | null;
    if (!element) return null;
    return {
      tag: element.tagName,
      className: typeof element.className === "string" ? element.className : "",
      role: element.getAttribute("role"),
      ariaLabel: element.getAttribute("aria-label"),
      text: (element.textContent ?? "").trim().slice(0, 40),
      scrollTop:
        element.classList.contains("instructionDocument") ? Math.round(element.scrollTop) : null,
    };
  });

const treeRowText = (page: Page, index: number) =>
  page.locator(".instructionTreeRow").nth(index).innerText();

test.describe("P96-03 viewer keyboard", () => {
  test("a row has focus on open, arrow keys move without opening, Enter opens", async ({ page }) => {
    await openViewer(page);
    const rows = page.locator(".instructionTreeRow");
    await expect(rows.first()).toBeFocused();
    expect((await activeElementInfo(page))!.className).toContain("instructionTreeRow");

    await expandRoot(page);
    // フォルダーを開いただけでは文書は開かない
    await expect(page.locator(".instructionDocument")).toHaveCount(0);

    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(1)).toBeFocused();
    await expect(page.locator(".instructionDocument")).toHaveCount(0);

    await page.keyboard.press("ArrowDown");
    await expect(rows.nth(2)).toBeFocused();
    await expect(page.locator(".instructionDocument")).toHaveCount(0);

    await page.keyboard.press("ArrowUp");
    await expect(rows.nth(1)).toBeFocused();
    expect(await treeRowText(page, 1)).toContain("guide.md");

    await page.keyboard.press("Enter");
    await expect(page.locator(".instructionDocument")).toBeVisible();
    await expect(page.locator(".instructionHeaderTitle strong")).toHaveText("guide.md");
  });

  test("right from a file row moves to the body; arrows scroll it; left returns to the row", async ({
    page,
  }) => {
    await openViewer(page, { path: GUIDE });
    await expandRoot(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await activeElementInfo(page))?.className ?? "")
      .toContain("instructionDocument");
    const body = (await activeElementInfo(page))!;
    expect(body.ariaLabel).toBe("手順書本文");
    expect(body.scrollTop).toBe(0);

    await page.keyboard.press("ArrowDown");
    await expect.poll(async () => (await activeElementInfo(page))!.scrollTop).toBe(40);
    await page.keyboard.press("PageDown");
    await expect
      .poll(async () => (await activeElementInfo(page))!.scrollTop)
      .toBeGreaterThan(40);
    await page.keyboard.press("End");
    const bottom = (await activeElementInfo(page))!.scrollTop!;
    expect(bottom).toBeGreaterThan(100);
    await page.keyboard.press("Home");
    await expect.poll(async () => (await activeElementInfo(page))!.scrollTop).toBe(0);

    await page.keyboard.press("ArrowLeft");
    await expect
      .poll(async () => (await activeElementInfo(page))!.className)
      .toContain("instructionTreeRow");
    expect(await treeRowText(page, 1)).toContain("guide.md");
  });

  test("right on a row whose file is not open opens it and moves to the body", async ({ page }) => {
    await openViewer(page, { path: GUIDE });
    await expandRoot(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    expect(await treeRowText(page, 2)).toContain("notes.txt");
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await activeElementInfo(page))?.className ?? "")
      .toContain("instructionDocument");
    await expect(page.locator(".instructionHeaderTitle strong")).toHaveText("notes.txt");
    await expect(page.locator(".instructionDocument")).toContainText("1行目のメモです。");
  });

  test("scrolls inside the HTML document with the same keys", async ({ page }) => {
    await openViewer(page, { path: REFERENCE });
    await expandRoot(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    expect(await treeRowText(page, 3)).toContain("reference.html");
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await activeElementInfo(page))?.className ?? "")
      .toContain("instructionDocument");
    const frame = page.locator(".instructionHtmlFrame");
    await expect(frame).toBeVisible();
    const scrollY = () =>
      frame.evaluate((element) => {
        const frameWindow = (element as HTMLIFrameElement).contentWindow;
        return frameWindow ? Math.round(frameWindow.scrollY) : -1;
      });
    expect(await scrollY()).toBe(0);
    await page.keyboard.press("ArrowDown");
    await expect.poll(scrollY).toBe(40);
    await page.keyboard.press("End");
    await expect.poll(scrollY).toBeGreaterThan(100);
  });

  test("the search box moves into the tree and the first row moves back", async ({ page }) => {
    await openViewer(page);
    const search = page.locator(".instructionSearchField input");
    await search.click();
    await expect(search).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(page.locator(".instructionTreeRow").first()).toBeFocused();
    await page.keyboard.press("ArrowUp");
    await expect(search).toBeFocused();

    // 入力があるときは、今までどおり検索結果の選択
    await search.fill("guide");
    await expect(page.getByRole("option").first()).toBeVisible();
    await page.keyboard.press("ArrowDown");
    await expect(search).toBeFocused();
    const activeDescendant = await search.getAttribute("aria-activedescendant");
    expect(activeDescendant).toBeTruthy();
  });

  test("header buttons move with left and right and stop at the ends", async ({ page }) => {
    await openViewer(page, { path: GUIDE });
    const buttons = page.locator(".instructionHeader button:not([disabled])");
    const count = await buttons.count();
    expect(count).toBeGreaterThan(3);
    await buttons.first().focus();
    for (let index = 1; index < count; index += 1) {
      await page.keyboard.press("ArrowRight");
      await expect(buttons.nth(index)).toBeFocused();
    }
    // 端では止まる
    await page.keyboard.press("ArrowRight");
    await expect(buttons.nth(count - 1)).toBeFocused();
    for (let index = count - 2; index >= 0; index -= 1) {
      await page.keyboard.press("ArrowLeft");
      await expect(buttons.nth(index)).toBeFocused();
    }
    await page.keyboard.press("ArrowLeft");
    await expect(buttons.first()).toBeFocused();
  });

  test("arrow keys inside the editor stay in the text", async ({ page }) => {
    await openViewer(page, { path: GUIDE });
    await page.getByRole("button", { name: "手順書を編集" }).click();
    const textarea = page.locator(".instructionEditorTextarea");
    await expect(textarea).toBeVisible();
    await textarea.click();
    await textarea.evaluate((element) => {
      (element as HTMLTextAreaElement).setSelectionRange(0, 0);
    });
    await page.keyboard.press("ArrowDown");
    expect(await textarea.evaluate((element) => (element as HTMLTextAreaElement).selectionStart)).toBeGreaterThan(0);
    await expect(textarea).toBeFocused();
  });

  test("the body shows a single yellow focus ring", async ({ page }) => {
    await openViewer(page, { path: GUIDE });
    await expandRoot(page);
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await activeElementInfo(page))?.className ?? "")
      .toContain("instructionDocument");
    await expect(page.locator(".instructionDocument")).toHaveCSS("outline-style", "solid");
    await expect(page.locator(".instructionDocument")).toHaveCSS("outline-color", "rgb(231, 185, 77)");
    await expect(page.locator(".instructionDocument")).toHaveCSS("outline-width", "2px");
  });
});
