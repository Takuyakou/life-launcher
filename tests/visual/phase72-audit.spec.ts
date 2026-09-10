import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// Audit evidence only: keep product styles and behavior untouched.
for (const width of [1920, 1440, 1366, 1000, 860]) {
  test(`P72 timer baseline ${width}`, async ({ page }) => {
    const fixture = createPublicFixture();
    fixture.config.today.items = [
      { ...fixture.config.today.items[0], shortTimerMinutes: 5, defaultTimerMinutes: 135,
        text: "長い行動文でもタイマーと外すボタンが重ならず操作できることを確認する。".repeat(3) },
      { ...fixture.config.today.items[1], done: false, shortTimerMinutes: 15, defaultTimerMinutes: 35 },
      { text: "", done: false, sourceKey: "audit:third",
        shortTimerMinutes: 5, defaultTimerMinutes: 25 },
    ];
    await page.setViewportSize({ width, height: 900 });
    await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
    await installTauriMock(page, fixture, "main");
    await page.goto("/");
    await expect(page.locator(".todayRow")).toHaveCount(3);
    const directory = "docs/phase7.2/screenshots/baseline";
    mkdirSync(directory, { recursive: true });
    const capture = async () => page.locator(".todayGrid").evaluate(grid => {
      const rect = (node: Element) => {
        const r = node.getBoundingClientRect();
        return { x: r.x, y: r.y, width: r.width, height: r.height };
      };
      return {
        viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
        columns: getComputedStyle(grid).gridTemplateColumns,
        overflow: document.documentElement.scrollWidth > innerWidth,
        cards: Array.from(grid.querySelectorAll(".todayRow"), node => rect(node)),
        buttons: Array.from(grid.querySelectorAll<HTMLButtonElement>(".todayStartButton"), node => {
          const css = getComputedStyle(node);
          return { rect: rect(node), label: node.getAttribute("aria-label"), title: node.title,
            disabled: node.disabled, color: css.color, background: css.backgroundColor,
            border: css.borderColor, font: css.font, radius: css.borderRadius,
            duration: node.querySelector(".nextStepStartDuration")?.textContent,
            durationFont: getComputedStyle(node.querySelector(".nextStepStartDuration")!).font,
            durationOpacity: getComputedStyle(node.querySelector(".nextStepStartDuration")!).opacity,
            glyphOpacity: getComputedStyle(node.querySelector(".nextStepStartGlyph")!).opacity,
            transition: getComputedStyle(node.querySelector(".nextStepStartDuration")!).transition,
            focusVisible: node.matches(":focus-visible") };
        }),
      };
    });
    const idle = await capture();
    expect(idle.overflow).toBe(false);
    expect(idle.buttons[1].title).toBe("通常タイマー: 135分");
    expect(idle.buttons[1].durationOpacity).toBe("0");
    expect(idle.buttons[4].disabled).toBe(true);
    expect(idle.buttons[5].disabled).toBe(true);
    await page.screenshot({ path: `${directory}/timer-${width}-idle.png` });
    const normal = page.locator(".todayStartButton--normal").first();
    await normal.hover();
    await page.clock.runFor(200);
    const hover = await capture();
    expect(hover.buttons[1].durationOpacity).toBe("1");
    expect(hover.buttons[1].rect).toEqual(idle.buttons[1].rect);
    await page.screenshot({ path: `${directory}/timer-${width}-hover.png` });
    await page.mouse.move(0, 0);
    await normal.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await page.clock.runFor(200);
    const focus = await capture();
    expect(focus.buttons[1].focusVisible).toBe(true);
    expect(focus.buttons[1].durationOpacity).toBe("1");
    await page.screenshot({ path: `${directory}/timer-${width}-focus.png` });
    await page.locator(".todayStartButton--short").first().click();
    await expect(page.locator(".todayRemoveButton").first()).toBeDisabled();
    await expect(page.locator(".todayRow").first().locator(".todayStartButton")).toHaveCount(0);
    await page.screenshot({ path: `${directory}/timer-${width}-running.png` });
    writeFileSync(`${directory}/timer-${width}.json`, JSON.stringify({ idle, hover, focus,
      running: "Start buttons replaced with pause/stop; remove disabled" }, null, 2) + "\n");
  });
}
