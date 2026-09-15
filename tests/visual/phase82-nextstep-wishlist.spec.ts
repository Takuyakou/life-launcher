import { expect, test, type Page } from "@playwright/test";
import {
  groupWishlist,
  prepareNextStepRemoval,
  prepareNextStepReplacement,
  prepareWishlistPromotion,
  reorderWishlistGroups,
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
  return page.getByRole("dialog", { name: /次の一手を(設定|変更)/ });
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

test("v1.3 Wishlist groups follow their own inbox order", () => {
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
  expect(groups.map((group) => group.name)).toEqual([second.name, first.name, "未分類"]);
  expect(groups[0].items.map(({ item }) => item.id)).toEqual(["second-1"]);
  expect(groups[1].items.map(({ item }) => item.id)).toEqual(["first-1", "first-2"]);
  expect(groups[2].items.map(({ item }) => item.id)).toEqual(["orphan-1", "unassigned-1"]);
  expect(wishlistGroupKey(config.inbox[2], new Set(config.projects.map(({ id }) => id)))).toBe(
    "unassigned",
  );
});

test("v1.3 Wishlist group reorder preserves item order without changing Project order", () => {
  const config = structuredClone(createPublicFixture().config);
  const first = config.projects[0];
  const second = { ...first, id: "project-second", name: "二番目", nextStep: undefined };
  config.projects = [first, second];
  config.inbox = [
    { id: "first-1", text: "一番目A", projectId: first.id },
    { id: "first-2", text: "一番目B", projectId: first.id },
    { id: "second-1", text: "二番目A", projectId: second.id },
    { id: "none-1", text: "未分類" },
  ];
  const result = reorderWishlistGroups(
    config,
    `project:${second.id}`,
    `project:${first.id}`,
    "before",
  );

  expect(groupWishlist(result).map(({ key }) => key)).toEqual([
    `project:${second.id}`,
    `project:${first.id}`,
    "unassigned",
  ]);
  expect(result.inbox.map(({ id }) => id)).toEqual(["second-1", "first-1", "first-2", "none-1"]);
  expect(result.projects.map(({ id }) => id)).toEqual([first.id, second.id]);
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

test("v1.3 Wishlist drop promotion returns the old NextStep and preserves unrelated state", () => {
  const { config, current, promoted } = replacementFixture();
  const todayBefore = structuredClone(config.today);
  const completionsBefore = structuredClone(config.sourceCompletions);
  const result = prepareWishlistPromotion(config, {
    wishlistId: "wish-promote",
    projectId: config.projects[0].id,
    nextStep: promoted,
    expectedCurrent: current,
    createId: () => "returned-from-drop",
  });

  expect(result.projects[0].nextStep).toEqual(promoted);
  expect(result.inbox.map(({ id }) => id)).toEqual(["wish-keep", "returned-from-drop"]);
  expect(result.inbox[1]).toEqual({
    id: "returned-from-drop",
    text: current.text,
    projectId: config.projects[0].id,
  });
  expect(result.today).toEqual(todayBefore);
  expect(result.sourceCompletions).toEqual(completionsBefore);
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

test("P82-01 Wishlist renders Project groups, collapse, Today and excluded states", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.inbox.push({
    id: "wish-selected",
    text: "今日に選ばれたやりたいこと",
    projectId: "sample-stretch",
  });
  fixture.config.inbox.push({
    id: "wish-selected-second",
    text: "同じプロジェクトのもう一件",
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
  const expectedGroupNames = groupWishlist(fixture.config).map(({ name }) => name);
  for (const [index, name] of expectedGroupNames.entries()) {
    await expect(groups.nth(index).locator(".wishlistGroupHeader")).toContainText(name);
  }
  const stretchGroup = page.locator('[data-wishlist-group="project:sample-stretch"]');
  await expect(stretchGroup.locator(".wishlistGroupHeader")).toContainText("2件");
  await expect(stretchGroup.locator(".inboxRow")).toHaveCount(2);
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
    const control = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    const config = structuredClone(control.currentConfig());
    config.projects[0].nextStep = undefined;
    control.updateConfig(config);
  });
  await expect(page.locator('[data-project-id="sample-learning"]')).toContainText(
    "まだ次の一手がありません",
  );
  await dialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(dialog).toBeVisible();
  expect((await currentConfig(page)).projects[0].nextStep).toBeUndefined();
  expect((await currentConfig(page)).inbox.some(({ id }) => id === "sample-weekend")).toBe(true);
});

test("P82-01 group D&D saves only on drop, persists order and rolls back failure", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.inbox = [
    { id: "wish-one", text: "同じ文言", projectId: "sample-learning" },
    { id: "wish-two", text: "同じ文言", projectId: "sample-learning" },
    { id: "wish-three", text: "三番目", projectId: "sample-learning" },
    { id: "wish-other", text: "別Project", projectId: "sample-stretch" },
  ];
  await prepare(page, fixture);
  const saveCount = () =>
    page.evaluate(
      () =>
        (
    window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
        ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(({ command }) => command === "save_config")
          .length,
    );
  const drag = async (sourceId: string, targetId: string, after = true) => {
    const source = page.locator(`[data-inbox-id="${sourceId}"]`);
    const target = page.locator(`[data-inbox-id="${targetId}"]`);
    await source.evaluate((element) => element.scrollIntoView({ block: "center" }));
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
  await expect
    .poll(async () => (await currentConfig(page)).inbox.map(({ id }) => id))
    .toEqual(["wish-two", "wish-one", "wish-three", "wish-other"]);
  expect(await saveCount()).toBe(1);
  await page.reload();
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  await expect(
    page.locator('[data-wishlist-group="project:sample-learning"] .inboxRow').first(),
  ).toHaveAttribute("data-inbox-id", "wish-two");

  await page.evaluate(() =>
    (
    window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true),
  );
  await drag("wish-three", "wish-two", false);
  await page.mouse.up();
  await expect(page.locator(".inboxDragGhost")).toHaveCount(0);
  expect((await currentConfig(page)).inbox.map(({ id }) => id)).toEqual([
    "wish-two",
    "wish-one",
    "wish-three",
    "wish-other",
  ]);

  const beforeCross = await saveCount();
  await drag("wish-one", "wish-other");
  await expect(page.locator(".inboxDropIndicator")).toHaveCount(0);
  await page.mouse.up();
  expect(await saveCount()).toBe(beforeCross);
});

test("v1.3 removing a NextStep can return it to Wishlist without touching Today or history", () => {
  const config = structuredClone(createPublicFixture().config);
  const project = config.projects[0];
  const today = structuredClone(config.today);
  const completions = structuredClone(config.sourceCompletions);
  const result = prepareNextStepRemoval(config, {
    projectId: project.id,
    expectedCurrent: project.nextStep!,
    choice: "return",
    createId: () => "returned-next-step",
  });

  expect(result.projects[0].nextStep).toBeUndefined();
  expect(result.inbox.at(-1)).toEqual({
    id: "returned-next-step",
    text: project.nextStep?.text,
    projectId: project.id,
  });
  expect(result.today).toEqual(today);
  expect(result.sourceCompletions).toEqual(completions);
  expect(config.projects[0].nextStep).toBeDefined();

  const deleted = prepareNextStepRemoval(config, {
    projectId: project.id,
    expectedCurrent: project.nextStep!,
    choice: "delete",
    createId: () => "unused",
  });
  expect(deleted.projects[0].nextStep).toBeUndefined();
  expect(deleted.inbox).toEqual(config.inbox);
});

test("v1.3 NextStep menu offers edit, change, unset and Builder registration", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.candidateExcludedSourceKeys.push("project:sample-learning");
  await prepare(page, fixture);
  const row = page.locator('[data-project-id="sample-learning"]');

  await row.getByRole("button", { name: "サンプル学習の次の一手の操作" }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem")).toHaveText([
    "プロジェクトを編集",
    "プロジェクトを管理",
    "次の一手を編集",
    "次の一手を変更",
    "次の一手を未設定にする",
    "今日を組み立てるに登録する",
  ]);
  await menu.getByRole("menuitem", { name: "次の一手を未設定にする" }).click();
  const dialog = page.getByRole("dialog", { name: "次の一手を未設定にしますか？" });
  await expect(dialog.getByRole("button")).toHaveText([
    "",
    "やりたいことへ戻す",
    "削除して未設定にする",
    "キャンセル",
  ]);
  await dialog.getByRole("button", { name: "やりたいことへ戻す" }).click();
  await expect(dialog).toBeHidden();
  const saved = await currentConfig(page);
  expect(saved.projects.find(({ id }) => id === "sample-learning")?.nextStep).toBeUndefined();
  expect(saved.inbox.some(({ text }) => text === fixture.config.projects[0].nextStep?.text)).toBe(
    true,
  );
});

test("v1.3 dragging a NextStep to Wishlist highlights the target and returns it atomically", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  const originalToday = structuredClone(fixture.config.today);
  const sourceText = fixture.config.projects[0].nextStep!.text;
  await prepare(page, fixture);
  const source = page.locator('[data-project-id="sample-learning"]');
  const target = page.locator(".inboxBand .disclosureHeader");
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;

  await page.mouse.move(from.x + 260, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 272, from.y + from.height / 2, { steps: 2 });
  await expect(page.locator(".inboxBand.sourceReturnBand--target")).toBeVisible();
  await expect(page.locator(".inboxBand .sourceReturnDropZone")).toContainText(
    "ここにドロップしてやりたいことへ戻す",
  );
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await expect(page.locator(".inboxBand.sourceReturnBand--active")).toBeVisible();
  await page.mouse.up();

  await expect
    .poll(
      async () =>
    (await currentConfig(page)).projects.find(({ id }) => id === "sample-learning")?.nextStep,
    )
    .toBeUndefined();
  const saved = await currentConfig(page);
  expect(
    saved.inbox.some(
      ({ text, projectId }) => text === sourceText && projectId === "sample-learning",
    ),
  ).toBe(true);
  expect(saved.today).toEqual(originalToday);
});

test("v1.3 dragging a Builder candidate to its source section shows guidance and excludes it", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  await page.locator(".todayBuilderDisclosure").click();
  const source = page.locator(".todayBuilderRow", { hasText: "5分だけ体を動かす" });
  const target = page.locator(".projectsBand .disclosureHeader");
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;

  await page.mouse.move(from.x + 220, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 232, from.y + from.height / 2, { steps: 2 });
  await expect(page.locator(".projectsBand.sourceReturnBand--target")).toBeVisible();
  await expect(page.locator(".projectsBand .sourceReturnDropZone")).toContainText(
    "ここにドロップして今日の候補から外す",
  );
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();

  await expect
    .poll(async () => (await currentConfig(page)).today.candidateExcludedSourceKeys)
    .toContain("project:sample-stretch");
  expect((await currentConfig(page)).projects.some(({ id }) => id === "sample-stretch")).toBe(true);
});

test("v1.3 NextStep and Wishlist headers keep compact right-side actions", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects.push({
    ...fixture.config.projects[0],
    id: "project-unset",
    name: "未設定プロジェクト",
    nextStep: undefined,
  });
  await prepare(page, fixture);

  await expect(page.getByRole("button", { name: "プロジェクトを追加" })).toHaveText(
    "＋ プロジェクト",
  );
  await expect(page.getByRole("button", { name: "やりたいことを追加" })).toHaveText(
    "＋ やりたいこと",
  );
  const configured = page.locator(
    '.nextStepCard[data-project-id="sample-learning"] .nextStepActionRegion p',
  );
  const unset = page.locator(
    '.nextStepCard[data-project-id="project-unset"] .nextStepActionRegion p',
  );
  expect(await configured.evaluate((node) => getComputedStyle(node).fontSize)).toBe(
    await unset.evaluate((node) => getComputedStyle(node).fontSize),
  );
  await expect(
    page.locator('.nextStepCard[data-project-id="project-unset"] .nextStepRowAction'),
  ).toHaveClass(/nextStepRowAction--set/);
  const setButton = page.locator(
    '.nextStepCard[data-project-id="project-unset"] .nextStepRowAction',
  );
  const setButtonBox = (await setButton.boundingBox())!;
  await page.mouse.click(setButtonBox.x + setButtonBox.width / 2, setButtonBox.y - 5);
  await expect(page.getByRole("dialog", { name: "次の一手を設定" })).toBeVisible();
  await page
    .getByRole("dialog", { name: "次の一手を設定" })
    .getByRole("button", { name: "キャンセル", exact: true })
    .click();
  await expect(page.locator(".wishlistDragHandle")).toHaveCount(0);
  await page.locator(".projectsBand").screenshot({
    path: "dist/visual-qa/v13-nextstep-wishlist/projects-1440.png",
  });
  await page.locator(".inboxBand").screenshot({
    path: "dist/visual-qa/v13-nextstep-wishlist/wishlist-1440.png",
  });
  await page.setViewportSize({ width: 860, height: 900 });
  for (const selector of [".projectsBand", ".inboxBand"]) {
    expect(
      await page.locator(selector).evaluate((node) => node.scrollWidth <= node.clientWidth),
    ).toBe(true);
  }
  await page.locator(".projectsBand").screenshot({
    path: "dist/visual-qa/v13-nextstep-wishlist/projects-860.png",
  });
  await page.locator(".inboxBand").screenshot({
    path: "dist/visual-qa/v13-nextstep-wishlist/wishlist-860.png",
  });
});

test("v1.3 NextStep uses a compact 3x2 grid with aligned actions and six-item expansion", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  const template = fixture.config.projects[0];
  while (fixture.config.projects.length < 8) {
    const index = fixture.config.projects.length;
    fixture.config.projects.push({
      ...template,
      id: `project-card-${index}`,
      weeklyFocus: false,
      name:
        index === 6
          ? "とても長いプロジェクト名でもカードの横幅を押し広げない"
          : `カードプロジェクト${index}`,
      nextStep:
        index % 2 === 0
          ? undefined
          : {
              ...template.nextStep!,
              text: "長い次の一手でも二行以内に収まり、操作ボタンの位置を変えないことを確認する",
            },
    });
  }
  await prepare(page, fixture);

  const cards = page.locator(".nextStepCard");
  await expect(cards).toHaveCount(6);
  expect(
    await page
      .locator(".projectGrid")
      .evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length),
  ).toBe(3);
  const configuredAction = page
    .locator(".nextStepCard", { hasText: template.nextStep!.text })
    .getByRole("button", { name: "変更" });
  const unsetAction = page
    .locator(".nextStepCard", { hasText: "まだ次の一手がありません" })
    .getByRole("button", { name: "次の一手を設定" })
    .first();
  const configuredBox = (await configuredAction.boundingBox())!;
  const unsetBox = (await unsetAction.boundingBox())!;
  const unsetPlaceholder = page
    .locator(".nextStepCard", { hasText: "まだ次の一手がありません" })
    .locator(".projectNextStepPlaceholder")
    .first();
  await expect(unsetPlaceholder).toHaveCSS("border-style", "dashed");
  await expect(unsetPlaceholder).toHaveCSS("font-style", "normal");
  await expect(unsetPlaceholder).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  expect(
    Math.abs(configuredBox.y + configuredBox.height - (unsetBox.y + unsetBox.height)),
  ).toBeLessThan(1);
  const configuredCard = page.locator(".nextStepCard", { hasText: template.nextStep!.text });
  const cardBox = (await configuredCard.boundingBox())!;
  expect(cardBox.height).toBe(120);
  const projectBox = (await configuredCard.locator(".nextStepProjectRegion").boundingBox())!;
  const taskBox = (await configuredCard.locator(".nextStepActionRegion p").boundingBox())!;
  const projectDotBox = (await configuredCard.locator(".projectIdentityDot").boundingBox())!;
  expect(projectBox.x - cardBox.x).toBeLessThanOrEqual(14);
  expect(Math.abs(taskBox.x - (projectDotBox.x + projectDotBox.width / 2))).toBeLessThanOrEqual(1);
  const menuBox = (await configuredCard.locator(".nextStepRegionMenu").boundingBox())!;
  expect(menuBox.width).toBe(28);
  expect(menuBox.height).toBe(28);
  expect(Math.abs(menuBox.x + menuBox.width - (cardBox.x + cardBox.width - 4))).toBeLessThanOrEqual(
    1,
  );
  expect(Math.abs(menuBox.y - (cardBox.y + 4))).toBeLessThanOrEqual(1);
  expect(
    Math.abs(configuredBox.y + configuredBox.height - (cardBox.y + cardBox.height - 7)),
  ).toBeLessThanOrEqual(1);
  const todayCard = page.locator(".todayRow", { hasText: template.nextStep!.text });
  const typography = await page.evaluate(() => {
    const read = (selector: string) => {
      const style = getComputedStyle(document.querySelector<HTMLElement>(selector)!);
      return {
        color: style.color,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        lineHeight: style.lineHeight,
      };
    };
    return {
      nextProject: read(".nextStepCard .nextStepProjectRegion .projectIdentity"),
      todayProject: read(".todayRow .todayProjectIdentity .projectIdentity"),
      nextTask: read(".nextStepCard .nextStepActionRegion p"),
      todayTask: read(".todayRow .todayTextButton"),
    };
  });
  expect(typography.nextProject).toEqual(typography.todayProject);
  expect(typography.nextTask).toEqual(typography.todayTask);
  await expect(todayCard).toBeVisible();
  await expect(page.getByRole("button", { name: "＋ 残り2件を表示" })).toBeVisible();
  await page.getByRole("button", { name: "＋ 残り2件を表示" }).click();
  await expect(cards).toHaveCount(8);
  await page.getByRole("button", { name: "− 折りたたむ" }).click();
  await expect(cards).toHaveCount(6);

  await page.setViewportSize({ width: 1000, height: 900 });
  expect(
    await page
      .locator(".projectGrid")
      .evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length),
  ).toBe(2);
  await page.setViewportSize({ width: 620, height: 900 });
  expect(
    await page
      .locator(".projectGrid")
      .evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length),
  ).toBe(1);
});

test("v1.3 Wishlist project groups reorder independently and expose Project edit", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  const first = fixture.config.projects[0];
  const second = fixture.config.projects[1];
  fixture.config.inbox = [
    { id: "group-first", text: "一番目の項目", projectId: first.id },
    { id: "group-second", text: "二番目の項目", projectId: second.id },
  ];
  await prepare(page, fixture);
  const firstHeader = page.locator(".wishlistGroupHeader", { hasText: first.name });
  const secondHeader = page.locator(".wishlistGroupHeader", { hasText: second.name });
  await secondHeader.scrollIntoViewIfNeeded();
  const from = (await secondHeader.boundingBox())!;
  const to = (await firstHeader.boundingBox())!;

  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 2 });
  await expect(page.locator(".wishlistGroupDragGhost")).toBeVisible();
  await page.mouse.move(to.x + to.width / 2, to.y + 3, { steps: 5 });
  await expect(page.locator(".wishlistGroupDropIndicator")).toBeVisible();
  await page.mouse.up();
  await expect.poll(async () => (await currentConfig(page)).inbox[0]?.id).toBe("group-second");
  expect((await currentConfig(page)).projects.map(({ id }) => id)).toEqual(
    fixture.config.projects.map(({ id }) => id),
  );

  await page.locator(".wishlistGroupHeader", { hasText: second.name }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを編集" }).click();
  await expect(page.getByRole("dialog", { name: "プロジェクトを編集" })).toBeVisible();
});

test("v1.3 Wishlist item drop sets or replaces a NextStep and returns the old one", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  const project = fixture.config.projects[0];
  const oldText = project.nextStep!.text;
  fixture.config.inbox = [
    {
      id: "drop-to-next-step",
      text: "ドロップして設定する次の一手",
      projectId: project.id,
      buttonIds: ["sample-button"],
    },
  ];
  await prepare(page, fixture);
  const source = page.locator('[data-inbox-id="drop-to-next-step"]');
  const target = page.locator(`.nextStepCard[data-project-id="${project.id}"]`);
  await source.scrollIntoViewIfNeeded();
  const from = (await source.boundingBox())!;
  const to = (await target.boundingBox())!;

  await page.mouse.move(from.x + 20, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 32, from.y + from.height / 2, { steps: 2 });
  await expect(page.locator(".projectsBand.sourceReturnBand--target")).toBeVisible();
  await expect(page.locator(".projectsBand .sourceReturnDropZone")).toContainText(
    "ここにドロップして次の一手を設定する",
  );
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await expect(target).toHaveClass(/nextStepCard--dropTarget/);
  await page.mouse.up();

  await expect
    .poll(
      async () =>
    (await currentConfig(page)).projects.find(({ id }) => id === project.id)?.nextStep?.text,
    )
    .toBe("ドロップして設定する次の一手");
  const saved = await currentConfig(page);
  expect(saved.inbox.some(({ id }) => id === "drop-to-next-step")).toBe(false);
  expect(
    saved.inbox.some(({ text, projectId }) => text === oldText && projectId === project.id),
  ).toBe(true);
  expect(saved.projects[0].nextStep?.buttonIds).toEqual(["sample-button"]);
});
