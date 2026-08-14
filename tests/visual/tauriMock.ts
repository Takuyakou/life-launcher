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
): Promise<void> {
  await page.addInitScript(
    ({ fixture, paths, currentWindowLabel }) => {
      let currentConfig = fixture.config;
      let callbackId = 1;
      let eventId = 1;
      let executeMode: "success" | "failure" | "delayed" = "success";
      let failWindowHide = false;
      let failSaveConfig = false;
      let instructionRootChoices: Array<{
        name: string;
        path: string;
        available: boolean;
        readOnly: boolean;
      }> = [];
      const invokeCalls: Array<{ command: string; args: Record<string, unknown> }> = [];
      const callbacks = new Map<number, (event: unknown) => void>();
      const eventListeners = new Map<string, Map<number, number>>();
      const pendingExecuteActions: Array<() => void> = [];
      let currentNotes = fixture.todayNotes;

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
        setInstructionRootChoices: (choices: typeof instructionRootChoices) => {
          instructionRootChoices = [...choices];
        },
        currentConfig: () => currentConfig,
        resolveExecuteActions: () => {
          for (const resolve of pendingExecuteActions.splice(0)) resolve();
        },
        updateConfig: (nextConfig: typeof currentConfig) => {
          currentConfig = nextConfig;
          dispatchEvent("config-changed");
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
          convertFileSrc: (path: string) => path,
          invoke: async (command: string, args: Record<string, unknown> = {}) => {
            invokeCalls.push({ command, args });
            switch (command) {
              case "load_config":
                return {
                  config: currentConfig,
                  path: paths.config,
                  backupPath: "",
                  error: null,
                  backupError: null,
                  changed: false,
                  morningVictorySuggestion: null,
                };
              case "save_config":
                if (failSaveConfig) throw new Error("Public demo mock: config save failed");
                currentConfig = args.config as typeof currentConfig;
                dispatchEvent("config-changed");
                return { config: currentConfig, path: paths.config };
              case "resolve_drop_item": {
                const input = args.input as { kind: "path" | "url"; value: string; suggestedLabel?: string | null };
                const isUrl = input.kind === "url";
                const label = input.suggestedLabel || (isUrl ? "Dropped bookmark" : input.value.split(/[\\/]/).pop()) || "Dropped item";
                return {
                  label,
                  group: null,
                  iconSource: isUrl ? null : input.value,
                  action: isUrl
                    ? { type: "open_url", payload: { url: input.value } }
                    : { type: input.value.endsWith("\\") ? "open_folder" : "open_file", payload: { path: input.value } },
                  source: input.value,
                };
              }
              case "load_today_session_total":
                return { date: fixture.config.today.date, totalMinutes: fixture.todayMinutes, path: paths.sessions };
              case "record_session":
                return { date: fixture.config.today.date, totalMinutes: fixture.todayMinutes, path: paths.sessions };
              case "record_manual_session":
                return fixture.sessionSummary;
              case "load_do_now_candidates":
                return { date: fixture.config.today.date, candidates: fixture.doNowCandidates };
              case "load_next_step_freshness":
                return { staleProjectIds: [] };
              case "load_today_notes":
                return { date: fixture.config.today.date, items: currentNotes, path: paths.notes };
              case "save_today_notes":
                currentNotes = ((args.input as { items?: string[] } | undefined)?.items ?? []).slice();
                return { date: fixture.config.today.date, items: currentNotes, path: paths.notes };
              case "load_notes_history":
                return { entries: fixture.notesHistory, path: paths.notes };
              case "save_notes_for_date":
                return { entries: fixture.notesHistory, path: paths.notes };
              case "load_session_summary":
                return fixture.sessionSummary;
              case "load_session_entries": {
                const filter = args.filter as { dateScope?: string } | undefined;
                const entries =
                  filter?.dateScope === "today"
                    ? fixture.sessionEntries.entries.filter(
                        (entry) => entry.date === fixture.config.today.date,
                      )
                    : fixture.sessionEntries.entries;
                return { ...fixture.sessionEntries, entries };
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
                if (!folders.some((folder) => folder.toLocaleLowerCase() === path.toLocaleLowerCase())) {
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
                const content = html
                  ? "<!doctype html><html><head><style>body{margin:0;background:rgb(232,240,254);font-family:Arial,sans-serif}main{max-width:640px;margin:0 auto;padding:48px}h1{color:rgb(11,87,208)}</style></head><body><main><h1>HTML手順書</h1><p>読み取り専用の参考資料です。</p></main><script>window.__unsafe=true</script></body></html>"
                  : name.endsWith(".md")
                    ? "# Markdown手順書"
                    : "テキスト手順書";
                return { name, path, content, size: content.length, modifiedAt: 1, extension: name.split(".").at(-1), readOnly: html };
              }
              case "ensure_button_icon_cache":
              case "select_backup_folder":
              case "select_backup_zip":
                return null;
              case "choose_instruction_root":
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
              case "plugin:window|show":
              case "plugin:window|set_focus":
              case "plugin:webview|set_focus":
              case "reapply_dashboard_settings":
              case "suspend_dashboard_shortcuts":
              case "resume_dashboard_shortcuts":
              case "focus_dashboard_window":
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
    { fixture, paths: TEST_PATHS, currentWindowLabel },
  );
}
