import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { bookPages, createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import type { InstructionBookState } from "../../src/types";

const ROOT = "C:\\PublicDemo\\Instructions";
const BOOK_FOLDER = `${ROOT}\\教材`;
const BOOK_PATH = `${BOOK_FOLDER}\\英単語ドリル.zip`;
type QaControl = {
  invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
  holdBookPage: (page: number) => void;
  releaseBookPage: (page: number) => void;
};

function bookFixture(options: {
  pageCount?: number;
  state?: Partial<InstructionBookState>;
} = {}): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.instructionExtraEntries = [
    { name: "教材", path: BOOK_FOLDER, kind: "folder", readOnly: false },
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

async function openBook(
  page: Page,
  fixture = bookFixture(),
  options: { useClock?: boolean; reduce?: boolean; waitForImage?: boolean } = {},
) {
  await page.setViewportSize({ width: 1180, height: 780 });
  await page.emulateMedia({
    reducedMotion: options.reduce === false ? "no-preference" : "reduce",
  });
  if (options.useClock !== false) {
    await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  }
  await installTauriMock(page, fixture, "life-launcher-instruction");
  await page.goto(`/?view=instruction&path=${encodeURIComponent(BOOK_PATH)}`);
  await waitForBundledFonts(page);
  if (options.useClock !== false) {
    const pausedAt = await page.evaluate(() => Date.now() + 1_000);
    await page.clock.pauseAt(pausedAt);
  }
  await expect(page.locator(".bookPane")).toBeVisible();
  if (options.waitForImage === false) return;
  await expect(page.locator(".bookPageLayer--current img").first()).toBeVisible();
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((image) => image.decode().catch(() => undefined)),
    ),
  );
}


type InvokeCall = { command: string; args: Record<string, unknown> };

async function pageReads(page: Page): Promise<number[]> {
  return page.evaluate((bookPath) => {
    const qa = (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: InvokeCall[] } })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    return qa.invokeCalls
      .filter((call) => call.command === "read_instruction_book_page" && call.args.path === bookPath)
      .map((call) => Number(call.args.index) + 1);
  }, BOOK_PATH);
}

async function control(page: Page, action: "holdBookPage" | "releaseBookPage", pages: number[]) {
  await page.evaluate(
    ({ action, pages }) => {
      const qa = (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl })
        .__LIFE_LAUNCHER_VISUAL_QA__;
      for (const pageNumber of pages) qa[action](pageNumber);
    },
    { action, pages },
  );
}

test("V163-B1 pages passed while turning fast are never read and the stop opening comes first", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");
  await expect(page.locator(".bookPagePending")).toHaveCount(0);

  await control(page, "holdBookPage", [40, 41]);
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  // The two held pages fill both read slots.
  await expect
    .poll(async () => (await pageReads(page)).filter((p) => p === 40 || p === 41).length)
    .toBe(2);

  for (let turn = 0; turn < 8; turn += 1) await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("52–53 / 120");
  await control(page, "releaseBookPage", [40, 41]);
  await expect(page.locator('.bookPageLayer--current img[alt="52ページ"]')).toBeVisible();
  await expect(page.locator('.bookPageLayer--current img[alt="53ページ"]')).toBeVisible();
  await expect(page.locator(".bookPagePending")).toHaveCount(0);

  const reads = await pageReads(page);
  expect(reads.filter((p) => p >= 42 && p <= 47)).toEqual([]);
  const first = (p: number) => reads.indexOf(p);
  const stop = Math.max(first(52), first(53));
  expect(first(52)).toBeGreaterThanOrEqual(0);
  expect(first(53)).toBeGreaterThanOrEqual(0);
  for (const other of [48, 49, 50, 51, 54, 55, 56, 57]) {
    const at = first(other);
    if (at >= 0) expect(at, `page ${other} read before the stop opening`).toBeGreaterThan(stop);
  }
  expect(reads.length, "a page was read twice").toBe(new Set(reads).size);
});

test("V163-B1 a page whose image cannot be drawn shows an error instead of staying dark", async ({
  page,
}) => {
  const fixture = bookFixture({ state: { lastPage: 1 } });
  // A PNG signature followed by broken data: it is treated as a PNG, but decode fails and the size stays 0.
  const broken = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.from("not a real image"),
  ]).toString("base64");
  fixture.instructionBookPages![BOOK_PATH].pages[0] = broken;
  await openBook(page, fixture, { waitForImage: false });
  await expect(page.locator(".bookPageError")).toHaveText("このページの画像を表示できませんでした");
  await expect(page.locator(".bookPagePending")).toHaveCount(0);
});
