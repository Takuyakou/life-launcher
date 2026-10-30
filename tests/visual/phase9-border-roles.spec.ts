import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function open(
  page: Page,
  options: { size?: { width: number; height: number }; display?: "standard" | "large" | "xlarge"; fixture?: VisualQaFixture } = {},
) {
  const fixture = options.fixture ?? createFullTodayFixture();
  if (options.display) fixture.config.settings.mainDisplaySize = options.display;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(options.size ?? { width: 1080, height: 680 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

type Look = {
  visibleBorder: boolean;
  background: string;
  outlineStyle: string;
  outlineColor: string;
  width: number;
  height: number;
};

/** A border counts when a side has width, a style and a colour that is not fully transparent. */
const look = (page: Page, selector: string, index = 0): Promise<Look> =>
  page
    .locator(selector)
    .nth(index)
    .evaluate((element) => {
      const style = getComputedStyle(element);
      const visibleBorder = ["top", "right", "bottom", "left"].some((side) => {
        const width = parseFloat(style.getPropertyValue(`border-${side}-width`));
        const kind = style.getPropertyValue(`border-${side}-style`);
        const color = style.getPropertyValue(`border-${side}-color`);
        return width > 0 && kind !== "none" && !/(,\s*0\)|\/\s*0\))$/.test(color);
      });
      const box = element.getBoundingClientRect();
      return {
        visibleBorder,
        background: style.backgroundColor,
        outlineStyle: style.outlineStyle,
        outlineColor: style.outlineColor,
        width: box.width,
        height: box.height,
      };
    });

/** Waits until the element looks as expected; hover and focus colours arrive through transitions. */
const expectLook = (page: Page, selector: string, expected: Partial<Look>, message?: string) =>
  expect.poll(() => look(page, selector), { message }).toMatchObject(expected);

const token = (page: Page, name: string, property: "color" | "backgroundColor" = "color") =>
  page.evaluate(
    ([tokenName, prop]) => {
      const probe = document.createElement("div");
      probe.style.setProperty(prop === "color" ? "color" : "background-color", `var(${tokenName})`);
      document.body.appendChild(probe);
      const value = getComputedStyle(probe)[prop];
      probe.remove();
      return value;
    },
    [name, property] as const,
  );

// Buttons and bars that lose their border, with the hit area measured on v1.3.4-era CSS
// (1080x680, standard) so the rectangles can only stay the same or grow.
const BORDERLESS_BUTTONS: Array<{ name: string; selector: string; minWidth: number; minHeight: number }> = [
  { name: "top menu button", selector: ".topPills .viewToggleButton", minWidth: 85, minHeight: 32 },
  { name: "Do Now other step", selector: ".doNowAlternateButton", minWidth: 76.2, minHeight: 26 },
  { name: "Do Now instruction", selector: ".doNowContent .doNowInstructionButton", minWidth: 76, minHeight: 36 },
  { name: "Today instruction", selector: ".todayRow .todayInstructionButton", minWidth: 70, minHeight: 34 },
  { name: "Today remove", selector: ".todayRow .todayRemoveButton", minWidth: 101.1, minHeight: 34 },
];

test("P9-07 frames that carry no role are gone", async ({ page }) => {
  await open(page);
  for (const selector of [
    ".topPills",
    ".doNowBand",
    ".focusBand",
    ".projectsBand",
    ".inboxBand",
    ".todayActivityBand",
    ...BORDERLESS_BUTTONS.map((entry) => entry.selector),
    ".todayTriggerButton--empty",
  ]) {
    const found = await look(page, selector);
    expect(found.visibleBorder, `${selector} border`).toBe(false);
  }
  // The top menu frame and the section bars are plain too (no tinted background).
  expect((await look(page, ".topPills")).background).toBe("rgba(0, 0, 0, 0)");
  // P9-14: the four section bars have their v1.3.4 frame back (1px var(--line)); the background stays plain.
  const line = await token(page, "--line");
  for (const selector of [".todaySectionBar", ".projectsBand .disclosureHeader", ".inboxBand .disclosureHeader", ".todayActivityBand .disclosureHeader"]) {
    const found = await look(page, selector);
    expect(found.visibleBorder, `${selector} border`).toBe(true);
    await expect(page.locator(selector).first(), selector).toHaveCSS("border-top-color", line);
    await expect(page.locator(selector).first(), selector).toHaveCSS("border-top-width", "1px");
    expect(found.background, selector).toBe("rgba(0, 0, 0, 0)");
  }
});

test("P9-07 the roles that keep a frame still have one", async ({ page }) => {
  await open(page);
  for (const selector of [
    ".victoryBar",
    ".doNowContent",
    ".todayRow",
    ".nextStepCard",
    ".doNowStartPrimary",
    ".doNowStartSecondary",
    ".todayStartButton--short",
    ".todayStartButton--normal",
  ]) {
    expect((await look(page, selector)).visibleBorder, selector).toBe(true);
  }
  // Left accent line of the Do Now card and top colour line of Today3 cards: the accent side is drawn
  // in the Project colour, the other sides in the plain line colour.
  const accents = await page.evaluate(() => {
    const sides = (selector: string, accent: "left" | "top", plain: "right" | "bottom") => {
      const style = getComputedStyle(document.querySelector(selector)!);
      return {
        width: parseFloat(style.getPropertyValue(`border-${accent}-width`)),
        accent: style.getPropertyValue(`border-${accent}-color`),
        plain: style.getPropertyValue(`border-${plain}-color`),
      };
    };
    const nextStepLine = getComputedStyle(document.querySelector(".nextStepCard")!, "::before");
    return {
      doNow: sides(".doNowContent", "left", "right"),
      today: sides(".todayRow", "top", "bottom"),
      nextStepLine: { width: parseFloat(nextStepLine.width), background: nextStepLine.backgroundColor },
    };
  });
  for (const name of ["doNow", "today"] as const) {
    const accent = accents[name];
    expect(accent.width, `${name} accent width`).toBeGreaterThanOrEqual(1);
    expect(accent.accent, `${name} accent colour`).not.toBe(accent.plain);
    expect(accent.accent, `${name} accent colour`).not.toBe("rgba(0, 0, 0, 0)");
  }
  // Next Step cards draw the left line as a 3px Project-colour strip.
  expect(accents.nextStepLine.width).toBe(3);
  expect(accents.nextStepLine.background).not.toBe("rgba(0, 0, 0, 0)");

  // Input frame: the Project add dialog name field.
  await page.locator(".projectsBand").getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "プロジェクトを追加" })).toBeVisible();
  expect((await look(page, '[role="dialog"] .textInput')).visibleBorder).toBe(true);
  expect((await look(page, '[role="dialog"]')).visibleBorder).toBe(true);
});

test("P9-07 the Today picker entry keeps its dashed frame and loses the inner border", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 2);
  await open(page, { fixture });
  const outer = await page.locator(".todayPickerEntry").evaluate((element) => {
    const style = getComputedStyle(element);
    return { kind: style.borderTopStyle, width: parseFloat(style.borderTopWidth) };
  });
  expect(outer).toEqual({ kind: "dashed", width: 1 });
  expect((await look(page, ".todayPickerEntryVisual")).visibleBorder).toBe(false);
});

test("P9-07 border-less buttons still react to hover and show the yellow focus ring", async ({ page }) => {
  await open(page);
  const hoverBackground = await token(page, "--control-neutral-hover-bg", "backgroundColor");
  const accentStrong = await token(page, "--accent-strong");

  for (const entry of BORDERLESS_BUTTONS) {
    const rest = await look(page, entry.selector);
    await page.locator(entry.selector).first().hover();
    await expectLook(page, entry.selector, { background: hoverBackground, visibleBorder: false }, `${entry.name} hover`);
    expect(rest.background).not.toBe(hoverBackground);
    await page.mouse.move(0, 0);

    // Keyboard focus: land on the button with Shift+Tab then Tab.
    await page.locator(entry.selector).first().focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expectLook(
      page,
      entry.selector,
      { outlineStyle: "solid", outlineColor: accentStrong, visibleBorder: false },
      `${entry.name} focus ring`,
    );
  }

  // Section bars: hover paints the bar, keyboard focus on the toggle rings the whole bar.
  for (const [bar, toggle] of [
    [".todaySectionBar", ".todaySectionDisclosure"],
    [".projectsBand .disclosureHeader", ".projectsBand .disclosureHeader .disclosure"],
  ] as const) {
    await page.locator(bar).first().hover();
    await expectLook(page, bar, { background: hoverBackground }, `${bar} hover`);
    await page.mouse.move(0, 0);
    await page.locator(toggle).first().focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expectLook(page, bar, { outlineStyle: "solid", outlineColor: accentStrong }, `${bar} focus ring`);
  }

  // Today "＋ きっかけ" appears when its zone is hovered, then reacts like the other text buttons.
  const row = page.locator(".todayRow").first();
  const trigger = ".todayRow:first-child .todayTriggerButton--empty";
  await row.locator(".todayTriggerZone").hover();
  await row.locator(".todayTriggerButton--empty").hover();
  await expectLook(page, trigger, { background: hoverBackground, visibleBorder: false }, "trigger hover");
  await page.mouse.move(0, 0);
  await row.locator(".todayTriggerButton--empty").focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expectLook(page, trigger, { outlineStyle: "solid", outlineColor: accentStrong }, "trigger focus ring");
});

test("P9-07 hit areas never get smaller than before", async ({ page }) => {
  await open(page);
  for (const entry of BORDERLESS_BUTTONS) {
    const found = await look(page, entry.selector);
    expect(found.width, `${entry.name} width`).toBeGreaterThanOrEqual(entry.minWidth - 0.5);
    expect(found.height, `${entry.name} height`).toBeGreaterThanOrEqual(entry.minHeight - 0.5);
  }
  expect((await look(page, ".todaySectionBar")).height).toBeGreaterThanOrEqual(47.5);
  expect((await look(page, ".projectsBand .disclosureHeader")).height).toBeGreaterThanOrEqual(47.5);
  expect((await look(page, ".todayActivityBand .disclosureHeader")).height).toBeGreaterThanOrEqual(43.5);
});

for (const [name, options] of [
  ["standard", { display: "standard" as const }],
  ["large", { display: "large" as const }],
  ["xlarge", { display: "xlarge" as const }],
  ["860x560", { display: "standard" as const, size: { width: 860, height: 560 } }],
] as const) {
  test(`P9-07 layout holds at ${name}`, async ({ page }) => {
    await open(page, options);
    const overflow = await page.evaluate(() => {
      const area = document.querySelector(".mainScrollArea")!;
      return {
        document: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        area: area.scrollWidth > area.clientWidth + 1,
      };
    });
    expect(overflow).toEqual({ document: false, area: false });
    const viewport = page.viewportSize()!;
    for (const entry of BORDERLESS_BUTTONS) {
      const box = await page.locator(entry.selector).first().boundingBox();
      expect(box, entry.name).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width);
    }
  });
}
