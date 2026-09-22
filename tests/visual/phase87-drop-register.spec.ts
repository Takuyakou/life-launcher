import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type VisualControl = {
  currentConfig: () => { buttons: Array<{ label: string; group?: string }> };
  emit: (event: string, payload: unknown) => void;
  setSaveConfigFailure: (value: boolean) => void;
};

async function prepare(page: Page, width = 1000) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 720 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await page.getByRole("button", { name: /辞書を開く/ }).waitFor();
  await page.evaluate(async () => document.fonts.ready);
}

async function openDropDialog(page: Page, path = "C:\\PublicDemo\\Samples\\") {
  await page.evaluate((droppedPath) => {
    const control = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: VisualControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    control?.emit("main-shell-drop-result", {
      windowLabel: "main",
      stage: "drop",
      paths: [droppedPath],
      url: null,
      label: null,
      shellSpecial: null,
    });
  }, path);
  return page.getByRole("dialog", { name: "ボタン登録" });
}

test("Drop Register hides internal action prefixes and explains display targets", async ({ page }) => {
  await prepare(page);
  const dialog = await openDropDialog(page);
  await expect(dialog).toBeVisible();
  await expect(dialog.getByText("C:\\PublicDemo\\Samples\\", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/open_folder:/)).toHaveCount(0);
  await expect(dialog.getByText("Quickからすぐ開く項目に向いています")).toBeVisible();
  await expect(dialog.getByText("検索して開く項目に向いています")).toBeVisible();
});

test("file and URL registrations expose only their human-readable target", async ({ page }) => {
  await prepare(page);
  let dialog = await openDropDialog(page, "C:\\PublicDemo\\guide.txt");
  await expect(dialog.getByText("C:\\PublicDemo\\guide.txt", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/open_file:/)).toHaveCount(0);
  await dialog.getByRole("button", { name: "キャンセル" }).click();

  await page.evaluate(() => {
    const control = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: VisualControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    control?.emit("main-shell-drop-result", {
      windowLabel: "main",
      stage: "drop",
      paths: [],
      url: "https://example.com/reference",
      label: "Reference",
      shellSpecial: null,
    });
  });
  dialog = page.getByRole("dialog", { name: "ボタン登録" });
  await expect(dialog.getByText("https://example.com/reference", { exact: true })).toBeVisible();
  await expect(dialog.getByText(/open_url:/)).toHaveCount(0);
});

test("group mode shows one intentional field at a time", async ({ page }) => {
  await prepare(page);
  const dialog = await openDropDialog(page);
  await expect(dialog.getByRole("combobox", { name: "既存のグループ" })).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "新しいグループ名" })).toHaveCount(0);

  await dialog.getByRole("button", { name: "新規グループを作成" }).click();
  await expect(dialog.getByRole("combobox", { name: "既存のグループ" })).toHaveCount(0);
  await dialog.getByRole("textbox", { name: "新しいグループ名" }).fill("新しい資料");
  await expect(dialog.getByRole("textbox", { name: "新しいグループ名" })).toHaveValue(
    "新しい資料",
  );
});

test("Dictionary page follows its display target and footer uses Add then Cancel", async ({ page }) => {
  await prepare(page, 540);
  const dialog = await openDropDialog(page);
  const overlayTarget = dialog.getByRole("checkbox", { name: /Ctrl\+K辞書に表示/ });
  await expect(dialog.getByRole("combobox", { name: "辞書ページ" })).toBeVisible();
  await overlayTarget.uncheck();
  await expect(dialog.getByRole("combobox", { name: "辞書ページ" })).toHaveCount(0);

  const actions = dialog.locator(".dropRegisterActions > button");
  await expect(actions.nth(0)).toHaveText("追加");
  await expect(actions.nth(0)).toHaveClass(/primaryButton/);
  await expect(actions.nth(1)).toHaveText("キャンセル");
  await expect(actions.nth(1)).toHaveClass(/dangerButton/);
});

test("save failure retains the draft and Cancel closes explicitly", async ({ page }) => {
  await prepare(page);
  const dialog = await openDropDialog(page);
  await dialog.getByRole("textbox", { name: "ラベル" }).fill("保持する項目");
  await page.evaluate(() => {
    const control = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: VisualControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    control?.setSaveConfigFailure(true);
  });
  await dialog.getByRole("button", { name: "追加" }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "ラベル" })).toHaveValue("保持する項目");
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toHaveCount(0);
});

test("new group saves through the existing config contract and backdrop stays inert", async ({
  page,
}) => {
  await prepare(page);
  const dialog = await openDropDialog(page);
  await page.locator(".modalBackdrop").click({ position: { x: 4, y: 4 } });
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "新規グループを作成" }).click();
  await dialog.getByRole("textbox", { name: "新しいグループ名" }).fill("参照資料");
  await dialog.getByRole("textbox", { name: "ラベル" }).fill("登録テスト");
  await dialog.getByRole("button", { name: "追加" }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await page.evaluate(() => {
    const control = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: VisualControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    return control?.currentConfig().buttons.find((button) => button.label === "登録テスト");
  });
  expect(saved?.group).toBe("参照資料");
});
