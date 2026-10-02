import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, fixture: VisualQaFixture) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

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

  const doNowEmpty = page.locator(".doNowEmpty");
  await expect(doNowEmpty).toContainText("プロジェクトを作り、次の一手を設定すると提案されます。");
  await doNowEmpty.getByRole("button", { name: "プロジェクトを追加" }).click();
  const setup = page.getByRole("dialog", { name: "プロジェクトを追加" });
  await expect(setup).toBeVisible();
  await setup.getByRole("button", { name: "プロジェクトを追加を閉じる" }).click();
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
  const doNowBox = await doNowEmpty.boundingBox();
  expect(doNowBox).not.toBeNull();
  expect(Math.abs(doNowBox!.height - todayBox!.height)).toBeLessThanOrEqual(1);
  for (const box of [todayBox!, projectBox!]) {
    expect(Math.abs(box.x - wishlistBox!.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.width - wishlistBox!.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(box.height - wishlistBox!.height)).toBeLessThanOrEqual(1);
  }

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
