import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// P10-18d: 設定 → 基本の「今週の重点」の CSS(P10-15 で消えていた)が当たっている。

const SCREENSHOT_OPTIONS = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.005,
};

/** 4 projects, 3 of them already chosen, so the fourth is the disabled card. */
function createThreeFocusFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  const [first, second] = fixture.config.projects;
  fixture.config.projects = [
    first,
    second,
    { ...first, id: "sample-third", name: "サンプル三", weeklyFocus: true },
    { ...second, id: "sample-fourth", name: "サンプル四", weeklyFocus: false },
  ];
  return fixture;
}

async function openSettingsBasics(page: Page, viewport: { width: number; height: number }) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, createThreeFocusFixture(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings.getByRole("tab", { name: "基本" }).click();
  const section = settings.locator(".settingsWeeklyFocus");
  await section.scrollIntoViewIfNeeded();
  await page.evaluate(async () => document.fonts.ready);
  return { settings, section };
}

for (const viewport of [
  { width: 1280, height: 800 },
  { width: 860, height: 560 },
]) {
  test(`P10-18d settings weekly focus keeps its rule, small heading and two-column cards (${viewport.width}x${viewport.height})`, async ({
    page,
  }) => {
    const { section } = await openSettingsBasics(page, viewport);

    const sectionStyle = await section.evaluate((element) => {
      const style = getComputedStyle(element);
      return { borderTop: style.borderTopWidth, paddingTop: style.paddingTop };
    });
    expect(sectionStyle).toEqual({ borderTop: "1px", paddingTop: "14px" });

    const heading = section.locator(".settingsWeeklyFocusHeading");
    expect(await heading.evaluate((element) => getComputedStyle(element).display)).toBe("flex");
    expect(await heading.locator("p").evaluate((element) => getComputedStyle(element).fontSize)).toBe("12px");
    await expect(heading.locator("> span")).toHaveText("3/3");

    const columns = await section
      .locator(".weeklyFocusChecklist")
      .evaluate((element) => getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).length);
    expect(columns).toBe(2);

    const label = section.locator(".weeklyFocusChecklist label").first();
    const labelBox = await label.boundingBox();
    expect(labelBox!.height).toBeGreaterThanOrEqual(40);
    expect(await label.evaluate((element) => getComputedStyle(element).borderTopWidth)).toBe("1px");
    expect(
      await label.locator("input").evaluate((element) => getComputedStyle(element).width),
    ).toBe("17px");

    // 3 chosen: the unchosen card is dimmed, the chosen ones are not.
    const labels = section.locator(".weeklyFocusChecklist label");
    expect(await labels.nth(3).evaluate((element) => getComputedStyle(element).opacity)).toBe("0.5");
    expect(await labels.nth(0).evaluate((element) => getComputedStyle(element).opacity)).toBe("1");
  });
}

test("P10-18d baseline screenshot for settings-weekly-focus at 1280x800", async ({ page }) => {
  const { section } = await openSettingsBasics(page, { width: 1280, height: 800 });
  await expect(section).toHaveScreenshot("settings-weekly-focus.png", SCREENSHOT_OPTIONS);
});
