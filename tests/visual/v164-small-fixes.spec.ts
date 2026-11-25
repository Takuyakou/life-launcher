import { expect, test, type Page } from "@playwright/test";
import { TOAST_TIMEOUT_MS, TOAST_UNDO_TIMEOUT_MS } from "../../src/constants";
import { waitForBundledFonts } from "./bundledFonts";
import { pauseClock } from "./clock";
import {
  createFullTodayFixture,
  createPublicFixture,
  FIXTURE_NOW,
  type VisualQaFixture,
} from "./fixtures";
import { installTauriMock } from "./tauriMock";

// v1.6.4 PR 5: 「元に戻す」付きの通知はふつうの通知と同じ 4 秒。まとめて取り込むは低い窓でも真ん中に出る。選ぶ欄はメニューと同じ一覧。

async function prepare(page: Page, fixture: VisualQaFixture, width: number, height: number) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

test("V164-05 the Undo toast lives 4 seconds like a normal toast", async ({ page }) => {
  expect(TOAST_UNDO_TIMEOUT_MS).toBe(4000);
  expect(TOAST_TIMEOUT_MS).toBe(4000);
  await prepare(page, createPublicFixture(), 1440, 900);
  await pauseClock(page);
  await page.mouse.move(1, 1);
  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: "今日の3件から外す" })
    .click();
  const toast = page.locator(".toast", { hasText: "今日の3件から外しました" });
  await expect(toast).toBeVisible();
  await expect(toast.getByRole("button", { name: "元に戻す" })).toBeVisible();
  // 残り時間の線も同じ長さで動く。
  expect(
    await toast.evaluate((node) =>
      getComputedStyle(node).getPropertyValue("--toast-duration").trim(),
    ),
  ).toBe("4000ms");
  await page.getByRole("button", { name: "Windows自動起動" }).focus();
  await page.clock.runFor(3900);
  await expect(toast).toBeVisible();
  // 消える動き(約 0.3 秒)の分を待つ。前の 5 秒の時も同じ待ち方。
  await page.clock.runFor(400);
  await expect(toast).toHaveCount(0);
});

for (const [width, height] of [
  [1366, 665],
  [860, 560],
  [1440, 900],
] as const) {
  test(`V164-05 Bulk import opens vertically centered (${width}x${height})`, async ({ page }) => {
    await prepare(page, createFullTodayFixture(), width, height);
    await page.getByRole("button", { name: "次の一手の操作", exact: true }).click();
    await page.getByRole("menuitem", { name: "まとめて取り込む" }).click();
    const dialog = page.getByRole("dialog", { name: "まとめて取り込む" });
    await expect(dialog).toBeVisible();
    await dialog.evaluate((node) =>
      Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
    );
    const box = await dialog.boundingBox();
    expect(box).not.toBeNull();
    const top = box!.y;
    const bottom = height - (box!.y + box!.height);
    // 上と下の余白がそろう(真ん中)。窓の中に収まる。
    expect(Math.abs(top - bottom)).toBeLessThanOrEqual(2);
    expect(top).toBeGreaterThanOrEqual(12);
    expect(box!.y + box!.height).toBeLessThanOrEqual(height);
  });
}

async function openWishlistAdd(page: Page) {
  const wishlist = page.locator(".inboxBand");
  const addButton = wishlist.getByRole("button", { name: "やりたいことを追加" });
  if (!(await addButton.isVisible())) await wishlist.locator(".disclosure").click();
  await addButton.click();
  const dialog = page.getByRole("dialog", { name: "やりたいことを追加" });
  await expect(dialog).toBeVisible();
  await dialog.evaluate((node) =>
    Promise.all(node.getAnimations({ subtree: true }).map((animation) => animation.finished)),
  );
  return dialog;
}

test("V164-05 the Project picker opens below in the same look as the context menu", async ({
  page,
}) => {
  await prepare(page, createPublicFixture(), 1100, 720);
  const dialog = await openWishlistAdd(page);
  const select = dialog.getByRole("combobox");
  await expect(select).toHaveValue("");
  const look = await select.evaluate((node) => {
    const picker = getComputedStyle(node, "::picker(select)");
    return {
      appearance: getComputedStyle(node).appearance,
      pickerBackground: picker.backgroundColor,
      pickerBorderRadius: picker.borderTopLeftRadius,
      pickerPadding: picker.paddingTop,
    };
  });
  // 地・角・内側の余白は右クリックメニュー(.contextMenu)と同じ値。
  expect(look).toEqual({
    appearance: "base-select",
    pickerBackground: "rgb(41, 38, 31)",
    pickerBorderRadius: "8px",
    pickerPadding: "5px",
  });
  await select.click();
  const options = page.getByRole("option");
  await expect(options).toHaveText(["プロジェクトなし", "サンプル学習", "ストレッチ"]);
  const selectBox = (await select.boundingBox())!;
  const firstBox = (await options.first().boundingBox())!;
  const lastBox = (await options.last().boundingBox())!;
  // 下に収まるので下に開く(上の方が広くても上に回らない)。窓の中に収まる。
  expect(firstBox.y).toBeGreaterThan(selectBox.y + selectBox.height);
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(720);
  // 選んでいる物は金色、乗せた物はメニューと同じ色の地。
  expect(await options.first().evaluate((node) => getComputedStyle(node).color)).toBe(
    "rgb(255, 206, 91)",
  );
  await options.nth(1).hover();
  await expect
    .poll(() => options.nth(1).evaluate((node) => getComputedStyle(node).backgroundColor))
    .toBe("rgba(184, 176, 160, 0.12)");
  // キーボードはふつうの select のまま:Alt+↓ で開き、↓ と Enter で選び、Esc で閉じてフォーカスは欄に戻る。
  // (閉じた欄で Enter を押しても開かないのは Windows のふつうの select と同じ。Alt+↓ はどの OS でも開く)
  await page.keyboard.press("Escape");
  await expect(options.first()).toBeHidden();
  // Esc は一覧だけを閉じる。ダイアログは開いたまま。
  await expect(dialog).toBeVisible();
  await expect(select).toBeFocused();
  await expect(select).toHaveValue("");
  await page.keyboard.press("Alt+ArrowDown");
  await expect(options.first()).toBeVisible();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(options.first()).toBeHidden();
  await expect(select).toBeFocused();
  const projects = await select.evaluate((node) =>
    [...(node as HTMLSelectElement).options].map((option) => ({
      value: option.value,
      text: option.text,
    })),
  );
  await expect(select).toHaveValue(projects[1].value);
  await expect(select).toHaveText(/サンプル学習/);
});

test("V164-05 every select in the main window uses the same picker", async ({ page }) => {
  await prepare(page, createPublicFixture(), 860, 560);
  await page.locator(".quickButton").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "ボタン編集" });
  await expect(dialog).toBeVisible();
  const selects = dialog.locator("select");
  expect(await selects.count()).toBeGreaterThan(0);
  expect(
    await selects.evaluateAll((nodes) =>
      nodes.map(
        (node) =>
          getComputedStyle(node).appearance +
          " " +
          getComputedStyle(node, "::picker(select)").backgroundColor,
      ),
    ),
  ).toEqual(Array.from({ length: await selects.count() }, () => "base-select rgb(41, 38, 31)"));
  const actionSelect = selects.last();
  await actionSelect.scrollIntoViewIfNeeded();
  await actionSelect.click();
  const options = actionSelect.getByRole("option");
  await expect(options.first()).toBeVisible();
  // 低い窓でも一覧は窓の中に収まる。
  for (const box of await options.evaluateAll((nodes) =>
    nodes.map((node) => node.getBoundingClientRect().toJSON()),
  )) {
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.bottom).toBeLessThanOrEqual(560);
  }
  await page.keyboard.press("Escape");
  await expect(options.first()).toBeHidden();
  await expect(dialog).toBeVisible();
  await expect(actionSelect).toBeFocused();
});
