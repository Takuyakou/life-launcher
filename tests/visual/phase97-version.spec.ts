import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

// P97-04: the version is shown in Maintenance and nowhere else. The value comes from
// package.json at build time, so a release bump needs no hand-edited copy.

const PACKAGE_VERSION = (
  JSON.parse(readFileSync(resolve("package.json"), "utf8")) as { version: string }
).version;

async function prepare(page: Page) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1440, height: 900 });
  await installTauriMock(page, createPublicFixture());
  await page.goto("/");
  await expect(page.locator("main, [role=main]").first()).toBeVisible();
}

async function openSettings(page: Page) {
  await page.getByRole("button", { name: "設定を開く" }).click();
  const settings = page.getByRole("dialog", { name: "設定" });
  await expect(settings).toBeVisible();
  return settings;
}

test("the Maintenance tab shows the package version at the bottom without controls", async ({
  page,
}) => {
  await prepare(page);
  const settings = await openSettings(page);
  await settings.getByRole("tab", { name: "メンテナンス" }).click();
  const maintenance = settings
    .locator(".settingsSection")
    .filter({ has: page.getByRole("heading", { name: "メンテナンス", exact: true }) });
  const version = maintenance.locator(".settingsVersion");
  await expect(version).toHaveText(`バージョン ${PACKAGE_VERSION}`);
  await expect(version.locator("button, a")).toHaveCount(0);
  await expect(version).toHaveCSS("font-size", "13px");
});

test("the version line stays out of the Basic settings screenshot", async ({ page }) => {
  await prepare(page);
  const settings = await openSettings(page);
  // phase9-visual.spec.ts takes the settings-basic screenshot on this tab.
  await settings.getByRole("tab", { name: "基本" }).click();
  await expect(settings.locator(".settingsVersion")).toBeHidden();
  await settings.getByRole("tab", { name: "メンテナンス" }).click();
  await expect(settings.locator(".settingsVersion")).toBeVisible();
});

test("the main screen does not show the version", async ({ page }) => {
  await prepare(page);
  await expect(page.getByText(/^バージョン /)).toHaveCount(0);
});
