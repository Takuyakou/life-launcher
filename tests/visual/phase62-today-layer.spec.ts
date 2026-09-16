import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

test.describe.configure({ mode: "serial" });

async function prepare(page: Page, fixture: VisualQaFixture = createPublicFixture()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
  await page.addStyleTag({
    content: "*,*::before,*::after{animation:none!important;transition:none!important}",
  });
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { currentConfig: () => AppConfig };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    return control.currentConfig();
  });
}

async function setSaveFailure(page: Page, failed: boolean) {
  await page.evaluate((value) => {
    const control = (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__?: { setSaveConfigFailure: (failed: boolean) => void };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__;
    if (!control) throw new Error("Visual QA control is unavailable");
    control.setSaveConfigFailure(value);
  }, failed);
}

test.skip("Builder is the only persistent Today adoption surface and groups its sources", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.projects.push(
    {
      ...fixture.config.projects[0],
      id: "sample-writing",
      name: "サンプル執筆",
      nextStep: {
        ...fixture.config.projects[0].nextStep!,
        text: "見出しを1つ書く",
      },
      weeklyFocus: false,
    },
    {
      ...fixture.config.projects[1],
      id: "sample-review",
      name: "サンプル振り返り",
      nextStep: {
        ...fixture.config.projects[1].nextStep!,
        text: "メモを1つ見返す",
      },
      weeklyFocus: false,
    },
  );
  fixture.config.inbox.push({ id: "sample-idea", text: "新しい案を試す" });
  await prepare(page, fixture);

  await page.evaluate(() => {
    localStorage.setItem(
      "life-launcher-today-builder-order",
      JSON.stringify([
        "project:sample-learning",
        "wishlist:sample-later",
        "project:sample-stretch",
        "wishlist:sample-weekend",
        "project:sample-writing",
        "wishlist:sample-idea",
        "project:sample-review",
      ]),
    );
  });
  await page.reload();

  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  await expect(page.locator(".projectsBand .nextStepTodayButton")).toHaveCount(0);
  await page.locator(".inboxBand .disclosure").click();
  await expect(page.locator(".inboxBand .moveTodayButton")).toHaveCount(0);
  await expect(page.locator(".todayBuilderGroupHeading")).toHaveText([
    "次の一手4件",
    "やりたいこと3件",
  ]);
  await expect(page.getByRole("button", { name: "今日の候補を追加" })).toHaveCount(0);
  await expect(
    page.locator(".todayPickerRow:not(.todayPickerRow--groupedWishlist) .projectIdentity"),
  ).toHaveCount(4);
  await expect(page.locator(".todayBuilderProjectGroupHeader")).toHaveCount(1);
  await expect(
    page.locator(".todayPickerRow").getByRole("button", { name: "今日へ" }),
  ).toHaveCount(5);
  const firstBuilderRow = page.locator(".todayPickerRow").first();
  const builderMenu = firstBuilderRow.locator(".sourceRowMenu");
  await expect(builderMenu).toHaveCSS("opacity", "1");
  expect((await builderMenu.boundingBox())?.width).toBe(28);
  expect((await builderMenu.boundingBox())?.height).toBe(28);
  await expect(firstBuilderRow.locator("strong")).toHaveCSS(
    "font-size",
    await page
      .locator(".nextStepCard .nextStepActionRegion p")
      .first()
      .evaluate((node) => getComputedStyle(node).fontSize),
  );
  await page.getByRole("button", { name: "次のページ" }).click();
  await expect(page.locator(".todayBuilderGroupHeading")).toHaveCount(0);
  await expect(page.locator(".todayPickerRow")).toHaveCount(2);
  await expect(page.locator(".todayPickerRow .projectIdentity")).toHaveCount(0);
  await expect(page.locator(".todayBuilderProjectGroupHeader")).toHaveCount(2);
  await expect(
    page.locator(".todayPickerRow").getByRole("button", { name: "今日へ" }),
  ).toHaveCount(2);
});

test.skip("Builder Wishlist groups matching Projects and toggles each group", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.inbox = [
    { id: "builder-learning-one", text: "同じProjectの候補1", projectId: "sample-learning" },
    { id: "builder-unassigned", text: "未分類の候補" },
    { id: "builder-learning-two", text: "同じProjectの候補2", projectId: "sample-learning" },
  ];
  await prepare(page, fixture);
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();

  const learningHeader = page.locator(
    '[data-today-builder-project-group="project:sample-learning"]',
  );
  const learningRows = page.locator(
    '[data-today-builder-wishlist-group="project:sample-learning"] .todayPickerRow',
  );
  await expect(learningHeader).toContainText("サンプル学習");
  await expect(learningHeader).toContainText("2件");
  const projectBox = (await learningHeader.locator(".projectIdentity").boundingBox())!;
  const countBox = (await learningHeader.locator(":scope > span:last-child").boundingBox())!;
  expect(countBox.x - (projectBox.x + projectBox.width)).toBeLessThanOrEqual(8);
  await expect(learningRows).toHaveCount(2);
  await expect(learningRows.nth(0)).toContainText("同じProjectの候補1");
  await expect(learningRows.nth(1)).toContainText("同じProjectの候補2");
  await expect(learningRows.locator(".inboxProjectIdentity")).toHaveCount(0);

  await learningHeader.click();
  await expect(learningHeader).toHaveAttribute("aria-expanded", "false");
  await expect(learningRows).toHaveCount(0);
  await learningHeader.click();
  await expect(learningHeader).toHaveAttribute("aria-expanded", "true");
  await expect(learningRows).toHaveCount(2);
  await page.locator(".todayBuilderBand").screenshot({
    path: "dist/visual-qa/v13-nextstep-wishlist/builder-wishlist-groups-1440.png",
  });
  await page.setViewportSize({ width: 860, height: 900 });
  expect(
    await page
      .locator(".todayBuilderBand")
      .evaluate((node) => node.scrollWidth <= node.clientWidth),
  ).toBe(true);
  await page.locator(".todayBuilderBand").screenshot({
    path: "dist/visual-qa/v13-nextstep-wishlist/builder-wishlist-groups-860.png",
  });
});

test.skip("excluding a candidate keeps its source, removes linked Today3, and survives reload", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  const candidate = page.locator(".todayPickerRow", { hasText: "資料を1ページ読む" });
  await candidate.click({ button: "right" });
  await page.getByRole("menuitem", { name: "今日の候補から外す" }).click();

  let config = await currentConfig(page);
  expect(config.projects[0].nextStep?.text).toBe("資料を1ページ読む");
  expect(config.today.items.some((item) => item.sourceKey === "project:sample-learning")).toBe(
    false,
  );
  expect(config.today.candidateExcludedSourceKeys).toContain("project:sample-learning");
  await expect(candidate).toHaveCount(0);

  await page.reload();
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  await expect(page.locator(".todayPickerRow", { hasText: "資料を1ページ読む" })).toHaveCount(0);
  config = await currentConfig(page);
  expect(config.projects[0].nextStep?.text).toBe("資料を1ページ読む");
});

test.skip("candidate exclusion rolls the Today layer back when save fails", async ({ page }) => {
  const fixture = createPublicFixture();
  await prepare(page, fixture);
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  await setSaveFailure(page, true);
  const candidate = page.locator(".todayPickerRow", { hasText: "資料を1ページ読む" });
  await candidate.click({ button: "right" });
  await page.getByRole("menuitem", { name: "今日の候補から外す" }).click();

  await expect(page.locator(".toast").last()).toContainText("保存できません");
  const config = await currentConfig(page);
  expect(config.today.candidateExcludedSourceKeys).toEqual([]);
  expect(config.today.items.some((item) => item.sourceKey === "project:sample-learning")).toBe(
    true,
  );
  await expect(candidate).toBeVisible();
});

test.skip("active Today timer disables candidate exclusion until it is stopped", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [fixture.config.today.items[0]];
  await prepare(page, fixture);
  await page
    .locator(".todayRow")
    .getByRole("button", { name: /短時間タイマー5分で開始/ })
    .click();
  await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
  await page
    .locator(".todayPickerRow", { hasText: "資料を1ページ読む" })
    .click({ button: "right" });
  const action = page.getByRole("menuitem", { name: "今日の候補から外す" });
  await expect(action).toBeDisabled();
  await expect(action).toHaveAttribute("title", "タイマーを停止してから外してください");
});

for (const width of [860]) {
  test(`Builder compact layout has no horizontal overflow at ${width}px`, async ({ page }) => {
    const fixture = createPublicFixture();
    fixture.config.projects[0].nextStep = {
      ...fixture.config.projects[0].nextStep!,
      text: "長い日本語の候補でもボタンと重ならず今日やる一手として最後まで確認できるようにする",
    };
    await prepare(page, fixture);
    await page.setViewportSize({ width, height: 900 });
    await page.getByRole("button", { name: "今日やるものを選ぶ" }).click();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      await page.evaluate(() => document.documentElement.clientWidth),
    );
    await expect(page.locator(".todayPickerRow").first()).toBeVisible();
  });
}
