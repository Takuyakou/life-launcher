/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useCallback } from "react";
import type { ActiveTimer } from "../app/dashboardTypes";
import type { LauncherAction, LauncherProject } from "../types";
import type { TimerMode } from "../timerRuntime";
import { SESSION_MINIMUM_MINUTES, sessionMinutes, timerMetrics } from "../timerRuntime";
import { recordSession, focusDashboardWindow } from "../tauri";
import { earlyCompletionItem } from "../earlyCompletion";
import { timerSourceKey } from "../sourceEdit";
import { formatStartedAt, todayTimerSourceId } from "../app/helpers";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { openInstructionWindow } from "../instructionWindow";

type Deps = Record<string, any>;

export function useTimerRuntime(deps: Deps) {
  const {
    activeTimerRef, config, configRef, finishCompletedTimer,
    finishingTimerRef, plannedCommitRef, setActiveTimer, setCompletionPrompt,
    setExpandedTimerOpen, setNow, showToast, setTodaySessionDate, setTodaySessionMinutes,
    refreshDoNow, refreshTodayActivity, refreshRecords, earlyStopRef, setEarlyStop,
    sourceEditBusyRef, timerStartRequestRef, setDoNowCompletionHold, runActions, returnToMain,
  } = deps;



  const recordTimerSession = useCallback(
    async (timer: ActiveTimer, stoppedAt: number, reason: "manual" | "switch" | "complete") => {
      const minutes = sessionMinutes(timer, stoppedAt);

      if (minutes < SESSION_MINIMUM_MINUTES) {
        if (reason === "manual" || reason === "switch") {
          showToast("warn", "1分未満なので記録しませんでした");
        }
        return true;
      }

      try {
        const response = await recordSession({
          projectId: timer.projectId,
          label: timer.label,
          startedAt: timer.startedAt,
          minutes,
          note: timer.note,
        });
        setTodaySessionMinutes(response.totalMinutes);
        setTodaySessionDate(response.date);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `記録できません: ${message}`);
        return false;
      }
      // A refresh error after append must never cause a second Session append.
      try {
        if (!timer.doNowSnapshot || reason !== "complete") await refreshDoNow();
        await refreshTodayActivity();
        // P97-02 C: 記録画面を開いたままでも集計がすぐ新しくなるように、
        // 記録に成功したあとだけ記録画面のデータを読み直す（記録の処理は増やさない）。
        await refreshRecords();
      } catch {
        showToast("warn", "記録は保存しましたが、表示を更新できませんでした");
      }
      showToast("ok", `${timer.label} ${minutes}分を記録しました`);
      return true;
    },
    [refreshDoNow, refreshTodayActivity, refreshRecords, showToast],
  );


  const finishTimer = useCallback(
    async (requested: ActiveTimer, reason: "manual" | "switch" | "complete" = "manual") => {
      const timer = activeTimerRef.current;
      if (
        !timer ||
        timer.instanceId !== requested.instanceId ||
        finishingTimerRef.current !== null ||
        earlyStopRef.current ||
        (plannedCommitRef.current && reason !== "complete")
      )
        return false;
      const stoppedAt = Date.now();
      const metrics = timerMetrics(timer, stoppedAt);
      if (
        reason === "manual" &&
        timer.mode === "countdown" &&
        timer.targetMinutes !== null &&
        metrics.remainingSeconds !== null &&
        metrics.remainingSeconds <= 0
      ) {
        setCompletionPrompt({
          sourceId: timer.sourceId,
          projectId: timer.projectId,
          targetMinutes: timer.targetMinutes,
          label: timer.label,
          actionText: timer.actionText,
        });
        return false;
      }
      const item =
        reason === "manual"
          ? earlyCompletionItem(configRef.current?.today.items ?? [], timer, metrics.elapsedSeconds)
          : undefined;
      if (item?.sourceKey) {
        const pending = { timer, sourceKey: item.sourceKey.trim(), stoppedAt, recorded: false };
        earlyStopRef.current = pending;
        setEarlyStop(pending);
        const frozen = timer.paused
          ? timer
          : { ...timer, paused: true, pausedStartedAtMs: stoppedAt };
        activeTimerRef.current = frozen;
        setActiveTimer(frozen);
        void focusDashboardWindow().catch(() => undefined);
        return false;
      }
      finishingTimerRef.current = timer.instanceId;
      try {
        const saved = await recordTimerSession(timer, stoppedAt, reason);
        if (saved && activeTimerRef.current?.instanceId === timer.instanceId) {
          activeTimerRef.current = null;
          setActiveTimer(null);
          setCompletionPrompt(null);
        }
        return saved;
      } finally {
        finishingTimerRef.current = null;
      }
    },
    [recordTimerSession],
  );


  const startTimer = useCallback(
    async (
      sourceId: string,
      label: string,
      projectId: string | null,
      actions: LauncherAction[] = [],
      targetMinutes?: number,
      noteOverride?: string,
      instructionPathOverride?: string,
      instructionOpenOnStartOverride?: boolean,
      mode: TimerMode = "countdown",
      doNowProject?: LauncherProject,
      expandOnStart = false,
    ) => {
      const cleanLabel = label.trim();
      if (
        !config ||
        !cleanLabel ||
        (sourceEditBusyRef.current !== null &&
          timerSourceKey(configRef.current ?? config, sourceId) === sourceEditBusyRef.current) ||
        earlyStopRef.current ||
        finishingTimerRef.current !== null ||
        plannedCommitRef.current
      )
        return;

      const requestId = ++timerStartRequestRef.current;
      const previousTimer = activeTimerRef.current;
      if (previousTimer) {
        if (!(await finishTimer(previousTimer, "switch"))) return;
      }

      if (requestId !== timerStartRequestRef.current) return;
      setDoNowCompletionHold(null);
      setCompletionPrompt(null);
      const start = new Date();
      const timerConfig = configRef.current ?? config;
      const directTodayItem = sourceId.startsWith("today:")
        ? timerConfig.today.items.find(
            (item: any, index: any) => todayTimerSourceId(item, index) === sourceId,
          )
        : undefined;
      const sourceGenerationId = sourceId.startsWith("today:")
        ? directTodayItem?.sourceGenerationId
        : projectId !== null && sourceId === projectId
          ? timerConfig.projects.find((project: any) => project.id === projectId)?.nextStep?.generationId
          : undefined;
      const resolvedTargetMinutes =
        mode === "countdown" ? (targetMinutes ?? config.settings.defaultTimerMinutes) : null;
      const fallbackNote =
        projectId !== null
          ? (config.projects.find((project: any) => project.id === projectId)?.nextStep?.text ?? "")
          : cleanLabel;
      const note = noteOverride?.trim() || fallbackNote;
      const startedNextStepText =
        projectId !== null && sourceId === projectId
          ? timerConfig.projects.find((project: any) => project.id === projectId)?.nextStep?.text
          : undefined;
      const actionText =
        (sourceId.startsWith("today:") ? directTodayItem?.text : startedNextStepText)?.trim() ||
        cleanLabel;
      setNow(start.getTime());
      const nextTimer: ActiveTimer = {
        instanceId: requestId,
        sourceId,
        ...(sourceGenerationId ? { sourceGenerationId } : {}),
        projectId,
        label: cleanLabel,
        note,
        actionText,
        ...(doNowProject && {
          doNowSnapshot: {
            projectId: doNowProject.id,
            projectName: doNowProject.name,
            colorId: doNowProject.colorId,
            taskText: doNowProject.nextStep?.text.trim() || note,
          },
        }),
        mode,
        startedAtMs: start.getTime(),
        startedAt: formatStartedAt(start),
        targetMinutes: resolvedTargetMinutes,
        paused: false,
        pausedStartedAtMs: null,
        pausedTotalMs: 0,
      };
      activeTimerRef.current = nextTimer;
      setActiveTimer(nextTimer);
      setExpandedTimerOpen(expandOnStart);

      if (actions.length > 0) {
        void runActions(sourceId, actions);
      }

      const project = projectId ? config.projects.find((item: any) => item.id === projectId) : undefined;
      const instructionPath = instructionPathOverride?.trim() || project?.nextStep?.instructionPath;
      const opensInstruction = instructionPathOverride?.trim()
        ? instructionOpenOnStartOverride !== false
        : project?.nextStep?.instructionOpenOnStart !== false;
      if (instructionPath && opensInstruction) {
        void openInstructionWindow({ path: instructionPath, focus: false }).catch((error) => {
          showToast(
            "warn",
            `タイマーは開始しましたが、手順書を開けません: ${error instanceof Error ? error.message : String(error)}`,
          );
        });
      }
      if (expandOnStart) {
        const mainWindow = getCurrentWindow();
        const [visible, minimized] = await Promise.all([
          mainWindow.isVisible().catch(() => true),
          mainWindow.isMinimized().catch(() => false),
        ]);
        if (!visible || minimized) void returnToMain().catch(() => undefined);
      }
    },
    [config, finishTimer, returnToMain, runActions, showToast, sourceEditBusyRef],
  );


  const finishActiveTimer = (timer: ActiveTimer) => {
    if (activeTimerRef.current?.instanceId !== timer.instanceId) return;
    if (timer.continuedAfterCompletion && timer.doNowSnapshot) finishCompletedTimer();
    else void finishTimer(timer);
  };


  const togglePause = useCallback(() => {
    if (earlyStopRef.current || finishingTimerRef.current !== null || plannedCommitRef.current)
      return;
    // Compute the next state once, outside the state updater: the updater may be called more than
    // once and must not read the clock or write the ref. The display clock (`now`) is aligned to the
    // moment of the press so that rapid pause/resume never leaves it behind pausedTotalMs.
    const timer = activeTimerRef.current;
    // V151-S7: while the planned-time prompt waits, the timer is already stopped at its end.
    if (!timer || timer.expiredAtMs != null) return;
    const current = Date.now();
    const pausedDelta = timer.pausedStartedAtMs ? current - timer.pausedStartedAtMs : 0;
    const nextTimer: ActiveTimer = timer.paused
      ? {
          ...timer,
          paused: false,
          pausedStartedAtMs: null,
          pausedTotalMs: timer.pausedTotalMs + pausedDelta,
        }
      : { ...timer, paused: true, pausedStartedAtMs: current };
    activeTimerRef.current = nextTimer;
    setNow(current);
    setActiveTimer(nextTimer);
  }, []);

  return { recordTimerSession, finishTimer, startTimer, finishActiveTimer, togglePause };
}
