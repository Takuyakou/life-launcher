import { describe, expect, test } from "vitest";
import { extractImportJson, IMPORT_MAX_BYTES } from "../../src/importJson";

// V165 PR 2: the paste reader is pure, so its boundaries belong in the unit layer. Every case is
// a state the import dialog can really meet: prose around the answer, Markdown damage from a
// copy, two answers at once, and a paste that is too large.
const answer = '{"lifeLauncherImport": 1, "projects": []}';

describe("extractImportJson", () => {
  test("finds the single import object inside a prose answer", () => {
    const text = `こちらです。\n\`\`\`json\n${answer}\n\`\`\`\nよろしくお願いします。`;
    expect(extractImportJson(text)).toEqual({ ok: true, json: answer });
  });

  test("ignores braces inside JSON strings", () => {
    const text = '{"lifeLauncherImport": 1, "note": "brace } and { inside"}';
    expect(extractImportJson(text)).toEqual({ ok: true, json: text });
  });

  test("refuses two import answers at once", () => {
    const result = extractImportJson(`${answer}\n${answer}`);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("2つ以上");
  });

  test("refuses an object that is not an import answer", () => {
    const result = extractImportJson('{"hello": "world"}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("見つかりません");
  });

  test("reports broken JSON instead of guessing", () => {
    const result = extractImportJson('{"lifeLauncherImport": 1, "projects": [}');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("JSONを読めません");
  });

  test("stops above the paste limit", () => {
    const result = extractImportJson("a".repeat(IMPORT_MAX_BYTES + 1));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("256 KB");
  });

  test("undoes the escaped braces a Markdown copy adds outside strings", () => {
    const damaged = '\\{\n  "lifeLauncherImport": 1,\n  "projects": []\n\\}';
    expect(extractImportJson(damaged)).toEqual({
      ok: true,
      json: '{\n  "lifeLauncherImport": 1,\n  "projects": []\n}',
    });
  });

  test("turns the space entities of a copied answer back into spaces", () => {
    expect(extractImportJson('{"lifeLauncherImport":&nbsp;1}')).toEqual({
      ok: true,
      json: '{"lifeLauncherImport": 1}',
    });
  });
});
