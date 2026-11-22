import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V163-B5/V163-C2: 「＋ まとめて取り込む」 sits in the 「次の一手」 heading, left of ＋ プロジェクト.
// C2: it appears only while the heading is hovered or something in it has focus, and looks
// exactly like the Next Step card's 編集 button when hovered / focused.

async function prepare(page: Page, width = 1366, height = 768) {
  await page.setViewportSize({ width, height });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, createFullTodayFixture(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

const IMPORT_LABEL = "＋ まとめて取り込む";
const projectsHeader = (page: Page) => page.locator(".projectsBand .disclosureHeader").first();
const importButton = (page: Page) =>
  projectsHeader(page).getByRole("button", { name: IMPORT_LABEL, exact: true });
const editButton = (page: Page) => page.locator(".nextStepCard .nextStepRowAction--change").first();

/** Both buttons' computed style, read in one evaluate (only the hovered one is in :hover). */
const readLook = (page: Page) =>
  page.evaluate(() => {
    const look = (element: Element | null) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        background: style.backgroundColor,
        border: style.borderTopColor,
        color: style.color,
        opacity: style.opacity,
      };
    };
    return {
      importButton: look(
        document.querySelector(".projectsBand .disclosureHeader .sectionGhostButton"),
      ),
      editButton: look(document.querySelector(".nextStepCard .nextStepRowAction--change")),
    };
  });

test("V163-B5 1 the button opens the import without toggling the heading and gets focus back", async ({
  page,
}) => {
  await prepare(page);
  const header = projectsHeader(page);
  const names = await header
    .locator(".disclosureHeaderActions > button")
    .evaluateAll((buttons) => buttons.map((button) => button.getAttribute("aria-label") ?? button.textContent?.trim()));
  expect(names).toEqual([IMPORT_LABEL, "プロジェクトを追加", "次の一手の操作"]);

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

test("V163-B5 2 Tab goes ＋ まとめて取り込む → ＋ プロジェクト → …", async ({ page }) => {
  await prepare(page);
  await importButton(page).focus();
  await page.keyboard.press("Tab");
  await expect(projectsHeader(page).getByRole("button", { name: "プロジェクトを追加" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(projectsHeader(page).getByRole("button", { name: "次の一手の操作" })).toBeFocused();
});

test("V163-C2 3 it is hidden until the heading is hovered or focused, and looks like 編集", async ({
  page,
}) => {
  await prepare(page);
  const header = projectsHeader(page);

  // At rest: invisible, but it keeps its place (＋ プロジェクト does not move).
  const position = await header.evaluate((element) => {
    const buttons = Array.from(element.querySelectorAll(".disclosureHeaderActions > button"));
    return buttons.map((button) => Math.round(button.getBoundingClientRect().left));
  });
  expect((await readLook(page)).importButton!.opacity).toBe("0");

  // Hovering the heading reveals it (120ms), and the hover colours match the 編集 button's.
  await header.hover();
  await expect
    .poll(async () => (await readLook(page)).importButton!.opacity, { message: "heading hover" })
    .toBe("1");
  await importButton(page).hover();
  await expect.poll(async () => (await readLook(page)).importButton!.opacity).toBe("1");
  const hoveredImport = (await readLook(page)).importButton!;
  await page.mouse.move(0, 0);
  await editButton(page).hover();
  await expect
    .poll(async () => (await readLook(page)).editButton!.opacity, { message: "編集 hover" })
    .toBe("1");
  const hoveredEdit = (await readLook(page)).editButton!;
  expect(hoveredImport.background).toBe(hoveredEdit.background);
  expect(hoveredImport.border).toBe(hoveredEdit.border);
  expect(hoveredImport.color).toBe(hoveredEdit.color);
  expect(hoveredImport.background).not.toBe("rgba(0, 0, 0, 0)");
  // The 編集 button is itself only visible on hover; that did not change.
  expect(hoveredEdit.opacity).toBe("1");

  // Leaving the heading hides it again, and the layout did not move.
  await page.mouse.move(0, 0);
  await expect
    .poll(async () => (await readLook(page)).importButton!.opacity, { message: "pointer away" })
    .toBe("0");
  const afterPosition = await header.evaluate((element) => {
    const buttons = Array.from(element.querySelectorAll(".disclosureHeaderActions > button"));
    return buttons.map((button) => Math.round(button.getBoundingClientRect().left));
  });
  expect(afterPosition).toEqual(position);

  // Keyboard: tabbing to the button reveals it with the same yellow frame as 編集.
  await importButton(page).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await expect
    .poll(async () => (await readLook(page)).importButton!.opacity, { message: "keyboard focus" })
    .toBe("1");
  const focusedImport = (await readLook(page)).importButton!;
  await editButton(page).focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await page.clock.runFor(200);
  const focusedEdit = (await readLook(page)).editButton!;
  expect(focusedImport.background).toBe(focusedEdit.background);
  expect(focusedImport.border).toBe(focusedEdit.border);
  expect(focusedImport.color).toBe(focusedEdit.color);
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
