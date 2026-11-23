import type { LauncherProject } from "../types";
import { UiIcon } from "./UiIcon";

type InboxAddDialogProps = {
  draft: string;
  projectId: string;
  projects: LauncherProject[];
  error: string | null;
  saving: boolean;
  onDraftChange: (value: string) => void;
  onProjectIdChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
};

/** Modal dialog for adding a wishlist ("やりたいこと") item. */
export function InboxAddDialog({
  draft,
  projectId,
  projects,
  error,
  saving,
  onDraftChange,
  onProjectIdChange,
  onSubmit,
  onClose,
}: InboxAddDialogProps) {
  return (
    <div className="modalBackdrop" role="presentation">
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label="やりたいことを追加"
        aria-modal="true"
        className="dropDialog wishlistAddDialog"
        role="dialog"
        tabIndex={-1}
      >
        <div className="wishlistAddHeader modalTitleRow">
          <div>
            <p className="eyebrow">Wishlist</p>
            <h2>やりたいことを追加</h2>
            <p>あとでやりたいことを、ひとまず残しておきます。</p>
          </div>
          <button
            aria-label="やりたいことを追加を閉じる"
            className="iconButton"
            disabled={saving}
            onClick={onClose}
            title="閉じる"
            type="button"
          >
            <UiIcon name="close" size={16} />
          </button>
        </div>

        <form
          className="wishlistAddForm"
          onSubmit={(event) => {
            event.preventDefault();
            onSubmit();
          }}
        >
          <label className="fieldStack">
            <span>やりたいこと</span>
            <input autoComplete="off"
              aria-describedby={
                error ? "wishlist-add-hint wishlist-add-error" : "wishlist-add-hint"
              }
              aria-invalid={Boolean(error)}
              autoFocus
              className="textInput"
              maxLength={120}
              onChange={(event) => onDraftChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && event.nativeEvent.isComposing) {
                  event.preventDefault();
                }
              }}
              placeholder="気になっていた本を読む"
              value={draft}
            />
            <small className="fieldHint" id="wishlist-add-hint">
              120文字まで
            </small>
            {error && (
              <small className="fieldError" id="wishlist-add-error" role="alert">
                {error}
              </small>
            )}
          </label>

          <label className="fieldStack">
            <span>プロジェクト（任意）</span>
            <select
              className="textInput"
              onChange={(event) => onProjectIdChange(event.target.value)}
              value={projectId}
            >
              <option value="">プロジェクトなし</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </label>

          <div className="dialogActions formDialogActions">
            <button
              className="primaryButton"
              disabled={saving || !draft.trim()}
              type="submit"
            >
              {saving ? "保存中…" : "保存"}
            </button>
            <button
              className="secondaryButton dialogCancelButton"
              disabled={saving}
              onClick={onClose}
              type="button"
            >
              キャンセル
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}
