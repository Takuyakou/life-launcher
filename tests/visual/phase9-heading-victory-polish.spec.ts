import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPickerFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P9-14: section bar spacing / text / frame, one square per keyboard focus, and the empty victory bar.

type Display = "standard" | "large" | "xlarge";
const DISPLAYS: Display[] = ["standard", "large", "xlarge"];

const BARS = [
  ".todaySectionBar",
  ".projectsBand .disclosureHeader",
  ".inboxBand .disclosureHeader",
  ".todayActivityBand .disclosureHeader",
];

// Bar heights measured on main (P9-13) before this change, 1080x680 with createFullTodayFixture.
const BAR_HEIGHTS: Record<Display, number[]> = {
  standard: [48, 48, 48, 44],
  large: [53, 53, 53, 53],
  xlarge: [57, 57, 57, 57],
};

async function open(page: Page, fixture: VisualQaFixture, display: Display = "standard") {
  fixture.config.settings.mainDisplaySize = display;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1080, height: 680 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

function emptyVictory(): VisualQaFixture {
  const fixture = createFullTodayFixture();
  fixture.config.today.victory.text = "";
  fixture.config.today.victory.done = false;
  return fixture;
}

const token = (page: Page, name: string) =>
  page.evaluate((tokenName) => {
    const probe = document.createElement("div");
    probe.style.setProperty("color", `var(${tokenName})`);
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);

/** Gaps (px) of one section bar: name right -> count left, count right -> description left, and the bar height. */
const gaps = (page: Page, selector: string) =>
  page.locator(selector).first().evaluate((bar) => {
    const name = bar.querySelector("h2, strong")!.getBoundingClientRect();
    const count = bar.querySelector(".todayCompletionSummary, .todaySectionCount, .disclosureCount")!.getBoundingClientRect();
    const description = bar.querySelector(".todaySectionDescription, .disclosureDescription")!.getBoundingClientRect();
    return {
      nameToCount: count.left - name.right,
      countToDescription: description.left - count.right,
      height: bar.getBoundingClientRect().height,
    };
  });

for (const display of DISPLAYS) {
  test(`P9-14 section bars put the count right after the name (${display})`, async ({ page }) => {
    await open(page, createFullTodayFixture(), display);
    const first = await gaps(page, BARS[0]);
    for (const [index, selector] of BARS.entries()) {
      await expect.poll(async () => (await gaps(page, selector)).nameToCount, { message: selector }).toBeGreaterThanOrEqual(12);
      await expect.poll(async () => (await gaps(page, selector)).nameToCount, { message: selector }).toBeLessThanOrEqual(18.5);
      const found = await gaps(page, selector);
      expect(Math.abs(found.nameToCount - first.nameToCount), `${selector} name->count`).toBeLessThanOrEqual(1);
      expect(Math.abs(found.countToDescription - 8), `${selector} count->description`).toBeLessThanOrEqual(1);
      expect(found.height, `${selector} height`).toBeCloseTo(BAR_HEIGHTS[display][index], 0);
    }
  });

  test(`P9-14 the Today bar with 0 items has the same gaps (${display})`, async ({ page }) => {
    await open(page, createPickerFixture(), display);
    await expect(page.locator(".todaySectionCount")).toHaveText("0件");
    const first = await gaps(page, BARS[1]);
    const today = await gaps(page, BARS[0]);
    expect(Math.abs(today.nameToCount - first.nameToCount)).toBeLessThanOrEqual(1);
    expect(Math.abs(today.countToDescription - 8)).toBeLessThanOrEqual(1);
  });

  test(`P9-14 the four descriptions and names share their text style (${display})`, async ({ page }) => {
    await open(page, createFullTodayFixture(), display);
    const size = { standard: "11px", large: "12px", xlarge: "13px" }[display];
    const muted = await token(page, "--text-muted-readable");
    for (const selector of BARS) {
      const bar = page.locator(selector).first();
      const description = bar.locator(".todaySectionDescription, .disclosureDescription");
      await expect(description, selector).toHaveCSS("font-size", size);
      await expect(description, selector).toHaveCSS("color", muted);
      await expect(description, selector).toHaveCSS("font-weight", "450");
      const name = bar.locator("h2, strong").first();
      await expect(name, selector).toHaveCSS("font-weight", "900");
    }
    const sizes = await page
      .locator(BARS.map((selector) => `${selector} h2, ${selector} strong`).join(", "))
      .evaluateAll((names) => names.map((name) => getComputedStyle(name).fontSize));
    expect(new Set(sizes).size).toBe(1);
  });
}

test("P9-14 the four section bars have the v1.3.4 frame; the lines between sections stay transparent", async ({ page }) => {
  await open(page, createFullTodayFixture());
  const line = await token(page, "--line");
  const muted = await token(page, "--muted");
  for (const selector of BARS) {
    const bar = page.locator(selector).first();
    await page.mouse.move(2, 2);
    await expect(bar, selector).toHaveCSS("border-top-width", "1px");
    await expect(bar, selector).toHaveCSS("border-top-style", "solid");
    await expect(bar, selector).toHaveCSS("border-top-color", line);
    await bar.hover({ position: { x: 300, y: 10 } });
    await expect(bar, `${selector} hover`).toHaveCSS("border-top-color", muted);
  }
  for (const selector of [".doNowBand", ".focusBand", ".projectsBand", ".inboxBand", ".todayActivityBand"]) {
    await expect(page.locator(selector).first(), selector).toHaveCSS("border-top-color", "rgba(0, 0, 0, 0)");
  }
});

/** Moves keyboard focus onto the element so that :focus-visible matches (Shift+Tab then Tab). */
async function keyboardFocus(page: Page, target: ReturnType<Page["locator"]>) {
  await target.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(target).toBeFocused();
}

test("P9-14 keyboard focus on a bar's toggle shows one square: the bar's ring only", async ({ page }) => {
  await open(page, createFullTodayFixture());
  const toggles = [
    ".todaySectionDisclosure",
    ".projectsBand .disclosureHeader .disclosure",
    ".inboxBand .disclosureHeader .disclosure",
    ".todayActivityBand .disclosureHeader .disclosure",
  ];
  for (const [index, toggleSelector] of toggles.entries()) {
    const toggle = page.locator(toggleSelector).first();
    const bar = page.locator(BARS[index]).first();
    await keyboardFocus(page, toggle);
    await expect(bar, BARS[index]).toHaveCSS("outline-style", "solid");
    await expect(bar, BARS[index]).toHaveCSS("outline-width", "2px");
    await expect(toggle, `${toggleSelector} outline`).toHaveCSS("outline-style", "none");
    await expect(toggle, `${toggleSelector} border`).toHaveCSS("border-top-width", "0px");
    await expect(toggle, `${toggleSelector} background`).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  }
});

test("P9-14 keyboard focus on a button inside a bar rings that button only", async ({ page }) => {
  await open(page, createFullTodayFixture());
  for (const [barSelector, buttonSelector] of [
    [".projectsBand .disclosureHeader", ".projectsBand .disclosureHeader .sectionAddButton"],
    [".projectsBand .disclosureHeader", ".projectsBand .disclosureHeader .sectionMenuButton"],
    [".inboxBand .disclosureHeader", ".inboxBand .disclosureHeader .sectionAddButton"],
    [".inboxBand .disclosureHeader", ".inboxBand .disclosureHeader .sectionMenuButton"],
  ] as const) {
    const button = page.locator(buttonSelector).first();
    await keyboardFocus(page, button);
    await expect(button, buttonSelector).toHaveCSS("outline-style", "solid");
    await expect(page.locator(barSelector).first(), `${barSelector} has no ring`).toHaveCSS("outline-style", "none");
  }
});

const GOLD = "rgb(231, 185, 77)";
const LIFT = "matrix(1, 0, 0, 1, 0, -1)";
const RESTING_BORDER = "rgba(231, 185, 77, 0.42)";

const bar = (page: Page) =>
  page.locator(".victoryBar").evaluate((element) => {
    const style = getComputedStyle(element);
    return { border: style.borderTopColor, background: style.backgroundColor, transform: style.transform };
  });

test("P9-14 an empty victory bar starts focused without a ring and without lighting up", async ({ page }) => {
  await open(page, emptyVictory());
  const text = page.locator(".victoryTextButton");
  await expect(text).toBeFocused();
  await expect(text).toHaveCSS("outline-style", "none");
  await expect.poll(() => bar(page)).toMatchObject({ border: RESTING_BORDER, transform: "none" });
  expect((await bar(page)).background).not.toBe("rgba(231, 185, 77, 0.08)");
  // Enter starts the input as before.
  await page.keyboard.press("Enter");
  await expect(page.locator(".victoryInput")).toBeFocused();
});

test("P9-14 / P95-01 an empty victory bar reacts to the mouse with its frame only, never its text", async ({ page }) => {
  await open(page, emptyVictory());
  const text = page.locator(".victoryTextButton");
  const resting = await text.evaluate((element) => getComputedStyle(element).color);
  await text.hover();
  await expect.poll(() => bar(page)).toMatchObject({ border: GOLD, transform: LIFT });
  expect(await text.evaluate((element) => getComputedStyle(element).color)).toBe(resting);
  await page.mouse.move(2, 2);
  await expect.poll(() => bar(page)).toMatchObject({ border: RESTING_BORDER, transform: "none" });
  await page.locator(".victoryIcon").hover();
  await expect.poll(() => bar(page)).toMatchObject({ border: GOLD, transform: LIFT });
});

test("P9-14 keyboard use on an empty victory bar shows the ring, still without lighting up", async ({ page }) => {
  await open(page, emptyVictory());
  const text = page.locator(".victoryTextButton");
  await expect(text).toBeFocused();
  await expect(text).toHaveCSS("outline-style", "none");
  // The first key press after the automatic focus brings the ring.
  await page.keyboard.press("Shift");
  await expect(text).toHaveCSS("outline-style", "solid");
  await expect(text).toHaveCSS("outline-width", "2px");
  await expect.poll(() => bar(page)).toMatchObject({ border: RESTING_BORDER, transform: "none" });
  // Coming back with Tab also shows the ring.
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(text).toBeFocused();
  await expect(text).toHaveCSS("outline-style", "solid");
  await expect.poll(() => bar(page)).toMatchObject({ border: RESTING_BORDER, transform: "none" });
});

test("P9-14 / P95-01 an empty victory bar being edited keeps the strong frame before and after the first character", async ({ page }) => {
  await open(page, emptyVictory());
  await expect(page.locator(".victoryTextButton")).toBeFocused();
  await page.keyboard.press("Enter");
  const input = page.locator(".victoryInput");
  await expect(input).toBeFocused();
  // Empty input: already strong, so the first character does not switch the frame.
  await page.mouse.move(2, 2);
  await expect.poll(() => bar(page)).toMatchObject({ border: GOLD, transform: LIFT });
  await page.keyboard.type("a");
  await expect.poll(() => bar(page)).toMatchObject({ border: GOLD, transform: LIFT });
  await page.keyboard.press("Backspace");
  await expect.poll(() => bar(page)).toMatchObject({ border: GOLD, transform: LIFT });
});

test("P9-14 an empty victory bar keeps its suggestion chips unchanged and unlit on focus", async ({ page }) => {
  await open(page, emptyVictory());
  await expect(page.locator(".victoryTextButton")).toBeFocused(); // the automatic focus lands first
  const chips = page.locator(".suggestionChip");
  await expect(chips.first()).toBeVisible();
  await keyboardFocus(page, chips.first());
  await expect.poll(() => bar(page)).toMatchObject({ border: RESTING_BORDER, transform: "none" });
});

test("P9-14 keyboard focus inside a filled victory bar leaves the frame alone", async ({ page }) => {
  await open(page, createFullTodayFixture());
  const checkbox = page.getByRole("checkbox", { name: "勝利条件を達成" });
  await keyboardFocus(page, checkbox);
  await expect(checkbox).toHaveCSS("outline-style", "solid");
  await expect.poll(() => bar(page)).toMatchObject({ border: RESTING_BORDER, transform: "none" });
  const text = page.locator(".victoryTextButton");
  await keyboardFocus(page, text);
  await expect(text).toHaveCSS("outline-style", "solid");
  await expect.poll(() => bar(page)).toMatchObject({ border: RESTING_BORDER, transform: "none" });
  // Editing: the input has no ring, so the frame is the one square.
  await page.keyboard.press("Enter");
  await expect(page.locator(".victoryInput")).toBeFocused();
  await expect.poll(() => bar(page)).toMatchObject({ border: GOLD, transform: LIFT });
});
