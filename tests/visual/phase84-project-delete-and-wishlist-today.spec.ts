import { expect, test, type Locator, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture, height = 1000) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1440, height });
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

async function setSaveFailure(page: Page, value: boolean) {
  await page.evaluate((shouldFail) => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { setSaveConfigFailure: (value: boolean) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(shouldFail);
  }, value);
}

async function invokeCount(page: Page, command: string) {
  return page.evaluate(
    (name) =>
      (
        window as Window & {
          __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string }> };
        }
      ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter((call) => call.command === name).length,
    command,
  );
}

async function dragTo(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  expect(sourceBox).not.toBeNull();
  expect(targetBox).not.toBeNull();
  const startX = sourceBox!.x + Math.min(80, sourceBox!.width * 0.35);
  const startY = sourceBox!.y + sourceBox!.height / 2;
  await page.mouse.move(startX, startY);
  await page.mouse.down();
  await page.mouse.move(startX + 10, startY, { steps: 2 });
  await page.mouse.move(
    targetBox!.x + targetBox!.width / 2,
    targetBox!.y + targetBox!.height / 2,
    { steps: 8 },
  );
}

test("Today removal toast, picker alignment, progress, typography and measure underline match the UI grammar", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);

  const measure = page.locator(".todayMeasureButton").first();
  await measure.hover();
  await expect
    .poll(() => measure.evaluate((node) => getComputedStyle(node, "::after").transform))
    .not.toBe("matrix(0, 0, 0, 1, 0, 0)");
  const underline = await measure.evaluate((node) => {
    const style = getComputedStyle(node, "::after");
    return { left: style.left, right: style.right, transform: style.transform };
  });
  expect(underline.left).toBe("6px");
  expect(underline.right).toBe("6px");
  expect(underline.transform).not.toBe("matrix(0, 0, 0, 1, 0, 0)");

  await page.locator(".todayRemoveButton").first().click();
  await expect(page.locator(".toast").last()).toHaveClass(/toast--neutral/);

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = page.getByRole("dialog", { name: "今日やるものを選ぶ" });
  const progress = dialog.locator(".todayPickerProgress");
  await expect(progress).toHaveCSS("width", "154px");
  await expect(progress.locator("span")).toHaveCSS("background-color", "rgb(111, 207, 151)");
  const addButton = dialog.locator(".todayPickerAddButton").first();
  const cancelButton = dialog.getByRole("button", { name: "キャンセル", exact: true });
  expect((await addButton.boundingBox())!.height).toBe((await cancelButton.boundingBox())!.height);

  await dialog.getByRole("tab", { name: /やりたいこと/ }).click();
  const sourceHeading = dialog.locator(".todayPickerSourceHeading h3");
  const panelHeading = dialog.locator(".todayPickerPanelHeading strong");
  expect(await panelHeading.evaluate((node) => getComputedStyle(node).fontSize)).toBe(
    await sourceHeading.evaluate((node) => getComputedStyle(node).fontSize),
  );
  expect(await panelHeading.evaluate((node) => getComputedStyle(node).color)).toBe(
    await sourceHeading.evaluate((node) => getComputedStyle(node).color),
  );
});

test("Wishlist rows drag to Today3 with gold guidance and use the shared adoption mutation", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture, 1200);
  await page.getByRole("button", { name: "やりたいこと", exact: true }).click();
  const row = page.locator('[data-inbox-id="sample-later"]');
  const grid = page.locator(".todayGrid");
  await dragTo(page, row, grid);
  await expect(grid).toHaveClass(/todayGrid--dropGuidance/);
  await expect(grid).toHaveClass(/todayGrid--dropTarget/);
  await expect(page.locator(".todayDropGuidanceOverlay")).toContainText("今日の3件");
  await page.mouse.up();

  await expect.poll(async () => (await currentConfig(page)).today.items.length).toBe(3);
  expect((await currentConfig(page)).today.items.at(-1)?.sourceKey).toBe("wishlist:sample-later");
});

test("Project deletion is blocked before confirmation while unfinished Today3 uses the project", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  const card = page.locator('.nextStepCard[data-project-id="sample-learning"]');
  const badge = card.locator(".sourceLockBadge");
  const projectIdentity = card.locator(".projectIdentity");
  const badgeBox = await badge.boundingBox();
  const identityBox = await projectIdentity.boundingBox();
  expect(Math.abs(badgeBox!.y + badgeBox!.height / 2 - (identityBox!.y + identityBox!.height / 2))).toBeLessThan(2);

  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを削除…" }).click();
  await expect(page.getByRole("dialog", { name: "プロジェクトを削除しますか？" })).toHaveCount(0);
  await expect(page.locator(".toast--warn").last()).toContainText("今日の3件");
  expect((await currentConfig(page)).projects.some((project) => project.id === "sample-learning")).toBe(
    true,
  );
});

test("Project deletion is blocked for both running and paused project timers", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.doNowCandidates = [
    { projectId: "sample-stretch", reason: "manualOrder", restartEligible: false },
  ];
  await prepare(page, fixture);
  await page
    .locator(".doNowBand")
    .getByRole("button", { name: /通常タイマー\d+分で開始/ })
    .click();
  const card = page.locator('.nextStepCard[data-project-id="sample-stretch"]');

  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを削除…" }).click();
  await expect(page.locator(".toast--warn").last()).toContainText("タイマーを終了");
  await expect(page.getByRole("dialog", { name: "プロジェクトを削除しますか？" })).toHaveCount(0);

  await page.locator(".doNowBand").getByRole("button", { name: "一時停止" }).click();
  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを削除…" }).click();
  await expect(page.locator(".toast--warn").last()).toContainText("タイマーを終了");
  expect((await currentConfig(page)).projects.some((project) => project.id === "sample-stretch")).toBe(
    true,
  );
});

test("Project delete dialog counts dependencies and complete-then-delete preserves history snapshots", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.inbox.push(
    { id: "stretch-a", text: "肩を回す", projectId: "sample-stretch" },
    { id: "stretch-b", text: "深呼吸する", projectId: "sample-stretch" },
  );
  fixture.config.today.items.push({
    text: "完了済みのストレッチ",
    done: true,
    sourceKey: "project:sample-stretch",
    projectId: "sample-stretch",
  });
  const todayBefore = structuredClone(fixture.config.today.items);
  await prepare(page, fixture);
  const card = page.locator('.nextStepCard[data-project-id="sample-stretch"]');

  await card.click({ button: "right" });
  const deleteMenuItem = page.getByRole("menuitem", { name: "プロジェクトを削除…" });
  await expect(deleteMenuItem).toHaveClass(/contextMenuDanger/);
  await deleteMenuItem.click();
  let dialog = page.getByRole("dialog", { name: "プロジェクトを削除しますか？" });
  await expect(dialog).toContainText("次の一手: 1件");
  await expect(dialog).toContainText("やりたいこと: 2件");
  await expect(dialog).toContainText("過去の実行記録は残ります。");
  await expect(dialog.getByRole("button", { name: "キャンセル" })).toBeFocused();
  await dialog.getByRole("button", { name: "キャンセル" }).click();

  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを編集" }).click();
  const editor = page.getByRole("dialog", { name: "プロジェクトを編集" });
  await expect(editor.locator(".projectDangerZone")).toBeVisible();
  await editor.getByRole("button", { name: "プロジェクトを削除…" }).click();
  dialog = page.getByRole("dialog", { name: "プロジェクトを削除しますか？" });
  await dialog
    .getByRole("button", { name: "残っている項目を完了扱いにして削除" })
    .click();

  const saved = await currentConfig(page);
  expect(saved.projects.some((project) => project.id === "sample-stretch")).toBe(false);
  expect(saved.inbox.some((item) => item.projectId === "sample-stretch")).toBe(false);
  expect(saved.sourceCompletions.filter((item) => item.projectId === "sample-stretch")).toHaveLength(3);
  expect(saved.today.items).toEqual(todayBefore);
  expect(await invokeCount(page, "record_session")).toBe(0);
});

test("Project deletion save failure rolls Project, NextStep, Wishlist and completion back together", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.inbox.push({ id: "stretch-rollback", text: "姿勢を整える", projectId: "sample-stretch" });
  await prepare(page, fixture);
  const before = structuredClone(await currentConfig(page));
  await setSaveFailure(page, true);

  const card = page.locator('.nextStepCard[data-project-id="sample-stretch"]');
  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを削除…" }).click();
  const dialog = page.getByRole("dialog", { name: "プロジェクトを削除しますか？" });
  await dialog.getByRole("button", { name: "残っている項目を完了扱いにして削除" }).click();
  await expect(dialog).toBeVisible();
  await expect(page.locator(".toast--error").last()).toContainText("保存できません");
  expect(await currentConfig(page)).toEqual(before);
});

test("Project Danger Zone and delete confirmation remain usable at narrow width", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture, 900);
  await page.setViewportSize({ width: 620, height: 900 });
  const card = page.locator('.nextStepCard[data-project-id="sample-stretch"]');
  await card.scrollIntoViewIfNeeded();
  await card.click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを編集" }).click();

  const editor = page.getByRole("dialog", { name: "プロジェクトを編集" });
  const dangerZone = editor.locator(".projectDangerZone");
  await dangerZone.scrollIntoViewIfNeeded();
  await expect(dangerZone).toBeVisible();
  await dangerZone.getByRole("button", { name: "プロジェクトを削除…" }).click();

  const confirmation = page.getByRole("dialog", { name: "プロジェクトを削除しますか？" });
  const box = await confirmation.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(620);
  await expect(confirmation.getByRole("button", { name: "キャンセル" })).toBeFocused();
});
