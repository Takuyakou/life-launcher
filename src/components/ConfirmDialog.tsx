import { useEffect, useId, useRef, useState } from "react";
import { UiIcon } from "./UiIcon";

export type ConfirmDialogTone = "normal" | "warning" | "danger";

export type ConfirmDialogRequest = {
  title: string;
  message?: string;
  subject?: string;
  confirmLabel: string;
  alternateLabel?: string;
  cancelLabel?: string;
  processingLabel?: string;
  alternateProcessingLabel?: string;
  alternateTone?: ConfirmDialogTone;
  tone?: ConfirmDialogTone;
  isProcessing?: boolean;
  closeOnBackdrop?: boolean;
  initialFocus?: "confirm" | "cancel";
  onConfirm: () => void | boolean | Promise<void | boolean>;
  onAlternate?: () => void | boolean | Promise<void | boolean>;
};

type ConfirmDialogProps = ConfirmDialogRequest & {
  open: boolean;
  onCancel: () => void;
};

export function ConfirmDialog({
  open,
  title,
  message,
  subject,
  confirmLabel,
  alternateLabel,
  cancelLabel = "キャンセル",
  processingLabel = "処理中…",
  alternateProcessingLabel = "処理中…",
  alternateTone = "warning",
  tone = "normal",
  isProcessing = false,
  closeOnBackdrop = false,
  initialFocus = "cancel",
  onConfirm,
  onAlternate,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const [internalProcessing, setInternalProcessing] = useState<"confirm" | "alternate" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processing = isProcessing || internalProcessing !== null;

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setErrorMessage(null);
    setInternalProcessing(null);

    const focusFrame = window.requestAnimationFrame(() => {
      const target = initialFocus === "confirm" ? confirmRef.current : cancelRef.current;
      if (target && !target.disabled) {
        target.focus();
      } else {
        dialogRef.current?.focus();
      }
    });

    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, [initialFocus, open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const dialogs = document.querySelectorAll('[role="dialog"][aria-modal="true"]');
      if (dialogs.item(dialogs.length - 1) !== dialogRef.current) return;
      if (event.isComposing || event.keyCode === 229) {
        if (event.key === "Enter" || event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        if (!processing) onCancel();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
      );
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [onCancel, open, processing]);

  if (!open) return null;

  const runAction = async (
    action: "confirm" | "alternate",
    callback: () => void | boolean | Promise<void | boolean>,
  ) => {
    if (processing) return;
    setInternalProcessing(action);
    setErrorMessage(null);
    try {
      const result = await callback();
      if (result === false) {
        setInternalProcessing(null);
        return;
      }
      onCancel();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setInternalProcessing(null);
    }
  };

  const descriptionIds = message || subject || errorMessage ? descriptionId : undefined;

  return (
    <div
      className="modalBackdrop confirmBackdrop"
      onClick={(event) => {
        event.stopPropagation();
        if (event.target === event.currentTarget && closeOnBackdrop && !processing) onCancel();
      }}
      role="presentation"
    >
      <section
        aria-describedby={descriptionIds}
        aria-labelledby={titleId}
        aria-modal="true"
        className={`dropDialog confirmDialog confirmDialog--${tone}`}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="confirmDialogHeader">
          <h2 id={titleId}>{title}</h2>
          <button
            aria-label="確認を閉じる"
            title="閉じる"
            className="confirmDialogClose"
            disabled={processing}
            onClick={onCancel}
            type="button"
          >
            <UiIcon name="close" size={16} />
          </button>
        </div>

        <div className="confirmDialogBody" id={descriptionId}>
          {subject && <strong className="confirmDialogSubject">{subject}</strong>}
          {message && <p>{message}</p>}
          {errorMessage && (
            <p className="confirmDialogError" role="alert">
              {errorMessage}
            </p>
          )}
        </div>

        <div className="dialogActions confirmDialogActions">
          <button
            className={`confirmDialogButton confirmDialogButton--${tone}`}
            disabled={processing}
            onClick={() => void runAction("confirm", onConfirm)}
            ref={confirmRef}
            type="button"
          >
            {internalProcessing === "confirm" || isProcessing ? processingLabel : confirmLabel}
          </button>
          {alternateLabel && onAlternate ? (
            <button
              className={`confirmDialogButton confirmDialogButton--${alternateTone}`}
              disabled={processing}
              onClick={() => void runAction("alternate", onAlternate)}
              type="button"
            >
              {internalProcessing === "alternate" ? alternateProcessingLabel : alternateLabel}
            </button>
          ) : null}
          <button
            className="secondaryButton settingsButton--neutral"
            disabled={processing}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            {cancelLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
