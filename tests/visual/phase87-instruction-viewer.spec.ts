import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type InstructionRootChoice = {
  name: string;
  path: string;
  available: boolean;
  readOnly: boolean;
} | null;

type VisualControl = {
  invokeCalls: Array<{ command: string }>;
  setInstructionRootChoices: (choices: InstructionRootChoice[]) => void;
  setInstructionRootDelayed: (value: boolean) => void;
  resolveInstructionRootChoice: () => void;
};

async function prepareEmpty(page: Page) {
  const fixture = createPublicFixture();
  fixture.config.settings.instructionFolders = [];
  fixture.config.settings.instructionFolderIdentities = [];
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1000, height: 700 });
  await installTauriMock(page, fixture, "life-launcher-instruction");
  await page.goto("/?view=instruction");
  await expect(page.getByText("手順書フォルダが未登録です")).toBeVisible();
}

test("empty viewer has one folder CTA and cancel returns from pending state", async ({ page }) => {
  await prepareEmpty(page);
  const empty = page.locator(".instructionTreeMessage");
  await expect(empty.getByRole("button", { name: "フォルダを読み込む" })).toHaveCount(1);
  await page.evaluate(() => {
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: VisualControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__?.setInstructionRootChoices([null]);
  });
  await empty.getByRole("button", { name: "フォルダを読み込む" }).click();
  await expect(empty.getByRole("button", { name: "フォルダを読み込む" })).toBeEnabled();
  await expect(page.locator(".toast")).toHaveCount(0);
});

test("pending folder picker suppresses repeated dispatch and selected folder loads", async ({
  page,
}) => {
  await prepareEmpty(page);
  await page.evaluate(() => {
    const qa = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: VisualControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    qa?.setInstructionRootChoices([
      {
        name: "Instructions",
        path: "C:\\PublicDemo\\Instructions",
        available: true,
        readOnly: false,
      },
    ]);
    qa?.setInstructionRootDelayed(true);
  });
  const emptyAction = page.locator(".instructionTreeMessage").getByRole("button");
  await emptyAction.click();
  await expect(emptyAction).toBeDisabled();
  await expect(page.locator(".instructionTreeLoad")).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        (
          window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: VisualControl }
        ).__LIFE_LAUNCHER_VISUAL_QA__?.invokeCalls.filter(
          (call) => call.command === "choose_instruction_root",
        ).length,
    ),
  ).toBe(1);
  await page.evaluate(() => {
    const qa = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: VisualControl })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    qa?.setInstructionRootDelayed(false);
    qa?.resolveInstructionRootChoice();
  });
  await expect(page.locator('.instructionTreeRow[aria-level="1"]')).toContainText("Instructions");
  await expect(page.getByRole("status")).toContainText("読み込みました");
  await expect(page.locator(".toast")).toHaveCount(0);
});

test("viewer toolbar is contextual and uses the current terminology", async ({ page }) => {
  await prepareEmpty(page);
  await expect(page).toHaveTitle("Life Launcher 手順書ビューアー");
  await expect(page.getByRole("button", { name: "手順書を編集" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "手順書ウィンドウを閉じる" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /常に手前/ })).toBeVisible();
  await expect(page.getByRole("button", { name: "ビューアーのサイズを切り替える" })).toBeVisible();
});

test("viewer sidebar resizes within balanced limits and size cycle resets the split", async ({
  page,
}) => {
  await prepareEmpty(page);
  const sidebar = page.locator(".instructionSidebar");
  const divider = page.getByRole("separator", { name: "手順書一覧の幅を調整" });
  const initial = await sidebar.boundingBox();
  const dividerBox = await divider.boundingBox();
  expect(initial).not.toBeNull();
  expect(dividerBox).not.toBeNull();

  await page.mouse.move(dividerBox!.x + dividerBox!.width / 2, dividerBox!.y + 120);
  await page.mouse.down();
  await page.mouse.move(dividerBox!.x + 170, dividerBox!.y + 120);
  await page.mouse.up();
  expect((await sidebar.boundingBox())!.width).toBeGreaterThan(initial!.width + 100);

  await divider.focus();
  await page.keyboard.press("End");
  const workspace = await page.locator(".instructionWorkspace").boundingBox();
  const maximum = await sidebar.boundingBox();
  expect(maximum!.width).toBeLessThanOrEqual(440);
  expect(maximum!.width).toBeLessThanOrEqual(workspace!.width * 0.45 + 1);
  expect(workspace!.width - maximum!.width - 7).toBeGreaterThanOrEqual(320);

  await page.getByRole("button", { name: "ビューアーのサイズを切り替える" }).click();
  await expect.poll(async () => (await sidebar.boundingBox())?.width).toBeCloseTo(248, 0);
});

test("file and folder menus only unregister their containing root", async ({ page }) => {
  await installTauriMock(page, createPublicFixture(), "life-launcher-instruction");
  await page.goto("/?view=instruction");
  const root = page.locator('.instructionTreeRow[aria-level="1"]').first();
  await root.getByRole("button", { name: /を展開する/ }).click();
  const file = page.locator(".instructionTreeRow", { hasText: "guide.md" });
  await expect(file).toBeVisible();
  await file.click({ button: "right" });
  const menu = page.getByRole("menu", { name: "手順書操作" });
  await expect(menu.getByRole("menuitem", { name: "ごみ箱へ移動" })).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "登録を解除" }).click();
  const confirm = page.getByRole("dialog", { name: "手順書フォルダの登録を解除しますか？" });
  await expect(confirm).toContainText("PC上のフォルダは削除しません");
});

test("rename instruction uses the positive Change action before the muted red Cancel", async ({
  page,
}) => {
  await installTauriMock(page, createPublicFixture(), "life-launcher-instruction");
  await page.goto("/?view=instruction");
  const root = page.locator('.instructionTreeRow[aria-level="1"]').first();
  await root.getByRole("button", { name: /を展開する/ }).click();
  await page.locator(".instructionTreeRow", { hasText: "guide.md" }).click({ button: "right" });
  await page.getByRole("menuitem", { name: "名前を変更" }).click();
  const dialog = page.getByRole("dialog", { name: "手順書操作" });
  const buttons = dialog.locator(".formDialogActions").getByRole("button");
  await expect(buttons).toHaveText(["変更", "キャンセル"]);
  await expect(buttons.first()).toHaveCSS("color", "rgb(111, 207, 151)");
  await expect(buttons.last()).toHaveCSS("color", "rgb(255, 180, 173)");
});

test("Markdown exposes Edit while HTML remains read-only without a disabled Edit control", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await installTauriMock(page, fixture, "life-launcher-instruction");
  await page.goto(
    "/?view=instruction&path=" + encodeURIComponent("C:\\PublicDemo\\Instructions\\guide.md"),
  );
  await expect(page.getByRole("button", { name: "手順書を編集" })).toBeVisible();

  await page.goto(
    "/?view=instruction&path=" + encodeURIComponent("C:\\PublicDemo\\Instructions\\reference.html"),
  );
  await expect(page.locator(".instructionHtmlFrame")).toBeVisible();
  await expect(page.getByRole("button", { name: "手順書を編集" })).toHaveCount(0);
  await expect(page.getByText("読み取り専用", { exact: true })).toHaveCount(0);
});
