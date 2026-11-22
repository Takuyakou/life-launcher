import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V163-C5: dropping a tile used to blink — the dragged tile's 「dragging」 look (opacity 0.82)
// was dropped at the pointer-up while the dashed placeholder (opacity 0) stayed until the save
// finished, so the tile at the new slot disappeared and came back. The recording below walks
// every animation frame around the drop and requires the same picture after it.

type Frame = {
  t: number;
  ids: string[];
  icons: string[];
  opacity: string[];
  placeholder: string[];
  selected: string | null;
};

function gridFixture(count = 8): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.buttons = Array.from({ length: count }, (_, index) => ({
    id: `reorder-tile-${index + 1}`,
    label: `項目 ${String(index + 1).padStart(2, "0")}`,
    icon: "◇",
    group: "資料",
    showInSidebar: false,
    showInOverlay: true,
    overlayPageId: "tools",
    aliases: [],
    description: "V163-C5 fixture",
    actions: [
      { type: "open_file" as const, payload: { path: `C:\\PublicDemo\\reorder-${index + 1}.txt` } },
    ],
  }));
  fixture.config.dictionaryOrder = fixture.config.buttons.map((button) => button.id);
  return fixture;
}

async function openDictionary(page: Page, delay: number) {
  await page.setViewportSize({ width: 1000, height: 640 });
  await installTauriMock(page, gridFixture(), "dictionary");
  await page.goto("/?view=dictionary");
  await waitForBundledFonts(page);
  await page.getByRole("tab", { name: /ツール/ }).click();
  await expect(page.locator(".dictionaryTile")).toHaveCount(8);
  await page.evaluate((ms) => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { setSaveConfigDelay: (value: number) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigDelay(ms);
  }, delay);
  // simulated-latency: let the mock save settle before the drag starts.
  await page.evaluate(() =>
    new Promise((resolve) => setTimeout(resolve, 300)), // simulated-latency
  );
}

async function recordFrames(page: Page) {
  await page.evaluate(() => {
    const frames: Frame[] = [];
    const started = performance.now();
    const target = window as unknown as { __C5: { frames: Frame[]; started: number } };
    target.__C5 = { frames, started };
    const sample = () => {
      const items = Array.from(
        document.querySelectorAll<HTMLElement>("[data-dictionary-button-id]"),
      );
      frames.push({
        t: Math.round(performance.now() - started),
        ids: items.map((item) => item.getAttribute("data-dictionary-button-id") ?? ""),
        icons: items.map((item) => {
          const icon = item.querySelector<HTMLElement>(".dictionaryTileIcon");
          if (!icon) return "missing";
          const image = icon.tagName === "IMG" ? (icon as HTMLImageElement) : null;
          return image
            ? `img:${image.getAttribute("src") ? "src" : "nosrc"}:${image.naturalWidth}`
            : `glyph:${icon.textContent ?? ""}`;
        }),
        opacity: items.map((item) => {
          const tile = item.querySelector<HTMLElement>(".dictionaryTile");
          return tile ? getComputedStyle(tile).opacity : "none";
        }),
        placeholder: items
          .filter((item) => item.className.includes("placeholder"))
          .map((item) => item.getAttribute("data-dictionary-button-id") ?? ""),
        selected:
          document
            .querySelector<HTMLElement>(".dictionaryTile--selected")
            ?.closest("[data-dictionary-button-id]")
            ?.getAttribute("data-dictionary-button-id") ?? null,
      });
      if (performance.now() - started < 2200) requestAnimationFrame(sample);
    };
    requestAnimationFrame(sample);
  });
}

async function dragFirstOntoFourth(page: Page) {
  const tiles = page.locator(".dictionaryTile");
  const source = (await tiles.nth(0).boundingBox())!;
  const target = (await tiles.nth(3).boundingBox())!;
  await page.mouse.move(source.x + source.width / 2, source.y + source.height / 2);
  await page.mouse.down();
  await page.mouse.move(source.x + source.width / 2 + 12, source.y + source.height / 2, {
    steps: 2,
  });
  await page.mouse.move(target.x + target.width / 2, target.y + target.height / 2, { steps: 5 });
  // simulated-latency: hold the pointer still for a beat before the drop.
  await page.evaluate(() =>
    new Promise((resolve) => setTimeout(resolve, 120)), // simulated-latency
  );
  const dropT = await page.evaluate(
    () =>
      performance.now() -
      (window as unknown as { __C5: { started: number } }).__C5.started,
  );
  await page.mouse.up();
  // simulated-latency: keep recording frames for 1.2s after the drop.
  await page.evaluate(() =>
    new Promise((resolve) => setTimeout(resolve, 1200)), // simulated-latency
  );
  return dropT;
}

async function readFrames(page: Page) {
  return page.evaluate(
    () => (window as unknown as { __C5: { frames: Frame[] } }).__C5.frames,
  );
}

for (const delay of [0, 50]) {
  test(`V163-C5 the drop keeps the new order, all icons and the same tile look (save delay ${delay}ms)`, async ({
    page,
  }) => {
    await openDictionary(page, delay);
    await recordFrames(page);
    const dropT = await dragFirstOntoFourth(page);
    const frames = await readFrames(page);
    expect(frames.length).toBeGreaterThan(20);

    const after = frames.filter((frame) => frame.t >= dropT);
    expect(after.length).toBeGreaterThan(5);
    const finalIds = frames[frames.length - 1].ids;
    // The dragged tile really moved, so the check below is not a no-op.
    expect(finalIds[0]).not.toBe("reorder-tile-1");
    expect(finalIds[3]).toBe("reorder-tile-1");

    for (const frame of after) {
      // The order never goes back to the old one, and the icons never go empty.
      expect(frame.ids, `frame ${frame.t}`).toEqual(finalIds);
      expect(
        frame.icons.every((icon) => !icon.startsWith("missing") && !icon.endsWith(":0")),
        `icons at ${frame.t}: ${frame.icons.join(",")}`,
      ).toBe(true);
      // The 印 (the selected tile) never jumps to another tile: it may only move to the
      // dragged tile when the focus returns to it after the drop.
      expect([null, "reorder-tile-1"], `selected at ${frame.t}`).toContain(frame.selected);
    }
    const selectedChanges = after.filter(
      (frame, index) => index > 0 && frame.selected !== after[index - 1].selected,
    ).length;
    expect(selectedChanges).toBeLessThanOrEqual(1);

    // The dragged tile keeps the same look across the drop: it stays hidden (the dashed slot)
    // until the save finishes, then appears once. Before the fix it was visible (0.82) while
    // the pointer was down, went hidden at the drop and came back — a blink.
    const sourceIndex = finalIds.indexOf("reorder-tile-1");
    const beforeDrop = frames.filter((frame) => frame.t < dropT).at(-1)!;
    const sequence = [beforeDrop, ...after].map((frame) => frame.opacity[sourceIndex]);
    expect(sequence[0]).toBe("0");
    for (let index = 1; index < sequence.length; index += 1) {
      if (sequence[index] === "0" && sequence[index - 1] !== "0") {
        throw new Error(`the dragged tile hid again after the drop (frame ${index})`);
      }
    }
    expect(sequence[sequence.length - 1]).toBe("1");
  });
}
