import { useCallback, useEffect, useRef, useState } from "react";
import { TOAST_TIMEOUT_MS, TOAST_UNDO_TIMEOUT_MS } from "../constants";
import type {
  Toast,
  ToastOptions,
  ToastTimerState,
  ToastTone,
} from "../app/dashboardTypes";

/**
 * Manages toast notification queueing, pause-on-hover/focus/visibility timers,
 * serialized undo action execution, and the Ctrl+Z shortcut.
 */
export function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastsRef = useRef<Toast[]>([]);
  toastsRef.current = toasts;
  const toastIdRef = useRef(0);
  const toastTimersRef = useRef<Map<number, ToastTimerState>>(new Map());
  const toastActionLocksRef = useRef<Set<number>>(new Set());

  const dismissToast = useCallback((id: number) => {
    const timers = toastTimersRef.current.get(id);
    if (timers?.dismissTimer !== null && timers?.dismissTimer !== undefined) {
      window.clearTimeout(timers.dismissTimer);
      timers.dismissTimer = null;
    }
    setToasts((current) =>
      current.map((toast) => (toast.id === id ? { ...toast, leaving: true } : toast)),
    );
    const removeTimer = window.setTimeout(() => {
      toastTimersRef.current.delete(id);
      toastActionLocksRef.current.delete(id);
      setToasts((current) => {
        const remaining = current.filter((toast) => toast.id !== id);
        const visibleCount = remaining.filter((toast) => !toast.queued && !toast.leaving).length;
        let available = Math.max(0, 3 - visibleCount);
        return remaining.map((toast) => {
          if (!toast.queued || available <= 0) return toast;
          available -= 1;
          return { ...toast, queued: false };
        });
      });
    }, 180);
    if (timers) timers.removeTimer = removeTimer;
  }, []);

  useEffect(() => {
    for (const toast of toasts) {
      if (toast.queued || toast.leaving || toastTimersRef.current.has(toast.id)) continue;
      const timerState: ToastTimerState = {
        dismissTimer: null,
        removeTimer: null,
        remainingMs: toast.durationMs,
        startedAt: Date.now(),
        pointerInside: false,
        focusInside: false,
        documentHidden: document.hidden,
      };
      // P10-12 (D15): failures stay until their × is pressed; they never lose a time line.
      const sticky = toast.tone === "error";
      if (!document.hidden && !sticky) {
        timerState.dismissTimer = window.setTimeout(() => dismissToast(toast.id), toast.durationMs);
      } else {
        timerState.startedAt = null;
      }
      toastTimersRef.current.set(toast.id, timerState);
      if (document.hidden) {
        setToasts((current) =>
          current.map((item) => (item.id === toast.id ? { ...item, paused: true } : item)),
        );
      }
    }
  }, [dismissToast, toasts]);

  const pauseToast = useCallback(
    (id: number, reason: "pointer" | "focus" | "document", paused: boolean) => {
      const timers = toastTimersRef.current.get(id);
      if (!timers) return;
      if (reason === "pointer") timers.pointerInside = paused;
      if (reason === "focus") timers.focusInside = paused;
      if (reason === "document") timers.documentHidden = paused;
      const shouldPause = timers.pointerInside || timers.focusInside || timers.documentHidden;
      if (shouldPause && timers.startedAt !== null) {
        timers.remainingMs = Math.max(0, timers.remainingMs - (Date.now() - timers.startedAt));
        timers.startedAt = null;
        if (timers.dismissTimer !== null) window.clearTimeout(timers.dismissTimer);
        timers.dismissTimer = null;
      } else if (!shouldPause && timers.startedAt === null && timers.remainingMs > 0) {
        timers.startedAt = Date.now();
        timers.dismissTimer = window.setTimeout(() => dismissToast(id), timers.remainingMs);
      }
      setToasts((current) =>
        current.map((toast) => (toast.id === id ? { ...toast, paused: shouldPause } : toast)),
      );
    },
    [dismissToast],
  );

  useEffect(() => {
    const handleVisibility = () => {
      toastTimersRef.current.forEach((_timers, id) => pauseToast(id, "document", document.hidden));
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [pauseToast]);

  useEffect(() => {
    const toastTimers = toastTimersRef.current;
    return () => {
      toastTimers.forEach(({ dismissTimer, removeTimer }) => {
        if (dismissTimer !== null) window.clearTimeout(dismissTimer);
        if (removeTimer !== null) window.clearTimeout(removeTimer);
      });
      toastTimers.clear();
    };
  }, []);

  const showToast = useCallback((tone: ToastTone, message: string, options: ToastOptions = {}) => {
    toastIdRef.current += 1;
    const id = toastIdRef.current;
    const durationMs =
      options.durationMs ??
      (options.onAction ? TOAST_UNDO_TIMEOUT_MS : tone === "error" ? 8000 : TOAST_TIMEOUT_MS);
    setToasts((current) => {
      if (
        !options.onAction &&
        current.some(
          (toast) =>
            !toast.leaving && !toast.onAction && toast.tone === tone && toast.message === message,
        )
      ) {
        return current;
      }
      const visibleCount = current.filter((toast) => !toast.queued && !toast.leaving).length;
      const next: Toast = {
        id,
        tone,
        message,
        detail: options.detail,
        actionLabel: options.actionLabel,
        onAction: options.onAction,
        actionPending: false,
        durationMs,
        queued: visibleCount >= 3,
        paused: false,
        leaving: false,
      };
      const combined = [...current, next];
      if (combined.length <= 24) return combined;
      const removableIndex = combined.findIndex((toast) => toast.queued && !toast.onAction);
      return removableIndex >= 0
        ? combined.filter((_, index) => index !== removableIndex)
        : combined;
    });
    return id;
  }, []);

  const runToastAction = useCallback(
    async (id: number) => {
      const toast = toastsRef.current.find((item) => item.id === id);
      if (!toast?.onAction || toastActionLocksRef.current.has(id)) return;
      toastActionLocksRef.current.add(id);
      pauseToast(id, "focus", true);
      setToasts((current) =>
        current.map((item) => (item.id === id ? { ...item, actionPending: true } : item)),
      );
      const succeeded = await toast.onAction();
      if (succeeded) {
        dismissToast(id);
        showToast("neutral", "元に戻しました");
        return;
      }
      toastActionLocksRef.current.delete(id);
      setToasts((current) =>
        current.map((item) => (item.id === id ? { ...item, actionPending: false } : item)),
      );
      window.requestAnimationFrame(() => {
        const toastElement = document.querySelector<HTMLElement>(`[data-toast-id="${id}"]`);
        pauseToast(id, "focus", Boolean(toastElement?.contains(document.activeElement)));
      });
    },
    [dismissToast, pauseToast, showToast],
  );

  // P10-12 (D15): Ctrl+Z presses the newest visible "元に戻す" toast. No badge (D30).
  useEffect(() => {
    const onUndoKey = (event: globalThis.KeyboardEvent) => {
      if (
        event.defaultPrevented ||
        event.isComposing ||
        event.key.toLowerCase() !== "z" ||
        !event.ctrlKey ||
        event.altKey ||
        event.metaKey ||
        event.shiftKey
      ) {
        return;
      }
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (document.querySelector('[aria-modal="true"], [role="menu"]')) return;
      const newest = [...toastsRef.current]
        .filter((toast) => toast.onAction && !toast.leaving && !toast.actionPending)
        .sort((left, right) => right.id - left.id)[0];
      if (!newest) return;
      event.preventDefault();
      void runToastAction(newest.id);
    };
    document.addEventListener("keydown", onUndoKey);
    return () => document.removeEventListener("keydown", onUndoKey);
  }, [runToastAction]);

  return { toasts, showToast, dismissToast, pauseToast, runToastAction };
}
