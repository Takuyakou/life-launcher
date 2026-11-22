import { buildImportCurrentState } from "../importCurrentState";
import { IMPORT_JSON_FORMAT } from "./importPrompt";
import type { AppConfig, WeeklyReviewResponse } from "../types";
import {
  buildWeeklyFacts,
  formatWeekRange,
  type WeeklyStaleFact,
} from "../weeklyPlanning";

export const WEEKLY_PROMPT = `あなたは、私の人生・目標・やりたいことを前に進めるための行動設計パートナーです。
私は「Life Launcher」という Windows アプリで、「今5分以上のまとまった時間ができたときに、迷わず着手できる具体的な行動」を管理・実行しています。

今は週の始めで、今週やることを決めています。

あなたの役割:
下にある「今のアプリの内容」と「先週の事実」、これまでの私との会話履歴やメモリにある最近の文脈をもとに、「今週の私が、5分以上時間が使えるときに何を実行すると、目標ややりたいことが前に進むか」を考え、足すとよいものだけを下の JSON 形式で提案してください。評価や点数は付けないでください。

今週の見直しの厳守ルール:
1. 「今のアプリの内容」にすでにある項目、またはその言い換え・焼き直しは出さないこと
2. 今あるプロジェクトに足すときは、"name" を「今のアプリの内容」と一字一句同じにすること
3. すでに「次の一手」があるプロジェクトには "nextStep" を書かず、足したい行動は "wishes" に入れること
4. 「次の一手」が空のプロジェクトには、今すぐ着手できる具体的な "nextStep" を1つ提案すること
5. 今週の重点のプロジェクトを先に考えること。しばらく動いていないプロジェクトには、5分で心理的ハードルを越えて着手できる最小の一歩を "wishes" に1つ入れること
6. 増えすぎて管理できなくなるのを防ぐため、新規プロジェクトは最大2個、追加する行動は全体で5〜8個程度に絞ること
7. フワっとした抽象的な行動や一般論は禁止。会話履歴やメモリにある具体的なツール名・対象・目標数値・今の課題を織り込み、「開く・書く・話す・測る・1つ作る」のように開始動作と完了条件が見える「〜する」で終わる文にすること
   - 悪い例: 「本を読む」「部屋を片付ける」「勉強する」
   - 良い例: 「読みかけの本を開いて次の見出しまで10分読む」「机の上の紙類だけを全部取り出して要・不要の2山に分ける」「問題集の間違えた箇所を3問だけ解き直す」
8. "minutes" は15〜30分（標準）、"shortMinutes" は5〜10分（最低5分で着手できる最小サイズ）で設定すること
9. 会話履歴・メモリ・今のアプリの内容・先週の事実から組み立てられる場合は質問せず、そのまま JSON を出力すること。手がかりが全くない場合のみ、先に質問を3つまでして回答を受けてから JSON を作ること

出力の決まり:
- JSON は必ず \`\`\`json のコードブロック1つだけで出力し、前後に説明文を付けない
- 先頭に "lifeLauncherImport": 1 を書く
- "goal" は新規プロジェクトで目指す状態（60文字以内）
- "trigger" は始めるきっかけ。自然なものがなければ省略する
- "color" は次から選ぶ: amber, blue, green, violet, rose, cyan, orange, slate, lime, magenta, sand, coral
- アプリ内のボタン・リンク・手順書パスは書かない

出力形式:
${IMPORT_JSON_FORMAT}

今のアプリの内容:
{CURRENT_STATE}

先週の事実({WEEK_RANGE}):
{WEEKLY_FACTS}`;

export function buildWeeklyPrompt(
  config: AppConfig,
  weeklyReview: WeeklyReviewResponse | null,
  stale: WeeklyStaleFact[],
): string {
  return WEEKLY_PROMPT.replace("{CURRENT_STATE}", buildImportCurrentState(config))
    .replace(
      "{WEEK_RANGE}",
      weeklyReview
        ? formatWeekRange(weeklyReview.previousWeekStart, weeklyReview.previousWeekEnd)
        : "先週",
    )
    .replace("{WEEKLY_FACTS}", buildWeeklyFacts(config, weeklyReview, stale));
}
