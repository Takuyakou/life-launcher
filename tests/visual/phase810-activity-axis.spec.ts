import { expect, test } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

for (const { width, height, size } of [
  { width: 860, height: 560, size: "standard" },
  { width: 1180, height: 760, size: "large" },
  { width: 1600, height: 1000, size: "xlarge" },
] as const) {
  test(`Today activity ${size} aligns durations and keeps its badge clear of header text`, async ({ page }) => {
    await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
    const fixture = createPublicFixture();
    fixture.config.settings.mainDisplaySize = size;
    const base = fixture.sessionEntries.entries[0];
    fixture.sessionEntries.entries = [5, 13, 120].map((minutes, index) => ({
      ...base,
      id: `activity-${size}-${index}`,
      rowKey: `activity-${size}-${index}`,
      minutes,
      startedAt: `${String(8 + index).padStart(2, "0")}:10`,
    }));
    await page.setViewportSize({ width, height });
    await installTauriMock(page, fixture, "main");
    await page.goto("/");
    await page.evaluate(async () => document.fonts.ready);
    await expect(page.locator(".mainScrollContent")).toHaveAttribute("data-main-display-size", size);
    await page.locator(".todayActivityBand .disclosure").click();

    const badge = page.locator(".todayActivityAutoBadge");
    const durations = page.locator(".todayActivityRow > strong");
    await expect(durations).toHaveText(["5分", "13分", "120分"]);
    await expect(durations.first()).toHaveCSS("text-align", "right");
    await expect(durations.first()).toHaveCSS("font-variant-numeric", "tabular-nums");
    const badgeBox = await badge.boundingBox();
    expect(badgeBox).not.toBeNull();
    const header = page.locator(".todayActivityBand .disclosureHeader");
    const headerBox = (await header.boundingBox())!;
    expect(badgeBox!.x).toBeGreaterThanOrEqual(headerBox.x);
    expect(badgeBox!.x + badgeBox!.width).toBeLessThanOrEqual(headerBox.x + headerBox.width);
    expect(badgeBox!.y).toBeGreaterThanOrEqual(headerBox.y);
    expect(badgeBox!.y + badgeBox!.height).toBeLessThanOrEqual(headerBox.y + headerBox.height);
    for (const selector of [".disclosureLabel", ".disclosureCount", ".disclosureDescription"]) {
      const copy = header.locator(selector);
      await expect(copy).toBeVisible();
      const copyBox = (await copy.boundingBox())!;
      expect(copyBox.x + copyBox.width).toBeLessThanOrEqual(badgeBox!.x);
    }
    for (const duration of await durations.all()) {
      const box = await duration.boundingBox();
      expect(box).not.toBeNull();
      expect(Math.abs(box!.x + box!.width - (badgeBox!.x + badgeBox!.width))).toBeLessThanOrEqual(1);
    }
    await expect(page.locator(".todayActivityStartedAt")).toHaveText([
      "08:10",
      "09:10",
      "10:10",
    ]);
  });
}
