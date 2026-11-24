import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

// V164 (E5): a menu that is playing its close motion is inert. Escape must still put the focus back
// on the control that opened the menu, also on a slow machine. Before E5 the focus check in
// ContextMenu saw the closing menu as "still open" and skipped the return (found under load in FULL).

function withUrlButton(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.buttons = fixture.config.buttons.map((button) =>
    button.id === "reference-site" ? { ...button, showInSidebar: true } : button,
  );
  return fixture;
}

async function prepare(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1000, height: 640 });
  await installTauriMock(page, withUrlButton(), "main");
  await page.goto("/");
  await waitForBundledFonts(page);
}

test("V164-E5 Escape on a sidebar menu returns the focus to its button on a slow machine", async ({
  page,
}) => {
  await prepare(page);
  const cdp = await page.context().newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
  const urlButton = page.locator(".quickButton", { hasText: "参考サイト" });
  for (let round = 0; round < 4; round += 1) {
    await urlButton.focus();
    await urlButton.press("Shift+F10");
    await expect(page.getByRole("menu", { name: "操作メニュー" })).toHaveCount(1);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu", { name: "操作メニュー" })).toHaveCount(0);
    await expect(urlButton).toBeFocused();
  }
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
});
