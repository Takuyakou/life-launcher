import { expect, test, type Page } from "@playwright/test";
import type { AppConfig } from "../../src/types";
import { createPublicFixture, FIXTURE_NOW, type VisualQaFixture } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type VisualQaControl = {
  currentConfig: () => AppConfig;
};

async function prepare(page: Page, fixture: VisualQaFixture, width = 1280) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, fixture, "main");
  await page.goto("/");
  await expect(page.locator(".nextStepCard").first()).toBeVisible();
  const disclosure = page.locator(".inboxBand .disclosure");
  if ((await disclosure.getAttribute("aria-expanded")) !== "true") await disclosure.click();
}

async function currentConfig(page: Page): Promise<AppConfig> {
  return page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.currentConfig(),
  );
}

test("P84 NextStep editor defaults to Wishlist and picks only same-project items", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  fixture.config.projects[0].nextStep = undefined;
  fixture.config.inbox = [
    { id: "wish-first", text: "同じプロジェクトの候補A", projectId: "sample-learning" },
    { id: "wish-second", text: "同じプロジェクトの候補B", projectId: "sample-learning" },
    { id: "wish-other", text: "別プロジェクトの候補", projectId: "sample-stretch" },
    { id: "wish-none", text: "未分類の候補" },
  ];
  const initial = structuredClone(fixture.config);
  await prepare(page, fixture);

  const card = page.locator('.nextStepCard[data-project-id="sample-learning"]');
  await card.getByRole("button", { name: "次の一手を設定", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "次の一手を設定" });
  const modes = dialog.getByRole("tab");
  await expect(modes).toHaveText(["＋ やりたいことから選ぶ", "＋ 新しく入力"]);
  await expect(modes.nth(0)).toHaveAttribute("aria-selected", "true");
  await expect(modes.nth(1)).toHaveAttribute("aria-selected", "false");
  await expect(dialog.getByLabel("行動")).toHaveCount(0);
  const candidates = dialog.getByRole("radio");
  await expect(candidates).toHaveCount(2);
  await expect(candidates).toHaveText(["同じプロジェクトの候補A", "同じプロジェクトの候補B"]);
  await expect(dialog.getByText("別プロジェクトの候補")).toHaveCount(0);
  await expect(dialog.getByText("未分類の候補")).toHaveCount(0);

  await modes.nth(1).click();
  await expect(dialog.getByLabel("行動")).toBeVisible();
  await modes.nth(0).click();

  await candidates.nth(0).click();
  await expect(candidates.nth(0)).toHaveAttribute("aria-checked", "true");
  await candidates.nth(1).click();
  await expect(candidates.nth(0)).toHaveAttribute("aria-checked", "false");
  await expect(candidates.nth(1)).toHaveAttribute("aria-checked", "true");
  await expect(dialog.getByRole("button", { name: "保存", exact: true })).toBeEnabled();

  await page.setViewportSize({ width: 760, height: 820 });
  await dialog.screenshot({ path: "dist/visual-qa/phase84/nextstep-create-pick-760.png" });
  await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
  expect(await currentConfig(page)).toEqual(initial);
});

test("P84 Wishlist selection swaps atomically and returns the previous NextStep", async ({
  page,
}) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [];
  const previous = structuredClone(fixture.config.projects[0].nextStep!);
  await prepare(page, fixture);

  const row = page.locator('[data-inbox-id="sample-weekend"]');
  await row.hover();
  await row.getByRole("button", { name: "週末に試すアイデアの次の一手を設定" }).click();
  const dialog = page.getByRole("dialog", { name: "次の一手を変更" });
  await expect(dialog.getByRole("tab", { name: "やりたいことから選ぶ" })).toHaveAttribute(
    "aria-selected",
    "true",
  );
  await expect(dialog.getByRole("radio", { name: "週末に試すアイデア" })).toHaveAttribute(
    "aria-checked",
    "true",
  );
  await expect(dialog.getByText(/保存するとやりたいことへ戻ります/)).toBeVisible();
  await expect(dialog.getByRole("button", { name: "保存", exact: true })).toBeDisabled();
  await dialog.getByRole("button", { name: "やりたいことへ戻す" }).click();
  await dialog.getByRole("button", { name: "保存", exact: true }).click();

  const saved = await currentConfig(page);
  expect(saved.projects[0].nextStep?.text).toBe("週末に試すアイデア");
  expect(saved.inbox.some((item) => item.id === "sample-weekend")).toBe(true);
  expect(saved.projects[0].nextStep?.sourceWishlistId).toBe("sample-weekend");
  await expect(
    page.locator('[data-inbox-id="sample-weekend"] .wishlistNextStepStatus'),
  ).toHaveText("✓ 次の一手に設定済み");
  expect(saved.inbox).toContainEqual({
    id: expect.any(String),
    text: previous.text,
    projectId: fixture.config.projects[0].id,
  });
});

test("P84 NextStep picker blocks unfinished Today sources", async ({ page }) => {
  const fixture = createPublicFixture();
  fixture.config.today.items = [
    {
      text: fixture.config.projects[0].nextStep!.text,
      done: false,
      sourceKey: "project:sample-learning",
      sourceGenerationId: fixture.config.projects[0].nextStep!.generationId,
      projectId: "sample-learning",
    },
    {
      text: "週末に試すアイデア",
      done: false,
      sourceKey: "wishlist:sample-weekend",
      projectId: "sample-learning",
    },
  ];
  await prepare(page, fixture);

  const row = page.locator('[data-inbox-id="sample-weekend"]');
  await row.hover();
  await expect(row.locator(".sourceLockBadge--wishlist")).toHaveCount(1);
  await expect(
    row.getByRole("button", { name: "週末に試すアイデアの次の一手を設定" }),
  ).toHaveCount(0);
  await row.click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "次の一手にする" })).toBeDisabled();
});
