import { expect, test, type Locator, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function interactionColors(target: Locator) {
  await target.hover();
  return target.evaluate((node) => {
    const style = getComputedStyle(node);
    return {
      background: style.backgroundColor,
      border: style.borderColor,
      color: style.color,
    };
  });
}

test("section bars, compact NextStep cards, and selected status share the refined hierarchy", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.projects = [
    fixture.config.projects[0],
    { ...fixture.config.projects[1], id: "empty-next-step", name: "未設定", nextStep: undefined },
  ];
  await prepare(page, fixture);

  const todayBar = page.locator(".todaySectionBar");
  await expect(todayBar.locator(".todaySectionDescription")).toHaveText(
    "今日やると決めたもの。タイマーから開始します。",
  );
  await expect(page.locator(".projectsBand .disclosureDescription")).toHaveText(
    "迷ったときに戻る再開地点。プロジェクトごとに1つだけ設定。",
  );
  const todayHeading = todayBar.getByRole("heading", { name: "今日の3件" });
  const nextStepHeading = page.locator(".projectsBand .disclosureLabel strong");
  await expect(todayHeading).toHaveCSS(
    "font-size",
    await nextStepHeading.evaluate((node) => getComputedStyle(node).fontSize),
  );
  await expect(todayBar.locator(".todaySectionCount")).toHaveCSS(
    "color",
    await todayHeading.evaluate((node) => getComputedStyle(node).color),
  );

  const cards = page.locator(".nextStepCard");
  await expect(cards.first()).toHaveCSS("height", "112px");
  const emptyCard = page.locator('.nextStepCard[data-project-id="empty-next-step"]');
  const placeholderBox = await emptyCard.locator(".projectNextStepPlaceholder").boundingBox();
  const actionBox = await emptyCard.getByRole("button", { name: "次の一手を設定" }).boundingBox();
  expect(placeholderBox && actionBox).toBeTruthy();
  expect(placeholderBox!.y + placeholderBox!.height).toBeLessThanOrEqual(actionBox!.y);

  const selectedCard = page.locator('.nextStepCard[data-project-id="sample-learning"]');
  const lockBox = await selectedCard.locator(".sourceLockBadge").boundingBox();
  const selectedBox = await selectedCard.locator(".nextStepTodayStatus").boundingBox();
  expect(lockBox && selectedBox).toBeTruthy();
  expect(selectedBox!.x).toBeGreaterThan(lockBox!.x + lockBox!.width - 1);
  await expect(selectedCard.locator(".nextStepTodayStatus")).toHaveText("✓ 今日の3件");
  await expect(selectedCard.locator(".nextStepLockedStatus")).toHaveCount(0);
  await page.screenshot({
    path: "dist/visual-qa/phase84/section-card-polish-1440.png",
    fullPage: true,
  });
});

test("populated Today, NextStep, and Wishlist content share the same horizontal bounds", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  const thirdProject = structuredClone(fixture.config.projects[1]);
  thirdProject.id = "sample-third";
  thirdProject.name = "第三Project";
  thirdProject.nextStep!.text = "第三の一手";
  fixture.config.projects.push(thirdProject);
  fixture.config.today.items.push({
    text: "三つ目の今日の項目",
    done: false,
    sourceKey: "project:sample-third",
    projectId: "sample-third",
  });
  await prepare(page, fixture);

  const inboxDisclosure = page.locator(".inboxBand .disclosure");
  if ((await inboxDisclosure.getAttribute("aria-expanded")) !== "true") {
    await inboxDisclosure.click();
  }
  const [todayFirst, todayLast, projectFirst, projectLast, wishlistRow] = await Promise.all([
    page.locator(".todayRow").first().boundingBox(),
    page.locator(".todayRow").last().boundingBox(),
    page.locator(".nextStepCard").first().boundingBox(),
    page.locator(".nextStepCard").last().boundingBox(),
    page.locator(".inboxRow").first().boundingBox(),
  ]);
  expect(todayFirst && todayLast && projectFirst && projectLast && wishlistRow).toBeTruthy();
  const wishlistRight = wishlistRow!.x + wishlistRow!.width;
  for (const [first, last] of [
    [todayFirst!, todayLast!],
    [projectFirst!, projectLast!],
  ]) {
    expect(Math.abs(first.x - wishlistRow!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(last.x + last.width - wishlistRight)).toBeLessThanOrEqual(1);
  }
});

test("empty NextStep and Wishlist sections offer direct setup actions", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects = [];
  fixture.config.inbox = [];
  fixture.config.today.items = [];
  fixture.doNowCandidates = [];
  await prepare(page, fixture);

  const projectEmpty = page.locator(".projectsBand .sectionEmptyState");
  await expect(projectEmpty.getByText("プロジェクトを設定しましょう")).toBeVisible();
  await expect(projectEmpty).toContainText("取り組みたいことをまとめると、次の一手を決められます");
  const projectAction = projectEmpty.getByRole("button", { name: "プロジェクトを設定" });
  await expect(projectAction).toHaveClass(/mainActionButton--gold/);
  await projectAction.click();
  const projectDialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await expect(projectDialog).toBeVisible();
  await projectDialog.getByRole("button", { name: "プロジェクトを追加を閉じる" }).click();

  const inboxDisclosure = page.locator(".inboxBand .disclosure");
  if ((await inboxDisclosure.getAttribute("aria-expanded")) !== "true") {
    await inboxDisclosure.click();
  }
  const wishlistEmpty = page.locator(".inboxBand .sectionEmptyState");
  await expect(wishlistEmpty.getByText("やりたいことを設定しましょう")).toBeVisible();
  await expect(wishlistEmpty).toContainText("あとでやりたいことを登録して、今日やる候補にできます");
  const wishlistAction = wishlistEmpty.getByRole("button", {
    name: "やりたいことを追加する",
  });
  await expect(wishlistAction).toHaveClass(/mainActionButton--gold/);
  const todayEmpty = page.locator(".todayEmptyState");
  const [todayBox, projectBox, wishlistBox] = await Promise.all([
    todayEmpty.boundingBox(),
    projectEmpty.boundingBox(),
    wishlistEmpty.boundingBox(),
  ]);
  expect(todayBox && projectBox && wishlistBox).toBeTruthy();
  for (const box of [todayBox!, projectBox!]) {
    expect(Math.abs(box.x - wishlistBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.width - wishlistBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.height - wishlistBox!.height)).toBeLessThanOrEqual(1);
  }
  const radii = await Promise.all(
    [
      todayEmpty.getByRole("button", { name: "今日やるものを選ぶ" }),
      projectAction,
      wishlistAction,
    ].map((button) => button.evaluate((node) => getComputedStyle(node).borderRadius)),
  );
  expect(new Set(radii).size).toBe(1);
  await page.screenshot({
    path: "dist/visual-qa/phase84/section-empty-states-1440.png",
    fullPage: true,
  });
  await wishlistAction.click();
  await expect(page.getByRole("dialog", { name: "やりたいことを追加" })).toBeVisible();
});

test("content saves do not reapply dashboard shortcuts", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.projects = [];
  fixture.config.inbox = [];
  fixture.config.today.items = [];
  fixture.doNowCandidates = [];
  await prepare(page, fixture);
  await page.evaluate(() => {
    (
      window as Window & {
        __LIFE_LAUNCHER_VISUAL_QA__: {
          setReapplyDashboardSettingsFailure: (shouldFail: boolean) => void;
        };
      }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setReapplyDashboardSettingsFailure(true);
  });
  const reapplyCount = async () =>
    page.evaluate(
      () =>
        (
          window as Window & {
            __LIFE_LAUNCHER_VISUAL_QA__: { invokeCalls: Array<{ command: string }> };
          }
        ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
          ({ command }) => command === "reapply_dashboard_settings",
        ).length,
    );
  const initialReapplyCount = await reapplyCount();

  await page
    .locator(".projectsBand .sectionEmptyState")
    .getByRole("button", { name: "プロジェクトを設定" })
    .click();
  const projectDialog = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await projectDialog.getByRole("textbox", { name: "プロジェクト名" }).fill("保存済みProject");
  await projectDialog.getByRole("button", { name: "プロジェクトを追加", exact: true }).click();
  await expect(projectDialog).toHaveCount(0);
  await expect(page.locator(".nextStepCard", { hasText: "保存済みProject" })).toBeVisible();
  expect(await reapplyCount()).toBe(initialReapplyCount);
  await expect(page.locator(".toast--warn")).toHaveCount(0);
  await expect(page.locator(".toast--error")).toHaveCount(0);

  const inboxDisclosure = page.locator(".inboxBand .disclosure");
  if ((await inboxDisclosure.getAttribute("aria-expanded")) !== "true") {
    await inboxDisclosure.click();
  }
  await page
    .locator(".inboxBand .sectionEmptyState")
    .getByRole("button", { name: "やりたいことを追加する" })
    .click();
  const wishlistDialog = page.getByRole("dialog", { name: "やりたいことを追加" });
  await wishlistDialog.getByRole("textbox", { name: "やりたいこと" }).fill("保存済みWishlist");
  await wishlistDialog.getByRole("button", { name: "保存", exact: true }).click();
  await expect(wishlistDialog).toHaveCount(0);
  await expect(page.locator(".inboxRow", { hasText: "保存済みWishlist" })).toBeVisible();
  expect(await reapplyCount()).toBe(initialReapplyCount);
  await expect(page.locator(".toast--warn")).toHaveCount(0);
});

test("Wishlist mode is gold while settings neutral and warning actions hover gold", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.projects[0].nextStep = undefined;
  await prepare(page, fixture);

  const card = page.locator('.nextStepCard[data-project-id="sample-learning"]');
  await card.getByRole("button", { name: "次の一手を設定" }).click();
  const dialog = page.getByRole("dialog", { name: "次の一手を設定" });
  const wishlistMode = dialog.getByRole("tab", { name: "やりたいことから選ぶ" });
  const newMode = dialog.getByRole("tab", { name: "＋ 新しく入力" });
  await expect(wishlistMode).toHaveClass(/mainActionButton--gold/);
  await expect(wishlistMode).not.toHaveClass(/mainActionButton--positive/);
  await newMode.click();
  await expect(newMode).toHaveClass(/mainActionButton--positive/);
  await dialog.getByRole("button", { name: "次の一手を設定を閉じる" }).click();
  await expect(page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" })).toHaveCount(0);

  const reference = page
    .locator(".projectsBand")
    .getByRole("button", { name: "プロジェクトを追加", exact: true });
  const goldHover = await interactionColors(reference);

  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await settings.getByRole("tab", { name: "メンテナンス" }).click();
  const neutral = settings.getByRole("button", { name: "今日の活動ログをコピー" });
  const warning = settings.getByRole("button", { name: "アイコンキャッシュ再生成" });
  for (const button of [neutral, warning]) {
    const hover = await interactionColors(button);
    expect(hover.color).toBe(goldHover.color);
    expect(hover.border).toMatch(/231, 185, 77/);
    expect(hover.background).toMatch(/231, 185, 77/);
  }
  await settings.screenshot({
    path: "dist/visual-qa/phase84/settings-gold-hover-1440.png",
  });
});
