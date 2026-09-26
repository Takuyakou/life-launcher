import type { Page } from "@playwright/test";
import type { VisualQaFixture } from "./fixtures";

const TEST_PATHS = {
  config: "C:\\\\PublicDemo\\\\config.json",
  sessions: "C:\\\\PublicDemo\\\\sessions.jsonl",
  notes: "C:\\\\PublicDemo\\\\notes.json",
};

export async function installTauriMock(
  page: Page,
  fixture: VisualQaFixture,
  currentWindowLabel = "main",
  softwareResetRecovery: unknown = null,
  options: { cleanStartReset?: boolean; cleanStartNow?: string; rolloverOnLoadConfig?: boolean } = {},
): Promise<void> {
  await page.addInitScript(
    ({ fixture, paths, currentWindowLabel, softwareResetRecovery, options }) => {
      const configStorageKey = "life-launcher-visual-qa-config";
      const cleanStartStorageKey = "life-launcher-visual-qa-clean-start";
      const resetBackupPath = "C:\\PublicDemo\\Backups\\lifelauncher-clean-start.zip";
      const externalSentinel = {
        path: "C:\\ExternalFixtures\\instruction-guide.html",
        value: "external-file-untouched",
      };
      const clone = <T,>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
      let doNowCandidates = fixture.doNowCandidates;
      let currentConfig = (() => {
        try {
          const stored = window.sessionStorage.getItem(configStorageKey);
          return stored ? (JSON.parse(stored) as typeof fixture.config) : fixture.config;
        } catch {
          return fixture.config;
        }
      })();
      const persistCurrentConfig = () => {
        window.sessionStorage.setItem(configStorageKey, JSON.stringify(currentConfig));
      };
      type CleanStartState = {
        sessions: typeof fixture.sessionEntries.entries;
        notes: string[];
        notesHistory: typeof fixture.notesHistory;
        backup: null | {
          path: string;
          config: typeof fixture.config;
          sessions: typeof fixture.sessionEntries.entries;
          notes: string[];
          notesHistory: typeof fixture.notesHistory;
        };
        externalSentinel: typeof externalSentinel;
        resetCompleted: boolean;
        restoreCount: number;
      };
      const initialCleanStartState = (): CleanStartState => ({
        sessions: clone(fixture.sessionEntries.entries),
        notes: clone(fixture.todayNotes),
        notesHistory: clone(fixture.notesHistory),
        backup: null,
        externalSentinel: clone(externalSentinel),
        resetCompleted: false,
        restoreCount: 0,
      });
      const cleanStartState: CleanStartState | null = (() => {
        if (!options.cleanStartReset) return null;
        try {
          const stored = window.sessionStorage.getItem(cleanStartStorageKey);
          return stored ? (JSON.parse(stored) as CleanStartState) : initialCleanStartState();
        } catch {
          return initialCleanStartState();
        }
      })();
      const persistCleanStartState = () => {
        if (!cleanStartState) return;
        window.sessionStorage.setItem(cleanStartStorageKey, JSON.stringify(cleanStartState));
      };
      const dateKeyAt = (isoNow: string, dayStartHour: number) => {
        const offsetMatch = isoNow.match(/([+-])(\d{2}):(\d{2})$/);
        const instant = new Date(isoNow);
        const offsetMinutes = offsetMatch
          ? (offsetMatch[1] === "+" ? 1 : -1) *
            (Number(offsetMatch[2]) * 60 + Number(offsetMatch[3]))
          : 0;
        const localAtBoundary = new Date(
          instant.getTime() + offsetMinutes * 60_000 - dayStartHour * 60 * 60_000,
        );
        return localAtBoundary.toISOString().slice(0, 10);
      };
      const freshConfig = () => ({
        $schema: "./config.schema.json",
        version: 3 as const,
        groups: [],
        overlayPages: [],
        dictionaryOrder: [],
        buttons: [],
        projects: [],
        today: {
          date: dateKeyAt(options.cleanStartNow ?? new Date().toISOString(), 4),
          victory: { text: "", done: false },
          items: [],
          candidateExcludedSourceKeys: [],
          selectionMutationTokens: {},
        },
        inbox: [],
        sourceCompletions: [],
        settings: {
          alwaysOnTop: false,
          focusHotkey: "Ctrl+Alt+Space",
          launcherHotkey: "Ctrl+K",
          miniHotkey: null,
          autoStart: false,
          defaultTimerMinutes: 25,
          shortTimerMinutes: 5,
          dayStartHour: 4,
          backupFolder: null,
          backupKeep: 30,
          miniMode: true,
          miniWindowPosition: null,
          restartShortFirst: true,
          instructionFolders: [],
          instructionFolderIdentities: [],
          instructionHotkey: null,
        },
      });
      const cleanStartTotalMinutes = () =>
        cleanStartState?.sessions
          .filter((entry) => entry.date === currentConfig.today.date)
          .reduce((total, entry) => total + entry.minutes, 0) ?? fixture.todayMinutes;
      const cleanStartSessionSummary = () => {
        if (!cleanStartState) return fixture.sessionSummary;
        const totals = new Map<
          string,
          { projectId?: string | null; label: string; activeDates: Set<string>; totalMinutes: number }
        >();
        for (const entry of cleanStartState.sessions) {
          const key = entry.projectId ?? `label:${entry.label}`;
          const total = totals.get(key) ?? {
            projectId: entry.projectId,
            label: entry.label,
            activeDates: new Set<string>(),
            totalMinutes: 0,
          };
          total.activeDates.add(entry.date);
          total.totalMinutes += entry.minutes;
          totals.set(key, total);
        }
        const projects = [...totals.values()].map((entry) => ({
          projectId: entry.projectId,
          label: entry.label,
          activeDays: entry.activeDates.size,
          totalMinutes: entry.totalMinutes,
        }));
        const activeDays = new Set(cleanStartState.sessions.map((entry) => entry.date)).size;
        const totalMinutes = cleanStartState.sessions.reduce(
          (total, entry) => total + entry.minutes,
          0,
        );
        return {
          date: currentConfig.today.date,
          todayMinutes: cleanStartTotalMinutes(),
          weekMinutes: totalMinutes,
          activeDays,
          projects,
          allTimeProjects: projects,
          recentSessions: clone(cleanStartState.sessions),
          path: paths.sessions,
        };
      };
      let callbackId = 1;
      let eventId = 1;
      let executeMode: "success" | "failure" | "delayed" = "success";
      let failWindowHide = false;
      let failSaveConfig = false;
      let failReapplyDashboardSettings = false;
      let failRecordSession = false;
      let mainWindowState = { visible: true, minimized: false, focused: true };
      type InstructionRootChoice = {
        name: string;
        path: string;
        available: boolean;
        readOnly: boolean;
      } | null;
      let instructionRootChoices: InstructionRootChoice[] = [];
      let launcherPickerResult: string | null = null;
      let instructionRootDelayed = false;
      const pendingInstructionRootChoices: Array<(choice: InstructionRootChoice) => void> = [];
      const invokeCalls: Array<{ command: string; args: Record<string, unknown> }> = [];
      const callbacks = new Map<number, (event: unknown) => void>();
      const eventListeners = new Map<string, Map<number, number>>();
      const pendingExecuteActions: Array<() => void> = [];
      let currentNotes = cleanStartState ? clone(cleanStartState.notes) : fixture.todayNotes;

      const dispatchEvent = (event: string, payload: unknown = null) => {
        const listeners = eventListeners.get(event);
        if (!listeners) return;
        for (const [listenerId, handlerId] of listeners) {
          callbacks.get(handlerId)?.({ event, id: listenerId, payload });
        }
      };
      const unregisterEventListener = (event: string, listenerId: number) => {
        eventListeners.get(event)?.delete(listenerId);
      };
      const visualQaControl = {
        invokeCalls,
        setExecuteMode: (mode: "success" | "failure" | "delayed") => {
          executeMode = mode;
        },
        setWindowHideFailure: (shouldFail: boolean) => {
          failWindowHide = shouldFail;
        },
        setSaveConfigFailure: (shouldFail: boolean) => {
          failSaveConfig = shouldFail;
        },
        setReapplyDashboardSettingsFailure: (shouldFail: boolean) => {
          failReapplyDashboardSettings = shouldFail;
        },
        setRecordSessionFailure: (shouldFail: boolean) => {
          failRecordSession = shouldFail;
        },
        setMainWindowState: (state: typeof mainWindowState) => {
          mainWindowState = { ...state };
        },
        mainWindowState: () => ({ ...mainWindowState }),
        setInstructionRootChoices: (choices: typeof instructionRootChoices) => {
          instructionRootChoices = [...choices];
        },
        setLauncherPickerResult: (result: string | null) => {
          launcherPickerResult = result;
        },
        setInstructionRootDelayed: (delayed: boolean) => {
          instructionRootDelayed = delayed;
        },
        resolveInstructionRootChoice: () => {
          pendingInstructionRootChoices.shift()?.(instructionRootChoices.shift() ?? null);
        },
        currentConfig: () => currentConfig,
        cleanStartState: () => (cleanStartState ? clone(cleanStartState) : null),
        resolveExecuteActions: () => {
          for (const resolve of pendingExecuteActions.splice(0)) resolve();
        },
        updateConfig: (nextConfig: typeof currentConfig) => {
          currentConfig = nextConfig;
          persistCurrentConfig();
          dispatchEvent("config-changed");
        },
        setDoNowCandidates: (candidates: typeof fixture.doNowCandidates) => {
          doNowCandidates = candidates;
        },
        emit: (event: string, payload: unknown = null) => {
          dispatchEvent(event, payload);
        },
      };

      Object.defineProperty(globalThis, "isTauri", {
        configurable: true,
        value: true,
      });
      Object.defineProperty(window, "__LIFE_LAUNCHER_VISUAL_QA__", {
        configurable: true,
        value: visualQaControl,
      });
      Object.defineProperty(window, "__TAURI_EVENT_PLUGIN_INTERNALS__", {
        configurable: true,
        value: { unregisterListener: unregisterEventListener },
      });
      Object.defineProperty(window, "__TAURI_INTERNALS__", {
        configurable: true,
        value: {
          metadata: {
            currentWindow: { label: currentWindowLabel },
            currentWebview: { label: currentWindowLabel },
          },
          transformCallback: (callback: (event: unknown) => void) => {
            const id = callbackId++;
            callbacks.set(id, callback);
            return id;
          },
          unregisterCallback: (id: number) => callbacks.delete(id),
          convertFileSrc: (path: string) => {
            const normalized = path.replace(/\\/g, "/");
            const instructionPrefix = "C:/PublicDemo/Instructions/";
            if (!normalized.startsWith(instructionPrefix)) return path;
            const relative = normalized.slice(instructionPrefix.length);
            return "http://asset.localhost/instructions/" + encodeURI(relative);
          },
          invoke: async (command: string, args: Record<string, unknown> = {}) => {
            invokeCalls.push({ command, args });
            switch (command) {
              case "set_display_awake":
                return null;
              case "load_config":
                if (options.rolloverOnLoadConfig) {
                  const date = new Date();
                  if (date.getHours() < currentConfig.settings.dayStartHour) {
                    date.setDate(date.getDate() - 1);
                  }
                  const dayKey = [date.getFullYear(), date.getMonth() + 1, date.getDate()]
                    .map((part, index) => index === 0 ? String(part) : String(part).padStart(2, "0"))
                    .join("-");
                  if (currentConfig.today.date !== dayKey) {
                    currentConfig = {
                      ...currentConfig,
                      today: {
                        ...currentConfig.today,
                        date: dayKey,
                        items: [],
                        victory: { text: "", done: false },
                        candidateExcludedSourceKeys: [],
                        selectionMutationTokens: {},
                      },
                    };
                    persistCurrentConfig();
                  }
                }
                return {
                  config: currentConfig,
                  path: paths.config,
                  backupPath: "",
                  error: null,
                  backupError: null,
                  changed: false,
                  saveBlocked: false,
                  morningVictorySuggestion: null,
                };
              case "shortcut_registration_status":
                return {
                  main: Boolean(currentConfig.settings.focusHotkey) && !failReapplyDashboardSettings,
                  launcher: Boolean(currentConfig.settings.launcherHotkey) && !failReapplyDashboardSettings,
                  mini: Boolean(currentConfig.settings.miniHotkey) && !failReapplyDashboardSettings,
                  instruction: Boolean(currentConfig.settings.instructionHotkey) && !failReapplyDashboardSettings,
                };
              case "save_config":
                if (failSaveConfig) throw new Error("Public demo mock: config save failed");
                currentConfig = args.config as typeof currentConfig;
                persistCurrentConfig();
                return { config: currentConfig, path: paths.config };
              case "undo_today_selection": {
                if (failSaveConfig) throw new Error("Public demo mock: config save failed");
                const input = args.input as {
                  operationId: string;
                  dayKey: string;
                  sourceKey: string;
                  item: (typeof currentConfig.today.items)[number] | null;
                  previousSourceKey: string | null;
                  nextSourceKey: string | null;
                  sourceSnapshot: unknown | null;
                  restoreExclusion: boolean;
                };
                if (currentConfig.today.date !== input.dayKey) {
                  throw new Error("日付または今日の枠が変わったため元に戻せません");
                }
                if (
                  currentConfig.today.selectionMutationTokens[input.sourceKey] !==
                  input.operationId
                ) {
                  throw new Error("対象はこの後に変更されたため元に戻せません");
                }
                const currentSource = input.sourceKey.startsWith("project:")
                  ? currentConfig.projects.find(
                      (project) => `project:${project.id}` === input.sourceKey,
                    ) ?? null
                  : input.sourceKey.startsWith("wishlist:")
                    ? currentConfig.inbox.find(
                        (item) => `wishlist:${item.id}` === input.sourceKey,
                      ) ?? null
                    : null;
                if (
                  (input.sourceKey.startsWith("project:") ||
                    input.sourceKey.startsWith("wishlist:")) &&
                  JSON.stringify(currentSource) !== JSON.stringify(input.sourceSnapshot)
                ) {
                  throw new Error("元の次の一手・やりたいことが変更されたため元に戻せません");
                }
                if (
                  currentConfig.today.items.some((item) => item.sourceKey === input.sourceKey)
                ) {
                  throw new Error("対象はすでに今日の3件へ戻っています");
                }
                if (input.item) {
                  if (currentConfig.today.items.length >= 3) {
                    throw new Error("今日の3件が埋まっているため元に戻せません");
                  }
                  const nextIndex = input.nextSourceKey
                    ? currentConfig.today.items.findIndex(
                        (item) => item.sourceKey === input.nextSourceKey,
                      )
                    : -1;
                  const previousIndex = input.previousSourceKey
                    ? currentConfig.today.items.findIndex(
                        (item) => item.sourceKey === input.previousSourceKey,
                      )
                    : -1;
                  const insertionIndex =
                    nextIndex >= 0
                      ? nextIndex
                      : previousIndex >= 0
                        ? previousIndex + 1
                        : currentConfig.today.items.length;
                  currentConfig.today.items.splice(insertionIndex, 0, input.item);
                }
                if (input.restoreExclusion) {
                  currentConfig.today.candidateExcludedSourceKeys =
                    currentConfig.today.candidateExcludedSourceKeys.filter(
                      (key) => key !== input.sourceKey,
                    );
                }
                delete currentConfig.today.selectionMutationTokens[input.sourceKey];
                persistCurrentConfig();
                return { config: currentConfig, path: paths.config };
              }
              case "resolve_drop_item": {
                const input = args.input as {
                  kind: "path" | "url";
                  value: string;
                  suggestedLabel?: string | null;
                };
                const isUrl = input.kind === "url";
                const label =
                  input.suggestedLabel ||
                  (isUrl ? "Dropped bookmark" : input.value.split(/[\\/]/).pop()) ||
                  "Dropped item";
                return {
                  label,
                  group: null,
                  iconSource: isUrl ? null : input.value,
                  action: isUrl
                    ? { type: "open_url", payload: { url: input.value } }
                    : {
                        type: input.value.endsWith("\\") ? "open_folder" : "open_file",
                        payload: { path: input.value },
                      },
                  source: input.value,
                };
              }
              case "choose_launcher_target":
                return launcherPickerResult;
              case "load_today_session_total":
                return {
                  date: currentConfig.today.date,
                  totalMinutes: options.rolloverOnLoadConfig
                    ? (cleanStartState?.sessions ?? fixture.sessionEntries.entries)
                        .filter((entry) => entry.date === currentConfig.today.date)
                        .reduce((sum, entry) => sum + entry.minutes, 0)
                    : cleanStartTotalMinutes(),
                  path: paths.sessions,
                };
              case "record_session": {
                if (failRecordSession) throw new Error("Synthetic Session failure");
                if (cleanStartState) {
                  const session = args.session as {
                    projectId?: string | null;
                    label: string;
                    startedAt: string;
                    minutes: number;
                    note: string;
                  };
                  if (session.minutes > 0) {
                    const id = `clean-start-session-${cleanStartState.sessions.length + 1}`;
                    cleanStartState.sessions.push({
                      rowKey: id,
                      id,
                      date: currentConfig.today.date,
                      projectId: session.projectId,
                      label: session.label,
                      startedAt: session.startedAt,
                      minutes: session.minutes,
                      note: session.note,
                      manual: false,
                    });
                    persistCleanStartState();
                  }
                }
                return {
                  date: currentConfig.today.date,
                  totalMinutes: cleanStartTotalMinutes(),
                  path: paths.sessions,
                };
              }
              case "record_manual_session":
                return fixture.sessionSummary;
              case "load_do_now_candidates":
                return {
                  date: currentConfig.today.date,
                  candidates: cleanStartState
                    ? currentConfig.projects
                        .filter((project) => project.nextStep?.text.trim())
                        .map((project) => ({
                          projectId: project.id,
                          reason: "manualOrder",
                          restartEligible: false,
                        }))
                    : doNowCandidates,
                };
              case "load_next_step_freshness":
                return { staleProjectIds: fixture.staleProjectIds ?? [] };
              case "load_today_notes":
                return { date: currentConfig.today.date, items: currentNotes, path: paths.notes };
              case "save_today_notes":
                currentNotes = (
                  (args.input as { items?: string[] } | undefined)?.items ?? []
                ).slice();
                if (cleanStartState) {
                  cleanStartState.notes = [...currentNotes];
                  persistCleanStartState();
                }
                return { date: currentConfig.today.date, items: currentNotes, path: paths.notes };
              case "load_notes_history":
                return {
                  entries: cleanStartState?.notesHistory ?? fixture.notesHistory,
                  path: paths.notes,
                };
              case "save_notes_for_date":
                return { entries: fixture.notesHistory, path: paths.notes };
              case "load_session_summary":
                return cleanStartSessionSummary();
              case "load_session_entries": {
                const filter = args.filter as
                  | { dateScope?: string; projectId?: string | null; query?: string | null }
                  | undefined;
                const query = filter?.query?.trim().toLocaleLowerCase("ja-JP") ?? "";
                const sourceEntries = cleanStartState?.sessions ?? fixture.sessionEntries.entries;
                const entries = sourceEntries.filter((entry) => {
                  if (filter?.dateScope === "today" && entry.date !== currentConfig.today.date) {
                    return false;
                  }
                  if (filter?.projectId && entry.projectId !== filter.projectId) return false;
                  if (
                    query &&
                    !`${entry.label} ${entry.note}`.toLocaleLowerCase("ja-JP").includes(query)
                  ) {
                    return false;
                  }
                  return true;
                });
                return {
                  ...fixture.sessionEntries,
                  date: currentConfig.today.date,
                  entries: clone(entries),
                };
              }
              case "update_session_entry":
              case "delete_session_entry":
                return fixture.sessionEntries;
              case "load_weekly_review":
                return fixture.weeklyReview;
              case "load_next_step_suggestions":
                return ["資料を1ページ読む"];
              case "list_instruction_roots": {
                const folders = currentConfig.settings.instructionFolders ?? [];
                return folders.map((path) => ({
                  name: path.split(/[\\/]/).filter(Boolean).at(-1) ?? path,
                  path,
                  available: true,
                  readOnly: false,
                }));
              }
              case "list_instruction_directory": {
                const path = String(args.path ?? "");
                const folders = currentConfig.settings.instructionFolders ?? [];
                if (
                  !folders.some((folder) => folder.toLocaleLowerCase() === path.toLocaleLowerCase())
                ) {
                  return [];
                }
                return [
                  {
                    name: "guide.md",
                    path: `${path}\\guide.md`,
                    kind: "file",
                    extension: "md",
                    size: 32,
                    modifiedAt: 1,
                    readOnly: false,
                  },
                  {
                    name: "notes.txt",
                    path: `${path}\\notes.txt`,
                    kind: "file",
                    extension: "txt",
                    size: 18,
                    modifiedAt: 2,
                    readOnly: false,
                  },
                  {
                    name: "reference.html",
                    path: `${path}\\reference.html`,
                    kind: "file",
                    extension: "html",
                    size: 64,
                    modifiedAt: 3,
                    readOnly: true,
                  },
                ];
              }
              case "search_instruction_files": {
                const query = String(args.query ?? "").toLocaleLowerCase();
                const root = (currentConfig.settings.instructionFolders ?? [])[0];
                if (!root) return [];
                return ["guide.md", "notes.txt", "reference.html"]
                  .filter((name) => name.toLocaleLowerCase().includes(query))
                  .map((name) => ({
                    name,
                    path: `${root}\\${name}`,
                    kind: "file",
                    extension: name.split(".").at(-1),
                    size: 32,
                    modifiedAt: 1,
                    readOnly: name.endsWith(".html"),
                  }));
              }
              case "read_instruction": {
                const path = String(args.path ?? "");
                const name = path.split(/[\\/]/).filter(Boolean).at(-1) ?? path;
                const html = name.endsWith(".html");
                const content =
                  fixture.instructionDocuments?.[path] ??
                  (html
                    ? "<!doctype html><html><head><style>body{margin:0;background:rgb(232,240,254);font-family:Arial,sans-serif}main{max-width:640px;margin:0 auto;padding:48px}h1{color:rgb(11,87,208)}</style></head><body><main><h1>HTML手順書</h1><p>読み取り専用の参考資料です。</p></main><script>window.__unsafe=true</script></body></html>"
                    : name.endsWith(".md")
                      ? "# Markdown手順書"
                      : "テキスト手順書");
                return {
                  name,
                  path,
                  content,
                  size: content.length,
                  modifiedAt: 1,
                  extension: name.split(".").at(-1),
                  readOnly: html,
                };
              }
              case "ensure_button_icon_cache":
              case "select_backup_folder":
                return null;
              case "select_backup_zip":
                return cleanStartState?.backup?.path ?? null;
              case "create_software_reset_backup":
                if (!cleanStartState) return { path: resetBackupPath };
                cleanStartState.backup = {
                  path: resetBackupPath,
                  config: clone(currentConfig),
                  sessions: clone(cleanStartState.sessions),
                  notes: clone(cleanStartState.notes),
                  notesHistory: clone(cleanStartState.notesHistory),
                };
                persistCleanStartState();
                return { path: resetBackupPath };
              case "software_reset":
                if (!cleanStartState) return { restartRequested: true };
                currentConfig = freshConfig();
                currentNotes = [];
                cleanStartState.sessions = [];
                cleanStartState.notes = [];
                cleanStartState.notesHistory = [];
                cleanStartState.resetCompleted = true;
                persistCurrentConfig();
                persistCleanStartState();
                return { restartRequested: true };
              case "restore_backup": {
                if (!cleanStartState?.backup) return null;
                currentConfig = clone(cleanStartState.backup.config);
                currentNotes = clone(cleanStartState.backup.notes);
                cleanStartState.sessions = clone(cleanStartState.backup.sessions);
                cleanStartState.notes = clone(cleanStartState.backup.notes);
                cleanStartState.notesHistory = clone(cleanStartState.backup.notesHistory);
                cleanStartState.restoreCount += 1;
                persistCurrentConfig();
                persistCleanStartState();
                return {
                  config: currentConfig,
                  path: paths.config,
                  backupPath: "",
                  error: null,
                  backupError: null,
                  changed: false,
                  saveBlocked: false,
                  morningVictorySuggestion: null,
                };
              }
              case "load_software_reset_recovery": {
                const recovery = softwareResetRecovery;
                softwareResetRecovery = null;
                return recovery;
              }
              case "acknowledge_software_reset_recovery":
              case "prepare_software_reset":
                return null;
              case "choose_instruction_root":
                if (instructionRootDelayed) {
                  return new Promise((resolve) => pendingInstructionRootChoices.push(resolve));
                }
                return instructionRootChoices.shift() ?? null;
              case "execute_actions": {
                const actions = args.actions as Array<{ type: string }>;
                const results = (ok: boolean) =>
                  actions.map((action, index) => ({
                    index,
                    actionType: action.type,
                    ok,
                    message: ok
                      ? "Public demo mock: action not executed"
                      : "Public demo mock: action failed",
                  }));
                if (executeMode === "failure") return results(false);
                if (executeMode === "delayed") {
                  return new Promise((resolve) => {
                    pendingExecuteActions.push(() => resolve(results(true)));
                  });
                }
                return results(true);
              }
              case "open_config_backups":
              case "open_data_folder":
              case "open_instruction_in_default_editor":
              case "open_instruction_folder":
              case "reveal_instruction_in_explorer":
              case "reveal_launcher_item":
                return "Public demo mock: native action not executed";
              case "plugin:window|get_all_windows":
                return [currentWindowLabel];
              case "plugin:event|listen": {
                const event = String(args.event);
                const listenerId = eventId++;
                const listeners = eventListeners.get(event) ?? new Map<number, number>();
                listeners.set(listenerId, Number(args.handler));
                eventListeners.set(event, listeners);
                return listenerId;
              }
              case "plugin:event|unlisten":
                unregisterEventListener(String(args.event), Number(args.eventId));
                return null;
              case "plugin:event|emit":
              case "plugin:event|emit_to":
                dispatchEvent(String(args.event), args.payload);
                return null;
              case "plugin:window|set_skip_taskbar":
              case "plugin:window|set_focusable":
              case "plugin:window|set_always_on_top":
                return null;
              case "plugin:window|is_visible":
                return mainWindowState.visible;
              case "plugin:window|is_minimized":
                return mainWindowState.minimized;
              case "plugin:window|is_focused":
                return mainWindowState.focused;
              case "plugin:window|close":
                mainWindowState = { visible: false, minimized: false, focused: false };
                return null;
              case "plugin:window|show":
              case "plugin:window|set_focus":
              case "plugin:webview|set_focus":
              case "reapply_dashboard_settings":
                if (failReapplyDashboardSettings) {
                  throw new Error("failed to register shortcut: HotKey already registered");
                }
                return null;
              case "suspend_dashboard_shortcuts":
              case "resume_dashboard_shortcuts":
                return null;
              case "focus_dashboard_window":
                mainWindowState = { visible: true, minimized: false, focused: true };
                return null;
              case "enable_main_shell_drop":
              case "start_shell_drop_poc":
              case "stop_shell_drop_poc":
              case "delete_button_icon_cache":
              case "backup_config_before_instruction_change":
                return null;
              case "plugin:window|hide":
                if (failWindowHide) throw new Error("Public demo mock: window hide failed");
                return null;
              case "plugin:window|available_monitors":
                return [];
              case "plugin:window|primary_monitor":
              case "plugin:window|current_monitor":
                return null;
              default:
                return null;
            }
          },
        },
      });
    },
    { fixture, paths: TEST_PATHS, currentWindowLabel, softwareResetRecovery, options },
  );
}
