import { useCallback, useEffect, useRef, useState } from "react";
import { IMPORT_PROMPT_FIRST, IMPORT_PROMPT_REPEAT } from "../content/importPrompt";
import { buildImportCurrentState } from "../importCurrentState";
import { extractImportJson } from "../importJson";
import { commitImport, previewImport } from "../tauri";
import type { AppConfig, ImportCommitResponse, ImportPreviewResponse } from "../types";

type ImportDialogProps = {
  open: boolean;
  initialText: string;
  initialError?: string | null;
  config: AppConfig | null;
  onClose: () => void;
  onImported: (response: ImportCommitResponse) => void;
  onNotify: (tone: "ok" | "warn" | "error", message: string) => void;
};

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const runPreview = useCallback(async (source: string) => {
    const extracted = extractImportJson(source);
    if (!extracted.ok) {
      setError(extracted.error);
      setPreview(null);
      setJson("");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await previewImport(extracted.json);
      setJson(extracted.json);
      setPreview(response);
    } catch (previewError) {
      setPreview(null);
      setJson("");
      setError(errorMessage(previewError));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setText(initialText);
    setJson("");
    setPreview(null);
    setError(initialError ?? null);
    setBusy(false);
    if (initialText.trim() && !initialError) {
      void runPreview(initialText);
    }
    window.requestAnimationFrame(() => textareaRef.current?.focus());
  }, [open, initialText, initialError, runPreview]);

  if (!open) return null;

  const counts = preview?.preview.counts;
  const importable = counts
    ? counts.newProjects + counts.existingProjects + counts.nextSteps + counts.wishes
    : 0;
  const currentState = buildImportCurrentState(config);

  const copyPrompt = async (prompt: string, message: string) => {
    try {
      await navigator.clipboard.writeText(prompt);
      onNotify("ok", message);
    } catch {
      onNotify("warn", "プロンプトをコピーできませんでした");
    }
  };

  const copyFirstPrompt = () =>
    copyPrompt(IMPORT_PROMPT_FIRST, "はじめて用のプロンプトをコピーしました");

  const copyRepeatPrompt = () =>
    copyPrompt(
      IMPORT_PROMPT_REPEAT.replace("{CURRENT_STATE}", currentState),
      "今の内容を付けてコピーしました",
    );

  const commit = async () => {
    if (!preview || !json || busy) return;
    if (importable === 0) {
      setError("取り込める項目がありません");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const response = await commitImport(json, preview.fingerprint);
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
          <label className="fieldStack">
            <span>ChatGPT や Claude の答え（JSON）</span>
            <textarea
              aria-label="取り込みのJSON"
              className="textInput importTextarea"
              onChange={(event) => {
                setText(event.target.value);
                setPreview(null);
                setJson("");
                setError(null);
              }}
              placeholder='{"lifeLauncherImport": 1, "projects": [], "wishes": []}'
              ref={textareaRef}
              value={text}
            />
          </label>

          <div className="importPromptActions">
            <button
              className="secondaryButton"
              disabled={busy}
              onClick={() => void copyFirstPrompt()}
              type="button"
            >
              はじめて用をコピー
            </button>
            <div className="importPromptRepeat">
              <button
                className="secondaryButton"
                disabled={busy}
                onClick={() => void copyRepeatPrompt()}
                type="button"
              >
                今の内容を付けてコピー
              </button>
              <small className="quietText quietText--small">
                コピーする文には、今のプロジェクト名・目標・次の一手・やりたいことが入ります。
              </small>
            </div>
          </div>

          <div className="importDialogActions">
            <button
              className="secondaryButton"
              disabled={busy || !text.trim()}
              onClick={() => void runPreview(text)}
              type="button"
            >
              {busy ? "読み込み中…" : "プレビュー"}
            </button>
          </div>

          {error && (
            <p className="formError" role="alert">
              {error}
            </p>
          )}

          {preview && counts && (
            <div className="importPreview">
              <p className="importSummary">
                新規プロジェクト {counts.newProjects}件 / 既存プロジェクト {counts.existingProjects}件 /
                次の一手 {counts.nextSteps}件 / やりたいこと {counts.wishes}件
              </p>

              {preview.preview.newProjects.length > 0 && (
                <section className="importPreviewSection">
                  <h3>新しく足すプロジェクト</h3>
                  <ul className="importPreviewList">
                    {preview.preview.newProjects.map((project) => (
                      <li key={project.name}>
                        <strong>{project.name}</strong>
                        {project.color ? `（${project.color}）` : ""}
                        {project.goal ? ` — ${project.goal}` : ""}
                        {project.nextStep ? ` / 次の一手: ${project.nextStep}` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {preview.preview.existingProjects.length > 0 && (
                <section className="importPreviewSection">
                  <h3>すでにあるプロジェクト</h3>
                  <ul className="importPreviewList">
                    {preview.preview.existingProjects.map((project) => (
                      <li key={project.name}>
                        <strong>{project.name}</strong>
                        {project.fillColor ? ` / 色を${project.fillColor}で補います` : ""}
                        {project.fillGoal ? ` / 目標を「${project.fillGoal}」で補います` : ""}
                        {project.nextStepText
                          ? project.nextStepAction === "insert"
                            ? ` / 次の一手「${project.nextStepText}」を入れます`
                            : ` / 次の一手「${project.nextStepText}」はやりたいことに入れます`
                          : ""}
                        {project.nextStepReason ? `（${project.nextStepReason}）` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {preview.preview.nextSteps.length > 0 && (
                <section className="importPreviewSection">
                  <h3>次の一手</h3>
                  <ul className="importPreviewList">
                    {preview.preview.nextSteps.map((step, index) => (
                      <li key={`${step.project}-${index}`}>
                        {step.project}: {step.text}
                        {step.action === "wishlist" ? "（やりたいことへ）" : ""}
                        {step.reason ? ` — ${step.reason}` : ""}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

              {preview.preview.wishes.length > 0 && (
                <section className="importPreviewSection">
                  <h3>足すやりたいこと</h3>
                  <ul className="importPreviewList">
                    {preview.preview.wishes.map((wish, index) => (
                      <li key={`${wish.text}-${index}`}>
                        {wish.project ? `${wish.project}: ` : ""}
                        {wish.text}
                      </li>
                    ))}
                  </ul>
                </section>
              )}

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

              {importable === 0 && (
                <p className="formError">取り込める項目がありません。内容を確かめてください。</p>
              )}
            </div>
          )}
        </div>

        <footer className="importDialogFooter">
          <button className="dangerButton importDialogCancelButton" disabled={busy} onClick={onClose} type="button">
            キャンセル
          </button>
          <button
            className="secondaryButton importDialogCommitButton"
            disabled={busy || !preview || importable === 0}
            onClick={() => void commit()}
            type="button"
          >
            {busy ? "取り込んでいます…" : "取り込む"}
          </button>
        </footer>
      </section>
    </div>
  );
}
