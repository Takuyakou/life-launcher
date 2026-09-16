import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

test("P84-03 one focus-OFF Project with NextStep still renders Do Now", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects.forEach((project) => {
    project.weeklyFocus = undefined;
  });
  fixture.doNowCandidates = [
    {
      projectId: fixture.config.projects[0].id,
      reason: "noToday",
      restartEligible: false,
    },
  ];
  await prepare(page, fixture);

  const doNow = page.locator(".doNowContent");
  await expect(doNow.locator(".doNowCopy > strong")).toHaveText(
    fixture.config.projects[0].nextStep!.text,
  );
  await expect(doNow.locator(".doNowReason")).toHaveText("今日はまだ取り組んでいない候補です");
  await expect(doNow.getByRole("button", { name: "他の一手" })).toHaveCount(0);
});

test("P84-03 mixed focus response shows the eligible non-focus Project when focus has no NextStep", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].weeklyFocus = true;
  fixture.config.projects[0].nextStep = undefined;
  fixture.config.projects[1].weeklyFocus = false;
  fixture.doNowCandidates = [
    {
      projectId: fixture.config.projects[1].id,
      reason: "noToday",
      restartEligible: false,
    },
  ];
  await prepare(page, fixture);

  await expect(page.locator(".doNowCopy > strong")).toHaveText(
    fixture.config.projects[1].nextStep!.text,
  );
});

test("P84-03 Other Step cycles every ranked candidate without mutating config", async ({ page }) => {
  const fixture = createPublicFixture();
  const third = structuredClone(fixture.config.projects[0]);
  third.id = "sample-third";
  third.name = "第三候補";
  third.weeklyFocus = false;
  third.nextStep!.text = "第三候補の一手";
  fixture.config.projects.push(third);
  fixture.config.projects.forEach((project) => {
    project.weeklyFocus = false;
  });
  fixture.doNowCandidates = fixture.config.projects.map((project, index) => ({
    projectId: project.id,
    reason: index === 0 ? "noToday" : "oldestSession",
    restartEligible: false,
  }));
  await prepare(page, fixture);
  const before = await currentConfig(page);
  const action = page.locator(".doNowCopy > strong");
  const alternate = page.getByRole("button", { name: "他の一手", exact: true });

  await expect(action).toHaveText(fixture.config.projects[0].nextStep!.text);
  await alternate.click();
  await expect(action).toHaveText(fixture.config.projects[1].nextStep!.text);
  await alternate.click();
  await expect(action).toHaveText(third.nextStep!.text);
  await alternate.click();
  await expect(action).toHaveText(fixture.config.projects[0].nextStep!.text);
  expect(await currentConfig(page)).toEqual(before);
});

test("P84-03 empty Do Now guides to NextStep instead of weekly focus", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects.forEach((project) => {
    project.weeklyFocus = undefined;
    project.nextStep = undefined;
  });
  fixture.doNowCandidates = [];
  await prepare(page, fixture);

  const empty = page.locator(".doNowEmpty");
  await expect(empty).toContainText("次の一手を設定すると、ここに提案されます。");
  await expect(empty).not.toContainText("今週の重点");
  await empty.getByRole("button", { name: "次の一手を設定" }).click();
  await expect(page.getByRole("dialog", { name: "次の一手を設定" })).toBeVisible();
});
