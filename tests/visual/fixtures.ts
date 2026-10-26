import type {
  AppConfig,
  RecentSessionEntry,
  SessionEntriesResponse,
  SessionSummaryResponse,
  WeeklyReviewResponse,
} from "../../src/types";

export const FIXTURE_DATE = "2026-08-13";
export const FIXTURE_NOW = "2026-08-13T09:30:00+09:00";

export type VisualQaFixture = {
  name: "public" | "phase9-full" | "phase9-picker" | "phase9-running";
  config: AppConfig;
  sessionSummary: SessionSummaryResponse;
  sessionEntries: SessionEntriesResponse;
  weeklyReview: WeeklyReviewResponse;
  todayNotes: string[];
  notesHistory: Array<{ date: string; items: string[] }>;
  todayMinutes: number;
  doNowCandidates: Array<{
    projectId: string;
    reason: "noToday" | "oldestSession" | "manualOrder";
    restartEligible: boolean;
  }>;
  staleProjectIds?: string[];
  instructionDocuments?: Record<string, string>;
};

const INSTRUCTION_ROOT = "C:\\PublicDemo\\Instructions";

function createConfig(): AppConfig {
  return {
    $schema: "./config.schema.json",
    version: 3,
    groups: ["ショートカット", "資料", "リンク"],
    overlayPages: [
      { id: "tools", name: "ツール" },
      { id: "reference", name: "参考資料" },
    ],
    dictionaryOrder: ["sample-editor", "sample-documents", "reference-site"],
    buttons: [
      {
        id: "sample-editor",
        label: "サンプルエディター",
        icon: "□",
        group: "ショートカット",
        showInSidebar: true,
        showInOverlay: true,
        overlayPageId: "tools",
        aliases: ["editor", "編集"],
        description: "作業を始めるためのサンプルアプリ",
        actions: [
          { type: "open_app", payload: { path: "C:\\PublicDemo\\Apps\\SampleEditor.exe" } },
        ],
      },
      {
        id: "sample-documents",
        label: "サンプル資料",
        icon: "□",
        group: "資料",
        showInSidebar: true,
        showInOverlay: true,
        overlayPageId: "reference",
        aliases: ["documents", "資料"],
        description: "公開撮影用の架空フォルダ",
        actions: [{ type: "open_folder", payload: { path: "C:\\PublicDemo\\Documents" } }],
      },
      {
        id: "reference-site",
        label: "参考サイト",
        icon: "□",
        group: "リンク",
        showInSidebar: false,
        showInOverlay: true,
        overlayPageId: "reference",
        aliases: ["reference", "調べる"],
        description: "外部リンク表示のサンプル",
        actions: [{ type: "open_url", payload: { url: "https://example.invalid/public-demo" } }],
      },
    ],
    projects: [
      {
        id: "sample-learning",
        name: "サンプル学習",
        northStar: "小さな一手から理解を深める",
        weeklyFocus: true,
        nextStep: {
          text: "資料を1ページ読む",
          trigger: "サンプル資料",
          buttonIds: ["sample-documents"],
          defaultTimerMinutes: 25,
          shortTimerMinutes: 5,
          instructionPath: `${INSTRUCTION_ROOT}\\guide.md`,
          instructionOpenOnStart: false,
        },
        colorId: "blue",
      },
      {
        id: "sample-stretch",
        name: "ストレッチ",
        northStar: "無理なく体を整える",
        weeklyFocus: true,
        nextStep: {
          text: "5分だけ体を動かす",
          buttonIds: [],
          defaultTimerMinutes: 20,
          shortTimerMinutes: 5,
        },
        colorId: "green",
      },
    ],
    today: {
      date: FIXTURE_DATE,
      victory: { text: "最優先の一手を始める", done: false },
      candidateExcludedSourceKeys: [],
      selectionMutationTokens: {},
      items: [
        {
          text: "資料を1ページ読む",
          done: false,
          sourceKey: "project:sample-learning",
          projectId: "sample-learning",
        },
        {
          text: "机の上を5分だけ整える",
          done: true,
          sourceKey: "manual:fixture-cleanup",
        },
      ],
    },
    sourceCompletions: [],
    inbox: [
      { id: "sample-later", text: "あとで確認するサンプル" },
      { id: "sample-weekend", text: "週末に試すアイデア", projectId: "sample-learning" },
    ],
    settings: {
      alwaysOnTop: false,
      focusHotkey: null,
      launcherHotkey: "Ctrl+K",
      miniHotkey: null,
      autoStart: false,
      defaultTimerMinutes: 25,
      shortTimerMinutes: 5,
      dayStartHour: 4,
      backupFolder: "C:\\PublicDemo\\Backups",
      backupKeep: 30,
      miniMode: true,
      miniWindowPosition: null,
      restartShortFirst: true,
      instructionFolders: [INSTRUCTION_ROOT],
      instructionFolderIdentities: [],
      instructionHotkey: null,
    },
  };
}

function sessionRows(): RecentSessionEntry[] {
  return [
    {
      rowKey: "public-session-1",
      id: "public-session-1",
      date: FIXTURE_DATE,
      projectId: "sample-learning",
      label: "サンプル学習",
      startedAt: "08:40",
      minutes: 25,
      note: "資料の要点を確認した",
    },
    {
      rowKey: "public-session-2",
      id: "public-session-2",
      date: "2026-08-12",
      projectId: "sample-stretch",
      label: "ストレッチ",
      startedAt: "18:10",
      minutes: 10,
      note: "短いメニューを実行した",
    },
  ];
}

export function createPublicFixture(): VisualQaFixture {
  const config = createConfig();
  const recentSessions = sessionRows();
  const sessionSummary: SessionSummaryResponse = {
    date: FIXTURE_DATE,
    todayMinutes: 25,
    weekMinutes: 75,
    activeDays: 3,
    projects: [
      { projectId: "sample-learning", label: "サンプル学習", activeDays: 2, totalMinutes: 50 },
      { projectId: "sample-stretch", label: "ストレッチ", activeDays: 1, totalMinutes: 25 },
    ],
    allTimeProjects: [
      { projectId: "sample-learning", label: "サンプル学習", activeDays: 8, totalMinutes: 210 },
      { projectId: "sample-stretch", label: "ストレッチ", activeDays: 5, totalMinutes: 95 },
    ],
    recentSessions,
    path: "C:\\PublicDemo\\sessions.jsonl",
  };
  const sessionEntries: SessionEntriesResponse = {
    date: FIXTURE_DATE,
    entries: recentSessions.map((entry) => ({ ...entry, manual: false })),
    path: sessionSummary.path,
    warning: null,
  };
  const weeklyReview: WeeklyReviewResponse = {
    weekKey: "2026-W33",
    previousWeekStart: "2026-08-03",
    previousWeekEnd: "2026-08-09",
    totalMinutes: 75,
    activeDays: 3,
    projects: [
      { projectId: "sample-learning", label: "サンプル学習", sessionCount: 2, totalMinutes: 50 },
      { projectId: "sample-stretch", label: "ストレッチ", sessionCount: 1, totalMinutes: 25 },
    ],
  };
  return {
    name: "public",
    config,
    sessionSummary,
    sessionEntries,
    weeklyReview,
    todayNotes: ["公開撮影用の合成メモ"],
    notesHistory: [{ date: "2026-08-12", items: ["前日の合成メモ"] }],
    todayMinutes: 25,
    doNowCandidates: [
      { projectId: "sample-learning", reason: "manualOrder", restartEligible: false },
      { projectId: "sample-stretch", reason: "noToday", restartEligible: false },
    ],
  };
}

// Phase 9 fixtures: 5 colored Projects, several wishlist items and Sessions, and one
// Project-sourced Today item (with generation id) so Phase 9 flows can start from it.
function createPhase9Base(name: VisualQaFixture["name"]): VisualQaFixture {
  const fixture = createPublicFixture();
  fixture.name = name;
  const { config } = fixture;
  config.projects = [
    {
      ...config.projects[0],
      nextStep: { ...config.projects[0].nextStep!, generationId: "gen-learning-1" },
    },
    {
      ...config.projects[1],
      nextStep: { ...config.projects[1].nextStep!, generationId: "gen-stretch-1" },
    },
    {
      id: "sample-writing",
      name: "文章づくり",
      northStar: "毎日少しずつ書く",
      weeklyFocus: false,
      colorId: "violet",
      nextStep: {
        text: "見出しを3つ書き出す",
        generationId: "gen-writing-1",
        buttonIds: [],
        defaultTimerMinutes: 25,
        shortTimerMinutes: 5,
      },
    },
    {
      id: "sample-music",
      name: "音づくり",
      northStar: "短いループを1本仕上げる",
      weeklyFocus: false,
      colorId: "rose",
      nextStep: {
        text: "ドラムの音を1つ選ぶ",
        generationId: "gen-music-1",
        buttonIds: [],
        defaultTimerMinutes: 25,
        shortTimerMinutes: 5,
      },
    },
    {
      id: "sample-home",
      name: "暮らしの整理",
      northStar: "部屋を軽く保つ",
      weeklyFocus: false,
      colorId: "orange",
      nextStep: {
        text: "引き出しを1段だけ片づける",
        generationId: "gen-home-1",
        buttonIds: [],
        defaultTimerMinutes: 20,
        shortTimerMinutes: 5,
      },
    },
  ];
  config.inbox = [
    { id: "sample-later", text: "あとで確認するサンプル" },
    { id: "sample-weekend", text: "週末に試すアイデア", projectId: "sample-learning" },
    { id: "sample-book", text: "気になる本を1冊読み始める", projectId: "sample-writing" },
    { id: "sample-walk", text: "夕方に散歩する", projectId: "sample-stretch" },
    { id: "sample-shelf", text: "本棚の上を拭く", projectId: "sample-home" },
  ];
  fixture.doNowCandidates = config.projects.map((project, index) => ({
    projectId: project.id,
    reason: index === 0 ? "manualOrder" : "noToday",
    restartEligible: false,
  }));
  const extraSessions: RecentSessionEntry[] = [
    {
      rowKey: "phase9-session-3",
      id: "phase9-session-3",
      date: "2026-08-11",
      projectId: "sample-writing",
      label: "文章づくり",
      startedAt: "21:00",
      minutes: 15,
      note: "見出しの案を出した",
    },
    {
      rowKey: "phase9-session-4",
      id: "phase9-session-4",
      date: "2026-08-10",
      projectId: "sample-music",
      label: "音づくり",
      startedAt: "20:30",
      minutes: 30,
      note: "ループの土台を作った",
    },
  ];
  fixture.sessionSummary.recentSessions.push(...extraSessions);
  fixture.sessionEntries.entries.push(...extraSessions.map((entry) => ({ ...entry, manual: false })));
  return fixture;
}

/** Today 3/3 with one item done: Main, Settings, Records. */
export function createFullTodayFixture(): VisualQaFixture {
  const fixture = createPhase9Base("phase9-full");
  fixture.config.today.items = [
    {
      text: "資料を1ページ読む",
      done: false,
      sourceKey: "project:sample-learning",
      sourceGenerationId: "gen-learning-1",
      projectId: "sample-learning",
      shortTimerMinutes: 1,
    },
    { text: "机の上を5分だけ整える", done: true, sourceKey: "manual:fixture-cleanup" },
    { text: "週末に試すアイデア", done: false, sourceKey: "wishlist:sample-weekend" },
  ];
  return fixture;
}

/** Today 0/3 with 5 Next Steps and 5 wishlist items (10 candidates): the Today picker. */
export function createPickerFixture(): VisualQaFixture {
  const fixture = createPhase9Base("phase9-picker");
  fixture.config.today.items = [];
  return fixture;
}

/** Same data as the full fixture; the test starts one Timer to reach the running state. */
export function createRunningFixture(): VisualQaFixture {
  const fixture = createFullTodayFixture();
  fixture.name = "phase9-running";
  return fixture;
}
