import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type VisualQaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
    setReapplyDashboardSettingsFailure: (shouldFail: boolean) => void;
  };
};

async function prepare(page: Page, width = 1440, size?: "standard" | "large" | "xlarge") {
  const fixture = createPublicFixture();
  if (size) fixture.config.settings.mainDisplaySize = size;
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture);
  await page.goto("/");
  await expect(page.locator(".focusBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
}

async function expectMainFits(page: Page) {
  const overflow = await page.evaluate(() => {
    const area = document.querySelector(".mainScrollArea")!;
    return {
      document: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      area: area.scrollWidth > area.clientWidth + 1,
    };
  });
  expect(overflow).toEqual({ document: false, area: false });
  for (const button of await page.locator(".topBar .viewToggleButton").all()) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.x + box!.width).toBeLessThanOrEqual(page.viewportSize()!.width);
  }
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "設定を開く" }).click();
  return page.getByRole("dialog", { name: "設定" });
}

test("P89 legacy config defaults to standard and saves all three presets", async ({ page }) => {
  await prepare(page, 1920);
  const content = page.locator(".mainScrollContent");
  await expect(content).toHaveAttribute("data-main-display-size", "standard");
  await expectMainFits(page);
  await expect(page.getByText("先週のふりかえりが見られます")).toHaveCount(0);
  for (const [size, label] of [
    ["large", "大"],
    ["xlarge", "特大"],
    ["standard", "標準"],
  ] as const) {
    const settings = await openSettings(page);
    await settings.getByRole("radio", { name: label, exact: true }).check();
    await settings.getByRole("button", { name: "保存", exact: true }).click();
    await expect(content).toHaveAttribute("data-main-display-size", size);
    await page.reload();
    await expect(content).toHaveAttribute("data-main-display-size", size);
    for (const width of [1920, 620]) {
      await page.setViewportSize({ width, height: 900 });
      await expectMainFits(page);
    }
    await page.setViewportSize({ width: 1920, height: 900 });
  }
});

test("changing only Main size does not retry a conflicting shortcut", async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setReapplyDashboardSettingsFailure(true);
  });
  const reapplyCount = async () =>
    page.evaluate(
      () =>
        (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
          ({ command }) => command === "reapply_dashboard_settings",
        ).length,
    );
  const before = await reapplyCount();
  const settings = await openSettings(page);
  await settings.getByRole("radio", { name: "大", exact: true }).check();
  await settings.getByRole("button", { name: "保存", exact: true }).click();

  await expect(settings).toHaveCount(0);
  await expect(page.locator(".mainScrollContent")).toHaveAttribute(
    "data-main-display-size",
    "large",
  );
  await expect(page.getByText(/ショートカットを登録できません/)).toHaveCount(0);
  expect(await reapplyCount()).toBe(before);
  await page.reload();
  await expect(page.locator(".mainScrollContent")).toHaveAttribute(
    "data-main-display-size",
    "large",
  );
});

test("always-on-top changes apply without retrying unchanged shortcuts", async ({ page }) => {
  await prepare(page);
  await page.evaluate(() => {
    (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setReapplyDashboardSettingsFailure(true);
  });
  const before = await page.evaluate(
    () => (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.length,
  );
  const settings = await openSettings(page);
  await settings.getByRole("checkbox", { name: "常に手前" }).check();
  await settings.getByRole("button", { name: "保存", exact: true }).click();

  await expect(settings).toHaveCount(0);
  const commands = await page.evaluate(() =>
    (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.slice(),
  );
  expect(
    commands.slice(before).some(({ command }) => command === "plugin:window|set_always_on_top"),
  ).toBe(true);
  expect(
    commands.slice(before).some(({ command }) => command === "reapply_dashboard_settings"),
  ).toBe(false);
  await expect(page.getByText(/ショートカットを登録できません/)).toHaveCount(0);
});

test("changing a shortcut still reapplies shortcut settings", async ({ page }) => {
  await prepare(page);
  const reapplyCount = async () =>
    page.evaluate(
      () =>
        (window as VisualQaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
          ({ command }) => command === "reapply_dashboard_settings",
        ).length,
    );
  const before = await reapplyCount();
  const settings = await openSettings(page);
  await settings.getByRole("tab", { name: "ショートカット" }).click();
  await settings.getByRole("button", { name: "辞書のショートカットを解除" }).click();
  await settings.getByRole("button", { name: "保存", exact: true }).click();

  await expect(settings).toHaveCount(0);
  expect(await reapplyCount()).toBe(before + 1);
});

test("P89 xlarge Main remains contained and reachable across responsive boundaries", async ({ page }) => {
  await prepare(page, 1920, "xlarge");
  // Boundary pairs exercise layout changes; 1080 retains a labelled-toolbar sample.
  for (const width of [1080, 1051, 1050, 901, 900, 821, 820, 761, 760, 701, 700, 621, 620]) {
    await page.setViewportSize({ width, height: 900 });
    await expectMainFits(page);
    const toolbar = page.locator(".topBar");
    await toolbar.scrollIntoViewIfNeeded();
    for (const button of await toolbar.locator(".viewToggleButton").all()) {
      expect(await button.evaluate((element) => {
        const box = element.getBoundingClientRect();
        return element.contains(document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2));
      })).toBe(true);
    }
    const rows = page.locator(".todayRow");
    const first = (await rows.nth(0).boundingBox())!;
    const second = (await rows.nth(1).boundingBox())!;
    expect(second.x >= first.x + first.width || second.y >= first.y + first.height).toBe(true);
  }
});

for (const size of ["large", "xlarge"] as const) {
  test("P89 " + size + " preserves NextStep to Today3 drag geometry", async ({ page }) => {
    const fixture = createPublicFixture();
    fixture.config.settings.mainDisplaySize = size;
    fixture.config.today.items = [
      { text: "机の上を5分だけ整える", done: false, sourceKey: "manual:fixture-cleanup" },
    ];
    await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
    await page.setViewportSize({ width: 1920, height: 900 });
    await installTauriMock(page, fixture);
    await page.goto("/");
    const source = page.locator('.nextStepCard[data-project-id="sample-stretch"]');
    const target = page.locator(".todayRow").first();
    await expect(source).toBeVisible();
    const from = await source.boundingBox();
    const to = await target.boundingBox();
    expect(from).not.toBeNull();
    expect(to).not.toBeNull();
    await page.mouse.move(from!.x + from!.width * 0.45, from!.y + from!.height * 0.5);
    await page.mouse.down();
    await page.mouse.move(from!.x + from!.width * 0.45 + 12, from!.y + from!.height * 0.5, {
      steps: 3,
    });
    await page.mouse.move(to!.x + to!.width * 0.75, to!.y + to!.height * 0.5, { steps: 6 });
    await expect(page.locator(".todayGrid")).toHaveClass(/todayGrid--dropTarget/);
    await page.mouse.up();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const qa = (
            window as Window & {
              __LIFE_LAUNCHER_VISUAL_QA__: {
                currentConfig: () => {
                  today: { items: Array<{ sourceKey: string }> };
                };
              };
            }
          ).__LIFE_LAUNCHER_VISUAL_QA__;
          return qa.currentConfig().today.items.map((item) => item.sourceKey);
        }),
      )
      .toContain("project:sample-stretch");
    await expect(source).toBeVisible();
  });
}

for (const size of ["large", "xlarge"] as const) {
  test(
    "P89 " + size + " Main toolbar matches the content width and menu density",
    async ({ page }) => {
      await prepare(page, 1920, size);
      const toolbar = page.locator(".mainPanel > .topBar");
      const toolbarFont = await toolbar.evaluate((element) => getComputedStyle(element).fontSize);
      const settings = await openSettings(page);
      await settings.getByRole("radio", { name: size === "large" ? "特大" : "大", exact: true }).check();
      await settings.getByRole("button", { name: "キャンセル", exact: true }).click();
      await page.getByRole("dialog", { name: "入力内容を破棄して閉じますか？" })
        .getByRole("button", { name: /破棄/ }).click();
      await expect(page.locator(".mainScrollContent")).toHaveAttribute("data-main-display-size", size);
      const button = toolbar.locator(".viewToggleButton").first();
      const mainButtonBox = (await button.boundingBox())!;
      const mainLabelSize = await button.locator(".viewToggleButtonLabel")
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      const topBox = await toolbar.boundingBox();
      const contentBox = await page.locator(".mainScrollContent").boundingBox();
      expect(topBox).not.toBeNull();
      expect(contentBox).not.toBeNull();
      expect(Math.abs(topBox!.x - contentBox!.x)).toBeLessThan(1);
      expect(Math.abs(topBox!.width - contentBox!.width)).toBeLessThan(1);

      await page.getByRole("button", { name: "記録ビューを開く" }).click();
      await expect(page.locator(".mainScrollContent")).not.toHaveAttribute("data-main-display-size", /large|xlarge/);
      expect(await toolbar.evaluate((element) => getComputedStyle(element).fontSize)).toBe(toolbarFont);
      const recordsButtonBox = (await button.boundingBox())!;
      expect(recordsButtonBox.height).toBeLessThan(mainButtonBox.height);
      const recordsLabelSize = await button.locator(".viewToggleButtonLabel")
        .evaluate((element) => parseFloat(getComputedStyle(element).fontSize));
      expect(recordsLabelSize).toBeLessThan(mainLabelSize);
    },
  );
}
