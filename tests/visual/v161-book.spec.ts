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
});
