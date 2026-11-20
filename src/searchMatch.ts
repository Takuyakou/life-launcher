/**
 * P10-03 (D4): how the search palette compares text.
 *
 * One rule everywhere: case, hiragana/katakana and full/half width are treated as the same,
 * and a match is a plain substring match.
 */

/** Half-width katakana -> full-width katakana (so ｱ matches ア). */
const HALF_WIDTH_KATAKANA = "ｦｧｨｩｪｫｬｭｮｯｰｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾄﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ";
const FULL_WIDTH_KATAKANA = "ヲァィゥェォャュョッーアイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワン";

const KATAKANA_TO_HIRAGANA_START = 0x30a1;
const KATAKANA_TO_HIRAGANA_END = 0x30f6;
const HIRAGANA_OFFSET = 0x30a1 - 0x3041;

function toHiragana(text: string): string {
  let result = "";
  for (const char of text) {
    const code = char.codePointAt(0) ?? 0;
    result +=
      code >= KATAKANA_TO_HIRAGANA_START && code <= KATAKANA_TO_HIRAGANA_END
        ? String.fromCodePoint(code - HIRAGANA_OFFSET)
        : char;
  }
  return result;
}

function halfWidthToFullWidth(text: string): string {
  let result = "";
  for (const char of text) {
    const index = HALF_WIDTH_KATAKANA.indexOf(char);
    if (index >= 0) {
      result += FULL_WIDTH_KATAKANA[index];
      continue;
    }
    if (char === "\uFF9E") {
      // Half-width (semi-voiced) mark: turn the previous kana into its voiced form.
      result = `${result.slice(0, -1)}${voiceFullWidth(Array.from(result).pop() ?? "")}`;
      continue;
    }
    if (char === "\uFF9F") {
      result = `${result.slice(0, -1)}${semiVoiceFullWidth(Array.from(result).pop() ?? "")}`;
      continue;
    }
    result += char;
  }
  return result;
}

const VOICED: Record<string, string> = {
  カ: "ガ", キ: "ギ", ク: "グ", ケ: "ゲ", コ: "ゴ", サ: "ザ", シ: "ジ", ス: "ズ", セ: "ゼ",
  ソ: "ゾ", タ: "ダ", チ: "ヂ", ツ: "ヅ", テ: "デ", ト: "ド", ハ: "バ", ヒ: "ビ", フ: "ブ",
  ヘ: "ベ", ホ: "ボ", ウ: "ヴ",
};

const SEMI_VOICED: Record<string, string> = { ハ: "パ", ヒ: "ピ", フ: "プ", ヘ: "ペ", ホ: "ポ" };

function voiceFullWidth(char: string): string {
  return VOICED[char] ?? char;
}

function semiVoiceFullWidth(char: string): string {
  return SEMI_VOICED[char] ?? char;
}

/** The comparison key: width, kana kind and case are all flattened away. */
export function normalizeForSearch(text: string): string {
  return toHiragana(halfWidthToFullWidth(text.normalize("NFKC")).toLocaleLowerCase());
}

/** True when `query` appears in `text` under the rule above. An empty query matches nothing. */
export function matchesSearchQuery(text: string, query: string): boolean {
  const needle = normalizeForSearch(query.trim());
  if (!needle) return false;
  return normalizeForSearch(text).includes(needle);
}

/** True when the text contains the query as typed and as its mirrored kana form. */
export function textMatchesQuery(text: string, query: string): boolean {
  if (matchesSearchQuery(text, query)) return true;
  return matchesSearchQuery(toHiragana(text), toHiragana(query));
}

/** How many results one group may show before it is cut off. */
export const SEARCH_GROUP_LIMIT = 5;
