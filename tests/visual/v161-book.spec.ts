import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { bookPages, createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { measureRects } from "./helpers";
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

type QaControl = {
  invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
  holdBookPage: (page: number) => void;
  releaseBookPage: (page: number) => void;
};

type FrameSample = {
  layerCount: number;
  outgoingCount: number;
  pendingCount: number;
  layerOpacity: string;
  images: Array<{ alt: string; complete: boolean; naturalWidth: number; opacity: string }>;
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
  options: { useClock?: boolean; reduce?: boolean } = {},
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
  await expect(page.locator(".bookPageLayer--current img").first()).toBeVisible();
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((image) => image.decode().catch(() => undefined)),
    ),
  );
}

test("V161-B1 turning a preloaded opening switches in one frame with full opacity", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }), {
    useClock: false,
    reduce: false,
  });

  // Visit 36–37 first and return to 34–35 so 36–37 are guaranteed preloaded and decoded.
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await expect(page.locator('.bookPageLayer--current img[alt="36ページ"]')).toBeVisible();
  await expect(page.locator('.bookPageLayer--current img[alt="37ページ"]')).toBeVisible();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");
  await expect(page.locator('.bookPageLayer--current img[alt="34ページ"]')).toBeVisible();

  await page.evaluate(() => {
    const store = window as unknown as {
      __v161Samples: FrameSample[];
      __v161Sampling: boolean;
      __v161Observer: MutationObserver;
    };
    const capture = () => {
      const layers = document.querySelectorAll(".bookPageLayer");
      const current = document.querySelector(".bookPageLayer--current");
      const images = Array.from(document.querySelectorAll(".bookPageLayer--current img")).map(
        (node) => {
          const img = node as HTMLImageElement;
          return {
            alt: img.alt,
            complete: img.complete,
            naturalWidth: img.naturalWidth,
            opacity: getComputedStyle(img).opacity,
          };
        },
      );
      store.__v161Samples.push({
        layerCount: layers.length,
        outgoingCount: document.querySelectorAll(".bookPageLayer--outgoing").length,
        pendingCount: document.querySelectorAll(".bookPagePending").length,
        layerOpacity: current ? getComputedStyle(current).opacity : "none",
        images,
      });
    };
    store.__v161Samples = [];
    store.__v161Sampling = true;
    const stage = document.querySelector(".bookStage");
    if (stage) {
      store.__v161Observer = new MutationObserver(capture);
      store.__v161Observer.observe(stage, { childList: true, subtree: true, attributes: true });
    }
    const tick = () => {
      capture();
      if (store.__v161Sampling) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve()))),
  );

  const samples = await page.evaluate(() => {
    const store = window as unknown as {
      __v161Samples: FrameSample[];
      __v161Sampling: boolean;
      __v161Observer?: MutationObserver;
    };
    store.__v161Sampling = false;
    store.__v161Observer?.disconnect();
    return store.__v161Samples;
  });

  expect(samples.length).toBeGreaterThan(1);
  for (const sample of samples) {
    expect(sample.layerCount).toBe(1);
    expect(sample.outgoingCount).toBe(0);
    expect(sample.pendingCount).toBe(0);
    expect(sample.layerOpacity).toBe("1");
    expect(sample.images.length).toBe(2);
    for (const image of sample.images) {
      expect(image.complete).toBe(true);
      expect(image.naturalWidth).toBeGreaterThan(0);
      expect(image.opacity).toBe("1");
    }
    const alts = sample.images.map((image) => image.alt).sort();
    expect([
      ["34ページ", "35ページ"],
      ["36ページ", "37ページ"],
    ]).toContainEqual(alts);
  }
  expect(samples.at(-1)?.images.map((image) => image.alt).sort()).toEqual([
    "36ページ",
    "37ページ",
  ]);
});

test("V161-B1 keeps previous pages for 150ms then shows pending box until ready", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 1 } }));
  await expect(page.locator('.bookPageLayer--current img[alt="1ページ"]')).toBeVisible();

  await page.evaluate(() =>
    (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl }).__LIFE_LAUNCHER_VISUAL_QA__.holdBookPage(6),
  );
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("2–3 / 120");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("4–5 / 120");
  await expect(page.locator('.bookPageLayer--current img[alt="4ページ"]')).toBeVisible();
  await expect(page.locator('.bookPageLayer--current img[alt="5ページ"]')).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("6–7 / 120");
  await page.clock.runFor(100);
  await expect(page.locator(".bookPagePending")).toHaveCount(0);
  await expect(page.locator('.bookPageLayer--current img[alt="4ページ"]')).toBeVisible();
  await expect(page.locator('.bookPageLayer--current img[alt="5ページ"]')).toBeVisible();

  await page.clock.runFor(60);
  await expect(page.locator(".bookPagePending")).toHaveCount(1);
  await expect(page.locator('.bookPageLayer--current img[alt="7ページ"]')).toBeVisible();

  await page.evaluate(() =>
    (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl }).__LIFE_LAUNCHER_VISUAL_QA__.releaseBookPage(6),
  );
  await expect(page.locator(".bookPagePending")).toHaveCount(0);
  await expect(page.locator('.bookPageLayer--current img[alt="6ページ"]')).toBeVisible();
  await expect(page.locator('.bookPageLayer--current img[alt="7ページ"]')).toBeVisible();
});

test("V161-B2 rapid turns never leave preloaded pages stuck in loading state", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  await page.evaluate(() => {
    const qa = (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    qa.holdBookPage(40);
    qa.holdBookPage(42);
    qa.holdBookPage(44);
  });

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("38–39 / 120");
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("40–41 / 120");

  await page.clock.runFor(160);
  await page.evaluate(() => {
    const qa = (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    qa.releaseBookPage(40);
    qa.releaseBookPage(42);
    qa.releaseBookPage(44);
  });

  await expect(page.locator(".bookPagePending")).toHaveCount(0);
  await expect(page.locator('.bookPageLayer--current img[alt="40ページ"]')).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("42–43 / 120");
  await expect(page.locator(".bookPagePending")).toHaveCount(0);
  await expect(page.locator('.bookPageLayer--current img[alt="42ページ"]')).toBeVisible();

  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("44–45 / 120");
  await expect(page.locator(".bookPagePending")).toHaveCount(0);
  await expect(page.locator('.bookPageLayer--current img[alt="44ページ"]')).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".bookPageLabel")).toHaveText("42–43 / 120");
  await expect(page.locator('.bookPageLayer--current img[alt="42ページ"]')).toBeVisible();

  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".bookPageLabel")).toHaveText("40–41 / 120");
  await expect(page.locator('.bookPageLayer--current img[alt="40ページ"]')).toBeVisible();

  // The old preload either lost a held page or asked for it twice: each held page is read exactly once.
  const heldReads = await page.evaluate((bookPath) => {
    const qa = (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    return [40, 42, 44].map(
      (held) =>
        qa.invokeCalls.filter(
          (call) =>
            call.command === "read_instruction_book_page" &&
            call.args.path === bookPath &&
            Number(call.args.index) === held - 1,
        ).length,
    );
  }, BOOK_PATH);
  expect(heldReads).toEqual([1, 1, 1]);
});

test("V162-F1 turning right after a page finishes loading never reads a page twice", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  await page.evaluate(() => {
    const qa = (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    qa.holdBookPage(40);
  });
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");

  // Turn in the same moment a page finishes: after its image decodes, before React draws it.
  // The old preload forgot the read at that point and asked for the page a second time.
  await page.evaluate(() => {
    const originalDecode = HTMLImageElement.prototype.decode;
    let armed = true;
    HTMLImageElement.prototype.decode = function decodeThenTurn(this: HTMLImageElement) {
      const result = originalDecode.call(this);
      if (armed) {
        armed = false;
        void result.then(async () => {
          for (let step = 0; step < 6; step += 1) await null;
          (document.activeElement ?? document.body).dispatchEvent(
            new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }),
          );
        });
      }
      return result;
    };
    const qa = (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    qa.releaseBookPage(40);
  });
  await expect(page.locator(".bookPageLabel")).toHaveText("38–39 / 120");
  await page.clock.runFor(500);

  const readTwice = await page.evaluate((bookPath) => {
    const qa = (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    const counts = new Map<number, number>();
    for (const call of qa.invokeCalls) {
      if (call.command !== "read_instruction_book_page" || call.args.path !== bookPath) continue;
      const pageNumber = Number(call.args.index) + 1;
      counts.set(pageNumber, (counts.get(pageNumber) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .filter(([, count]) => count > 1)
      .map(([pageNumber]) => pageNumber);
  }, BOOK_PATH);
  expect(readTwice).toEqual([]);
});

test("V161-B4 clicking the page label jumps cleanly without moving toolbar controls", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const pageButton = page.locator(".bookPageLabel");
  await expect(pageButton).toHaveAttribute(
    "aria-label",
    "ページを指定して移る(今 34–35 / 120)",
  );

  const beforeRects = await measureRects(page, [
    '.bookToolbar [aria-label="ページの出し方"]',
    '.bookToolbar [aria-label="めくる向き"]',
    ".bookCheck",
  ]);

  await pageButton.click();
  const input = page.locator(".bookJumpInput");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("34");
  expect(
    await input.evaluate(
      (node) => (node as HTMLInputElement).selectionStart === 0 && (node as HTMLInputElement).selectionEnd === 2,
    ),
  ).toBe(true);
  await expect(page.locator(".bookJumpHint")).toHaveText("Enter で移動・Esc でやめる");

  const duringRects = await measureRects(page, [
    '.bookToolbar [aria-label="ページの出し方"]',
    '.bookToolbar [aria-label="めくる向き"]',
    ".bookCheck",
  ]);
  for (const selector of Object.keys(beforeRects)) {
    expect(Math.abs(duringRects[selector].x - beforeRects[selector].x)).toBe(0);
    expect(Math.abs(duringRects[selector].y - beforeRects[selector].y)).toBe(0);
  }

  // IME composing Enter is ignored.
  await input.fill("78");
  await input.evaluate((node) => {
    node.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }),
    );
  });
  await expect(input).toBeVisible();
  await expect(pageButton).toHaveAttribute(
    "aria-label",
    "ページを指定して移る(今 34–35 / 120)",
  );

  await input.press("Enter");
  await expect(page.locator(".bookPageLabel")).toHaveText("78–79 / 120");
  await expect(page.locator(".bookStage")).toBeFocused();

  // Esc cancels without moving and returns focus to the stage.
  await pageButton.click();
  await expect(input).toBeFocused();
  await input.fill("12");
  await input.press("Escape");
  await expect(input).toHaveCount(0);
  await expect(page.locator(".bookPageLabel")).toHaveText("78–79 / 120");
  await expect(page.locator(".bookStage")).toBeFocused();

  // Full-width digits work and out-of-range numbers clamp to 1..120.
  await pageButton.click();
  await input.fill("１０");
  await input.press("Enter");
  await expect(page.locator(".bookPageLabel")).toHaveText("10–11 / 120");

  await pageButton.click();
  await input.fill("999");
  await input.press("Enter");
  await expect(page.locator(".bookPageLabel")).toHaveText("120 / 120");

  await pageButton.click();
  await input.fill("0");
  await input.press("Enter");
  await expect(page.locator(".bookPageLabel")).toHaveText("1 / 120");

  // Non-numeric input closes without changing the page.
  await pageButton.click();
  await input.fill("abc");
  await input.press("Enter");
  await expect(page.locator(".bookPageLabel")).toHaveText("1 / 120");
});

test("V161-B4 Ctrl+G opens the jump input only when not typing in a field", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const search = page.locator(".instructionSearchField input");
  await search.click();
  await page.keyboard.press("Control+g");
  await expect(page.locator(".bookJumpInput")).toHaveCount(0);

  await page.locator(".bookStage").click();
  await page.keyboard.press("Control+g");
  const input = page.locator(".bookJumpInput");
  await expect(input).toBeFocused();
  await expect(input).toHaveValue("34");

  // Clicking outside the input cancels and restores stage focus.
  await page.locator(".bookStage").click({ position: { x: 400, y: 200 } });
  await expect(input).toHaveCount(0);
  await expect(page.locator(".bookStage")).toBeFocused();
});

test("V161-B4 scrub bar jumps accurately in RTL and LTR and skips page reads while dragging", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 1 } }));
  const progress = page.locator(".bookProgress");
  const box = (await progress.boundingBox())!;
  expect(box.height).toBeGreaterThanOrEqual(24);

  // RTL: x closer to the left corresponds to later pages, closer to the right is earlier.
  await page.mouse.move(box.x + box.width * 0.25, box.y + box.height / 2);
  await expect(page.locator(".bookProgressTooltip")).toBeVisible();
  await expect(page.locator(".bookProgressMarker")).toBeVisible();
  await expect(page.locator(".bookProgressThumb")).toBeVisible();

  const countBeforeDrag = await page.evaluate(
    () =>
      (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl }).__LIFE_LAUNCHER_VISUAL_QA__
        .invokeCalls.filter((call) => call.command === "read_instruction_book_page").length,
  );

  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.35, box.y - 30, { steps: 3 });
  const dragTooltipText = await page.locator(".bookProgressTooltip").textContent();
  expect(dragTooltipText).toMatch(/^p\.\d+$/);
  const expectedDragPage = Number(dragTooltipText!.replace("p.", ""));
  expect(expectedDragPage).toBeGreaterThanOrEqual(75);
  expect(expectedDragPage).toBeLessThanOrEqual(85);
  await expect(page.locator(".bookPageLabel")).toContainText(String(expectedDragPage));

  const countDuringDrag = await page.evaluate(
    () =>
      (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl }).__LIFE_LAUNCHER_VISUAL_QA__
        .invokeCalls.filter((call) => call.command === "read_instruction_book_page").length,
  );
  expect(countDuringDrag).toBe(countBeforeDrag);

  await page.mouse.up();
  await expect(page.locator(`.bookPageLayer--current img[alt="${expectedDragPage}ページ"]`)).toBeVisible();
  const countAfterDrop = await page.evaluate(
    () =>
      (window as unknown as { __LIFE_LAUNCHER_VISUAL_QA__: QaControl }).__LIFE_LAUNCHER_VISUAL_QA__
        .invokeCalls.filter((call) => call.command === "read_instruction_book_page").length,
  );
  expect(countAfterDrop).toBeGreaterThan(countBeforeDrag);

  // Hovering near both edges keeps the tooltip inside the scrub bar bounds.
  for (const edgeX of [box.x + 2, box.x + box.width - 2]) {
    await page.mouse.move(edgeX, box.y + box.height / 2);
    const bounds = await measureRects(page, [".bookProgress", ".bookProgressTooltip"]);
    expect(bounds[".bookProgressTooltip"].left).toBeGreaterThanOrEqual(
      bounds[".bookProgress"].left - 1,
    );
    expect(bounds[".bookProgressTooltip"].right).toBeLessThanOrEqual(
      bounds[".bookProgress"].right + 1,
    );
  }

  // LTR direction: clicking near the left jumps near page 1, near the right jumps near 120.
  await page.getByRole("button", { name: "左から右", exact: true }).click();
  await page.mouse.click(box.x + box.width * 0.9, box.y + box.height / 2);
  await expect(page.locator(".bookPageLabel")).toHaveText("108–109 / 120");
  await page.mouse.click(box.x + 2, box.y + box.height / 2);
  await expect(page.locator(".bookPageLabel")).toHaveText("1 / 120");
});

test("V161-B5 zoom steps via buttons, keys, and Ctrl+wheel, and persists zoomPercent", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const zoomOut = page.getByRole("button", { name: "縮小", exact: true });
  const zoomIn = page.getByRole("button", { name: "拡大", exact: true });
  const zoomReset = page.locator(".bookZoomReset");

  await expect(zoomReset).toHaveText("全体");
  await expect(zoomOut).toBeDisabled();
  await expect(zoomIn).toBeEnabled();

  for (const label of ["125%", "150%", "200%", "300%", "400%"]) {
    await zoomIn.click();
    await expect(zoomReset).toHaveText(label);
    await expect(zoomOut).toBeEnabled();
  }
  await expect(zoomIn).toBeDisabled();

  await zoomOut.click();
  await expect(zoomReset).toHaveText("300%");
  await zoomReset.click();
  await expect(zoomReset).toHaveText("全体");
  await expect(zoomOut).toBeDisabled();

  // Keyboard shortcuts: +, =, -, 0
  await page.locator(".bookStage").focus();
  await page.keyboard.press("=");
  await expect(zoomReset).toHaveText("125%");
  await page.keyboard.press("+");
  await expect(zoomReset).toHaveText("150%");
  await page.keyboard.press("-");
  await expect(zoomReset).toHaveText("125%");
  await page.keyboard.press("0");
  await expect(zoomReset).toHaveText("全体");

  // Ctrl+wheel with 120ms guard does not zoom the browser viewport.
  const box = (await page.locator(".bookStage").boundingBox())!;
  await page.mouse.move(box.x + box.width * 0.65, box.y + box.height * 0.35);
  await page.keyboard.down("Control");
  await page.mouse.wheel(0, -120);
  await expect(zoomReset).toHaveText("125%");
  await page.mouse.wheel(0, -120);
  await expect(zoomReset).toHaveText("125%");
  await page.clock.runFor(120);
  await page.mouse.wheel(0, -120);
  await expect(zoomReset).toHaveText("150%");
  await page.clock.runFor(120);
  await page.mouse.wheel(0, -120);
  await expect(zoomReset).toHaveText("200%");
  await page.keyboard.up("Control");
  expect(await page.evaluate(() => window.visualViewport?.scale ?? 1)).toBe(1);

  // Saved after 800ms and restored on reload; legacy state without zoomPercent opens at 全体.
  await page.clock.runFor(800);
  await page.reload();
  await waitForBundledFonts(page);
  await expect(page.locator(".bookZoomReset")).toHaveText("200%");

  const legacyPage = await page.context().newPage();
  try {
    await openBook(
      legacyPage,
      bookFixture({ state: { direction: "rtl", spread: true, coverSingle: true, lastPage: 34 } }),
    );
    await expect(legacyPage.locator(".bookZoomReset")).toHaveText("全体");
  } finally {
    await legacyPage.close();
  }
});

test("V161-B5 200% scales images 2x, supports drag pan, scroll, Space, and resets edge on turn", async ({
  page,
}) => {
  await openBook(page, bookFixture({ state: { lastPage: 34 } }));
  const stage = page.locator(".bookStage");
  const img34 = page.locator('.bookPageLayer--current img[alt="34ページ"]');
  const fitBox = (await img34.boundingBox())!;

  await page.getByRole("button", { name: "拡大", exact: true }).click();
  await page.getByRole("button", { name: "拡大", exact: true }).click();
  await expect(page.locator(".bookZoomReset")).toHaveText("150%");
  await page.getByRole("button", { name: "拡大", exact: true }).click();
  await expect(page.locator(".bookZoomReset")).toHaveText("200%");

  // Progress bar and click turn zones are hidden while zoomed.
  await expect(page.locator(".bookProgress")).toHaveCount(0);
  await expect(page.locator(".bookZone")).toHaveCount(0);

  const zoomedBox = (await img34.boundingBox())!;
  expect(Math.abs(zoomedBox.width - fitBox.width * 2)).toBeLessThanOrEqual(1);
  expect(Math.abs(zoomedBox.height - fitBox.height * 2)).toBeLessThanOrEqual(1);

  const scrollMetrics = await stage.evaluate((el) => ({
    scrollWidth: el.scrollWidth,
    clientWidth: el.clientWidth,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
  }));
  expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth);
  expect(scrollMetrics.scrollHeight).toBeGreaterThan(scrollMetrics.clientHeight);

  // Clicking on the left/right edges does not turn pages while zoomed.
  const stageBox = (await stage.boundingBox())!;
  await page.mouse.click(stageBox.x + 20, stageBox.y + stageBox.height / 2);
  await page.mouse.click(stageBox.x + stageBox.width - 20, stageBox.y + stageBox.height / 2);
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");

  // Wheel scrolls vertically instead of turning pages; Shift+wheel scrolls horizontally.
  await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
  const beforeWheel = await stage.evaluate((el) => ({ top: el.scrollTop, left: el.scrollLeft }));
  await page.mouse.wheel(0, 120);
  await expect
    .poll(() => stage.evaluate((el) => el.scrollTop))
    .toBeGreaterThan(beforeWheel.top);
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");

  await page.keyboard.down("Shift");
  await page.mouse.wheel(0, 80);
  await page.keyboard.up("Shift");
  expect(await stage.evaluate((el) => el.scrollLeft)).not.toBe(beforeWheel.left);

  // Dragging pans the scrollable stage.
  const beforeDrag = await stage.evaluate((el) => ({ top: el.scrollTop, left: el.scrollLeft }));
  await page.mouse.move(stageBox.x + stageBox.width / 2, stageBox.y + stageBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(stageBox.x + stageBox.width / 2 - 80, stageBox.y + stageBox.height / 2 - 60, {
    steps: 4,
  });
  await page.mouse.up();
  const afterDrag = await stage.evaluate((el) => ({ top: el.scrollTop, left: el.scrollLeft }));
  expect(afterDrag.left).toBeGreaterThan(beforeDrag.left);
  expect(afterDrag.top).toBeGreaterThan(beforeDrag.top);
  await expect(page.locator(".bookPageLabel")).toHaveText("34–35 / 120");

  // ArrowDown / ArrowUp scroll vertically by 15% of clientHeight.
  const beforeKeyScroll = await stage.evaluate((el) => ({
    top: el.scrollTop,
    step: el.clientHeight * 0.15,
  }));
  await page.keyboard.press("ArrowDown");
  const afterDown = await stage.evaluate((el) => el.scrollTop);
  expect(Math.abs(afterDown - (beforeKeyScroll.top + beforeKeyScroll.step))).toBeLessThanOrEqual(2);

  // ArrowLeft turns the page while keeping 200% zoom and resets scroll to top + start edge (RTL right edge).
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  await expect(page.locator(".bookZoomReset")).toHaveText("200%");
  const afterTurnRtl = await stage.evaluate((el) => ({
    top: el.scrollTop,
    left: el.scrollLeft,
    maxLeft: el.scrollWidth - el.clientWidth,
  }));
  expect(afterTurnRtl.top).toBe(0);
  expect(Math.abs(afterTurnRtl.left - afterTurnRtl.maxLeft)).toBeLessThanOrEqual(2);

  // Space scrolls down by 85%, and at the bottom advances to the next opening's top; Shift+Space goes back to bottom.
  await page.keyboard.press("Space");
  const afterFirstSpace = await stage.evaluate((el) => el.scrollTop);
  expect(afterFirstSpace).toBeGreaterThan(0);
  await page.keyboard.press("Space");
  await expect
    .poll(() => stage.evaluate((el) => el.scrollTop + el.clientHeight >= el.scrollHeight - 2))
    .toBe(true);
  await page.keyboard.press("Space");
  await expect(page.locator(".bookPageLabel")).toHaveText("38–39 / 120");
  expect(await stage.evaluate((el) => el.scrollTop)).toBe(0);

  await page.keyboard.press("Shift+Space");
  await expect(page.locator(".bookPageLabel")).toHaveText("36–37 / 120");
  const returnedBottom = await stage.evaluate((el) => ({
    top: el.scrollTop,
    maxTop: el.scrollHeight - el.clientHeight,
  }));
  expect(Math.abs(returnedBottom.top - returnedBottom.maxTop)).toBeLessThanOrEqual(2);

  // LTR resets horizontal scroll to the left edge (0) when turning.
  await page.getByRole("button", { name: "左から右", exact: true }).click();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator(".bookPageLabel")).toHaveText("38–39 / 120");
  const afterTurnLtr = await stage.evaluate((el) => ({
    top: el.scrollTop,
    left: el.scrollLeft,
  }));
  expect(afterTurnLtr.top).toBe(0);
  expect(afterTurnLtr.left).toBe(0);
});

test("V161-B5 baseline: zoomed 200%", async ({ page }) => {
  await openBook(page, bookFixture({ state: { lastPage: 34, zoomPercent: 200 } }));
  await expect(page.locator(".bookZoomReset")).toHaveText("200%");
  await page.evaluate(() =>
    Promise.all(
      Array.from(document.images).map((image) => image.decode().catch(() => undefined)),
    ),
  );
  await expect(page).toHaveScreenshot("book-zoom200.png", SCREENSHOT_OPTIONS);
});


