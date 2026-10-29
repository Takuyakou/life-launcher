import { expect, test, type Locator, type Page } from "@playwright/test";
import { createFullTodayFixture, createPickerFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

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
  if (view === "main") await expect(page.locator(".doNowBand")).toBeVisible();
}

const styleOf = (locator: Locator) =>
  locator.evaluate((element) => {
    const style = getComputedStyle(element);
    return { fontSize: style.fontSize, fontWeight: style.fontWeight, color: style.color };
  });

const token = (page: Page, name: string) =>
  page.evaluate((tokenName) => {
    const probe = document.createElement("div");
    probe.style.setProperty("color", `var(${tokenName})`);
    document.body.appendChild(probe);
    const value = getComputedStyle(probe).color;
    probe.remove();
    return value;
  }, name);

async function openSettings(page: Page, tab?: string) {
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  if (tab) await settings.getByRole("tab", { name: tab }).click();
  return settings;
}

// 1. English eyebrows ----------------------------------------------------------------------

test("P9-10 the Wishlist edit dialog and the Dictionary window share the same English eyebrows as their siblings", async ({
  page,
}) => {
  await open(page);
  await page.locator(".inboxBand .disclosure").click();
  await page.locator('[data-inbox-id="sample-weekend"]').click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集" }).click();
  const edit = page.getByRole("dialog", { name: "やりたいこと編集" });
  await expect(edit.getByRole("heading", { level: 2 })).toHaveText("やりたいことを編集");
  await expect(edit.locator(".eyebrow")).toHaveText("Wishlist");
  await page.keyboard.press("Escape");

  // The add dialog already says Wishlist: same word for the same object.
  await page.getByRole("button", { name: "やりたいことを追加", exact: true }).first().click();
  await expect(
    page.getByRole("dialog", { name: /やりたいことを追加/ }).locator(".eyebrow"),
  ).toHaveText("Wishlist");
});

test("P9-10 the Dictionary window settings dialog uses the Dictionary eyebrow", async ({ page }) => {
  // The in-Main dictionary overlay (eyebrow now "Dictionary" too) is switched off in the app
  // (`{false && launcherOverlayOpen && ...}`), so the visible dialog of this object is the window's settings.
  await open(page, createFullTodayFixture(), "dictionary", { width: 1000, height: 640 });
  await page.getByRole("button", { name: "辞書の設定" }).click();
  const dialog = page.getByRole("dialog", { name: "辞書の設定" });
  await expect(dialog.locator(".eyebrow")).toHaveText("Dictionary");
});

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

test("P9-10 the mini setting is named 'use the mini timer' and still only gates the Mini button", async ({
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
  // Same stored key, same effect: the top menu Mini button is disabled.
  await expect(page.getByRole("button", { name: "ミニタイマーへ切り替え" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "ミニタイマーへ切り替え" })).toHaveAttribute(
    "title",
    "設定で「ミニタイマーを使う」をオンにしてください",
  );
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

async function expectSameSize(save: Locator, cancel: Locator) {
  const a = await styleOf(save);
  const b = await styleOf(cancel);
  expect(a.fontSize, "font-size").toBe(b.fontSize);
  expect(a.fontWeight, "font-weight").toBe(b.fontWeight);
  return { save: a, cancel: b };
}

test("P9-10 save and cancel have the same text size in the Next Step edit dialog, with the colours unchanged", async ({
  page,
}) => {
  await open(page);
  await page
    .locator(".nextStepCard", { hasText: "資料を1ページ読む" })
    .getByRole("button", { name: "編集", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "次の一手を編集" });
  const { save, cancel } = await expectSameSize(
    dialog.getByRole("button", { name: "保存", exact: true }),
    dialog.getByRole("button", { name: "キャンセル", exact: true }),
  );
  expect(save.color).toBe(await token(page, "--good"));
  expect(cancel.color).toBe("rgb(255, 180, 173)");
});

test("P9-10 save and cancel have the same text size in the other Main dialogs", async ({ page }) => {
  await open(page);
  const pairs: Array<[string, () => Promise<Locator>]> = [
    [
      "project add",
      async () => {
        await page.getByRole("button", { name: "プロジェクトを追加", exact: true }).first().click();
        return page.getByRole("dialog", { name: "プロジェクトを追加" });
      },
    ],
    [
      "wishlist add",
      async () => {
        await page.getByRole("button", { name: "やりたいことを追加", exact: true }).first().click();
        return page.getByRole("dialog", { name: /やりたいことを追加/ });
      },
    ],
    [
      "group rename",
      async () => {
        await page.locator(".quickGroupHeader").first().click({ button: "right" });
        await page.getByRole("menuitem", { name: "名前を変更" }).click();
        return page.getByRole("dialog", { name: "グループ名変更" });
      },
    ],
    [
      "button builder",
      async () => {
        await page.locator(".quickGroupHeader").first().click({ button: "right" });
        await page.getByRole("menuitem", { name: "ボタンを追加" }).click();
        return page.getByRole("dialog").last();
      },
    ],
    [
      "settings",
      async () => {
        await page.getByRole("button", { name: "設定を開く" }).click();
        return page.getByRole("dialog", { name: "設定" });
      },
    ],
    [
      "today picker",
      async () => {
        await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
        return page.getByRole("dialog", { name: "今日やるものを選ぶ" });
      },
    ],
  ];
  for (const [name, openDialog] of pairs) {
    const dialog = await openDialog();
    await expect(dialog, name).toBeVisible();
    const actions = dialog.locator(
      ".dialogActions, .todayPickerActions, .settingsDialog > .dialogActions",
    ).last();
    const buttons = actions.getByRole("button");
    const count = await buttons.count();
    // The last two buttons are always the positive action and cancel.
    await expectSameSize(buttons.nth(count - 2), buttons.nth(count - 1));
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "破棄して閉じる" }).click({ timeout: 300 }).catch(() => undefined);
    await expect(dialog, name).toHaveCount(0);
  }
});

test("P9-10 save and cancel have the same text size in the Dictionary window settings", async ({ page }) => {
  await open(page, createFullTodayFixture(), "dictionary", { width: 1000, height: 640 });
  await page.getByRole("button", { name: "辞書の設定" }).click();
  const dialog = page.getByRole("dialog", { name: "辞書の設定" });
  const { save, cancel } = await expectSameSize(
    dialog.getByRole("button", { name: "保存" }),
    dialog.getByRole("button", { name: "キャンセル" }),
  );
  expect(save.color).toBe("rgb(111, 207, 151)");
  expect(cancel.color).toBe("rgb(255, 180, 173)");
});

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
