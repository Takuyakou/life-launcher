import type { OverlayPageDraft } from "../app/dashboardTypes";
import { OVERLAY_PAGE_NAME_MAX_CHARS } from "../constants";

type OverlayPageDialogProps = {
  draft: OverlayPageDraft;
  nameError: string | null;
  onDraftChange: (next: OverlayPageDraft) => void;
  onSave: () => void;
  onClose: () => void;
};

/** Modal dialog for creating or renaming a dictionary overlay page. */
export function OverlayPageDialog({
  draft,
  nameError,
  onDraftChange,
  onSave,
  onClose,
}: OverlayPageDialogProps) {
  return (
    <div className="modalBackdrop" role="presentation">
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label={draft.mode === "add" ? "辞書ページ追加" : "辞書ページ名変更"}
        aria-modal="true"
        className="dropDialog"
        role="dialog"
        tabIndex={-1}
      >
        <div>
          <p className="eyebrow">Dictionary page</p>
          <h2>{draft.mode === "add" ? "ページを追加" : "名前を変更"}</h2>
        </div>

        <label className="fieldStack">
          <span>ページ名</span>
          <input
            autoFocus
            className="textInput"
            maxLength={OVERLAY_PAGE_NAME_MAX_CHARS}
            onChange={(event) => onDraftChange({ ...draft, name: event.target.value })}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !nameError) {
                onSave();
              }
              if (event.key === "Escape") onClose();
            }}
            placeholder="例: プロジェクト名"
            value={draft.name}
          />
          {draft.name.trim() && nameError && <small className="fieldError">{nameError}</small>}
        </label>

        <div className="dialogActions">
          <button className="secondaryButton" onClick={onClose} type="button">
            キャンセル
          </button>
          <button
            className="primaryButton"
            disabled={Boolean(nameError)}
            onClick={onSave}
            type="button"
          >
            {draft.mode === "add" ? "追加" : "保存"}
          </button>
        </div>
      </section>
    </div>
  );
}
