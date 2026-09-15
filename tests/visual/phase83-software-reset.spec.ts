import { expect, test, type Page } from "@playwright/test";
import { createPublicFixture, FIXTURE_NOW } from "./fixtures";
import { installTauriMock } from "./tauriMock";

type InvokeCall = { command: string; args: Record<string, unknown> };
type ResetBackendOptions = {
  backupFailure?: string;
  resetFailure?: string;
  restartRequested?: boolean;
};

type VisualQaControl = {
  invokeCalls: InvokeCall[];
  emit: (event: string, payload?: unknown) => void;
};

const RESET_TIMER_MESSAGE = "実行中のタイマーを終了してからリセットしてください。";

async function prepare(page: Page, softwareResetRecovery: unknown = null) {
  await page.clock.install({ time: new Date(FIXTURE_NOW).getTime() });
  await page.setViewportSize({ width: 1100, height: 900 });
  await installTauriMock(page, createPublicFixture(), "main", softwareResetRecovery);
  await page.goto("/");
  await expect(page.locator("main, [role=main]").first()).toBeVisible();
}

async function installResetBackend(page: Page, options: ResetBackendOptions = {}) {
  await page.evaluate((resetOptions) => {
    const target = window as Window & {
      __TAURI_INTERNALS__: {
        invoke: (command: string, args?: Record<string, unknown>) => Promise<unknown>;
      };
      __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl;
    };
    const originalInvoke = target.__TAURI_INTERNALS__.invoke.bind(target.__TAURI_INTERNALS__);
    target.__TAURI_INTERNALS__.invoke = async (command, args = {}) => {
      if (command === "create_software_reset_backup") {
        target.__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.push({ command, args });
        if (resetOptions.backupFailure) throw new Error(resetOptions.backupFailure);
        return { path: "C:\\PublicDemo\\backups\\lifelauncher-backup-reset.zip" };
      }
      if (command === "software_reset") {
        target.__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.push({ command, args });
        if (resetOptions.resetFailure) throw new Error(resetOptions.resetFailure);
        return { restartRequested: resetOptions.restartRequested ?? true };
      }
      return originalInvoke(command, args);
    };
  }, options);
}

async function openResetChoice(page: Page) {
  const settings = page.getByRole("dialog", { name: "設定" });
  if (!(await settings.isVisible())) {
    await page.getByRole("button", { name: "設定を開く" }).click();
  }
  await settings.getByRole("tab", { name: "メンテナンス" }).click();
  await settings.getByRole("button", { name: "ソフトウェアリセット..." }).click();
  const choice = page.getByRole("dialog", { name: "リセット前にバックアップしますか？" });
  await expect(choice).toBeVisible();
  return choice;
}

async function commandCalls(page: Page, command: string) {
  return page.evaluate(
    (targetCommand) =>
      (
        window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
      ).__LIFE_LAUNCHER_VISUAL_QA__.invokeCalls.filter(
        (call) => call.command === targetCommand,
      ),
    command,
  );
}

test("P83-02 backup choice cancel and final Escape perform no reset", async ({ page }) => {
  await prepare(page);
  await installResetBackend(page);

  let choice = await openResetChoice(page);
  await choice.getByRole("button", { name: "キャンセル", exact: true }).click();
  await expect(choice).toHaveCount(0);
  await expect(
    page
      .getByRole("dialog", { name: "設定" })
      .getByRole("button", { name: "ソフトウェアリセット..." }),
  ).toBeFocused();
  expect(await commandCalls(page, "create_software_reset_backup")).toHaveLength(0);
  expect(await commandCalls(page, "software_reset")).toHaveLength(0);

  choice = await openResetChoice(page);
  await choice.getByRole("button", { name: "バックアップせず続行" }).click();
  const final = page.getByRole("dialog", { name: "ソフトウェアリセットを実行しますか？" });
  const cancel = final.getByRole("button", { name: "キャンセル", exact: true });
  await expect(cancel).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(final).toHaveCount(0);
  await expect(
    page
      .getByRole("dialog", { name: "設定" })
      .getByRole("button", { name: "ソフトウェアリセット..." }),
  ).toBeFocused();
  expect(await commandCalls(page, "software_reset")).toHaveLength(0);
});

test("P83-02 interrupted reset recovery restores audited localStorage on startup", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("life-launcher.sidebar-groups", "stale");
    localStorage.setItem("another-product.preference", "keep-me");
  });
  await prepare(page, {
    message: "中断されたソフトウェアリセットを復元しました。",
    localStorageSnapshot: {
      "life-launcher.sidebar-groups": '{"Quick":true}',
      "life-launcher-today-builder-order": '["project:p1"]',
    },
  });

  await expect(page.locator(".toast").last()).toContainText(
    "中断されたソフトウェアリセットを復元しました。",
  );
  expect(
    await page.evaluate(() => ({
      groups: localStorage.getItem("life-launcher.sidebar-groups"),
      builder: localStorage.getItem("life-launcher-today-builder-order"),
      unrelated: localStorage.getItem("another-product.preference"),
    })),
  ).toEqual({
    groups: '{"Quick":true}',
    builder: '["project:p1"]',
    unrelated: "keep-me",
  });
  expect(await commandCalls(page, "load_software_reset_recovery")).toHaveLength(1);
  expect(await commandCalls(page, "acknowledge_software_reset_recovery")).toHaveLength(1);
});

test("P83-02 failed startup storage recovery remains unacknowledged", async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key: string, value: string) {
      if (key === "life-launcher.sidebar-groups" && value.includes("Recovered")) {
        throw new DOMException("Synthetic storage recovery failure", "QuotaExceededError");
      }
      return original.call(this, key, value);
    };
  });
  await prepare(page, {
    message: "中断されたソフトウェアリセットを復元しました。",
    localStorageSnapshot: {
      "life-launcher.sidebar-groups": '{"Recovered":true}',
    },
  });

  await expect(page.locator(".toast").last()).toContainText(
    "ソフトウェアリセットの復旧を完了できません: Synthetic storage recovery failure",
  );
  expect(await commandCalls(page, "acknowledge_software_reset_recovery")).toHaveLength(0);
});

test("P83-02 backup success reaches reset and preserves unrelated browser storage", async ({
  page,
}) => {
  await prepare(page);
  await installResetBackend(page);
  await page.evaluate(() => {
    localStorage.setItem("life-launcher.sidebar-groups", '{"Quick":true}');
    localStorage.setItem("life-launcher-instruction-last-opened-path", "C:\\Guide.html");
    localStorage.setItem("another-product.preference", "keep-me");
  });

  const choice = await openResetChoice(page);
  await choice.getByRole("button", { name: "バックアップして続行" }).click();
  const final = page.getByRole("dialog", { name: "ソフトウェアリセットを実行しますか？" });
  await final.getByRole("button", { name: "ソフトウェアリセット", exact: true }).click();

  expect(await commandCalls(page, "create_software_reset_backup")).toHaveLength(1);
  expect(await commandCalls(page, "prepare_software_reset")).toHaveLength(1);
  const resetCalls = await commandCalls(page, "software_reset");
  expect(resetCalls).toHaveLength(1);
  expect(resetCalls[0]?.args).toMatchObject({
    input: {
      localStorageCleared: true,
      localStorageSnapshot: {
        "life-launcher.sidebar-groups": '{"Quick":true}',
        "life-launcher-instruction-last-opened-path": "C:\\Guide.html",
      },
    },
  });
  expect(
    await page.evaluate(() => ({
      app: localStorage.getItem("life-launcher.sidebar-groups"),
      instruction: localStorage.getItem("life-launcher-instruction-last-opened-path"),
      unrelated: localStorage.getItem("another-product.preference"),
    })),
  ).toEqual({ app: null, instruction: null, unrelated: "keep-me" });
  await expect(page.getByRole("dialog", { name: "Life Launcherを再起動しています" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Life Launcherを再起動しています" })).toBeFocused();
});

test("P83-02 no-backup reset success skips backup and requests restart", async ({ page }) => {
  await prepare(page);
  await installResetBackend(page);

  const choice = await openResetChoice(page);
  await choice.getByRole("button", { name: "バックアップせず続行" }).click();
  await page
    .getByRole("dialog", { name: "ソフトウェアリセットを実行しますか？" })
    .getByRole("button", { name: "ソフトウェアリセット", exact: true })
    .click();

  expect(await commandCalls(page, "create_software_reset_backup")).toHaveLength(0);
  expect(await commandCalls(page, "prepare_software_reset")).toHaveLength(1);
  expect(await commandCalls(page, "software_reset")).toHaveLength(1);
  await expect(page.getByRole("dialog", { name: "Life Launcherを再起動しています" })).toBeVisible();
});

test("P83-02 duplicate final dispatch invokes prepare and reset only once", async ({ page }) => {
  await prepare(page);
  await installResetBackend(page);

  const choice = await openResetChoice(page);
  await choice.getByRole("button", { name: "バックアップせず続行" }).click();
  const reset = page
    .getByRole("dialog", { name: "ソフトウェアリセットを実行しますか？" })
    .getByRole("button", { name: "ソフトウェアリセット", exact: true });
  await reset.evaluate((button) => {
    button.click();
    button.click();
  });

  expect(await commandCalls(page, "prepare_software_reset")).toHaveLength(1);
  expect(await commandCalls(page, "software_reset")).toHaveLength(1);
});

test("P83-02 backup failure aborts before final confirmation", async ({ page }) => {
  await prepare(page);
  await installResetBackend(page, { backupFailure: "Synthetic fresh backup failure" });

  const choice = await openResetChoice(page);
  await choice.getByRole("button", { name: "バックアップして続行" }).click();
  await expect(page.getByRole("dialog", { name: "リセット前にバックアップしますか？" })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "ソフトウェアリセットを実行しますか？" })).toHaveCount(0);
  await expect(page.locator(".toast").last()).toContainText(
    "リセット前のバックアップに失敗しました: Synthetic fresh backup failure",
  );
  expect(await commandCalls(page, "software_reset")).toHaveLength(0);
});

test("P83-02 no-backup reset failure restores audited localStorage", async ({ page }) => {
  await prepare(page);
  await installResetBackend(page, { resetFailure: "Synthetic transaction rollback" });
  await page.evaluate(() => {
    localStorage.setItem("life-launcher-today-builder-order", '["project:p1"]');
    localStorage.setItem("another-product.preference", "untouched");
  });

  const choice = await openResetChoice(page);
  await choice.getByRole("button", { name: "バックアップせず続行" }).click();
  const final = page.getByRole("dialog", { name: "ソフトウェアリセットを実行しますか？" });
  await final.getByRole("button", { name: "ソフトウェアリセット", exact: true }).click();

  expect(await commandCalls(page, "create_software_reset_backup")).toHaveLength(0);
  expect(await commandCalls(page, "software_reset")).toHaveLength(1);
  await expect(page.locator(".toast").last()).toContainText(
    "ソフトウェアリセットに失敗しました: Synthetic transaction rollback",
  );
  await expect(final).toBeVisible();
  expect(
    await page.evaluate(() => ({
      app: localStorage.getItem("life-launcher-today-builder-order"),
      unrelated: localStorage.getItem("another-product.preference"),
    })),
  ).toEqual({ app: '["project:p1"]', unrelated: "untouched" });
});

test("P83-02 partial localStorage clear failure restores values and skips reset", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.removeItem;
    let failed = false;
    Storage.prototype.removeItem = function (key: string) {
      if (!failed && key === "life-launcher-today-builder-order") {
        failed = true;
        throw new DOMException("Synthetic storage clear failure", "QuotaExceededError");
      }
      return original.call(this, key);
    };
  });
  await prepare(page);
  await installResetBackend(page);
  await page.evaluate(() => {
    localStorage.setItem("life-launcher.sidebar-groups", '{"Quick":true}');
    localStorage.setItem("life-launcher-today-builder-order", '["project:p1"]');
  });

  const choice = await openResetChoice(page);
  await choice.getByRole("button", { name: "バックアップせず続行" }).click();
  await page
    .getByRole("dialog", { name: "ソフトウェアリセットを実行しますか？" })
    .getByRole("button", { name: "ソフトウェアリセット", exact: true })
    .click();

  await expect(page.locator(".toast").last()).toContainText("Synthetic storage clear failure");
  expect(await commandCalls(page, "prepare_software_reset")).toHaveLength(1);
  expect(await commandCalls(page, "software_reset")).toHaveLength(0);
  expect(
    await page.evaluate(() => ({
      groups: localStorage.getItem("life-launcher.sidebar-groups"),
      builder: localStorage.getItem("life-launcher-today-builder-order"),
    })),
  ).toEqual({ groups: '{"Quick":true}', builder: '["project:p1"]' });
});

for (const paused of [false, true]) {
  test(`P83-02 ${paused ? "paused" : "running"} Timer rejects reset before invoke`, async ({
    page,
  }) => {
    await prepare(page);
    await installResetBackend(page);
    const card = page.locator(".todayRow").first();
    await card.getByRole("button", { name: "通常タイマー25分で開始" }).click();
    if (paused) {
      await card.getByRole("button", { name: "このセッションを一時停止" }).click();
    }

    await page.getByRole("button", { name: "設定を開く" }).click();
    const settings = page.getByRole("dialog", { name: "設定" });
    await settings.getByRole("tab", { name: "メンテナンス" }).click();
    await settings.getByRole("button", { name: "ソフトウェアリセット..." }).click();

    await expect(page.locator(".toast").last()).toContainText(RESET_TIMER_MESSAGE);
    await expect(
      page.getByRole("dialog", { name: "リセット前にバックアップしますか？" }),
    ).toHaveCount(0);
    expect(await commandCalls(page, "create_software_reset_backup")).toHaveLength(0);
    expect(await commandCalls(page, "software_reset")).toHaveLength(0);
    expect(await commandCalls(page, "record_session")).toHaveLength(0);
  });
}

test("P83-02 reset freeze ignores watcher reloads while restart is pending", async ({ page }) => {
  await prepare(page);
  await installResetBackend(page);
  const choice = await openResetChoice(page);
  await choice.getByRole("button", { name: "バックアップせず続行" }).click();
  await page
    .getByRole("dialog", { name: "ソフトウェアリセットを実行しますか？" })
    .getByRole("button", { name: "ソフトウェアリセット", exact: true })
    .click();
  const before = (await commandCalls(page, "load_config")).length;
  await page.evaluate(() =>
    (
      window as Window & { __LIFE_LAUNCHER_VISUAL_QA__: VisualQaControl }
    ).__LIFE_LAUNCHER_VISUAL_QA__.emit("config-changed"),
  );
  await page.clock.runFor(500);
  expect((await commandCalls(page, "load_config")).length).toBe(before);
});
