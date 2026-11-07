export const IMPORT_PROMPT = `あなたは、私のやることを整理する手伝いをします。
下の「私の状況」を読んで、Life Launcher に取り込める JSON を1つだけ作ってください。

決まり:
- 出力は JSON だけにする。説明の文は付けない
- 一番上に "lifeLauncherImport": 1 を書く
- プロジェクトは、続けたいテーマごとに1つ。多くても10個まで
- 各プロジェクトの "nextStep" は、次にやる具体的な行動を1つだけ。15〜30分で始められる大きさにする
- "trigger" は、いつ・どこで始めるか(例: 夕食のあと)。分からなければ書かない
- "wishes" は、次の一手のほかにやりたいこと。1つのプロジェクトに5個まで
- "color" は次から選ぶ: amber, blue, green, violet, rose, cyan, orange, slate, lime, magenta, sand, coral
- アプリのボタン・リンク・手順書は書かない(アプリで設定します)

形式:
{
  "lifeLauncherImport": 1,
  "projects": [
    {
      "name": "プロジェクトの名前",
      "color": "blue",
      "goal": "このプロジェクトで目指すこと(60文字まで)",
      "nextStep": { "text": "次にやる行動", "trigger": "いつ・どこで", "minutes": 25, "shortMinutes": 5 },
      "wishes": ["ほかにやりたいこと"]
    }
  ],
  "wishes": ["どのプロジェクトにも入らないやりたいこと"]
}

私の状況:
(ここに、今やりたいこと・続けたいことを自由に書く)`;
