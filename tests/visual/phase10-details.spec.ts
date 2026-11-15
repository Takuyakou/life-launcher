import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaControl = {
  currentConfig: () => AppConfig;
  setSaveConfigFailure: (failed: boolean) => void;
  emit: (event: string, value: unknown) => void;
  invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
};

type QaWindow = Window & { __LIFE_LAUNCHER_VISUAL_QA__: QaControl };

test.use({ reducedMotion: "no-preference" });

async function prepare(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".todayRow").first()).toBeVisible();
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  await expect(page.locator(".inboxRow").first()).toBeVisible();
}

async function config(page: Page): Promise<AppConfig> {
  return page.evaluate(() => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig());
}

async function emitDrop(page: Page, stage: "dragEnter" | "dragLeave" | "drop", paths: string[], x: number) {
  await page.evaluate(
    (payload) => {
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.emit("main-shell-drop-result", {
        windowLabel: "main",
        stage: payload.stage,
        paths: payload.paths,
        url: null,
        position: { x: payload.x, y: 320 },
      });
    },
    { paths, stage, x },
  );
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
  await expect.poll(() => hint.evaluate((node) => getComputedStyle(node).opacity)).toBe("0");

  // Re-entering the row with the keyboard makes the hint visible.
  await page.keyboard.press("Shift+Tab");
  for (let index = 0; index < 60; index += 1) {
    await page.keyboard.press("Tab");
    if (await card.evaluate((node) => node === document.activeElement)) break;
  }
  await expect(card).toBeFocused();
  await expect.poll(() => hint.evaluate((node) => getComputedStyle(node).opacity)).toBe("1");
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
  await expect(menu.getByRole("menuitem", { name: /プロジェクトを削除/ })).toContainText("Delete");
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

test("P10-12 T does nothing when the menu is closed", async ({ page }) => {
  await prepare(page);
  const before = (await config(page)).today.items.length;
  await page.keyboard.press("t");
  expect((await config(page)).today.items).toHaveLength(before);
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

test("P10-12 drop zones get the dragover class and keep the received motion", async ({ page }) => {
  await prepare(page);
  await emitDrop(page, "dragEnter", ["C:\\PublicDemo\\import.json"], 900);
  const mainZone = page.locator(".importDropZone--main");
  await expect(mainZone).toBeVisible();
  await expect(mainZone).toHaveClass(/is-dragover/);
  await expect(page.locator(".importDropZone--sidebar")).not.toHaveClass(/is-dragover/);

  await emitDrop(page, "dragLeave", [], 5);
  await expect(page.locator(".importDropOverlay")).toHaveCount(0);
});

test("P10-12 the records faces follow the chosen tab and scope", async ({ page }) => {
  await prepare(page);
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  const view = page.locator(".recordsView");
  await expect(view).toBeVisible();
  await expect(view.locator(".recordsTabFace")).toHaveCount(1);
  await expect(
    view.getByRole("tab", { name: "ふりかえり" }).locator(".recordsTabFace"),
  ).toHaveCount(1);
  await view.getByRole("tab", { name: "すべての記録" }).click();
  await expect(
    view.getByRole("tab", { name: "すべての記録" }).locator(".recordsTabFace"),
  ).toHaveCount(1);
  await expect(
    view.getByRole("tab", { name: "ふりかえり" }).locator(".recordsTabFace"),
  ).toHaveCount(0);
});
