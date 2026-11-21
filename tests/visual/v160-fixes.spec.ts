import { expect, test } from "@playwright/test";
import { createPublicFixture } from "./fixtures";
import { waitForBundledFonts } from "./bundledFonts";
import { installTauriMock } from "./tauriMock";

type TabOverflowState = {
  frames: number;
  found: number;
  scrollViolations: string[];
  pageOverflow: number;
  faceFrames: number;
  maxBandLead: number;
};

for (const width of [860, 844, 830]) {
  test(`V160-B5 the records tabs never scroll while the band slides visibly at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 560 });
    await installTauriMock(page, createPublicFixture(), "main");
    await page.goto("/");
    await waitForBundledFonts(page);
    await expect(page.locator(".sidebar")).toBeVisible();

    await page.getByRole("button", { name: "記録ビューを開く" }).click();
    const reviewTab = page.getByRole("tab", { name: "ふりかえり" });
    const allTab = page.getByRole("tab", { name: "すべての記録" });
    await expect(reviewTab).toBeVisible();
    await expect(reviewTab).toHaveAttribute("aria-selected", "true");

    await page.evaluate(() => {
      const state: TabOverflowState = {
        frames: 0,
        found: 0,
        scrollViolations: [],
        pageOverflow: 0,
        faceFrames: 0,
        maxBandLead: 0,
      };
      (window as unknown as { __recordsTabOverflow: TabOverflowState }).__recordsTabOverflow =
        state;

      const labelOf = (element: HTMLElement) =>
        `${element.tagName.toLowerCase()}${element.className ? `.${String(element.className).split(" ").join(".")}` : ""}`;
      const checkScrollBox = (element: HTMLElement) => {
        const overflowX = getComputedStyle(element).overflowX;
        if (overflowX !== "auto" && overflowX !== "scroll") return;
        if (element.scrollWidth > element.clientWidth) {
          state.scrollViolations.push(
            `${labelOf(element)} ${element.scrollWidth}>${element.clientWidth}`,
          );
        }
      };

      const tick = () => {
        const tabs = document.querySelector<HTMLElement>(".recordsTabs");
        if (tabs) {
          state.found += 1;
          const seen = new Set<HTMLElement>();
          let element: HTMLElement | null = tabs;
          while (element && !seen.has(element)) {
            seen.add(element);
            checkScrollBox(element);
            element = element.parentElement;
          }
          const pageElement = document.scrollingElement as HTMLElement | null;
          if (pageElement && !seen.has(pageElement)) checkScrollBox(pageElement);
          if (pageElement) {
            state.pageOverflow = Math.max(
              state.pageOverflow,
              pageElement.scrollWidth - pageElement.clientWidth,
            );
          }

          const face = document.querySelector<HTMLElement>(".recordsTabFace");
          const target = document.querySelectorAll<HTMLElement>(".recordsTab")[2];
          if (face && target) {
            state.faceFrames += 1;
            state.maxBandLead = Math.max(
              state.maxBandLead,
              target.getBoundingClientRect().left - face.getBoundingClientRect().left,
            );
          }
        }
        state.frames += 1;
        if (state.frames < 240) window.requestAnimationFrame(tick);
      };
      window.requestAnimationFrame(tick);
    });

    await allTab.click();
    await expect(allTab).toHaveAttribute("aria-selected", "true");
    await page.waitForFunction(
      () =>
        (window as unknown as { __recordsTabOverflow: { frames: number } }).__recordsTabOverflow
          .frames >= 240,
    );
    const measured = await page.evaluate(
      () =>
        (window as unknown as { __recordsTabOverflow: TabOverflowState }).__recordsTabOverflow,
    );
    expect(measured.found).toBeGreaterThan(100);
    expect(measured.scrollViolations).toEqual([]);
    expect(measured.pageOverflow).toBeLessThanOrEqual(0);
    expect(measured.faceFrames).toBeGreaterThan(100);
    expect(measured.maxBandLead).toBeGreaterThanOrEqual(100);
    expect(
      await page.locator(".recordsTab").first().evaluate((element) => getComputedStyle(element).overflowX),
    ).toBe("visible");
  });
}
