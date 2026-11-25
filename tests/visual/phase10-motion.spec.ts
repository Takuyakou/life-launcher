import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { readFrameSamples, startFrameSampler } from "./helpers";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

async function open(
  page: Page,
  reducedMotion = "no-preference",
  fixture = createFullTodayFixture(),
) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.emulateMedia({ reducedMotion: reducedMotion as "reduce" | "no-preference" });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

const cases = [
  {
    name: "next step",
    header: () => ".projectsBand .disclosure",
    body: () => ".nextStepBody",
  },
  {
    name: "wishlist group",
    header: () => ".wishlistGroupHeader",
    body: () => ".wishlistGroup:first-of-type .inboxList",
  },
];

async function bodyHeight(page: Page, selector: string) {
  return page
    .locator(selector)
    .first()
    .evaluate((node) => (node.parentElement as HTMLElement).getBoundingClientRect().height);
}

for (const item of cases) {
  test(`F6 ${item.name} collapses and opens with the spring`, async ({ page }) => {
    await open(page);
    if (item.name === "wishlist group") {
      const inboxHeader = page.locator(".inboxBand .disclosure");
      if ((await inboxHeader.getAttribute("aria-expanded")) === "false") {
        await inboxHeader.click();
        await expect(page.locator(".inboxBody")).toBeVisible();
      }
    }
    const header = page.locator(item.header()).first();
    await header.scrollIntoViewIfNeeded();
    if ((await header.getAttribute("aria-expanded")) === "false") {
      await header.click();
      await expect(page.locator(item.body()).first()).toBeVisible();
    }
    await header.click();
    await expect(page.locator(item.body())).toHaveCount(0);

    const bodySelector = item.body();
    await startFrameSampler(page, "f6-spring", bodySelector, "parentHeight");
    await header.click();
    await expect(page.locator(bodySelector).first()).toBeVisible();
    // Wait until the height spring settles (stable height and animations finished).
    await expect
      .poll(async () => {
        const h1 = await bodyHeight(page, bodySelector);
        await page.evaluate(
          () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
        );
        const h2 = await bodyHeight(page, bodySelector);
        const running = await page
          .locator(bodySelector)
          .first()
          .evaluate(
            (node) =>
              (node.parentElement?.getAnimations().some((a) => a.playState === "running") ?? false),
          );
        return !running && Math.abs(h2 - h1) <= 0.1 && h2 > 20;
      })
      .toBe(true);
    const samples = await readFrameSamples(page, "f6-spring");
    const settled = await bodyHeight(page, bodySelector);
    const hasIntermediate = samples.some((height) => height > 0 && height < settled - 1);
    expect(hasIntermediate, `expected intermediate height in [${samples.join(", ")}] < ${settled}`).toBe(
      true,
    );
    await expect(page.locator(bodySelector).first()).toHaveCSS("overflow", "visible");
  });
}

test("K1 a menu fades and scales in from its opening point", async ({ page }) => {
  await open(page);
  await page.locator(".doNowBand").click({ button: "right" });
  const menu = page.locator(".contextMenu").first();
  await expect(menu).toBeVisible();
  const animationName = await menu.evaluate((node) => getComputedStyle(node).animationName);
  expect(animationName).toContain("ui-menu-enter");
  await menu.evaluate((node) => {
    for (const animation of node.getAnimations()) {
      animation.pause();
      animation.currentTime = 20;
    }
  });
  const early = await menu.evaluate((node) => Number(getComputedStyle(node).opacity));
  expect(early).toBeLessThan(1);
  await menu.evaluate(async (node) => {
    for (const animation of node.getAnimations()) animation.play();
    await Promise.allSettled(node.getAnimations().map((animation) => animation.finished));
  });
  expect(await menu.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
});

test("K2 every dialog opens with the same fade and lift", async ({ page }) => {
  await open(page);
  const row = page.locator(".nextStepCard").filter({ hasText: "ストレッチ" }).first();
  await row.hover();
  await row.getByRole("button", { name: "編集", exact: true }).click();
  const dialog = page.locator(".nextStepEditDialog").first();
  await expect(dialog).toBeVisible();
  await dialog.evaluate((node) => {
    for (const animation of node.getAnimations()) {
      animation.pause();
      animation.currentTime = 15;
    }
  });
  const early = await dialog.evaluate((node) => Number(getComputedStyle(node).opacity));
  expect(early).toBeLessThan(1);
  await dialog.evaluate(async (node) => {
    for (const animation of node.getAnimations()) animation.play();
    await Promise.allSettled(node.getAnimations().map((animation) => animation.finished));
  });
  await expect(dialog).toHaveCSS("opacity", "1");
  const transform = await dialog.evaluate((node) => getComputedStyle(node).transform);
  expect(transform === "none" || transform.includes("matrix(1, 0, 0, 1, 0, 0)")).toBe(true);

  await page.keyboard.press("Escape");
  await page.locator(".topSearchButton").click();
  const palette = page.locator(".searchPalette").first();
  await expect(palette).toBeVisible();
  await palette.evaluate((node) => {
    for (const animation of node.getAnimations()) {
      animation.pause();
      animation.currentTime = 15;
    }
  });
  const paletteEarly = await palette.evaluate((node) => Number(getComputedStyle(node).opacity));
  expect(paletteEarly).toBeLessThan(1);
  await palette.evaluate(async (node) => {
    for (const animation of node.getAnimations()) animation.play();
    await Promise.allSettled(node.getAnimations().map((animation) => animation.finished));
  });
  await expect(palette).toHaveCSS("opacity", "1");
});

test("K2 reduced motion skips the dialog motion", async ({ page }) => {
  await open(page, "reduce");
  await page.locator(".topSearchButton").click();
  const palette = page.locator(".searchPalette").first();
  await expect(palette).toBeVisible();
  expect(await palette.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  expect(await palette.evaluate((node) => getComputedStyle(node).transform)).toBe("none");
});

test("K3 the Do Now copy enters from the side when the selection changes", async ({ page }) => {
  await open(page);
  const copy = page.locator(".doNowCopy").first();
  const initialText = (await copy.locator("strong").textContent())?.trim() ?? "";
  expect(await copy.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");

  // V151-S8 (S1 rule 2.2): Motion runs the copy's entrance as Web Animations, created on the next
  // frame. Catch each one as it is created, pause it, and read the copy at the middle of its time.
  await page.evaluate(() => {
    const store = window as unknown as { __k3Animations: Animation[] };
    store.__k3Animations = [];
    const original = Element.prototype.animate;
    Element.prototype.animate = function (this: Element, ...args: Parameters<Element["animate"]>) {
      const animation = original.apply(this, args);
      if (this.classList.contains("doNowCopy")) {
        animation.pause();
        store.__k3Animations.push(animation);
      }
      return animation;
    };
  });
  await page.getByRole("button", { name: "他の一手" }).click();
  await expect(copy.locator("strong")).not.toHaveText(initialText);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (window as unknown as { __k3Animations: Animation[] }).__k3Animations.some((animation) =>
          (animation.effect as KeyframeEffect).getKeyframes().some((frame) => "opacity" in frame),
        ),
      ),
    )
    .toBe(true);
  const middle = await copy.evaluate((node) => {
    const animations = (window as unknown as { __k3Animations: Animation[] }).__k3Animations;
    for (const animation of animations) {
      animation.currentTime = Number(animation.effect!.getTiming().duration) / 2;
    }
    const style = getComputedStyle(node);
    return { opacity: Number(style.opacity) };
  });
  const samples = [middle.opacity];
  await page.evaluate(async () => {
    const animations = (window as unknown as { __k3Animations: Animation[] }).__k3Animations;
    animations.forEach((animation) => animation.play());
    await Promise.all(animations.map((animation) => animation.finished));
  });
  await expect(copy).toHaveCSS("opacity", "1");
  // The spring that slides the copy in (x) can start just after the fade ends. One evaluate waits
  // for every animation on the copy, then two frames, and reads the transform before and after:
  // both must be the identity and equal (rule 4: one measurement, not separate reads).
  await expect
    .poll(
      () =>
        copy.evaluate(async (node) => {
          await Promise.allSettled(node.getAnimations().map((animation) => animation.finished));
          const identity = (value: string) =>
            value === "none" || value.includes("matrix(1, 0, 0, 1, 0, 0)");
          const before = getComputedStyle(node).transform;
          await new Promise((resolve) => requestAnimationFrame(resolve));
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const after = getComputedStyle(node).transform;
          return identity(before) && identity(after) && before === after;
        }),
      { message: "the copy's transform settles to the identity" },
    )
    .toBe(true);
  expect(
    samples.some((value) => value > 0 && value < 1),
    `expected an intermediate opacity in [${samples.join(", ")}]`,
  ).toBe(true);
  expect(await copy.evaluate((node) => Number(getComputedStyle(node).opacity))).toBe(1);
});

test("K3 reduced motion changes the copy without motion", async ({ page }) => {
  await open(page, "reduce");
  await page.getByRole("button", { name: "他の一手" }).click();
  const copy = page.locator(".doNowCopy").first();
  await expect(copy).toHaveCSS("opacity", "1");
});

test("K4 the weekly stats count up from zero", async ({ page }) => {
  await open(page);
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  // Pause slightly in the future: the fake clock keeps running until pauseAt, so a timestamp
  // read at "now" would already be in the past by the time pauseAt is applied.
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
  await page.getByRole("tab", { name: "今週を決める" }).click();
  await page.clock.runFor(50);
  const first = page.locator(".weeklyPlanningStats strong").first();
  await expect(first).toBeVisible();
  expect((await first.textContent())?.trim()).not.toBe("1時間15分");
  await page.clock.runFor(800);
  await expect(first).toHaveText("1時間15分");
  await expect(page.locator(".weeklyPlanningStats strong").nth(1)).toHaveText("3日");
  await expect(page.locator(".weeklyPlanningStats strong").nth(2)).toHaveText("3回");
});

test("K4 reduced motion shows the final weekly stats at once", async ({ page }) => {
  await open(page, "reduce");
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  await page.getByRole("tab", { name: "今週を決める" }).click();
  await expect(page.locator(".weeklyPlanningStats strong").first()).toHaveText("1時間15分");
});

test("F6 reduced motion jumps straight to the final height", async ({ page }) => {
  await open(page, "reduce");
  const header = page.locator(cases[0].header()).first();
  await header.click();
  await expect(page.locator(cases[0].body())).toHaveCount(0);
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
  await header.click();
  await page.clock.runFor(50);
  const early = await bodyHeight(page, cases[0].body());
  await page.clock.runFor(400);
  const settled = await bodyHeight(page, cases[0].body());
  expect(Math.abs(early - settled)).toBeLessThanOrEqual(1);
});
