import { expect, test, type Page } from "@playwright/test";
import { createPickerFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const STANDARD = { width: 1080, height: 680 };
const MINIMUM = { width: 860, height: 560 };

// Set P9_SCREENS to a folder to also save the screenshots used in the Phase 9 report.
const SCREENS = process.env.P9_SCREENS;

async function openPicker(
  page: Page,
  size: { width: number; height: number },
  display: "standard" | "large" | "xlarge" = "standard",
) {
  const fixture = createPickerFixture();
  fixture.config.settings.mainDisplaySize = display;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(size);
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  await expect(page.getByRole("dialog", { name: "今日やるものを選ぶ" })).toBeVisible();
}

const rows = (page: Page) => page.locator(".todayPickerSource .todayPickerRow");

/** Rows that sit completely inside the scrolling candidate panel, without scrolling. */
const fullyVisibleRows = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector(".todayPickerSource")!.getBoundingClientRect();
    return [...document.querySelectorAll(".todayPickerSource .todayPickerRow")].filter((row) => {
      const box = row.getBoundingClientRect();
      return box.top >= panel.top - 0.5 && box.bottom <= panel.bottom + 0.5;
    }).length;
  });

async function snapshot(page: Page, name: string) {
  if (SCREENS) await page.screenshot({ path: `${SCREENS}/${name}.png` });
}

test("P9-08 at 1080x680 four or more candidate rows are fully visible without scrolling", async ({ page }) => {
  await openPicker(page, STANDARD);
  await snapshot(page, "picker-1080x680");
  expect(await rows(page).count()).toBeGreaterThanOrEqual(5);
  expect(await fullyVisibleRows(page)).toBeGreaterThanOrEqual(4);
});

test("P9-08 the three numbered slots and the 0 / 3 progress stay", async ({ page }) => {
  await openPicker(page, STANDARD);
  const slots = page.locator(".todayPickerSlot--empty");
  await expect(slots).toHaveCount(3);
  for (const index of [0, 1, 2]) {
    await expect(slots.nth(index).locator(".todayPickerSlotIndex")).toHaveText(String(index + 1));
  }
  for (let index = 0; index < 3; index += 1) {
    await expect(slots.nth(index).locator(".todayPickerSlotEmptyLabel")).toHaveText(
      "空けておいてもかまいません",
    );
  }
  const heights = await slots.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().height),
  );
  expect(Math.max(...heights) - Math.min(...heights)).toBeLessThanOrEqual(1);
  await expect(page.locator(".todayPickerCounter")).toContainText("0 / 3");
  await expect(page.getByRole("progressbar")).toHaveCount(0);
  // The wording follows the Picker mock (P10-14e, item 4).
  const dialog = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  await expect(dialog).toContainText("3件まで。決めたら、あとは始めるだけです");
  await expect(dialog).toContainText("ドラッグで順番を変えられます");
  await expect(dialog).toContainText("次の一手");
  await expect(dialog).toContainText("やりたいこと");
  await expect(dialog).not.toContainText("どこから選びますか？");
});

test("P9-08 at 860x560 the last candidate is reachable by scrolling and the footer buttons stay visible", async ({
  page,
}) => {
  await openPicker(page, MINIMUM);
  await snapshot(page, "picker-860x560");
  const panel = page.locator(".todayPickerSource");
  await expect
    .poll(() => panel.evaluate((element) => element.scrollHeight > element.clientHeight))
    .toBe(true);
  await panel.evaluate((element) => element.scrollTo(0, element.scrollHeight));
  await snapshot(page, "picker-860x560-bottom");
  await expect(rows(page).last()).toBeInViewport({ ratio: 1 });

  const viewport = page.viewportSize()!;
  for (const name of ["決定", "キャンセル"]) {
    const box = (await page.getByRole("dialog", { name: "今日やるものを選ぶ" }).getByRole("button", { name, exact: true }).boundingBox())!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
  }
});

for (const display of ["standard", "large", "xlarge"] as const) {
  test(`P9-08 the picker holds together at display size ${display}`, async ({ page }) => {
    await openPicker(page, MINIMUM, display);
    const dialog = page.locator(".todayPickerDialog");
    const box = (await dialog.boundingBox())!;
    const viewport = page.viewportSize()!;
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height);
    expect(await dialog.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    const panel = page.locator(".todayPickerSource");
    await panel.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect(rows(page).last()).toBeInViewport({ ratio: 1 });
    for (const name of ["決定", "キャンセル"]) {
      await expect(dialog.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
    }
  });
}
