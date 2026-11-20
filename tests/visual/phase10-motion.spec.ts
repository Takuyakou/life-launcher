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
    name: "today",
    header: () => ".todaySectionDisclosure",
    body: () => ".todayGridRegion",
  },
  {
    name: "next step",
    header: () => ".projectsBand .disclosure",
    body: () => ".nextStepBody",
  },
  {
    name: "wishlist",
    header: () => ".inboxBand .disclosure",
    body: () => ".inboxBody",
  },
  {
    name: "today activity",
    header: () => ".todayActivityBand .disclosure",
    body: () => ".todayActivityBody",
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

test("K1 reduced motion opens the menu at full opacity", async ({ page }) => {
  await open(page, "reduce");
  await page.locator(".doNowBand").click({ button: "right" });
  const menu = page.locator(".contextMenu").first();
  await expect(menu).toBeVisible();
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

test("K2 the picker, import and completion dialogs use the same motion", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  await open(page, "no-preference", fixture);
  const measure = async (dialog: ReturnType<Page["locator"]>) => {
    await expect(dialog).toBeVisible();
    await dialog.evaluate((node) => {
      for (const animation of node.getAnimations()) {
        animation.pause();
        animation.currentTime = 15;
      }
    });
    expect(await dialog.evaluate((node) => Number(getComputedStyle(node).opacity))).toBeLessThan(1);
    await dialog.evaluate(async (node) => {
      for (const animation of node.getAnimations()) animation.play();
      await Promise.allSettled(node.getAnimations().map((animation) => animation.finished));
    });
    await expect(dialog).toHaveCSS("opacity", "1");
    const transform = await dialog.evaluate((node) => getComputedStyle(node).transform);
    expect(transform === "none" || transform.includes("matrix(1, 0, 0, 1, 0, 0)")).toBe(true);
  };
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  await measure(page.getByRole("dialog", { name: "今日やるものを選ぶ" }));
  await page.getByRole("button", { name: "キャンセル" }).click();
  await page.getByRole("button", { name: "次の一手の操作" }).first().click();
  await page.getByRole("menuitem", { name: "まとめて取り込む" }).click();
  await measure(page.getByRole("dialog", { name: "まとめて取り込む" }));
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /5分で始める/ }).click();
  await page.clock.fastForward(301_000);
  await measure(page.getByRole("dialog").filter({ hasText: "予定時間になりました" }));
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

  // Sampler starts before the operation, so an intermediate opacity is recorded even when CI is slow.
  await startFrameSampler(page, "k3-do-now-copy", ".doNowCopy", "opacity");
  await page.getByRole("button", { name: "他の一手" }).click();
  await expect(copy.locator("strong")).not.toHaveText(initialText);
  await expect(copy).toHaveCSS("opacity", "1");
  await expect
    .poll(async () => copy.evaluate((node) => getComputedStyle(node).transform))
    .toMatch(/none|matrix\(1, 0, 0, 1, 0, 0\)/);
  const samples = await readFrameSamples(page, "k3-do-now-copy");
  expect(
    samples.some((value) => value > 0 && value < 1),
    `expected an intermediate opacity in [${samples.join(", ")}]`,
  ).toBe(true);
  expect(await copy.evaluate((node) => Number(getComputedStyle(node).opacity))).toBe(1);
  const transform = await copy.evaluate((node) => getComputedStyle(node).transform);
  expect(transform === "none" || transform.includes("matrix(1, 0, 0, 1, 0, 0)")).toBe(true);
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
