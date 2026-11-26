/* eslint-disable @typescript-eslint/no-explicit-any */
import type { SessionEntryRow } from "../types";
import { formatStartedAt, formatTodayActivityLog, isValidStartedAt } from "../app/helpers";
import { deleteSessionEntry, loadSessionEntries, recordManualSession, updateSessionEntry } from "../tauri";

type Deps = Record<string, any>;

export function useSessionLogs(deps: Deps) {
  const {
    activeView,
    config,
    dailyActivityCopying,
    manualSessionDraft,
    refreshRecords,
    refreshSessions,
    refreshTodayActivity,
    requestConfirmation,
    sessionEditDraft,
    setDailyActivityCopying,
    setSessionSummary,
    setManualSessionDraft,
    setSessionEditDraft,
    setSessionEntries,
    showToast,
  } = deps;

  const copyTodayActivityLog = async () => {
    if (dailyActivityCopying) return;
    setDailyActivityCopying(true);
    try {
      const sessions = await loadSessionEntries({ dateScope: "today" });
      if (!navigator.clipboard?.writeText) {
        throw new Error("clipboard API is not available");
      }
      await navigator.clipboard.writeText(formatTodayActivityLog(sessions.date, sessions.entries));
      showToast("ok", "今日の活動ログをコピーしました");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `今日の活動ログをコピーできません: ${message}`);
    } finally {
      setDailyActivityCopying(false);
    }
  };

  const openManualSessionDialog = () => {
    if (!config) return;
    setManualSessionDraft({
      projectId: config.projects[0]?.id ?? null,
      date: config.today.date,
      startedAt: formatStartedAt(new Date()),
      minutes: String(config.settings.defaultTimerMinutes),
      note: "",
    });
  };

  const saveManualSession = async () => {
    if (!config || !manualSessionDraft) return;
    const minutes = Number.parseInt(manualSessionDraft.minutes, 10);
    if (!Number.isFinite(minutes) || minutes < 1) {
      showToast("warn", "分数は1以上で入力してください");
      return;
    }
    const startedAt = manualSessionDraft.startedAt.trim() || formatStartedAt(new Date());
    if (!isValidStartedAt(startedAt)) {
      showToast("warn", "開始時刻はHH:mm形式で入力してください");
      return;
    }

    const project = manualSessionDraft.projectId
      ? config.projects.find((item: any) => item.id === manualSessionDraft.projectId)
      : null;
    const label = project?.name ?? "手動の実行記録";

    try {
      const summary = await recordManualSession({
        projectId: project?.id ?? null,
        label,
        date: manualSessionDraft.date,
        startedAt,
        minutes,
        note: manualSessionDraft.note,
      });
      setSessionSummary(summary);
      await refreshSessions();
      await refreshTodayActivity();
      if (activeView === "records") {
        await refreshRecords();
      }
      setManualSessionDraft(null);
      showToast("ok", "実行記録を追加しました");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `実行記録を追加できません: ${message}`);
    }
  };

  const openSessionEditDialog = (session: SessionEntryRow) => {
    setSessionEditDraft({
      rowKey: session.rowKey,
      projectId: session.projectId ?? null,
      label: session.label,
      date: session.date,
      startedAt: session.startedAt,
      minutes: String(session.minutes),
      note: session.note,
    });
  };

  const saveSessionEdit = async () => {
    if (!sessionEditDraft) return;
    const minutes = Number.parseInt(sessionEditDraft.minutes, 10);
    if (!sessionEditDraft.date.trim()) {
      showToast("warn", "日付を入力してください");
      return;
    }
    if (!sessionEditDraft.label.trim()) {
      showToast("warn", "ラベルを入力してください");
      return;
    }
    if (!sessionEditDraft.startedAt.trim()) {
      showToast("warn", "開始時刻を入力してください");
      return;
    }
    if (!Number.isFinite(minutes) || minutes < 1) {
      showToast("warn", "分数は1以上で入力してください");
      return;
    }

    try {
      const response = await updateSessionEntry({
        rowKey: sessionEditDraft.rowKey,
        projectId: sessionEditDraft.projectId,
        label: sessionEditDraft.label.trim(),
        date: sessionEditDraft.date,
        startedAt: sessionEditDraft.startedAt.trim(),
        minutes,
        note: sessionEditDraft.note,
      });
      setSessionEntries(response);
      await refreshTodayActivity();
      if (response.warning) {
        showToast("warn", response.warning);
      }
      await refreshSessions();
      await refreshRecords();
      setSessionEditDraft(null);
      showToast("ok", "実行記録を更新しました");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `実行記録を更新できません: ${message}`);
    }
  };

  const confirmSessionDelete = async (session: SessionEntryRow) => {
    try {
      const response = await deleteSessionEntry({ rowKey: session.rowKey });
      setSessionEntries(response);
      await refreshTodayActivity();
      if (response.warning) {
        showToast("warn", response.warning);
      }
      await refreshSessions();
      await refreshRecords();
      showToast("neutral", "実行記録を削除しました");
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      showToast("error", `実行記録を削除できません: ${message}`);
      return false;
    }
  };

  const requestSessionDelete = (session: SessionEntryRow) => {
    requestConfirmation({
      title: "実行記録を削除しますか？",
      subject: `${session.date} ${session.startedAt} / ${session.label} / ${session.minutes}分`,
      message: "この操作は元に戻せません。",
      confirmLabel: "削除する",
      processingLabel: "削除しています…",
      tone: "danger",
      onConfirm: () => confirmSessionDelete(session),
    });
  };

  return {
    copyTodayActivityLog,
    openManualSessionDialog,
    saveManualSession,
    openSessionEditDialog,
    saveSessionEdit,
    confirmSessionDelete,
    requestSessionDelete,
  };
}
