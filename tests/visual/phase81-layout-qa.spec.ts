import { resolve } from "node:path";
import { expect, test, type Locator, type Page } from "@playwright/test";
import type { InboxItem, LauncherProject } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

const SCREENSHOT_DIR = resolve("dist/visual-qa/phase81-layout-qa");
const VIEWPORTS = [1920, 1440, 1000, 860, 620] as const;
const LONG_PROJECT_NAME = "長い名前でも責務が混ざらない公開確認用プロジェクト";
const LONG_NEXT_STEP =
  "とても長い次の一手でもプロジェクト名や設定ボタンを押し出さず、現在の実行内容として一行で識別できることを確認するための公開用テキスト";
const LONG_WISHLIST =
  "未所属のやりたいことがとても長くてもプロジェクトなしの表示と操作メニューを押し出さず、一覧の境界内で安全に省略されることを確認する公開用テキスト";

// Adjacent regressions intentionally remain owned by these existing suites:
// - phase72-selection-edit-menus.spec.ts: timer hover glyph and stable time geometry
// - phase72-completion-feedback.spec.ts: completion rewards, including reduced motion
// - instruction-html-browser-parity.spec.ts: HTML renderer layout and safety parity

function createPhase81LayoutFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  const projectTemplate = fixture.config.projects[0];
  const projects: LauncherProject[] = Array.from({ length: 21 }, (_, index) => {
    if (index === 0) {
      return {
        ...projectTemplate,
        name: LONG_PROJECT_NAME,
        northStar: "長い目標でもProject metadataとしてNextStep本文と混ざらず表示される",
        weeklyFocus: true,
        nextStep: {
          ...projectTemplate.nextStep!,
          text: LONG_NEXT_STEP,
          trigger: "PCを開いて資料を並べた直後",
        },
      };
    }
    if (index === 1) {
      return {
        id: "phase81-empty-project",
        name: "次の一手が空のプロジェクト",
        northStar: "Projectだけを保ち、実行内容は後から決める",
        weeklyFocus: false,
        colorId: "green",
      };
    }
    return {
      ...projectTemplate,
      id: `phase81-project-${index + 1}`,
      name: `公開確認プロジェクト ${String(index + 1).padStart(2, "0")}`,
      northStar: `Project metadata ${String(index + 1).padStart(2, "0")}`,
      weeklyFocus: false,
      nextStep: {
        ...projectTemplate.nextStep!,
        text: `公開確認の次の一手 ${String(index + 1).padStart(2, "0")}`,
        buttonIds: [],
      },
    };
  });
  const inbox: InboxItem[] = Array.from({ length: 21 }, (_, index) => ({
    id: `phase81-wishlist-${index + 1}`,
    text:
      index === 0 ? LONG_WISHLIST : `公開確認のやりたいこと ${String(index + 1).padStart(2, "0")}`,
    ...(index === 0 || index % 2 === 0 ? {} : { projectId: projects[index % projects.length].id }),
  }));

  fixture.config.projects = projects;
  fixture.config.inbox = inbox;
  fixture.config.today.items = [
    {
      text: LONG_NEXT_STEP,
      done: false,
      sourceKey: `project:${projects[0].id}`,
      projectId: projects[0].id,
      trigger: projects[0].nextStep?.trigger,
      buttonIds: projects[0].nextStep?.buttonIds,
      defaultTimerMinutes: projects[0].nextStep?.defaultTimerMinutes,
      shortTimerMinutes: projects[0].nextStep?.shortTimerMinutes,
    },
  ];
  fixture.doNowCandidates = [
    { projectId: projects[0].id, reason: "manualOrder", restartEligible: false },
    { projectId: projects[2].id, reason: "noToday", restartEligible: false },
  ];
  return fixture;
}

async function prepare(page: Page, width: number, fixture = createPhase81LayoutFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
}

async function openWishlist(page: Page) {
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  await expect(page.locator(".inboxBody")).toBeVisible();
}

async function measurable(locator: Locator, label: string) {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${label} has no measurable geometry`);
  return box;
}

async function expectInsideViewport(page: Page, locator: Locator, label: string) {
  const box = await measurable(locator, label);
  const viewport = page.viewportSize();
  if (!viewport) throw new Error("Viewport size is unavailable");
  expect(box.x, `${label} left edge`).toBeGreaterThanOrEqual(0);
  expect(box.y, `${label} top edge`).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width, `${label} right edge`).toBeLessThanOrEqual(viewport.width + 0.5);
  expect(box.y + box.height, `${label} bottom edge`).toBeLessThanOrEqual(viewport.height + 0.5);
}

async function expectNoHorizontalDocumentOverflow(page: Page) {
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
    ),
  ).toBe(true);
}

for (const width of VIEWPORTS) {
  test(`Phase 8.1 source layout stays bounded with long and empty data at ${width}`, async ({
    page,
  }) => {
    await prepare(page, width);
    await openWishlist(page);

    const projects = page.locator(".projectsBand");
    const wishlist = page.locator(".inboxBand");
    await expect(projects.locator(".disclosureCount")).toHaveText("21件");
    await expect(wishlist.locator(".disclosureCount")).toHaveText("21件");
    await expect(projects.getByRole("button", { name: "＋ 残り15件を表示" })).toBeVisible();
    await expect(wishlist.locator(".wishlistGroupHeader", { hasText: "未分類" })).toBeVisible();

    const longProject = projects.locator('.nextStepCard[data-project-id="sample-learning"]');
    const emptyProject = projects.locator('.nextStepCard[data-project-id="phase81-empty-project"]');
    const projectRegion = longProject.locator(".nextStepProjectRegion");
    const actionRegion = longProject.locator(".nextStepActionRegion");
    const projectBox = await measurable(projectRegion, "Project region");
    const projectIdentityBox = await measurable(
      projectRegion.locator(".projectIdentity"),
      "Project identity",
    );
    const actionBox = await measurable(actionRegion, "NextStep region");
    expect(projectIdentityBox.x, "Project identity left edge").toBeGreaterThanOrEqual(
      projectBox.x - 0.5,
    );
    expect(
      projectIdentityBox.x + projectIdentityBox.width,
      "Project identity must remain inside its region",
    ).toBeLessThanOrEqual(projectBox.x + projectBox.width + 0.5);
    expect(
      projectBox.y + projectBox.height,
      "Project must stack before NextStep",
    ).toBeLessThanOrEqual(actionBox.y + 0.5);

    await expect(actionRegion.locator("p")).toHaveAttribute("title", LONG_NEXT_STEP);
    await expect(actionRegion.locator("p")).toHaveCSS("text-overflow", "ellipsis");
    const actionTextBox = await measurable(actionRegion.locator("p"), "NextStep text");
    const actionButtonBox = await measurable(
      actionRegion.locator(".nextStepRowAction"),
      "NextStep action",
    );
    expect(
      actionTextBox.y + actionTextBox.height,
      "NextStep text must stack before its action",
    ).toBeLessThanOrEqual(actionButtonBox.y + 0.5);
    await expect(emptyProject.getByText("まだ次の一手がありません", { exact: true })).toBeVisible();
    await expect(emptyProject.getByRole("button", { name: "次の一手を設定" })).toBeVisible();

    const unassignedWishlist = wishlist.locator('[data-inbox-id="phase81-wishlist-1"]');
    await expect(unassignedWishlist.locator(".inboxItemText")).toHaveAttribute(
      "title",
      LONG_WISHLIST,
    );
    await expect(unassignedWishlist.locator(".inboxItemText")).toHaveCSS(
      "text-overflow",
      "ellipsis",
    );
    const wishlistTextBox = await measurable(
      unassignedWishlist.locator(".inboxItemText"),
      "Wishlist text",
    );
    const wishlistMenuBox = await measurable(
      unassignedWishlist.locator(".sourceRowMenu"),
      "Wishlist menu trigger",
    );
    expect(
      wishlistTextBox.x + wishlistTextBox.width,
      "Wishlist text must not cover its menu",
    ).toBeLessThanOrEqual(wishlistMenuBox.x + 0.5);

    for (const row of await page.locator(".nextStepRow, .inboxRow").all()) {
      const box = await measurable(row, "source row");
      expect(box.x, "source row left edge").toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, "source row right edge").toBeLessThanOrEqual(width + 0.5);
    }
    await expectNoHorizontalDocumentOverflow(page);
    expect(await page.evaluate(() => matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(
      true,
    );

    await page.screenshot({
      fullPage: true,
      path: resolve(SCREENSHOT_DIR, `dashboard-${width}x900.png`),
    });
  });
}

test("Phase 8.1 unassigned Wishlist and empty Project require explicit keyboard setup", async ({
  page,
}) => {
  await prepare(page, 620);
  await openWishlist(page);
  const unassigned = page.locator('[data-inbox-id="phase81-wishlist-1"]');
  await unassigned.focus();
  await unassigned.press("Shift+F10");
  await expectInsideViewport(page, page.getByRole("menu"), "unassigned Wishlist context menu");
  await page.getByRole("menuitem", { name: "次の一手にする", exact: true }).click();
  const promotion = page.getByRole("dialog", { name: "次の一手を設定", exact: true });
  const projectSelection = promotion.getByRole("combobox", { name: "プロジェクト", exact: true });
  await expect(projectSelection).toBeFocused();
  await expect(projectSelection).toHaveValue("");
  await expect(promotion.getByRole("textbox", { name: "行動" })).toHaveCount(0);
  await expect(promotion.getByRole("tab", { name: "やりたいことから選ぶ" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(promotion.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
  await expectInsideViewport(page, promotion, "unassigned Wishlist promotion dialog");
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "unassigned-promotion-620x900.png") });
  await projectSelection.selectOption("phase81-empty-project");
  await expect(promotion.locator(".nextStepReplacementNotice")).toHaveCount(0);
  await promotion.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(unassigned).toBeVisible();

  const emptyAction = page.locator(
    '.nextStepCard[data-project-id="phase81-empty-project"] .nextStepActionRegion',
  );
  await emptyAction.focus();
  await emptyAction.press("Shift+F10");
  await expect(page.getByRole("menu").getByRole("menuitem")).toHaveText([
    "プロジェクトを編集",
    "プロジェクトを管理",
    "次の一手を設定",
  ]);
  await page.getByRole("menuitem", { name: "次の一手を設定", exact: true }).click();
  const setup = page.getByRole("dialog", { name: "次の一手を設定", exact: true });
  await setup.getByRole("tab", { name: "＋ 新しく入力" }).click();
  await expect(setup.getByRole("textbox", { name: "行動" })).toBeFocused();
  await expect(setup.getByRole("textbox", { name: "行動" })).toHaveValue("");
  await expect(setup.getByRole("combobox", { name: "プロジェクト", exact: true })).toHaveCount(0);
  await expect(setup.locator(".nextStepFixedProject")).toContainText("次の一手が空のプロジェクト");
  await expect(setup.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
  await expectInsideViewport(page, setup, "empty Project NextStep dialog");
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "empty-project-nextstep-620x900.png") });
  await page.keyboard.press("Escape");
  await expect(emptyAction).toBeFocused();
});

test("Phase 8.1 NextStep cards expose one combined keyboard context menu", async ({ page }) => {
  await prepare(page, 1440);
  const row = page.locator('.nextStepCard[data-project-id="sample-learning"]');
  const projectRegion = row.locator(".nextStepProjectRegion");
  const actionRegion = row.locator(".nextStepActionRegion");

  await projectRegion.focus();
  await projectRegion.press("Shift+F10");
  let menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    "プロジェクトを編集",
    "プロジェクトを管理",
    "次の一手を編集",
    "次の一手を変更",
    "次の一手を未設定にする",
  ]);
  await expect(menu.getByRole("menuitem", { name: "やりたいことを追加" })).toHaveCount(0);
  await expectInsideViewport(page, menu, "Combined NextStep context menu");
  await page.screenshot({ path: resolve(SCREENSHOT_DIR, "nextstep-context-1440x900.png") });
  await page.keyboard.press("Escape");
  await expect(projectRegion).toBeFocused();

  await actionRegion.focus();
  await actionRegion.press("Shift+F10");
  menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    "プロジェクトを編集",
    "プロジェクトを管理",
    "次の一手を編集",
    "次の一手を変更",
    "次の一手を未設定にする",
  ]);
  await expectInsideViewport(page, menu, "Combined NextStep action context menu");
  await page.keyboard.press("Escape");
  await expect(actionRegion).toBeFocused();
});

test("Phase 8.1 dialogs restore their canonical context target on every close path", async ({
  page,
}) => {
  await prepare(page, 860);
  const row = page.locator('.nextStepCard[data-project-id="sample-learning"]');
  const projectRegion = row.locator(".nextStepProjectRegion");
  const actionRegion = row.locator(".nextStepActionRegion");

  await projectRegion.focus();
  await projectRegion.press("Shift+F10");
  await page.getByRole("menuitem", { name: "プロジェクトを編集", exact: true }).click();
  let metadata = page.getByRole("dialog", { name: "プロジェクトを編集" });
  await page
    .locator(".modalBackdrop")
    .last()
    .click({ position: { x: 4, y: 4 } });
  await expect(metadata).toHaveCount(0);
  await expect(projectRegion).toBeFocused();

  await projectRegion.press("Shift+F10");
  await page.getByRole("menuitem", { name: "プロジェクトを編集", exact: true }).click();
  metadata = page.getByRole("dialog", { name: "プロジェクトを編集" });
  await metadata.getByRole("button", { name: "保存", exact: true }).click();
  await expect(metadata).toHaveCount(0);
  await expect(projectRegion).toBeFocused();

  await actionRegion.focus();
  await actionRegion.press("Shift+F10");
  await page.getByRole("menuitem", { name: "次の一手を編集", exact: true }).click();
  let nextStep = page.getByRole("dialog", { name: "次の一手を編集", exact: true });
  await nextStep.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(nextStep).toHaveCount(0);
  await expect(actionRegion).toBeFocused();

  await actionRegion.press("Shift+F10");
  await page.getByRole("menuitem", { name: "次の一手を編集", exact: true }).click();
  nextStep = page.getByRole("dialog", { name: "次の一手を編集", exact: true });
  await nextStep.getByRole("button", { name: "保存", exact: true }).click();
  await expect(nextStep).toHaveCount(0);
  await expect(actionRegion).toBeFocused();
});

for (const width of [860, 620] as const) {
  test(`Phase 8.1 metadata and NextStep dialogs remain usable at ${width}`, async ({ page }) => {
    await prepare(page, width);
    const row = page.locator('.nextStepCard[data-project-id="sample-learning"]');
    const projectRegion = row.locator(".nextStepProjectRegion");
    const actionRegion = row.locator(".nextStepActionRegion");

    await projectRegion.focus();
    await projectRegion.press("Shift+F10");
    await page.getByRole("menuitem", { name: "プロジェクトを編集", exact: true }).click();
    const metadata = page.getByRole("dialog", { name: "プロジェクトを編集" });
    await expect(metadata).toBeVisible();
    await expect(metadata.getByRole("textbox", { name: "行動" })).toHaveCount(0);
    await expect(metadata.getByRole("spinbutton")).toHaveCount(0);
    await expectInsideViewport(page, metadata, "Project metadata dialog");
    expect(await metadata.evaluate((node) => node.contains(document.activeElement))).toBe(true);

    const metadataActions = metadata.locator(".formDialogActions");
    const metadataSave = metadataActions.getByRole("button", { name: "保存", exact: true });
    const metadataCancel = metadataActions.getByRole("button", { name: "キャンセル", exact: true });
    await metadataActions.scrollIntoViewIfNeeded();
    const metadataSaveRest = await metadataSave.evaluate(
      (node) => getComputedStyle(node).backgroundColor,
    );
    await metadataSave.hover();
    await expect
      .poll(() => metadataSave.evaluate((node) => getComputedStyle(node).backgroundColor))
      .not.toBe(metadataSaveRest);
    await metadataSave.focus();
    await page.keyboard.press("Tab");
    await expect(metadataCancel).toBeFocused();
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, `metadata-dialog-focus-${width}x900.png`),
    });
    await page.keyboard.press("Escape");
    await expect(metadata).toHaveCount(0);
    await expect(projectRegion).toBeFocused();

    await actionRegion.focus();
    await actionRegion.press("Shift+F10");
    await page.getByRole("menuitem", { name: "次の一手を編集", exact: true }).click();
    const nextStep = page.getByRole("dialog", { name: "次の一手を編集", exact: true });
    await expect(nextStep).toBeVisible();
    await expect(nextStep.getByRole("textbox", { name: "行動" })).toBeFocused();
    await expect(nextStep.getByRole("heading", { level: 3 })).toHaveText([
      "プロジェクト",
      "次の一手の決め方",
      "開始環境",
      "手順書",
      "タイマー",
    ]);
    await expectInsideViewport(page, nextStep, "NextStep dialog");
    expect(await nextStep.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);

    const nextStepActions = nextStep.locator(".formDialogActions");
    const nextStepSave = nextStepActions.getByRole("button", { name: "保存", exact: true });
    const nextStepCancel = nextStepActions.getByRole("button", { name: "キャンセル", exact: true });
    await nextStepActions.scrollIntoViewIfNeeded();
    await page.mouse.move(0, 0);
    const nextStepCancelRest = await nextStepCancel.evaluate(
      (node) => getComputedStyle(node).backgroundColor,
    );
    await nextStepCancel.hover();
    await expect
      .poll(() => nextStepCancel.evaluate((node) => getComputedStyle(node).backgroundColor))
      .not.toBe(nextStepCancelRest);
    await nextStepSave.focus();
    await page.keyboard.press("Tab");
    await expect(nextStepCancel).toBeFocused();
    await expectNoHorizontalDocumentOverflow(page);
    await page.screenshot({
      path: resolve(SCREENSHOT_DIR, `nextstep-dialog-focus-${width}x900.png`),
    });
    await page.keyboard.press("Escape");
    await expect(nextStep).toHaveCount(0);
    await expect(actionRegion).toBeFocused();
  });
}
