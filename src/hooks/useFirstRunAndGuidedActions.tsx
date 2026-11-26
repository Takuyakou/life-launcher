/* eslint-disable @typescript-eslint/no-explicit-any */
import type { KeyboardEvent } from "react";
import type { LauncherButton, LauncherProject, TodayItem } from "../types";
import { buttonGlyph, resolveProjectColorId } from "../projectIdentity";
import { iconForAction, makeAction } from "../app/helpers";
import { canonicalSourceKey } from "../sourceEdit";
import { IMPORT_PROMPT_FIRST } from "../content/importPrompt";

type Deps = Record<string, any>;

export function useFirstRunAndGuidedActions(deps: Deps) {
  const {
    activeView,
    configRef,
    mainScrollAreaRef,
    persistConfig,
    setFirstRunSaving,
    showToast,
    buttonsById,
    firstRunIdsRef,
    firstRunSaving,
    isTimerOnTodayItem,
    projectsById,
    startDoNowProject,
    startTimer,
    openNextStepEditor,
    beginInboxEdit,
    refreshDoNow,
    setDoNowExcludedProjectId,
    doNowCompletionHold,
    setDoNowPickedProjectId,
    setDoNowCompletionHold,
    buttonIconSources,
    settingsDraft,
    helpGuideOpen,
    confirmDialog,
    softwareResetChoiceOpen,
    softwareResetStage,
    earlyStop,
    manualSessionDraft,
    sessionEditDraft,
    buttonEditDraft,
    projectEditDraft,
    dropDraft,
    importDialogOpen,
    groupDraft,
    groupRenameDraft,
    completionPrompt,
  } = deps;

  const submitFirstRun = async (projectName: string, stepText: string) => {
    const current = configRef.current;
    const ids = firstRunIdsRef.current;
    if (!current || !ids || firstRunSaving) return;
    setFirstRunSaving(true);
    try {
      const now = new Date().toISOString();
      const existing = current.projects.find((project: any) => project.id === ids.projectId);
      const project: LauncherProject =
        existing ?? {
          id: ids.projectId,
          name: projectName,
          colorId: resolveProjectColorId(ids.projectId, undefined),
          nextStep: {
            text: stepText,
            generationId: ids.generationId,
            buttonIds: [],
            defaultTimerMinutes: current.settings.defaultTimerMinutes,
            shortTimerMinutes: current.settings.shortTimerMinutes,
            updatedAt: now,
          },
        };
      const saved = await persistConfig({
        ...current,
        projects: existing ? current.projects : [...current.projects, project],
        settings: {
          ...current.settings,
          firstRunDoneAt: current.settings.firstRunDoneAt ?? now,
        },
      });
      if (!saved) return;
      try {
        startDoNowProject(project, "short");
      } catch (error) {
        showToast(
          "warn",
          `タイマーを始められませんでした: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    } finally {
      setFirstRunSaving(false);
    }
  };
  const laterFirstRun = async () => {
    const current = configRef.current;
    if (!current || firstRunSaving) return;
    setFirstRunSaving(true);
    try {
      const now = new Date().toISOString();
      await persistConfig({
        ...current,
        settings: {
          ...current.settings,
          firstRunDoneAt: current.settings.firstRunDoneAt ?? now,
        },
      });
    } finally {
      setFirstRunSaving(false);
    }
  };
  const copyFirstRunPrompt = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard API is not available");
      await navigator.clipboard.writeText(IMPORT_PROMPT_FIRST);
    } catch (error) {
      showToast("warn", "プロンプトをコピーできませんでした");
      throw error;
    }
  };

  // P10-12 (§8.3): keys on the row itself (not on a button inside it).
  const handleRowShortcutKey = (
    event: KeyboardEvent<HTMLElement>,
    handlers: { activate?: () => void; edit?: () => void; remove?: () => void },
  ): boolean => {
    if (event.target !== event.currentTarget) return false;
    if (event.nativeEvent.isComposing || event.key === "Process") return false;
    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) return false;
    const action =
      event.key === "Enter"
        ? handlers.activate
        : event.key === "F2"
          ? handlers.edit
          : event.key === "Delete"
            ? handlers.remove
            : undefined;
    if (!action) return false;
    event.preventDefault();
    event.stopPropagation();
    action();
    return true;
  };
  const startProjectShort = (project: LauncherProject) => {
    if (!project.nextStep?.text.trim()) return;
    startDoNowProject(project, "short");
  };
  // P10-14 (§4.3): the card's 5分 button and the row's Enter share this one path.
  const startTodayItemShort = (
    item: TodayItem,
    index: number,
    timerSourceId: string,
    minutes: number,
  ) => {
    if (item.done || !item.text.trim()) return;
    if (isTimerOnTodayItem(item, index)) return;
    const project = item.projectId ? projectsById.get(item.projectId) : undefined;
    void startTimer(
      timerSourceId,
      item.projectId && project ? project.name : item.text,
      item.projectId && project ? item.projectId : null,
      (item.buttonIds ?? []).flatMap((buttonId: any) => buttonsById.get(buttonId)?.actions ?? []),
      minutes,
      item.text,
      item.instructionPath,
      item.instructionOpenOnStart,
      "countdown",
      undefined,
      item.sourceKey?.startsWith("project:") && item.expandTimerOnStart === true,
    );
  };
  const editTodayRowItem = (index: number) => {
    const current = configRef.current;
    const item = current?.today.items[index];
    if (!current || !item?.sourceKey) return;
    const key = canonicalSourceKey(current, item.sourceKey);
    if (!key) return;
    const project = current.projects.find((p: any) => `project:${p.id}` === key);
    if (project) openNextStepEditor(project, { origin: "today" });
    else {
      const inboxIndex = current.inbox.findIndex((i: any) => `wishlist:${i.id}` === key);
      if (inboxIndex >= 0) beginInboxEdit(inboxIndex, "today");
    }
  };
  const acknowledgeDoNowCompletion = async () => {
    if (!(await refreshDoNow())) return;
    setDoNowExcludedProjectId(doNowCompletionHold?.projectId ?? null);
    setDoNowPickedProjectId(null);
    setDoNowCompletionHold(null);
    window.requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(".doNowStartPrimary, .doNowEmptyContent button")
        ?.focus({ preventScroll: true });
    });
  };
  const renderButtonIcon = (button: LauncherButton, className: string) => {
    const source = buttonIconSources[button.id];
    if (source) {
      return (
        <img alt="" className={`${className} buttonIconImage`} draggable={false} src={source} />
      );
    }

    return (
      <span className={className}>
        {button.icon ?? iconForAction(button.actions[0] ?? makeAction("open_file"))}
      </span>
    );
  };

  // P10-14e (6): a sidebar row without a picture shows the first letter of its
  // name in a small square. The colour comes from the button id, so it is stable.
  const renderSidebarButtonIcon = (button: LauncherButton) => {
    const source = buttonIconSources[button.id];
    if (source) {
      return (
        <span className="quickButtonIcon">
          <img alt="" draggable={false} src={source} />
        </span>
      );
    }
    return (
      <span
        className="uiLetterIcon"
        data-project-color={resolveProjectColorId(button.id)}
      >
        {buttonGlyph(button)}
      </span>
    );
  };
  const skipLinkBlocked = Boolean(
    settingsDraft ||
    helpGuideOpen ||
    confirmDialog ||
    softwareResetChoiceOpen ||
    softwareResetStage !== "idle" ||
    earlyStop ||
    manualSessionDraft ||
    sessionEditDraft ||
    buttonEditDraft ||
    projectEditDraft ||
    dropDraft ||
    importDialogOpen ||
    groupDraft !== null ||
    groupRenameDraft ||
    completionPrompt,
  );

  const focusSkipTarget = () => {
    const scrollArea = mainScrollAreaRef.current as HTMLElement | null;
    if (!scrollArea) return;
    const target =
      activeView === "records"
        ? scrollArea.querySelector<HTMLElement>("[data-skip-target='records']")
        : (scrollArea.querySelector<HTMLElement>(".doNowStartPrimary:not(:disabled)") ??
          scrollArea.querySelector<HTMLElement>(
            "[data-skip-target='main'] button:not(:disabled)",
          ) ??
          scrollArea.querySelector<HTMLElement>("[data-skip-target='main']"));
    if (!target) return;
    target.focus({ preventScroll: true });
    target.scrollIntoView({ block: "start", inline: "nearest" });
  };

  return {
    submitFirstRun,
    laterFirstRun,
    copyFirstRunPrompt,
    handleRowShortcutKey,
    startProjectShort,
    startTodayItemShort,
    editTodayRowItem,
    acknowledgeDoNowCompletion,
    renderButtonIcon,
    renderSidebarButtonIcon,
    skipLinkBlocked,
    focusSkipTarget,
  };
}
