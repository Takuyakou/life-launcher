import { expect, test, type Locator, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// ダイアログを開いている間の通知は上端の中央に出し、ダイアログのボタンに重ならない
// (右下のままだと、幅 1050px 以下で保存の失敗の通知が「キャンセル」を約8秒ふさいでいた)。

type Control = {
  emit: (event: string, payload: unknown) => void;
  setSaveConfigFailure: (value: boolean) => void;
};

const SIZES = [
  { width: 860, height: 560 },
  { width: 1000, height: 720 },
  { width: 1200, height: 680 },
  { width: 1920, height: 1080 },
] as const;

async function open(page: Page, size: { width: number; height: number }) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(size);
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await page.getByRole("button", { name: /辞書を開く/ }).waitFor();
}

async function failSaves(page: Page) {
  await page.evaluate(() =>
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: Control }).__LIFE_LAUNCHER_VISUAL_QA__!.setSaveConfigFailure(true),
  );
}

/** The element under the centre of the button is the button itself (nothing covers it). */
async function expectClickable(button: Locator, label: string) {
  await expect(button, label).toBeVisible();
  const covered = await button.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
    return element.contains(hit) ? null : (hit?.closest(".toast")?.className ?? hit?.className ?? "nothing");
  });
  expect(covered, `${label} is covered`).toBeNull();
}

async function expectToastsAtTopCentre(page: Page, label: string) {
  const stack = await page.locator(".toastStack").boundingBox();
  const viewport = page.viewportSize()!;
  expect(stack, label).not.toBeNull();
  expect(Math.abs(stack!.x + stack!.width / 2 - viewport.width / 2), `${label} centred`).toBeLessThanOrEqual(1);
  expect(stack!.y, `${label} at the top`).toBeLessThanOrEqual(13);
}

for (const size of SIZES) {
  const label = `${size.width}x${size.height}`;

  test(`a failed save in Button Registration keeps Add and Cancel clickable (${label})`, async ({ page }) => {
    await open(page, size);
    await page.evaluate(() =>
      (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: Control }).__LIFE_LAUNCHER_VISUAL_QA__!.emit(
        "main-shell-drop-result",
        { windowLabel: "main", stage: "drop", paths: ["C:\\PublicDemo\\Samples\\"], url: null, label: null, shellSpecial: null },
      ),
    );
    const dialog = page.getByRole("dialog", { name: "ボタン登録" });
    await dialog.getByRole("textbox", { name: "ラベル" }).fill("保持する項目");
    await failSaves(page);
    await dialog.getByRole("button", { name: "追加" }).click();
    await expect(page.locator(".toast--error")).toBeVisible();
    await expectToastsAtTopCentre(page, label);
    await expectClickable(dialog.getByRole("button", { name: "追加" }), "追加");
    await expectClickable(dialog.getByRole("button", { name: "キャンセル" }), "キャンセル");
  });

  test(`a failed save in Settings keeps Save, Cancel and the close button clickable (${label})`, async ({ page }) => {
    await open(page, size);
    await page.getByRole("button", { name: "設定を開く" }).click();
    const settings = page.getByRole("dialog", { name: "設定" });
    await settings.getByRole("checkbox").first().click();
    await failSaves(page);
    await settings.getByRole("button", { name: "保存" }).click();
    await expect(page.locator(".toast--error").first()).toBeVisible();
    await expectToastsAtTopCentre(page, label);
    await expectClickable(settings.getByRole("button", { name: "保存" }), "保存");
    await expectClickable(settings.getByRole("button", { name: "キャンセル" }), "キャンセル");
    await expectClickable(settings.getByRole("button", { name: "設定を閉じる" }), "設定を閉じる");
  });
}

test("toasts return to the bottom right once the dialog closes", async ({ page }) => {
  await open(page, SIZES[0]);
  await page.evaluate(() =>
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: Control }).__LIFE_LAUNCHER_VISUAL_QA__!.emit(
      "main-shell-drop-result",
      { windowLabel: "main", stage: "drop", paths: ["C:\\PublicDemo\\Samples\\"], url: null, label: null, shellSpecial: null },
    ),
  );
  const dialog = page.getByRole("dialog", { name: "ボタン登録" });
  await dialog.getByRole("textbox", { name: "ラベル" }).fill("保持する項目");
  await failSaves(page);
  await dialog.getByRole("button", { name: "追加" }).click();
  await expect(page.locator(".toast--error")).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".toast--error")).toBeVisible();
  await expect
    .poll(async () => {
      const stack = (await page.locator(".toastStack").boundingBox())!;
      return [Math.round(SIZES[0].width - (stack.x + stack.width)), Math.round(SIZES[0].height - (stack.y + stack.height))];
    })
    .toEqual([18, 18]);
});
