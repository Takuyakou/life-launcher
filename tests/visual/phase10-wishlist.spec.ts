import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function open(page: Page, fixture: VisualQaFixture = createFullTodayFixture()) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".inboxBand")).toBeVisible();
}

const row = (page: Page) =>
  page.locator(".inboxRow", { has: page.locator(".wishlistNextStepAction") }).first();

/** The wishlist section (and its groups) start closed in some fixtures; open them. */
async function expandWishlist(page: Page) {
  const toggle = page.locator(".inboxBand .disclosure");
  if ((await toggle.getAttribute("aria-expanded")) === "false") {
    // The bar toggles as well, so click the count (not the button) to toggle exactly once.
    await page.locator(".inboxBand .disclosureCount").click();
  }
  await expect(toggle).toHaveAttribute("aria-expanded", "true");
  const headers = page.locator(".wishlistGroupHeader");
  for (let index = 0; index < (await headers.count()); index += 1) {
    const header = headers.nth(index);
    if ((await header.getAttribute("aria-expanded")) === "false") {
      // A real click (detail >= 1) only starts the drag, so toggle it like a key press.
      await header.evaluate((element) => (element as HTMLElement).click());
    }
  }
}

test("P10-06 the row action says 次の一手にする and sits left of the menu", async ({ page }) => {
  await open(page);
  await expandWishlist(page);
  const action = row(page).getByRole("button", { name: /次の一手にする/ });
  await expect(action).toBeVisible();
  await expect(action).toContainText("次の一手にする");
  const actionBox = (await action.boundingBox())!;
  const menuBox = (await row(page).locator(".sourceRowMenu").boundingBox())!;
  expect(actionBox.x + actionBox.width).toBeLessThanOrEqual(menuBox.x + 1);

  const opacity = await row(page)
    .locator(".wishlistNextStepAction")
    .evaluate((element) => getComputedStyle(element).opacity);
  expect(["0", "1"]).toContain(opacity);
});

test("P10-06 a Project group without a Next Step asks for one", async ({ page }) => {
  // First find a group whose row really shows the action, then take its Next Step away.
  await open(page);
  await expandWishlist(page);
  const groupKey = await page
    .locator(".wishlistGroup", { has: page.locator(".wishlistNextStepAction") })
    .first()
    .getAttribute("data-wishlist-group");
  expect(groupKey).toBeTruthy();
  const projectId = groupKey!.replace("project:", "");

  const fixture = createFullTodayFixture();
  fixture.config.projects = fixture.config.projects.map((project) =>
    project.id === projectId ? { ...project, nextStep: undefined } : project,
  );
  await open(page, fixture);
  await expandWishlist(page);

  const group = page.locator(`.wishlistGroup[data-wishlist-group="project:${projectId}"]`);
  await expect(group.locator(".wishlistNextStepMissing")).toHaveCount(1);
  const action = group.locator(".wishlistNextStepAction");
  await expect(action).toHaveCount(1);
  await expect(action).toHaveClass(/mainActionButton--gold/);
  await expect(page.locator(".wishlistGroup--unassigned .wishlistNextStepMissing")).toHaveCount(0);
});
test("P10-06 a closed wishlist header lists the groups and keeps the full text for readers", async ({
  page,
}) => {
  await open(page);
  await expandWishlist(page);
  await page.locator(".inboxBand .disclosureCount").click();
  await expect(page.locator(".inboxBand .disclosure")).toHaveAttribute("aria-expanded", "false");
  const summary = page.locator(".inboxGroupSummary");
  await expect(summary).toBeVisible();
  const items = summary.locator(".inboxGroupSummaryItem");
  expect(await items.count()).toBeGreaterThan(1);
  const text = (await summary.innerText()).replace(/\s+/g, " ");
  expect(text).toMatch(/件/);

  const spoken = await page.locator("#wishlist-group-summary").innerText();
  expect(spoken).toContain("やりたいこと");
  expect(spoken).toContain("件。");
  expect(await page.locator(".inboxBand .disclosure").getAttribute("aria-describedby")).toBe(
    "wishlist-group-summary",
  );

  // Open again: the hint text comes back.
  await page.locator(".inboxBand .disclosure").click();
  await expect(page.locator(".inboxGroupSummary")).toHaveCount(0);
  await expect(page.locator(".inboxBand .disclosureDescription")).toContainText("他にやりたいこと");
});
