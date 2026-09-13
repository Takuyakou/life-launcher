import { useEffect, useMemo, useRef, useState } from "react";
import { UiIcon } from "./components/UiIcon";

export type InstructionChoice = { path: string; label: string };

type Props = {
  choices: InstructionChoice[];
  error: string | null;
  loading: boolean;
  onChange: (path: string) => void;
  onRetry: () => void;
  selectedPath: string;
};

export function InstructionPicker({ choices, error, loading, onChange, onRetry, selectedPath }: Props) {
  const [open, setOpen] = useState(false);
  const [draftPath, setDraftPath] = useState("");
  const [query, setQuery] = useState("");
  const openerRef = useRef<HTMLButtonElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const selectedChoice = choices.find((choice) => choice.path === selectedPath);
  const rows = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    const available = selectedPath && !choices.some((choice) => choice.path === selectedPath)
      ? [{ path: selectedPath, label: "現在の設定（登録フォルダ内に見つかりません）" }, ...choices]
      : choices;
    return normalized
      ? available.filter((choice) => choice.label.toLocaleLowerCase().includes(normalized))
      : available;
  }, [choices, query, selectedPath]);

  const close = () => {
    setOpen(false);
    window.requestAnimationFrame(() => openerRef.current?.focus());
  };
  const show = () => {
    setDraftPath(selectedPath);
    setQuery("");
    setOpen(true);
  };

  useEffect(() => {
    if (open) window.requestAnimationFrame(() => searchRef.current?.focus());
  }, [open]);

  return (
    <div className="instructionPicker">
      <div className="instructionPickerHeader">
        <div>
          <strong>手順書</strong>
          <span>開始時に確認したいMarkdown・TXT・HTMLなど</span>
        </div>
        <button className="secondaryButton instructionPickerOpen" disabled={loading} onClick={show} ref={openerRef} type="button">
          {loading ? "読み込み中…" : "手順書を選ぶ"}
        </button>
      </div>
      <div className="instructionPickerSelection">
        <UiIcon name="fileText" size={16} />
        <span title={selectedChoice?.label ?? selectedPath}>
          {selectedPath ? (selectedChoice?.label ?? "現在の設定") : "手順書は選択されていません"}
        </span>
        {selectedPath ? (
          <button aria-label="手順書の選択を解除" onClick={() => onChange("")} type="button">
            <UiIcon name="close" size={16} />
          </button>
        ) : null}
      </div>
      {error ? (
        <div className="projectInstructionLoadError" role="status">
          <small>一覧を読み込めません: {error}</small>
          <button onClick={onRetry} type="button">再読み込み</button>
        </div>
      ) : null}
      {open ? (
        <div className="modalBackdrop startEnvironmentBackdrop" onClick={(event) => {
          if (event.target === event.currentTarget) close();
        }} role="presentation">
          <section
            aria-label="手順書を選ぶ"
            aria-modal="true"
            className="dropDialog instructionPickerDialog"
            onKeyDown={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              close();
            }}
            role="dialog"
          >
            <header className="startEnvironmentDialogHeader">
              <div><p className="eyebrow">Instruction</p><h2>手順書を選ぶ</h2></div>
              <span className="startEnvironmentCount">{draftPath ? "1 / 1" : "0 / 1"}</span>
            </header>
            <label className="startEnvironmentSearch">
              <span className="srOnly">手順書を検索</span>
              <input
                className="textInput"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="名前・フォルダから検索"
                ref={searchRef}
                type="search"
                value={query}
              />
            </label>
            <div className="startEnvironmentOptions app-scrollbar" role="listbox">
              <button
                aria-selected={!draftPath}
                className={!draftPath ? "startEnvironmentOption startEnvironmentOption--selected" : "startEnvironmentOption"}
                onClick={() => setDraftPath("")}
                role="option"
                type="button"
              >
                <UiIcon name="close" size={18} />
                <span className="startEnvironmentOptionCopy"><strong>手順書なし</strong></span>
                <span aria-hidden="true" className="startEnvironmentOptionState">{!draftPath ? "✓" : ""}</span>
              </button>
              {rows.map((choice) => {
                const selected = draftPath === choice.path;
                return (
                  <button
                    aria-selected={selected}
                    className={selected ? "startEnvironmentOption startEnvironmentOption--selected" : "startEnvironmentOption"}
                    key={choice.path}
                    onClick={() => setDraftPath(choice.path)}
                    role="option"
                    type="button"
                  >
                    <UiIcon name="fileText" size={18} />
                    <span className="startEnvironmentOptionCopy"><strong>{choice.label}</strong></span>
                    <span aria-hidden="true" className="startEnvironmentOptionState">{selected ? "✓" : ""}</span>
                  </button>
                );
              })}
              {rows.length === 0 ? <p className="startEnvironmentNoResults">該当する手順書はありません</p> : null}
            </div>
            <div className="dialogActions formDialogActions">
              <button className="primaryButton" onClick={() => { onChange(draftPath); close(); }} type="button">選択を反映</button>
              <button className="secondaryButton dialogCancelButton" onClick={close} type="button">キャンセル</button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
