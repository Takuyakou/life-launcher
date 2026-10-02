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
  await expect(page.locator(".doNowReason")).toHaveText("今日はまだ取り組んでいない候補です");
  await expect(page.getByRole("button", { name: "他の一手", exact: true })).toHaveCount(0);
});

test("P84-03 Other Step cycles every ranked candidate without mutating config", async ({
  page,
}) => {
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
  const parts = [page.locator(".doNowKicker"), action, page.locator(".doNowMeta"), alternate];
  let bottom = 0;
  for (const part of parts) {
    const box = await part.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeGreaterThanOrEqual(bottom);
    bottom = box!.y + box!.height;
  }

  await expect(action).toHaveText(fixture.config.projects[0].nextStep!.text);
  await alternate.click();
  await expect(action).toHaveText(fixture.config.projects[1].nextStep!.text);
  await alternate.click();
  await expect(action).toHaveText(third.nextStep!.text);
  await alternate.click();
  await expect(action).toHaveText(fixture.config.projects[0].nextStep!.text);
  expect(await currentConfig(page)).toEqual(before);
});

test("P84 Do Now hover follows the Project color and does not stick after Other Step", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.projects[0].weeklyFocus = true;
  fixture.config.projects[1].weeklyFocus = false;
  fixture.doNowCandidates = fixture.config.projects.map((project) => ({
    projectId: project.id, reason: "noToday", restartEligible: false,
  }));
  await prepare(page, fixture);
  await expect(page.locator(".doNowCopy > strong")).toHaveText(fixture.config.projects[0].nextStep!.text);
  await expect(page.locator(".doNowReason")).toContainText("今週の重点");
  const card = page.locator(".doNowContent");
  const alternate = card.getByRole("button", { name: "他の一手", exact: true });

  await card.hover();
  await page.waitForTimeout(140);
  const firstHover = await card.evaluate((node) => {
    const style = getComputedStyle(node);
    return { left: style.borderLeftColor, right: style.borderRightColor };
  });
  expect(firstHover.right).toBe(firstHover.left);

  await alternate.click();
  await expect(card.locator(".doNowCopy > strong")).toHaveText(
    fixture.config.projects[1].nextStep!.text,
  );
  await page.mouse.move(1, 1);
  await page.waitForTimeout(140);
  const resting = await card.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      left: style.borderLeftColor,
      right: style.borderRightColor,
      transform: style.transform,
    };
  });
  expect(resting.right).not.toBe(resting.left);
  expect(resting.transform).toBe("none");

  await card.hover();
  await page.waitForTimeout(140);
  const secondHover = await card.evaluate((node) => {
    const style = getComputedStyle(node);
    return { left: style.borderLeftColor, right: style.borderRightColor };
  });
  expect(secondHover.right).toBe(secondHover.left);
  expect(secondHover.right).not.toBe(firstHover.right);
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
