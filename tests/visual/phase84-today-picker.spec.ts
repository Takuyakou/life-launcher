import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture, width = 1280) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
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

for (const count of [0, 1, 2]) {
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
    await expect(dialog.locator("[data-today-picker-section]")).toHaveCount(2);
    await expect(dialog.locator(".todayPickerSlot")).toHaveCount(3);
    await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(count);
    await expect(dialog.locator(".todayPickerSlot--empty")).toHaveCount(3 - count);
    await dialog.screenshot({ path: `dist/visual-qa/phase84/picker-${count}-of-3.png` });
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
  expect(entryBox!.height).toBeGreaterThanOrEqual(154);
  expect(Math.abs(entryBox!.height - cardBox!.height)).toBeLessThanOrEqual(2);
  expect(visualBox!.width).toBeLessThan(entryBox!.width * 0.6);
  expect(visualBox!.height).toBeLessThan(entryBox!.height);

  await entry.click({ position: { x: 8, y: 8 } });
  await expect(picker(page)).toBeVisible();
});

test("P84-01 Today 3/3 does not expose the Picker entry", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items.push({
    text: "満杯の確認",
    done: false,
    sourceKey: "manual:full",
  });
  await prepare(page, fixture);

  await expect(page.getByRole("button", { name: "今日やるものを選ぶ" })).toHaveCount(0);
  await expect(page.locator(".todayBuilderBand")).toHaveCount(0);
});

test("P84-01 Picker shows NextStep and Wishlist candidates and ignores legacy dismissal", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.today.candidateExcludedSourceKeys = [
    "project:sample-stretch",
    "wishlist:sample-later",
  ];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  await expect(dialog.getByRole("tab", { name: /次の一手/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(dialog).toContainText("5分だけ体を動かす");
  await dialog.getByRole("tab", { name: /やりたいこと/ }).click();
  await expect(dialog).toContainText("あとで確認するサンプル");
});

test("P84 Picker groups Wishlist by project, starts expanded, and uses a danger cancel", async ({
  page,
}) => {
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
  await dialog.getByRole("tab", { name: /やりたいこと/ }).click();
  const addButton = dialog.locator(".todayPickerAddButton").first();
  const addButtonStyle = await addButton.evaluate((node) => {
    const styles = getComputedStyle(node);
    return {
      borderRadius: styles.borderRadius,
      fontSize: styles.fontSize,
      width: node.getBoundingClientRect().width,
    };
  });
  expect(addButtonStyle).toEqual({ borderRadius: "8px", fontSize: "11px", width: 96 });
  const projectGroup = dialog.locator(
    '[data-today-picker-wishlist-group="project:sample-learning"]',
  );
  const header = projectGroup.locator(".todayPickerWishlistGroupHeader");
  await expect(header).toHaveAttribute("aria-expanded", "true");
  await expect(projectGroup.locator(".todayPickerRow")).toHaveCount(2);
  await expect(header).toContainText("サンプル学習");
  await expect(header).toContainText("2件");

  await header.click();
  await expect(header).toHaveAttribute("aria-expanded", "false");
  await expect(projectGroup.locator(".todayPickerRow")).toHaveCount(0);
  await expect(dialog.getByRole("button", { name: "キャンセル" })).toHaveClass(/dangerButton/);
});

test("P84-01 selection preserves source and snapshot while marking the candidate selected", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  const source = fixture.config.projects.find((project) => project.id === "sample-learning")!;
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const row = dialog.locator(".todayPickerRow", { hasText: source.nextStep!.text });
  await row.getByRole("button", { name: "今日へ" }).click();

  const selectedSection = dialog.locator('[data-today-picker-section="selected"]');
  const nextStepSection = dialog.locator('[data-today-picker-section="next-step"]');
  await expect(
    selectedSection.locator(".todayPickerRow", { hasText: source.nextStep!.text }),
  ).toContainText("✓ 選択済み");
  await expect(
    nextStepSection.locator(".todayPickerRow", { hasText: source.nextStep!.text }),
  ).toHaveCount(0);
  const config = await currentConfig(page);
  expect(config.projects.find((project) => project.id === source.id)?.nextStep?.text).toBe(
    source.nextStep!.text,
  );
  expect(config.today.items[0]).toMatchObject({
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
});

test("P84-01 reaching 3/3 closes the Picker after the saved third selection", async ({ page }) => {
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

  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".todayRow")).toHaveCount(3);
  const completionToast = page.locator(".toast", { hasText: "今日の3件を選択しました" });
  await expect(completionToast).toHaveClass(/toast--ok/);
  expect((await currentConfig(page)).today.items).toHaveLength(3);
});

test("P84 Picker keeps backdrop clicks inert and restores the opening snapshot on confirmed cancel", async ({
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
  expect((await currentConfig(page)).today.items).toHaveLength(1);

  await page.locator(".modalBackdrop").click({ position: { x: 2, y: 2 } });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(1);

  await dialog.getByRole("button", { name: "キャンセル" }).click();
  const confirmation = page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" });
  await expect(confirmation.getByRole("button", { name: "戻る" })).toBeFocused();
  await confirmation.getByRole("button", { name: "戻る" }).click();
  await expect(dialog).toBeVisible();

  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await page.getByRole("button", { name: "破棄して閉じる" }).click();
  await expect(dialog).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toHaveLength(0);
});

test("P84 Picker removes selected cards directly and exposes a longer green progress indicator", async ({
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
  const progress = dialog.locator(".todayPickerProgress");
  const progressBox = await progress.boundingBox();
  const counterBox = await dialog.locator(".todayPickerCounter").boundingBox();
  expect(dialogBoxBefore?.height).toBeGreaterThanOrEqual(718);
  expect(dialogBoxBefore?.height).toBeLessThanOrEqual(722);
  expect(progressBox?.width).toBeGreaterThanOrEqual(220);
  expect(progressBox && counterBox).toBeTruthy();
  expect(progressBox!.x + progressBox!.width).toBeLessThanOrEqual(counterBox!.x);
  await expect(progress).toHaveAttribute("aria-valuenow", "1");

  const selectedCard = dialog.locator(".todayPickerSlot--selected");
  const removeButton = dialog.getByRole("button", { name: "今日から外す", exact: true });
  const cardBox = await selectedCard.boundingBox();
  const removeBox = await removeButton.boundingBox();
  expect(cardBox && removeBox).toBeTruthy();
  expect(removeBox!.x + removeBox!.width).toBeLessThanOrEqual(cardBox!.x + cardBox!.width - 5);
  expect(removeBox!.y + removeBox!.height).toBeLessThanOrEqual(cardBox!.y + cardBox!.height - 5);
  expect(removeBox!.y).toBeGreaterThan(cardBox!.y + cardBox!.height / 2);
  expect(await removeButton.evaluate((node) => getComputedStyle(node).whiteSpace)).toBe("nowrap");
  expect(cardBox!.height).toBeGreaterThanOrEqual(90);
  expect(removeBox!.height).toBeGreaterThanOrEqual(30);
  expect(removeBox!.height).toBeLessThanOrEqual(32);
  const baseStyle = await removeButton.evaluate((node) => {
    const style = getComputedStyle(node);
    return { backgroundColor: style.backgroundColor, borderColor: style.borderColor };
  });
  await removeButton.hover();
  await page.waitForTimeout(140);
  const hoverStyle = await removeButton.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      backgroundColor: style.backgroundColor,
      borderColor: style.borderColor,
      transform: style.transform,
    };
  });
  expect(hoverStyle.backgroundColor).not.toBe(baseStyle.backgroundColor);
  expect(hoverStyle.borderColor).not.toBe(baseStyle.borderColor);
  expect(hoverStyle.transform).not.toBe("none");
  await removeButton.focus();
  await expect(removeButton).toBeFocused();
  await removeButton.press("Space");
  await expect(dialog.locator(".todayPickerSlot--selected")).toHaveCount(0);
  const dialogBoxAfter = await dialog.boundingBox();
  expect(Math.abs(dialogBoxAfter!.height - dialogBoxBefore!.height)).toBeLessThanOrEqual(1);
  expect((await currentConfig(page)).today.items).toHaveLength(0);
  await dialog.getByRole("button", { name: "決定" }).click();
  await expect(dialog).toHaveCount(0);
});

test("P84 Picker removal is button-only and exposes no drag-and-drop affordance", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const selectedCard = dialog.locator(".todayPickerSlot--selected");
  await expect(selectedCard).not.toHaveAttribute("draggable", "true");
  await expect(dialog.locator(".todayPickerRemoveDropZone")).toHaveCount(0);
  await expect(dialog.getByText(/ここにドロップして今日の3件から外す/)).toHaveCount(0);
});

test("P84-01 save failure rolls back and leaves the Picker usable", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  await setSaveFailure(page, true);
  await dialog
    .locator(".todayPickerRow", { hasText: "5分だけ体を動かす" })
    .getByRole("button", { name: "今日へ" })
    .click();

  await expect(dialog).toBeVisible();
  await expect(
    dialog.locator('[data-today-picker-section="selected"] .todayPickerRow'),
  ).toHaveCount(0);
  expect((await currentConfig(page)).today.items).toHaveLength(0);
  await setSaveFailure(page, false);
  await expect(
    dialog
      .locator(".todayPickerRow", { hasText: "5分だけ体を動かす" })
      .getByRole("button", { name: "今日へ" }),
  ).toBeEnabled();
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
    .locator('[data-today-picker-section="next-step"] .todayPickerCopy strong')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().x));
  expect(Math.max(...nextStepTaskXs) - Math.min(...nextStepTaskXs)).toBeLessThanOrEqual(1);
  const nextStepActionRights = await dialog
    .locator('[data-today-picker-section="next-step"] .todayPickerRow > button')
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().right));
  expect(Math.max(...nextStepActionRights) - Math.min(...nextStepActionRights)).toBeLessThanOrEqual(
    1,
  );

  await dialog.getByRole("tab", { name: /やりたいこと/ }).click();
  const wishlistTaskXs = await dialog
    .locator(".todayPickerRow--groupedWishlist .todayPickerCopy strong")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().x));
  expect(Math.max(...wishlistTaskXs) - Math.min(...wishlistTaskXs)).toBeLessThanOrEqual(1);
  expect(wishlistTaskXs[0]).toBeLessThan(nextStepTaskXs[0] - 80);
  const wishlistActionRights = await dialog
    .locator(".todayPickerRow--groupedWishlist > button")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().right));
  expect(Math.max(...wishlistActionRights) - Math.min(...wishlistActionRights)).toBeLessThanOrEqual(
    1,
  );
  const cancelBox = await dialog.getByRole("button", { name: "キャンセル", exact: true }).boundingBox();
  expect(cancelBox).not.toBeNull();
  expect(Math.abs(cancelBox!.x + cancelBox!.width - wishlistActionRights[0])).toBeLessThanOrEqual(16);
  await expect(dialog.locator(".todayPickerRow--groupedWishlist").first()).toHaveCSS(
    "min-height",
    "60px",
  );
  await dialog.screenshot({ path: "dist/visual-qa/phase84/picker-aligned-1280.png" });
});

test("P84 Picker selection preserves collapsed Wishlist groups", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  await dialog.getByRole("tab", { name: /やりたいこと/ }).click();
  const projectHeader = dialog
    .locator('[data-today-picker-wishlist-group="project:sample-learning"]')
    .locator(".todayPickerWishlistGroupHeader");
  await projectHeader.click();
  await expect(projectHeader).toHaveAttribute("aria-expanded", "false");

  await dialog.getByRole("tab", { name: /次の一手/ }).click();
  const row = dialog.locator(".todayPickerRow", { hasText: "5分だけ体を動かす" });
  await row.getByRole("button", { name: "今日へ" }).click();
  await expect(
    dialog
      .locator('[data-today-picker-section="selected"] .todayPickerRow', {
        hasText: "5分だけ体を動かす",
      })
      .getByText("✓ 選択済み"),
  ).toBeVisible();
  await dialog.getByRole("tab", { name: /やりたいこと/ }).click();
  await expect(projectHeader).toHaveAttribute("aria-expanded", "false");
  expect((await currentConfig(page)).today.items).toHaveLength(1);
});

test("P84 Picker remains contained and keeps actions visible at narrow width", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = fixture.config.today.items.slice(0, 1);
  fixture.config.projects[0].name = "長いプロジェクト名の狭幅表示確認";
  await prepare(page, fixture, 520);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const dialogBox = await dialog.boundingBox();
  const actionBoxes = await dialog
    .locator(".todayPickerRow > button")
    .evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect()));
  expect(dialogBox).not.toBeNull();
  expect(actionBoxes.every((box) => box.right <= dialogBox!.x + dialogBox!.width + 1)).toBe(true);
  const removeButton = dialog.getByRole("button", { name: "今日から外す", exact: true });
  await expect(removeButton).toBeVisible();
  expect((await removeButton.boundingBox())!.height).toBeGreaterThanOrEqual(30);
  expect(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
  await dialog.screenshot({ path: "dist/visual-qa/phase84/picker-narrow-520.png" });
});

test("P84 Picker separates selected items from NextStep and Wishlist candidates", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const sections = dialog.locator("[data-today-picker-section]");
  await expect(sections).toHaveCount(2);
  expect(
    await sections.evaluateAll((nodes) =>
      nodes.map((node) => node.getAttribute("data-today-picker-section")),
    ),
  ).toEqual(["selected", "next-step"]);

  const selected = dialog.locator('[data-today-picker-section="selected"]');
  const nextStep = dialog.locator('[data-today-picker-section="next-step"]');
  await expect(selected).toContainText("資料を1ページ読む");
  await expect(selected.getByText("✓ 選択済み")).toHaveCount(2);
  await expect(nextStep).not.toContainText("資料を1ページ読む");
  await expect(nextStep).toContainText("5分だけ体を動かす");
  await dialog.getByRole("tab", { name: /やりたいこと/ }).click();
  const wishlist = dialog.locator('[data-today-picker-section="wishlist"]');
  await expect(wishlist).toContainText("あとで確認するサンプル");
});

test("P84 Picker moves a selected Wishlist item only to Today3", async ({ page }) => {
  const fixture = createPublicFixture();
  const wishlistItem = fixture.config.inbox.find((item) => item.id === "sample-weekend")!;
  fixture.config.today.items = [
    {
      text: wishlistItem.text,
      done: false,
      sourceKey: `wishlist:${wishlistItem.id}`,
      projectId: wishlistItem.projectId,
    },
  ];
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const selected = dialog.locator('[data-today-picker-section="selected"]');
  await dialog.getByRole("tab", { name: /やりたいこと/ }).click();
  const wishlist = dialog.locator('[data-today-picker-section="wishlist"]');
  await expect(selected).toContainText(wishlistItem.text);
  await expect(selected.getByText("✓ 選択済み")).toHaveCount(1);
  await expect(wishlist).not.toContainText(wishlistItem.text);
  await expect(wishlist).toContainText("あとで確認するサンプル");
});

test("P84 Picker shows a clear empty NextStep section when every NextStep is selected", async ({
  page,
}) => {
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
  await expect(nextStep.locator(".todayPickerRow")).toHaveCount(0);
  await expect(nextStep).toContainText("追加できる次の一手はありません");
});
test("P84 Picker source tabs default to NextStep, support arrows, and reset on reopen", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  const entry = page.getByRole("button", { name: "今日やるものを選ぶ" });
  await entry.click();
  let dialog = picker(page);
  const nextTab = dialog.getByRole("tab", { name: /次の一手/ });
  const wishlistTab = dialog.getByRole("tab", { name: /やりたいこと/ });
  await expect(nextTab).toHaveAttribute("aria-selected", "true");
  await expect(dialog.locator('[data-today-picker-section="next-step"]')).toBeVisible();
  await expect(dialog.locator('[data-today-picker-section="wishlist"]')).toHaveCount(0);

  await nextTab.focus();
  await nextTab.press("ArrowRight");
  await expect(wishlistTab).toBeFocused();
  await expect(wishlistTab).toHaveAttribute("aria-selected", "true");
  await expect(dialog.locator('[data-today-picker-section="next-step"]')).toHaveCount(0);
  await expect(dialog.locator('[data-today-picker-section="wishlist"]')).toBeVisible();
  await wishlistTab.press("ArrowLeft");
  await expect(nextTab).toBeFocused();
  await expect(nextTab).toHaveAttribute("aria-selected", "true");

  await dialog.getByRole("button", { name: "今日やるものを選ぶを閉じる" }).click();
  await entry.click();
  dialog = picker(page);
  await expect(dialog.getByRole("tab", { name: /次の一手/ })).toHaveAttribute(
    "aria-selected",
    "true",
  );
});

test("P84 destination slots separate project identity, task, and selected status", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = picker(page);
  const selected = dialog.locator('[data-today-picker-section="selected"]');
  const row = selected.locator(".todayPickerRow").first();
  const status = row.locator(".todayPickerSelectedStatus");
  const projectName = row.locator(".projectIdentity");
  const taskName = row.locator(".todayPickerSlotTask");
  await expect(dialog.locator(".modalTitleRow .eyebrow")).toHaveText("Today");
  await expect(dialog.locator(".modalTitleRow .eyebrow")).toHaveCSS("color", "rgb(184, 176, 160)");
  await expect(dialog.locator(".todayPickerIntro")).toHaveCSS("font-size", "12px");
  await expect(row.locator(".projectIdentityDot")).toHaveCount(1);
  await expect(row).toHaveCSS("border-left-width", "1px");
  expect(
    await row.evaluate((node) => Number.parseFloat(getComputedStyle(node).paddingLeft)),
  ).toBeGreaterThanOrEqual(8);
  await expect(status).toHaveText("✓ 選択済み");
  await expect(status).toHaveCSS("font-size", "10px");
  expect(await status.evaluate((node) => node.tagName)).toBe("SPAN");
  await expect(status).toHaveCSS("border-top-width", "0px");
  expect(await projectName.evaluate((node) => getComputedStyle(node).fontSize)).toBe(
    await taskName.evaluate((node) => getComputedStyle(node).fontSize),
  );
  const confirm = dialog.getByRole("button", { name: "決定" });
  const cancel = dialog.getByRole("button", { name: "キャンセル" });
  expect(await confirm.evaluate((node) => getComputedStyle(node).fontSize)).toBe(
    await cancel.evaluate((node) => getComputedStyle(node).fontSize),
  );
  const confirmBox = await confirm.boundingBox();
  const cancelBox = await cancel.boundingBox();
  expect(confirmBox && cancelBox).toBeTruthy();
  expect(cancelBox!.x - (confirmBox!.x + confirmBox!.width)).toBeGreaterThanOrEqual(11);
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
  await expect(page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" })).toHaveCount(
    0,
  );
  await expect(nextStepOpener).toBeFocused();
});

test("P84 v3 Today add reuses the Project gold grammar in every interaction state", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  await prepare(page, fixture);

  const projectAdd = page.getByRole("button", { name: "プロジェクトを追加" });
  const wishlistAdd = page.getByRole("button", { name: "やりたいことを追加" });
  const style = async (locator: ReturnType<Page["locator"]>) =>
    locator.evaluate((node) => {
      const computed = getComputedStyle(node);
      return {
        backgroundColor: computed.backgroundColor,
        borderColor: computed.borderColor,
        color: computed.color,
      };
    });

  let goldHoverStyle: Awaited<ReturnType<typeof style>> | null = null;
  for (const button of [projectAdd, wishlistAdd]) {
    await button.hover();
    await page.waitForTimeout(140);
    const buttonStyle = await style(button);
    expect(buttonStyle).toEqual({
      backgroundColor: "rgba(231, 185, 77, 0.18)",
      borderColor: "rgb(231, 185, 77)",
      color: "rgb(255, 206, 91)",
    });
    goldHoverStyle ??= buttonStyle;
  }

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const todayAdd = picker(page).getByRole("button", { name: "今日へ" }).first();
  await expect(todayAdd).toHaveClass(/mainActionButton--gold/);
  await todayAdd.hover();
  await page.waitForTimeout(140);
  expect(await style(todayAdd)).toEqual(goldHoverStyle);
});
