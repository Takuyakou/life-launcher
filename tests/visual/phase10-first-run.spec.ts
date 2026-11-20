import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaControl = {
  currentConfig: () => AppConfig;
  setSaveConfigFailure: (failed: boolean) => void;
  invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
};

type QaWindow = Window & { __LIFE_LAUNCHER_VISUAL_QA__: QaControl };

test.use({ reducedMotion: "no-preference" });

async function prepare(
  page: Page,
  fixture: VisualQaFixture,
  options: { saveBlocked?: boolean } = {},
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1280, height: 900 });
  await installTauriMock(page, fixture, "main", null, options);
  await page.goto("/");
  await expect(page.locator(".mainScrollContent")).toBeVisible();
}

function emptyFirstRunFixture() {
  const fixture = createPublicFixture();
  fixture.config.projects = [];
  fixture.config.inbox = [];
  fixture.config.today.items = [];
  delete fixture.config.settings.firstRunDoneAt;
  return fixture;
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    return control.currentConfig();
  });
}

async function saveConfigCount(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === "save_config",
      ).length,
  );
}

async function setSaveFailure(page: Page, shouldFail: boolean) {
  await page.evaluate((value) => {
    (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(value);
  }, shouldFail);
}

async function fillFirstRun(page: Page, project = "英語", step = "英語の動画を1本見る") {
  await page.getByLabel("続けたいこと").fill(project);
  await page.getByLabel("最初の一手").fill(step);
}

test("P10-11 the guide appears for an empty config without the stamp", async ({ page }) => {
  await prepare(page, emptyFirstRunFixture());
  await expect(page.locator(".firstRunBand")).toBeVisible();
  await expect(page.getByRole("heading", { name: "まず、1つだけ始めましょう" })).toBeVisible();
  await expect(page.getByLabel("続けたいこと")).toBeVisible();
  await expect(page.getByRole("button", { name: "5分で始める" })).toBeDisabled();
});

test("P10-11 a stamp hides the guide even when everything is empty", async ({ page }) => {
  const stamped = emptyFirstRunFixture();
  stamped.config.settings.firstRunDoneAt = "2026-08-01T09:00:00+09:00";
  await prepare(page, stamped);
  await expect(page.locator(".firstRunBand")).toHaveCount(0);
  await expect(page.locator(".doNowBand")).toBeVisible();
});

test("P10-11 one Project is enough to skip the guide", async ({ page }) => {
  const withProject = emptyFirstRunFixture();
  withProject.config.projects = [createPublicFixture().config.projects[0]];
  await prepare(page, withProject);
  await expect(page.locator(".firstRunBand")).toHaveCount(0);
  await expect(page.locator(".doNowBand")).toBeVisible();
});

test("P10-11 a blocked save keeps the guide away", async ({ page }) => {
  await prepare(page, emptyFirstRunFixture(), { saveBlocked: true });
  await expect(page.locator(".firstRunBand")).toHaveCount(0);
  await expect(page.locator(".doNowBand")).toBeVisible();
});

test("P10-11 5分で始める saves once and starts the short Timer", async ({ page }) => {
  await prepare(page, emptyFirstRunFixture());
  await expect(page.locator(".firstRunBand")).toBeVisible();
  const before = await saveConfigCount(page);

  await fillFirstRun(page);
  await page.getByRole("button", { name: "5分で始める" }).click();

  await expect(page.locator(".firstRunBand")).toHaveCount(0);
  expect(await saveConfigCount(page)).toBe(before + 1);
  const saved = await currentConfig(page);
  expect(saved.projects).toHaveLength(1);
  expect(saved.projects[0]).toMatchObject({
    name: "英語",
    nextStep: {
      text: "英語の動画を1本見る",
      shortTimerMinutes: 5,
      defaultTimerMinutes: 25,
    },
  });
  expect(saved.projects[0].nextStep?.generationId).toBeTruthy();
  expect(saved.settings.firstRunDoneAt).toBeTruthy();
  await expect(page.locator(".timerDock .timerStateBadge")).toHaveText("実行中");
});

test("P10-11 a failed first save keeps the guide and retries with one Project", async ({ page }) => {
  await prepare(page, emptyFirstRunFixture());
  await fillFirstRun(page);
  await setSaveFailure(page, true);
  await page.getByRole("button", { name: "5分で始める" }).click();

  await expect(page.locator(".firstRunBand")).toBeVisible();
  await expect(page.getByLabel("続けたいこと")).toHaveValue("英語");
  await expect(page.locator(".toast", { hasText: "保存できません" })).toBeVisible();
  expect((await currentConfig(page)).projects).toHaveLength(0);

  await setSaveFailure(page, false);
  await page.getByRole("button", { name: "5分で始める" }).click();
  await expect(page.locator(".firstRunBand")).toHaveCount(0);
  const saved = await currentConfig(page);
  expect(saved.projects).toHaveLength(1);
  expect(saved.projects[0].name).toBe("英語");
  expect(saved.projects[0].nextStep?.text).toBe("英語の動画を1本見る");
});

test("P10-11 あとで始める stamps the config and stays gone after reload", async ({ page }) => {
  await prepare(page, emptyFirstRunFixture());
  await page.getByRole("button", { name: "あとで始める" }).click();

  await expect(page.locator(".firstRunBand")).toHaveCount(0);
  await expect(page.locator(".doNowBand")).toBeVisible();
  const saved = await currentConfig(page);
  expect(saved.settings.firstRunDoneAt).toBeTruthy();
  expect(saved.projects).toHaveLength(0);

  await page.reload();
  await expect(page.locator(".doNowBand")).toBeVisible();
  await expect(page.locator(".firstRunBand")).toHaveCount(0);
});

test("P10-11 the copy button swaps its label and keeps the failure path", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: async (text: string) => {
          (window as Window & { __copiedText?: string }).__copiedText = text;
        },
      },
    });
  });
  await prepare(page, emptyFirstRunFixture());

  const copy = page.getByRole("button", { name: /プロンプトをコピー/ });
  await copy.click();
  await expect(page.getByRole("button", { name: /コピーしました/ })).toBeVisible();
  const copied = await page.evaluate(
    () => (window as Window & { __copiedText?: string }).__copiedText ?? "",
  );
  expect(copied).toContain("あなたは、私が");
  expect(await page.locator(".toast").count()).toBe(0);

  await page.clock.fastForward(1_500);
  await expect(page.getByRole("button", { name: /プロンプトをコピー/ })).toBeVisible();

  await page.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: async () => Promise.reject(new Error("denied")) },
    });
  });
  await page.getByRole("button", { name: /プロンプトをコピー/ }).click();
  await expect(
    page.locator(".toast", { hasText: "プロンプトをコピーできませんでした" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /プロンプトをコピー/ })).toBeVisible();
});

test("P10-11 まとめて取り込むを開く opens the import dialog", async ({ page }) => {
  await prepare(page, emptyFirstRunFixture());
  await page.getByRole("button", { name: "まとめて取り込むを開く" }).click();
  await expect(page.getByRole("dialog", { name: "まとめて取り込む" })).toBeVisible();
  await expect(page.locator(".firstRunBand")).toBeVisible();
});
