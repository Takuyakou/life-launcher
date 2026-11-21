import { expect, test, type Page } from "@playwright/test";
import {
  bookPages,
  createPublicFixture,
  FIXTURE_NOW,
  type VisualQaFixture,
} from "./fixtures";
import { waitForBundledFonts } from "./bundledFonts";
import { installTauriMock } from "./tauriMock";

const BOOK_PATH = "C:\\PublicDemo\\Instructions\\教材\\英単語ドリル.zip";
const SCREENSHOT_OPTIONS = {
  animations: "disabled" as const,
  caret: "hide" as const,
  maxDiffPixelRatio: 0.001,
};

function doNowFixture(): VisualQaFixture {
  const fixture = createPublicFixture();
  const project = fixture.config.projects.find((entry) => entry.id === "sample-learning");
  if (!project?.nextStep) throw new Error("fixture project is missing");
  project.nextStep.text = "英単語ドリルを1見開き進める";
  project.nextStep.instructionPath = BOOK_PATH;
  fixture.instructionBookPages = { [BOOK_PATH]: { pages: bookPages(120) } };
  fixture.instructionBookState = {
    [BOOK_PATH]: {
      direction: "rtl",
      spread: true,
      coverSingle: true,
      lastPage: 34,
    },
  };
  return fixture;
}

async function prepare(page: Page, fixture: VisualQaFixture) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1020, height: 653 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await waitForBundledFonts(page);
  await expect(page.locator(".doNowBand")).toBeVisible();
}

test("V160-B4 the Do Now chip shows p.34 and reads it in the label", async ({ page }) => {
  await prepare(page, doNowFixture());
  const chip = page.locator(".doNowOpenChip--button");
  await expect(chip).toContainText("英単語ドリル.zip");
  const badge = chip.locator(".doNowOpenChipPage");
  await expect(badge).toHaveText("p.34");
  await expect(chip).toHaveAttribute("aria-label", "英単語ドリル.zip、34ページから");
  const style = await badge.evaluate((element) => {
    const computed = getComputedStyle(element);
    return {
      marginLeft: computed.marginLeft,
      padding: computed.padding,
      borderRadius: computed.borderRadius,
      background: computed.backgroundColor,
      color: computed.color,
      fontWeight: computed.fontWeight,
      lineHeight: computed.lineHeight,
    };
  });
  expect(style.marginLeft).toBe("2px");
  expect(style.padding).toBe("0px 6px");
  expect(style.borderRadius).toBe("999px");
  expect(style.background).toBe("rgba(255, 206, 91, 0.14)");
  expect(style.color).toBe("rgb(255, 206, 91)");
  expect(style.fontWeight).toBe("700");
  expect(style.lineHeight).toBe("18px");

  await expect(page).toHaveScreenshot("do-now-page.png", SCREENSHOT_OPTIONS);
});

test("V160-B4 the badge follows a saved page and disappears below page 2", async ({ page }) => {
  await prepare(page, doNowFixture());
  const chip = page.locator(".doNowOpenChip--button");
  await expect(chip.locator(".doNowOpenChipPage")).toHaveText("p.34");

  await page.evaluate(async (path) => {
    const internals = (
      window as unknown as {
        __TAURI_INTERNALS__: {
          invoke: (command: string, args: Record<string, unknown>) => Promise<unknown>;
        };
      }
    ).__TAURI_INTERNALS__;
    await internals.invoke("save_instruction_book_state", {
      path,
      state: {
        direction: "rtl",
        spread: true,
        coverSingle: true,
        lastPage: 50,
      },
    });
  }, BOOK_PATH);
  await expect(chip.locator(".doNowOpenChipPage")).toHaveText("p.50");
  await expect(chip).toHaveAttribute("aria-label", "英単語ドリル.zip、50ページから");

  await page.evaluate(async (path) => {
    const internals = (
      window as unknown as {
        __TAURI_INTERNALS__: {
          invoke: (command: string, args: Record<string, unknown>) => Promise<unknown>;
        };
      }
    ).__TAURI_INTERNALS__;
    await internals.invoke("save_instruction_book_state", {
      path,
      state: {
        direction: "rtl",
        spread: true,
        coverSingle: true,
        lastPage: 1,
      },
    });
  }, BOOK_PATH);
  await expect(chip.locator(".doNowOpenChipPage")).toHaveCount(0);
  await expect(chip).not.toHaveAttribute("aria-label", /ページから/);
});

test("V160-B4 a non-ZIP instruction keeps the plain chip", async ({ page }) => {
  await prepare(page, createPublicFixture());
  const chip = page.locator(".doNowOpenChip--button");
  await expect(chip).toHaveText("guide.md");
  await expect(chip.locator(".doNowOpenChipPage")).toHaveCount(0);
  await expect(chip).not.toHaveAttribute("aria-label", /ページから/);
});
