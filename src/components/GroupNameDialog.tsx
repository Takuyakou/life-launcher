type GroupNameDialogProps = {
  mode: "add" | "rename";
  value: string;
  onChange: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
};

/** Modal dialog for adding or renaming a sidebar group without altering dialog focus structure. */
export function GroupNameDialog({
  mode,
  value,
  onChange,
  onConfirm,
  onCancel,
}: GroupNameDialogProps) {
  const isAdd = mode === "add";

  return (
    <div className="modalBackdrop" role="presentation">
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label={isAdd ? "グループ追加" : "グループ名変更"}
        aria-modal="true"
        className="dropDialog"
        role="dialog"
        tabIndex={-1}
      >
        <div>
          <p className="eyebrow">Group</p>
          <h2>{isAdd ? "グループを追加" : "名前を変更"}</h2>
        </div>

        <label className="fieldStack">
          <span>グループ名</span>
          <input autoComplete="off"
            autoFocus
            className="textInput"
            maxLength={40}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                onConfirm();
              }
              if (event.key === "Escape") {
                onCancel();
              }
            }}
            placeholder={isAdd ? "例: 仕事" : undefined}
            value={value}
          />
        </label>

        <div className="dialogActions formDialogActions">
          <button
            className="primaryButton"
            disabled={!value.trim()}
            onClick={onConfirm}
            type="button"
          >
            {isAdd ? "追加" : "保存"}
          </button>
          <button
            className="secondaryButton dialogCancelButton"
            onClick={onCancel}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}
