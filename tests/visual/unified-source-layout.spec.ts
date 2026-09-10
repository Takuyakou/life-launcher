import { expect, test } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

for (const width of [1440, 860]) {
  test(`unified source rows, hover and menus at ${width}`, async ({ page }, info) => {
    const fixture = createPublicFixture();
    fixture.config.inbox = [
      { id: "layout-linked", projectId: fixture.config.projects[0].id, text: "長い行動文でも行の高さと操作の位置を維持する".repeat(8) },
      { id: "layout-unlinked", text: "プロジェクト未設定の項目" },
    ];
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
    await installTauriMock(page, fixture, "main");
    await page.goto("/");
    const disclosure = page.locator(".inboxBand .disclosure");
    if (await disclosure.getAttribute("aria-expanded") !== "true") await disclosure.click();
    const project = page.locator(".nextStepRow").first();
    const inbox = page.locator(".inboxRow").first();
    const metrics = async (row: typeof inbox) => row.evaluate(el => {
      const copy = el.querySelector(".sourceListCopy")!;
      const rect = el.getBoundingClientRect();
      return {
        height: rect.height,
        textX: copy.children[1].getBoundingClientRect().x,
        background: getComputedStyle(el).backgroundColor,
        overflow: el.scrollWidth > el.clientWidth,
      };
    });
    const a = await metrics(project), b = await metrics(inbox);
    expect(a.height).toBe(b.height);
    expect(a.textX).toBe(b.textX);
    expect(b.overflow).toBe(false);
    const builderToggle = page.locator(".todayBuilderHeader .disclosure");
    if (await builderToggle.getAttribute("aria-expanded") !== "true") await builderToggle.click();
    const builder = page.locator(".todayBuilderRow").first();
    const c = await metrics(builder);
    expect(c.height).toBe(a.height);
    expect(c.textX).toBe(a.textX);
    expect(c.overflow).toBe(false);
    await builder.hover();
    expect((await metrics(builder)).background).not.toBe(c.background);
    await builder.focus();
    await expect(builder).toBeFocused();
    await page.locator(".todayBuilderBody").screenshot({ path: info.outputPath("builder-hover-focus.png") });
    await expect(builder.getByRole("button")).toBeVisible();
    await inbox.hover();
    expect((await metrics(inbox)).background).not.toBe(b.background);
    await expect(inbox.locator(".sourceRowMenu")).toHaveCSS("opacity", "1");
    await page.locator(".inboxBand").screenshot({ path: info.outputPath("wishlist-hover.png") });
    await inbox.locator(".sourceRowMenu").click();
    await expect(page.getByRole("menuitem", { name: "編集", exact: true })).toBeVisible();
    await expect(page.locator('[role="menuitem"]:not(:disabled)').first()).toBeFocused();
    await expect(page.locator(".inboxDragGhost")).toHaveCount(0);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);
    await expect(inbox.locator(".sourceRowMenu")).toBeFocused();
    await project.locator(".sourceRowMenu").focus();
    await expect(project.locator(".sourceRowMenu")).toBeFocused();
    await expect(project.locator(".sourceRowMenu")).toHaveCSS("opacity", "1");
    await page.locator(".projectsBand").screenshot({ path: info.outputPath("nextstep-focus.png") });
    await page.keyboard.press("Enter");
    await expect(page.getByRole("menuitem", { name: "編集", exact: true })).toBeVisible();
    await expect(page.locator('[role="menuitem"]:not(:disabled)').first()).toBeFocused();
    await page.keyboard.press("Escape");
    const header = page.locator(".inboxBand .disclosureHeader");
    const positions = await header.evaluate(el => Array.from(el.children).map(child => child.getBoundingClientRect().x));
    expect(positions).toEqual([...positions].sort((x, y) => x - y));
    await page.locator(".inboxBand .disclosureDescription").click();
    await expect(disclosure).toHaveAttribute("aria-expanded", "false");
    await page.getByRole("button", { name: "やりたいことを追加", exact: true }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
}
