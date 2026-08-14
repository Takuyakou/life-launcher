import { useEffect, useId, useRef, useState } from "react";
import { UiIcon } from "./UiIcon";

export type ConfirmDialogTone = "normal" | "warning" | "danger";

export type ConfirmDialogRequest = {
  title: string;
  message?: string;
  subject?: string;
  confirmLabel: string;
  cancelLabel?: string;
  processingLabel?: string;
  tone?: ConfirmDialogTone;
  isProcessing?: boolean;
  closeOnBackdrop?: boolean;
  initialFocus?: "confirm" | "cancel";
  onConfirm: () => void | boolean | Promise<void | boolean>;
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
  cancelLabel = "キャンセル",
  processingLabel = "処理中…",
  tone = "normal",
  isProcessing = false,
  closeOnBackdrop = false,
  initialFocus = "cancel",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const [internalProcessing, setInternalProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processing = isProcessing || internalProcessing;

  useEffect(() => {
    if (!open) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setErrorMessage(null);
    setInternalProcessing(false);

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

  const runConfirm = async () => {
    if (processing) return;
    setInternalProcessing(true);
    setErrorMessage(null);
    try {
      const result = await onConfirm();
      if (result === false) {
        setInternalProcessing(false);
        return;
      }
      onCancel();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : String(error));
      setInternalProcessing(false);
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
            aria-label="確認を閉じる" title="閉じる"
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
            className="secondaryButton settingsButton--neutral"
            disabled={processing}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            {cancelLabel}
          </button>
          <button
            className={`confirmDialogButton confirmDialogButton--${tone}`}
            disabled={processing}
            onClick={() => void runConfirm()}
            ref={confirmRef}
            type="button"
          >
            {processing ? processingLabel : confirmLabel}
          </button>
        </div>
      </section>
    </div>
  );
}
