import { expect, test, type Page } from "@playwright/test";
import {
  bookPages,
  createPublicFixture,
  FIXTURE_NOW,
  type VisualQaFixture,
} from "./fixtures";
import { waitForBundledFonts } from "./bundledFonts";
import { installTauriMock } from "./tauriMock";
import type { InstructionBookState } from "../../src/types";

const ROOT = "C:\\PublicDemo\\Instructions";
const BOOK_FOLDER = `${ROOT}\\教材`;
const BOOK_PATH = `${BOOK_FOLDER}\\英単語ドリル.zip`;
const SCREENSHOT_OPTIONS = {
  animations: "disabled" as const,
  caret: "hide" as const,
  maxDiffPixelRatio: 0.001,
};

function bookFixture(options: {
  pageCount?: number;
  state?: Partial<InstructionBookState>;
  truncated?: boolean;
} = {}): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.instructionExtraEntries = [
    {
      name: "教材",
      path: BOOK_FOLDER,
      kind: "folder",
      readOnly: false,
    },
    {
      name: "英単語ドリル.zip",
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
      pages: bookPages(options.pageCount ?? 120),
      truncated: options.truncated,
    },
  };
  if (options.state) {
    fixture.instructionBookState = {
      [BOOK_PATH]: {
        direction: "rtl",
        spread: true,
        coverSingle: true,
        lastPage: 1,
        ...options.state,
      },
    };
  }
  return fixture;
}

async function openViewer(
  page: Page,
  fixture: VisualQaFixture,
  path: string,
  options: { reduce?: boolean; viewport?: { width: number; height: number } } = {},
) {
  const viewport = options.viewport ?? { width: 1180, height: 780 };
  await page.setViewportSize(viewport);
  await page.emulateMedia({
    reducedMotion: options.reduce === false ? "no-preference" : "reduce",
  });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "life-launcher-instruction");
  await page.goto(`/?view=instruction&path=${encodeURIComponent(path)}`);
  await waitForBundledFonts(page);
  // Freeze time after loading so the 120ms turn and the 800ms save are advanced explicitly.
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
}

async function waitForBook(page: Page) {
  await expect(page.locator(".bookPane")).toBeVisible();
  await expect(page.locator(".bookPageLayer--current img").first()).toBeVisible();
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((image) => image.decode().catch(() => undefined)),
    ),
  );
}

async function openBook(page: Page, fixture = bookFixture(), reduce = true) {
  await openViewer(page, fixture, BOOK_PATH, { reduce });
  await waitForBook(page);
}

async function openBookFromTree(page: Page, fixture = bookFixture()) {
  await openViewer(page, fixture, `${ROOT}\\guide.md`);
  await expect(page.locator(".instructionTreeRow").first()).toBeVisible();
  await page.locator(".instructionTreeRow").first().focus();
  await page.keyboard.press("ArrowRight");
  const folder = page.locator(".instructionTreeRow", { hasText: "教材" });
  await expect(folder).toBeVisible();
  await folder.dblclick();
  const zipRow = page.locator(".instructionTreeRow", { hasText: "英単語ドリル.zip" });
  await expect(zipRow).toBeVisible();
  await zipRow.click();
  await waitForBook(page);
}

const pageImage = (page: Page, number: number) =>
  page.locator(`.bookPageLayer--current img[alt="${number}ページ"]`);

test("V160-B2 the cover is one page and a spread opens at the remembered page", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));

  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");
  await expect(page.locator(".bookPageLayer--current img")).toHaveCount(2);
  await expect(page.locator(".bookStage")).toHaveClass(/bookStage--rtl/);
  await expect(page.locator(".bookStage [aria-live='polite']")).toHaveText("34、35ページ");
  await expect(page.locator(".bookProgress b")).toHaveAttribute("style", /28\.33/);
  const rtlBoxes = await page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLImageElement>(".bookPageLayer--current img")).map(
      (image) => ({ alt: image.alt, x: image.getBoundingClientRect().x }),
    ),
  );
  const box34 = rtlBoxes.find((box) => box.alt === "34ページ")!;
  const box35 = rtlBoxes.find((box) => box.alt === "35ページ")!;
  expect(box34.x).toBeGreaterThan(box35.x);

  await page.getByRole("button", { name: "前のページ" }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("32–33 / 120");
  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");
});

test("V160-B2 the cover opens alone and the turn zones stop at both ends", async ({ page }) => {
  await openBook(page);
  await expect(page.locator(".bookPageLabel")).toHaveText("1 / 120");
  await expect(page.locator(".bookPageLayer--current img")).toHaveCount(1);

  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("2–3 / 120");

  const stage = page.locator(".bookStage");
  const box = (await stage.boundingBox())!;
  await stage.click({ position: { x: box.width / 2, y: box.height / 2 } });
  await expect(page.locator(".bookPageLabel")).toHaveText("2–3 / 120");

  await stage.focus();
  await page.keyboard.press("End");
  await expect(page.locator(".bookPageLabel")).toHaveText("120 / 120");
  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("120 / 120");

  await page.keyboard.press("Home");
  await expect(page.locator(".bookPageLabel")).toHaveText("1 / 120");
  await page.getByRole("button", { name: "前のページ" }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("1 / 120");
});

test("V160-B2 keys follow the reading direction and the page mode", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const stage = page.locator(".bookStage");
  await stage.focus();

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");
  await page.keyboard.press("PageDown");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await page.keyboard.press("PageUp");
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");
  await page.keyboard.press(" ");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await page.keyboard.press("Shift+Space");
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");

  await page.getByRole("button", { name: "1ページ", exact: true }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("34 / 120");
  await stage.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("35 / 120");

  await page.getByRole("button", { name: "左から右", exact: true }).click();
  await stage.focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("34 / 120");
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".bookPageLabel")).toHaveText("35 / 120");
});

test("V160-B2 switching the direction and the page mode reflows the opening", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");

  await page.getByRole("button", { name: "左から右", exact: true }).click();
  await expect(page.locator(".bookStage")).not.toHaveClass(/bookStage--rtl/);
  const ltrX = await Promise.all(
    [34, 35].map((number) => pageImage(page, number).evaluate((node) => node.getBoundingClientRect().x)),
  );
  expect(ltrX[0]).toBeLessThan(ltrX[1]);

  await page.getByRole("button", { name: "1ページ", exact: true }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("34 / 120");
  await expect(page.locator(".bookPageLayer--current img")).toHaveCount(1);

  await page.getByRole("button", { name: "見開き", exact: true }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");
  await expect(page.locator(".bookPageLayer--current img")).toHaveCount(2);
});

test("V160-B2 the cover switch changes only the first opening", async ({ page }) => {
  await openBook(page);
  const cover = page.getByRole("checkbox", { name: "表紙は1ページ" });
  await expect(cover).toBeChecked();
  await expect(page.locator(".bookPageLabel")).toHaveText("1 / 120");

  await cover.uncheck();
  await expect(page.locator(".bookPageLabel")).toHaveText("1–2 / 120");
  await expect(page.locator(".bookPageLayer--current img")).toHaveCount(2);
  await cover.check();
  await expect(page.locator(".bookPageLabel")).toHaveText("1 / 120");
});

test("V160-B2 the wheel turns pages with a 250ms guard", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const stage = page.locator(".bookStage");
  await stage.hover();

  await page.mouse.wheel(0, 120);
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await page.mouse.wheel(0, -120);
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");

  await page.clock.runFor(300);
  await page.mouse.wheel(0, -120);
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");
});

test("V160-B2 the remembered page is saved after 800ms and restored on reload", async ({
  page,
}) => {
  await openBook(page);
  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("2–3 / 120");
  await page.clock.runFor(800);

  await page.reload();
  await waitForBundledFonts(page);
  await waitForBook(page);
  await expect(page.locator(".bookPageLabel")).toHaveText("2–3 / 120");
});

test("V160-B2 reduced motion replaces the opening without a fade layer", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }), true);
  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await expect(page.locator(".bookPageLayer--outgoing")).toHaveCount(0);
});

test("V160-B2 the normal motion cross-fades the previous opening for 120ms", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }), false);
  expect(
    await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches),
  ).toBe(false);
  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await expect(page.locator(".bookPageLayer--outgoing")).toHaveCount(1);
  await page.clock.runFor(120);
  await expect(page.locator(".bookPageLayer--outgoing")).toHaveCount(0);
});

test("V160-B3 the tree and the search results mark the ZIP with the images icon", async ({
  page,
}) => {
  await openViewer(page, bookFixture(), `${ROOT}\\guide.md`);
  await expect(page.locator(".instructionTreeRow").first()).toBeVisible();
  await page.locator(".instructionTreeRow").first().focus();
  await page.keyboard.press("ArrowRight");
  const folder = page.locator(".instructionTreeRow", { hasText: "教材" });
  await expect(folder).toBeVisible();
  await folder.dblclick();
  const zipRow = page.locator(".instructionTreeRow", { hasText: "英単語ドリル.zip" });
  await expect(zipRow).toBeVisible();
  await expect(zipRow.locator(".instructionFileIcon")).toHaveClass(/instructionFileIcon--images/);
  await expect(page.locator(".instructionTreePanel")).toHaveScreenshot(
    "book-tree.png",
    SCREENSHOT_OPTIONS,
  );
  await zipRow.click();
  await waitForBook(page);
  await expect(page.locator(".bookPageLabel")).toHaveText("1 / 120");

  const search = page.locator(".instructionSearchField input");
  await search.fill("英単語");
  await page.clock.runFor(200);
  const result = page.locator(".instructionSearchResult", { hasText: "英単語ドリル.zip" });
  await expect(result).toBeVisible();
  await expect(result.locator(".instructionFileIcon")).toHaveClass(
    /instructionFileIcon--images/,
  );
});

test("V160-B2 the turn cues appear only while the pointer is over a turn zone", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const stage = page.locator(".bookStage");
  const box = (await stage.boundingBox())!;
  const leftZone = page.locator(".bookZone--left");
  const rightZone = page.locator(".bookZone--right");
  await expect(leftZone).toHaveAttribute("data-visible", "false");
  await expect(rightZone).toHaveAttribute("data-visible", "false");

  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
  await expect(leftZone).toHaveAttribute("data-visible", "true");
  await expect(leftZone.locator("em")).toHaveText("次のページ(←)");
  await expect(rightZone).toHaveAttribute("data-visible", "false");

  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2);
  await expect(rightZone).toHaveAttribute("data-visible", "true");
  await expect(rightZone.locator("em")).toHaveText("前のページ(→)");
  await expect(leftZone).toHaveAttribute("data-visible", "false");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await expect(leftZone).toHaveAttribute("data-visible", "false");
  await expect(rightZone).toHaveAttribute("data-visible", "false");
});

test("V160-B2 a truncated ZIP shows the 5,000 page notice", async ({ page }) => {
  await openBook(page, bookFixture({ pageCount: 3, truncated: true }));
  await expect(page.locator(".bookNotice")).toHaveText("5,000ページまで表示しています");
  await expect(page.locator(".bookPageLabel")).toHaveText("1 / 3");
});

test("V160-B2 a ZIP without readable images shows the reason inside the pane", async ({
  page,
}) => {
  const fixture = bookFixture();
  delete fixture.instructionBookPages;
  await openViewer(page, fixture, BOOK_PATH);
  await expect(page.locator(".bookStatus--error")).toHaveText(
    "この ZIP には開ける画像がありません",
  );
  await expect(page.locator(".bookPane")).toHaveCount(0);
});

test("V160-S6 opening the book focuses the pages and ← turns them", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const stage = page.locator(".bookStage");
  await expect(stage).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
});

test("V160-S6 a ZIP opened from the tree focuses the pages", async ({ page }) => {
  await openBookFromTree(page);
  const stage = page.locator(".bookStage");
  await expect(stage).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("2–3 / 120");
});

test("V160-S6 clicking a turn zone keeps the pages focused", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const stage = page.locator(".bookStage");
  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await expect(stage).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("38–39 / 120");
});

test("V160-S6 a toolbar click keeps the pages focused", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const stage = page.locator(".bookStage");
  await page.getByRole("button", { name: "1ページ", exact: true }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("34 / 120");
  await expect(stage).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("35 / 120");
});

test("V160-S6 typing in the search field keeps the focus there", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const search = page.locator(".instructionSearchField input");
  await search.click();
  await search.pressSequentially("英単語");
  await expect(search).toBeFocused();
  await page.clock.runFor(200);
  await expect(page.locator(".instructionSearchResult").first()).toBeVisible();
  await expect(search).toBeFocused();
});

test("V160-S7 a mouse-opened ZIP has no focus ring", async ({ page }) => {
  await openBookFromTree(page);
  const stage = page.locator(".bookStage");
  await expect(stage).toBeFocused();
  await expect(stage).not.toHaveAttribute("data-focus-ring");
});

test("V160-S7 a keyboard-opened ZIP shows the focus ring", async ({ page }) => {
  await openViewer(page, bookFixture(), `${ROOT}\\guide.md`);
  await page.locator(".instructionTreeRow").first().focus();
  await page.keyboard.press("ArrowRight");
  const folder = page.locator(".instructionTreeRow", { hasText: "教材" });
  await expect(folder).toBeVisible();
  await folder.dblclick();
  const zipRow = page.locator(".instructionTreeRow", { hasText: "英単語ドリル.zip" });
  await expect(zipRow).toBeVisible();
  await zipRow.focus();
  await page.keyboard.press("Enter");
  await waitForBook(page);
  const stage = page.locator(".bookStage");
  await expect(stage).toBeFocused();
  await expect(stage).toHaveAttribute("data-focus-ring", "true");
});

test("V160-S7 Tab into the pages shows the ring and clicking removes it", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const stage = page.locator(".bookStage");
  await expect(stage).toBeFocused();
  await expect(stage).not.toHaveAttribute("data-focus-ring");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(stage).toBeFocused();
  await expect(stage).toHaveAttribute("data-focus-ring", "true");
  await stage.click({ position: { x: 100, y: 100 } });
  await expect(stage).not.toHaveAttribute("data-focus-ring");
});

test("V160-S7 the ring uses the gold inset shadow and stays while turning", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const stage = page.locator(".bookStage");
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(stage).toHaveAttribute("data-focus-ring", "true");
  expect(await stage.evaluate((element) => getComputedStyle(element).boxShadow)).toBe(
    "rgb(255, 206, 91) 0px 0px 0px 1px inset",
  );
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await expect(stage).toHaveAttribute("data-focus-ring", "true");
});

test("V160-B2 baseline: spread, cover and single", async ({ page }) => {
  await openViewer(page, bookFixture({ state: { lastPage: 34 } }), BOOK_PATH, {
    reduce: true,
  });
  await waitForBook(page);
  await expect(page).toHaveScreenshot("book-spread.png", SCREENSHOT_OPTIONS);

  await page.getByRole("button", { name: "1ページ", exact: true }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("34 / 120");
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((image) => image.decode().catch(() => undefined)),
    ),
  );
  await expect(page).toHaveScreenshot("book-single.png", SCREENSHOT_OPTIONS);

  await page.getByRole("button", { name: "見開き", exact: true }).click();
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");
  await page.locator(".bookStage").focus();
  await page.keyboard.press("Home");
  await expect(page.locator(".bookPageLabel")).toHaveText("1 / 120");
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((image) => image.decode().catch(() => undefined)),
    ),
  );
  await page.clock.runFor(300);
  await expect(page).toHaveScreenshot("book-cover.png", SCREENSHOT_OPTIONS);
});
