import { expect, test } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type QaWindow = Window & {
  __LIFE_LAUNCHER_VISUAL_QA__: {
    invokeCalls: Array<{ command: string; args: Record<string, unknown> }>;
    setExecuteMode: (mode: "success" | "failure" | "delayed") => void;
  };
};

test("P10-17 N5 opens GitHub Releases via execute_actions, shows hover color, and reports failure", async ({
  page,
}) => {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1080, height: 680 });
  await installTauriMock(page, createPublicFixture(), "main");
  await page.goto("/");

  await page.getByRole("button", { name: "設定を開く" }).click();
  await page.getByRole("tab", { name: "メンテナンス" }).click();

  const link = page.locator(".settingsVersion .settingsReleaseLink");
  await expect(link).toBeVisible();
  await expect(link).toHaveText("リリースページを開く");
  await expect(link).toHaveAttribute(
    "title",
    "https://github.com/Takuyakou/life-launcher/releases",
  );

  await link.hover();
  await expect(link).toHaveCSS("color", "rgb(255, 206, 91)");

  await link.click();
  const executeCalls = await page.evaluate(() =>
    (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
      (call) => call.command === "execute_actions",
    ),
  );
  expect(executeCalls).toHaveLength(1);
  expect(executeCalls[0].args).toEqual({
    actions: [
      {
        type: "open_url",
        payload: { url: "https://github.com/Takuyakou/life-launcher/releases" },
      },
    ],
  });

  await page.evaluate(() => {
    (window as unknown as QaWindow).__LIFE_LAUNCHER_VISUAL_QA__.setExecuteMode("failure");
  });
  await link.click();
  await expect(page.locator(".toast--error")).toContainText("リリースページを開けませんでした");
});
