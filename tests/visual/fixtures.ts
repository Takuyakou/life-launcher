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
  name: "public";
  config: AppConfig;
  sessionSummary: SessionSummaryResponse;
  sessionEntries: SessionEntriesResponse;
  weeklyReview: WeeklyReviewResponse;
  todayNotes: string[];
  notesHistory: Array<{ date: string; items: string[] }>;
  todayMinutes: number;
  doNowCandidates: Array<{
    projectId: string;
    reason: "noToday" | "oldestToday" | "manualOrder";
    restartEligible: boolean;
  }>;
};

const INSTRUCTION_ROOT = "C:\\PublicDemo\\Instructions";

function createConfig(): AppConfig {
  return {
    $schema: "./config.schema.json",
    version: 2,
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
        actions: [{ type: "open_app", payload: { path: "C:\\PublicDemo\\Apps\\SampleEditor.exe" } }],
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
        nextStep: "資料を1ページ読む",
        nextStepTrigger: "サンプル資料",
        buttonIds: ["sample-documents"],
        defaultTimerMinutes: 25,
        shortTimerMinutes: 5,
        colorId: "blue",
        instructionPath: `${INSTRUCTION_ROOT}\\guide.md`,
        instructionOpenOnStart: false,
      },
      {
        id: "sample-stretch",
        name: "ストレッチ",
        northStar: "無理なく体を整える",
        weeklyFocus: true,
        nextStep: "5分だけ体を動かす",
        buttonIds: [],
        defaultTimerMinutes: 20,
        shortTimerMinutes: 5,
        colorId: "green",
      },
    ],
    today: {
      date: FIXTURE_DATE,
      victory: { text: "最優先の一手を始める", done: false },
      items: [
        { text: "資料を1ページ読む", done: false, projectId: "sample-learning" },
        { text: "机の上を5分だけ整える", done: true },
      ],
    },
    inbox: [
      { text: "あとで確認するサンプル" },
      { text: "週末に試すアイデア", projectId: "sample-learning" },
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