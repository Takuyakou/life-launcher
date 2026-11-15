import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture, width = 1280, height = 900) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".focusBand")).toBeVisible();
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

async function setSaveFailure(page: Page, shouldFail: boolean) {
  await page.evaluate((value) => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          setSaveConfigFailure: (next: boolean) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(value);
  }, shouldFail);
}

function picker(page: Page) {
  return page.getByRole("dialog", { name: "今日やるものを選ぶ" });
}

for (const count of [0, 2]) {
  test(`P84-01 Today ${count}/3 exposes the Picker entry and removes the permanent Builder`, async ({
    page,
  }) => {
    const fixture = createPublicFixture();
    fixture.config.today.items = fixture.config.today.items.slice(0, count);
    await prepare(page, fixture);

    await expect(page.locator(".todayBuilderBand")).toHaveCount(0);
    const entry = page.getByRole("button", { name: "今日やるものを選ぶ" });
    await expect(entry).toBeVisible();
    await entry.click();
    const dialog = picker(page);
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-today-picker-section="next-step"]')).toBeVisible();
    await expect(dialog.locator('[data-today-picker-section="wishlist"]')).toBeVisible();
    await expect(dialog.locator('[data-today-picker-section="selected"]')).toBeVisible();
    await expect(dialog.locator(".todayPickerSlot")).toHaveCount(3);
    await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(count);
    await expect(dialog.locator(".todayPickerSlot--empty")).toHaveCount(3 - count);
  });
}

test("P84 Picker entry matches Today card height in the two-column small window", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 2);
  await prepare(page, fixture, 1000);

  const card = page.locator(".todayRow").first();
  const entry = page.locator(".todayPickerEntry");
  const visual = entry.locator(".todayPickerEntryVisual");
  const cardBox = await card.boundingBox();
  const entryBox = await entry.boundingBox();
  const visualBox = await visual.boundingBox();
  expect(cardBox).not.toBeNull();
  expect(entryBox).not.toBeNull();
  expect(visualBox).not.toBeNull();
  // P10-14e: the Picker entry keeps the card's height within a few pixels.
  expect(Math.abs(entryBox!.height - cardBox!.height)).toBeLessThanOrEqual(4);
  expect(visualBox!.width).toBeLessThan(entryBox!.width * 0.6);
  expect(visualBox!.height).toBeLessThan(entryBox!.height);

  await entry.click({ position: { x: 8, y: 8 } });
  await expect(picker(page)).toBeVisible();
});

test("P84 Picker lists Wishlist rows flat with their Project name", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.inbox.push({
    id: "sample-weekend-2",
    text: "同じプロジェクトの候補",
    projectId: "sample-learning",
  });
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  await expect(dialog.locator(".todayPickerWishlistGroupHeader")).toHaveCount(0);
  const wishlistRows = dialog.locator('[data-today-picker-section="wishlist"] .todayPickerRow');
  await expect(wishlistRows).toHaveCount(3);
  await expect(wishlistRows.nth(0).locator(".todayPickerProject")).toContainText("サンプル学習");
  await expect(wishlistRows.nth(1).locator(".todayPickerProject")).toContainText("サンプル学習");
  await expect(wishlistRows.nth(2).locator(".todayPickerProject")).toContainText("未分類");
  await expect(dialog.getByRole("button", { name: "キャンセル" })).toHaveClass(/dangerButton/);
});

test("Picker adoption preserves NextStep and Wishlist snapshots across reopening", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.today.candidateExcludedSourceKeys = ["project:sample-learning", "wishlist:sample-later"];
  const before = structuredClone(fixture.config);
  const source = before.projects[0];
  const wish = before.inbox[0];
  await prepare(page, fixture);
  const entry = page.getByRole("button", { name: "今日やるものを選ぶ" });
  await entry.click();
  let dialog = picker(page);
  await dialog.locator(".todayPickerRow", { hasText: source.nextStep!.text })
    .getByRole("button", { name: "今日へ" }).click();

  let selected = dialog.locator('[data-today-picker-section="selected"]');
  const nextStep = selected.locator(".todayPickerRow", { hasText: source.nextStep!.text });
  await expect(nextStep.locator(".todayPickerSlotProject")).toHaveText(source.name);
  await expect(nextStep.locator(".todayPickerSlotTask")).toHaveText(source.nextStep!.text);
  await expect(nextStep.locator(".todayPickerSelectedStatus")).toHaveCount(0);
  await expect(
    dialog
      .locator('[data-today-picker-section="next-step"] .todayPickerRow', {
        hasText: source.nextStep!.text,
      })
      .locator(".todayPickerSelectedStatus"),
  ).toHaveText("✓ 選択済み");
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(1);
  await expect(dialog.locator(".todayPickerSlot--empty")).toHaveCount(2);
  expect((await currentConfig(page)).today.items).toHaveLength(0);
  await dialog.getByRole("button", { name: "決定", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".todayRow")).toHaveCount(1);
  expect((await currentConfig(page)).today.items[0]).toMatchObject({
    text: source.nextStep!.text,
    sourceKey: `project:${source.id}`,
    projectId: source.id,
    trigger: source.nextStep!.trigger,
    buttonIds: source.nextStep!.buttonIds,
    instructionPath: source.nextStep!.instructionPath,
    instructionOpenOnStart: false,
    defaultTimerMinutes: source.nextStep!.defaultTimerMinutes,
    shortTimerMinutes: source.nextStep!.shortTimerMinutes,
  });
  await entry.click();
  dialog = picker(page);
  selected = dialog.locator('[data-today-picker-section="selected"]');
  await expect(selected).toContainText(source.nextStep!.text);
  await expect(
    dialog.locator('[data-today-picker-section="next-step"] .todayPickerSelectedStatus'),
  ).toHaveText("✓ 選択済み");
  await dialog.locator('[data-today-picker-section="wishlist"] .todayPickerRow', { hasText: wish.text })
    .getByRole("button", { name: "今日へ" }).click();
  await expect(selected).toContainText(wish.text);
  await expect(
    dialog.locator('[data-today-picker-section="next-step"] .todayPickerSelectedStatus, [data-today-picker-section="wishlist"] .todayPickerSelectedStatus'),
  ).toHaveCount(2);
  await expect(dialog.locator('[data-today-picker-section="wishlist"]')).toContainText(wish.text);
  await dialog.getByRole("button", { name: "決定", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await entry.click();
  await expect(picker(page).locator('[data-today-picker-section="selected"]')).toContainText(wish.text);
  await expect(picker(page).locator('[data-today-picker-section="wishlist"]')).toContainText(wish.text);
  const saved = await currentConfig(page);
  expect(saved.projects).toEqual(before.projects);
  expect(saved.inbox).toEqual(before.inbox);
  expect(saved.today.items[1]).toMatchObject({ text: wish.text, sourceKey: `wishlist:${wish.id}` });
  expect(new Set(saved.today.items.map((item) => item.sourceKey)).size).toBe(2);
});

test("P84-01 reaching 3/3 keeps the Picker open until 決定 saves the order", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);

  const entry = page.getByRole("button", { name: "今日やるものを選ぶ" });
  await entry.click();
  const dialog = picker(page);
  await expect(
    dialog.locator('[data-today-picker-section="selected"] .todayPickerRow'),
  ).toHaveCount(2);
  await dialog
    .locator(".todayPickerRow", { hasText: "5分だけ体を動かす" })
    .getByRole("button", { name: "今日へ" })
    .click();

  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(3);
  await expect(dialog.locator(".todayPickerSlot--empty")).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toHaveLength(2);

  await dialog.getByRole("button", { name: "決定", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".todayRow")).toHaveCount(3);
  const completionToast = page.locator(".toast", { hasText: "今日の3件を選択しました" });
  await expect(completionToast).toHaveClass(/toast--ok/);
  const saved = await currentConfig(page);
  expect(saved.today.items).toHaveLength(3);
  expect(new Set(saved.today.items.map((item) => item.sourceKey)).size).toBe(3);
  await expect(entry).toHaveCount(0);
  await expect(page.locator(".todayBuilderBand")).toHaveCount(0);
  await page.reload();
  await expect(page.locator(".todayRow")).toHaveCount(3);
  await expect(page.getByRole("button", { name: "今日やるものを選ぶ", exact: true })).toHaveCount(0);
});

test("P84 Picker keeps backdrop clicks inert and discards the draft on confirmed cancel", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  await dialog
    .locator(".todayPickerRow", { hasText: "5分だけ体を動かす" })
    .getByRole("button", { name: "今日へ" })
    .click();
  expect((await currentConfig(page)).today.items).toHaveLength(0);

  await page.locator(".modalBackdrop").click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(1);

  await dialog.getByRole("button", { name: "キャンセル" }).click();
  const confirmation = page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" });
  await expect(confirmation.getByRole("button", { name: "戻る" })).toBeFocused();
  await confirmation.getByRole("button", { name: "戻る" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(1);

  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await page.getByRole("button", { name: "破棄して閉じる" }).click();
  await expect(dialog).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toHaveLength(0);
});

test("P84 Picker removes selected cards by keyboard without resizing and updates progress", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  fixture.config.projects[0].name =
    "選択枠で長いプロジェクト名が省略されても解除操作を守るプロジェクト";
  fixture.config.today.items[0].text =
    "選択枠でとても長いタスク名が省略されても今日から外す操作は右下に残る";
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const dialogBoxBefore = await dialog.boundingBox();
  await expect(dialog.locator(".todayPickerCounter")).toContainText("1 / 3");

  const selectedCard = dialog.locator(".todayPickerSlot--selected");
  await expect(selectedCard).toHaveAttribute("draggable", "true");
  await expect(dialog.locator(".todayPickerRemoveDropZone")).toHaveCount(0);
  await expect(dialog.getByText(/ここにドロップして今日の3件から外す/)).toHaveCount(0);
  const removeButton = dialog.getByRole("button", { name: "今日から外す", exact: true });
  const cardBox = await selectedCard.boundingBox();
  const removeBox = await removeButton.boundingBox();
  expect(cardBox && removeBox).toBeTruthy();
  expect(removeBox!.x).toBeGreaterThan(cardBox!.x + cardBox!.width / 2);
  expect(removeBox!.x + removeBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width);
  expect(removeBox!.y + removeBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height);

  await removeButton.focus();
  await expect(removeButton).toBeFocused();
  await removeButton.press("Space");
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(0);
  const dialogBoxAfter = await dialog.boundingBox();
  expect(Math.abs(dialogBoxAfter!.height - dialogBoxBefore!.height)).toBeLessThanOrEqual(1);
  expect((await currentConfig(page)).today.items).toHaveLength(1);
  await expect(dialog.locator(".todayPickerCounter")).toContainText("0 / 3");
  await dialog.getByRole("button", { name: "決定" }).click();
  await expect(dialog).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toHaveLength(0);
});

test("P84-01 save failure on 決定 keeps the Picker and its draft usable", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  await dialog
    .locator(".todayPickerRow", { hasText: "5分だけ体を動かす" })
    .getByRole("button", { name: "今日へ" })
    .click();
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(1);
  expect((await currentConfig(page)).today.items).toHaveLength(0);

  await setSaveFailure(page, true);
  await dialog.getByRole("button", { name: "決定", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(1);
  await expect(page.locator(".toast", { hasText: "保存できません" })).toBeVisible();
  expect((await currentConfig(page)).today.items).toHaveLength(0);

  await setSaveFailure(page, false);
  await dialog.getByRole("button", { name: "決定", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toHaveLength(1);
});

test("P84-01 Escape closes the Picker and returns focus to its entry", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  const entry = page.getByRole("button", { name: "今日やるものを選ぶ" });
  await entry.focus();
  await entry.press("Enter");
  const dialog = picker(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "今日やるものを選ぶを閉じる" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(entry).toBeFocused();
});

test("P84 Picker aligns project, task, and action columns with readable long content", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].name = "とても長いプロジェクト名を表示幅の中で安全に省略する確認用";
  fixture.config.inbox[0].text =
    "長い候補名でもタスク列と操作列が重ならず二行まで読めることを確認する";
  await prepare(page, fixture, 1280);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const nextStepTaskXs = await dialog
    .locator('[data-today-picker-section="next-step"] .todayPickerTask')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().x));
  expect(Math.max(...nextStepTaskXs) - Math.min(...nextStepTaskXs)).toBeLessThanOrEqual(1);
  const nextStepActionRights = await dialog
    .locator('[data-today-picker-section="next-step"] .todayPickerRow > button')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().right));
  expect(Math.max(...nextStepActionRights) - Math.min(...nextStepActionRights)).toBeLessThanOrEqual(
    1,
  );

  const wishlistTaskXs = await dialog
    .locator('[data-today-picker-section="wishlist"] .todayPickerTask')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().x));
  expect(Math.max(...wishlistTaskXs) - Math.min(...wishlistTaskXs)).toBeLessThanOrEqual(1);
  expect(Math.abs(wishlistTaskXs[0] - nextStepTaskXs[0])).toBeLessThanOrEqual(1);
  const wishlistActionRights = await dialog
    .locator('[data-today-picker-section="wishlist"] .todayPickerRow > button')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().right));
  expect(Math.max(...wishlistActionRights) - Math.min(...wishlistActionRights)).toBeLessThanOrEqual(
    1,
  );
  const [confirmBox, cancelBox, dialogBox] = await Promise.all([
    dialog.getByRole("button", { name: "決定", exact: true }).boundingBox(),
    dialog.getByRole("button", { name: "キャンセル", exact: true }).boundingBox(),
    dialog.boundingBox(),
  ]);
  expect(confirmBox && cancelBox && dialogBox).toBeTruthy();
  // P10-14e (4): the footer is a two-column row; キャンセル sits to the right of 決定.
  expect(cancelBox!.x).toBeGreaterThan(confirmBox!.x + confirmBox!.width);
  expect(Math.abs(cancelBox!.y - confirmBox!.y)).toBeLessThanOrEqual(1);
  expect(cancelBox!.x + cancelBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width);
});

test("P84 Picker keeps the selected Wishlist row visible with its ✓", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const heightBefore = (await dialog.boundingBox())!.height;
  const row = dialog.locator('[data-today-picker-section="wishlist"] .todayPickerRow', {
    hasText: "あとで確認するサンプル",
  });
  await row.getByRole("button", { name: "今日へ" }).click();
  await expect(row.locator(".todayPickerSelectedStatus")).toHaveText("✓ 選択済み");
  await expect(
    dialog
      .locator('[data-today-picker-section="selected"] .todayPickerRow', {
        hasText: "あとで確認するサンプル",
      })
      .locator(".todayPickerSlotTask"),
  ).toHaveText("あとで確認するサンプル");
  expect(Math.abs((await dialog.boundingBox())!.height - heightBefore)).toBeLessThanOrEqual(1);
  expect((await currentConfig(page)).today.items).toHaveLength(0);
  await dialog.getByRole("button", { name: "決定" }).click();
  await expect(dialog).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toHaveLength(1);
});

test("P84 Picker remains contained and keeps actions visible at narrow width", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  fixture.config.projects[0].name = "長いプロジェクト名の狭幅表示確認";
  const longAction = "長い日本語の候補でもボタンと重ならず今日やる一手として最後まで確認できるようにする";
  fixture.config.projects[1].nextStep!.text = longAction;
  await prepare(page, fixture, 520);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const dialogBox = await dialog.boundingBox();
  const actionBoxes = await dialog
    .locator(".todayPickerRow > button")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
  expect(dialogBox).not.toBeNull();
  expect(actionBoxes.length).toBeGreaterThan(0);
  expect(actionBoxes.every((box) => box.left >= dialogBox!.x && box.right <= dialogBox!.x + dialogBox!.width + 1)).toBe(true);
  const longCandidate = dialog.locator(".todayPickerRow", { hasText: longAction });
  await expect(longCandidate.locator(".todayPickerTask")).toHaveText(longAction);
  const taskBox = await longCandidate.locator(".todayPickerCopy").boundingBox();
  const addBox = await longCandidate.getByRole("button", { name: "今日へ" }).boundingBox();
  expect(taskBox && addBox).toBeTruthy();
  expect(taskBox!.x + taskBox!.width).toBeLessThanOrEqual(addBox!.x + 1);
  const removeButton = dialog.getByRole("button", { name: "今日から外す", exact: true });
  await expect(removeButton).toBeVisible();
  await expect(removeButton).toBeInViewport();
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
});

test("P84 Picker keeps both columns and a scrollable candidate list in a small window", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  for (let index = 0; index < 8; index += 1) {
    fixture.config.inbox.push({
      id: `mini-overflow-${index}`,
      text: `ミニ画面の位置揃え候補 ${index + 1}`,
      projectId: fixture.config.projects[index % fixture.config.projects.length].id,
    });
  }
  await prepare(page, fixture, 740, 600);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const panel = dialog.locator(".todayPickerSource");
  expect(await panel.evaluate((node) => node.scrollHeight > node.clientHeight)).toBe(true);

  const [destinationBox, sourceBox, cancelBox, dialogBox] = await Promise.all([
    dialog.locator(".todayPickerDestination").boundingBox(),
    dialog.locator(".todayPickerSource").boundingBox(),
    dialog.getByRole("button", { name: "キャンセル", exact: true }).boundingBox(),
    dialog.boundingBox(),
  ]);
  expect(destinationBox && sourceBox && cancelBox && dialogBox).toBeTruthy();
  expect(destinationBox!.x).toBeGreaterThan(sourceBox!.x + sourceBox!.width);
  expect(Math.abs(destinationBox!.y - sourceBox!.y)).toBeLessThanOrEqual(2);
  expect(cancelBox!.x + cancelBox!.width).toBeLessThanOrEqual(dialogBox!.x + dialogBox!.width);
  expect(cancelBox!.y + cancelBox!.height).toBeLessThanOrEqual(dialogBox!.y + dialogBox!.height);
});

test("P84 Picker keeps every selected NextStep visible with ✓", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.projects.map((project) => ({
    text: project.nextStep!.text,
    done: false,
    sourceKey: `project:${project.id}`,
    projectId: project.id,
  }));
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const nextStep = picker(page).locator('[data-today-picker-section="next-step"]');
  await expect(nextStep.locator(".todayPickerRow")).toHaveCount(2);
  await expect(nextStep.locator(".todayPickerSelectedStatus")).toHaveCount(2);
  await expect(nextStep.locator(".todayPickerAddButton")).toHaveCount(0);
  await expect(nextStep).not.toContainText("追加できる次の一手はありません");
});
test("P84 Picker shows both source groups without tabs on every open", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  const entry = page.getByRole("button", { name: "今日やるものを選ぶ" });
  await entry.click();
  let dialog = picker(page);
  // P10-14d (P1): the picker no longer has source tabs.
  await expect(dialog.getByRole("tab")).toHaveCount(0);
  await expect(dialog.locator(".todayPickerSourceGroup")).toHaveCount(2);
  await expect(dialog.locator('[data-today-picker-section="next-step"]')).toBeVisible();
  await expect(dialog.locator('[data-today-picker-section="wishlist"]')).toBeVisible();
  await expect(dialog.locator('[data-today-picker-section="selected"]')).toBeVisible();

  await dialog.getByRole("button", { name: "今日やるものを選ぶを閉じる" }).click();
  await entry.click();
  dialog = picker(page);
  await expect(dialog.getByRole("tab")).toHaveCount(0);
  await expect(dialog.locator('[data-today-picker-section="next-step"]')).toBeVisible();
  await expect(dialog.locator('[data-today-picker-section="wishlist"]')).toBeVisible();
});

test("P84 add dialogs expose a consistent top-right close action", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].nextStep = undefined;
  await prepare(page, fixture);

  const projectOpener = page.getByRole("button", { name: "プロジェクトを追加", exact: true });
  await projectOpener.click();
  const projectDialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await projectDialog.getByRole("button", { name: "プロジェクトを追加を閉じる" }).click();
  await expect(projectDialog).toHaveCount(0);
  await expect(projectOpener).toBeFocused();

  const wishlistOpener = page.getByRole("button", { name: "やりたいことを追加", exact: true });
  await wishlistOpener.click();
  const wishlistDialog = page.getByRole("dialog", { name: "やりたいことを追加" });
  await wishlistDialog.getByRole("button", { name: "やりたいことを追加を閉じる" }).click();
  await expect(wishlistDialog).toHaveCount(0);
  await expect(wishlistOpener).toBeFocused();

  const nextStepOpener = page.getByRole("button", { name: "次の一手を設定", exact: true });
  await nextStepOpener.click();
  const nextStepDialog = page.getByRole("dialog", { name: "次の一手を設定" });
  await nextStepDialog.getByRole("tab", { name: "＋ 新しく入力" }).click();
  await nextStepDialog.getByRole("button", { name: "次の一手を設定を閉じる" }).click();
  await expect(nextStepDialog).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" })).toHaveCount(0);
  await expect(nextStepOpener).toBeFocused();
});

test("Initially completed Today cards stay visible and offer a batch only when all three are done", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [
    { text: "資料を1ページ読む", done: true, sourceKey: "project:sample-learning", projectId: "sample-learning" },
    { text: "5分だけ体を動かす", done: true, sourceKey: "project:sample-stretch", projectId: "sample-stretch" },
    { text: "あとで確認するサンプル", done: true, sourceKey: "wishlist:sample-later" },
  ];
  await prepare(page, fixture);
  await expect(page.locator(".todayRow")).toHaveCount(3);
  await expect(page.locator(".todayRow--complete")).toHaveCount(3);
  await expect(page.getByText("今日の分は完了", { exact: true })).toHaveCount(3);
  await expect(page.locator(".todayRow .todayStartButton")).toHaveCount(0);
  await expect(page.locator(".todayCompletionSummary")).toHaveText("3 / 3 完了");
  const nextBatch = page.getByRole("button", { name: "次の3件を選ぶ" });
  await expect(nextBatch).toBeVisible();
  await expect(page.locator(".todayRow--justCompleted, .todayAllCompletionReward")).toHaveCount(0);
  await page.locator(".todayRemoveButton").last().click();
  await expect(page.locator(".todayRow--complete")).toHaveCount(2);
  await expect(page.locator(".todayCompletionSummary")).toHaveText("2 / 2 完了");
  await expect(nextBatch).toHaveCount(0);
});
