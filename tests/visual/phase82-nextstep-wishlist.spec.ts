import { expect, test, type Page } from "@playwright/test";
import {
  groupWishlist,
  prepareNextStepReplacement,
  wishlistGroupKey,
} from "../../src/nextStepWishlist";
import type { AppConfig, LauncherNextStep } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type VisualQaControl = {
  currentConfig: () => AppConfig;
  invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
  setSaveConfigFailure: (failed: boolean) => void;
  updateConfig: (config: AppConfig) => void;
};

async function prepare(page: Page, fixture: VisualQaFixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".inboxBand")).toBeVisible();
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

async function openPromotion(page: Page, itemId = "sample-weekend") {
  await page.locator(`[data-inbox-id="${itemId}"]`).click({ button: "right" });
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "今日へ", exact: true })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "次の一手にする" }).click();
  return page.getByRole("dialog", { name: "次の一手を設定" });
}

function replacementFixture(): {
  config: AppConfig;
  current: LauncherNextStep;
  promoted: LauncherNextStep;
} {
  const config = structuredClone(createPublicFixture().config);
  const project = config.projects[0];
  const current: LauncherNextStep = {
    ...project.nextStep!,
    text: "古い次の一手",
    timerMinutes: 41,
    quickMinutes: 7,
    buttonIds: ["legacy-button"],
    instructionPath: "C:\\Instructions\\old.html",
    updatedAt: "2026-09-01T00:00:00.000Z",
  };
  project.nextStep = current;
  config.inbox = [
    { id: "wish-promote", text: "新しい次の一手", projectId: project.id },
    { id: "wish-keep", text: "残るやりたいこと", projectId: project.id },
  ];
  const promoted: LauncherNextStep = {
    id: "next-promoted",
    generation: 1,
    text: "新しい次の一手",
    timerMinutes: 25,
    quickMinutes: 5,
    buttonIds: [],
    updatedAt: "2026-09-14T00:00:00.000Z",
  };
  return { config, current, promoted };
}

test("P82-01 Wishlist groups follow Project order and keep unassigned items last", () => {
  const config = structuredClone(createPublicFixture().config);
  const first = config.projects[0];
  const second = { ...first, id: "project-second", name: "二番目", nextStep: undefined };
  config.projects = [first, second];
  config.inbox = [
    { id: "second-1", text: "同じ文言", projectId: second.id },
    { id: "first-1", text: "同じ文言", projectId: first.id },
    { id: "orphan-1", text: "孤立", projectId: "missing-project" },
    { id: "first-2", text: "同じ文言", projectId: first.id },
    { id: "unassigned-1", text: "未分類" },
  ];

  const groups = groupWishlist(config);
  expect(groups.map((group) => group.name)).toEqual([first.name, second.name, "未分類"]);
  expect(groups[0].items.map(({ item }) => item.id)).toEqual(["first-1", "first-2"]);
  expect(groups[1].items.map(({ item }) => item.id)).toEqual(["second-1"]);
  expect(groups[2].items.map(({ item }) => item.id)).toEqual(["orphan-1", "unassigned-1"]);
  expect(wishlistGroupKey(config.inbox[2], new Set(config.projects.map(({ id }) => id)))).toBe(
    "unassigned",
  );
});

test("P82-01 returning the previous NextStep is atomic and strips execution payload", () => {
  const { config, current, promoted } = replacementFixture();
  const todayBefore = structuredClone(config.today);
  const completionsBefore = structuredClone(config.sourceCompletions);

  const result = prepareNextStepReplacement(config, {
    projectId: config.projects[0].id,
    nextStep: promoted,
    expectedCurrent: current,
    choice: "return",
    promotedWishlistId: "wish-promote",
    completedAt: "2026-09-14T01:00:00.000Z",
    createId: () => "returned-stable-id",
  });

  expect(result.projects[0].nextStep).toEqual(promoted);
  expect(result.inbox.map(({ id }) => id)).toEqual(["wish-keep", "returned-stable-id"]);
  expect(result.inbox[1]).toEqual({
    id: "returned-stable-id",
    text: current.text,
    projectId: config.projects[0].id,
  });
  expect(result.today).toEqual(todayBefore);
  expect(result.sourceCompletions).toEqual(completionsBefore);
  expect(config.inbox.map(({ id }) => id)).toEqual(["wish-promote", "wish-keep"]);
});

test("P82-01 completing the previous NextStep records history without returning it", () => {
  const { config, current, promoted } = replacementFixture();
  const result = prepareNextStepReplacement(config, {
    projectId: config.projects[0].id,
    nextStep: promoted,
    expectedCurrent: current,
    choice: "complete",
    promotedWishlistId: "wish-promote",
    completedAt: "2026-09-14T01:00:00.000Z",
    createId: () => "completion-stable-id",
  });

  expect(result.inbox.map(({ id }) => id)).toEqual(["wish-keep"]);
  expect(result.sourceCompletions.at(-1)).toMatchObject({
    id: "completion-stable-id",
    sourceType: "nextStep",
    sourceIdentity: `project:${config.projects[0].id}`,
    textSnapshot: current.text,
    completedAt: "2026-09-14T01:00:00.000Z",
  });
});

test("P82-01 refuses stale replacement snapshots and missing promoted sources", () => {
  const { config, current, promoted } = replacementFixture();
  const input = {
    projectId: config.projects[0].id,
    nextStep: promoted,
    expectedCurrent: { ...current, text: "stale" },
    choice: "return" as const,
    promotedWishlistId: "wish-promote",
    completedAt: "2026-09-14T01:00:00.000Z",
    createId: () => "unused",
  };
  expect(() => prepareNextStepReplacement(config, input)).toThrow(
    "現在の次の一手が変更されたため、内容を確認し直してください",
  );
  expect(() =>
    prepareNextStepReplacement(config, {
      ...input,
      expectedCurrent: current,
      promotedWishlistId: "missing",
    }),
  ).toThrow("元のやりたいことが見つかりません");
});

test("P82-01 promotion returns the old NextStep and survives reload", async ({ page }) => {
  const fixture = createPublicFixture();
  const oldToday = structuredClone(fixture.config.today);
  const oldNextStep = structuredClone(fixture.config.projects[0].nextStep);
  await prepare(page, fixture);

  const dialog = await openPromotion(page);
  const save = dialog.getByRole("button", { name: "保存", exact: true });
  await expect(save).toBeDisabled();
  await dialog.getByRole("button", { name: "やりたいことへ戻す" }).click();
  await expect(save).toBeEnabled();
  await save.click();
  await expect(dialog).toBeHidden();

  const saved = await currentConfig(page);
  expect(saved.projects[0].nextStep?.text).toBe("週末に試すアイデア");
  expect(saved.inbox.some(({ id }) => id === "sample-weekend")).toBe(false);
  const returned = saved.inbox.find(({ text }) => text === oldNextStep?.text);
  expect(returned).toEqual({
    id: expect.any(String),
    text: oldNextStep?.text,
    projectId: "sample-learning",
  });
  expect(saved.today).toEqual(oldToday);
  expect(saved.sourceCompletions).toEqual([]);

  await page.reload();
  const reloaded = await currentConfig(page);
  expect(reloaded.projects[0].nextStep?.text).toBe("週末に試すアイデア");
  expect(reloaded.inbox.find(({ text }) => text === oldNextStep?.text)).toEqual(returned);
});

test("P82-01 promotion cancel and save failure leave both sources unchanged", async ({ page }) => {
  const fixture = createPublicFixture();
  const initial = structuredClone(fixture.config);
  await prepare(page, fixture);

  let dialog = await openPromotion(page);
  await dialog.getByRole("button", { name: "やりたいことへ戻す" }).click();
  await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(dialog).toBeHidden();
  expect(await currentConfig(page)).toEqual(initial);

  dialog = await openPromotion(page);
  await dialog.getByRole("button", { name: "完了にする", exact: true }).click();
  await page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true),
  );
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toBeVisible();
  expect(await currentConfig(page)).toEqual(initial);
});

test("P82-01 Wishlist renders Project groups, collapse, Today and excluded states", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.inbox.push({
    id: "wish-selected",
    text: "今日に選ばれたやりたいこと",
    projectId: "sample-stretch",
  });
  fixture.config.inbox.push({ id: "wish-excluded", text: "候補から外したやりたいこと" });
  fixture.config.today.items.push({
    text: "今日に選ばれたやりたいこと",
    done: false,
    sourceKey: "wishlist:wish-selected",
    projectId: "sample-stretch",
  });
  fixture.config.today.candidateExcludedSourceKeys.push("wishlist:wish-excluded");
  await prepare(page, fixture);

  const groups = page.locator(".wishlistGroup");
  await expect(groups).toHaveCount(3);
  await expect(groups.nth(0).locator(".wishlistGroupHeader")).toContainText("サンプル学習");
  await expect(groups.nth(1).locator(".wishlistGroupHeader")).toContainText("ストレッチ");
  await expect(groups.nth(2).locator(".wishlistGroupHeader")).toContainText("未分類");
  await expect(page.locator('[data-inbox-id="wish-selected"] .wishlistTodayStatus')).toHaveText(
    "✓ 今日の3件",
  );
  await expect(
    page.locator('[data-inbox-id="wish-excluded"]').getByRole("button", { name: "候補に戻す" }),
  ).toBeVisible();

  const firstHeader = groups.nth(0).locator(".wishlistGroupHeader");
  await firstHeader.click();
  await expect(firstHeader).toHaveAttribute("aria-expanded", "false");
  await expect(groups.nth(0).locator(".inboxRow")).toHaveCount(0);
  await firstHeader.click();
  await expect(firstHeader).toHaveAttribute("aria-expanded", "true");
  await page.locator(".inboxBand").screenshot({
    path: "dist/visual-qa/phase82-01/wishlist-1440.png",
  });
  await page.setViewportSize({ width: 860, height: 900 });
  await page.locator(".inboxBand").screenshot({
    path: "dist/visual-qa/phase82-01/wishlist-860.png",
  });
});

test("P82-01 promotion rejects a source removed after the form opened", async ({ page }) => {
  await prepare(page);
  const dialog = await openPromotion(page);
  await dialog.getByRole("button", { name: "やりたいことへ戻す" }).click();
  await page.evaluate(() => {
    const control = (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = structuredClone(control.currentConfig());
    config.projects[0].nextStep = undefined;
    control.updateConfig(config);
  });
  await expect(page.locator('[data-project-id="sample-learning"]')).toContainText(
    "次の一手は未設定です",
  );
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toBeVisible();
  expect((await currentConfig(page)).projects[0].nextStep).toBeUndefined();
  expect((await currentConfig(page)).inbox.some(({ id }) => id === "sample-weekend")).toBe(true);
});

test("P82-01 group D&D saves only on drop, persists order and rolls back failure", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.inbox = [
    { id: "wish-one", text: "同じ文言", projectId: "sample-learning" },
    { id: "wish-two", text: "同じ文言", projectId: "sample-learning" },
    { id: "wish-three", text: "三番目", projectId: "sample-learning" },
    { id: "wish-other", text: "別Project", projectId: "sample-stretch" },
  ];
  await prepare(page, fixture);
  const saveCount = () => page.evaluate(() => (
    window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
  ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(({ command }) => command === "save_config").length);
  const drag = async (sourceId: string, targetId: string, after = true) => {
    const source = page.locator(`[data-inbox-id="${sourceId}"]`);
    const target = page.locator(`[data-inbox-id="${targetId}"]`);
    await source.scrollIntoViewIfNeeded();
    const from = (await source.boundingBox())!;
    const to = (await target.boundingBox())!;
    await page.mouse.move(from.x + 40, from.y + from.height / 2);
    await page.mouse.down();
    await page.mouse.move(from.x + 52, from.y + from.height / 2, { steps: 2 });
    await page.mouse.move(to.x + 40, to.y + to.height * (after ? 0.9 : 0.1), { steps: 6 });
  };

  await drag("wish-one", "wish-two");
  await expect(page.locator(".inboxDropIndicator")).toBeVisible();
  expect(await saveCount()).toBe(0);
  await page.mouse.up();
  await expect.poll(async () => (await currentConfig(page)).inbox.map(({ id }) => id)).toEqual([
    "wish-two", "wish-one", "wish-three", "wish-other",
  ]);
  expect(await saveCount()).toBe(1);
  await page.reload();
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  await expect(page.locator('[data-wishlist-group="project:sample-learning"] .inboxRow').first()).toHaveAttribute(
    "data-inbox-id",
    "wish-two",
  );

  await page.evaluate(() => (
    window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
  ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true));
  await drag("wish-three", "wish-two", false);
  await page.mouse.up();
  await expect(page.locator(".inboxDragGhost")).toHaveCount(0);
  expect((await currentConfig(page)).inbox.map(({ id }) => id)).toEqual([
    "wish-two", "wish-one", "wish-three", "wish-other",
  ]);

  const beforeCross = await saveCount();
  await drag("wish-one", "wish-other");
  await expect(page.locator(".inboxDropIndicator")).toHaveCount(0);
  await page.mouse.up();
  expect(await saveCount()).toBe(beforeCross);
});
