import { emit, listen } from "@tauri-apps/api/event";
import { isTauri } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { MouseEvent } from "react";
import { UiIcon } from "./UiIcon";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  INSTRUCTION_ALWAYS_ON_TOP_KEY,
  INSTRUCTION_OPEN_EVENT,
  INSTRUCTION_READY_EVENT,
  type InstructionOpenRequest,
  readInstructionAlwaysOnTop,
  writeLastInstructionPath,
  writeInstructionAlwaysOnTop,
} from "../instructionWindow";
import { renderSafeHtml, renderSafeMarkdown } from "../markdown";
import {
  chooseInstructionRoot,
  executeActions,
  openInstructionInDefaultEditor,
  readInstruction,
  writeInstruction,
} from "../tauri";
import type { InstructionDocument } from "../types";
import { InstructionTree } from "./InstructionTree";
import { InstructionUnsavedDialog } from "./InstructionUnsavedDialog";

type ViewerStatus = {
  tone: "neutral" | "error";
  message: string;
};

type PendingTransition = {
  run: () => void | Promise<void>;
};

function initialInstructionPath(): string | null {
  return new URLSearchParams(window.location.search).get("path");
}

function pathWithin(path: string, parent: string): boolean {
  const normalize = (value: string) =>
    value.replace(/\//g, "\\").replace(/\\+$/, "").toLocaleLowerCase();
  const normalizedPath = normalize(path);
  const normalizedParent = normalize(parent);
  return normalizedPath === normalizedParent || normalizedPath.startsWith(`${normalizedParent}\\`);
}

export function InstructionViewer() {
  const tauriRuntime = isTauri();
  const instructionWindow = useMemo(
    () => (tauriRuntime ? WebviewWindow.getCurrent() : null),
    [tauriRuntime],
  );
  const contentRef = useRef<HTMLDivElement>(null);
  const dirtyRef = useRef(false);
  const allowCloseRef = useRef(false);
  const externalCheckErrorRef = useRef<string | null>(null);
  const [instruction, setInstruction] = useState<InstructionDocument | null>(null);
  const [selectedPath, setSelectedPath] = useState<string | null>(initialInstructionPath);
  const [loading, setLoading] = useState(Boolean(initialInstructionPath()));
  const [alwaysOnTop, setAlwaysOnTop] = useState(readInstructionAlwaysOnTop);
  const [status, setStatus] = useState<ViewerStatus | null>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [externalDocument, setExternalDocument] = useState<InstructionDocument | null>(null);
  const [pendingTransition, setPendingTransition] = useState<PendingTransition | null>(null);
  const [pendingTransitionError, setPendingTransitionError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const dirty = Boolean(editing && instruction && draft !== instruction.content);
  dirtyRef.current = dirty;

  const loadDocument = useCallback(async (path: string, openForEdit = false) => {
    setLoading(true);
    setStatus(null);
    try {
      const nextDocument = await readInstruction(path);
      setInstruction(nextDocument);
      setSelectedPath(nextDocument.path);
      writeLastInstructionPath(nextDocument.path);
      setDraft(nextDocument.content);
      setEditing(openForEdit && !nextDocument.readOnly);
      setExternalDocument(null);
      if (openForEdit && nextDocument.readOnly) {
        setStatus({ tone: "error", message: "この手順書は読み取り専用です" });
      }
      document.title = `${nextDocument.name} - Life Launcher 手順書`;
    } catch (error) {
      setInstruction(null);
      setSelectedPath(path);
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const requestTransition = useCallback((run: PendingTransition["run"]) => {
    if (dirtyRef.current) {
      setPendingTransition({ run });
      setPendingTransitionError(null);
      return;
    }
    void run();
  }, []);

  const requestDocument = useCallback(
    (path: string) => requestTransition(() => loadDocument(path)),
    [loadDocument, requestTransition],
  );

  const requestEditDocument = useCallback(
    (path: string) => requestTransition(() => loadDocument(path, true)),
    [loadDocument, requestTransition],
  );

  const saveEdits = useCallback(async (): Promise<boolean> => {
    if (!instruction || !editing) return true;
    if (instruction.readOnly) {
      const message = "読み取り専用の手順書は保存できません";
      setStatus({ tone: "error", message });
      setPendingTransitionError(message);
      return false;
    }
    if (externalDocument) {
      const message = "外部変更を再読込するか、編集内容を維持するか選んでください";
      setStatus({ tone: "error", message });
      setPendingTransitionError(message);
      return false;
    }
    if (draft === instruction.content) {
      setEditing(false);
      return true;
    }
    setSaving(true);
    setPendingTransitionError(null);
    try {
      const result = await writeInstruction(instruction.path, draft, instruction.modifiedAt);
      setInstruction({
        ...instruction,
        content: draft,
        modifiedAt: result.modifiedAt,
        size: result.size,
      });
      setEditing(false);
      setStatus({ tone: "neutral", message: "手順書を保存しました" });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus({ tone: "error", message });
      setPendingTransitionError(message);
      return false;
    } finally {
      setSaving(false);
    }
  }, [draft, editing, externalDocument, instruction]);

  const closeInstructionWindow = useCallback(async () => {
    allowCloseRef.current = true;
    try {
      if (instructionWindow) await instructionWindow.destroy();
      else window.close();
    } catch (error) {
      allowCloseRef.current = false;
      setStatus({ tone: "error", message: String(error) });
    }
  }, [instructionWindow]);

  const requestClose = useCallback(() => {
    requestTransition(closeInstructionWindow);
  }, [closeInstructionWindow, requestTransition]);

  const chooseInstructionRootForViewer = useCallback(async () => {
    return chooseInstructionRoot();
  }, []);

  useEffect(() => {
    if (!tauriRuntime) return;
    let disposed = false;
    const setup = async () => {
      const unlisten = await listen<InstructionOpenRequest>(INSTRUCTION_OPEN_EVENT, (event) => {
        if (event.payload.path) requestDocument(event.payload.path);
      });
      if (disposed) {
        unlisten();
        return;
      }
      void emit(INSTRUCTION_READY_EVENT);
      const path = initialInstructionPath();
      if (path) void loadDocument(path);
      return unlisten;
    };
    const unlistenPromise = setup();
    return () => {
      disposed = true;
      unlistenPromise.then((unlisten) => unlisten?.()).catch(() => undefined);
    };
  }, [loadDocument, requestDocument, tauriRuntime]);

  useEffect(() => {
    if (!instructionWindow) return;
    void instructionWindow.setAlwaysOnTop(alwaysOnTop).catch((error) => {
      setStatus({ tone: "error", message: String(error) });
    });
    writeInstructionAlwaysOnTop(alwaysOnTop);
  }, [alwaysOnTop, instructionWindow]);

  useEffect(() => {
    const content = contentRef.current;
    if (!content || !instruction) return;
    content.querySelectorAll("input").forEach((input) => {
      input.setAttribute("disabled", "");
      input.setAttribute("tabindex", "-1");
    });
    content.querySelectorAll("a").forEach((anchor) => {
      anchor.setAttribute("rel", "noopener noreferrer");
      anchor.removeAttribute("target");
    });
  }, [instruction]);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (event.key === INSTRUCTION_ALWAYS_ON_TOP_KEY) {
        setAlwaysOnTop(readInstructionAlwaysOnTop());
      }
    };
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  }, []);

  useEffect(() => {
    if (!instructionWindow) return;
    const unlistenPromise = instructionWindow.onCloseRequested((event) => {
      if (allowCloseRef.current) return;
      event.preventDefault();
      if (dirtyRef.current) {
        setPendingTransition({ run: closeInstructionWindow });
        setPendingTransitionError(null);
        return;
      }
      void closeInstructionWindow();
    });
    return () => {
      unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [closeInstructionWindow, instructionWindow]);

  useEffect(() => {
    if (!instruction || !selectedPath || loading) return;
    let disposed = false;
    let checking = false;
    const checkExternalChange = async () => {
      if (checking) return;
      checking = true;
      try {
        const current = await readInstruction(selectedPath);
        externalCheckErrorRef.current = null;
        if (!disposed && current.modifiedAt !== instruction.modifiedAt) {
          setExternalDocument((existing) =>
            existing?.modifiedAt === current.modifiedAt ? existing : current,
          );
        } else if (!disposed) {
          setExternalDocument(null);
        }
      } catch (error) {
        const message = `外部変更を確認できません: ${error instanceof Error ? error.message : String(error)}`;
        if (!disposed && externalCheckErrorRef.current !== message) {
          externalCheckErrorRef.current = message;
          setStatus({
            tone: "error",
            message,
          });
        }
      } finally {
        checking = false;
      }
    };
    const interval = window.setInterval(() => void checkExternalChange(), 2_500);
    return () => {
      disposed = true;
      window.clearInterval(interval);
    };
  }, [instruction, loading, selectedPath]);

  const isHtmlInstruction = Boolean(
    instruction?.name.toLocaleLowerCase().endsWith(".html"),
  );

  const renderedRichText = useMemo(() => {
    if (!instruction) return null;
    const name = instruction.name.toLocaleLowerCase();
    if (name.endsWith(".md")) return renderSafeMarkdown(instruction.content);
    if (name.endsWith(".html")) return renderSafeHtml(instruction.content);
    return null;
  }, [instruction]);

  const openExternalHref = async (href: string) => {
    try {
      const url = new URL(href);
      if (!/^https?:$/.test(url.protocol)) {
        throw new Error("http/httpsリンクだけを外部ブラウザで開けます");
      }
      const results = await executeActions([{ type: "open_url", payload: { url: url.href } }]);
      const failed = results.find((result) => !result.ok);
      if (failed) throw new Error(failed.message);
      setStatus(null);
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const openExternalLink = async (event: MouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const anchor = target.closest("a");
    const href = anchor?.getAttribute("href");
    if (!href) return;
    event.preventDefault();
    await openExternalHref(href);
  };

  const prepareHtmlFrame = (frame: HTMLIFrameElement) => {
    const document = frame.contentDocument;
    if (!document) return;
    document.querySelectorAll("a").forEach((anchor) => {
      anchor.setAttribute("rel", "noopener noreferrer");
      anchor.removeAttribute("target");
    });
    document.addEventListener("click", (event) => {
      const target = event.target as { closest?: (selector: string) => Element | null } | null;
      const anchor = target?.closest?.("a");
      const href = anchor?.getAttribute("href");
      if (!href) return;
      event.preventDefault();
      void openExternalHref(href);
    });
  };

  const openInDefaultEditor = async () => {
    if (!selectedPath) return;
    try {
      await openInstructionInDefaultEditor(selectedPath);
      setStatus({ tone: "neutral", message: "既定のエディタで開きました" });
    } catch (error) {
      setStatus({
        tone: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const startEditing = () => {
    if (!instruction) return;
    if (instruction.readOnly) {
      setStatus({ tone: "error", message: "この手順書は読み取り専用です" });
      return;
    }
    setDraft(instruction.content);
    setEditing(true);
    setStatus(null);
  };

  const discardEdits = () => {
    setDraft(instruction?.content ?? "");
    setEditing(false);
    setStatus({ tone: "neutral", message: "編集内容を破棄しました" });
  };

  const reloadExternalDocument = () => {
    if (!externalDocument) return;
    setInstruction(externalDocument);
    setDraft(externalDocument.content);
    setExternalDocument(null);
    setStatus({ tone: "neutral", message: "外部版を再読み込みしました" });
  };

  const keepEditsOverExternalDocument = () => {
    if (!externalDocument) return;
    setInstruction(externalDocument);
    setExternalDocument(null);
    setStatus({ tone: "neutral", message: "編集内容を維持します。保存時に外部版を上書きします" });
  };

  const runPendingTransition = async (saveFirst: boolean) => {
    const pending = pendingTransition;
    if (!pending) return;
    if (saveFirst && !(await saveEdits())) return;
    if (!saveFirst) {
      setDraft(instruction?.content ?? "");
      setEditing(false);
    }
    setPendingTransition(null);
    setPendingTransitionError(null);
    await pending.run();
  };

  const handlePathChanged = (oldPath: string, newPath: string) => {
    if (!selectedPath || !pathWithin(selectedPath, oldPath)) return;
    const nextPath = `${newPath}${selectedPath.slice(oldPath.length)}`;
    if (instruction && editing) {
      const nextName = nextPath.split(/[\\/]/).pop() ?? instruction.name;
      setInstruction({ ...instruction, name: nextName, path: nextPath });
      setSelectedPath(nextPath);
      setExternalDocument((current) =>
        current ? { ...current, name: nextName, path: nextPath } : null,
      );
      document.title = `${nextName} - Life Launcher 手順書`;
      return;
    }
    void loadDocument(nextPath);
  };

  const handlePathRemoved = (path: string) => {
    if (!selectedPath || !pathWithin(selectedPath, path)) return;
    setInstruction(null);
    setSelectedPath(null);
    setDraft("");
    setEditing(false);
    setExternalDocument(null);
    document.title = "Life Launcher 手順書";
    setStatus({ tone: "neutral", message: "選択していた手順書の参照を解除しました" });
  };

  return (
    <main className="instructionShell">
      <header className="instructionHeader">
        <div className="instructionHeaderTitle">
          <span className="instructionHeaderEyebrow">手順書</span>
          <strong title={instruction?.name}>{instruction?.name ?? "手順書ビューア"}</strong>
        </div>
        <div className="instructionHeaderActions">
          <button
            aria-label="手順書を再読み込み"
            className="instructionIconButton"
            disabled={!selectedPath || loading}
            onClick={() =>
              selectedPath && requestTransition(() => loadDocument(selectedPath))
            }
            title="再読み込み"
            type="button"
          >
            <UiIcon name="refresh" size={18} />
          </button>
          <button
            aria-label="手順書を編集"
            aria-pressed={editing}
            className="instructionIconButton"
            disabled={!instruction || instruction.readOnly || loading}
            onClick={startEditing}
            title={instruction?.readOnly ? "読み取り専用" : "編集"}
            type="button"
          >
            <UiIcon name="edit" size={18} />
          </button>
          <button
            aria-label="既定のエディタで開く"
            className="instructionIconButton"
            disabled={!selectedPath}
            onClick={() => void openInDefaultEditor()}
            title="既定のエディタで開く"
            type="button"
          >
            <UiIcon name="external" size={18} />
          </button>
          <button
            aria-label={alwaysOnTop ? "常に手前を解除" : "常に手前に表示"}
            aria-pressed={alwaysOnTop}
            className="instructionIconButton"
            onClick={() => setAlwaysOnTop((current) => !current)}
            title={alwaysOnTop ? "常に手前: オン" : "常に手前: オフ"}
            type="button"
          >
            <UiIcon name="pin" size={18} />
          </button>
          <button
            aria-label="手順書ウィンドウを閉じる"
            className="instructionIconButton instructionIconButton--close"
            onClick={requestClose}
            title="閉じる"
            type="button"
          >
            <UiIcon name="close" size={18} />
          </button>
        </div>
      </header>

      <div className="instructionWorkspace">
        <aside className="instructionSidebar" aria-label="手順書一覧">
          <div className="instructionSidebarHeading">手順書</div>
          <InstructionTree
            onChooseInstructionRoot={chooseInstructionRootForViewer}
            onEditFile={requestEditDocument}
            onPathChanged={handlePathChanged}
            onPathRemoved={handlePathRemoved}
            onSelectFile={requestDocument}
            selectedPath={selectedPath}
          />
        </aside>

        <section aria-busy={loading} aria-label="手順書本文" className="instructionContentPane">
          {externalDocument ? (
            <div className="instructionExternalBanner" role="status">
              <strong>{editing ? "外部で変更されています" : "外部で更新されています"}</strong>
              <span>
                {editing
                  ? "現在の編集内容を保存すると外部版を上書きします。"
                  : "表示中の内容より新しい版があります。"}
              </span>
              <div>
                <button onClick={reloadExternalDocument} type="button">
                  {editing ? "外部版を再読込" : "再読み込み"}
                </button>
                {editing ? (
                  <button onClick={keepEditsOverExternalDocument} type="button">
                    編集内容を維持
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
          <div className="instructionContentBody">
            {loading ? (
              <div className="instructionEmptyState" role="status">読み込んでいます</div>
            ) : status?.tone === "error" && !instruction ? (
              <div className="instructionEmptyState instructionEmptyState--error" role="alert">
                <strong>手順書を表示できません</strong>
                <span>{status.message}</span>
              </div>
            ) : instruction && editing ? (
              <div className="instructionEditor">
              <div className="instructionEditorToolbar">
                <span>{dirty ? "未保存の変更" : "編集中"}</span>
                <div>
                  <button disabled={saving} onClick={discardEdits} type="button">破棄</button>
                  <button
                    disabled={saving || !dirty || Boolean(externalDocument)}
                    onClick={() => void saveEdits()}
                    type="button"
                  >
                    {saving ? "保存中…" : "保存"}
                  </button>
                </div>
              </div>
              <textarea
                aria-label={`${instruction.name}を編集`}
                className="instructionEditorTextarea app-scrollbar"
                onChange={(event) => setDraft(event.target.value)}
                spellCheck={false}
                value={draft}
              />
              </div>
            ) : instruction ? (
              <div
                className={`instructionDocument app-scrollbar${isHtmlInstruction ? " instructionDocument--html" : ""}`}
                onClick={(event) => void openExternalLink(event)}
                ref={contentRef}
              >
                {isHtmlInstruction && renderedRichText !== null ? (
                  <iframe
                    className="instructionHtmlFrame"
                    onLoad={(event) => prepareHtmlFrame(event.currentTarget)}
                    sandbox="allow-same-origin"
                    srcDoc={renderedRichText}
                    title={`${instruction.name}のHTMLプレビュー`}
                  />
                ) : renderedRichText !== null ? (
                  <article
                    className="instructionMarkdown"
                    dangerouslySetInnerHTML={{ __html: renderedRichText }}
                  />
                ) : (
                  <pre className="instructionPlainText">{instruction.content}</pre>
                )}
              </div>
            ) : (
              <div className="instructionEmptyState">
                <strong>手順書を選択</strong>
                <span>プロジェクトに必要な手順を、ここですぐ確認できます。</span>
              </div>
            )}
          </div>
          {status && instruction ? (
            <div className={`instructionStatus instructionStatus--${status.tone}`} role="status">
              {status.message}
            </div>
          ) : null}
        </section>
      </div>

      <InstructionUnsavedDialog
        error={pendingTransitionError}
        onContinueEditing={() => {
          setPendingTransition(null);
          setPendingTransitionError(null);
        }}
        onDiscard={() => void runPendingTransition(false)}
        onSave={() => void runPendingTransition(true)}
        open={Boolean(pendingTransition)}
        saving={saving}
      />
    </main>
  );
}
