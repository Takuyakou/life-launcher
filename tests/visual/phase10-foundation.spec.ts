import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const MAIN_SIZE = { width: 1080, height: 680 };

async function openMain(page: Page) {
  const now = new Date(FIXTURE_NOW).getTime();
  await page.setViewportSize(MAIN_SIZE);
  await page.clock.install({ time: now });
  await installTauriMock(page, createFullTodayFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

test("P10-01 the bundled Inter and Noto Sans JP faces are available", async ({ page }) => {
  const fontRequests: string[] = [];
  page.on("request", (request) => {
    if (request.url().endsWith(".woff2")) fontRequests.push(request.url());
  });
  await openMain(page);
  // Unicode-range subsets load on first use, so ask for the glyphs the app shows and wait.
  await page.evaluate(async () => {
    await Promise.all([
      document.fonts.load('16px "Inter Variable"', "ABC 123"),
      document.fonts.load('16px "Noto Sans JP Variable"', "あいうえお漢字"),
    ]);
  });
  await expect
    .poll(() => page.evaluate(() => document.fonts.check('16px "Inter Variable"', "ABC 123")))
    .toBe(true);
  await expect
    .poll(() =>
      page.evaluate(() => document.fonts.check('16px "Noto Sans JP Variable"', "あいうえお漢字")),
    )
    .toBe(true);

  const faces = await page.evaluate(() =>
    Array.from(document.fonts).map((face) => ({
      family: face.family.replace(/"/g, ""),
      status: face.status,
    })),
  );
  const inter = faces.filter((face) => face.family === "Inter Variable");
  const noto = faces.filter((face) => face.family === "Noto Sans JP Variable");
  expect(inter.length).toBeGreaterThan(0);
  expect(noto.length).toBeGreaterThan(0);
  expect(inter.filter((face) => face.status === "error")).toHaveLength(0);
  expect(noto.filter((face) => face.status === "error")).toHaveLength(0);

  // The woff2 files come from this app's own server, never from a CDN.
  const origin = new URL(page.url()).origin;
  await page.evaluate(async () => {
    const probe = document.createElement("span");
    probe.style.fontFamily = '"Noto Sans JP Variable"';
    probe.style.fontSize = "16px";
    probe.textContent = "あいうえお漢字かきくけこ";
    document.body.append(probe);
    await document.fonts.ready;
    probe.remove();
  });
  await expect.poll(() => fontRequests.length).toBeGreaterThan(0);
  for (const url of fontRequests) {
    expect(new URL(url).origin, url).toBe(origin);
  }
});

test("P10-01 no stylesheet declares a weight of 800 or more", async ({ page }) => {
  await openMain(page);
  const heavy = await page.evaluate(() => {
    const offenders: Array<{ selector: string; weight: string; href: string }> = [];
    for (const sheet of Array.from(document.styleSheets)) {
      let rules: CSSRuleList;
      try {
        rules = sheet.cssRules;
      } catch {
        continue;
      }
      const walk = (list: CSSRuleList) => {
        for (const rule of Array.from(list)) {
          if ("cssRules" in rule && rule.cssRules) walk((rule as CSSGroupingRule).cssRules);
          if (!("style" in rule) || !rule.style) continue;
          const weight = rule.style.getPropertyValue("font-weight").trim();
          if (!/^\d+$/.test(weight)) continue;
          if (Number.parseInt(weight, 10) >= 800) {
            offenders.push({
              selector: (rule as CSSStyleRule).selectorText ?? "",
              weight,
              href: sheet.href ?? "inline",
            });
          }
        }
      };
      walk(rules);
    }
    return offenders;
  });
  expect(heavy).toEqual([]);
});
