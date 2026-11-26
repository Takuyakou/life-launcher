import { describe, expect, test } from "vitest";
import { IMPORT_JSON_FORMAT, IMPORT_PROMPT_FIRST, IMPORT_PROMPT_REPEAT } from "../../src/content/importPrompt";
import { PROJECT_COLOR_IDS } from "../../src/projectIdentity";

// V165 PR 2: the prompt is what the user pastes into their assistant, so its contract is checked
// here instead of in a browser test: the body must be valid JSON, the colours it offers must be
// the ones the app accepts, and only the repeat prompt may carry the current-state placeholder.
describe("import prompt", () => {
  test("offers a JSON body that parses and carries the import marker", () => {
    const parsed = JSON.parse(IMPORT_JSON_FORMAT) as {
      lifeLauncherImport: number;
      projects: Array<{ wishes: string[] }>;
      wishes: string[];
    };
    expect(parsed.lifeLauncherImport).toBe(1);
    expect(Array.isArray(parsed.projects)).toBe(true);
    expect(Array.isArray(parsed.projects[0].wishes)).toBe(true);
    expect(Array.isArray(parsed.wishes)).toBe(true);
  });

  test("only offers project colours the app accepts", () => {
    for (const prompt of [IMPORT_PROMPT_FIRST, IMPORT_PROMPT_REPEAT]) {
      const line = prompt.split("\n").find((value) => value.includes('"color" は'));
      expect(line).toBeDefined();
      const offered = line!
        .split(":")
        .slice(1)
        .join(":")
        .split(",")
        .map((value) => value.trim())
        .filter((value) => /^[a-z]+$/.test(value));
      expect(offered.length).toBeGreaterThan(0);
      for (const color of offered) expect(PROJECT_COLOR_IDS as string[]).toContain(color);
    }
  });

  test("only the repeat prompt ends with the current-state placeholder", () => {
    expect(IMPORT_PROMPT_REPEAT.trimEnd().endsWith("{CURRENT_STATE}")).toBe(true);
    expect(IMPORT_PROMPT_FIRST.includes("{CURRENT_STATE}")).toBe(false);
  });
});
