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
  await prepare(page, fixture);
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

test("P84 empty Do Now with no Projects uses the shared gold setup state", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects = [];
  fixture.config.today.items = [];
  fixture.doNowCandidates = [];
  await prepare(page, fixture);

  const empty = page.locator(".doNowEmpty");
  const message = empty.getByText("プロジェクトを作り、次の一手を設定すると提案されます。", {
    exact: true,
  });
  const description = empty.getByText(
    "迷ったときに、今の状況から始めやすい「次にやること」を1つだけ提示します。",
    { exact: true },
  );
  const todayEmpty = page.locator(".todayEmptyState");
  const nextStepEmpty = page.locator(".sectionEmptyState");
  const action = empty.getByRole("button", { name: "プロジェクトを追加" });
  await expect(message).toBeVisible();
  await expect(description).toBeVisible();
  await expect(todayEmpty).toBeVisible();
  await expect(nextStepEmpty).toBeVisible();
  await expect(action).toHaveClass(/mainActionButton--gold/);
  await expect(action.locator(".uiIcon")).toHaveCount(1);
  const [emptyBox, todayEmptyBox, nextStepEmptyBox, messageBox, descriptionBox, actionBox] =
    await Promise.all([
    empty.boundingBox(),
    todayEmpty.boundingBox(),
    nextStepEmpty.boundingBox(),
    message.boundingBox(),
    description.boundingBox(),
    action.boundingBox(),
  ]);
  expect(
    emptyBox && todayEmptyBox && nextStepEmptyBox && messageBox && descriptionBox && actionBox,
  ).toBeTruthy();
  expect(emptyBox!.height).toBeCloseTo(todayEmptyBox!.height, 1);
  expect(emptyBox!.height).toBeCloseTo(nextStepEmptyBox!.height, 1);
  expect(descriptionBox!.y).toBeGreaterThan(messageBox!.y + messageBox!.height);
  expect(actionBox!.y).toBeGreaterThan(descriptionBox!.y + descriptionBox!.height);

  const [messageStyle, descriptionStyle] = await Promise.all([
    message.evaluate((node) => {
      const style = getComputedStyle(node);
      return { fontSize: style.fontSize, fontWeight: style.fontWeight };
    }),
    description.evaluate((node) => {
      const style = getComputedStyle(node);
      return { color: style.color, fontSize: style.fontSize };
    }),
  ]);
  expect(messageStyle).toEqual({ fontSize: "17px", fontWeight: "700" });
  expect(descriptionStyle.fontSize).toBe("11px");

  await action.click();
  await expect(page.getByRole("dialog", { name: "プロジェクトを追加" })).toBeVisible();
});

test("P84 Do Now task offset and metadata icon rows follow the reference alignment", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);

  const card = page.locator(".doNowContent");
  const [cardBox, kicker, task, meta, alternate] = await Promise.all([
    card.boundingBox(),
    card.locator(".doNowKicker").boundingBox(),
    card.locator(".doNowCopy > strong").boundingBox(),
    card.locator(".doNowMeta").boundingBox(),
    card.getByRole("button", { name: "他の一手" }).boundingBox(),
  ]);
  expect(cardBox).not.toBeNull();
  expect(kicker).not.toBeNull();
  expect(task).not.toBeNull();
  expect(meta).not.toBeNull();
  expect(alternate).not.toBeNull();
  expect(cardBox!.height).toBeGreaterThanOrEqual(112);
  expect(task!.x - kicker!.x).toBeGreaterThanOrEqual(2);
  expect(task!.x - kicker!.x).toBeLessThanOrEqual(4);
  expect(Math.abs(kicker!.x - meta!.x)).toBeLessThanOrEqual(1);
  const [clockText, alternateText] = await Promise.all([
    card.locator(".doNowMetaTimer").evaluate((node) => {
      const text = [...node.childNodes].find(
        (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      );
      if (!text) return 0;
      const range = document.createRange();
      range.selectNodeContents(text);
      return range.getBoundingClientRect().x;
    }),
    card.locator(".doNowAlternateButton").evaluate((node) => {
      const text = [...node.childNodes].find(
        (child) => child.nodeType === Node.TEXT_NODE && child.textContent?.trim(),
      );
      if (!text) return 0;
      const range = document.createRange();
      range.selectNodeContents(text);
      return range.getBoundingClientRect().x;
    }),
  ]);
  expect(Math.abs(clockText - alternateText)).toBeLessThanOrEqual(1);
  expect(task!.y).toBeGreaterThan(kicker!.y + kicker!.height);
  expect(meta!.y).toBeGreaterThan(task!.y + task!.height);
  expect(alternate!.y).toBeGreaterThan(meta!.y + meta!.height);
  const projectColors = await card.evaluate((node) => {
    const kicker = node.querySelector<HTMLElement>(".doNowKicker h2");
    const statusDot = node.querySelector<HTMLElement>(".doNowStatusDot");
    const styles = getComputedStyle(node);
    return {
      border: styles.borderLeftColor,
      kicker: kicker ? getComputedStyle(kicker).color : "",
      statusDot: statusDot ? getComputedStyle(statusDot).backgroundColor : "",
    };
  });
  expect(projectColors.kicker).toBe(projectColors.border);
  expect(projectColors.statusDot).toBe(projectColors.border);
  await card.screenshot({ path: "dist/visual-qa/phase84/do-now-aligned.png" });
});
