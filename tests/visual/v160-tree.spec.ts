import { expect, test, type Locator, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { waitForBundledFonts } from "./bundledFonts";
import { installTauriMock } from "./tauriMock";

const ROOT = "C:\\PublicDemo\\Instructions";
const ROW_HEIGHT = 32;

function treeFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  const file = (folder: string, name: string, extension: string) => ({
    name,
    path: `${folder}\\${name}`,
    kind: "file" as const,
    extension,
    size: 32,
    modifiedAt: 1,
    readOnly: false,
  });
  const books = `${ROOT}\\教材`;
  const refs = `${ROOT}\\資料`;
  const appendix = `${refs}\\付録`;
  fixture.instructionExtraEntries = [
    { name: "教材", path: books, kind: "folder", readOnly: false },
    { name: "資料", path: refs, kind: "folder", readOnly: false },
    file(books, "a1.md", "md"),
    file(books, "a2.md", "md"),
    file(books, "a3.md", "md"),
    file(books, "a4.md", "md"),
    file(refs, "b1.md", "md"),
    file(refs, "b2.md", "md"),
    { name: "付録", path: appendix, kind: "folder", readOnly: false },
    file(appendix, "c1.md", "md"),
    file(appendix, "c2.md", "md"),
  ];
  return fixture;
}

async function openTree(page: Page, reduce: boolean) {
  await page.setViewportSize({ width: 1180, height: 780 });
  await page.emulateMedia({ reducedMotion: reduce ? "reduce" : "no-preference" });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, treeFixture(), "life-launcher-instruction");
  await page.goto(`/?view=instruction&path=${encodeURIComponent(`${ROOT}\\guide.md`)}`);
  await waitForBundledFonts(page);
  const pausedAt = await page.evaluate(() => Date.now() + 1_000);
  await page.clock.pauseAt(pausedAt);
  const root = page.locator(".instructionTreeRow").first();
  await expect(root).toBeVisible();
  // The root is a folder row too: one click opens it.
  if ((await root.getAttribute("aria-expanded")) !== "true") await root.click();
  await expect(folderRow(page, "教材")).toBeVisible();
  await settle(page);
}

const folderRow = (page: Page, name: string) =>
  page.locator(".instructionTreeRow", { has: page.locator(".instructionTreeName", { hasText: new RegExp(`^${name}$`) }) });

const groupOf = (page: Page, name: string) =>
  folderRow(page, name).locator(
    "xpath=following-sibling::*[contains(concat(' ', normalize-space(@class), ' '), ' instructionTreeGroup ')][1]",
  );

// The page clock drives the spring; the row fades and slides are Web Animations that run in
// real time, so wait for them too (rule 2.2) before measuring positions.
async function settle(page: Page) {
  await page.clock.runFor(1_000);
  await page.evaluate(() =>
    Promise.allSettled(document.getAnimations().map((animation) => animation.finished)),
  );
}

test("V160-S9 one click on a folder row opens and closes it, and so does the arrow", async ({
  page,
}) => {
  await openTree(page, true);
  const row = folderRow(page, "教材");
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".instructionTreeName", { hasText: "a1.md" })).toHaveCount(0);

  await row.locator(".instructionTreeName").click();
  await settle(page);
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator(".instructionTreeName", { hasText: "a1.md" })).toBeVisible();

  await row.locator(".instructionTreeName").click();
  await settle(page);
  await expect(row).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator(".instructionTreeName", { hasText: "a1.md" })).toHaveCount(0);

  await row.getByRole("button", { name: "教材を展開する" }).click();
  await settle(page);
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await row.getByRole("button", { name: "教材を折りたたむ" }).click();
  await settle(page);
  await expect(row).toHaveAttribute("aria-expanded", "false");
});

test("V160-S9 a quick double click ends in the state it started in", async ({ page }) => {
  await openTree(page, true);
  const row = folderRow(page, "教材");

  await row.locator(".instructionTreeName").dblclick();
  await settle(page);
  await expect(row).toHaveAttribute("aria-expanded", "false");

  await row.locator(".instructionTreeName").click();
  await settle(page);
  await expect(row).toHaveAttribute("aria-expanded", "true");
  await row.locator(".instructionTreeName").dblclick();
  await settle(page);
  await expect(row).toHaveAttribute("aria-expanded", "true");

  // The arrow too: two quick presses are two toggles, not three.
  await row.getByRole("button", { name: "教材を折りたたむ" }).dblclick();
  await settle(page);
  await expect(row).toHaveAttribute("aria-expanded", "true");
});

type Sample = { height: number; nextTop: number; rowBottom: number };

// One evaluate reads the box, the folder row and the next row together (rule 4).
async function sample(row: Locator): Promise<Sample> {
  return row.evaluate((element) => {
    const group = element.nextElementSibling?.classList.contains("instructionTreeGroup")
      ? element.nextElementSibling
      : null;
    const next = element.parentElement?.nextElementSibling?.firstElementChild;
    if (!next) throw new Error("next row not found");
    return {
      height: group ? group.getBoundingClientRect().height : 0,
      nextTop: next.getBoundingClientRect().top,
      rowBottom: element.getBoundingClientRect().bottom,
    };
  });
}

async function record(page: Page, row: Locator, frames: number) {
  const samples: Sample[] = [];
  for (let index = 0; index < frames; index += 1) {
    await page.clock.runFor(16);
    samples.push(await sample(row));
  }
  return samples;
}

test("V160-S9 opening grows the box from 0 through a see-through first row, without a jump", async ({
  page,
}) => {
  await openTree(page, false);
  const row = folderRow(page, "教材");
  const next = folderRow(page, "資料");
  const group = groupOf(page, "教材");
  const closedTop = await next.evaluate((element) => element.getBoundingClientRect().top);

  await row.locator(".instructionTreeName").click();
  // The fade runs as a Web Animation, which the page clock does not drive: stop it halfway
  // (rule 2.2) and read the real opacity, then let it finish.
  const midOpacity = await group.locator("xpath=./*[1]").evaluate((element) => {
    const animations = element.getAnimations();
    if (animations.length === 0) return null;
    animations.forEach((animation) => animation.pause());
    animations.forEach((animation) => {
      const timing = animation.effect?.getComputedTiming();
      animation.currentTime = Number(timing?.delay ?? 0) + Number(timing?.duration ?? 0) / 2;
    });
    const value = Number(getComputedStyle(element).opacity);
    animations.forEach((animation) => animation.finish());
    return value;
  });
  expect(midOpacity).not.toBeNull();
  expect(midOpacity as number).toBeGreaterThan(0);
  expect(midOpacity as number).toBeLessThan(1);
  const samples = await record(page, row, 40);
  const heights = samples.map((item) => item.height);

  // The first recorded frame is right after the press (box still near 0), the last is the end
  // of the motion (box at the full content height): jumps happen at exactly those two frames.
  expect(heights[0]).toBeLessThan(ROW_HEIGHT);
  expect(heights.some((height) => height > 0 && height < ROW_HEIGHT * 4)).toBe(true);
  expect(Math.max(...heights)).toBeGreaterThan(0);
  expect(heights.at(-1)).toBeCloseTo(ROW_HEIGHT * 4, 0);
  for (let index = 1; index < heights.length; index += 1) {
    expect(heights[index]).toBeGreaterThanOrEqual(heights[index - 1] - 0.5);
  }
  // No spacing sits outside the box: in every frame the next row is exactly the folder row's
  // bottom plus the box's height, so nothing jumps at the start or the end.
  for (const item of samples) {
    expect(Math.abs(item.nextTop - item.rowBottom - item.height)).toBeLessThanOrEqual(0.5);
  }
  const tops = [closedTop, ...samples.map((item) => item.nextTop)];
  expect(tops.at(-1)).toBeCloseTo(closedTop + ROW_HEIGHT * 4, 0);
});

test("V160-S9 closing shrinks the box to 0 without a jump", async ({ page }) => {
  await openTree(page, false);
  const row = folderRow(page, "教材");
  const next = folderRow(page, "資料");
  const group = groupOf(page, "教材");
  await row.locator(".instructionTreeName").click();
  await settle(page);
  const openTop = await next.evaluate((element) => element.getBoundingClientRect().top);
  const openHeight = await group.evaluate((element) => element.getBoundingClientRect().height);
  expect(openHeight).toBeCloseTo(ROW_HEIGHT * 4, 0);

  await row.locator(".instructionTreeName").click();
  const samples = await record(page, row, 40);
  const heights = samples.map((item) => item.height);

  expect(heights[0]).toBeGreaterThan(ROW_HEIGHT * 3);
  expect(heights.some((height) => height > 0 && height < ROW_HEIGHT * 4)).toBe(true);
  expect(heights.at(-1)).toBe(0);
  for (let index = 1; index < heights.length; index += 1) {
    expect(heights[index]).toBeLessThanOrEqual(heights[index - 1] + 0.5);
  }
  for (const item of samples) {
    expect(Math.abs(item.nextTop - item.rowBottom - item.height)).toBeLessThanOrEqual(0.5);
  }
  const tops = [openTop, ...samples.map((item) => item.nextTop)];
  expect(tops.at(-1)).toBeCloseTo(openTop - ROW_HEIGHT * 4, 0);
});

test("V160-S9 nested folders open the same way", async ({ page }) => {
  await openTree(page, false);
  await folderRow(page, "資料").locator(".instructionTreeName").click();
  await settle(page);
  const inner = folderRow(page, "付録");
  await expect(inner).toBeVisible();
  await inner.locator(".instructionTreeName").click();
  await settle(page);
  await expect(page.locator(".instructionTreeName", { hasText: "c1.md" })).toBeVisible();
  await expect(groupOf(page, "付録")).toBeVisible();
  const height = await groupOf(page, "付録").evaluate(
    (element) => element.getBoundingClientRect().height,
  );
  expect(height).toBeCloseTo(ROW_HEIGHT * 2, 0);
});

test("V160-S9 with reduced motion the box opens and closes at once", async ({ page }) => {
  await openTree(page, true);
  const row = folderRow(page, "教材");
  const group = groupOf(page, "教材");

  await row.locator(".instructionTreeName").click();
  await expect(group).toBeVisible();
  expect(await group.evaluate((element) => element.getBoundingClientRect().height)).toBeCloseTo(
    ROW_HEIGHT * 4,
    0,
  );

  await row.locator(".instructionTreeName").click();
  await page.clock.runFor(50);
  await expect(page.locator(".instructionTreeGroup", { hasText: "a1.md" })).toHaveCount(0);
});

test("V160-S9 a click right after a drag does not open or close the folder", async ({ page }) => {
  await openTree(page, true);
  const row = folderRow(page, "教材");
  await row.dispatchEvent("dragstart", { dataTransfer: await page.evaluateHandle(() => new DataTransfer()) });
  await row.dispatchEvent("dragend");
  await row.locator(".instructionTreeName").click({ force: true });
  await settle(page);
  await expect(row).toHaveAttribute("aria-expanded", "false");

  await page.clock.runFor(10);
  await row.locator(".instructionTreeName").click();
  await settle(page);
  await expect(row).toHaveAttribute("aria-expanded", "true");
});

test("V160-S9 the tree has groups, and folder rows say whether they are open", async ({ page }) => {
  await openTree(page, true);
  const tree = page.getByRole("tree", { name: "手順書フォルダ" });
  await expect(tree.locator('[role="group"]').first()).toBeVisible();
  const books = folderRow(page, "教材");
  await expect(books).toHaveAttribute("aria-expanded", "false");
  await books.locator(".instructionTreeName").click();
  await settle(page);
  await expect(books).toHaveAttribute("aria-expanded", "true");
  await expect(tree.locator('[role="group"]')).not.toHaveCount(1);
});
