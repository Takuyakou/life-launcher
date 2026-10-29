import { expect, test, type Locator, type Page } from "@playwright/test";
import { createFullTodayFixture, createPickerFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => VisualQaFixture["config"];
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
  };
};

const PROJECT = "サンプル学習";
const NEXT_STEP = "資料を1ページ読む";
const TEMPLATE = "テンプレート本文: ここから始める";

async function open(page: Page, fixture: VisualQaFixture = createFullTodayFixture()) {
  fixture.config.projects[0].nextStep!.shortTimerMinutes = 1;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1080, height: 680 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

const token = (page: Page, name: string) =>
  page.evaluate((tokenName) => {
    const probe = document.createElement("div");
    probe.style.setProperty("color", `var(${tokenName})`);
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);

const colorOf = (locator: Locator) => locator.evaluate((element) => getComputedStyle(element).color);

const config = (page: Page) =>
  page.evaluate(() => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig());

// 1. Waiting sidebar Timer ------------------------------------------------------------------

test("P9-09 the waiting sidebar Timer clock is neutral, the label shows once, and running keeps the accent", async ({
  page,
}) => {
  await open(page);
  const dock = page.locator(".timerDock");
  const clock = dock.locator(".timerClock");

  await expect(dock.getByText("通常タイマー", { exact: true })).toHaveCount(1);
  await expect(dock.locator(".timerHint")).toHaveCount(0);
  // The group and its input keep their accessible name.
  await expect(dock.locator('[aria-label="通常タイマーの分数"]')).toHaveCount(2);
  await expect(dock.getByRole("spinbutton", { name: "通常タイマーの分数" })).toBeVisible();

  expect(await colorOf(clock)).toBe(await token(page, "--text-muted-readable"));
  // The size does not change.
  await expect(clock).toHaveCSS("font-size", "34px");

  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: "通常タイマー25分で開始" })
    .click();
  await expect(dock.locator(".timerStateBadge")).toHaveText("実行中");
  expect(await colorOf(clock)).toBe(await token(page, "--accent-strong"));
  await expect(clock).toHaveCSS("font-size", "34px");

  await dock.getByRole("button", { name: /一時停止/ }).click();
  await expect(dock.locator(".timerStateBadge")).toHaveText("一時停止");
  expect(await colorOf(clock)).toBe(await token(page, "--warn"));
});

// 2. Today3 counts --------------------------------------------------------------------------

test("P9-09 Today3 shows only the completion count when it has items", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.config.today.items.forEach((item, index) => {
    item.done = index === 0;
  });
  await open(page, fixture);
  const bar = page.locator(".todaySectionBar");
  await expect(bar.locator(".todayCompletionSummary")).toHaveText("1 / 3 完了");
  await expect(bar.locator(".todaySectionCount")).toHaveCount(0);
  await expect(bar).toHaveText("今日の3件1 / 3 完了今日やると決めたもの。タイマーから開始します。");
  // The description stays.
  await expect(bar.locator(".todaySectionDescription")).toHaveText(
    "今日やると決めたもの。タイマーから開始します。",
  );
});

test("P9-09 Today3 shows only 0件 when it is empty", async ({ page }) => {
  await open(page, createPickerFixture());
  const bar = page.locator(".todaySectionBar");
  await expect(bar.locator(".todaySectionCount")).toHaveText("0件");
  await expect(bar.locator(".todayCompletionSummary")).toHaveCount(0);
  await expect(bar).not.toContainText("0 / 0");
  await expect(bar.locator(".todaySectionDescription")).toBeVisible();
});

test("P9-09 the other sections keep their own count displays", async ({ page }) => {
  await open(page);
  await expect(page.locator(".projectsBand .disclosureCount")).toBeVisible();
  await expect(page.locator(".inboxBand .disclosureCount")).toBeVisible();
  await expect(page.locator(".todayActivityBand .disclosureCount")).toBeVisible();
});

// 3 & 4. Next Step card names and menu ------------------------------------------------------

/** Today3 empty, so the Next Step is not locked by an unfinished Today item. */
const openWithoutToday = (page: Page) => open(page, createPickerFixture());

async function openWishlistSection(page: Page) {
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
  await expect(page.locator(".inboxBody")).toBeVisible();
}

test("P9-09 the card button 'edit' keeps the generation and the menu item 'swap' opens the swap dialog", async ({
  page,
}) => {
  await openWithoutToday(page);
  const card = page.locator(".nextStepCard", { hasText: NEXT_STEP });
  await expect(card.getByRole("button", { name: "変更", exact: true })).toHaveCount(0);

  await card.getByRole("button", { name: "編集", exact: true }).click();
  const edit = page.getByRole("dialog", { name: "次の一手を編集" });
  await expect(edit).toBeVisible();
  await expect(edit.getByRole("textbox", { name: "行動" })).toHaveValue(NEXT_STEP);
  await page.keyboard.press("Escape");
  await expect(edit).toHaveCount(0);

  await card.getByRole("button", { name: `${PROJECT}の次の一手の操作` }).click();
  await page.getByRole("menuitem", { name: "別の行動に入れ替える", exact: true }).click();
  // Swapping starts from an empty action (a new generation): a different dialog from "edit".
  const swap = page.getByRole("dialog", { name: "次の一手を入れ替える" });
  await expect(swap).toBeVisible();
  await expect(swap.getByRole("heading", { name: "次の一手を入れ替える" })).toBeVisible();
  await expect(swap.getByRole("textbox", { name: "行動" })).toHaveValue("");
  await expect(page.getByRole("dialog", { name: "次の一手を編集" })).toHaveCount(0);
});

test("P9-09 the swap dialog is titled 'swap' once a wishlist item replaces the current Next Step", async ({
  page,
}) => {
  await openWithoutToday(page);
  await openWishlistSection(page);
  await page.locator('[data-inbox-id="sample-weekend"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "次の一手にする" }).click();
  await expect(page.getByRole("dialog", { name: "次の一手を入れ替える" })).toBeVisible();
});

test("P9-09 the Next Step card menu has no 'manage Projects'; the Project menu still has it", async ({
  page,
}) => {
  await openWithoutToday(page);
  const card = page.locator(".nextStepCard", { hasText: NEXT_STEP });
  await card.getByRole("button", { name: `${PROJECT}の次の一手の操作` }).click();
  const menu = page.getByRole("menu");
  await expect(menu.getByRole("menuitem", { name: "プロジェクトを管理" })).toHaveCount(0);
  await expect(menu.getByRole("menuitem")).toHaveText([
    "プロジェクトを編集",
    "次の一手を編集",
    "別の行動に入れ替える",
    "次の一手を未設定にする",
    "プロジェクトを削除…",
  ]);
  await page.keyboard.press("Escape");

  await openWishlistSection(page);
  await page.locator(".wishlistGroupHeader", { hasText: PROJECT }).click({ button: "right" });
  await expect(
    page.getByRole("menu").getByRole("menuitem", { name: "プロジェクトを管理" }),
  ).toBeVisible();
});

// 5. Empty sidebar group --------------------------------------------------------------------

test("P9-09 an open sidebar group without buttons shows a guide, and a button can still be dragged into it", async ({
  page,
}) => {
  await open(page);
  const empty = page.locator(".quickGroup", { hasText: "リンク" });
  // The group heading is unchanged (name and 0 count) and the guide sits under it.
  await expect(empty.locator(".quickGroupHeader")).toContainText("リンク");
  await expect(empty.locator(".quickGroupHeader small")).toHaveText("0");
  const guide = empty.locator(".quickGroupEmpty");
  await expect(guide).toHaveText("見出しを右クリックしてボタンを追加");
  // It fits on one line (the text height is one line of the 12px / 1.4 style).
  const guideLines = await guide.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    return new Set([...range.getClientRects()].map((rect) => Math.round(rect.top))).size;
  });
  expect(guideLines).toBe(1);
  // Groups that have buttons do not show it.
  await expect(page.locator(".quickGroup", { hasText: "資料" }).locator(".quickGroupEmpty")).toHaveCount(0);
  // A collapsed group shows no guide.
  await empty.locator(".quickGroupHeader").focus();
  await page.keyboard.press("Enter");
  await expect(empty.locator(".quickGroupEmpty")).toHaveCount(0);
  await page.keyboard.press("Enter");
  await expect(guide).toBeVisible();

  // Drag a button from another group onto the guide row.
  const source = page.locator(".quickButton", { hasText: "サンプル資料" });
  const from = (await source.boundingBox())!;
  const to = (await guide.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2 + 12, from.y + from.height / 2, { steps: 2 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, { steps: 6 });
  await page.mouse.up();
  await expect
    .poll(async () => (await config(page)).buttons.find((button) => button.id === "sample-documents")?.group)
    .toBe("リンク");
  await expect(page.locator(".quickGroup", { hasText: "リンク" }).locator(".quickGroupEmpty")).toHaveCount(0);
  await expect(page.locator(".quickGroup", { hasText: "リンク" }).locator(".quickButton")).toContainText(
    "サンプル資料",
  );
});

// 6. Timer complete dialog ------------------------------------------------------------------

async function expectCompleteHeading(page: Page) {
  await page.clock.runFor(60_500);
  const dialog = page.getByRole("dialog", { name: "タイマー満了" });
  await expect(dialog).toBeVisible();
  // The heading is the action text; the Project is the small coloured label above it.
  await expect(dialog.getByRole("heading", { level: 2 })).toHaveText(NEXT_STEP);
  const identity = dialog.locator(".projectIdentity");
  await expect(identity).toHaveCount(1);
  await expect(identity).toContainText(PROJECT);
  const identityBox = (await identity.boundingBox())!;
  const headingBox = (await dialog.getByRole("heading", { level: 2 }).boundingBox())!;
  expect(identityBox.y + identityBox.height).toBeLessThanOrEqual(headingBox.y + 1);
  expect(identityBox.height).toBeLessThan(headingBox.height);
  // Buttons and behaviour are unchanged.
  await expect(dialog.getByRole("button")).toHaveText(["続ける(+15分)", "終わる"]);
  return dialog;
}

test("P9-09 the completion dialog heading is the action text when started from Today3", async ({ page }) => {
  await open(page);
  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: "短時間タイマー1分で開始" })
    .click();
  const dialog = await expectCompleteHeading(page);
  await dialog.getByRole("button", { name: "終わる" }).click();
  await expect(dialog).toHaveCount(0);
});

test("P9-09 the completion dialog heading is the action text when started from Do Now with a start note template", async ({
  page,
}) => {
  const fixture = createPickerFixture();
  fixture.config.projects[0].nextStep!.startNoteTemplate = TEMPLATE;
  await open(page, fixture);
  await page.locator(".doNowStartPrimary").click();
  const dialog = await expectCompleteHeading(page);
  // The template is the recorded note, never the heading.
  await expect(dialog).not.toContainText("テンプレート本文");
  await dialog.getByRole("button", { name: "終わる" }).click();
  const records = await page.evaluate(() =>
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
      (call) => call.command === "record_session",
    ),
  );
  expect(records).toHaveLength(1);
  expect(records[0].args.session).toMatchObject({ note: TEMPLATE });
});

test("P9-09 a long action text wraps in the completion heading without leaving the dialog", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.config.today.items[0].text =
    "とても長い行動文をここに書いても、満了ダイアログの見出しが枠からはみ出したり操作ボタンに重なったりしないことを確かめるための文章です";
  await open(page, fixture);
  await page
    .locator(".todayRow")
    .first()
    .getByRole("button", { name: "短時間タイマー1分で開始" })
    .click();
  await page.clock.runFor(60_500);
  const dialog = page.getByRole("dialog", { name: "タイマー満了" });
  const heading = dialog.getByRole("heading", { level: 2 });
  const dialogBox = (await dialog.boundingBox())!;
  const headingBox = (await heading.boundingBox())!;
  expect(headingBox.x + headingBox.width).toBeLessThanOrEqual(dialogBox.x + dialogBox.width);
  const buttonBox = (await dialog.getByRole("button", { name: "終わる" }).boundingBox())!;
  expect(headingBox.y + headingBox.height).toBeLessThanOrEqual(buttonBox.y);
});
