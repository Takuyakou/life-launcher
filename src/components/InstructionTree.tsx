import type { CSSProperties, KeyboardEvent } from "react";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { INSTRUCTION_RELOAD_TREE_EVENT } from "../instructionWindow";
import {
  backupConfigBeforeInstructionChange,
  createInstructionFile,
  createInstructionFolder,
  inspectInstructionFolder,
  listInstructionDirectory,
  listInstructionRoots,
  loadConfig,
  moveInstructionToRecycleBin,
  openInstructionFolder,
  openInstructionInDefaultEditor,
  renameInstructionFile,
  renameInstructionFolder,
  revealInstructionInExplorer,
  saveConfigAndNotifyDashboard,
  searchInstructionFiles,
  updateInstructionReferences,
} from "../tauri";
import type { AppConfig, InstructionEntry, InstructionRoot } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { ContextMenu } from "./ContextMenu";
import { UiIcon, type UiIconName } from "./UiIcon";

const EXPANDED_FOLDERS_KEY = "life-launcher-instruction-expanded-folders";
const MAX_SAVED_EXPANDED_FOLDERS = 500;
const INSTRUCTION_ORDER_KEY = "life-launcher-instruction-tree-order-v1";
const ROOT_ORDER_KEY = "__roots__";

type VisibleTreeNode = {
  path: string;
  name: string;
  kind: "root" | "folder" | "file";
  level: number;
  parentPath: string | null;
  available: boolean;
  error?: string;
};

type InstructionTreeProps = {
  selectedPath: string | null;
  onChooseInstructionRoot: () => Promise<InstructionRoot | null>;
  onSelectFile: (path: string) => void;
  onEditFile: (path: string) => void;
  onPathChanged: (oldPath: string, newPath: string) => void;
  onPathRemoved: (path: string) => void;
};

type ContextTarget = VisibleTreeNode | { kind: "blank"; path: ""; name: "" };

type ContextMenuState = {
  target: ContextTarget;
  x: number;
  y: number;
};

type OperationDialogState = {
  kind: "create-file" | "create-folder" | "rename-file" | "rename-folder";
  targetPath?: string;
  parentPath?: string;
  initialName?: string;
  extension?: "md" | "txt" | "html";
};

type ConfirmState = {
  kind: "recycle" | "unregister";
  target: VisibleTreeNode;
  message: string;
};

type ProjectLinkDialogState = {
  path: string;
  name: string;
  projectId: string;
  projects: Array<{
    id: string;
    name: string;
    instructionPath?: string;
  }>;
};

function pathKey(path: string): string {
  return path.replace(/\//g, "\\").replace(/\\+$/, "").toLocaleLowerCase();
}

function isWithinPath(path: string, root: string): boolean {
  const normalizedPath = pathKey(path);
  const normalizedRoot = pathKey(root);
  return normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}\\`);
}

function parentPath(path: string): string | null {
  const normalized = path.replace(/\//g, "\\").replace(/\\+$/, "");
  const separator = normalized.lastIndexOf("\\");
  return separator > 2 ? normalized.slice(0, separator) : null;
}

function readExpandedFolders(): Record<string, string> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(EXPANDED_FOLDERS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return {};
    return parsed
      .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
      .slice(0, MAX_SAVED_EXPANDED_FOLDERS)
      .reduce<Record<string, string>>((result, path) => {
        result[pathKey(path)] = path;
        return result;
      }, {});
  } catch {
    return {};
  }
}

function writeExpandedFolders(expanded: Record<string, string>) {
  window.localStorage.setItem(
    EXPANDED_FOLDERS_KEY,
    JSON.stringify(Object.values(expanded).slice(0, MAX_SAVED_EXPANDED_FOLDERS)),
  );
}

function matchingRoot(path: string, roots: InstructionRoot[]): InstructionRoot | null {
  return (
    roots
      .filter((root) => isWithinPath(path, root.path))
      .sort((left, right) => right.path.length - left.path.length)[0] ?? null
  );
}

function resultBreadcrumb(entry: InstructionEntry, roots: InstructionRoot[]): string {
  const root = matchingRoot(entry.path, roots);
  if (!root) return "";
  const parent = parentPath(entry.path);
  if (!parent || pathKey(parent) === pathKey(root.path)) return root.name;
  const relative = parent.slice(root.path.length).replace(/^[\\/]+/, "");
  return [root.name, ...relative.split(/[\\/]+/).filter(Boolean)].join(" / ");
}

function fileStem(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(0, dot) : name;
}

function instructionFileIcon(name: string): UiIconName {
  const lowerName = name.toLocaleLowerCase();
  if (lowerName.endsWith(".html")) return "fileCode";
  if (lowerName.endsWith(".txt")) return "fileText";
  return "book";
}

function instructionFileTone(name: string): "html" | "markdown" | "text" {
  const lowerName = name.toLocaleLowerCase();
  if (lowerName.endsWith(".html")) return "html";
  if (lowerName.endsWith(".txt")) return "text";
  return "markdown";
}

function readInstructionOrder(): Record<string, string[]> {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(INSTRUCTION_ORDER_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return Object.fromEntries(
      Object.entries(parsed).flatMap(([parent, paths]) =>
        Array.isArray(paths)
          ? [[parent, paths.filter((path): path is string => typeof path === "string")]]
          : [],
      ),
    );
  } catch {
    return {};
  }
}

function orderEntries<T extends { path: string }>(entries: T[], savedOrder: string[]): T[] {
  const order = new Map(savedOrder.map((path, index) => [pathKey(path), index]));
  return [...entries].sort((left, right) => {
    const leftIndex = order.get(pathKey(left.path));
    const rightIndex = order.get(pathKey(right.path));
    if (leftIndex === undefined && rightIndex === undefined) return 0;
    if (leftIndex === undefined) return 1;
    if (rightIndex === undefined) return -1;
    return leftIndex - rightIndex;
  });
}

function isEditableInstruction(name: string): boolean {
  const lowerName = name.toLocaleLowerCase();
  return lowerName.endsWith(".md") || lowerName.endsWith(".txt");
}

function replacePathPrefix(path: string, oldPath: string, newPath: string): string | null {
  if (!isWithinPath(path, oldPath)) return null;
  return `${newPath}${path.slice(oldPath.length)}`;
}

function rewriteProjectReferences(
  config: AppConfig,
  oldPath: string,
  newPath: string | null,
): { config: AppConfig; projectNames: string[]; changed: boolean } {
  const projectNames: string[] = [];
  const projects = config.projects.map((project) => {
    if (!project.instructionPath || !isWithinPath(project.instructionPath, oldPath)) return project;
    projectNames.push(project.name);
    if (newPath) {
      return {
        ...project,
        instructionPath: replacePathPrefix(project.instructionPath, oldPath, newPath) ?? newPath,
      };
    }
    const nextProject = { ...project };
    delete nextProject.instructionPath;
    delete nextProject.instructionOpenOnStart;
    return nextProject;
  });
  return {
    config: { ...config, projects },
    projectNames,
    changed: projectNames.length > 0,
  };
}

export function InstructionTree({
  selectedPath,
  onChooseInstructionRoot,
  onSelectFile,
  onEditFile,
  onPathChanged,
  onPathRemoved,
}: InstructionTreeProps) {
  const [roots, setRoots] = useState<InstructionRoot[]>([]);
  const [expanded, setExpanded] = useState<Record<string, string>>(readExpandedFolders);
  const [childrenByPath, setChildrenByPath] = useState<Record<string, InstructionEntry[]>>({});
  const [loadingPaths, setLoadingPaths] = useState<Set<string>>(new Set());
  const [treeLoading, setTreeLoading] = useState(true);
  const [treeError, setTreeError] = useState<string | null>(null);
  const [activePath, setActivePath] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<InstructionEntry[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searchIndex, setSearchIndex] = useState(0);
  const [instructionOrder, setInstructionOrder] = useState(readInstructionOrder);
  const [draggedPath, setDraggedPath] = useState<string | null>(null);
  const [dropPath, setDropPath] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [operationDialog, setOperationDialog] = useState<OperationDialogState | null>(null);
  const [operationName, setOperationName] = useState("");
  const [operationExtension, setOperationExtension] = useState<"md" | "txt">("md");
  const [operationParent, setOperationParent] = useState("");
  const [operationError, setOperationError] = useState<string | null>(null);
  const [operationSubmitting, setOperationSubmitting] = useState(false);
  const [registeringRoot, setRegisteringRoot] = useState(false);
  const [confirmState, setConfirmState] = useState<ConfirmState | null>(null);
  const [projectLinkDialog, setProjectLinkDialog] = useState<ProjectLinkDialogState | null>(null);
  const [projectLinkSubmitting, setProjectLinkSubmitting] = useState(false);
  const [operationStatus, setOperationStatus] = useState<string | null>(null);
  const rowRefs = useRef(new Map<string, HTMLElement>());
  const contextMenuOpenerRef = useRef<HTMLElement | null>(null);
  const operationDialogRef = useRef<HTMLElement>(null);
  const operationNameRef = useRef<HTMLInputElement>(null);
  const projectLinkDialogRef = useRef<HTMLElement>(null);
  const projectLinkSelectRef = useRef<HTMLSelectElement>(null);
  const projectLinkSubmittingRef = useRef(false);
  const operationSubmittingRef = useRef(false);
  const loadingRef = useRef(new Set<string>());
  const searchGeneration = useRef(0);
  const expandedRef = useRef(expanded);
  const suppressTreeClickRef = useRef(false);
  const projectLinkDialogOpen = Boolean(projectLinkDialog);

  const loadDirectory = useCallback(async (path: string, force = false) => {
    const key = pathKey(path);
    if (!force && loadingRef.current.has(key)) return;
    loadingRef.current.add(key);
    setLoadingPaths((current) => new Set(current).add(key));
    try {
      const entries = await listInstructionDirectory(path);
      setChildrenByPath((current) => ({ ...current, [key]: entries }));
    } finally {
      loadingRef.current.delete(key);
      setLoadingPaths((current) => {
        const next = new Set(current);
        next.delete(key);
        return next;
      });
    }
  }, []);

  const refreshTree = useCallback(async () => {
    setTreeLoading(true);
    setTreeError(null);
    try {
      const nextRoots = await listInstructionRoots();
      setRoots(nextRoots);
      setChildrenByPath({});
      const savedFolders = Object.values(expandedRef.current).filter((path) =>
        nextRoots.some((root) => root.available && isWithinPath(path, root.path)),
      );
      const restoredChildren: Record<string, InstructionEntry[]> = {};
      for (let index = 0; index < savedFolders.length; index += 8) {
        const batch = savedFolders.slice(index, index + 8);
        const results = await Promise.all(
          batch.map(async (path) => {
            try {
              return [pathKey(path), await listInstructionDirectory(path)] as const;
            } catch {
              return null;
            }
          }),
        );
        for (const item of results) {
          if (item) restoredChildren[item[0]] = item[1];
        }
      }
      setChildrenByPath(restoredChildren);
      setActivePath((current) => current ?? nextRoots[0]?.path ?? null);
    } catch (error) {
      setRoots([]);
      setTreeError(error instanceof Error ? error.message : String(error));
    } finally {
      setTreeLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshTree();
  }, [refreshTree]);

  useEffect(() => {
    let disposed = false;
    const unlistenPromise = listen(INSTRUCTION_RELOAD_TREE_EVENT, () => {
      if (!disposed) void refreshTree();
    });
    return () => {
      disposed = true;
      unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, [refreshTree]);

  useEffect(() => {
    expandedRef.current = expanded;
    writeExpandedFolders(expanded);
  }, [expanded]);


  useEffect(() => {
    if (!operationDialog) return;
    setOperationName(operationDialog.initialName ?? "");
    setOperationExtension(operationDialog.extension === "txt" ? "txt" : "md");
    setOperationParent(
      operationDialog.parentPath ?? roots.filter((root) => root.available)[0]?.path ?? "",
    );
    setOperationError(null);
    setOperationSubmitting(false);
    operationSubmittingRef.current = false;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => operationNameRef.current?.focus());
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        if (!operationSubmittingRef.current) setOperationDialog(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        operationDialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), input:not(:disabled), select:not(:disabled)",
        ) ?? [],
      );
      if (!focusable.length) {
        event.preventDefault();
        operationDialogRef.current?.focus();
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
    document.addEventListener("keydown", closeOnEscape, true);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", closeOnEscape, true);
      opener?.focus();
    };
  }, [operationDialog, roots]);

  useEffect(() => {
    if (!projectLinkDialogOpen) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusFrame = window.requestAnimationFrame(() => projectLinkSelectRef.current?.focus());
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && !projectLinkSubmittingRef.current) {
        event.preventDefault();
        setProjectLinkDialog(null);
        return;
      }
      if (event.key !== "Tab") return;
      const focusable = Array.from(
        projectLinkDialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled), select:not(:disabled)",
        ) ?? [],
      );
      if (!focusable.length) return;
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
  }, [projectLinkDialogOpen]);

  const setFolderExpanded = useCallback(
    async (path: string, shouldExpand: boolean) => {
      const key = pathKey(path);
      if (!shouldExpand) {
        setExpanded((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        return;
      }
      setExpanded((current) => ({ ...current, [key]: path }));
      if (!childrenByPath[key]) {
        try {
          await loadDirectory(path);
          setTreeError(null);
        } catch (error) {
          setTreeError(error instanceof Error ? error.message : String(error));
        }
      }
    },
    [childrenByPath, loadDirectory],
  );

  const visibleNodes = useMemo(() => {
    const result: VisibleTreeNode[] = [];
    const appendChildren = (path: string, level: number) => {
      const entries = childrenByPath[pathKey(path)] ?? [];
      const orderedEntries = orderEntries(entries, instructionOrder[pathKey(path)] ?? []);
      for (const entry of orderedEntries) {
        result.push({
          path: entry.path,
          name: entry.name,
          kind: entry.kind,
          level,
          parentPath: path,
          available: true,
        });
        if (entry.kind === "folder" && expanded[pathKey(entry.path)]) {
          appendChildren(entry.path, level + 1);
        }
      }
    };
    const orderedRoots = orderEntries(roots, instructionOrder[ROOT_ORDER_KEY] ?? []);
    for (const root of orderedRoots) {
      result.push({
        path: root.path,
        name: root.name,
        kind: "root",
        level: 1,
        parentPath: null,
        available: root.available,
        error: root.error,
      });
      if (root.available && expanded[pathKey(root.path)]) appendChildren(root.path, 2);
    }
    return result;
  }, [childrenByPath, expanded, instructionOrder, roots]);

  const moveInstructionNode = (sourcePath: string, targetPath: string) => {
    const source = visibleNodes.find((node) => pathKey(node.path) === pathKey(sourcePath));
    const target = visibleNodes.find((node) => pathKey(node.path) === pathKey(targetPath));
    if (!source || !target || pathKey(source.parentPath ?? "") !== pathKey(target.parentPath ?? "")) {
      return;
    }
    const parentKey = source.parentPath ? pathKey(source.parentPath) : ROOT_ORDER_KEY;
    const siblings: Array<{ path: string }> = source.parentPath
      ? childrenByPath[pathKey(source.parentPath)] ?? []
      : roots;
    const ordered = orderEntries(siblings, instructionOrder[parentKey] ?? []);
    const sourceIndex = ordered.findIndex((entry) => pathKey(entry.path) === pathKey(source.path));
    const targetIndex = ordered.findIndex((entry) => pathKey(entry.path) === pathKey(target.path));
    if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) return;
    const [moved] = ordered.splice(sourceIndex, 1);
    ordered.splice(targetIndex, 0, moved);
    setInstructionOrder((current) => {
      const next = { ...current, [parentKey]: ordered.map((entry) => entry.path) };
      window.localStorage.setItem(INSTRUCTION_ORDER_KEY, JSON.stringify(next));
      return next;
    });
  };

  useEffect(() => {
    if (activePath && visibleNodes.some((node) => pathKey(node.path) === pathKey(activePath))) {
      return;
    }
    setActivePath(visibleNodes[0]?.path ?? null);
  }, [activePath, visibleNodes]);

  useEffect(() => {
    const trimmed = query.trim();
    searchGeneration.current += 1;
    const generation = searchGeneration.current;
    if (!trimmed) {
      setSearchResults([]);
      setSearchError(null);
      setSearching(false);
      setSearchIndex(0);
      return;
    }
    setSearching(true);
    const timeout = window.setTimeout(() => {
      void searchInstructionFiles(trimmed)
        .then((results) => {
          if (generation !== searchGeneration.current) return;
          setSearchResults(results);
          setSearchError(null);
          setSearchIndex(0);
        })
        .catch((error) => {
          if (generation !== searchGeneration.current) return;
          setSearchResults([]);
          setSearchError(error instanceof Error ? error.message : String(error));
        })
        .finally(() => {
          if (generation === searchGeneration.current) setSearching(false);
        });
    }, 180);
    return () => window.clearTimeout(timeout);
  }, [query]);

  const revealFolder = useCallback(
    async (folderPath: string) => {
      const root = matchingRoot(folderPath, roots);
      if (!root) return;
      const chain: string[] = [];
      let cursor: string | null = folderPath;
      while (cursor && isWithinPath(cursor, root.path)) {
        chain.unshift(cursor);
        if (pathKey(cursor) === pathKey(root.path)) break;
        cursor = parentPath(cursor);
      }
      const additions = chain.reduce<Record<string, string>>((result, path) => {
        result[pathKey(path)] = path;
        return result;
      }, {});
      setExpanded((current) => ({ ...current, ...additions }));
      for (const path of chain) {
        try {
          await loadDirectory(path);
        } catch (error) {
          setTreeError(error instanceof Error ? error.message : String(error));
          break;
        }
      }
      setActivePath(folderPath);
      setQuery("");
      window.requestAnimationFrame(() => rowRefs.current.get(pathKey(folderPath))?.focus());
    },
    [loadDirectory, roots],
  );

  const openSearchResult = (entry: InstructionEntry) => {
    if (entry.kind === "file") {
      onSelectFile(entry.path);
      return;
    }
    void revealFolder(entry.path);
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      setQuery("");
      return;
    }
    if (!searchResults.length) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      setSearchIndex((current) =>
        (current + direction + searchResults.length) % searchResults.length,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      openSearchResult(searchResults[searchIndex] ?? searchResults[0]);
    }
  };

  const focusNode = (path: string) => {
    setActivePath(path);
    rowRefs.current.get(pathKey(path))?.focus();
  };

  const handleTreeKeyDown = async (
    event: KeyboardEvent<HTMLElement>,
    node: VisibleTreeNode,
  ) => {
    if (event.key === "ContextMenu" || (event.shiftKey && event.key === "F10")) {
      event.preventDefault();
      const bounds = event.currentTarget.getBoundingClientRect();
      openContextMenu(node, bounds.left + 24, bounds.bottom);
      return;
    }
    const index = visibleNodes.findIndex((item) => pathKey(item.path) === pathKey(node.path));
    if (event.key === "Home" && visibleNodes[0]) {
      event.preventDefault();
      focusNode(visibleNodes[0].path);
      return;
    }
    const lastNode = visibleNodes[visibleNodes.length - 1];
    if (event.key === "End" && lastNode) {
      event.preventDefault();
      focusNode(lastNode.path);
      return;
    }
    if (event.key === "ArrowDown" && visibleNodes[index + 1]) {
      event.preventDefault();
      focusNode(visibleNodes[index + 1].path);
      return;
    }
    if (event.key === "ArrowUp" && visibleNodes[index - 1]) {
      event.preventDefault();
      focusNode(visibleNodes[index - 1].path);
      return;
    }
    if (node.kind === "file") {
      if (event.key === "Enter") {
        event.preventDefault();
        onSelectFile(node.path);
      }
      return;
    }
    const isExpanded = Boolean(expanded[pathKey(node.path)]);
    if (event.key === "ArrowRight") {
      event.preventDefault();
      if (!isExpanded) await setFolderExpanded(node.path, true);
      else if (visibleNodes[index + 1]?.parentPath === node.path) {
        focusNode(visibleNodes[index + 1].path);
      }
      return;
    }
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      if (isExpanded) await setFolderExpanded(node.path, false);
      else if (node.parentPath) focusNode(node.parentPath);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      await setFolderExpanded(node.path, !isExpanded);
    }
  };

  const openContextMenu = (target: ContextTarget, x: number, y: number) => {
    contextMenuOpenerRef.current =
      (target.path ? rowRefs.current.get(pathKey(target.path)) : null) ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setActivePath(target.path || activePath);
    setContextMenu({
      target,
      x: Math.max(8, Math.min(x, Math.max(8, window.innerWidth - 220))),
      y: Math.max(8, Math.min(y, Math.max(8, window.innerHeight - 280))),
    });
  };

  const openCreateDialog = (kind: "create-file" | "create-folder", parentPath?: string) => {
    if (!parentPath && !roots.some((root) => root.available)) {
      setOperationStatus("設定から手順書フォルダを追加してください");
      return;
    }
    setContextMenu(null);
    setOperationDialog({ kind, parentPath, extension: "md" });
  };

  const registerInstructionFolderAndCreate = async () => {
    if (registeringRoot) return;
    setRegisteringRoot(true);
    setOperationStatus(null);
    try {
      const selected = await onChooseInstructionRoot();
      if (!selected) return;
      const loaded = await loadConfig();
      const folders = loaded.config.settings.instructionFolders;
      if (folders.some((folder) => pathKey(folder) === pathKey(selected.path))) {
        await refreshTree();
        openCreateDialog("create-file", selected.path);
        return;
      }
      if (folders.length >= 5) {
        setOperationStatus("手順書フォルダは最大5件までです。設定から登録を整理してください");
        return;
      }
      await saveConfigAndNotifyDashboard({
        ...loaded.config,
        settings: {
          ...loaded.config.settings,
          instructionFolders: [...folders, selected.path],
        },
      });
      await refreshTree();
      setOperationDialog({ kind: "create-file", parentPath: selected.path, extension: "md" });
    } catch (error) {
      setOperationStatus(
        `手順書フォルダを登録できません: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setRegisteringRoot(false);
    }
  };

  const registerInstructionFolder = async () => {
    if (registeringRoot) return;
    setRegisteringRoot(true);
    setOperationStatus(null);
    try {
      const selected = await onChooseInstructionRoot();
      if (!selected) return;
      const loaded = await loadConfig();
      const folders = loaded.config.settings.instructionFolders;
      const alreadyRegistered = folders.some(
        (folder) => pathKey(folder) === pathKey(selected.path),
      );
      if (!alreadyRegistered) {
        if (folders.length >= 5) {
          setOperationStatus("手順書フォルダは最大5件までです。登録を整理してください");
          return;
        }
        await saveConfigAndNotifyDashboard({
          ...loaded.config,
          settings: {
            ...loaded.config.settings,
            instructionFolders: [...folders, selected.path],
          },
        });
      }
      await refreshTree();
      await setFolderExpanded(selected.path, true);
      setActivePath(selected.path);
      setOperationStatus(
        alreadyRegistered
          ? `${selected.name}は読み込み済みです`
          : `${selected.name}を読み込みました`,
      );
    } catch (error) {
      setOperationStatus(
        `手順書フォルダを読み込めません: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setRegisteringRoot(false);
    }
  };

  const replaceExpandedPaths = (oldPath: string, newPath: string | null) => {
    const next: Record<string, string> = {};
    for (const path of Object.values(expandedRef.current)) {
      if (!isWithinPath(path, oldPath)) {
        next[pathKey(path)] = path;
        continue;
      }
      if (newPath) {
        const replacement = replacePathPrefix(path, oldPath, newPath) ?? newPath;
        next[pathKey(replacement)] = replacement;
      }
    }
    expandedRef.current = next;
    setExpanded(next);
  };

  const submitOperationDialog = async () => {
    if (!operationDialog || operationSubmitting) return false;
    const name = operationName.trim();
    if (!name) {
      setOperationError("名前を入力してください");
      return false;
    }
    if ([...name].length > 48) {
      setOperationError("名前は48文字以内で入力してください");
      return false;
    }
    setOperationSubmitting(true);
    operationSubmittingRef.current = true;
    setOperationError(null);
    try {
      if (operationDialog.kind === "create-file") {
        if (!operationParent) throw new Error("作成先フォルダを選んでください");
        const entry = await createInstructionFile(operationParent, name, operationExtension);
        onSelectFile(entry.path);
        setActivePath(entry.path);
        setOperationDialog(null);
        try {
          await setFolderExpanded(operationParent, true);
          await loadDirectory(operationParent, true);
          setOperationStatus(`${entry.name}を作成しました`);
        } catch (error) {
          setOperationStatus(
            `${entry.name}は作成しましたが、一覧を再読み込みできませんでした: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        return true;
      } else if (operationDialog.kind === "create-folder") {
        if (!operationParent) throw new Error("作成先フォルダを選んでください");
        const entry = await createInstructionFolder(operationParent, name);
        setActivePath(entry.path);
        setOperationDialog(null);
        try {
          await setFolderExpanded(operationParent, true);
          await loadDirectory(operationParent, true);
          await setFolderExpanded(entry.path, true);
          setOperationStatus(`${entry.name}フォルダを作成しました`);
        } catch (error) {
          setOperationStatus(
            `${entry.name}フォルダは作成しましたが、一覧を再読み込みできませんでした: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
        return true;
      } else {
        const targetPath = operationDialog.targetPath;
        if (!targetPath) throw new Error("名前を変更する項目がありません");
        const change =
          operationDialog.kind === "rename-file"
            ? await renameInstructionFile(targetPath, name)
            : await renameInstructionFolder(targetPath, name);
        try {
          await updateInstructionReferences(change.oldPath, change.newPath);
        } catch (saveError) {
          try {
            if (operationDialog.kind === "rename-file") {
              await renameInstructionFile(change.newPath, fileStem(operationDialog.initialName ?? ""));
            } else {
              await renameInstructionFolder(change.newPath, operationDialog.initialName ?? "");
            }
          } catch (rollbackError) {
            throw new Error(
              `config保存と名前の復元に失敗しました: ${String(saveError)} / ${String(rollbackError)}`,
            );
          }
          throw saveError;
        }
        replaceExpandedPaths(change.oldPath, change.newPath);
        onPathChanged(change.oldPath, change.newPath);
        await refreshTree();
        setActivePath(change.newPath);
        setOperationStatus(`${name}へ名前を変更しました`);
      }
      setOperationDialog(null);
      return true;
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : String(error));
      return false;
    } finally {
      setOperationSubmitting(false);
      operationSubmittingRef.current = false;
    }
  };

  const prepareRecycleConfirmation = async (target: VisibleTreeNode) => {
    setContextMenu(null);
    try {
      const loaded = await loadConfig();
      const referenced = rewriteProjectReferences(loaded.config, target.path, null).projectNames;
      const referenceText = referenced.length
        ? `\n紐付けを解除するプロジェクト: ${referenced.join("、")}`
        : "";
      if (target.kind === "folder") {
        const summary = await inspectInstructionFolder(target.path);
        setConfirmState({
          kind: "recycle",
          target,
          message: `手順書${summary.instructionCount}件、サブフォルダ${summary.folderCount}件も移動します。${referenceText}`,
        });
      } else {
        setConfirmState({ kind: "recycle", target, message: referenceText.trim() });
      }
    } catch (error) {
      setOperationStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const prepareUnregisterConfirmation = async (target: VisibleTreeNode) => {
    setContextMenu(null);
    try {
      const loaded = await loadConfig();
      const referenced = rewriteProjectReferences(loaded.config, target.path, null).projectNames;
      setConfirmState({
        kind: "unregister",
        target,
        message: referenced.length
          ? `PC上のフォルダは削除しません。紐付けを解除するプロジェクト: ${referenced.join("、")}`
          : "PC上のフォルダは削除しません。",
      });
    } catch (error) {
      setOperationStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const runConfirmedOperation = async () => {
    if (!confirmState) return false;
    const { target } = confirmState;
    if (confirmState.kind === "unregister") {
      await updateInstructionReferences(target.path, null, true);
      replaceExpandedPaths(target.path, null);
      onPathRemoved(target.path);
      await refreshTree();
      setOperationStatus(`${target.name}の登録を解除しました`);
      return true;
    }

    await backupConfigBeforeInstructionChange();
    await moveInstructionToRecycleBin(target.path);
    let referenceWarning: string | null = null;
    try {
      await updateInstructionReferences(target.path, null);
    } catch (error) {
      referenceWarning = `${target.name}はごみ箱へ移動しましたが、プロジェクト紐付けを保存できませんでした: ${error instanceof Error ? error.message : String(error)}`;
    }
    replaceExpandedPaths(target.path, null);
    onPathRemoved(target.path);
    await refreshTree();
    setOperationStatus(referenceWarning ?? `${target.name}をごみ箱へ移動しました`);
    return true;
  };

  const openProjectLinkDialog = async (target: VisibleTreeNode) => {
    const loaded = await loadConfig();
    if (loaded.config.projects.length === 0) {
      setOperationStatus("紐付ける次の一手がありません。メイン画面で先に追加してください");
      return;
    }
    const projects = loaded.config.projects.map((project) => ({
      id: project.id,
      name: project.name,
      instructionPath: project.instructionPath,
    }));
    const linkedProject = projects.find(
      (project) =>
        project.instructionPath && pathKey(project.instructionPath) === pathKey(target.path),
    );
    setProjectLinkSubmitting(false);
    projectLinkSubmittingRef.current = false;
    setProjectLinkDialog({
      path: target.path,
      name: target.name,
      projectId: linkedProject?.id ?? projects[0].id,
      projects,
    });
  };

  const submitProjectLink = async () => {
    if (!projectLinkDialog || projectLinkSubmitting) return;
    setProjectLinkSubmitting(true);
    projectLinkSubmittingRef.current = true;
    try {
      const loaded = await loadConfig();
      const project = loaded.config.projects.find(
        (candidate) => candidate.id === projectLinkDialog.projectId,
      );
      if (!project) throw new Error("選択した次の一手が見つかりません。再度選択してください");
      await saveConfigAndNotifyDashboard({
        ...loaded.config,
        projects: loaded.config.projects.map((candidate) =>
          candidate.id === project.id
            ? {
                ...candidate,
                instructionPath: projectLinkDialog.path,
                instructionOpenOnStart: true,
              }
            : candidate,
        ),
      });
      setProjectLinkDialog(null);
      setOperationStatus(
        `${projectLinkDialog.name}を「${project.name}」の次の一手に紐づけました`,
      );
    } catch (error) {
      setOperationStatus(
        `手順書を紐づけられません: ${error instanceof Error ? error.message : String(error)}`,
      );
    } finally {
      setProjectLinkSubmitting(false);
      projectLinkSubmittingRef.current = false;
    }
  };

  const runContextAction = async (action: string, target: ContextTarget) => {
    setContextMenu(null);
    try {
      if (action === "create-file") {
        openCreateDialog("create-file", target.kind === "root" || target.kind === "folder" ? target.path : undefined);
      } else if (action === "create-folder") {
        openCreateDialog("create-folder", target.kind === "root" || target.kind === "folder" ? target.path : undefined);
      } else if (action === "open" && target.kind === "file") {
        onSelectFile(target.path);
      } else if (action === "edit" && target.kind === "file" && isEditableInstruction(target.name)) {
        onEditFile(target.path);
      } else if (action === "link-project" && target.kind === "file") {
        await openProjectLinkDialog(target);
      } else if (action === "rename" && target.kind !== "blank" && target.kind !== "root") {
        setOperationDialog({
          kind: target.kind === "file" ? "rename-file" : "rename-folder",
          targetPath: target.path,
          initialName: target.kind === "file" ? fileStem(target.name) : target.name,
          extension:
            target.kind === "file"
              ? target.name.toLocaleLowerCase().endsWith(".html")
                ? "html"
                : target.name.toLocaleLowerCase().endsWith(".txt")
                  ? "txt"
                  : "md"
              : undefined,
        });
      } else if (action === "external" && target.kind === "file") {
        await openInstructionInDefaultEditor(target.path);
        setOperationStatus("既定のエディタで開きました");
      } else if (action === "explorer" && target.kind !== "blank") {
        if (target.kind === "file") await revealInstructionInExplorer(target.path);
        else await openInstructionFolder(target.path);
      } else if (action === "reload") {
        if (target.kind === "root" || target.kind === "folder") {
          await loadDirectory(target.path, true);
          await setFolderExpanded(target.path, true);
        } else {
          await refreshTree();
        }
      } else if (action === "recycle" && target.kind !== "blank" && target.kind !== "root") {
        await prepareRecycleConfirmation(target);
      } else if (action === "unregister" && target.kind === "root") {
        await prepareUnregisterConfirmation(target);
      }
    } catch (error) {
      setOperationStatus(error instanceof Error ? error.message : String(error));
    }
  };

  const hasQuery = query.trim().length > 0;

  return (
    <div className="instructionTreePanel">
      <div className="instructionTreeTools">
        <label className="instructionSearchField">
          <span className="srOnly">手順書名またはフォルダ名を検索</span>
          <span aria-hidden="true">⌕</span>
          <input
            aria-activedescendant={
              hasQuery && searchResults.length
                ? `instruction-search-result-${searchIndex}`
                : undefined
            }
            aria-controls="instruction-tree-results"
            aria-expanded={hasQuery}
            aria-autocomplete="list"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleSearchKeyDown}
            placeholder="検索"
            role="combobox"
            type="search"
            value={query}
          />
        </label>
        <button
          className="instructionTreeLoad"
          disabled={treeLoading || registeringRoot || roots.length >= 5}
          onClick={() => void registerInstructionFolder()}
          title={roots.length >= 5 ? "手順書フォルダは最大5件です" : "既存フォルダを読み込む"}
          type="button"
        >
          <UiIcon name="folder" size={16} />
          <span>読み込み</span>
        </button>
        <button
          aria-label="手順書一覧を再読み込み"
          className="instructionTreeRefresh"
          disabled={treeLoading}
          onClick={() => void refreshTree()}
          title="一覧を再読み込み"
          type="button"
        >
          <UiIcon name="refresh" size={16} />
        </button>
      </div>

      <div
        className="instructionTreeScroll app-scrollbar"
        id="instruction-tree-results"
        onContextMenu={(event) => {
          if (event.target !== event.currentTarget) return;
          event.preventDefault();
          openContextMenu({ kind: "blank", path: "", name: "" }, event.clientX, event.clientY);
        }}
      >
        {hasQuery ? (
          <div aria-busy={searching} aria-label="手順書の検索結果" role="listbox">
            {searching ? <div className="instructionTreeMessage">検索しています</div> : null}
            {!searching && searchError ? (
              <div className="instructionTreeMessage instructionTreeMessage--error" role="alert">
                {searchError}
              </div>
            ) : null}
            {!searching && !searchError && searchResults.length === 0 ? (
              <div className="instructionTreeMessage">一致する手順書はありません</div>
            ) : null}
            {!searching
              ? searchResults.map((entry, index) => (
                  <button
                    aria-selected={index === searchIndex}
                    className={`instructionSearchResult${index === searchIndex ? " instructionSearchResult--active" : ""}`}
                    id={`instruction-search-result-${index}`}
                    key={entry.path}
                    onClick={() => openSearchResult(entry)}
                    onMouseEnter={() => setSearchIndex(index)}
                    role="option"
                    title={entry.path}
                    type="button"
                  >
                    <span className="instructionSearchResultName">
                      <span
                        aria-hidden="true"
                        className={
                          entry.kind === "folder"
                            ? undefined
                            : `instructionFileIcon instructionFileIcon--${instructionFileTone(entry.name)}`
                        }
                      >
                        <UiIcon
                          name={entry.kind === "folder" ? "folder" : instructionFileIcon(entry.name)}
                          size={16}
                        />
                      </span>
                      <strong>{entry.name}</strong>
                    </span>
                    <span>{resultBreadcrumb(entry, roots)}</span>
                  </button>
                ))
              : null}
          </div>
        ) : treeLoading ? (
          <div className="instructionTreeMessage" role="status">一覧を読み込んでいます</div>
        ) : treeError && roots.length === 0 ? (
          <div className="instructionTreeMessage instructionTreeMessage--error" role="alert">
            {treeError}
          </div>
        ) : roots.length === 0 ? (
          <div className="instructionTreeMessage">
            <strong>手順書フォルダが未登録です</strong>
            <span>保存先を選ぶと、そのまま最初の手順書を作成できます。</span>
            <button
              className="instructionTreeEmptyAction"
              disabled={registeringRoot}
              onClick={() => void registerInstructionFolderAndCreate()}
              type="button"
            >
              {registeringRoot ? "選択中…" : "フォルダを選んで作成"}
            </button>
            <button
              className="instructionTreeEmptyAction"
              disabled={registeringRoot}
              onClick={() => void registerInstructionFolder()}
              type="button"
            >
              {registeringRoot ? "選択中…" : "既存フォルダを読み込む"}
            </button>
          </div>
        ) : (
          <div aria-label="手順書フォルダ" role="tree">
            {visibleNodes.map((node) => {
              const key = pathKey(node.path);
              const expandable = node.kind !== "file" && node.available;
              const isExpanded = Boolean(expanded[key]);
              const isSelected = node.kind === "file" && pathKey(selectedPath ?? "") === key;
              const isLoading = loadingPaths.has(key);
              return (
                <div
                  aria-expanded={expandable ? isExpanded : undefined}
                  aria-level={node.level}
                  aria-selected={isSelected}
                  className={`instructionTreeRow${isSelected ? " instructionTreeRow--selected" : ""}${!node.available ? " instructionTreeRow--unavailable" : ""}${draggedPath && pathKey(draggedPath) === key ? " instructionTreeRow--dragging" : ""}${dropPath && pathKey(dropPath) === key && pathKey(draggedPath ?? "") !== key ? " instructionTreeRow--dropTarget" : ""}`}
                  draggable={node.available}
                  key={node.path}
                  onClick={() => {
                    if (suppressTreeClickRef.current) return;
                    setActivePath(node.path);
                    if (node.kind === "file") onSelectFile(node.path);
                  }}
                  onDragEnd={() => {
                    setDraggedPath(null);
                    setDropPath(null);
                    window.setTimeout(() => {
                      suppressTreeClickRef.current = false;
                    }, 0);
                  }}
                  onDragOver={(event) => {
                    if (!draggedPath) return;
                    const source = visibleNodes.find(
                      (entry) => pathKey(entry.path) === pathKey(draggedPath),
                    );
                    if (
                      !source ||
                      pathKey(source.parentPath ?? "") !== pathKey(node.parentPath ?? "")
                    ) {
                      return;
                    }
                    event.preventDefault();
                    event.dataTransfer.dropEffect = "move";
                    setDropPath(node.path);
                  }}
                  onDragStart={(event) => {
                    event.dataTransfer.effectAllowed = "move";
                    event.dataTransfer.setData("text/plain", node.path);
                    suppressTreeClickRef.current = true;
                    setDraggedPath(node.path);
                    setDropPath(node.path);
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (draggedPath) moveInstructionNode(draggedPath, node.path);
                    setDraggedPath(null);
                    setDropPath(null);
                  }}
                  onDoubleClick={() => {
                    if (expandable) void setFolderExpanded(node.path, !isExpanded);
                  }}
                  onContextMenu={(event) => {
                    event.preventDefault();
                    openContextMenu(node, event.clientX, event.clientY);
                  }}
                  onKeyDown={(event) => void handleTreeKeyDown(event, node)}
                  ref={(element) => {
                    if (element) rowRefs.current.set(key, element);
                    else rowRefs.current.delete(key);
                  }}
                  role="treeitem"
                  style={
                    {
                      "--instruction-tree-level": Math.min(node.level, 8),
                    } as CSSProperties
                  }
                  tabIndex={activePath && pathKey(activePath) === key ? 0 : -1}
                  title={node.error ?? node.path}
                >
                  {expandable ? (
                    <button
                      aria-label={isExpanded ? `${node.name}を折りたたむ` : `${node.name}を展開する`}
                      className="instructionTreeDisclosure"
                      onClick={(event) => {
                        event.stopPropagation();
                        void setFolderExpanded(node.path, !isExpanded);
                      }}
                      tabIndex={-1}
                      type="button"
                    >
                      {isLoading ? <span aria-hidden="true">·</span> : <UiIcon name={isExpanded ? "chevronDown" : "chevronRight"} size={16} />}
                    </button>
                  ) : (
                    <span className="instructionTreeDisclosure" aria-hidden="true" />
                  )}
                  <span
                    className={`instructionTreeKind${
                      node.kind === "file"
                        ? ` instructionFileIcon instructionFileIcon--${instructionFileTone(node.name)}`
                        : ""
                    }`}
                    aria-hidden="true"
                  >
                    <UiIcon
                      name={node.kind === "file" ? instructionFileIcon(node.name) : "folder"}
                      size={16}
                    />
                  </span>
                  <span className="instructionTreeName">{node.name}</span>
                  {!node.available ? <span className="instructionTreeUnavailable">!</span> : null}
                  {node.available ? (
                    <button
                      aria-label={`${node.name}のメニューを開く`}
                      className="instructionTreeMore"
                      onClick={(event) => {
                        event.stopPropagation();
                        const bounds = event.currentTarget.getBoundingClientRect();
                        openContextMenu(node, bounds.right, bounds.bottom + 3);
                      }}
                      tabIndex={-1}
                      type="button"
                    >
                      <span aria-hidden="true">…</span>
                    </button>
                  ) : null}
                </div>
              );
            })}
            {treeError ? (
              <div className="instructionTreeInlineError" role="status">{treeError}</div>
            ) : null}
          </div>
        )}
      </div>

      {operationStatus ? (
        <div className="instructionTreeStatus" role="status">
          <span>{operationStatus}</span>
          <button aria-label="通知を閉じる" title="閉じる" onClick={() => setOperationStatus(null)} type="button"><UiIcon name="close" size={16} /></button>
        </div>
      ) : null}

      {contextMenu ? (
        <ContextMenu
          ariaLabel="手順書操作"
          className="instructionContextMenu"
          onClose={() => setContextMenu(null)}
          opener={contextMenuOpenerRef.current}
          x={contextMenu.x}
          y={contextMenu.y}
        >
          {contextMenu.target.kind === "file" ? (
            <>
              <button onClick={() => void runContextAction("open", contextMenu.target)} role="menuitem" type="button">開く</button>
              {isEditableInstruction(contextMenu.target.name) ? (
                <button onClick={() => void runContextAction("edit", contextMenu.target)} role="menuitem" type="button">編集</button>
              ) : null}
              <button onClick={() => void runContextAction("link-project", contextMenu.target)} role="menuitem" type="button">次の一手に紐づける</button>
              <button onClick={() => void runContextAction("rename", contextMenu.target)} role="menuitem" type="button">名前を変更</button>
              <button onClick={() => void runContextAction("external", contextMenu.target)} role="menuitem" type="button">既定のエディタで開く</button>
              <button onClick={() => void runContextAction("explorer", contextMenu.target)} role="menuitem" type="button">エクスプローラーで表示</button>
              <button className="instructionContextMenuDanger" onClick={() => void runContextAction("recycle", contextMenu.target)} role="menuitem" type="button">ごみ箱へ移動</button>
            </>
          ) : contextMenu.target.kind === "root" ? (
            <>
              <button onClick={() => void runContextAction("create-file", contextMenu.target)} role="menuitem" type="button">新しい手順書</button>
              <button onClick={() => void runContextAction("create-folder", contextMenu.target)} role="menuitem" type="button">新しいフォルダ</button>
              <button onClick={() => void runContextAction("explorer", contextMenu.target)} role="menuitem" type="button">エクスプローラーで開く</button>
              <button onClick={() => void runContextAction("reload", contextMenu.target)} role="menuitem" type="button">再読み込み</button>
              <button className="instructionContextMenuDanger" onClick={() => void runContextAction("unregister", contextMenu.target)} role="menuitem" type="button">登録を解除</button>
            </>
          ) : contextMenu.target.kind === "folder" ? (
            <>
              <button onClick={() => void runContextAction("create-file", contextMenu.target)} role="menuitem" type="button">新しい手順書</button>
              <button onClick={() => void runContextAction("create-folder", contextMenu.target)} role="menuitem" type="button">新しいフォルダ</button>
              <button onClick={() => void runContextAction("rename", contextMenu.target)} role="menuitem" type="button">名前を変更</button>
              <button onClick={() => void runContextAction("explorer", contextMenu.target)} role="menuitem" type="button">エクスプローラーで開く</button>
              <button className="instructionContextMenuDanger" onClick={() => void runContextAction("recycle", contextMenu.target)} role="menuitem" type="button">ごみ箱へ移動</button>
            </>
          ) : (
            <>
              <button onClick={() => void runContextAction("create-file", contextMenu.target)} role="menuitem" type="button">新しい手順書</button>
              <button onClick={() => void runContextAction("create-folder", contextMenu.target)} role="menuitem" type="button">新しいフォルダ</button>
              <button onClick={() => void runContextAction("reload", contextMenu.target)} role="menuitem" type="button">再読み込み</button>
            </>
          )}
        </ContextMenu>
      ) : null}

      {operationDialog ? (
        <div
          className="modalBackdrop instructionOperationBackdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !operationSubmitting) setOperationDialog(null);
          }}
          role="presentation"
        >
          <section aria-label="手順書操作" aria-modal="true" className="dropDialog instructionOperationDialog" ref={operationDialogRef} role="dialog" tabIndex={-1}>
            <div className="confirmDialogHeader">
              <h2>
                {operationDialog.kind === "create-file"
                  ? "新しい手順書"
                  : operationDialog.kind === "create-folder"
                    ? "新しいフォルダ"
                    : "名前を変更"}
              </h2>
              <button aria-label="操作を閉じる" title="閉じる" className="confirmDialogClose" disabled={operationSubmitting} onClick={() => setOperationDialog(null)} type="button"><UiIcon name="close" size={16} /></button>
            </div>
            <form
              className="instructionOperationForm"
              onSubmit={(event) => {
                event.preventDefault();
                void submitOperationDialog();
              }}
            >
              {(operationDialog.kind === "create-file" || operationDialog.kind === "create-folder") && !operationDialog.parentPath ? (
                <label className="fieldStack">
                  <span>作成先</span>
                  <select disabled={operationSubmitting} onChange={(event) => setOperationParent(event.target.value)} value={operationParent}>
                    {roots.filter((root) => root.available).map((root) => (
                      <option key={root.path} value={root.path}>{root.name}</option>
                    ))}
                  </select>
                </label>
              ) : null}
              <label className="fieldStack">
                <span>名前</span>
                <input
                  disabled={operationSubmitting}
                  maxLength={48}
                  onChange={(event) => setOperationName(event.target.value)}
                  ref={operationNameRef}
                  value={operationName}
                />
              </label>
              {operationDialog.kind === "create-file" ? (
                <label className="fieldStack">
                  <span>形式</span>
                  <select disabled={operationSubmitting} onChange={(event) => setOperationExtension(event.target.value as "md" | "txt")} value={operationExtension}>
                    <option value="md">Markdown (.md)</option>
                    <option value="txt">Text (.txt)</option>
                  </select>
                </label>
              ) : operationDialog.kind === "rename-file" ? (
                <div className="instructionOperationExtension">拡張子: .{operationDialog.extension}</div>
              ) : null}
              {operationError ? <p className="fieldError" role="alert">{operationError}</p> : null}
              <div className="dialogActions">
                <button className="secondaryButton settingsButton--neutral" disabled={operationSubmitting} onClick={() => setOperationDialog(null)} type="button">キャンセル</button>
                <button className="primaryButton" disabled={operationSubmitting || !operationName.trim()} type="submit">
                  {operationSubmitting ? "処理中…" : operationDialog.kind.startsWith("create") ? "作成" : "変更"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {projectLinkDialog ? (
        <div
          className="modalBackdrop instructionOperationBackdrop"
          onClick={(event) => {
            if (event.target === event.currentTarget && !projectLinkSubmitting) {
              setProjectLinkDialog(null);
            }
          }}
          role="presentation"
        >
          <section
            aria-label="次の一手に手順書を紐づける"
            aria-modal="true"
            className="dropDialog instructionOperationDialog"
            ref={projectLinkDialogRef}
            role="dialog"
            tabIndex={-1}
          >
            <div className="confirmDialogHeader">
              <h2>次の一手に紐づける</h2>
              <button
                aria-label="紐付けを閉じる" title="閉じる"
                className="confirmDialogClose"
                disabled={projectLinkSubmitting}
                onClick={() => setProjectLinkDialog(null)}
                type="button"
              >
                <UiIcon name="close" size={16} />
              </button>
            </div>
            <form
              className="instructionOperationForm"
              onSubmit={(event) => {
                event.preventDefault();
                void submitProjectLink();
              }}
            >
              <div className="fieldStack">
                <span>手順書</span>
                <strong>{projectLinkDialog.name}</strong>
              </div>
              <label className="fieldStack">
                <span>次の一手</span>
                <select
                  disabled={projectLinkSubmitting}
                  onChange={(event) =>
                    setProjectLinkDialog({
                      ...projectLinkDialog,
                      projectId: event.target.value,
                    })
                  }
                  ref={projectLinkSelectRef}
                  value={projectLinkDialog.projectId}
                >
                  {projectLinkDialog.projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              {projectLinkDialog.projects.find(
                (project) => project.id === projectLinkDialog.projectId,
              )?.instructionPath ? (
                <p className="quietText">現在の手順書設定は、この手順書へ置き換わります。</p>
              ) : null}
              <p className="quietText">プロジェクト開始時に手順書を開く設定も有効になります。</p>
              <div className="dialogActions">
                <button
                  className="secondaryButton settingsButton--neutral"
                  disabled={projectLinkSubmitting}
                  onClick={() => setProjectLinkDialog(null)}
                  type="button"
                >
                  キャンセル
                </button>
                <button className="primaryButton" disabled={projectLinkSubmitting} type="submit">
                  {projectLinkSubmitting ? "保存中…" : "紐づける"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      <ConfirmDialog
        confirmLabel={confirmState?.kind === "unregister" ? "登録を解除" : "ごみ箱へ移動"}
        message={confirmState?.message}
        onCancel={() => setConfirmState(null)}
        onConfirm={runConfirmedOperation}
        open={Boolean(confirmState)}
        subject={confirmState ? `「${confirmState.target.name}」` : undefined}
        title={confirmState?.kind === "unregister" ? "手順書フォルダの登録を解除しますか？" : "ごみ箱へ移動しますか？"}
        tone={confirmState?.kind === "unregister" ? "warning" : "danger"}
      />
    </div>
  );
}
