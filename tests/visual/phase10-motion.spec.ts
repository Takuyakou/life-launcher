import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

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
    await header.click();
    await page.waitForTimeout(50);
    const early = await bodyHeight(page, item.body());
    await page.waitForTimeout(400);
    const settled = await bodyHeight(page, item.body());
    expect(early).toBeGreaterThan(0);
    expect(early).toBeLessThan(settled - 1);
    expect(await page.locator(item.body()).first().evaluate((node) => getComputedStyle(node).overflow)).toBe(
      "visible",
    );
  });
}

test("K1 a menu fades and scales in from its opening point", async ({ page }) => {
  await open(page);
  await page.locator(".doNowBand").click({ button: "right" });
  const menu = page.locator(".contextMenu").first();
  await expect(menu).toBeVisible();
  const early = await menu.evaluate((node) => Number(getComputedStyle(node).opacity));
  expect(early).toBeLessThan(1);
  await page.waitForTimeout(200);
  expect(await menu.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  expect(await menu.evaluate((node) => getComputedStyle(node).animationName)).toContain(
    "ui-menu-enter",
  );
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
  const early = await dialog.evaluate((node) => Number(getComputedStyle(node).opacity));
  expect(early).toBeLessThan(1);
  await page.waitForTimeout(300);
  expect(await dialog.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  const transform = await dialog.evaluate((node) => getComputedStyle(node).transform);
  expect(transform === "none" || transform.includes("matrix(1, 0, 0, 1, 0, 0)")).toBe(true);

  await page.keyboard.press("Escape");
  await page.locator(".topSearchButton").click();
  const palette = page.locator(".searchPalette").first();
  await expect(palette).toBeVisible();
  const paletteEarly = await palette.evaluate((node) => Number(getComputedStyle(node).opacity));
  expect(paletteEarly).toBeLessThan(1);
  await page.waitForTimeout(300);
  expect(await palette.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
});

test("K2 the picker, import and completion dialogs use the same motion", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  await open(page, "no-preference", fixture);
  const measure = async (dialog: ReturnType<Page["locator"]>) => {
    await expect(dialog).toBeVisible();
    expect(await dialog.evaluate((node) => Number(getComputedStyle(node).opacity))).toBeLessThan(1);
    await page.waitForTimeout(300);
    expect(await dialog.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
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
  expect(await copy.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
  await page.getByRole("button", { name: "他の一手" }).click();
  await page.waitForTimeout(30);
  const early = await copy.evaluate((node) => Number(getComputedStyle(node).opacity));
  expect(early).toBeLessThan(1);
  await page.waitForTimeout(400);
  expect(await copy.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
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
  await page.getByRole("tab", { name: "今週を決める" }).click();
  const first = page.locator(".weeklyPlanningStats strong").first();
  await expect(first).toBeVisible();
  await page.waitForTimeout(50);
  expect((await first.textContent())?.trim()).not.toBe("1時間15分");
  await page.waitForTimeout(800);
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
  await header.click();
  await page.waitForTimeout(50);
  const early = await bodyHeight(page, cases[0].body());
  await page.waitForTimeout(400);
  const settled = await bodyHeight(page, cases[0].body());
  expect(Math.abs(early - settled)).toBeLessThanOrEqual(1);
});
