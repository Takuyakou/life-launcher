import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { bookPages, createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { measureRects } from "./helpers";
import { installTauriMock } from "./tauriMock";
import type { InstructionBookState } from "../../src/types";

const ROOT = "C:\\PublicDemo\\Instructions";
const BOOK_FOLDER = `${ROOT}\\教材`;
const BOOK_PATH = `${BOOK_FOLDER}\\英単語ドリル.zip`;

function bookFixture(options: {
  pageCount?: number;
  pageWidth?: number;
  pageHeight?: number;
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
      pages: bookPages(options.pageCount ?? 20, options.pageWidth, options.pageHeight),
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

async function openBook(page: Page, fixture = bookFixture()) {
  await page.setViewportSize({ width: 1180, height: 780 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "life-launcher-instruction");
  await page.goto(`/?view=instruction&path=${encodeURIComponent(BOOK_PATH)}`);
  await waitForBundledFonts(page);
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
  await expect(page.locator(".bookPane")).toBeVisible();
  await expect(page.locator(".bookPageLayer--current img").first()).toBeVisible();
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((image) => image.decode().catch(() => undefined)),
    ),
  );
}

test("V162-U1 hovering left and right turn zones leaves pages untinted and shows symmetric arrows", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 4 } }));
  const stage = page.locator(".bookStage");
  const box = (await stage.boundingBox())!;

  await page.mouse.move(box.x + box.width * 0.1, box.y + box.height / 2);
  await expect(page.locator(".bookZone--left")).toHaveAttribute("data-visible", "true");
  const leftStyle = await page.evaluate(() => {
    const zone = document.querySelector(".bookZone--left");
    const arrow = zone?.querySelector("span");
    if (!zone || !arrow) throw new Error("missing left zone");
    return {
      zoneBgColor: getComputedStyle(zone).backgroundColor,
      zoneBgImage: getComputedStyle(zone).backgroundImage,
      arrowColor: getComputedStyle(arrow).color,
    };
  });

  await page.mouse.move(box.x + box.width * 0.9, box.y + box.height / 2);
  await expect(page.locator(".bookZone--right")).toHaveAttribute("data-visible", "true");
  const rightStyle = await page.evaluate(() => {
    const zone = document.querySelector(".bookZone--right");
    const arrow = zone?.querySelector("span");
    if (!zone || !arrow) throw new Error("missing right zone");
    return {
      zoneBgColor: getComputedStyle(zone).backgroundColor,
      zoneBgImage: getComputedStyle(zone).backgroundImage,
      arrowColor: getComputedStyle(arrow).color,
    };
  });

  expect(leftStyle.zoneBgColor).toBe("rgba(0, 0, 0, 0)");
  expect(leftStyle.zoneBgImage).toBe("none");
  expect(rightStyle.zoneBgColor).toBe("rgba(0, 0, 0, 0)");
  expect(rightStyle.zoneBgImage).toBe("none");
  expect(leftStyle.arrowColor).toBe(rightStyle.arrowColor);
  expect(rightStyle.arrowColor).not.toBe("rgba(0, 0, 0, 0)");
  expect(rightStyle.arrowColor).not.toContain(", 0)");
});

test("V162-U2 small images fit the stage in 全体 mode, scale smoothly to 125%, and clear the progress bar", async ({
  page,
}) => {
  await openBook(
    page,
    bookFixture({ pageCount: 10, pageWidth: 300, pageHeight: 420, state: { lastPage: 2 } }),
  );

  const fitMeasure = await page.evaluate(() => {
    const stage = document.querySelector(".bookStage");
    const img = document.querySelector<HTMLImageElement>('.bookPageLayer--current img[alt="2ページ"]');
    const progress = document.querySelector(".bookProgress");
    if (!stage || !img || !progress) throw new Error("missing stage, image, or progress bar");
    const imgRect = img.getBoundingClientRect();
    const progressRect = progress.getBoundingClientRect();
    return {
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
      stageClientWidth: stage.clientWidth,
      stageClientHeight: stage.clientHeight,
      renderedWidth: imgRect.width,
      renderedHeight: imgRect.height,
      imgBottom: imgRect.bottom,
      progressTop: progressRect.top,
    };
  });

  expect(fitMeasure.naturalWidth).toBe(300);
  expect(fitMeasure.naturalHeight).toBe(420);
  const expectedFitScale = Math.min(
    (fitMeasure.stageClientWidth - 24 - 2) / 2 / fitMeasure.naturalWidth,
    (fitMeasure.stageClientHeight - 32) / fitMeasure.naturalHeight,
  );
  // Small images are fitted cleanly to the available stage slot instead of staying at 300x420.
  expect(fitMeasure.renderedHeight).toBeGreaterThan(fitMeasure.naturalHeight + 150);
  expect(
    Math.abs(fitMeasure.renderedHeight - fitMeasure.naturalHeight * expectedFitScale),
  ).toBeLessThanOrEqual(1.5);
  // Bottom padding (24px) keeps the page bottom above the 24px scrub bar hit target.
  expect(fitMeasure.imgBottom).toBeLessThanOrEqual(fitMeasure.progressTop + 1);

  await page.getByRole("button", { name: "拡大", exact: true }).click();
  await expect(page.locator(".bookZoomReset")).toHaveText("125%");
  const rects125 = await measureRects(page, ['.bookPageLayer--current img[alt="2ページ"]']);
  const img125 = rects125['.bookPageLayer--current img[alt="2ページ"]'];
  expect(Math.abs(img125.width - fitMeasure.renderedWidth * 1.25)).toBeLessThanOrEqual(1.5);
  expect(Math.abs(img125.height - fitMeasure.renderedHeight * 1.25)).toBeLessThanOrEqual(1.5);
});
