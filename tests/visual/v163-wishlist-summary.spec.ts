import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V163-C7: the closed 「やりたいこと」 header used to shrink every 「● 名前 N件」 until all of them
// were cut. Now they keep their width, the right edge fades, and hovering the header scrolls the
// row slowly in a loop (after 1.5s, 30px per second).

const summary = (page: Page) => page.locator(".inboxBand .inboxGroupSummary");
const track = (page: Page) => summary(page).locator(".inboxGroupSummaryTrack");
const header = (page: Page) => page.locator(".inboxBand .disclosureHeader").first();

async function open(page: Page, width: number, few = false, requireVisible = true) {
  const fixture = few ? createPublicFixture() : createFullTodayFixture();
  if (few) {
    // Two projects only, so the row fits at a wide window.
    fixture.config.projects = fixture.config.projects.slice(0, 2);
    fixture.config.inbox = fixture.config.inbox.filter((item) => Boolean(item.projectId));
  }
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 720 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
  if (requireVisible) await expect(summary(page)).toBeVisible();
}

const rowState = (page: Page) =>
  page.evaluate(() => {
    const element = document.querySelector<HTMLElement>(".inboxBand .inboxGroupSummary")!;
    const items = Array.from(
      element.querySelectorAll<HTMLElement>(".inboxGroupSummaryItem"),
    ).filter((item) => !item.className.includes("inboxGroupSummaryItem--copy"));
    const copies = Array.from(
      element.querySelectorAll<HTMLElement>(".inboxGroupSummaryItem--copy"),
    );
    const actions = document.querySelector<HTMLElement>(
      ".inboxBand .disclosureHeaderActions",
    )!.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const ownWidth =
      items.reduce((sum, item) => sum + item.getBoundingClientRect().width, 0) +
      Math.max(0, items.length - 1) * 10;
    return {
      overflow: element.getAttribute("data-overflow"),
      items: items.map((item) => ({
        scrollWidth: item.scrollWidth,
        clientWidth: item.clientWidth,
        width: Math.round(item.getBoundingClientRect().width),
      })),
      copies: copies.map((copy) => copy.getAttribute("aria-hidden")),
      summaryRight: Math.round(box.right),
      actionsLeft: Math.round(actions.left),
      ownWidth: Math.round(ownWidth),
      available: Math.round(element.clientWidth),
      maskImage: getComputedStyle(element).maskImage,
      title: element.getAttribute("title"),
    };
  });

const animations = (page: Page) =>
  track(page).evaluate((element) =>
    element.getAnimations().map((animation) => {
      const effect = animation.effect as KeyframeEffect | null;
      const timing = effect?.getTiming();
      return {
        name: (animation as CSSAnimation).animationName ?? null,
        delay: timing?.delay ?? null,
        duration: timing?.duration ?? null,
        iterations: timing?.iterations ?? null,
      };
    }),
  );

test("V163-C7 1 at 1000px the groups keep their width, the row fades and repeats itself", async ({
  page,
}) => {
  await open(page, 1000);
  const state = await rowState(page);
  expect(state.overflow).toBe("true");
  expect(state.items.length).toBeGreaterThan(3);
  for (const item of state.items) {
    expect(item.scrollWidth, "a group is not squeezed").toBe(item.clientWidth);
  }
  expect(state.copies.length).toBe(state.items.length);
  expect(state.copies.every((value) => value === "true")).toBe(true);
  // The row stops at the menu button instead of running under it.
  expect(state.summaryRight).toBeLessThanOrEqual(state.actionsLeft + 0.5);
  expect(state.ownWidth).toBeGreaterThan(state.available);
  expect(state.maskImage).not.toBe("none");
  expect(await animations(page)).toEqual([]);
});

test("V163-C7 2 hovering the header scrolls the row in a loop after 1.5s at 30px/s", async ({
  page,
}) => {
  await open(page, 1000);
  await header(page).hover();
  const running = await animations(page);
  expect(running).toHaveLength(1);
  expect(running[0].name).toBe("inboxGroupSummaryLoop");
  expect(running[0].delay).toBe(1_500);
  expect(running[0].iterations).toBe(Infinity);
  const state = await rowState(page);
  const expected = ((state.ownWidth + 10) / 30) * 1_000;
  expect(Math.abs(Number(running[0].duration) - expected)).toBeLessThanOrEqual(100);
  const duration = await track(page).evaluate(
    (element) => getComputedStyle(element).animationDuration,
  );
  expect(Math.abs(Number.parseFloat(duration) - expected / 1_000)).toBeLessThanOrEqual(0.1);

  await page.mouse.move(0, 0);
  await expect.poll(async () => (await animations(page)).length).toBe(0);

  // Keyboard focus inside the heading starts it too.
  await header(page).locator("button[aria-expanded]").first().focus();
  await expect.poll(async () => (await animations(page)).length).toBe(1);
});

test("V163-C7 3 a row that fits does not fade, does not repeat and does not move", async ({
  page,
}) => {
  await open(page, 1600, true);
  const state = await rowState(page);
  expect(state.overflow).toBe("false");
  expect(state.copies).toHaveLength(0);
  expect(state.maskImage).toBe("none");
  await header(page).hover();
  await page.clock.runFor(100);
  expect(await animations(page)).toEqual([]);
});

test("V163-C7 4 with reduced motion the row does not move", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await open(page, 1000);
  await header(page).hover();
  await page.clock.runFor(100);
  expect(await animations(page)).toEqual([]);
});

test("V163-C7 5 the row's title lists every group with its count", async ({ page }) => {
  await open(page, 1000);
  const state = await rowState(page);
  expect(state.title).toBeTruthy();
  const labels = await summary(page).evaluate((element) => {
    const items = Array.from(element.querySelectorAll(".inboxGroupSummaryItem")).filter(
      (item) => !item.className.includes("inboxGroupSummaryItem--copy"),
    );
    return items.map((item) => item.textContent?.trim() ?? "");
  });
  for (const label of labels) {
    expect(state.title, label).toContain(label);
  }
  expect(state.title).toContain("、");
});

test("V163-C7 6 at 860px the row stays hidden, as the narrow window always did", async ({ page }) => {
  await open(page, 860, false, false);
  const state = await summary(page).evaluate((element) => ({
    display: getComputedStyle(element).display,
    overflow: element.getAttribute("data-overflow"),
    copies: element.querySelectorAll(".inboxGroupSummaryItem--copy").length,
  }));
  expect(state.display).toBe("none");
  expect(state.overflow).toBe("false");
  expect(state.copies).toBe(0);
  await header(page).hover();
  await page.clock.runFor(100);
  expect(await animations(page)).toEqual([]);
});
