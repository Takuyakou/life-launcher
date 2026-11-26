/* eslint-disable @typescript-eslint/no-explicit-any */
import type { AppConfig, LauncherNextStep } from "../types";
import type { ActiveTimer } from "../app/dashboardTypes";
import { DEFAULT_EXTEND_TIMER_MINUTES } from "../constants";
import { normalizeTimerMinutes, todayEntries, todaySourceKey } from "../app/helpers";
import { sessionMinutes } from "../timerRuntime";
import { findTodayEntryForTimer, sameSourceGeneration } from "../timerSource";
import { completeTodayItemAndPrepareSource, completeWishlistAfterToday, type TodayCompletionSource } from "../completionFollowup";
import { createStableId } from "../app/helpers";

type Deps = Record<string, any>;

export function useTimerCompletion(deps: Deps) {
  const {
    activeTimer, activeTimerRef, config, configRef, earlyStopRef, finishingTimerRef,
    plannedCommitRef, setActiveTimer, setCompletionPrompt, setCompletionFollowup,
    setCompletionResumeSaving, setEarlyStop, setDoNowCompletionHold,
    showToast, persistConfig, requestConfirmation, finishTimer,
    recordTimerSession, setNow,
    showCompletionFeedback, setDoNowExcludedProjectId, setDoNowPickedProjectId,
    setDoNowCompletionSaving, setEarlyStopSaving, queuedCompletionFollowupsRef,
    completionFollowupTimerRef, confirmDialogRef, completionExtendDraft, completionPrompt,
    completionResumeSavingRef, completionCanEditResume, completionProject, timerResumeDraft,
    nextStepReviewBusy, setNextStepReviewBusy, setStaleNextStepProjectIds,
  } = deps;


  const queueCompletionFollowup = (
    key: string,
    source: TodayCompletionSource | null,
    text: string,
    previousNextStep?: LauncherNextStep,
    minutes?: number,
    startedAt?: string,
    endedAt?: string,
  ) => {
    if (!source || queuedCompletionFollowupsRef.current.has(key)) return;
    // P10-09 (§8.1): a Next Step completion always asks where to start next, even when the
    // Project has no wishlist items yet.
    if (source.kind === "nextStep" && !source.isCurrentSnapshot) return;
    queuedCompletionFollowupsRef.current.add(key);
    if (completionFollowupTimerRef.current !== null) {
      window.clearTimeout(completionFollowupTimerRef.current);
    }
    const showFollowup = () => {
      completionFollowupTimerRef.current = null;
      if (source.kind === "nextStep") {
        // The Project must still be there and its Next Step must still be empty.
        const current = configRef.current;
        const project = current?.projects.find((item: any) => item.id === source.projectId);
        if (project && !project.nextStep?.text.trim()) {
          setCompletionFollowup({ key, source, text, minutes, previousNextStep, startedAt, endedAt });
        }
        return;
      }
      if (confirmDialogRef.current) {
        completionFollowupTimerRef.current = window.setTimeout(showFollowup, 250);
        return;
      }
      requestConfirmation({
        title: "この「やりたいこと」はどうしますか？",
        subject: `「${text}」`,
        message: "完了にすると、やりたいことから外します。今日の3件と実行記録は残ります。",
        confirmLabel: "完了にする",
        cancelLabel: "まだやりたい",
        onConfirm: async () => {
          const current = configRef.current;
          if (!current) return false;
          const next = completeWishlistAfterToday(
            current,
            source,
            text,
            new Date().toISOString(),
            createStableId(),
          );
          if (!next) {
            showToast("warn", "元のやりたいことが見つかりません");
            return false;
          }
          return persistConfig(next);
        },
      });
    };
    completionFollowupTimerRef.current = window.setTimeout(showFollowup, 1100);
  };


  const showTimerCompletionFeedback = (
    timer: ActiveTimer,
    current: AppConfig,
    nextItems: AppConfig["today"]["items"],
    completedSourceKey: string | null,
    stoppedAt: number,
  ) => {
    const key = `timer:${current.today.date}:${timer.instanceId}`;
    if (timer.doNowSnapshot && (timer.continuedAfterCompletion || !completedSourceKey)) {
      setDoNowCompletionHold({
        ...timer.doNowSnapshot,
        date: current.today.date,
        minutes: sessionMinutes(timer, stoppedAt),
      });
    }
    if (completedSourceKey && timer.doNowSnapshot) {
      setDoNowExcludedProjectId(timer.doNowSnapshot.projectId);
      setDoNowPickedProjectId(null);
    }
    if (completedSourceKey && nextItems.length === 3 && nextItems.every((item: any) => item.done)) {
      showCompletionFeedback({ key, kind: "todayAll", label: timer.note || timer.label });
      return;
    }
    if (completedSourceKey) {
      showCompletionFeedback({
        key,
        kind: "today",
        label: timer.note || timer.label,
        sourceKey: completedSourceKey,
      });
      return;
    }
  };


  const resolveEarlyStop = async (complete: boolean) => {
    const pending = earlyStopRef.current;
    if (
      !pending ||
      finishingTimerRef.current !== null ||
      activeTimerRef.current?.instanceId !== pending.timer.instanceId
    )
      return false;
    finishingTimerRef.current = pending.timer.instanceId;
    setEarlyStopSaving(true);
    try {
      if (!pending.recorded) {
        if (!(await recordTimerSession(pending.timer, pending.stoppedAt, "manual"))) return false;
        pending.recorded = true;
      }
      // Session is durable before updating Today3; a failed config write rolls back only Today3.
      if (complete) {
        const current = configRef.current;
        if (current) {
          const completedItem = current.today.items.find(
            (item: any, index: any) => todaySourceKey(item, index) === pending.sourceKey && !item.done,
          );
          const prepared = completeTodayItemAndPrepareSource(
            current,
            pending.sourceKey,
            new Date().toISOString(),
            createStableId(),
          );
          const completedSourceKey = prepared.config === current ? null : pending.sourceKey;
          const saved = prepared.config === current ? true : await persistConfig(prepared.config);
          if (saved && completedSourceKey) {
            showTimerCompletionFeedback(
              pending.timer,
              current,
              prepared.config.today.items,
              completedSourceKey,
              pending.stoppedAt,
            );
            queueCompletionFollowup(
              `timer:${current.today.date}:${pending.timer.instanceId}:${completedSourceKey}`,
              prepared.source,
              completedItem?.text ?? pending.timer.note ?? pending.timer.label,
              prepared.source?.projectId
                ? current.projects.find((project: any) => project.id === prepared.source!.projectId)
                    ?.nextStep
                : undefined,
              sessionMinutes(pending.timer, pending.stoppedAt),
              new Date(pending.timer.startedAtMs).toISOString(),
              new Date(pending.stoppedAt).toISOString(),
            );
          }
        }
      }
      earlyStopRef.current = null;
      setEarlyStop(null);
      activeTimerRef.current = null;
      setActiveTimer(null);
      return true;
    } finally {
      finishingTimerRef.current = null;
      setEarlyStopSaving(false);
    }
  };


  // V163-B4: an empty or invalid entry falls back to the setting (or 15), then stays in 1..240.
  const completionExtendMinutes = (() => {
    const fallback = config?.settings.extendTimerMinutes ?? DEFAULT_EXTEND_TIMER_MINUTES;
    const parsed = Number.parseInt(completionExtendDraft, 10);
    return normalizeTimerMinutes(Number.isFinite(parsed) && parsed > 0 ? parsed : fallback);
  })();


  const continueCompletedTimer = () => {
    if (
      !completionPrompt ||
      completionResumeSavingRef.current ||
      plannedCommitRef.current ||
      finishingTimerRef.current !== null
    )
      return;
    if (!activeTimer || activeTimerRef.current?.instanceId !== activeTimer.instanceId) return;
    setCompletionPrompt(null);
    const continuedAt = Date.now();
    setNow(continuedAt);
    setActiveTimer((timer: any) => {
      if (
        !timer ||
        timer.sourceId !== completionPrompt.sourceId ||
        timer.targetMinutes !== completionPrompt.targetMinutes
      ) {
        return timer;
      }

      // V151-S7: the time spent on the prompt is not counted; the extension starts from the press.
      const waitedMs =
        timer.expiredAtMs != null ? Math.max(0, continuedAt - timer.expiredAtMs) : 0;
      const extended = {
        ...timer,
        continuedAfterCompletion: true,
        targetMinutes:
          (timer.targetMinutes ?? completionPrompt.targetMinutes) + completionExtendMinutes,
        pausedTotalMs: timer.pausedTotalMs + waitedMs,
        expiredAtMs: null,
      };
      activeTimerRef.current = extended;
      return extended;
    });
  };


  const finishCompletedTimer = () => {
    if (plannedCommitRef.current || finishingTimerRef.current !== null || earlyStopRef.current)
      return;
    const completedTimer = activeTimerRef.current;
    if (!completedTimer || activeTimer?.instanceId !== completedTimer.instanceId) return;
    if (
      !completedTimer.continuedAfterCompletion &&
      (!completionPrompt || completedTimer.sourceId !== completionPrompt.sourceId)
    ) {
      setCompletionPrompt(null);
      return;
    }

    plannedCommitRef.current = true;
    const stoppedAt = Date.now();
    if (completedTimer.doNowSnapshot && completedTimer.continuedAfterCompletion && configRef.current) {
      setDoNowCompletionHold({
        ...completedTimer.doNowSnapshot,
        date: configRef.current.today.date,
        minutes: sessionMinutes(completedTimer, stoppedAt),
      });
      setDoNowCompletionSaving(true);
    }
    let completed = false;
    void finishTimer(completedTimer, "complete")
      .then(async (finished: any) => {
        if (!finished) return false;
        const current = configRef.current;
        if (!current) return true;
        const completedEntry = findTodayEntryForTimer(
          todayEntries(current.today.items),
          completedTimer,
        );
        const prepared = completedEntry
          ? completeTodayItemAndPrepareSource(
              current,
              completedEntry.sourceKey,
              new Date().toISOString(),
              createStableId(),
            )
          : { config: current, source: null };
        if (prepared.config !== current && !(await persistConfig(prepared.config))) return false;

        showTimerCompletionFeedback(
          completedTimer,
          current,
          prepared.config.today.items,
          completedEntry?.sourceKey ?? null,
          stoppedAt,
        );
        if (completedEntry) {
          queueCompletionFollowup(
            `timer:${current.today.date}:${completedTimer.instanceId}:${completedEntry.sourceKey}`,
            prepared.source,
            completedEntry.item.text,
            prepared.source?.projectId
              ? current.projects.find((project: any) => project.id === prepared.source!.projectId)
                  ?.nextStep
              : undefined,
            sessionMinutes(completedTimer, stoppedAt),
            new Date(completedTimer.startedAtMs).toISOString(),
            new Date(stoppedAt).toISOString(),
          );
        }
        completed = true;
        return true;
      })
      .finally(() => {
        if (completedTimer.doNowSnapshot && completedTimer.continuedAfterCompletion) {
          setDoNowCompletionSaving(false);
          if (!completed) setDoNowCompletionHold(null);
        }
        plannedCommitRef.current = false;
      });
  };

  const submitCompletedTimer = async () => {
    if (
      completionResumeSavingRef.current ||
      plannedCommitRef.current ||
      finishingTimerRef.current !== null ||
      earlyStopRef.current
    ) {
      return;
    }
    if (completionCanEditResume && completionProject?.nextStep) {
      const trimmed = timerResumeDraft.trim();
      const currentResume = completionProject.nextStep.resumeNote?.trim() ?? "";
      if (trimmed !== currentResume) {
        const currentConfig = configRef.current;
        const liveProject = currentConfig?.projects.find(
          (project: any) => project.id === completionProject.id,
        );
        if (
          currentConfig &&
          liveProject?.nextStep &&
          sameSourceGeneration(
            liveProject.nextStep.generationId,
            completionProject.nextStep.generationId,
          )
        ) {
          completionResumeSavingRef.current = true;
          setCompletionResumeSaving(true);
          try {
            const nextStep: LauncherNextStep = { ...liveProject.nextStep };
            if (trimmed) {
              nextStep.resumeNote = trimmed;
            } else {
              delete nextStep.resumeNote;
            }
            const nextConfig: AppConfig = {
              ...currentConfig,
              projects: currentConfig.projects.map((project: any) =>
                project.id === liveProject.id ? { ...project, nextStep } : project,
              ),
            };
            await persistConfig(nextConfig, false, {
              errorToastMessage: "次はここからを保存できませんでした",
            });
          } finally {
            completionResumeSavingRef.current = false;
            setCompletionResumeSaving(false);
          }
        }
      }
    }
    finishCompletedTimer();
  };


  const markNextStepReviewed = async (projectId: string) => {
    if (!config) return false;
    // P10-05: one press at a time — the button is disabled while the save runs.
    if (nextStepReviewBusy === projectId) return false;
    setNextStepReviewBusy(projectId);
    const reviewedAt = new Date().toISOString();
    const saved = await persistConfig({
      ...config,
      projects: config.projects.map((project: any) =>
        project.id === projectId && project.nextStep
          ? { ...project, nextStep: { ...project.nextStep, reviewedAt } }
          : project,
      ),
    });
    if (saved) {
      setStaleNextStepProjectIds((ids: any) => ids.filter((id: any) => id !== projectId));
    }
    setNextStepReviewBusy(null);
    return saved;
  };

  return {
    queueCompletionFollowup, showTimerCompletionFeedback, resolveEarlyStop,
    completionExtendMinutes, continueCompletedTimer, finishCompletedTimer,
    submitCompletedTimer, markNextStepReviewed,
  };
}
