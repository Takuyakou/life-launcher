import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CopyButton } from "./CopyButton";
import { IMPORT_PROMPT_FIRST, IMPORT_PROMPT_REPEAT } from "../content/importPrompt";
import { buildImportCurrentState } from "../importCurrentState";
import { extractImportJson } from "../importJson";
import { commitImport, previewImport } from "../tauri";
import type {
  AppConfig,
  ImportCommitResponse,
  ImportPreview,
  ImportPreviewResponse,
} from "../types";

type ImportDialogProps = {
  open: boolean;
  initialText: string;
  initialError?: string | null;
  config: AppConfig | null;
  onClose: () => void;
  onImported: (response: ImportCommitResponse) => void;
  onNotify: (tone: "ok" | "warn" | "error", message: string) => void;
};

/** How long after the last change the pasted text is read (a paste is read at once). */
const AUTO_READ_DELAY_MS = 300;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

type ImportRow = {
  key: string;
  kind: "step" | "wish";
  text: string;
  minutes: number | null;
  shortMinutes: number | null;
  /** Why a next step goes to the wishlist. */
  reason: string | null;
};

type ImportGroup = {
  /** `p{i}`; null for the 「プロジェクトなし」 frame (its rows are excluded one by one). */
  key: string | null;
  name: string;
  isNew: boolean;
  color: string | null;
  note: string | null;
  rows: ImportRow[];
};

function buildGroups(preview: ImportPreview, config: AppConfig | null): ImportGroup[] {
  const groups: ImportGroup[] = [];
  const rowsFor = (projectKey: string): ImportRow[] => {
    const rows: ImportRow[] = [];
    const step = preview.nextSteps.find((item) => item.projectKey === projectKey);
    if (step) {
      if (step.action === "insert") {
        rows.push({
          key: step.key,
          kind: "step",
          text: step.text,
          minutes: step.minutes,
          shortMinutes: step.shortMinutes,
          reason: null,
        });
      } else if (preview.wishes.some((wish) => wish.key === step.key)) {
        // A next step that goes to the wishlist is one row (it has the step's key).
        rows.push({
          key: step.key,
          kind: "wish",
          text: step.text,
          minutes: null,
          shortMinutes: null,
          reason: step.reason,
        });
      }
    }
    for (const wish of preview.wishes) {
      if (wish.projectKey !== projectKey || wish.key === step?.key) continue;
      rows.push({
        key: wish.key,
        kind: "wish",
        text: wish.text,
        minutes: null,
        shortMinutes: null,
        reason: null,
      });
    }
    return rows;
  };

  for (const project of preview.newProjects) {
    groups.push({
      key: project.key,
      name: project.name,
      isNew: true,
      color: project.color,
      note: project.goal,
      rows: rowsFor(project.key),
    });
  }
  for (const project of preview.existingProjects) {
    const current = config?.projects.find((candidate) => candidate.name === project.name);
    const notes = [
      project.fillGoal ? `目標を「${project.fillGoal}」で補います` : null,
      project.fillColor ? "色を補います" : null,
    ].filter(Boolean);
    groups.push({
      key: project.key,
      name: project.name,
      isNew: false,
      color: current?.colorId ?? project.fillColor,
      note: notes.length > 0 ? notes.join("・") : null,
      rows: rowsFor(project.key),
    });
  }
  const loose = preview.wishes.filter((wish) => wish.projectKey === null);
  if (loose.length > 0) {
    groups.push({
      key: null,
      name: "プロジェクトなし",
      isNew: false,
      color: null,
      note: null,
      rows: loose.map((wish) => ({
        key: wish.key,
        kind: "wish" as const,
        text: wish.text,
        minutes: null,
        shortMinutes: null,
        reason: null,
      })),
    });
  }
  return groups;
}

/** What one frame imports: its ticked rows, or 1 for a new project with no rows that stays ticked. */
function groupCount(
  group: ImportGroup,
  projectOff: boolean,
  rowOff: ReadonlySet<string>,
): number {
  if (group.key !== null && projectOff) return 0;
  if (group.rows.length === 0) return group.isNew ? 1 : 0;
  return group.rows.filter((row) => !rowOff.has(row.key)).length;
}

function timeLabel(row: ImportRow): string | null {
  if (row.kind !== "step" || row.minutes === null) return null;
  return row.shortMinutes !== null
    ? `${row.minutes}分・短く ${row.shortMinutes}分`
    : `${row.minutes}分`;
}

export function ImportDialog({
  open,
  initialText,
  initialError,
  config,
  onClose,
  onImported,
  onNotify,
}: ImportDialogProps) {
  const [text, setText] = useState("");
  const [json, setJson] = useState("");
  const [preview, setPreview] = useState<ImportPreviewResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [reading, setReading] = useState(false);
  /** After a successful read the paste box folds into a one-line note; 貼り直す opens it again. */
  const [folded, setFolded] = useState(false);
  const [projectOff, setProjectOff] = useState<ReadonlySet<string>>(new Set());
  const [rowOff, setRowOff] = useState<ReadonlySet<string>>(new Set());
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const repasteRef = useRef<HTMLButtonElement | null>(null);
  const readTimerRef = useRef<number | null>(null);
  const readSequenceRef = useRef(0);

  const clearReadTimer = useCallback(() => {
    if (readTimerRef.current !== null) {
      window.clearTimeout(readTimerRef.current);
      readTimerRef.current = null;
    }
  }, []);

  const runPreview = useCallback(async (source: string) => {
    const sequence = (readSequenceRef.current += 1);
    const extracted = extractImportJson(source);
    if (!extracted.ok) {
      setError(extracted.error);
      setPreview(null);
      setJson("");
      setFolded(false);
      setReading(false);
      return;
    }
    setBusy(true);
    setReading(true);
    setError(null);
    try {
      const response = await previewImport(extracted.json);
      if (sequence !== readSequenceRef.current) return;
      setJson(extracted.json);
      setPreview(response);
      setProjectOff(new Set());
      setRowOff(new Set());
      setFolded(true);
      window.requestAnimationFrame(() => repasteRef.current?.focus());
    } catch (previewError) {
      if (sequence !== readSequenceRef.current) return;
      setPreview(null);
      setJson("");
      setFolded(false);
      setError(errorMessage(previewError));
    } finally {
      if (sequence === readSequenceRef.current) {
        setBusy(false);
        setReading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    clearReadTimer();
    readSequenceRef.current += 1;
    setText(initialText);
    setJson("");
    setPreview(null);
    setError(initialError ?? null);
    setBusy(false);
    setReading(false);
    setFolded(false);
    setProjectOff(new Set());
    setRowOff(new Set());
    if (initialText.trim() && !initialError) {
      void runPreview(initialText);
    } else {
      window.requestAnimationFrame(() => textareaRef.current?.focus());
    }
    return clearReadTimer;
  }, [open, initialText, initialError, runPreview, clearReadTimer]);

  const groups = useMemo(
    () => (preview ? buildGroups(preview.preview, config) : []),
    [preview, config],
  );
  const total = groups.reduce((sum, group) => sum + groupCount(group, false, new Set()), 0);
  const selected = groups.reduce(
    (sum, group) => sum + groupCount(group, group.key !== null && projectOff.has(group.key), rowOff),
    0,
  );

  if (!open) return null;

  const currentState = buildImportCurrentState(config);

  const copyPrompt = async (prompt: string) => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard API is not available");
      await navigator.clipboard.writeText(prompt);
    } catch (error) {
      onNotify("warn", "プロンプトをコピーできませんでした");
      throw error;
    }
  };

  const copyFirstPrompt = () => copyPrompt(IMPORT_PROMPT_FIRST);

  const copyRepeatPrompt = () =>
    copyPrompt(IMPORT_PROMPT_REPEAT.replace("{CURRENT_STATE}", currentState));

  const scheduleRead = (value: string, immediately: boolean) => {
    clearReadTimer();
    readSequenceRef.current += 1;
    setPreview(null);
    setJson("");
    setError(null);
    setReading(false);
    if (!value.trim()) return;
    if (immediately) {
      void runPreview(value);
      return;
    }
    readTimerRef.current = window.setTimeout(() => {
      readTimerRef.current = null;
      void runPreview(value);
    }, AUTO_READ_DELAY_MS);
  };

  const repaste = () => {
    setFolded(false);
    setPreview(null);
    setJson("");
    setProjectOff(new Set());
    setRowOff(new Set());
    setError(null);
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  };

  const excludedKeys = (): string[] => {
    const keys: string[] = [];
    for (const group of groups) {
      if (group.key !== null && projectOff.has(group.key)) {
        keys.push(group.key);
        continue;
      }
      for (const row of group.rows) if (rowOff.has(row.key)) keys.push(row.key);
    }
    return keys;
  };

  const toggleRow = (key: string) =>
    setRowOff((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleProject = (key: string) =>
    setProjectOff((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const toggleLooseGroup = (group: ImportGroup) => {
    const allOn = group.rows.every((row) => !rowOff.has(row.key));
    setRowOff((previous) => {
      const next = new Set(previous);
      for (const row of group.rows) {
        if (allOn) next.add(row.key);
        else next.delete(row.key);
      }
      return next;
    });
  };

  const commit = async () => {
    if (!preview || !json || busy) return;
    if (selected === 0) {
      setError("取り込める項目がありません");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await commitImport(json, preview.fingerprint, excludedKeys());
      onImported(response);
    } catch (commitError) {
      const message = errorMessage(commitError);
      if (message.startsWith("stale:")) {
        await runPreview(json);
        setError(message.slice("stale:".length));
      } else {
        setError(message);
      }
    } finally {
      setBusy(false);
    }
  };

  const read = preview !== null;
  const counts = preview?.preview.counts;
  const insertedSteps = preview?.preview.nextSteps.filter((step) => step.action === "insert") ?? [];
  const projectCount = (counts?.newProjects ?? 0) + (counts?.existingProjects ?? 0);

  return (
    <div
      className="modalBackdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
      role="presentation"
    >
      <section
        aria-label="まとめて取り込む"
        aria-modal="true"
        className="importDialog"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) {
            event.preventDefault();
            onClose();
          }
        }}
        role="dialog"
      >
        <header className="importDialogHeader">
          <div>
            <h2>まとめて取り込む</h2>
            <p className="quietText quietText--small">
              プロジェクト・次の一手・やりたいことを、まとめて足します。今あるものは上書きしません。
            </p>
          </div>
          <button
            aria-label="まとめて取り込むを閉じる"
            className="iconButton"
            disabled={busy}
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </header>

        <div className="importDialogBody">
          <section className="importStep">
            <span className="importStepNumber" data-state={read ? "done" : "active"}>
              1
            </span>
            <div className="importStepContent">
              <div className="importStepHead">
                <h3>AI に聞く</h3>
                <span>コピーして、ChatGPT や Claude にそのまま貼って送ります。</span>
              </div>
              <div className="importPromptActions">
                <CopyButton
                  className="importPromptCopy"
                  disabled={busy}
                  label="初回作成用をコピー"
                  onCopy={copyFirstPrompt}
                />
                <CopyButton
                  className="importPromptCopy"
                  disabled={busy}
                  label="追加・見直し用をコピー"
                  onCopy={copyRepeatPrompt}
                />
              </div>
            </div>
          </section>

          <section className="importStep">
            <span className="importStepNumber" data-state={read ? "done" : "pending"}>
              2
            </span>
            <div className="importStepContent">
              <div className="importStepHead">
                <h3>答えを貼る</h3>
                {reading ? (
                  <span>読み込み中…</span>
                ) : read ? null : (
                  <span>貼ると、取り込む中身が下に出ます。</span>
                )}
              </div>
              {folded && read ? (
                <div className="importReadLine">
                  <strong>✓ 読み取りました</strong>
                  <span>
                    プロジェクト {projectCount}・次の一手 {insertedSteps.length}・やりたいこと{" "}
                    {counts?.wishes ?? 0}
                  </span>
                  <button
                    className="sectionGhostButton"
                    disabled={busy}
                    onClick={repaste}
                    ref={repasteRef}
                    type="button"
                  >
                    貼り直す
                  </button>
                </div>
              ) : (
                <textarea
                  aria-label="取り込みのJSON"
                  className="textInput importTextarea"
                  onChange={(event) => {
                    setText(event.target.value);
                    scheduleRead(event.target.value, false);
                  }}
                  onPaste={() => {
                    // The pasted text is in the box after this event: read it without waiting.
                    window.setTimeout(() => {
                      const value = textareaRef.current?.value ?? "";
                      setText(value);
                      scheduleRead(value, true);
                    }, 0);
                  }}
                  placeholder="AI の答えを、ここに貼ります(Ctrl+V)。JSON のファイルは、メインの画面に落としても読めます。"
                  ref={textareaRef}
                  value={text}
                />
              )}
              {error && (
                <p className="formError" role="alert">
                  {error}
                </p>
              )}
            </div>
          </section>

          <section className="importStep">
            <span className="importStepNumber" data-state={read ? "active" : "pending"}>
              3
            </span>
            <div className="importStepContent">
              <div className="importStepHead">
                <h3>取り込むものを選ぶ</h3>
                <span>
                  {read
                    ? "いらないものは、チェックを外します。今あるものは上書きしません。"
                    : "答えを貼ると、ここに出ます。"}
                </span>
              </div>
              {preview && counts && (
                <div className="importPreview">
                  {groups.map((group) => {
                    const off = group.key !== null && projectOff.has(group.key);
                    const looseAllOn = group.rows.every((row) => !rowOff.has(row.key));
                    return (
                      <section
                        className="importGroup"
                        data-project-color={group.color ?? undefined}
                        key={group.key ?? "none"}
                      >
                        <div className="importGroupHead">
                          <input
                            aria-label={`「${group.name}」を取り込む`}
                            checked={group.key === null ? looseAllOn : !off}
                            disabled={busy}
                            onChange={() =>
                              group.key === null ? toggleLooseGroup(group) : toggleProject(group.key)
                            }
                            type="checkbox"
                          />
                          <span aria-hidden="true" className="importGroupDot" />
                          <strong className="importGroupName">{group.name}</strong>
                          {group.key !== null && (
                            <span
                              className={
                                group.isNew
                                  ? "importGroupTag importGroupTag--new"
                                  : "importGroupTag"
                              }
                            >
                              {group.isNew ? "新しいプロジェクト" : "今あるプロジェクト"}
                            </span>
                          )}
                          {group.note && <span className="importGroupGoal">{group.note}</span>}
                        </div>
                        {group.rows.map((row) => {
                          const rowOffNow = rowOff.has(row.key) || off;
                          const time = timeLabel(row);
                          return (
                            <label
                              className={rowOffNow ? "importItem importItem--off" : "importItem"}
                              key={row.key}
                            >
                              <input
                                aria-label={`「${row.text}」を取り込む`}
                                checked={!rowOff.has(row.key)}
                                disabled={busy || off}
                                onChange={() => toggleRow(row.key)}
                                type="checkbox"
                              />
                              <span
                                className={
                                  row.kind === "step"
                                    ? "importItemKind importItemKind--step"
                                    : "importItemKind"
                                }
                              >
                                {row.kind === "step" ? "次の一手" : "やりたいこと"}
                              </span>
                              <span className="importItemText">
                                <span className="importItemTitle">{row.text}</span>
                                {row.reason && <span className="importItemNote">{row.reason}</span>}
                              </span>
                              {time && <span className="importItemMinutes">{time}</span>}
                            </label>
                          );
                        })}
                      </section>
                    );
                  })}

                  {preview.preview.merged.length > 0 && (
                    <section className="importPreviewSection">
                      <h3>同じ名前でまとめたプロジェクト</h3>
                      <ul className="importPreviewList">
                        {preview.preview.merged.map((name, index) => (
                          <li key={`${name}-${index}`}>{name}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {preview.preview.skipped.length > 0 && (
                    <section className="importPreviewSection">
                      <h3>足さないもの</h3>
                      <ul className="importPreviewList">
                        {preview.preview.skipped.map((message, index) => (
                          <li key={`${message}-${index}`}>{message}</li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {preview.preview.rejected.length > 0 && (
                    <section className="importPreviewSection importPreviewSection--rejected">
                      <h3>取り込めない項目</h3>
                      <ul className="importPreviewList">
                        {preview.preview.rejected.map((item) => (
                          <li key={`${item.path}-${item.reason}`}>
                            {item.path}: {item.reason}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {preview.preview.ignored.length > 0 && (
                    <details className="importPreviewSection">
                      <summary>使わない項目（{preview.preview.ignored.length}件）</summary>
                      <ul className="importPreviewList">
                        {preview.preview.ignored.map((path) => (
                          <li key={path}>{path}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  {total === 0 && (
                    <p className="formError">取り込める項目がありません。内容を確かめてください。</p>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <footer className="importDialogFooter">
          {read && selected < total && (
            <span className="importFooterCount">
              {total}件のうち {selected}件を取り込みます
            </span>
          )}
          <button
            className="secondaryButton importDialogCommitButton"
            disabled={busy || !preview || selected === 0}
            onClick={() => void commit()}
            type="button"
          >
            {busy && !reading ? "取り込んでいます…" : read ? `取り込む(${selected}件)` : "取り込む"}
          </button>
          <button className="dangerButton importDialogCancelButton" disabled={busy} onClick={onClose} type="button">
            キャンセル
          </button>
        </footer>
      </section>
    </div>
  );
}
