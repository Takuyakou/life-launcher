import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type Control = {
  currentConfig: () => AppConfig;
  setSaveConfigFailure: (failed: boolean) => void;
  invokeCalls: { command: string; args: Record<string, unknown> }[];
};

function fixture3() {
  const fixture = createPublicFixture();
  fixture.config.today.items = [
    { ...fixture.config.today.items[0], shortTimerMinutes: 5, defaultTimerMinutes: 35 },
    { text: fixture.config.inbox[0].text, done: false, sourceKey: "wishlist:sample-later" },
    { ...fixture.config.today.items[1] },
  ];
  return fixture;
}

async function prepare(page: Page, fixture = fixture3()) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".todayRow")).toHaveCount(3);
}

async function state(page: Page) {
  return page.evaluate(() => {
    const c = (window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control })
      .__LIFE_LAUNCHER_VISUAL_QA__;
    return { config: c.currentConfig(), calls: c.invokeCalls };
  });
}

test("removes only Today adoption, preserves both sources, candidates and sessions on reload", async ({
  page,
}) => {
  const fixture = fixture3();
  await prepare(page, fixture);
  const before = await state(page);
  await page.locator(".todayRemoveButton").first().click();
  await expect(page.locator(".toast").last()).toContainText("今日の3件から外しました");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.locator(".todayRemoveButton").first().click();
  await expect(page.locator(".todayRow")).toHaveCount(1);
  const after = await state(page);
  expect(after.config.projects).toEqual(before.config.projects);
  expect(after.config.inbox).toEqual(before.config.inbox);
  expect(after.config.sourceCompletions).toEqual(before.config.sourceCompletions);
  expect(after.config.today.candidateExcludedSourceKeys).toEqual([]);
  expect(after.config.today.items).toEqual([fixture.config.today.items[2]]);
  const mutations = after.calls
    .slice(before.calls.length)
    .filter((c) => /session/.test(c.command) && !/^(get|list|load|read)_/.test(c.command));
  expect(mutations).toEqual([]);
  await page.reload();
  await expect(page.locator(".todayRow")).toHaveCount(1);
  await page.locator(".todayBuilderDisclosure").click();
  for (const text of [fixture.config.projects[0].nextStep, fixture.config.inbox[0].text]) {
    await expect(
      page
        .locator(".todayBuilderRow", { hasText: text })
        .getByRole("button", { name: "今日へ", exact: true }),
    ).toBeEnabled();
  }
});

test("active and paused item cannot be removed even through its React handler; another item can", async ({
  page,
}) => {
  await prepare(page);
  const card = page.locator(".todayRow").first();
  await card.getByRole("button", { name: "短時間タイマー5分で開始" }).click();
  const remove = card.locator(".todayRemoveButton");
  await expect(remove).toBeDisabled();
  await expect(remove).toHaveAttribute("title", "タイマーを停止してから外してください");
  await remove.evaluate((node) => (node as HTMLButtonElement).click());
  await remove.press("Enter");
  await remove.press("Space");
  await remove.evaluate(async (node) => {
    // Bypass the native disabled button to verify the application handler guard itself.
    const key = Object.keys(node).find((name) => name.startsWith("__reactProps$"));
    if (!key) throw new Error("React event props unavailable");
    await (node as unknown as Record<string, { onClick: () => Promise<void> }>)[key].onClick();
  });
  await expect(page.locator(".todayRow")).toHaveCount(3);
  await card.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "今日の3件から外す" })).toBeDisabled();
  await page.locator(".todayCompletionSummary").click();
  await expect(page.getByRole("menu")).toHaveCount(0);
  await card.getByRole("button", { name: "このセッションを一時停止", exact: true }).click();
  await expect(remove).toBeDisabled();
  await page.locator(".todayRemoveButton").nth(1).click();
  await expect(page.locator(".todayRow")).toHaveCount(2);
  await expect(card).toHaveClass(/todayRow--running/);
  await card.getByRole("button", { name: "終了", exact: true }).click();
  await expect(remove).toBeEnabled();
  await remove.click();
  await expect(page.locator(".todayRow")).toHaveCount(1);
});

test("failed save restores exact Today snapshots and order with no success toast", async ({
  page,
}) => {
  await prepare(page);
  const before = (await state(page)).config;
  await page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: Control }
    ).__LIFE_LAUNCHER_VISUAL_QA__.setSaveConfigFailure(true),
  );
  await page.locator(".todayRemoveButton").nth(1).click();
  await expect(page.locator(".toast").last()).toContainText("保存できません");
  await expect(page.locator(".todayRow")).toHaveCount(3);
  expect((await state(page)).config).toEqual(before);
  await expect(page.locator(".todayTextButton")).toHaveText(before.today.items.map((i) => i.text));
  await page.reload();
  expect((await state(page)).config).toEqual(before);
});

test("completed removal preserves existing batch rules and reusable sources", async ({ page }) => {
  const fixture = fixture3();
  fixture.config.today.items.forEach((item) => {
    item.done = true;
  });
  await prepare(page, fixture);
  await expect(page.getByRole("button", { name: "次の3件を選ぶ" })).toBeVisible();
  await page.locator(".todayRemoveButton").first().click();
  await expect(page.getByRole("button", { name: "次の3件を選ぶ" })).toHaveCount(0);
  expect((await state(page)).config.today.items.every((item) => item.done)).toBe(true);
  expect((await state(page)).config.projects).toEqual(fixture.config.projects);
});

test("removing preceding legacy card does not change another active timer identity", async ({
  page,
}) => {
  const fixture = fixture3();
  delete fixture.config.today.items[1].sourceKey;
  await prepare(page, fixture);
  await page
    .locator(".todayRow")
    .nth(1)
    .getByRole("button", { name: "短時間タイマー5分で開始" })
    .click();
  await page.locator(".todayRemoveButton").first().click();
  await expect(page.locator(".todayRow").first()).toHaveClass(/todayRow--running/);
  await expect(page.locator(".todayRemoveButton").first()).toBeDisabled();
});

test("trigger appears only over its timer-top region or keyboard focus without layout movement", async ({
  page,
}) => {
  await prepare(page);
  const card = page.locator(".todayRow").first();
  const trigger = card.locator(".todayTriggerButton--empty");
  const timers = card.locator(".todayTimerActions");
  await card.locator(".todayTextButton").hover();
  await expect(trigger).toHaveCSS("opacity", "0");
  await card.locator(".todayRemoveButton").hover();
  await expect(trigger).toHaveCSS("opacity", "0");
  const before = await timers.boundingBox();
  await card.locator(".todayTriggerZone").hover();
  await expect(trigger).toHaveCSS("opacity", "1");
  expect(await timers.boundingBox()).toEqual(before);
  const a = await trigger.boundingBox();
  expect(a!.y + a!.height).toBeLessThanOrEqual(before!.y);
  await page.mouse.move(0, 0);
  await expect(trigger).toHaveCSS("opacity", "0");
  await card.locator(".todayRemoveButton").focus();
  await page.keyboard.press("Tab");
  await expect(trigger).toBeFocused();
  await expect(trigger).toHaveCSS("opacity", "1");
  await page.keyboard.press("Enter");
  const input = card.getByRole("textbox", { name: "いつ・何の後にやる？" });
  await input.fill("夕食後");
  await input.press("Enter");
  await page.mouse.move(0, 0);
  await expect(card.locator(".todayTriggerZone")).toContainText("夕食後");
  expect((await state(page)).config.today.items[0].trigger).toBe("夕食後");
});

for (const [width, columns] of [
  [1440, 3],
  [1000, 2],
  [860, 1],
]) {
  test(`remove action layout, long text, hover, focus and running at ${width}`, async ({
    page,
  }, testInfo) => {
    const fixture = fixture3();
    fixture.config.today.items[0].text =
      "長い行動文でも短時間と通常のタイマーおよび今日の3件から外すボタンが重ならず操作できることを確認する";
    await prepare(page, fixture);
    await page.setViewportSize({ width, height: 900 });
    const grid = page.locator(".todayGrid");
    expect(
      await grid.evaluate((node) => getComputedStyle(node).gridTemplateColumns.split(" ").length),
    ).toBe(columns);
    const remove = page.locator(".todayRemoveButton").first();
    await remove.hover();
    await page.screenshot({ path: testInfo.outputPath(`today-remove-${width}-hover.png`) });
    await remove.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(remove).toBeFocused();
    expect(await remove.evaluate((node) => node.matches(":focus-visible"))).toBe(true);
    await page.screenshot({ path: testInfo.outputPath(`today-remove-${width}-focus.png`) });
    await page
      .locator(".todayRow")
      .first()
      .getByRole("button", { name: "短時間タイマー5分で開始" })
      .click();
    await expect(remove).toBeDisabled();
    await page.screenshot({ path: testInfo.outputPath(`today-remove-${width}-running.png`) });
    for (const card of await page.locator(".todayRow").all()) {
      const footer = card.locator(".todayCardFooter");
      expect(await footer.evaluate((node) => node.scrollWidth <= node.clientWidth)).toBe(true);
      const a = await card.locator(".todayRemoveButton").boundingBox();
      const b = await card.locator(".todayTimerActions, .todayCompletedLabel").boundingBox();
      expect(a && b && (a.x + a.width <= b.x || a.y + a.height <= b.y)).toBeTruthy();
    }
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
  });
}
