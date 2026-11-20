import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";
import { waitForBundledFonts } from "./bundledFonts";

const SCREENSHOT_OPTIONS = {
  animations: "disabled" as const,
  maxDiffPixelRatio: 0.005,
};

function createEmptyVictoryFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.config.today.victory = {
    text: "",
    done: false,
  };
  return fixture;
}

async function open(
  page: Page,
  viewport: { width: number; height: number },
  fixture = createEmptyVictoryFixture(),
) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize(viewport);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
  await page.evaluate(async () => document.fonts.ready);
}

for (const viewport of [
  { width: 1280, height: 760 },
  { width: 860, height: 560 },
]) {
  test(`P10-18c R2 victory suggestions show only while editing, stay unclipped below the bar, and support Tab/Escape (${viewport.width}x${viewport.height})`, async ({
    page,
  }) => {
    await open(page, viewport);

    const bar = page.locator(".victoryBar");
    const editButton = page.getByRole("button", { name: "今日の勝利条件を編集" });
    const suggestions = page.locator(".victorySuggestions");

    // 1. Not editing: no .victorySuggestions; ArrowDown moves focus without scrolling .victoryBar.
    await expect(suggestions).toHaveCount(0);
    await editButton.focus();
    await expect(editButton).toBeFocused();
    await page.keyboard.press("ArrowDown");
    await expect(editButton).not.toBeFocused();
    expect(await bar.evaluate((node) => node.scrollTop)).toBe(0);

    // 2. Click victory text to edit -> suggestions appear below the bar, every chip is hit-testable at its center.
    await editButton.click();
    const input = page.getByRole("textbox", { name: "今日の勝利条件" });
    await expect(input).toBeFocused();
    await expect(suggestions).toBeVisible();

    const barBox = (await bar.boundingBox())!;
    const suggestionsBox = (await suggestions.boundingBox())!;
    expect(suggestionsBox.y).toBeGreaterThan(barBox.y + barBox.height);

    const chips = suggestions.locator(".suggestionChip");
    const chipCount = await chips.count();
    expect(chipCount).toBeGreaterThan(0);
    for (let index = 0; index < chipCount; index += 1) {
      const chip = chips.nth(index);
      const chipBox = (await chip.boundingBox())!;
      const hitSelf = await chip.evaluate(
        (node, point) => {
          const hit = document.elementFromPoint(point.x, point.y);
          return hit === node || node.contains(hit);
        },
        { x: chipBox.x + chipBox.width / 2, y: chipBox.y + chipBox.height / 2 },
      );
      expect(hitSelf, `chip ${index} center is hit-testable`).toBe(true);
    }

    // 4a. Tab from input moves focus to first chip while keeping suggestions open.
    await page.keyboard.press("Tab");
    await expect(chips.first()).toBeFocused();
    await expect(suggestions).toBeVisible();

    // 4c. Escape on a chip leaves editing and returns focus to the victory text button.
    await page.keyboard.press("Escape");
    await expect(suggestions).toHaveCount(0);
    await expect(editButton).toBeFocused();

    // 4b. Re-enter editing, Tab through all chips and past the last chip -> suggestions disappear.
    await editButton.click();
    await expect(input).toBeFocused();
    await expect(suggestions).toBeVisible();
    for (let index = 0; index < chipCount; index += 1) {
      await page.keyboard.press("Tab");
      await expect(chips.nth(index)).toBeFocused();
      await expect(suggestions).toBeVisible();
    }
    await page.keyboard.press("Tab");
    await expect(suggestions).toHaveCount(0);

    // 3. Click a suggestion chip -> fills victory text and closes suggestions.
    await editButton.click();
    await expect(suggestions).toBeVisible();
    const chosenText = (await chips.first().textContent())?.trim() ?? "";
    expect(chosenText.length).toBeGreaterThan(0);
    await chips.first().click();
    await expect(input).toHaveValue(chosenText);
    await expect(suggestions).toHaveCount(0);
  });
}

test("P10-18c R2 baseline screenshot for victory-suggestions at 1280x760", async ({ page }) => {
  await open(page, { width: 1280, height: 760 });
  await page.getByRole("button", { name: "今日の勝利条件を編集" }).click();
  await expect(page.locator(".victorySuggestions")).toBeVisible();
  await expect(page).toHaveScreenshot("victory-suggestions.png", SCREENSHOT_OPTIONS);
});
