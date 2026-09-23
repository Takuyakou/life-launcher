import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_DIR = resolve("dist/visual-qa/phase89-main-display");

async function prepare(page: Page, width = 1440, size?: "standard" | "large" | "xlarge") {
  const fixture = createPublicFixture();
  if (size) fixture.config.settings.mainDisplaySize = size;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture);
  await page.goto("/");
  await expect(page.locator(".focusBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "設定を開く" }).click();
  return page.getByRole("dialog", { name: "設定" });
}

test("P89 legacy config defaults to standard and saves all three presets", async ({ page }) => {
  await prepare(page);
  const content = page.locator(".mainScrollContent");
  await expect(content).toHaveAttribute("data-main-display-size", "standard");
  for (const [size, label] of [
    ["large", "大"],
    ["xlarge", "特大"],
    ["standard", "標準"],
  ] as const) {
    const settings = await openSettings(page);
    await settings.getByRole("radio", { name: label, exact: true }).check();
    await settings.getByRole("button", { name: "保存", exact: true }).click();
    await expect(content).toHaveAttribute("data-main-display-size", size);
    await page.reload();
    await expect(content).toHaveAttribute("data-main-display-size", size);
  }
});

test("P89 Cancel keeps current Main size; Records and toolbar remain unchanged", async ({
  page,
}) => {
  await prepare(page, 1440, "large");
  const content = page.locator(".mainScrollContent");
  const toolbar = page.locator(".topBar");
  const toolbarFont = await toolbar.evaluate((element) => getComputedStyle(element).fontSize);
  const settings = await openSettings(page);
  await settings.getByRole("radio", { name: "特大", exact: true }).check();
  await settings.getByRole("button", { name: "キャンセル", exact: true }).click();
  const discard = page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" });
  await discard.getByRole("button", { name: /破棄/ }).click();
  await expect(content).toHaveAttribute("data-main-display-size", "large");
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  await expect(content).not.toHaveAttribute("data-main-display-size", /large|xlarge/);
  expect(await toolbar.evaluate((element) => getComputedStyle(element).fontSize)).toBe(toolbarFont);
});

for (const size of ["standard", "large", "xlarge"] as const) {
  for (const width of [1920, 1440, 1080, 860, 620] as const) {
    test(`P89 ${size} Main stays within ${width}px viewport`, async ({ page }) => {
      await prepare(page, width, size);
      const overflow = await page.evaluate(() => {
        const area = document.querySelector(".mainScrollArea");
        return {
          document: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          area: area ? area.scrollWidth > area.clientWidth + 1 : true,
        };
      });
      expect(overflow).toEqual({ document: false, area: false });
      if (width === 1920) {
        await mkdir(SCREENSHOT_DIR, { recursive: true });
        await page.screenshot({ path: resolve(SCREENSHOT_DIR, `main-${size}-1920.png`) });
      }
    });
  }
}

test("P89 heading names move without shifting counts or descriptions", async ({ page }) => {
  await prepare(page, 1440);
  const sections = [
    [".todaySectionDisclosure h2", ".todaySectionCount", ".todaySectionDescription"],
    [
      ".projectsBand .disclosureLabel strong",
      ".projectsBand .disclosureCount",
      ".projectsBand .disclosureDescription",
    ],
    [
      ".inboxBand .disclosureLabel strong",
      ".inboxBand .disclosureCount",
      ".inboxBand .disclosureDescription",
    ],
    [
      ".todayActivityBand .disclosureLabel strong",
      ".todayActivityBand .disclosureCount",
      ".todayActivityBand .disclosureDescription",
    ],
  ] as const;
  for (const [name, count, description] of sections) {
    await expect(page.locator(name)).toHaveCSS("left", "-4px");
    await expect(page.locator(count)).toHaveCSS("position", "static");
    await expect(page.locator(description)).toHaveCSS("position", "static");
  }
  await expect(page.getByText("先週のふりかえりが見られます")).toHaveCount(0);
  await page.locator(".todayActivityBand .disclosure").click();
  await expect(page.locator(".todayActivityIdentity .projectIdentityName").first()).toHaveCSS(
    "margin-left",
    "10px",
  );
});

for (const size of ["large", "xlarge"] as const) {
  test("P89 " + size + " preserves NextStep to Today3 drag geometry", async ({ page }) => {
    const fixture = createPublicFixture();
    fixture.config.settings.mainDisplaySize = size;
    fixture.config.today.items = [
      { text: "机の上を5分だけ整える", done: false, sourceKey: "manual:fixture-cleanup" },
    ];
    await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
    await page.setViewportSize({ width: 1920, height: 900 });
    await installTauriMock(page, fixture);
    await page.goto("/");
    const source = page.locator('.nextStepCard[data-project-id="sample-stretch"]');
    const target = page.locator(".todayRow").first();
    await expect(source).toBeVisible();
    const from = await source.boundingBox();
    const to = await target.boundingBox();
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();
    await page.mouse.move(from!.x + from!.width * 0.45, from!.y + from!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(from!.x + from!.width * 0.45 + 12, from!.y + from!.height * 0.5, {
      steps: 3,
    });
    await page.mouse.move(to!.x + to!.width * 0.75, to!.y + to!.height * 0.5, { steps: 6 });
    await expect(page.locator(".todayGrid")).toHaveClass(/todayGrid--dropTarget/);
    await page.mouse.up();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const qa = (
            window as Window & {
              __LIFE_LAUNCHER_VISUAL_QA__: {
                currentConfig: () => {
                  today: { items: Array<{ sourceKey: string }> };
                };
              };
            }
          ).__LIFE_LAUNCHER_VISUAL_QA__;
          return qa.currentConfig().today.items.map((item) => item.sourceKey);
        }),
      )
      .toContain("project:sample-stretch");
    await expect(source).toBeVisible();
  });
}
