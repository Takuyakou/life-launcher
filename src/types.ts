import { z } from "zod";
import {
  EXECUTION_TRIGGER_MAX_CHARS,
  OVERLAY_PAGE_NAME_MAX_CHARS,
  WEEKLY_FOCUS_LIMIT,
} from "./constants";

export const ActionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("open_app"),
    payload: z.object({ path: z.string(), args: z.array(z.string()).optional() }),
  }),
  z.object({
    type: z.literal("open_url"),
    payload: z.object({ url: z.string() }),
  }),
  z.object({
    type: z.literal("open_folder"),
    payload: z.object({ path: z.string() }),
  }),
  z.object({
    type: z.literal("open_file"),
    payload: z.object({ path: z.string() }),
  }),
  z.object({
    type: z.literal("run_script"),
    payload: z.object({ path: z.string(), args: z.array(z.string()).optional() }),
  }),
  z.object({
    type: z.literal("open_shell_special"),
    payload: z.object({ item: z.literal("recycle_bin") }),
  }),
]);

export const OverlayPageSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).max(OVERLAY_PAGE_NAME_MAX_CHARS),
});

export const DictionaryOrderSchema = z
  .array(z.string().min(1))
  .refine((ids) => new Set(ids).size === ids.length, "辞書の表示順に重複IDは指定できません");

export const ButtonSchema = z.object({
  id: z.string(),
  label: z.string(),
  icon: z.string().optional().nullable(),
  iconSource: z.string().optional().nullable(),
  group: z.string().optional().nullable(),
  showInSidebar: z.boolean().default(true),
  showInOverlay: z.boolean().default(true),
  overlayPageId: z.string().optional().nullable(),
  aliases: z.array(z.string()).default([]),
  description: z.string().optional().nullable(),
  actions: z.array(ActionSchema),
});

export const ProjectColorIdSchema = z.enum([
  "amber",
  "blue",
  "green",
  "violet",
  "rose",
  "cyan",
  "orange",
  "slate",
]);

const InstructionPathSchema = z
  .string()
  .trim()
  .min(3)
  .regex(/^[A-Za-z]:[\\/]/, "手順書パスはローカルドライブの絶対パスが必要です");

const InstructionFolderListSchema = z
  .array(InstructionPathSchema)
  .max(5)
  .superRefine((folders, context) => {
    const seen = new Set<string>();
    folders.forEach((folder, index) => {
      const key = folder.replace(/\//g, "\\").replace(/\\+$/, "").toLocaleLowerCase();
      if (seen.has(key)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: "同じ手順書フォルダは重複して登録できません",
          path: [index],
        });
      }
      seen.add(key);
    });
  });

const InstructionFolderIdentitySchema = z.object({
  path: InstructionPathSchema,
  // Current configs use FILE_ID_INFO (16 hex digits + 32 hex digits), while existing
  // configs retain the legacy BY_HANDLE_FILE_INFORMATION representation.
  identity: z
    .string()
    .regex(/^(?:[0-9A-F]{8}:[0-9A-F]{16}|[0-9A-F]{16}:[0-9A-F]{32})$/),
});

export const ProjectSchema = z.object({
  id: z.string(),
  name: z.string(),
  northStar: z.string().max(60).optional(),
  weeklyFocus: z.boolean().optional(),
  nextStep: z.string(),
  nextStepTrigger: z.string().max(EXECUTION_TRIGGER_MAX_CHARS).optional(),
  nextStepUpdatedAt: z.string().datetime({ offset: true }).optional(),
  nextStepReviewedAt: z.string().datetime({ offset: true }).optional(),
  buttonIds: z.array(z.string()).default([]),
  defaultTimerMinutes: z.number().int().min(1).max(240).optional(),
  shortTimerMinutes: z.number().int().min(1).max(240).optional(),
  startNoteTemplate: z.string().optional(),
  colorId: ProjectColorIdSchema.optional(),
  instructionPath: InstructionPathSchema.optional(),
  instructionOpenOnStart: z.boolean().optional(),
});

export const TodayItemSchema = z.object({
  text: z.string(),
  done: z.boolean(),
  trigger: z.string().max(EXECUTION_TRIGGER_MAX_CHARS).optional(),
  projectId: z.string().optional(),
  buttonIds: z.array(z.string().min(1)).optional(),
  instructionPath: InstructionPathSchema.optional(),
  instructionOpenOnStart: z.boolean().optional(),
});

export const TodayVictorySchema = z
  .object({
    text: z.string(),
    done: z.boolean(),
  })
  .default({ text: "", done: false });

export const InboxItemSchema = z.object({
  text: z.string(),
  projectId: z.string().min(1).optional(),
  buttonIds: z.array(z.string().min(1)).optional(),
  instructionPath: InstructionPathSchema.optional(),
  instructionOpenOnStart: z.boolean().optional(),
});

export const MiniWindowPositionSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
});

export const SettingsSchema = z.object({
  alwaysOnTop: z.boolean(),
  focusHotkey: z.string().nullable(),
  launcherHotkey: z.string().nullable().default("Ctrl+K"),
  miniHotkey: z.string().nullable().default(null),
  autoStart: z.boolean().default(false),
  defaultTimerMinutes: z.number().int().min(1).max(240),
  shortTimerMinutes: z.number().int().min(1).max(240).default(5),
  dayStartHour: z.number().int().min(0).max(23).default(4),
  backupFolder: z.string().nullable().default(null),
  backupKeep: z.number().int().min(1).default(30),
  miniMode: z.boolean().default(true),
  miniWindowPosition: MiniWindowPositionSchema.nullable().default(null),
  restartShortFirst: z.boolean().optional(),
  instructionFolders: InstructionFolderListSchema.default([]),
  instructionFolderIdentities: z.array(InstructionFolderIdentitySchema).max(5).optional(),
  instructionHotkey: z.string().trim().min(1).nullable().optional(),
});

export const AppConfigSchema = z
  .object({
    $schema: z.string().optional(),
    version: z.literal(2),
    groups: z.array(z.string()).default([]),
    overlayPages: z.array(OverlayPageSchema).optional(),
    dictionaryOrder: DictionaryOrderSchema.optional(),
    buttons: z.array(ButtonSchema),
    projects: z.array(ProjectSchema),
    today: z.object({
      date: z.string(),
      victory: TodayVictorySchema,
      items: z.array(TodayItemSchema),
    }),
    inbox: z.array(InboxItemSchema),
    settings: SettingsSchema,
  })
  .superRefine((config, context) => {
    if (config.projects.filter((project) => project.weeklyFocus === true).length > WEEKLY_FOCUS_LIMIT) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `今週の重点は最大${WEEKLY_FOCUS_LIMIT}件です`,
        path: ["projects"],
      });
    }
  });

export type LauncherAction = z.infer<typeof ActionSchema>;
export type OverlayPage = z.infer<typeof OverlayPageSchema>;
export type LauncherButton = z.infer<typeof ButtonSchema>;
export type ProjectColorId = z.infer<typeof ProjectColorIdSchema>;
export type LauncherProject = z.infer<typeof ProjectSchema>;
export type TodayItem = z.infer<typeof TodayItemSchema>;
export type TodayVictory = z.infer<typeof TodayVictorySchema>;
export type InboxItem = z.infer<typeof InboxItemSchema>;
export type MiniWindowPosition = z.infer<typeof MiniWindowPositionSchema>;
export type AppConfig = z.infer<typeof AppConfigSchema>;

export type LoadConfigResponse = {
  config: AppConfig;
  path: string;
  backupPath: string;
  error?: string | null;
  backupError?: string | null;
  changed: boolean;
  morningVictorySuggestion?: string | null;
};

export type SaveConfigResponse = {
  config: AppConfig;
  path: string;
};

export type ActionResult = {
  index: number;
  actionType: LauncherAction["type"];
  ok: boolean;
  message: string;
};

export type DropResolveInput =
  | {
      kind: "path";
      value: string;
    }
  | {
      kind: "url";
      value: string;
      suggestedLabel?: string | null;
    };

export type DropButtonDraft = {
  label: string;
  group?: string | null;
  iconSource?: string | null;
  action: LauncherAction;
  source: string;
};

export type InstructionRoot = {
  name: string;
  path: string;
  available: boolean;
  error?: string;
  readOnly?: boolean;
};

export type InstructionEntry = {
  name: string;
  path: string;
  kind: "file" | "folder";
  extension?: string | null;
  size?: number | null;
  modifiedAt?: number | null;
  readOnly: boolean;
};

export type InstructionDocument = {
  name: string;
  path: string;
  content: string;
  size: number;
  modifiedAt: number;
  extension?: string;
  readOnly: boolean;
};

export type InstructionWriteResult = {
  path: string;
  modifiedAt: number;
  size: number;
};

export type InstructionPathChange = {
  oldPath: string;
  newPath: string;
};

export type InstructionRecycleResult = {
  path: string;
};

export type InstructionFolderSummary = {
  instructionCount: number;
  folderCount: number;
};

export type InstructionReferenceUpdateResult = {
  projectNames: string[];
  changed: boolean;
};

export type SessionLogInput = {
  projectId?: string | null;
  label: string;
  startedAt: string;
  minutes: number;
  note: string;
};

export type ManualSessionInput = {
  projectId?: string | null;
  label: string;
  date: string;
  startedAt: string;
  minutes: number;
  note: string;
};

export type SessionTotalResponse = {
  date: string;
  totalMinutes: number;
  path: string;
};

export type TodayNotesResponse = {
  date: string;
  items: string[];
  path: string;
};

export type TodayNotesInput = {
  items: string[];
};

export type ProjectSessionTotal = {
  projectId?: string | null;
  label: string;
  activeDays: number;
  totalMinutes: number;
};

export type RecentSessionEntry = {
  rowKey: string;
  id?: string | null;
  date: string;
  projectId?: string | null;
  label: string;
  startedAt: string;
  minutes: number;
  note: string;
};

export type SessionSummaryResponse = {
  date: string;
  todayMinutes: number;
  weekMinutes: number;
  activeDays: number;
  projects: ProjectSessionTotal[];
  allTimeProjects: ProjectSessionTotal[];
  recentSessions: RecentSessionEntry[];
  path: string;
};

export type WeeklyReviewProjectSummary = {
  projectId?: string | null;
  label: string;
  sessionCount: number;
  totalMinutes: number;
};

export type WeeklyReviewResponse = {
  weekKey: string;
  previousWeekStart: string;
  previousWeekEnd: string;
  totalMinutes: number;
  activeDays: number;
  projects: WeeklyReviewProjectSummary[];
};

export type NextStepFreshnessResponse = {
  staleProjectIds: string[];
};

export type DoNowCandidate = {
  projectId: string;
  reason: "noToday" | "oldestToday" | "manualOrder" | string;
  restartEligible: boolean;
};

export type DoNowResponse = {
  date: string;
  candidates: DoNowCandidate[];
};

export type SessionEntriesFilter = {
  query?: string | null;
  projectId?: string | null;
  dateScope?: "today" | "week" | "all" | string | null;
};

export type SessionEntryRow = {
  rowKey: string;
  id?: string | null;
  date: string;
  projectId?: string | null;
  label: string;
  startedAt: string;
  minutes: number;
  note: string;
  manual: boolean;
};

export type SessionEntriesResponse = {
  date: string;
  entries: SessionEntryRow[];
  path: string;
  warning?: string | null;
};

export type UpdateSessionEntryInput = {
  rowKey: string;
  date: string;
  projectId?: string | null;
  label: string;
  startedAt: string;
  minutes: number;
  note: string;
};

export type DeleteSessionEntryInput = {
  rowKey: string;
};

export type NotesHistoryEntry = {
  date: string;
  items: string[];
};

export type NotesHistoryResponse = {
  entries: NotesHistoryEntry[];
  path: string;
};

export type NotesForDateInput = {
  date: string;
  items: string[];
};
