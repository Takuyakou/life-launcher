import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V163-B5: 「まとめて取り込む」 always sits in the 「次の一手」 heading, left of ＋ プロジェクト.

async function prepare(page: Page, width = 1366, height = 768) {
  await page.setViewportSize({ width, height });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createFullTodayFixture(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

const projectsHeader = (page: Page) => page.locator(".projectsBand .disclosureHeader").first();
const importButton = (page: Page) =>
  projectsHeader(page).getByRole("button", { name: "まとめて取り込む", exact: true });

test("V163-B5 1 the button opens the import without toggling the heading and gets focus back", async ({
  page,
}) => {
  await prepare(page);
  const header = projectsHeader(page);
  const names = await header
    .locator(".disclosureHeaderActions > button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? button.textContent?.trim()));
  expect(names).toEqual(["まとめて取り込む", "プロジェクトを追加", "次の一手の操作"]);

  const disclosure = header.locator("button[aria-expanded]").first();
  const expanded = await disclosure.getAttribute("aria-expanded");
  await importButton(page).click();
  const dialog = page.getByRole("dialog", { name: "まとめて取り込む" });
  await expect(dialog).toBeVisible();
  await expect(disclosure).toHaveAttribute("aria-expanded", expanded!);
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(importButton(page)).toBeFocused();
});

test("V163-B5 2 Tab goes まとめて取り込む → ＋ プロジェクト → …", async ({ page }) => {
  await prepare(page);
  await importButton(page).focus();
  await page.keyboard.press("Tab");
  await expect(projectsHeader(page).getByRole("button", { name: "プロジェクトを追加" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(projectsHeader(page).getByRole("button", { name: "次の一手の操作" })).toBeFocused();
});

test("V163-B5 3 quiet like the … button, and a frame on hover and keyboard focus", async ({ page }) => {
  await prepare(page);
  const read = () =>
    importButton(page).evaluate((button) => {
      const style = getComputedStyle(button);
      const menu = document.querySelector(".projectsBand .sectionMenuButton")!;
      return {
        color: style.color,
        menuColor: getComputedStyle(menu).color,
        border: style.borderTopColor,
        background: style.backgroundColor,
      };
    });
  const quiet = await read();
  expect(quiet.color).toBe(quiet.menuColor);
  expect(quiet.border).toBe("rgba(0, 0, 0, 0)");
  expect(quiet.background).toBe("rgba(0, 0, 0, 0)");

  await importButton(page).hover();
  await expect.poll(async () => (await read()).background).not.toBe("rgba(0, 0, 0, 0)");
  const hovered = await read();
  expect(hovered.border).not.toBe("rgba(0, 0, 0, 0)");

  await page.mouse.move(0, 0);
  await expect.poll(async () => (await read()).background).toBe("rgba(0, 0, 0, 0)");
  await importButton(page).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect(importButton(page)).toBeFocused();
  const focused = await read();
  expect(focused.border).not.toBe("rgba(0, 0, 0, 0)");
  expect(focused.background).not.toBe("rgba(0, 0, 0, 0)");
});

for (const [width, height] of [
  [860, 720],
  [1366, 768],
]) {
  test(`V163-B5 4 the three buttons stay on one line inside the heading at ${width}`, async ({
    page,
  }) => {
    await prepare(page, width, height);
    const layout = await projectsHeader(page).evaluate((header) => {
      const headerBox = header.getBoundingClientRect();
      const buttons = Array.from(
        header.querySelectorAll(".disclosureHeaderActions > button"),
      ).map((button) => button.getBoundingClientRect());
      return {
        headerRight: headerBox.right,
        tops: buttons.map((box) => Math.round(box.top + box.height / 2)),
        rights: buttons.map((box) => box.right),
        lefts: buttons.map((box) => box.left),
      };
    });
    expect(layout.tops.length).toBe(3);
    expect(Math.max(...layout.tops) - Math.min(...layout.tops)).toBeLessThanOrEqual(1);
    expect(layout.lefts[0]).toBeLessThan(layout.lefts[1]);
    expect(layout.lefts[1]).toBeLessThan(layout.lefts[2]);
    expect(Math.max(...layout.rights)).toBeLessThanOrEqual(layout.headerRight + 0.5);
  });
}

test("V163-B5 5 the 「やりたいこと」 heading has no such button", async ({ page }) => {
  await prepare(page);
  await expect(
    page.locator(".inboxBand .disclosureHeader").getByRole("button", { name: "まとめて取り込む" }),
  ).toHaveCount(0);
});
