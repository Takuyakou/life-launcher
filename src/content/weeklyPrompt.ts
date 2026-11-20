import { buildImportCurrentState } from "../importCurrentState";
import { IMPORT_JSON_FORMAT } from "./importPrompt";
import type { AppConfig, WeeklyReviewResponse } from "../types";
import {
  buildWeeklyFacts,
  formatWeekRange,
  type WeeklyStaleFact,
} from "../weeklyPlanning";

export const WEEKLY_PROMPT = `あなたは、私が「今これをやる」を決めて始めるのを手伝うアシスタントです。
私は Life Launcher という Windows アプリで、次の3つを管理しています。

- プロジェクト: 続けたいテーマ
- 次の一手: プロジェクトごとに1つだけ。迷ったときにすぐ始められる、具体的な行動。15〜30分で始められる大きさ
- やりたいこと: 次の一手のほかにやりたいことの候補

今は週の始めで、今週やることを決めています。下に、今のアプリの内容と、先週の事実を付けます。これと「今週の予定・気になっていること」、あなたが覚えている私のこと(これまでの会話やメモリーがあれば)をもとに、今週の私に足すとよいものを考えて JSON にしてください。評価や点数は付けないでください。

決まり:
- 今の内容にあるものは、もう一度書かない
- 今あるプロジェクトに足すときは、"name" を今の名前と一字一句同じにする
- すでに次の一手があるプロジェクトには "nextStep" を書かない。足したい行動は "wishes" に入れる
- 次の一手がないプロジェクトには、次の一手を1つ考える
- 今週の重点のプロジェクトを先に考える
- しばらく動いていないプロジェクトには、もっと小さく始められる行動を "wishes" に1つ入れる
- 足すのは少しずつ。新しいプロジェクトは3個まで、やりたいことは全部で10個まで
- 次の一手は「〜する」で終わる、ひと目で分かる行動にする
- 情報が足りないときは、先に質問を3つまでしてから JSON を作る

出力の決まり:
- 最後の答えは JSON だけにする。説明の文は付けない
- 一番上に "lifeLauncherImport": 1 を書く
- "trigger" は、いつ・どこで始めるか。分からなければ書かない
- "color" は次から選ぶ: amber, blue, green, violet, rose, cyan, orange, slate, lime, magenta, sand, coral
- アプリのボタン・リンク・手順書は書かない

形式:
${IMPORT_JSON_FORMAT}

今のアプリの内容:
{CURRENT_STATE}

先週の事実({WEEK_RANGE}):
{WEEKLY_FACTS}

今週の予定・気になっていること:
(今週の予定、使える時間、気になっていることを自由に書く。空でもかまいません)`;

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
