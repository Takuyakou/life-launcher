import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

const SCREENSHOT_OPTIONS = {
  maxDiffPixelRatio: 0.001,
  animations: "disabled",
  caret: "hide",
} as const;

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
    currentConfig: () => VisualQaFixture["config"];
    updateConfig: (config: VisualQaFixture["config"]) => void;
    setMissingLaunchTargets: (next: {
      missingButtonIds: string[];
      missingInstructionProjectIds: string[];
    }) => void;
    setMissingLaunchTargetsFailure: (shouldFail: boolean) => void;
  };
};

function createMissingFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.projects[0].nextStep = {
    ...fixture.config.projects[0].nextStep!,
    buttonIds: ["sample-documents", "sample-editor"],
    instructionPath: "C:\\PublicDemo\\Instructions\\guide.md",
    instructionOpenOnStart: true,
  };
  fixture.missingLaunchTargets = {
    missingButtonIds: ["sample-documents"],
    missingInstructionProjectIds: [fixture.config.projects[0].id],
  };
  return fixture;
}

async function open(
  page: Page,
  fixture: VisualQaFixture,
  freezeAnimations = false,
) {
  const now = new Date(FIXTURE_NOW).getTime();
  await page.setViewportSize({ width: 1080, height: 680 });
  await page.clock.install({ time: now });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  if (freezeAnimations) {
    await page.addStyleTag({
      content:
        "*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important;cursor:none!important}",
    });
  }
}

async function missingCheckCount(page: Page) {
  return page.evaluate(
    () =>
      (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === "load_missing_launch_targets",
      ).length,
  );
}

test("P10-17 N4-3 1 & 2 marks missing targets in Do Now and Next Step edit and allows removal", async ({
  page,
}) => {
  await open(page, createMissingFixture());
  await page.clock.fastForward(450);

  const missingButtonChip = page.locator(".doNowOpenChip--missing").filter({
    hasText: "サンプル資料",
  });
  const missingInstructionChip = page.locator(".doNowOpenChip--missing").filter({
    hasText: "guide.md",
  });
  const presentButtonChip = page.locator(".doNowOpenChip").filter({
    hasText: "サンプルエディター",
  });

  await expect(missingButtonChip).toBeVisible();
  await expect(missingButtonChip).toContainText("見つかりません");
  await expect(missingButtonChip).toHaveCSS("color", "rgb(242, 166, 90)");
  await expect(missingInstructionChip).toBeVisible();
  await expect(missingInstructionChip).toContainText("見つかりません");
  await expect(missingInstructionChip).toHaveCSS("color", "rgb(242, 166, 90)");
  await expect(presentButtonChip).not.toHaveClass(/doNowOpenChip--missing/);
  await expect(presentButtonChip).not.toContainText("見つかりません");

  // Open Next Step edit dialog.
  const row = page.locator(".projectGrid .nextStepCard").first();
  await row.hover();
  await row.getByRole("button", { name: "編集", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "次の一手を編集" });
  const editMissingButton = editDialog
    .locator(".nextStepOpenChip--missing")
    .filter({ hasText: "サンプル資料" });
  const editMissingInstruction = editDialog
    .locator(".nextStepOpenChip--missing")
    .filter({ hasText: "guide.md" });

  await expect(editMissingButton).toBeVisible();
  await expect(editMissingButton.locator(".nextStepOpenChipMissing")).toHaveText("見つかりません");
  await expect(editMissingButton).toHaveCSS("border-top-color", "rgba(242, 166, 90, 0.6)");
  await expect(editMissingInstruction).toBeVisible();
  await expect(editMissingInstruction.locator(".nextStepOpenChipMissing")).toHaveText(
    "見つかりません",
  );
  await expect(editMissingInstruction).toHaveCSS("border-top-color", "rgba(242, 166, 90, 0.6)");

  // Remove the missing button and save.
  await editMissingButton.getByRole("button", { name: "サンプル資料を外す" }).click();
  await editDialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(editDialog).toHaveCount(0);
  const buttonIds = await page.evaluate(
    () =>
      (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig().projects[0]
        .nextStep?.buttonIds ?? [],
  );
  expect(buttonIds).toEqual(["sample-editor"]);
});

test("P10-17 N4-3 3 empty fixture shows no missing indicator anywhere", async ({ page }) => {
  await open(page, createPublicFixture());
  await page.clock.fastForward(450);
  await expect(page.locator(".doNowOpenChip--missing")).toHaveCount(0);
  await expect(page.getByText("見つかりません")).toHaveCount(0);
});

test("P10-17 N4-3 4 debounces config updates (400ms) and checks on window focus", async ({
  page,
}) => {
  const now = new Date(FIXTURE_NOW).getTime();
  await page.setViewportSize({ width: 1080, height: 680 });
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now);
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.clock.fastForward(450);
  const afterLoad = await missingCheckCount(page);
  expect(afterLoad).toBe(1);

  // Three consecutive config updates inside 400ms produce only one check.
  const victoryCheck = page.getByRole("checkbox", { name: "勝利条件を達成" });
  for (let i = 0; i < 3; i += 1) {
    await victoryCheck.click();
    await page.clock.runFor(100);
  }
  expect(await missingCheckCount(page)).toBe(afterLoad);
  await page.clock.runFor(450);
  await expect.poll(() => missingCheckCount(page)).toBe(afterLoad + 1);

  // Window focus triggers one check immediately.
  await page.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect.poll(() => missingCheckCount(page)).toBe(afterLoad + 2);
});

test("P10-17 N4-3 5 command failure shows no toast and preserves previous result", async ({
  page,
}) => {
  await open(page, createMissingFixture());
  await page.clock.fastForward(450);
  await expect(page.locator(".doNowOpenChip--missing")).toHaveCount(2);

  await page.evaluate(() => {
    (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setMissingLaunchTargetsFailure(true);
    window.dispatchEvent(new Event("focus"));
  });
  await page.clock.fastForward(100);
  await expect(page.locator(".toast")).toHaveCount(0);
  await expect(page.locator(".doNowOpenChip--missing")).toHaveCount(2);
});

test("P10-17 N4-3 6 baseline screenshots for main-do-now-missing and edit-step-missing", async ({
  page,
}) => {
  await open(page, createMissingFixture(), true);
  await page.clock.fastForward(450);
  await expect(page.locator(".doNowOpenChip--missing")).toHaveCount(2);
  await expect(page).toHaveScreenshot("main-do-now-missing.png", SCREENSHOT_OPTIONS);

  const row = page.locator(".projectGrid .nextStepCard").first();
  await row.hover();
  await row.getByRole("button", { name: "編集", exact: true }).click();
  const editDialog = page.getByRole("dialog", { name: "次の一手を編集" });
  await expect(editDialog.locator(".nextStepOpenChip--missing")).toHaveCount(2);
  await expect(page).toHaveScreenshot("edit-step-missing.png", SCREENSHOT_OPTIONS);
});
