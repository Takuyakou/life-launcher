import type { CSSProperties, FocusEvent as ReactFocusEvent } from "react";
import type { Toast } from "../app/dashboardTypes";
import { UiIcon } from "./UiIcon";

type ToastStackProps = {
  toasts: Toast[];
  onPause: (id: number, reason: "pointer" | "focus" | "document", paused: boolean) => void;
  onDismiss: (id: number) => void;
  onAction: (id: number) => void;
};

/** Renders visible notifications with pause-on-hover/focus and Undo action support. */
export function ToastStack({ toasts, onPause, onDismiss, onAction }: ToastStackProps) {
  if (!toasts.some((toast) => !toast.queued)) return null;

  return (
    <div aria-live="polite" aria-relevant="additions text" className="toastStack">
      {toasts
        .filter((toast) => !toast.queued)
        .map((toast) => (
          <div
            className={`toast toast--${toast.tone}${toast.leaving ? " toast--leaving" : ""}${toast.paused ? " toast--paused" : ""}`}
            data-toast-id={toast.id}
            key={toast.id}
            onBlurCapture={(event: ReactFocusEvent<HTMLDivElement>) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                onPause(toast.id, "focus", false);
              }
            }}
            onFocusCapture={() => onPause(toast.id, "focus", true)}
            onPointerEnter={() => onPause(toast.id, "pointer", true)}
            onPointerLeave={() => onPause(toast.id, "pointer", false)}
            role="status"
            style={{ "--toast-duration": `${toast.durationMs}ms` } as CSSProperties}
          >
            <span aria-hidden="true" className="toastAccent" />
            <span aria-hidden="true" className="toastIconBadge">
              <UiIcon
                name={
                  toast.tone === "ok"
                    ? "play"
                    : toast.tone === "error" || toast.tone === "danger"
                      ? "close"
                      : "clock"
                }
                size={16}
              />
            </span>
            <div className="toastCopy">
              <strong>{toast.message}</strong>
              {toast.detail && <span>{toast.detail}</span>}
            </div>
            {toast.onAction && (
              <button
                className="toastAction"
                disabled={toast.actionPending}
                onClick={() => onAction(toast.id)}
                type="button"
              >
                <UiIcon name="back" size={16} />
                {toast.actionPending ? "処理中…" : (toast.actionLabel ?? "元に戻す")}
              </button>
            )}
            <button
              aria-label="通知を閉じる"
              className="toastClose"
              onClick={() => onDismiss(toast.id)}
              type="button"
            >
              <UiIcon name="close" size={16} />
            </button>
            <span aria-hidden="true" className="toastLifetime" hidden={toast.tone === "error"} />
          </div>
        ))}
    </div>
  );
}
