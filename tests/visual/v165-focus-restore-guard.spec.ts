import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// V165 PR 0: a dialog closes and schedules its focus return on the next animation frame.
// If another dialog opens in that window, the old return must not steal the new dialog's focus.

async function prepare(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function openNextStepEditorFromMenu(page: Page) {
  const row = page
    .locator(".nextStepRow", { hasText: "5分だけ体を動かす" })
    .locator(".nextStepActionRegion");
  await row.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "次の一手を編集", exact: true })).toBeEnabled();
  await page.getByRole("menuitem", { name: "次の一手を編集", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "次の一手を編集" });
  await expect(dialog).toBeVisible();
  return dialog;
}

async function twoFrames(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }),
  );
}

test("V165-PR0 a dialog opened while the previous dialog restores focus keeps the focus", async ({
  page,
}) => {
  await prepare(page);
  const nextStepDialog = await openNextStepEditorFromMenu(page);

  // Both clicks run in one task: the close schedules the double requestAnimationFrame focus
  // return, and the next dialog mounts before those frames run.
  await page.evaluate(() => {
    const cancel = document.querySelector<HTMLButtonElement>(".dialogCancelButton");
    const add = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
      (button) =>
        (button.getAttribute("aria-label") ?? "").includes("やりたいことを追加") ||
        (button.textContent ?? "").includes("やりたいことを追加"),
    );
    if (!cancel || !add) throw new Error("cancel or add button not found");
    cancel.click();
    add.click();
  });

  const wishlistDialog = page.getByRole("dialog", { name: "やりたいことを追加" });
  await expect(wishlistDialog).toBeVisible();
  const wishlistInput = wishlistDialog.getByRole("textbox", { name: "やりたいこと" });
  await twoFrames(page);
  await expect(wishlistInput).toBeFocused();
  await expect(nextStepDialog).toHaveCount(0);
});

test("V165-PR0 cancelling the discard confirmation keeps the parent dialog focus with the add menu open", async ({
  page,
}) => {
  await prepare(page);
  const dialog = await openNextStepEditorFromMenu(page);
  const actionInput = dialog.getByRole("textbox", { name: "行動" });
  await actionInput.fill("変更した行動");

  await dialog.getByRole("button", { name: "＋ ボタン・手順書を足す" }).click();
  await expect(dialog.getByRole("menu", { name: "足す物" })).toBeVisible();

  const closeButton = dialog.getByRole("button", { name: "次の一手を編集を閉じる" });
  await closeButton.click();
  const confirmation = page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "戻る" }).click();
  await expect(confirmation).toHaveCount(0);

  await twoFrames(page);
  await expect(closeButton).toBeFocused();
  await expect(dialog.getByRole("menu", { name: "足す物" })).toBeVisible();
});
