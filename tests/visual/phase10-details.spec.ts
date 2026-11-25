import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

type QaControl = {
  currentConfig: () => AppConfig;
  setSaveConfigFailure: (failed: boolean) => void;
  emit: (event: string, value: unknown) => void;
  invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
};

type QaWindow = Window & { __LIFE_LAUNCHER_VISUAL_QA__: QaControl };

test.use({ reducedMotion: "no-preference" });

async function prepare(page: Page, fixture: VisualQaFixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".mainScrollContent")).toBeVisible();
  const disclosure = page.locator(".inboxBand .disclosure");
  if (
    (await disclosure.count()) > 0 &&
    (await disclosure.getAttribute("aria-expanded")) !== "true"
  ) {
    await disclosure.click();
  }
}

async function config(page: Page): Promise<AppConfig> {
  return page.evaluate(() => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig());
}

const timerRunning = (page: Page) =>
  expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");

test("P10-12 Enter on a Next Step row starts the short Timer", async ({ page }) => {
  await prepare(page);
  const row = page.locator(".nextStepRow").filter({ hasText: "ストレッチ" });
  await row.focus();
  await page.keyboard.press("Enter");
  await timerRunning(page);
  await expect(page.locator(".timerDock")).toContainText("ストレッチ");
});

test("P10-12 Enter on a Today card starts that card's short Timer", async ({ page }) => {
  await prepare(page);
  const card = page.locator(".todayRow").filter({ hasText: "資料を1ページ読む" });
  await card.focus();
  await page.keyboard.press("Enter");
  await timerRunning(page);
  await expect(page.locator(".timerDock")).toContainText("資料を1ページ読む");
});

test("P10-12 Enter on a Wishlist row promotes it to the Next Step", async ({ page }) => {
  await prepare(page);
  const row = page.locator(".inboxRow").filter({ hasText: "あとで確認するサンプル" });
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog").filter({ hasText: "次の一手" });
  await expect(dialog).toBeVisible();
});

test("P10-12 row keys ignore buttons inside the row and IME composition", async ({ page }) => {
  await prepare(page);
  const card = page.locator(".todayRow").filter({ hasText: "資料を1ページ読む" });
  await card.getByRole("button", { name: /の操作$/ }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("待機中");

  await card.focus();
  await page.evaluate(() => {
    const row = document.querySelectorAll(".todayRow")[1];
    row?.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", isComposing: true }),
    );
  });
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("待機中");
});

test("P10-12 F2 edits the focused row and Delete follows the normal delete path", async ({
  page,
}) => {
  await prepare(page);
  const wishlistRow = page.locator(".inboxRow").filter({ hasText: "あとで確認するサンプル" });
  await wishlistRow.focus();
  await page.keyboard.press("F2");
  await expect(page.getByRole("dialog", { name: "やりたいこと編集" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "やりたいこと編集" })).toHaveCount(0);

  await wishlistRow.focus();
  await page.keyboard.press("Delete");
  const confirm = page.getByRole("dialog", { name: /削除しますか/ });
  await expect(confirm).toBeVisible();
  await confirm.getByRole("button", { name: "削除", exact: true }).click();
  await expect(confirm).toHaveCount(0);
  expect((await config(page)).inbox.some((item) => item.text === "あとで確認するサンプル")).toBe(
    false,
  );
});

test("P10-12 Delete on a running Today card does nothing", async ({ page }) => {
  await prepare(page);
  const card = page.locator(".todayRow").filter({ hasText: "資料を1ページ読む" });
  await card.getByRole("button", { name: /短時間タイマー.+分で開始/ }).click();
  await timerRunning(page);
  await card.focus();
  await page.keyboard.press("Delete");
  const remaining = (await config(page)).today.items.map((item) => item.text);
  expect(remaining).toContain("資料を1ページ読む");
  await expect(
    page.locator(".toast", { hasText: "タイマーを停止してから外してください" }),
  ).toBeVisible();
});

test("P10-12 the Enter hint only appears for the focused row", async ({ page }) => {
  await prepare(page);
  const card = page.locator(".todayRow").filter({ hasText: "資料を1ページ読む" });
  const hint = card.locator(".rowKeyHint");

  await card.click({ position: { x: 12, y: 12 } });
  await card.focus();
  await expect(card).toBeFocused();
  await expect(hint).toBeHidden();

  // Re-entering the row with the keyboard makes the hint visible.
  await page.keyboard.press("Shift+Tab");
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press("Tab");
    if (await card.evaluate((node) => node === document.activeElement)) break;
  }
  await expect(card).toBeFocused();
  await expect(hint).toBeVisible();
});

test("P10-12 the context menu shows only the key badges that work, and T adds to Today", async ({
  page,
}) => {
  await prepare(page);
  const row = page.locator(".nextStepRow").filter({ hasText: "ストレッチ" });
  await row.getByRole("button", { name: "次の一手の操作" }).click();
  const menu = page.getByRole("menu", { name: "操作メニュー" });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole("menuitem", { name: /次の一手を編集/ })).toContainText("F2");
  await expect(menu.getByRole("menuitem", { name: /今日の3件に入れる/ })).toContainText("T");
  await expect(menu.getByRole("menuitem", { name: /次の一手を未設定にする/ })).toContainText(
    "Delete",
  );
  await expect(menu.getByRole("menuitem", { name: /プロジェクトを削除/ })).not.toContainText(
    "Delete",
  );
  await expect(menu.getByRole("menuitem", { name: "別の行動に入れ替える" })).not.toContainText(
    "F2",
  );
  await expect(menu.getByRole("menuitem", { name: "プロジェクトを編集" })).not.toContainText(
    "Delete",
  );

  await page.keyboard.press("t");
  await expect(menu).toHaveCount(0);
  const saved = await config(page);
  expect(saved.today.items.some((item) => item.text === "5分だけ体を動かす")).toBe(true);
});

test("P10-12 the toast line drains, pauses on hover and stays for failures", async ({ page }) => {
  await prepare(page);
  const card = page.locator(".todayRow").filter({ hasText: "資料を1ページ読む" });
  await card.focus();
  await page.keyboard.press("Delete");

  const toast = page.locator(".toast").last();
  await expect(toast).toContainText("今日の3件から外しました");
  const line = toast.locator(".toastLifetime");
  await expect(line).toBeVisible();
  await expect
    .poll(() => line.evaluate((node) => getComputedStyle(node).animationPlayState))
    .toBe("running");

  await toast.hover();
  await expect
    .poll(() => line.evaluate((node) => getComputedStyle(node).animationPlayState))
    .toBe("paused");
  await page.mouse.move(5, 5);
  await expect
    .poll(() => line.evaluate((node) => getComputedStyle(node).animationPlayState))
    .toBe("running");

  // A failure stays past 8s, has no line, and closes with ×.
  await page.evaluate(() =>
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true),
  );
  await page.locator(".todayRow").first().getByRole("button", { name: /の操作$/ }).click();
  await page.getByRole("menuitem", { name: /今日の3件から外す/ }).click();
  const errorToast = page.locator(".toast--error").last();
  await expect(errorToast).toBeVisible();
  await expect(errorToast.locator(".toastLifetime")).toBeHidden();
  await page.clock.fastForward(9_000);
  await expect(errorToast).toBeVisible();
  await errorToast.getByRole("button", { name: "通知を閉じる" }).click();
  await expect(errorToast).toHaveCount(0);
});

test("P10-12 Ctrl+Z presses the newest undo, but not inside a text field", async ({ page }) => {
  await prepare(page);
  const card = page.locator(".todayRow").filter({ hasText: "資料を1ページ読む" });
  await card.focus();
  await page.keyboard.press("Delete");
  await expect(page.locator(".toast").last()).toContainText("元に戻す");

  await page.keyboard.press("Control+z");
  await expect
    .poll(async () =>
      (await config(page)).today.items.some((item) => item.text === "資料を1ページ読む"),
    )
    .toBe(true);

  await page.locator(".todayRow").filter({ hasText: "資料を1ページ読む" }).focus();
  await page.keyboard.press("Delete");
  await expect(page.locator(".toast").last().getByRole("button", { name: "元に戻す" })).toBeVisible();
  // Inside a text field Ctrl+Z keeps the field's own undo and never presses the toast.
  await page
    .locator(".projectsBand")
    .getByRole("button", { name: "プロジェクトを追加", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await dialog.getByRole("textbox", { name: "プロジェクト名" }).focus();
  await page.keyboard.press("Control+z");
  await expect(page.locator(".toast").last()).toBeVisible();
  await expect(page.locator(".toast").last()).toContainText("元に戻す");
  await page.keyboard.press("Escape");

  // No "Ctrl Z" badge anywhere (D30).
  await expect(page.getByText("Ctrl Z", { exact: true })).toHaveCount(0);
});

test("P10-12 the help guide lists the short keys", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("button", { name: "使い方を開く" }).click();
  const help = page.getByRole("dialog", { name: "使い方" });
  await expect(help).toBeVisible();
  await help.getByRole("button", { name: /キーの一覧/ }).first().click();
  const table = help.locator(".helpGuideKeys");
  await expect(table).toBeVisible();
  await expect(table).toContainText("Ctrl + K");
  await expect(table).toContainText("Ctrl + F");
  await expect(table).toContainText("F2");
  await expect(table).toContainText("Delete");
  await expect(table).toContainText("Ctrl + Z");
});

test("P10-14 Delete on a Next Step row clears the step, not the Project", async ({ page }) => {
  await prepare(page);
  const row = page.locator(".nextStepRow").filter({ hasText: "ストレッチ" });
  await row.focus();
  await page.keyboard.press("Delete");

  const confirm = page.getByRole("dialog").filter({ hasText: "次の一手を未設定にしますか？" });
  await expect(confirm).toBeVisible();
  await expect(page.getByRole("dialog").filter({ hasText: "プロジェクトを削除" })).toHaveCount(0);

  await confirm.getByRole("button", { name: "やりたいことへ戻す" }).click();
  await expect(confirm).toHaveCount(0);
  await expect
    .poll(async () => {
      const saved = await config(page);
      return (saved.projects.find((project) => project.name === "ストレッチ")?.nextStep?.text ?? "").trim();
    })
    .toBe("");
});

test("P10-14 Enter and the 5分 button use the card's expandTimerOnStart", async ({ page }) => {
  const fixture = createPublicFixture();
  const item = fixture.config.today.items.find((entry) => !entry.done)!;
  item.expandTimerOnStart = true;
  fixture.config.projects = fixture.config.projects.map((project) =>
    project.nextStep
      ? { ...project, nextStep: { ...project.nextStep, expandTimerOnStart: false } }
      : project,
  );
  await prepare(page, fixture);
  const expanded = page.getByRole("dialog", { name: "拡大タイマー" });

  const card = page.locator(".todayRow").filter({ hasText: item.text });
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(expanded).toBeVisible();
  await page.reload();
  await expect(page.locator(".todayRow").filter({ hasText: item.text })).toBeVisible();

  await page
    .locator(".todayRow")
    .filter({ hasText: item.text })
    .getByRole("button", { name: /短時間タイマー.+分で開始/ })
    .click();
  await expect(expanded).toBeVisible();
});
