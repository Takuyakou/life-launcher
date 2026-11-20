import { expect, type Locator, type Page } from "@playwright/test";

export type RectSnapshot = {
  x: number;
  y: number;
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

/**
 * Waits for fonts, then reads getBoundingClientRect() for all selectors in a single
 * browser evaluation so layout comparisons never observe two separate frames.
 */
export async function measureRects(
  page: Page,
  selectors: readonly string[],
): Promise<Record<string, RectSnapshot>> {
  await page.evaluate(async () => document.fonts.ready);
  return page.evaluate((list) => {
    const out: Record<string, RectSnapshot> = {};
    for (const selector of list) {
      const element = document.querySelector(selector);
      if (!element) {
        throw new Error(`Element not found for measureRects: ${selector}`);
      }
      const rect = element.getBoundingClientRect();
      out[selector] = {
        x: rect.x,
        y: rect.y,
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
      };
    }
    return out;
  }, [...selectors]);
}

/**
 * Waits until the rectangles of all selectors stop changing between two consecutive polls, then
 * returns one consistent snapshot. Used before pointer actions so a growing/collapsing section
 * cannot leave the pointer on a different element than the one that was measured.
 */
export async function waitForStableRects(
  page: Page,
  selectors: readonly string[],
  tolerance = 0.5,
): Promise<Record<string, RectSnapshot>> {
  let previous: Record<string, RectSnapshot> | null = null;
  await expect
    .poll(
      async () => {
        let current: Record<string, RectSnapshot>;
        try {
          current = await measureRects(page, selectors);
        } catch {
          previous = null;
          return false;
        }
        const stable =
          previous !== null &&
          selectors.every((selector) => {
            const before = previous![selector];
            const after = current[selector];
            return (
              Math.abs(before.x - after.x) <= tolerance &&
              Math.abs(before.y - after.y) <= tolerance &&
              Math.abs(before.width - after.width) <= tolerance &&
              Math.abs(before.height - after.height) <= tolerance
            );
          });
        previous = current;
        return stable;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
  return measureRects(page, selectors);
}

/**
 * Waits for CSS animations/transitions on the matched element to finish (no fixed sleep).
 */
export async function waitForAnimations(locator: Locator): Promise<void> {
  await locator.first().evaluate(async (element) => {
    const animations = element.getAnimations();
    await Promise.allSettled(animations.map((animation) => animation.finished));
  });
}

/**
 * Installs a per-animation-frame sampler on the element matched by `selector` inside the page
 * before triggering an animation, so tests can assert both intermediate and final states even
 * under slow CI environments.
 */
export async function startFrameSampler(
  page: Page,
  key: string,
  selector: string,
  kind: "opacity" | "parentHeight",
): Promise<void> {
  await page.evaluate(
    ({ sampleKey, sel, sampleKind }) => {
      const store = (window as unknown as Record<string, { samples: number[]; active: boolean }>);
      const state = { samples: [] as number[], active: true };
      store[sampleKey] = state;
      const tick = () => {
        const element = document.querySelector(sel);
        if (element) {
          if (sampleKind === "opacity") {
            state.samples.push(Number(getComputedStyle(element).opacity));
          } else {
            const parent = element.parentElement;
            if (parent) state.samples.push(parent.getBoundingClientRect().height);
          }
        }
        if (state.active) {
          requestAnimationFrame(tick);
        }
      };
      requestAnimationFrame(tick);
    },
    { sampleKey: key, sel: selector, sampleKind: kind },
  );
}

export async function readFrameSamples(page: Page, key: string): Promise<number[]> {
  return page.evaluate((sampleKey) => {
    const store = window as unknown as Record<string, { samples: number[]; active: boolean }>;
    const entry = store[sampleKey];
    if (!entry) return [];
    entry.active = false;
    return entry.samples.slice();
  }, key);
}

/**
 * Polls a computed style assertion until a CSS transition/hover state has reached stability.
 */
export async function expectComputedStyle(
  locator: Locator,
  property: string,
  expected: string | RegExp,
): Promise<void> {
  await expect
    .poll(async () => locator.first().evaluate((el, prop) => getComputedStyle(el).getPropertyValue(prop), property))
    .toMatch(expected instanceof RegExp ? expected : new RegExp(`^${expected.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
}
