import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPickerFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V163-B7: the Today picker gets project filter pills and a one-line quick add that lives
// inside the picker's single save point (決定 saves the inbox and Today3 together).

const MUSIC = { id: "sample-music", name: "音づくり" };
const HOME = { id: "sample-home", name: "暮らしの整理" };

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => AppConfig;
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
  };
};

async function prepare(
  page: Page,
  size = { width: 1080, height: 680 },
  extraWishes: Array<{ id: string; text: string; projectId: string }> = [],
) {
  const fixture = createPickerFixture();
  fixture.config.inbox.push(...extraWishes);
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(size);
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  return fixture;
}

const dialogOf = (page: Page) => page.getByRole("dialog", { name: "今日やるものを選ぶ" });

async function openPicker(page: Page) {
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const dialog = dialogOf(page);
  await expect(dialog).toBeVisible();
  return dialog;
}

const filterBar = (page: Page) =>
  page.getByRole("group", { name: "プロジェクトで絞り込む" });
const pill = (page: Page, name: string) =>
  filterBar(page).getByRole("button", { name, exact: true });
const nextStepSection = (page: Page) =>
  page.locator('[data-today-picker-section="next-step"]');
const wishlistSection = (page: Page) =>
  page.locator('[data-today-picker-section="wishlist"]');
const selectedRows = (page: Page) =>
  page.locator('[data-today-picker-section="selected"] .todayPickerRow');
const currentConfig = (page: Page) =>
  page.evaluate(() => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig());
const saveCalls = (page: Page) =>
  page.evaluate(
    () =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === "save_config",
      ).length,
  );

test("V163-B7 1 the pills narrow both groups to one project, すべて brings all back, and 3 of a project save together", async ({
  page,
}) => {
  await prepare(page, undefined, [
    { id: "music-bass", text: "ベースの音を1つ決める", projectId: MUSIC.id },
    { id: "music-mix", text: "音量のバランスを整える", projectId: MUSIC.id },
  ]);
  const dialog = await openPicker(page);

  // No role="tab" (P84 keeps getByRole("tab") at 0) and every pill is a pressed button.
  await expect(dialog.getByRole("tab")).toHaveCount(0);
  const bar = filterBar(page);
  await expect(bar).toBeVisible();
  // すべて, then the projects in config order, then 未分類 (the unassigned wish).
  await expect(bar.getByRole("button")).toHaveText([
    "すべて",
    "サンプル学習",
    "ストレッチ",
    "文章づくり",
    "音づくり",
    "暮らしの整理",
    "未分類",
  ]);
  await expect(pill(page, "すべて")).toHaveAttribute("aria-pressed", "true");
  await expect(nextStepSection(page).locator(".todayPickerRow")).toHaveCount(5);
  await expect(wishlistSection(page).locator(".todayPickerRow")).toHaveCount(7);

  // 音づくり: its own next step and its three wishes; both groups stay.
  await pill(page, MUSIC.name).click();
  await expect(pill(page, MUSIC.name)).toHaveAttribute("aria-pressed", "true");
  await expect(pill(page, "すべて")).toHaveAttribute("aria-pressed", "false");
  await expect(dialog.locator(".todayPickerSourceGroup")).toHaveCount(2);
  await expect(nextStepSection(page).locator(".todayPickerRow")).toHaveCount(1);
  await expect(nextStepSection(page)).toContainText("ドラムの音を1つ選ぶ");
  await expect(wishlistSection(page).locator(".todayPickerRow")).toHaveCount(2);
  await expect(wishlistSection(page)).not.toContainText("あとで確認するサンプル");
  // The pill dot carries the project color.
  await expect(
    pill(page, MUSIC.name).locator(".todayPickerFilterDot"),
  ).toHaveAttribute("data-project-color", "rose");

  // 未分類: no next step at all, and only the wish with no project.
  await pill(page, "未分類").click();
  await expect(nextStepSection(page).locator(".todayPickerRow")).toHaveCount(0);
  await expect(nextStepSection(page)).toContainText("追加できる次の一手はありません");
  await expect(wishlistSection(page).locator(".todayPickerRow")).toHaveCount(1);
  await expect(wishlistSection(page)).toContainText("あとで確認するサンプル");

  // すべて: everything is back.
  await pill(page, "すべて").click();
  await expect(nextStepSection(page).locator(".todayPickerRow")).toHaveCount(5);
  await expect(wishlistSection(page).locator(".todayPickerRow")).toHaveCount(7);

  // The project's three things go into Today3 together and 決定 saves them once.
  // Every open starts on すべて again.
  await pill(page, MUSIC.name).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await openPicker(page);
  await expect(pill(page, "すべて")).toHaveAttribute("aria-pressed", "true");

  await pill(page, MUSIC.name).click();
  await nextStepSection(page).getByRole("button", { name: "＋ 今日へ" }).click();
  for (let index = 0; index < 2; index += 1) {
    await wishlistSection(page).getByRole("button", { name: "＋ 今日へ" }).first().click();
  }
  await expect(selectedRows(page)).toHaveCount(3);
  const savesBefore = await saveCalls(page);
  await dialog.getByRole("button", { name: "決定", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await currentConfig(page);
  expect(saved.today.items.map((item) => item.text)).toEqual([
    "ドラムの音を1つ選ぶ",
    "ベースの音を1つ決める",
    "音量のバランスを整える",
  ]);
  expect(saved.today.items.every((item) => item.projectId === MUSIC.id)).toBe(true);
  expect(await saveCalls(page)).toBe(savesBefore + 1);
});

test("V163-B7 2 the quick add makes a wish of the filtered project and 決定 saves inbox and Today3 in one write", async ({
  page,
}) => {
  await prepare(page);
  const dialog = await openPicker(page);
  await pill(page, MUSIC.name).click();

  const input = dialog.getByRole("textbox", { name: "「音づくり」のやりたいことを追加" });
  await expect(input).toHaveAttribute(
    "placeholder",
    "「音づくり」のやりたいことを足して今日へ",
  );
  await expect(input).toHaveAttribute("maxLength", "120");
  await input.fill("イントロの音を1つ選ぶ");
  await input.press("Enter");

  // The wish shows up as a candidate of that project, and joins Today3 at once (room was free).
  const addedRow = wishlistSection(page).locator(".todayPickerRow", {
    hasText: "イントロの音を1つ選ぶ",
  });
  await expect(addedRow).toHaveCount(1);
  await expect(addedRow).toHaveAttribute("data-project-color", "rose");
  await expect(addedRow).toContainText(MUSIC.name);
  await expect(selectedRows(page)).toHaveCount(1);
  await expect(selectedRows(page)).toContainText("イントロの音を1つ選ぶ");
  await expect(input).toHaveValue("");
  // Nothing is written yet (single save point).
  expect((await currentConfig(page)).inbox).toHaveLength(5);

  const savesBefore = await saveCalls(page);
  await dialog.getByRole("button", { name: "決定", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await saveCalls(page)).toBe(savesBefore + 1);
  const saved = await currentConfig(page);
  expect(saved.inbox).toHaveLength(6);
  expect(saved.inbox[5]).toMatchObject({
    text: "イントロの音を1つ選ぶ",
    projectId: MUSIC.id,
  });
  expect(saved.today.items).toHaveLength(1);
  expect(saved.today.items[0]).toMatchObject({
    text: "イントロの音を1つ選ぶ",
    projectId: MUSIC.id,
  });

  // With すべて the quick add makes an unassigned wish, and the ＋ 追加 button works too.
  await openPicker(page);
  const allInput = dialogOf(page).getByRole("textbox", { name: "やりたいことを追加" });
  await expect(allInput).toHaveAttribute("placeholder", "やりたいことを足して今日へ");
  await allInput.fill("ガラスを1枚ふく");
  await dialogOf(page).getByRole("button", { name: "＋ 追加" }).click();
  const looseRow = wishlistSection(page).locator(".todayPickerRow", {
    hasText: "ガラスを1枚ふく",
  });
  await expect(looseRow).toHaveCount(1);
  await expect(looseRow).toContainText("未分類");
});

test("V163-B7 3 cancelling after a quick add discards the wish from both the inbox and Today3", async ({
  page,
}) => {
  await prepare(page);
  const dialog = await openPicker(page);
  await pill(page, HOME.name).click();
  const input = dialog.getByRole("textbox", {
    name: `「${HOME.name}」のやりたいことを追加`,
  });
  await input.fill("窓を10分だけ開ける");
  await input.press("Enter");
  await expect(selectedRows(page)).toHaveCount(1);

  // A pending quick-add line alone also counts as unsaved.
  await input.fill("まだ送っていない行");
  await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" });
  await expect(confirmation).toBeVisible();
  await page.getByRole("button", { name: "破棄して閉じる" }).click();
  await expect(dialog).toHaveCount(0);

  const saved = await currentConfig(page);
  expect(saved.inbox).toHaveLength(5);
  expect(saved.inbox.some((item) => item.text === "窓を10分だけ開ける")).toBe(false);
  expect(saved.today.items).toHaveLength(0);
  expect(await saveCalls(page)).toBe(0);
});

test("V163-B7 4 a full Today3 keeps the fourth wish as a candidate, protects the input, and fits 860x560", async ({
  page,
}) => {
  await prepare(page, { width: 860, height: 560 });
  const dialog = await openPicker(page);
  const addButtons = page.locator(
    '[data-today-picker-section="next-step"] .todayPickerAddButton',
  );
  for (let index = 0; index < 3; index += 1) await addButtons.first().click();
  await expect(selectedRows(page)).toHaveCount(3);

  const input = dialog.getByRole("textbox", { name: "やりたいことを追加" });
  await input.fill("4件目になるやりたいこと");
  await input.press("Enter");
  await expect(page.getByText("今日の3件は3件埋まっています。候補に追加しました")).toBeVisible();
  await expect(selectedRows(page)).toHaveCount(3);
  await expect(
    wishlistSection(page).locator(".todayPickerRow", { hasText: "4件目になるやりたいこと" }),
  ).toHaveCount(1);

  // An empty (or blank) line adds nothing.
  await input.fill("   ");
  await input.press("Enter");
  await expect(
    page.locator(".todayPickerRow", { hasText: "4件目になるやりたいこと" }),
  ).toHaveCount(1);
  await input.fill("");
  await input.press("Enter");
  await expect(selectedRows(page)).toHaveCount(3);

  // A long line is capped at 120 characters, like addInboxItem.
  await input.fill("あ".repeat(200));
  await input.press("Enter");
  const addedTexts = await page
    .locator('[data-today-picker-section="wishlist"] .todayPickerTask')
    .allTextContents();
  expect(addedTexts.some((text) => text.length === 120)).toBe(true);

  // Enter while an IME conversion is running does not send the line.
  await input.fill("変換中のEnterは送らない");
  const beforeIme = await page
    .locator('[data-today-picker-section="wishlist"] .todayPickerRow')
    .count();
  await input.evaluate((element) => {
    element.dispatchEvent(
      new KeyboardEvent("keydown", { bubbles: true, cancelable: true, key: "Enter", isComposing: true }),
    );
  });
  await expect(input).toHaveValue("変換中のEnterは送らない");
  expect(
    await page.locator('[data-today-picker-section="wishlist"] .todayPickerRow').count(),
  ).toBe(beforeIme);
  expect(
    await page
      .locator('[data-today-picker-section="wishlist"] .todayPickerRow', {
        hasText: "変換中のEnterは送らない",
      })
      .count(),
  ).toBe(0);

  // 860x560: nothing spills out sideways and the footer stays reachable.
  const overflow = await dialog.evaluate((root) => ({
    dialog: root.scrollWidth - root.clientWidth,
    bar: root.querySelector<HTMLElement>(".todayPickerFilterBar")!.scrollWidth -
      root.querySelector<HTMLElement>(".todayPickerFilterBar")!.clientWidth,
  }));
  expect(overflow.dialog).toBeLessThanOrEqual(0);
  expect(overflow.bar).toBeGreaterThanOrEqual(0);
  for (const name of ["決定", "キャンセル"]) {
    await expect(dialog.getByRole("button", { name, exact: true })).toBeInViewport({ ratio: 1 });
  }
});
