import { expect, test } from "@playwright/test";
import { AppConfigSchema } from "../../src/types";
import { createPublicFixture } from "./fixtures";

test("legacy configuration loads defaults without changing saved choices", () => {
  const config = createPublicFixture().config;
  config.settings.focusHotkey = null;
  config.buttons[0].showInSidebar = false;
  config.projects[0].nextStep!.updatedAt = "2026-08-13T09:30:00+09:00";
  const legacy = { ...config, groups: undefined, sourceCompletions: undefined };
  const today = { ...config.today, victory: undefined, selectionMutationTokens: undefined };
  const settings = {
    ...config.settings,
    shortTimerMinutes: undefined,
    instructionFolders: undefined,
  };
  const parsed = AppConfigSchema.parse({ ...legacy, today, settings });
  expect(parsed).toEqual({
    ...config,
    groups: [],
    sourceCompletions: [],
    today: { ...today, victory: { text: "", done: false }, selectionMutationTokens: {} },
    settings: { ...settings, shortTimerMinutes: 5, instructionFolders: [] },
  });
  expect(AppConfigSchema.parse(JSON.parse(JSON.stringify(parsed)))).toEqual(parsed);
});

test("configuration rejects conflicting steps and duplicate instruction roots", () => {
  const config = createPublicFixture().config;
  config.projects[0].legacyNextStepSettings = { buttonIds: [] };
  config.settings.instructionFolders = [
    "C:\\PublicDemo\\Instructions",
    "c:/publicdemo/instructions/",
  ];
  const result = AppConfigSchema.safeParse(config);
  expect(result.success).toBe(false);
  if (result.success) throw new Error("invalid configuration was accepted");
  expect(result.error.issues).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ path: ["projects", 0] }),
      expect.objectContaining({ path: ["settings", "instructionFolders", 1] }),
    ]),
  );
});
