import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { UiIcon } from "./UiIcon";
import type { ExitPresenceAttributes } from "./ExitPresence";

export type ConfirmDialogTone = "normal" | "positive" | "warning" | "danger";

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
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
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
  initialFocus = "cancel",
  onConfirm,
  onAlternate,
  onCancel,
  exitProps,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement | null>(null);
  const cancelRef = useRef<HTMLButtonElement | null>(null);
  const confirmRef = useRef<HTMLButtonElement | null>(null);
  const [internalProcessing, setInternalProcessing] = useState<"confirm" | "alternate" | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const processing = isProcessing || internalProcessing !== null;

  // V164 (E1): the opener is read in the layout pass, before the effects of the other dialogs
  // move the focus, so 「開いた元へ戻す」 still names the control that opened this confirm.
  const openerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }, []);

  useEffect(() => {
    if (!open) return;

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
      // V164 (E1): the surface stays mounted while the close motion runs, so the focus may already
      // be back inside the dialog under it. Only restore the opener when the close left it nowhere.
      const active = document.activeElement;
      if (!active || active === document.body || active === document.documentElement) {
        openerRef.current?.focus();
      }
      openerRef.current = null;
    };
  }, [initialFocus, open]);

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      const dialogs = document.querySelectorAll(
        '[role="dialog"][aria-modal="true"]:not([data-exiting="true"]):not([data-exiting="true"] *)',
      );
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
    <div className="modalBackdrop confirmBackdrop" role="presentation" {...exitProps}>
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
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
