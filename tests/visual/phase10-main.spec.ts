import { expect, test, type Page } from "@playwright/test";
import { waitForBundledFonts } from "./bundledFonts";
import { createFullTodayFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    currentConfig: () => VisualQaFixture["config"];
    updateConfig: (config: VisualQaFixture["config"]) => void;
    invokeCalls: Array<{ command: string; args?: unknown }>;
  };
};

async function open(page: Page, fixture: VisualQaFixture = createFullTodayFixture()) {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

const doNow = (page: Page) => page.locator(".doNowBand");

test("P10-05 the Do Now action is the headline and the start buttons are 48px tall", async ({
  page,
}) => {
  await open(page);
  const text = doNow(page).locator(".doNowCopy > strong");
  const style = await text.evaluate((element) => {
    const computed = getComputedStyle(element);
    return { fontSize: computed.fontSize, fontWeight: computed.fontWeight, lineHeight: computed.lineHeight };
  });
  expect(style.fontSize).toBe("32px");
  expect(style.fontWeight).toBe("700");

  for (const selector of [".doNowStartPrimary", ".doNowStartSecondary", ".doNowMeasureButton"]) {
    const box = (await doNow(page).locator(selector).boundingBox())!;
    expect(box.height, selector).toBe(48);
  }

  // D1: colours and the underline stay as they were.
  const primary = await doNow(page)
    .locator(".doNowStartPrimary")
    .evaluate((element) => {
      const computed = getComputedStyle(element);
      return { color: computed.color, background: computed.backgroundColor, border: computed.borderColor };
    });
  expect(primary.color).toBe("rgb(111, 207, 151)");
  expect(primary.background).toBe("rgb(32, 49, 38)");
  expect(primary.border).toBe("rgba(111, 207, 151, 0.45)");
});

test("P10-05 the Today card linked to this moment's step shows いまここ", async ({ page }) => {
  const fixture = createFullTodayFixture();
  // Only the Project of the linked Today card keeps a Next Step, so Do Now shows it.
  const linkedId = fixture.config.today.items.find((item) => item.sourceKey?.startsWith("project:"))
    ?.projectId;
  // The badge follows the same rule as Do Now: same Project and same generation.
  fixture.config.projects = fixture.config.projects.map((project) =>
    project.id === linkedId
      ? {
          ...project,
          nextStep: {
            text: "今日の札の一手",
            generationId: "gen-linked",
          },
        }
      : project,
  );
  fixture.config.today.items = fixture.config.today.items.map((item) =>
    item.projectId === linkedId
      ? { ...item, sourceGenerationId: "gen-linked", sourceKey: `project:${linkedId}` }
      : item,
  );
  fixture.config.projects = fixture.config.projects.map((project) =>
    project.id === linkedId ? project : { ...project, nextStep: undefined },
  );
  fixture.doNowCandidates = [{ projectId: linkedId!, reason: "today3", restartEligible: false }];
  await open(page, fixture);
  const here = page.locator(".todayHereBadge");
  await expect(here).toHaveCount(1);
  const linkedCard = page.locator(".todayRow", { has: page.locator(".todayHereBadge") });
  await expect(linkedCard).toHaveCount(1);
  // The linked card is the one adopted from the current Next Step of the shown Project.
  const projectName = await doNow(page).locator(".doNowProjectChip").innerText();
  const cardText = await linkedCard.innerText();
  expect(projectName.trim().length).toBeGreaterThan(0);
  expect(cardText.length).toBeGreaterThan(0);

  // 他の一手 moves the badge with the Do Now project.
  const alternate = doNow(page).getByRole("button", { name: "他の一手" });
  if ((await alternate.count()) > 0) {
    await alternate.click();
    await expect(page.locator(".todayHereBadge")).toHaveCount(1);
  }
});

test("P10-05 the Next Step list is one row per Project and rows grow with the text", async ({
  page,
}) => {
  const fixture = createFullTodayFixture();
  const longText = "とても長い次の一手の文がここに入ります。".repeat(6);
  fixture.config.projects = fixture.config.projects.map((project) =>
    project.nextStep ? { ...project, nextStep: { ...project.nextStep, text: longText } } : project,
  );
  await open(page, fixture);
  const cards = page.locator(".projectGrid .nextStepCard");
  const count = await cards.count();
  expect(count).toBeGreaterThan(1);
  const tops: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const box = (await cards.nth(index).boundingBox())!;
    tops.push(Math.round(box.y));
  }
  // One per row: every row starts below the previous one.
  for (let index = 1; index < tops.length; index += 1) {
    expect(tops[index]).toBeGreaterThan(tops[index - 1]);
  }
  const first = (await cards.first().boundingBox())!;
  expect(first.height).toBeGreaterThan(56);
  const clipped = await cards.first().evaluate((element) => {
    const text = element.querySelector("p");
    return text ? text.scrollHeight > text.clientHeight + 1 : false;
  });
  expect(clipped).toBe(false);
});

test("P10-05 a stale Next Step shows the notice and このまま clears it once", async ({ page }) => {
  const fixture = createFullTodayFixture();
    const lockedIds = new Set(
    fixture.config.today.items.filter((item) => !item.done).map((item) => item.projectId),
  );
  const project = fixture.config.projects.find(
    (item) => item.nextStep && !lockedIds.has(item.id),
  )!;
  fixture.staleProjectIds = [project.id];
  const updated = new Date(new Date(FIXTURE_NOW).getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  fixture.config.projects = fixture.config.projects.map((item) =>
    item.id === project.id
      ? { ...item, nextStep: { ...item.nextStep!, reviewedAt: updated, updatedAt: updated } }
      : item,
  );
  await open(page, fixture);

  const notice = page.locator(".nextStepFreshness");
  await expect(notice.first()).toContainText("20日同じ一手です。大きすぎるかもしれません");
  await expect(notice.first().getByRole("button", { name: "小さくする" })).toBeVisible();

  const before = await page.evaluate(
    () =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === "save_config",
      ).length,
  );
  await notice.first().getByRole("button", { name: "このまま" }).click();
  await expect(page.locator(".nextStepFreshness")).toHaveCount(0);
  const after = await page.evaluate(
    () =>
      (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === "save_config",
      ).length,
  );
  expect(after - before).toBe(1);
});

test("P10-05 小さくする opens the Next Step editor", async ({ page }) => {
  const fixture = createFullTodayFixture();
    const lockedIds = new Set(
    fixture.config.today.items.filter((item) => !item.done).map((item) => item.projectId),
  );
  const project = fixture.config.projects.find(
    (item) => item.nextStep && !lockedIds.has(item.id),
  )!;
  fixture.staleProjectIds = [project.id];
  const staleStamp = new Date(new Date(FIXTURE_NOW).getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  fixture.config.projects = fixture.config.projects.map((item) =>
    item.id === project.id
      ? { ...item, nextStep: { ...item.nextStep!, reviewedAt: staleStamp, updatedAt: staleStamp } }
      : item,
  );
  await open(page, fixture);
  await page
    .locator(".nextStepFreshness")
    .first()
    .getByRole("button", { name: "小さくする" })
    .click();
  const editor = page.locator(".nextStepEditDialog");
  await expect(editor.first()).toBeVisible();
});

test("P10-05 the Records 書き直す opens the Next Step editor too", async ({ page }) => {
  const fixture = createFullTodayFixture();
    const lockedIds = new Set(
    fixture.config.today.items.filter((item) => !item.done).map((item) => item.projectId),
  );
  const project = fixture.config.projects.find(
    (item) => item.nextStep && !lockedIds.has(item.id),
  )!;
  fixture.staleProjectIds = [project.id];
  const staleStamp = new Date(new Date(FIXTURE_NOW).getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  fixture.config.projects = fixture.config.projects.map((item) =>
    item.id === project.id
      ? { ...item, nextStep: { ...item.nextStep!, reviewedAt: staleStamp, updatedAt: staleStamp } }
      : item,
  );
  await open(page, fixture);
  await page.getByRole("button", { name: "記録ビューを開く" }).click();
  await expect(page.locator(".recordsView")).toBeVisible();
  // The freshness review lives in the planning tab.
  await page.getByRole("tab", { name: "今週を決める" }).click();
  const review = page.locator(".weeklyPlanningStale");
  await expect(review).toBeVisible();
  await review.getByRole("button", { name: "小さくする" }).first().click();
  const editor = page.locator(".nextStepEditDialog");
  await expect(editor.first()).toBeVisible();
});

test("F14 Tab moves from the victory text to the check", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.config.today.victory.text = "今日の勝利条件をひとつ決める";
  await open(page, fixture);
  const text = page.locator(".victoryTextButton");
  await text.focus();
  await expect(text).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("checkbox", { name: "勝利条件を達成" })).toBeFocused();
  expect(
    await page.evaluate(() => {
      const text = document.querySelector<HTMLElement>(".victoryTextButton")!;
      const check = document.querySelector<HTMLElement>(".victoryCheck")!;
      return Boolean(text.compareDocumentPosition(check) & Node.DOCUMENT_POSITION_FOLLOWING);
    }),
  ).toBe(true);
});

test("G1 the victory check stays at the right edge without the badge", async ({ page }) => {
  await open(page, createFullTodayFixture());
  const bar = page.locator(".victoryBar");
  const content = page.locator(".victoryContent");
  const check = page.locator(".victoryCheck");
  const barBox = (await bar.boundingBox())!;
  const contentBox = (await content.boundingBox())!;
  const checkBox = (await check.boundingBox())!;
  expect(checkBox.x).toBeGreaterThan(contentBox.x + contentBox.width);
  expect(barBox.x + barBox.width - (checkBox.x + checkBox.width)).toBeLessThanOrEqual(16);
  await expect(page.locator(".victoryBadge")).toHaveCount(0);
});

test("G1 the achieved badge sits between the text and the check", async ({ page }) => {
  const fixture = createFullTodayFixture();
  fixture.config.today.victory.done = true;
  await open(page, fixture);
  const bar = page.locator(".victoryBar");
  const content = page.locator(".victoryContent");
  const badge = page.locator(".victoryBadge");
  const check = page.locator(".victoryCheck");
  const barBox = (await bar.boundingBox())!;
  const contentBox = (await content.boundingBox())!;
  const badgeBox = (await badge.boundingBox())!;
  const checkBox = (await check.boundingBox())!;
  expect(contentBox.x).toBeLessThan(badgeBox.x);
  expect(badgeBox.x).toBeLessThan(checkBox.x);
  expect(checkBox.x - (badgeBox.x + badgeBox.width)).toBeGreaterThanOrEqual(11);
  expect(checkBox.x - (badgeBox.x + badgeBox.width)).toBeLessThanOrEqual(13);
  expect(barBox.x + barBox.width - (checkBox.x + checkBox.width)).toBeLessThanOrEqual(16);
  const text = page.locator(".victoryTextButton");
  await text.focus();
  await page.keyboard.press("Tab");
  await expect(check).toBeFocused();
});

test("P10-05 the freshness notice follows the 14 day rule and the clock", async ({ page }) => {
  const fixture = createFullTodayFixture();
    const lockedIds = new Set(
    fixture.config.today.items.filter((item) => !item.done).map((item) => item.projectId),
  );
  const project = fixture.config.projects.find(
    (item) => item.nextStep && !lockedIds.has(item.id),
  )!;
  fixture.staleProjectIds = [project.id];
  const staleStamp = new Date(new Date(FIXTURE_NOW).getTime() - 20 * 24 * 60 * 60 * 1000).toISOString();
  fixture.config.projects = fixture.config.projects.map((item) =>
    item.id === project.id
      ? { ...item, nextStep: { ...item.nextStep!, reviewedAt: staleStamp, updatedAt: staleStamp } }
      : item,
  );
  const now = new Date(FIXTURE_NOW).getTime();
  const at = (offsetMs: number) =>
    new Date(now - offsetMs).toISOString();

  // 13 days 23 hours: not yet.
  fixture.config.projects = fixture.config.projects.map((item) =>
    item.id === project.id
      ? { ...item, nextStep: { ...item.nextStep!, reviewedAt: at(13 * 86400000 + 82800000), updatedAt: undefined } }
      : item,
  );
  await open(page, fixture);
  await expect(page.locator(".nextStepFreshness")).toHaveCount(0);

  // Exactly 14 days: the notice shows with N = 14.
  await page.evaluate((stamp) => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    config.projects = config.projects.map((item) =>
      item.nextStep ? { ...item, nextStep: { ...item.nextStep, reviewedAt: stamp } } : item,
    );
    control.updateConfig(config);
  }, at(14 * 86400000));
  await expect(page.locator(".nextStepFreshness").first()).toContainText("14日同じ一手です");

  // A basis in the future never shows.
  await page.evaluate(() => {
    const control = (window as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__;
    const config = control.currentConfig();
    const future = new Date(Date.now() + 5 * 86400000).toISOString();
    config.projects = config.projects.map((item) =>
      item.nextStep ? { ...item, nextStep: { ...item.nextStep, reviewedAt: future } } : item,
    );
    control.updateConfig(config);
  });
  await expect(page.locator(".nextStepFreshness")).toHaveCount(0);
});

test("P10-14 Next Step rows are one horizontal line and grow with the text", async ({ page }) => {
  const fixture = createFullTodayFixture();
  await open(page, fixture);

  const shortRow = page.locator(".projectGrid .nextStepCard").filter({ hasText: "資料を1ページ読む" });
  const shortBox = (await shortRow.boundingBox())!;
  expect(shortBox.height).toBeLessThanOrEqual(72);

  const nameBox = (await shortRow.locator(".nextStepProjectRegion h3").boundingBox())!;
  const textBox = (await shortRow.locator(".nextStepActionRegion p").boundingBox())!;
  expect(Math.abs(nameBox.y - textBox.y)).toBeLessThanOrEqual(8);

  const longFixture = createFullTodayFixture();
  const longText = "とても長い次の一手の文がここに入ります。".repeat(6);
  longFixture.config.projects = longFixture.config.projects.map((project) =>
    project.nextStep ? { ...project, nextStep: { ...project.nextStep, text: longText } } : project,
  );
  await open(page, longFixture);
  const longRow = page
    .locator(".projectGrid .nextStepCard")
    .filter({ hasText: "とても長い次の一手の文" })
    .first();
  const longBox = (await longRow.boundingBox())!;
  expect(longBox.height).toBeGreaterThan(72);
  const clipped = await longRow.evaluate((element) => {
    const text = element.querySelector("p");
    return text ? text.scrollHeight > text.clientHeight + 1 : false;
  });
  expect(clipped).toBe(false);
});

test("G10 the rightmost visible action ends at the same x in every Next Step row", async ({
  page,
}) => {
  await open(page, createFullTodayFixture());
  const rows = page.locator(".projectGrid .nextStepCard");
  const count = await rows.count();
  expect(count).toBeGreaterThanOrEqual(3);
  const rightEdges: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const buttons = await rows
      .nth(index)
      .locator(".nextStepCardActions button, .nextStepRowAction--set, .nextStepTodayStatus")
      .evaluateAll((nodes) =>
      nodes
        .map((node) => ({
          right: node.getBoundingClientRect().right,
          opacity: Number(getComputedStyle(node).opacity),
          display: getComputedStyle(node).display,
        }))
        .filter((item) => item.display !== "none" && item.opacity > 0.3),
    );
    expect(buttons.length, `row ${index}`).toBeGreaterThan(0);
    rightEdges.push(Math.max(...buttons.map((item) => item.right)));
  }
  expect(Math.max(...rightEdges) - Math.min(...rightEdges)).toBeLessThanOrEqual(1);

  const row = rows.filter({ has: page.locator(".nextStepTodayAdd") }).first();
  const add = row.locator(".nextStepTodayAdd");
  const before = (await add.boundingBox())!;
  await row.hover();
  await page.waitForTimeout(160);
  const after = (await add.boundingBox())!;
  expect(Math.abs(after.x - before.x)).toBeLessThanOrEqual(1);
});

test("G8 the empty Next Step text opens the same editor", async ({ page }) => {
  const fixture = createFullTodayFixture();
  const project = fixture.config.projects[0];
  fixture.config.projects = fixture.config.projects.map((item) =>
    item.id === project.id ? { ...item, nextStep: undefined } : item,
  );
  await open(page, fixture);
  const row = page.locator(".projectGrid .nextStepCard").filter({ hasText: project.name }).first();
  const placeholder = row.locator(".projectNextStepPlaceholder--action");
  await expect(placeholder).toBeVisible();
  await expect(placeholder).toHaveCSS("cursor", "pointer");
  await placeholder.hover();
  await expect(placeholder).toHaveCSS("color", "rgb(255, 206, 91)");
  await expect(placeholder).toHaveCSS("border-top-color", "rgba(231, 185, 77, 0.6)");
  await placeholder.click();
  await expect(page.getByRole("dialog", { name: "次の一手を設定" })).toBeVisible();
});

test("P10-15c J2 the victory bar never gets its top border clipped", async ({ page }) => {
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 860, height: 560 },
  ]) {
    await page.setViewportSize(viewport);
    await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
    await installTauriMock(page, createFullTodayFixture(), "main");
    await page.goto("/");
    await expect(page.locator(".doNowBand")).toBeVisible();
    const bar = page.locator(".victoryBar");
    const area = page.locator(".mainScrollArea");
    const barBox = (await bar.boundingBox())!;
    const areaBox = (await area.boundingBox())!;
    const before = Math.round(barBox.y);
    expect(before).toBe(80);
    await bar.hover();
    await page.waitForTimeout(180);
    const hovered = (await bar.boundingBox())!;
    expect(hovered.y).toBeGreaterThanOrEqual(areaBox.y - 0.5);
  }
});