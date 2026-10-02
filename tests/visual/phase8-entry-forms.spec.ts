import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

async function prepare(page: Page, width = 1440) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");
  await expect(page.locator(".doNowBand")).toBeVisible();
}

async function expectBarEdgeClick(
  page: Page,
  headerSelector: string,
  buttonName: string,
  dialogName: string,
) {
  const header = page.locator(headerSelector);
  const button = page.getByRole("button", { name: buttonName, exact: true });
  for (const edge of ["top", "bottom"] as const) {
    await button.scrollIntoViewIfNeeded();
    const headerBox = await header.boundingBox();
    const buttonBox = await button.boundingBox();
    if (!headerBox || !buttonBox) throw new Error("Header add action is not measurable");
    await page.mouse.click(
      buttonBox.x + buttonBox.width / 2,
      edge === "top" ? headerBox.y + 2 : headerBox.y + headerBox.height - 2,
    );
    const dialog = page.getByRole("dialog", { name: dialogName });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: "キャンセル", exact: true }).click();
  }
}

test("P8 instruction picker searches, applies and cancels a draft", async ({ page }) => {
  await prepare(page);
  await page.locator(".todayRow").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集", exact: true }).click();
  const editor = page.getByRole("dialog", { name: "次の一手を編集" });
  await editor.getByRole("button", { name: "手順書を選ぶ" }).click();
  let picker = page.getByRole("dialog", { name: "手順書を選ぶ" });
  await expect(picker.getByRole("searchbox", { name: "手順書を検索" })).toBeFocused();
  await picker.getByRole("searchbox", { name: "手順書を検索" }).fill("guide");
  await expect(picker.getByRole("option", { name: /guide\.md/ })).toBeVisible();
  await picker.getByRole("option", { name: "手順書なし" }).click();
  const instructionCancel = picker.getByRole("button", { name: "キャンセル" });
  await instructionCancel.click();
  await expect(editor.locator(".instructionPickerSelection")).toContainText("guide.md");
  await editor.getByRole("button", { name: "手順書を選ぶ" }).click();
  picker = page.getByRole("dialog", { name: "手順書を選ぶ" });
  await picker.getByRole("option", { name: "手順書なし" }).click();
  await picker.getByRole("button", { name: "選択", exact: true }).click();
  await expect(editor.locator(".instructionPickerSelection")).toContainText("選択されていません");
  await expect(editor.getByRole("checkbox", { name: "開始時に手順書を開く" })).toBeDisabled();

});

test("P8 add actions are independent and available from source bars", async ({ page }) => {
  await prepare(page);
  const projectDisclosure = page.locator(".projectsBand .disclosure");
  const projectAdd = page.getByRole("button", { name: "プロジェクトを追加", exact: true });
  await expect(projectDisclosure).toHaveAttribute("aria-expanded", "true");
  await expectBarEdgeClick(
    page,
    ".projectsBand .disclosureHeader",
    "プロジェクトを追加",
    "プロジェクトを追加",
  );
  await expect(projectDisclosure).toHaveAttribute("aria-expanded", "true");
  await projectAdd.click();
  await expect(projectDisclosure).toHaveAttribute("aria-expanded", "true");
  await page
    .getByRole("dialog", { name: "プロジェクトを追加" })
    .getByRole("button", { name: "キャンセル" })
    .click();
  await page.locator(".projectsBand .disclosureHeader").click({ button: "right" });
  await page.getByRole("menuitem", { name: "プロジェクトを追加" }).click();
  await expect(page.getByRole("dialog", { name: "プロジェクトを追加" })).toBeVisible();
  await page.keyboard.press("Escape");
  await page.locator(".nextStepProjectRegion").first().click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "やりたいことを追加" })).toHaveCount(0);
  await page.keyboard.press("Escape");
  await page.locator(".todayRow").first().click({ button: "right" });
  await page.getByRole("menuitem", { name: "編集", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "次の一手を編集" })).toBeVisible();
  await page.keyboard.press("Escape");

  const wishlistDisclosure = page.locator(".inboxBand .disclosure");
  if ((await wishlistDisclosure.getAttribute("aria-expanded")) === "false") {
    await wishlistDisclosure.click();
  }
  await expect(wishlistDisclosure).toHaveAttribute("aria-expanded", "true");
  await expectBarEdgeClick(
    page,
    ".inboxBand .disclosureHeader",
    "やりたいことを追加",
    "やりたいことを追加",
  );
  await expect(wishlistDisclosure).toHaveAttribute("aria-expanded", "true");
  await page.locator("[data-inbox-header]").click({ button: "right" });
  await page.getByRole("menuitem", { name: "やりたいことを追加" }).click();
  await expect(page.getByRole("dialog", { name: "やりたいことを追加" })).toBeVisible();
  await page.keyboard.press("Escape");
  if ((await wishlistDisclosure.getAttribute("aria-expanded")) === "false")
    await wishlistDisclosure.click();
  await expect(page.locator(".inboxBody")).toBeVisible();
  await page.locator(".inboxRow").first().click({ button: "right" });
  await expect(page.getByRole("menuitem", { name: "やりたいことを追加" })).toHaveCount(0);
});
