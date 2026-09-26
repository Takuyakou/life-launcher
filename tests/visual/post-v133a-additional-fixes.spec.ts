import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1000, height: 720 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".sidebar")).toBeVisible();
}

async function openBuilder(page: Page, group?: string) {
  await (
    group ? page.locator(".quickGroupHeader", { hasText: group }) : page.locator(".brandBlock")
  ).click({ button: "right" });
  await page.getByRole("menuitem", { name: "ボタンを追加" }).click();
  return page.getByRole("dialog", { name: "Button Builder" });
}

test("static chrome cannot be text-selected while editable fields remain selectable", async ({
  page,
}) => {
  await prepare(page);
  const styles = await page.evaluate(() => ({
    sidebar: getComputedStyle(document.querySelector(".sidebar")!).userSelect,
    main: getComputedStyle(document.querySelector(".mainPanel")!).userSelect,
    topBar: getComputedStyle(document.querySelector(".topBar")!).userSelect,
    disclosure: getComputedStyle(document.querySelector(".disclosureHeader")!).userSelect,
    brandDraggable: (document.querySelector(".brandIcon") as HTMLImageElement).draggable,
  }));
  expect(styles).toMatchObject({
    sidebar: "none",
    main: "none",
    topBar: "none",
    disclosure: "none",
    brandDraggable: false,
  });
  const brand = page.locator(".brandCopy");
  const box = await brand.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + 2, box!.y + 8);
  await page.mouse.down();
  await page.mouse.move(box!.x + box!.width - 4, box!.y + 25, { steps: 8 });
  await page.mouse.up();
  expect(await page.evaluate(() => window.getSelection()?.toString())).toBe("");
  const dialog = await openBuilder(page);
  const input = dialog.getByRole("textbox", { name: "ラベル" });
  await input.fill("選択できます");
  await input.selectText();
  expect(await input.evaluate((element) => (element as HTMLInputElement).selectionStart)).toBe(0);
});

test("internal asset URL is ignored but an external URL still opens Drop Register", async ({
  page,
}) => {
  await prepare(page);
  await page.evaluate(() => {
    const shell = document.querySelector(".appShell")!;
    const drop = (url: string) => {
      const data = new DataTransfer();
      data.setData("text/uri-list", url);
      shell.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }),
      );
    };
    drop(`${location.origin}/life-launcher-icon.svg`);
  });
  await expect(page.getByRole("dialog", { name: "ボタン登録" })).toHaveCount(0);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/uri-list", "http://asset.localhost/icon.svg");
    document
      .querySelector(".appShell")!
      .dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }),
      );
  });
  await expect(page.getByRole("dialog", { name: "ボタン登録" })).toHaveCount(0);
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/uri-list", "https://example.com/external.svg");
    document
      .querySelector(".appShell")!
      .dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }),
      );
  });
  await expect(page.getByRole("dialog", { name: "ボタン登録" })).toBeVisible();
});

test("saved empty groups remain visible after reload; no phantom group appears with no groups", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.buttons = [];
  fixture.config.groups = ["空グループ"];
  await prepare(page, fixture);
  await expect(page.locator(".quickGroupHeader", { hasText: "空グループ" })).toContainText("0");
  await page.reload();
  await expect(page.locator(".quickGroupHeader", { hasText: "空グループ" })).toContainText("0");
  await page.evaluate(() => {
    const qa = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          updateConfig: (config: VisualQaFixture["config"]) => void;
          currentConfig: () => VisualQaFixture["config"];
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    qa.updateConfig({ ...qa.currentConfig(), groups: [] });
  });
  await expect(page.locator(".quickGroupHeader")).toHaveCount(0);
  await expect(page.getByText("サイドバー表示の項目がありません")).toBeVisible();
});

test("group context preselects group and manual URL saves through shared registration", async ({
  page,
}) => {
  await prepare(page);
  const dialog = await openBuilder(page, "資料");
  await expect(dialog.getByRole("combobox", { name: "既存のグループ" })).toHaveValue("資料");
  await dialog.getByRole("button", { name: "URL" }).click();
  await dialog.getByRole("textbox", { name: "URL", exact: true }).fill("https://example.com/new");
  await dialog.getByRole("textbox", { name: "ラベル" }).fill("新しい資料");
  await expect(dialog.getByText("https://example.com/new", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "追加", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await page.evaluate(() => {
    const qa = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => VisualQaFixture["config"] };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    return qa.currentConfig().buttons.find((button) => button.label === "新しい資料");
  });
  expect(saved?.group).toBe("資料");
  expect(saved?.actions[0]).toEqual({
    type: "open_url",
    payload: { url: "https://example.com/new" },
  });
});

test("manual Builder cancel does not save and incomplete target keeps draft", async ({ page }) => {
  await prepare(page);
  const dialog = await openBuilder(page);
  await dialog.getByRole("button", { name: "追加", exact: true }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "キャンセル" }).click();
  await expect(dialog).toHaveCount(0);
});

test("Do Now excludes by project identity even when candidate labels match", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects[1].name = fixture.config.projects[0].name;
  fixture.config.projects[0].nextStep!.shortTimerMinutes = 1;
  fixture.config.today.items = [{ text: "別の項目", done: false, sourceKey: "manual:other" }];
  await prepare(page, fixture);
  await page.locator(".doNowStartPrimary").click();
  await page.clock.runFor(60_500);
  await page.getByRole("button", { name: "終わる" }).click();
  await page.getByRole("button", { name: "次の一手を見る" }).click();
  await expect(page.locator(".doNowContent")).toContainText(
    fixture.config.projects[1].nextStep!.text,
  );
  await expect(page.locator(".doNowContent")).not.toContainText(
    fixture.config.projects[0].nextStep!.text,
  );
});

test("File picker populates target and saves a file button in an empty group", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.groups.push("空グループ");
  await prepare(page, fixture);
  await page.evaluate(() => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { setLauncherPickerResult: (value: string | null) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setLauncherPickerResult("C:\\PublicDemo\\guide.txt");
  });
  const dialog = await openBuilder(page, "空グループ");
  await dialog.getByRole("button", { name: "参照..." }).click();
  await expect(dialog.getByRole("textbox", { name: "ファイル", exact: true })).toHaveValue(
    "C:\\PublicDemo\\guide.txt",
  );
  await expect(dialog.getByRole("textbox", { name: "ラベル" })).toHaveValue("guide");
  await dialog.getByRole("button", { name: "追加", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(
    page.locator(".quickGroup", { hasText: "空グループ" }).locator(".quickButton"),
  ).toContainText("guide");
});

test("Folder picker saves folder; picker cancel leaves the draft and config intact", async ({
  page,
}) => {
  await prepare(page);
  const dialog = await openBuilder(page);
  await dialog.getByRole("button", { name: "フォルダ" }).click();
  await page.evaluate(() => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { setLauncherPickerResult: (value: string | null) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setLauncherPickerResult(null);
  });
  await dialog.getByRole("button", { name: "参照..." }).click();
  await expect(dialog.getByRole("textbox", { name: "フォルダ", exact: true })).toHaveValue("");
  await page.evaluate(() => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { setLauncherPickerResult: (value: string | null) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setLauncherPickerResult("C:\\PublicDemo\\Samples\\");
  });
  await dialog.getByRole("button", { name: "参照..." }).click();
  await expect(dialog.getByRole("textbox", { name: "ラベル" })).toHaveValue("Samples");
  await dialog.getByRole("button", { name: "追加", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const action = await page.evaluate(() => {
    const qa = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => VisualQaFixture["config"] };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    return qa.currentConfig().buttons.find((button) => button.label === "Samples")?.actions[0];
  });
  expect(action?.type).toBe("open_folder");
});

test("Builder keeps edits on save failure and supports new group and Dictionary page", async ({
  page,
}) => {
  await prepare(page);
  const dialog = await openBuilder(page);
  await dialog.getByRole("button", { name: "URL" }).click();
  await dialog.getByRole("textbox", { name: "URL", exact: true }).fill("https://example.com/book");
  await dialog.getByRole("textbox", { name: "ラベル" }).fill("本");
  await dialog.getByRole("button", { name: "新規グループを作成" }).click();
  await dialog.getByRole("textbox", { name: "新しいグループ名" }).fill("読書");
  await dialog.getByRole("combobox", { name: "辞書ページ" }).selectOption("reference");
  await page.evaluate(() => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { setSaveConfigFailure: (value: boolean) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true);
  });
  await dialog.getByRole("button", { name: "追加", exact: true }).click();
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("textbox", { name: "ラベル" })).toHaveValue("本");
  await page.evaluate(() => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { setSaveConfigFailure: (value: boolean) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(false);
  });
  await dialog.getByRole("button", { name: "追加", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  const saved = await page.evaluate(() => {
    const qa = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => VisualQaFixture["config"] };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = qa.currentConfig();
    return {
      groups: config.groups,
      button: config.buttons.find((button) => button.label === "本"),
    };
  });
  expect(saved.groups).toContain("読書");
  expect(saved.button?.group).toBe("読書");
  expect(saved.button?.overlayPageId).toBe("reference");
});

test("creating an empty group shows it immediately; deleting the last button keeps its group", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.groups = ["最後の1件"];
  fixture.config.buttons = [{ ...fixture.config.buttons[0], group: "最後の1件" }];
  await prepare(page, fixture);
  await page.locator(".brandBlock").click({ button: "right" });
  await page.getByRole("menuitem", { name: "グループを追加" }).click();
  const groupDialog = page.getByRole("dialog", { name: "グループ追加" });
  await groupDialog.getByRole("textbox", { name: "グループ名" }).fill("新しい空グループ");
  await groupDialog.getByRole("button", { name: "追加", exact: true }).click();
  await expect(page.locator(".quickGroupHeader", { hasText: "新しい空グループ" })).toContainText(
    "0",
  );

  await page
    .locator(".quickGroup", { hasText: "最後の1件" })
    .locator(".quickButton")
    .click({ button: "right" });
  await page.getByRole("menuitem", { name: "削除", exact: true }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await expect(page.locator(".quickGroupHeader", { hasText: "最後の1件" })).toContainText("0");
  await page.reload();
  await expect(page.locator(".quickGroupHeader", { hasText: "最後の1件" })).toContainText("0");
  await expect(page.locator(".quickGroupHeader", { hasText: "新しい空グループ" })).toContainText(
    "0",
  );
});

test("explicitly deleting an empty group removes only that group", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.groups = ["空A", "空B"];
  fixture.config.buttons = [];
  await prepare(page, fixture);
  await page.locator(".quickGroupHeader", { hasText: "空A" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "空Aを削除" }).click();
  await page.getByRole("button", { name: "削除する" }).click();
  await expect(page.locator(".quickGroupHeader", { hasText: "空A" })).toHaveCount(0);
  await expect(page.locator(".quickGroupHeader", { hasText: "空B" })).toContainText("0");
});

test("P133A deterministic visual QA captures key states", async ({ page }, testInfo) => {
  const fixture = createPublicFixture();
  fixture.config.groups.push("空グループ");
  fixture.config.projects[0].nextStep!.shortTimerMinutes = 1;
  fixture.config.today.items = [{ text: "別の項目", done: false, sourceKey: "manual:other" }];
  await prepare(page, fixture);
  const capture = async (name: string) => {
    await page.screenshot({ path: testInfo.outputPath(`${name}.png`), animations: "disabled" });
  };

  await capture("01-main-normal-empty-group");
  await page.locator(".brandBlock").click({ button: "right" });
  await capture("02-sidebar-context-menu");
  await page.getByRole("menuitem", { name: "ボタンを追加" }).click();
  const dialog = page.getByRole("dialog", { name: "Button Builder" });
  await capture("03-button-builder-file");
  await dialog.getByRole("button", { name: "フォルダ" }).click();
  await capture("04-button-builder-folder");
  await dialog.getByRole("button", { name: "URL" }).click();
  await capture("05-button-builder-url");
  await dialog.getByRole("button", { name: "キャンセル" }).click();

  await page.locator(".doNowStartPrimary").hover();
  await capture("06-main-hover");
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/uri-list", "https://example.com/drop-target");
    document
      .querySelector(".appShell")!
      .dispatchEvent(
        new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: data }),
      );
  });
  await capture("07-main-drag-over");
  await page.evaluate(() => {
    const data = new DataTransfer();
    data.setData("text/uri-list", `${location.origin}/life-launcher-icon.svg`);
    document
      .querySelector(".appShell")!
      .dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: data }),
      );
  });

  await page.locator(".doNowStartPrimary").click();
  await page.clock.runFor(60_500);
  await page.getByRole("button", { name: "終わる" }).click();
  await expect(page.locator(".doNowContent--hold")).toBeVisible();
  await capture("08-do-now-complete-hold");
  await page.getByRole("button", { name: "次の一手を見る" }).click();
  await expect(page.locator(".doNowContent")).toContainText("ストレッチ");
  await capture("09-do-now-next-candidate");

  await page.setViewportSize({ width: 860, height: 700 });
  await page.clock.fastForward(4_000);
  await capture("10-narrow-main-empty-group");
});
