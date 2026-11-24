import { expect, test, type Page } from "@playwright/test";
import { createFullTodayFixture, createPickerFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => VisualQaFixture["config"];
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
  };
};

async function open(
  page: Page,
  fixture: VisualQaFixture = createPickerFixture(),
  view: "main" | "dictionary" = "main",
  size = { width: 1080, height: 680 },
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(size);
  await installTauriMock(page, fixture, view);
  await page.goto(view === "dictionary" ? "/?view=dictionary" : "/");
  await waitForBundledFonts(page);
  if (view === "main") await expect(page.locator(".doNowBand")).toBeVisible();
}

async function openSettings(page: Page, tab?: string) {
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  if (tab) await settings.getByRole("tab", { name: tab }).click();
  return settings;
}

// 1. English eyebrows ----------------------------------------------------------------------

// 2. Day start unit ---------------------------------------------------------------------------

test("P9-10 the day start field shows 時 on the right and keeps its meaning and stored value", async ({
  page,
}) => {
  await open(page);
  const settings = await openSettings(page, "基本");
  const field = settings.locator("label", { hasText: "日付切替時刻" });
  await expect(field.locator(".numberDragUnit")).toHaveText("時");
  // The other number fields do not get a unit.
  await expect(settings.locator("label", { hasText: "通常タイマー分数" }).locator(".numberDragUnit")).toHaveCount(0);

  const input = field.locator("input");
  await expect(input).toHaveValue("4");
  // The unit sits to the right of the number, left of the spin affordance, and does not cover the input text.
  const unit = (await field.locator(".numberDragUnit").boundingBox())!;
  const spin = (await field.locator(".numberDragAffordance").boundingBox())!;
  const box = (await input.boundingBox())!;
  expect(unit.x).toBeGreaterThan(box.x + box.width / 2);
  expect(unit.x + unit.width).toBeLessThanOrEqual(spin.x);

  await input.fill("5");
  await settings.getByRole("button", { name: "保存" }).click();
  await expect(settings).toHaveCount(0);
  const saved = await page.evaluate(() => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig());
  expect(saved.settings.dayStartHour).toBe(5);
});

// 3. Mini timer setting -----------------------------------------------------------------------

test("P9-10 the mini setting is named 'use the mini timer' and the top bar has no Mini button", async ({
  page,
}) => {
  await open(page);
  const settings = await openSettings(page, "基本");
  await expect(settings.getByRole("checkbox", { name: "ミニタイマーを使う" })).toBeChecked();
  await expect(settings.getByRole("checkbox", { name: "ミニモード", exact: true })).toHaveCount(0);

  await settings.getByRole("checkbox", { name: "ミニタイマーを使う" }).uncheck();
  await settings.getByRole("button", { name: "保存" }).click();
  await expect(settings).toHaveCount(0);
  const saved = await page.evaluate(() => (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig());
  expect(saved.settings.miniMode).toBe(false);
  // P10-02 (D5): the top bar no longer has a Mini button at all; the setting still gates
  // the remaining mini entries (the timer dock button, the expanded timer and the hotkey).
  await expect(page.getByRole("button", { name: "ミニタイマーへ切り替え" })).toHaveCount(0);
  await expect(page.getByText("ミニモード")).toHaveCount(0);
});

// 4. Shortcut hints ---------------------------------------------------------------------------

test("P9-10 an unset shortcut shows 未設定 once; the line below appears only for the other states", async ({
  page,
}) => {
  const fixture = createPickerFixture();
  fixture.config.settings.miniHotkey = null;
  await open(page, fixture);
  const settings = await openSettings(page, "ショートカット");

  const unset = settings.locator(".shortcutCaptureField", { hasText: "ミニタイマー切替" });
  await expect(unset.locator("kbd")).toHaveText("未設定");
  await expect(unset.locator("small")).toHaveCount(0);

  const registered = settings.locator(".shortcutCaptureField", { hasText: "辞書" });
  await expect(registered.locator("kbd")).toHaveText("Ctrl+K");
  await expect(registered.locator("small")).toHaveText("登録済み（保存時に再登録）");

  // Recording shows its instruction line, and an unset field stays free of the "未設定" hint.
  await unset.getByRole("button", { name: "登録" }).click();
  await expect(unset.locator("small")).toHaveText("キーの組み合わせを押してください。Escapeで取消");
  await page.keyboard.press("Escape");
  await expect(unset.locator("small")).toHaveCount(0);
  await expect(settings.locator("small", { hasText: /^未設定$/ })).toHaveCount(0);
});

test("P9-10 shortcut inputs in the same row share one top whether or not they have a line below", async ({
  page,
}) => {
  const fixture = createPickerFixture();
  fixture.config.settings.miniHotkey = null;
  await open(page, fixture);
  const settings = await openSettings(page, "ショートカット");
  const fields = settings.locator(".shortcutCaptureField");
  await expect(fields).toHaveCount(4);
  const boxes = await fields.evaluateAll((nodes) =>
    nodes.map((node) => {
      const field = node.getBoundingClientRect();
      const control = node.querySelector(".shortcutCaptureControl")!.getBoundingClientRect();
      return { fieldTop: field.top, controlTop: control.top, hasLine: Boolean(node.querySelector("small")) };
    }),
  );
  // Both kinds exist: with the line (registered) and without it (unset).
  expect(boxes.some((box) => box.hasLine)).toBe(true);
  expect(boxes.some((box) => !box.hasLine)).toBe(true);
  // The input sits at the same distance from its field's top, so fields in one row have equal input tops.
  const offsets = boxes.map((box) => Math.round(box.controlTop - box.fieldTop));
  expect(new Set(offsets).size).toBe(1);
  for (const a of boxes) {
    for (const b of boxes) {
      if (Math.abs(a.fieldTop - b.fieldTop) < 1) expect(Math.abs(a.controlTop - b.controlTop)).toBeLessThan(1);
    }
  }
});

test("P9-10 a conflicting shortcut still shows its warning line", async ({ page }) => {
  const fixture = createPickerFixture();
  fixture.config.settings.miniHotkey = fixture.config.settings.launcherHotkey;
  await open(page, fixture);
  const settings = await openSettings(page, "ショートカット");
  const conflict = settings.locator(".shortcutCaptureField--conflict").first();
  await expect(conflict.locator("small")).toContainText("と競合");
});

// 5. Maintenance note -------------------------------------------------------------------------

test("P9-10 the maintenance tab starts with a note, and the footer buttons stay", async ({ page }) => {
  await open(page);
  const settings = await openSettings(page, "メンテナンス");
  const section = settings.locator(".settingsSection:not(.settingsSection--hidden)");
  await expect(section.locator("h3")).toHaveText("メンテナンス");
  const note = section.locator("h3 + p");
  await expect(note).toHaveText("このタブの操作は押すとすぐ実行されます。保存は不要です。");
  const noteBox = (await note.boundingBox())!;
  const firstGroup = (await section.locator(".maintenanceGroups").boundingBox())!;
  expect(noteBox.y + noteBox.height).toBeLessThanOrEqual(firstGroup.y);
  await expect(settings.getByRole("button", { name: "保存" })).toBeVisible();
  await expect(settings.getByRole("button", { name: "キャンセル" })).toBeVisible();
  // Other tabs do not get the note.
  await settings.getByRole("tab", { name: "基本" }).click();
  await expect(settings.getByText("このタブの操作は押すとすぐ実行されます").locator("visible=true")).toHaveCount(0);
});

// 6. Save / cancel text size ------------------------------------------------------------------

// 7. Records back button ----------------------------------------------------------------------

test("P9-10 the Records screen has one back button, in the top menu, and the top menu stays visible while scrolling", async ({
  page,
}) => {
  await open(page, createFullTodayFixture(), "main", { width: 860, height: 560 });
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  const records = page.locator(".recordsView");
  await expect(records).toBeVisible();
  // One "メイン" back button: the top menu one. The tab row has none.
  await expect(page.locator(".recordsBackButton")).toHaveCount(0);
  await expect(records.getByRole("button", { name: /メイン/ })).toHaveCount(0);
  const back = page.getByRole("button", { name: "メイン画面に戻る" });
  await expect(back).toHaveCount(1);
  await expect(back).toContainText("メイン");
  await expect(records.getByRole("tablist", { name: "記録の表示" })).toBeVisible();

  // The top menu does not scroll away with the Records content.
  const topBar = page.locator(".topBar");
  const before = (await topBar.boundingBox())!;
  await records.getByRole("tab", { name: "すべての記録" }).click();
  await page.locator(".mainScrollArea").evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expect.poll(() => page.locator(".mainScrollArea").evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const after = (await topBar.boundingBox())!;
  expect(after.y).toBe(before.y);
  expect(after.y).toBeGreaterThanOrEqual(0);
  await expect(back).toBeInViewport({ ratio: 1 });

  await back.click();
  await expect(records).toHaveCount(0);
  await expect(page.locator(".doNowBand")).toBeVisible();
});

// 8. Older notes -------------------------------------------------------------------------------

async function openAllRecords(page: Page) {
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  const records = page.locator(".recordsView");
  await records.getByRole("tab", { name: "すべての記録" }).click();
  return records;
}

test("P9-10 the older notes disclosure has an arrow, shows the day count, and toggles", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.notesHistory = [
    { date: "2026-08-12", items: ["a", "", ""] },
    { date: "2026-08-11", items: ["b", "", ""] },
    { date: "2026-08-10", items: ["c", "", ""] },
  ];
  await open(page, fixture);
  const records = await openAllRecords(page);
  const older = records.locator(".recordsOlderNotes");
  const summary = older.locator("summary");
  await expect(summary).toHaveText("以前のメモ（3日）");
  // The same chevron icons as the other disclosures, and the native marker is not the indicator.
  await expect(summary.locator("svg")).toHaveCount(1);
  const closedIcon = await summary.locator("svg").evaluate((svg) => svg.innerHTML);
  await expect(older).not.toHaveAttribute("open", "");

  const iconHtml = () => summary.locator("svg").evaluate((svg) => svg.innerHTML);
  await summary.click();
  await expect(older).toHaveAttribute("open", "");
  await expect.poll(iconHtml).not.toBe(closedIcon);
  await expect(older.getByRole("textbox").first()).toBeVisible();
  await summary.click();
  await expect(older).not.toHaveAttribute("open", "");
  await expect.poll(iconHtml).toBe(closedIcon);
});

test("P9-10 the older notes show no day count when there are none, and keep their empty message", async ({
  page,
}) => {
  const fixture = createFullTodayFixture();
  fixture.notesHistory = [];
  await open(page, fixture);
  const records = await openAllRecords(page);
  const older = records.locator(".recordsOlderNotes");
  await expect(older.locator("summary")).toHaveText("以前のメモ");
  await older.locator("summary").click();
  await expect(older.getByText("以前のメモはありません。", { exact: true })).toBeVisible();
});
