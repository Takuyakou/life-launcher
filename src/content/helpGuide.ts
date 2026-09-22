export type HelpSectionId =
  | "getting-started"
  | "daily-basics"
  | "today-builder"
  | "today-three"
  | "timer-completion"
  | "start-environment"
  | "launcher-dictionary"
  | "records-review"
  | "settings-data"
  | "non-goals";

type HelpGuideDefinition = {
  term: string;
  description: string;
};

type HelpGuideExample = {
  title: string;
  bad: string;
  good: string;
  short?: string;
  note?: string;
};

export type HelpGuideBlock =
  | { type: "paragraph"; text: string }
  | { type: "steps"; items: string[] }
  | { type: "bullets"; items: string[] }
  | { type: "definitions"; items: HelpGuideDefinition[] }
  | { type: "note"; tone: "normal" | "warning"; text: string }
  | {
      type: "code";
      id: string;
      label: string;
      content: string;
      copyable?: boolean;
    }
  | { type: "examples"; items: HelpGuideExample[] };

export type HelpGuideSection = {
  id: HelpSectionId;
  title: string;
  summary: string;
  blocks: HelpGuideBlock[];
};

export const HELP_GUIDE_LEAD =
  "Life Launcherは、たくさん管理するためではなく、今やることを決めて始めるためのアプリです。まずは3分で、1つ動かしてみましょう。";

export const HELP_GUIDE_SECTIONS: HelpGuideSection[] = [
  {
    id: "getting-started",
    title: "3分で使ってみる",
    summary: "プロジェクトを1つ作り、5分だけ始めるところまで進みます。",
    blocks: [
      {
        type: "steps",
        items: [
          "「＋ プロジェクト」から、続けたいテーマを1つ作ります。最初は「英語」「作曲」「運動」のような短い名前で十分です。",
          "作ったプロジェクトの「次の一手を設定」を押し、次にする具体的な行動を1つ書きます。例: 英単語を10個読む。",
          "「＋ 今日やるものを選ぶ」を開き、その次の一手を「＋ 今日へ」で今日の3件に入れます。",
          "今日の3件にある「5分」を押して始めます。必要なアプリや資料を設定していれば一緒に開きます。",
          "終わったらTimerを終了します。取り組んだ時間と内容が実行記録へ残ります。",
        ],
      },
      {
        type: "note",
        tone: "normal",
        text: "ここまでできれば準備完了です。迷った日は「今やる一手」に表示されたものを、そのまま5分で始めて構いません。",
      },
    ],
  },
  {
    id: "daily-basics",
    title: "最初に覚える5つ",
    summary: "プロジェクトから今日の行動までを、具体例でつなげます。",
    blocks: [
      {
        type: "definitions",
        items: [
          {
            term: "プロジェクト",
            description: "続けたいテーマです。例: 作曲。",
          },
          {
            term: "次の一手",
            description: "そのプロジェクトで迷ったときに戻る行動を1つだけ置きます。例: Aメロの続きを8小節作る。",
          },
          {
            term: "やりたいこと",
            description: "次の一手以外の候補置き場です。例: ベースを録る、音色を探す。",
          },
          {
            term: "今日の3件",
            description: "今日実際にやると決めたものです。次の一手・やりたいことから最大3件を選びます。",
          },
          {
            term: "今やる一手",
            description: "迷ったときに、今の状況から始めやすい「次にやること」を1つだけ提示します。",
          },
        ],
      },
      {
        type: "paragraph",
        text: "次の一手は唯一やってよい作業ではありません。ほかの候補はやりたいことへ置き、必要な日に今日の3件へ選べます。",
      },
    ],
  },
  {
    id: "today-builder",
    title: "今日やるものを選ぶ",
    summary: "次の一手・やりたいことから、今日取り組むものを選びます。",
    blocks: [
      {
        type: "steps",
        items: [
          "今日の3件にある「＋ 今日やるものを選ぶ」を開きます。",
          "上のタブで「次の一手」または「やりたいこと」を選びます。",
          "候補の「＋ 今日へ」を押します。3件目を選ぶと、その内容で自動的に決定します。",
          "2件以下で終えるときは「決定」を押します。キャンセルすると、Pickerを開く前の状態へ戻ります。",
        ],
      },
      {
        type: "note",
        tone: "normal",
        text: "今日の3件へ選んでも、元の次の一手・やりたいことは消えません。「今日から外す」も削除ではなく、今日の選択だけを解除します。",
      },
    ],
  },
  {
    id: "today-three",
    title: "今日の使い方",
    summary: "選ぶ、迷ったら提案を見る、Timerで始める、の順です。",
    blocks: [
      {
        type: "steps",
        items: [
          "必要なら「今日の勝利条件」に、その日どうなれば十分かを1つ書きます。",
          "今日の3件を選びます。決めきれないときは「今やる一手」の提案を使います。",
          "短時間・通常・計測のどれかで始めます。",
          "終了後は今日の実行を確認し、完了したものにはチェックを付けます。",
        ],
      },
      {
        type: "bullets",
        items: [
          "今日の3件はドラッグして並べ替えられます。カードを下の解除エリアへドラッグすると、今日の選択だけを外せます。",
          "Timer実行中または一時停止中の項目は、先にTimerを終了してから外します。",
          "今日の3件で使っている間は、元の次の一手・やりたいことを変更できない場合があります。完了するか今日から外すと再び変更できます。",
        ],
      },
    ],
  },
  {
    id: "timer-completion",
    title: "Timerと完了",
    summary: "始めやすさに合わせて、3つの開始方法を使い分けます。",
    blocks: [
      {
        type: "definitions",
        items: [
          {
            term: "短時間",
            description: "とにかく着手したいときの短いTimerです。既定は5分です。",
          },
          {
            term: "通常",
            description: "いつもの作業時間で進めるTimerです。",
          },
          {
            term: "計測",
            description: "終了時刻を決めず、0:00から取り組んだ時間を数えます。",
          },
        ],
      },
      {
        type: "bullets",
        items: [
          "同時に動かせるTimerは1本です。別のものを始めるときは、現在のTimerを終了して切り替えます。",
          "Timerは一時停止・再開できます。終了すると実行内容と時間が記録されます。1分未満の実行は記録しません。",
          "今日の項目を完了にするか迷うときは、「未完了のまま終了」を選べば記録だけを残せます。",
        ],
      },
    ],
  },
  {
    id: "start-environment",
    title: "開始環境と手順書ビューアー",
    summary: "作業に必要なアプリや資料を、始める操作へ結び付けます。",
    blocks: [
      {
        type: "bullets",
        items: [
          "次の一手・やりたいことの編集で「開始環境を選ぶ」を開くと、アプリ、フォルダ、ファイル、URLを最大2件まで選べます。",
          "Timer開始時に、選んだ開始環境を順番に開きます。毎回同じ準備をする作業に便利です。",
          "手順書ビューアーの「フォルダを読み込む」から、Markdown・Text・HTMLをまとめたローカルフォルダを登録できます。",
          "MarkdownとTextはビューアー内で編集できます。HTMLは表示専用です。",
          "次の一手に手順書を選び「開始時に開く」を有効にすると、Timerと同時にその手順書を表示します。",
        ],
      },
    ],
  },
  {
    id: "launcher-dictionary",
    title: "Quickと辞書",
    summary: "よく使うものはQuick、数が増えたら辞書から検索して開きます。",
    blocks: [
      {
        type: "definitions",
        items: [
          {
            term: "Quick",
            description: "毎日よく開く少数の項目を、Mainの左側へ置く場所です。",
          },
          {
            term: "辞書",
            description: "登録が増えたとき、名前・グループ・ページ・キーワードで探して開く場所です。",
          },
        ],
      },
      {
        type: "bullets",
        items: [
          "EXE、フォルダ、ファイル、ショートカット、URLをMainへドロップして登録できます。Quickと辞書の両方、または片方だけに表示できます。",
          "Mainの「辞書を開く」または既定のCtrl+Kで辞書を直接開けます。ショートカットは設定の「ショートカット」から変更できます。",
          "辞書の設定では、アイコンサイズを自動・小・中・大から選べます。普段は自動のままで構いません。",
          "辞書は検索してEnterで起動できます。起動できなかった場合は、辞書内にエラーを表示します。",
        ],
      },
    ],
  },
  {
    id: "records-review",
    title: "記録を見る",
    summary: "何を何分進めたかを、今日・今週・全履歴で確認します。",
    blocks: [
      {
        type: "definitions",
        items: [
          {
            term: "ふりかえり",
            description: "今日と今週の時間、活動日数、プロジェクトごとの実行内容を見ます。",
          },
          {
            term: "今週を決める",
            description: "先週の事実を見ながら、今週の重点や止まっている次の一手を見直します。",
          },
          {
            term: "すべての記録",
            description: "実行記録を検索し、必要なら追加・編集・削除します。",
          },
        ],
      },
      {
        type: "paragraph",
        text: "記録は達成率やランキングではなく、実際に取り組んだ事実を見るための画面です。次に何を続けるかを決める材料として使ってください。",
      },
    ],
  },
  {
    id: "settings-data",
    title: "設定とデータを守る",
    summary: "データはPC内へ保存され、ZIPバックアップから戻せます。",
    blocks: [
      {
        type: "bullets",
        items: [
          "設定の「バックアップ」で保存先を選ぶと、設定と実行記録をZIPへバックアップできます。",
          "「ZIPから復元」でバックアップ時点へ戻せます。復元前の現在データも内部バックアップへ退避します。",
          "ソフトウェアリセットはLife Launcherの設定と記録を初回状態へ戻します。実行前にバックアップするか選べます。",
          "リセットしても、登録元のアプリ、ファイル、フォルダ、手順書本体、既存バックアップは削除しません。",
          "Life Launcherは利用データを外部サービスへ自動送信しません。",
        ],
      },
      {
        type: "note",
        tone: "warning",
        text: "復元やリセットの前は、実行中・一時停止中のTimerを終了してください。",
      },
    ],
  },
  {
    id: "non-goals",
    title: "困ったとき",
    summary: "よく迷う操作だけを、短く確認できます。",
    blocks: [
      {
        type: "definitions",
        items: [
          {
            term: "辞書をすぐ開くには？",
            description: "Ctrl+Kを押します。反応しない場合は設定のショートカットを確認してください。",
          },
          {
            term: "今日の3件から外すには？",
            description: "カードの「今日の3件から外す」、またはカードを下の解除エリアへドラッグします。元の候補は消えません。",
          },
          {
            term: "次の一手を変えるには？",
            description: "プロジェクトの次の一手カードにある「変更」を押します。やりたいことから選ぶこともできます。",
          },
          {
            term: "やりたいことを今日へ入れるには？",
            description: "「今日やるものを選ぶ」でやりたいことタブを開くか、Main上の項目を今日の3件へドラッグします。",
          },
          {
            term: "手順書フォルダを追加するには？",
            description: "手順書ビューアーを開き、「フォルダを読み込む」を押します。",
          },
          {
            term: "バックアップから戻すには？",
            description: "設定のバックアップを開き、「ZIPから復元」を使います。",
          },
          {
            term: "Mainを閉じたら終了する？",
            description: "Mainを閉じてもtrayで動作を続けます。完全に終了するときはtray menuの終了を使います。",
          },
        ],
      },
      {
        type: "note",
        tone: "normal",
        text: "Life Launcherには期限、サブタスク、ランキング、クラウド同期はありません。判断を増やさず、始めることへ集中するためです。",
      },
    ],
  },
];
