import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { bookPages, createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { measureRects } from "./helpers";
import { installTauriMock } from "./tauriMock";

const ROOT = "C:\\PublicDemo\\Instructions";
const DOC_PATH = `${ROOT}\\welcome.md`;
const BOOK_PATH = `${ROOT}\\drill.zip`;

function createViewerFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.instructionExtraEntries = [
    {
      name: "drill.zip",
      path: BOOK_PATH,
      kind: "file",
      extension: "zip",
      size: 1024,
      modifiedAt: 5,
      readOnly: true,
    },
  ];
  fixture.instructionBookPages = {
    [BOOK_PATH]: {
      pages: bookPages(10),
    },
  };
  return fixture;
}

async function openInstruction(page: Page, path: string) {
  await page.setViewportSize({ width: 1180, height: 780 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createViewerFixture(), "life-launcher-instruction");
  await page.goto(`/?view=instruction&path=${encodeURIComponent(path)}`);
  await waitForBundledFonts(page);
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
}

test("V162-U3 sidebar close/open buttons toggle cleanly on Markdown, persist across reload, and keep focus", async ({
  page,
}) => {
  await openInstruction(page, DOC_PATH);
  await expect(page.locator(".instructionMarkdown")).toBeVisible();
  await expect(page.locator(".instructionSidebar")).toBeVisible();

  const before = await measureRects(page, [".instructionSidebar", ".instructionContentPane"]);
  const closeBtn = page.getByRole("button", { name: "手順書一覧を閉じる" });
  await closeBtn.focus();
  await closeBtn.press("Enter");
  // V163-M1: opening and closing spring for 0.2 s; the paused page clock has to move past it.
  await page.clock.runFor(500);

  await expect(page.locator(".instructionSidebar")).toBeHidden();
  await expect(page.locator(".instructionSidebarCollapsedBar")).toBeVisible();
  const openBtn = page.getByRole("button", { name: "手順書一覧を開く" });
  await expect(openBtn).toBeFocused();

  const after = await measureRects(page, [".instructionContentPane"]);
  expect(after[".instructionContentPane"].width).toBeGreaterThan(
    before[".instructionContentPane"].width + 180,
  );

  // Collapsed state persists across reloads and survives size cycling without popping back open.
  await page.reload();
  await waitForBundledFonts(page);
  await expect(page.locator(".instructionSidebar")).toBeHidden();
  await page.getByRole("button", { name: "ビューアーのサイズを切り替える" }).click();
  await expect(page.locator(".instructionSidebar")).toBeHidden();

  // No keyboard shortcut toggles the sidebar.
  await page.keyboard.press("Control+b");
  await expect(page.locator(".instructionSidebar")).toBeHidden();

  await page.getByRole("button", { name: "手順書一覧を開く" }).press("Enter");
  // V163-M1: opening and closing spring for 0.2 s; the paused page clock has to move past it.
  await page.clock.runFor(500);
  await expect(page.locator(".instructionSidebar")).toBeVisible();
  await expect(page.getByRole("button", { name: "手順書一覧を閉じる" })).toBeFocused();
});

test("V162-U3 collapsing the sidebar widens the ZIP book stage, divider dblclick closes, and min width is 140px", async ({
  page,
}) => {
  await openInstruction(page, BOOK_PATH);
  await expect(page.locator(".bookPane")).toBeVisible();
  await expect(page.locator(".bookPageLayer--current img").first()).toBeVisible();

  const beforeStage = await measureRects(page, [".bookStage"]);
  await page.getByRole("button", { name: "手順書一覧を閉じる" }).click();
  // V163-M1: opening and closing spring for 0.2 s; the paused page clock has to move past it.
  await page.clock.runFor(500);
  await expect(page.locator(".instructionSidebar")).toBeHidden();
  const afterStage = await measureRects(page, [".bookStage"]);
  expect(afterStage[".bookStage"].width).toBeGreaterThan(beforeStage[".bookStage"].width + 180);

  await page.getByRole("button", { name: "手順書一覧を開く" }).click();
  // V163-M1: opening and closing spring for 0.2 s; the paused page clock has to move past it.
  await page.clock.runFor(500);
  await expect(page.locator(".instructionSidebar")).toBeVisible();

  // Minimum sidebar width can be narrowed to 140px and divider dblclick collapses it.
  const divider = page.locator(".instructionSidebarDivider");
  await divider.focus();
  await divider.press("Home");
  const narrowed = await measureRects(page, [".instructionSidebar"]);
  expect(Math.round(narrowed[".instructionSidebar"].width)).toBe(140);

  await divider.dblclick();
  // V163-M1: opening and closing spring for 0.2 s; the paused page clock has to move past it.
  await page.clock.runFor(500);
  await expect(page.locator(".instructionSidebar")).toBeHidden();
});
