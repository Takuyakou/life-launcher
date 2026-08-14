import { useEffect, useId, useRef } from "react";
import { UiIcon } from "./UiIcon";

type InstructionUnsavedDialogProps = {
  open: boolean;
  saving: boolean;
  error: string | null;
  onContinueEditing: () => void;
  onDiscard: () => void;
  onSave: () => void;
};

export function InstructionUnsavedDialog({
  open,
  saving,
  error,
  onContinueEditing,
  onDiscard,
  onSave,
}: InstructionUnsavedDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => continueRef.current?.focus());
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!saving) onContinueEditing();
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
      );
      if (!focusable.length) {
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
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown, true);
      opener?.focus();
    };
  }, [onContinueEditing, open, saving]);

  if (!open) return null;

  return (
    <div className="modalBackdrop instructionUnsavedBackdrop" role="presentation">
      <section
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        aria-modal="true"
        className="dropDialog instructionUnsavedDialog"
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="confirmDialogHeader">
          <h2 id={titleId}>変更を保存しますか？</h2>
          <button
            aria-label="編集を続ける" title="閉じる"
            className="confirmDialogClose"
            disabled={saving}
            onClick={onContinueEditing}
            type="button"
          >
            <UiIcon name="close" size={16} />
          </button>
        </div>
        <div className="confirmDialogBody" id={descriptionId}>
          <p>保存していない手順書の編集内容があります。</p>
          {error ? <p className="confirmDialogError" role="alert">{error}</p> : null}
        </div>
        <div className="instructionUnsavedActions">
          <button
            className="secondaryButton settingsButton--neutral"
            disabled={saving}
            onClick={onContinueEditing}
            ref={continueRef}
            type="button"
          >
            編集を続ける
          </button>
          <button
            className="secondaryButton instructionDiscardButton"
            disabled={saving}
            onClick={onDiscard}
            type="button"
          >
            破棄して続ける
          </button>
          <button className="primaryButton" disabled={saving} onClick={onSave} type="button">
            {saving ? "保存中…" : "保存して続ける"}
          </button>
        </div>
      </section>
    </div>
  );
}
