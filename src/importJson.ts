export const IMPORT_MAX_BYTES = 256 * 1024;

export type ExtractImportJsonResult =
  | { ok: true; json: string }
  | { ok: false; error: string };

/**
 * Pull one JSON object that contains "lifeLauncherImport" out of a pasted answer.
 * The answer may have prose, code fences, or braces inside strings around it.
 */
export function extractImportJson(text: string): ExtractImportJsonResult {
  if (text.length > IMPORT_MAX_BYTES) {
    return { ok: false, error: "256 KBを超えています" };
  }
  const candidates: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (depth === 0) {
      // Quotes in the prose before the JSON must not open a string. Only braces that
      // start a candidate matter until we are inside one.
      if (character === "{") {
        start = index;
        depth = 1;
      }
      continue;
    }
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0 && start >= 0) {
        candidates.push(text.slice(start, index + 1));
        start = -1;
      }
    }
  }

  const matches: string[] = [];
  let parseError: string | undefined;
  for (const candidate of candidates) {
    try {
      const value: unknown = JSON.parse(candidate);
      if (
        value !== null &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        "lifeLauncherImport" in value
      ) {
        matches.push(candidate);
      }
    } catch (error) {
      parseError ??= error instanceof Error ? error.message : String(error);
    }
  }
  if (matches.length > 1) {
    return { ok: false, error: "取り込みのJSONが2つ以上あります。1つだけにしてください" };
  }
  if (matches.length === 0) {
    return {
      ok: false,
      error: parseError ? `JSONを読めません: ${parseError}` : "取り込みのJSONが見つかりません",
    };
  }
  return { ok: true, json: matches[0] };
}
