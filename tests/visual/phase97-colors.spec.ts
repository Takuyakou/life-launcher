import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import {
  AUTO_PROJECT_COLOR_IDS,
  PROJECT_COLOR_IDS,
  PROJECT_COLOR_LABELS,
  resolveProjectColorId,
} from "../../src/projectIdentity";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const LEGACY_PROJECT_COLOR_IDS = [
  "amber",
  "blue",
  "green",
  "violet",
  "rose",
  "cyan",
  "orange",
  "slate",
];

/** The pre-P97-08 automatic color function, copied so the test does not depend on the change. */
function legacyResolveProjectColorId(projectId: string): string {
  let hash = 0;
  for (const character of projectId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return LEGACY_PROJECT_COLOR_IDS[hash % LEGACY_PROJECT_COLOR_IDS.length];
}

async function prepare(page: Page, fixture: VisualQaFixture = createFullTodayFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function openProjectEditor(page: Page, projectId: string) {
  const card = page.locator(`.nextStepCard[data-project-id="${projectId}"]`);
  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを編集" }).click();
  return page.getByRole("dialog", { name: "プロジェクトを編集" });
}

test("twelve project colors keep the old automatic colors", () => {
  expect(AUTO_PROJECT_COLOR_IDS).toEqual(LEGACY_PROJECT_COLOR_IDS);
  expect(PROJECT_COLOR_IDS).toEqual([...LEGACY_PROJECT_COLOR_IDS, "lime", "magenta", "sand", "coral"]);
  expect(PROJECT_COLOR_IDS).toHaveLength(12);
  for (const color of PROJECT_COLOR_IDS) {
    expect(PROJECT_COLOR_LABELS[color]).toBeTruthy();
  }
  for (let index = 0; index < 1000; index += 1) {
    const projectId = `project-${index}`;
    expect(resolveProjectColorId(projectId)).toBe(legacyResolveProjectColorId(projectId));
  }
});

test("the project editor shows twelve colors and every color survives save and reload", async ({
  page,
}) => {
  await prepare(page);

  const editor = await openProjectEditor(page, "sample-learning");
  const palette = editor.locator(".projectColorPalette");
  await expect(palette.getByRole("radio")).toHaveCount(12);
  for (const color of PROJECT_COLOR_IDS) {
    await expect(palette.getByRole("radio", { name: PROJECT_COLOR_LABELS[color] })).toBeVisible();
  }
  await expect(palette).toHaveScreenshot("phase97-project-colors.png");
  await editor.getByRole("button", { name: "キャンセル" }).click();

  for (const color of PROJECT_COLOR_IDS) {
    const open = await openProjectEditor(page, "sample-learning");
    await open
      .locator(".projectColorPalette")
      .getByRole("radio", { name: PROJECT_COLOR_LABELS[color] })
      .click();
    await open.getByRole("button", { name: "保存", exact: true }).click();
    await expect(open).toHaveCount(0);

    const saved = await currentConfig(page);
    expect(saved.projects.find((project) => project.id === "sample-learning")?.colorId).toBe(color);

    await page.reload();
    await expect(page.locator(".doNowBand")).toBeVisible();
    const reopened = await openProjectEditor(page, "sample-learning");
    await expect(
      reopened
        .locator(".projectColorPalette")
        .getByRole("radio", { name: PROJECT_COLOR_LABELS[color] }),
    ).toHaveAttribute("aria-checked", "true");
    await reopened.getByRole("button", { name: "キャンセル" }).click();
  }
});

test("the twelve-color palette stays inside the editor without overlapping at 560px", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 560, height: 900 });
  await installTauriMock(page, createFullTodayFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();

  const editor = await openProjectEditor(page, "sample-learning");
  const palette = editor.locator(".projectColorPalette");
  await expect(palette.getByRole("radio")).toHaveCount(12);

  const dialogBox = await editor.boundingBox();
  expect(dialogBox).not.toBeNull();
  const boxes = await palette.getByRole("radio").evaluateAll((elements) =>
    elements.map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
    }),
  );
  for (const box of boxes) {
    expect(box.left).toBeGreaterThanOrEqual(dialogBox!.x);
    expect(box.right).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width);
  }
  for (let index = 0; index < boxes.length; index += 1) {
    for (let other = index + 1; other < boxes.length; other += 1) {
      const left = boxes[index];
      const right = boxes[other];
      const overlaps =
        left.left < right.right &&
        right.left < left.right &&
        left.top < right.bottom &&
        right.top < left.bottom;
      expect(overlaps).toBe(false);
    }
  }
});

test("mixed old and new project colors survive reload and editing", async ({ page }) => {
  const fixture = createFullTodayFixture();
  const existing = fixture.config.projects;
  fixture.config.projects = PROJECT_COLOR_IDS.map((color, index) => {
    const project = existing[index];
    return project
      ? { ...project, colorId: color }
      : { id: `color-${color}`, name: `色${index}`, colorId: color };
  });
  await prepare(page, fixture);

  const colorsOf = async () =>
    (await currentConfig(page)).projects.map((project) => project.colorId);
  expect(await colorsOf()).toEqual(PROJECT_COLOR_IDS);
  await page.reload();
  await expect(page.locator(".doNowBand")).toBeVisible();
  expect(await colorsOf()).toEqual(PROJECT_COLOR_IDS);

  const editor = await openProjectEditor(page, "sample-learning");
  await editor.getByRole("textbox", { name: "プロジェクト名" }).fill("サンプル学習（色）");
  await editor.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editor).toHaveCount(0);
  expect(await colorsOf()).toEqual(PROJECT_COLOR_IDS);
});
