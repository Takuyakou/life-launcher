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
    (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: VisualControl })
      .__LIFE_LAUNCHER_VISUAL_QA__?.setInstructionRootChoices([null]);
  });
  await empty.getByRole("button", { name: "フォルダを読み込む" }).click();
  await expect(empty.getByRole("button", { name: "フォルダを読み込む" })).toBeEnabled();
  await expect(page.locator(".toast")).toHaveCount(0);
});

test("pending folder picker suppresses repeated dispatch and selected folder loads", async ({ page }) => {
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
    await page.evaluate(() =>
      (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__?: VisualControl })
        .__LIFE_LAUNCHER_VISUAL_QA__?.invokeCalls.filter(
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
});

test("Markdown exposes Edit while HTML remains read-only without a disabled Edit control", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await installTauriMock(page, fixture, "life-launcher-instruction");
  await page.goto(
    "/?view=instruction&path=" +
      encodeURIComponent("C:\\PublicDemo\\Instructions\\guide.md"),
  );
  await expect(page.getByRole("button", { name: "手順書を編集" })).toBeVisible();

  await page.goto(
    "/?view=instruction&path=" +
      encodeURIComponent("C:\\PublicDemo\\Instructions\\reference.html"),
  );
  await expect(page.locator(".instructionHtmlFrame")).toBeVisible();
  await expect(page.getByRole("button", { name: "手順書を編集" })).toHaveCount(0);
  await expect(page.getByText("読み取り専用", { exact: true })).toHaveCount(0);
});
