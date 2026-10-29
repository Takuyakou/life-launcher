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

const rows = (page: Page) => page.locator(".todayPickerSourcePanel .todayPickerRow");

/** Rows that sit completely inside the scrolling candidate panel, without scrolling. */
const fullyVisibleRows = (page: Page) =>
  page.evaluate(() => {
    const panel = document.querySelector(".todayPickerSourcePanel")!.getBoundingClientRect();
    return [...document.querySelectorAll(".todayPickerSourcePanel .todayPickerRow")].filter((row) => {
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

test("P9-08 the three slots and the 0 / 3 progress stay, with a lower slot height", async ({ page }) => {
  await openPicker(page, STANDARD);
  const slots = page.locator(".todayPickerSlot--empty");
  await expect(slots).toHaveCount(3);
  for (const index of [0, 1, 2]) {
    await expect(slots.nth(index)).toHaveText(`空き ${index + 1}`);
    // The v1.3.4 slot was 90px high; an empty one is at most half of that.
    expect((await slots.nth(index).boundingBox())!.height).toBeLessThanOrEqual(45);
  }
  await expect(page.locator(".todayPickerCounter")).toContainText("0 / 3");
  await expect(page.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "0");
  // The wording is unchanged.
  const dialog = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  await expect(dialog).toContainText("上の「今日の3件」に、下の候補から追加します。");
  await expect(dialog).toContainText("今日やると決めたもの。最大3件まで。");
  await expect(dialog).toContainText("どこから選びますか？");
});

test("P9-08 at 860x560 the last candidate is reachable by scrolling and the footer buttons stay visible", async ({
  page,
}) => {
  await openPicker(page, MINIMUM);
  await snapshot(page, "picker-860x560");
  const panel = page.locator(".todayPickerSourcePanel");
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
    const panel = page.locator(".todayPickerSourcePanel");
    await panel.evaluate((element) => element.scrollTo(0, element.scrollHeight));
    await expect(rows(page).last()).toBeInViewport({ ratio: 1 });
    for (const name of ["決定", "キャンセル"]) {
      await expect(dialog.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
    }
  });
}
