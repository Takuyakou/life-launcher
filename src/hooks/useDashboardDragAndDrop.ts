import {
  useCallback,
  useEffect,
  useRef,
  type Dispatch,
  type DragEvent,
  type PointerEvent,
  type SetStateAction,
} from "react";
import { listen } from "@tauri-apps/api/event";
import { getCurrentWebview } from "@tauri-apps/api/webview";
import { enableMainShellDrop, readImportJson, resolveDropItem, undoImport } from "../tauri";
import { DEFAULT_BUTTON_GROUP, TODAY_ITEM_LIMIT } from "../constants";
import {
  ACTION_DRAG_TYPE,
  OVERLAY_PAGE_DRAG_TYPE,
  SIDEBAR_DRAG_THRESHOLD_PX,
} from "../app/constants";
import {
  draggedCardTopWithinTodayRemoveDropZone,
  inboxDropTargetFromPoint,
  isReorderBlockedTarget,
  pointWithinSelector,
  pointWithinTodayRemoveDropZone,
  projectDropIndicator,
  projectDropTargetFromPoint,
  sidebarDropTargetFromPoint,
  sidebarGroupDropTargetFromPoint,
  todayAdoptionDropTargetFromPoint,
  todayDropTargetFromPoint,
  wishlistGroupDropTargetFromPoint,
} from "../app/dropTargets";
import {
  buttonGroupName,
  dropPositionToCss,
  firstDroppedUrl,
  showButtonInSidebar,
  todaySourceKey,
  todayTimerSourceId,
  uniqueGroupNames,
} from "../app/helpers";
import { reorderWishlistGroups, wishlistGroupKey } from "../nextStepWishlist";
import { todayCandidateFromConfig, type TodayCandidate } from "../todayCandidates";
import type {
  ActiveTimer,
  ContextMenuState,
  DropDialogState,
  InboxDragPreview,
  InboxPointerDrag,
  InternalButtonDrag,
  MainShellDropEvent,
  ProjectDragPreview,
  ProjectPointerDrag,
  SidebarDragPreview,
  SidebarGroupDragPreview,
  SidebarGroupPointerDrag,
  SidebarPointerDrag,
  TodayDragPreview,
  TodayPointerDrag,
  ToastOptions,
  ToastTone,
  WishlistGroupDragPreview,
  WishlistGroupPointerDrag,
  WishlistGroupView,
} from "../app/dashboardTypes";
import type {
  AppConfig,
  DropResolveInput,
  ImportCommitResponse,
  LauncherAction,
  LauncherButton,
  LauncherProject,
  OverlayPage,
} from "../types";

// V164-A6: the file drop and the sidebar, Today, Next Step, wishlist and group pointer drag,
// moved out of App.tsx. The body is the same code in the same order; every input arrives in one
// deps object.

export type DashboardDragAndDropDeps = {
  actions: {
    addCandidateToToday: (
      candidate: TodayCandidate,
      insertionIndex?: number,
    ) => Promise<unknown>;
    isTimerActiveForSource: (sourceKeys: string[], projectId?: string) => boolean;
    persistConfig: (
      nextConfig: AppConfig,
      applySettingsAfterSave?: boolean,
      options?: { errorToastMessage?: string },
    ) => Promise<boolean>;
    promoteWishlistToProject: (wishlistId: string) => Promise<unknown>;
    removeProjectNextStep: (
      project: LauncherProject,
      choice: "return" | "delete",
    ) => Promise<unknown>;
    removeTodayItem: (sourceKey: string) => Promise<unknown>;
    runActions: (id: string, actions: LauncherAction[]) => Promise<void>;
    showToast: (tone: ToastTone, message: string, options?: ToastOptions) => void;
    sourceEditBlocked: (key: string, allowTodaySourceSync?: boolean) => boolean;
    sourceEditBlockReason: (key: string, allowTodaySourceSync?: boolean) => string | null;
    toggleGroupCollapsed: (groupName: string) => void;
    warnSourceEditBlocked: (key: string, allowTodaySourceSync?: boolean) => boolean;
  };
  refs: {
    activeTimerRef: { current: ActiveTimer | null };
    configRef: { current: AppConfig | null };
    dragPathsRef: { current: string[] };
    importOpenerRef: { current: HTMLElement | null };
    inboxPointerDragRef: { current: InboxPointerDrag | null };
    lastDropRef: { current: { signature: string; at: number } | null };
    mainScrollAreaRef: { current: HTMLDivElement | null };
    projectAutoScrollFrameRef: { current: number | null };
    projectAutoScrollSpeedRef: { current: number };
    projectPointerDragRef: { current: ProjectPointerDrag | null };
    sidebarGroupPointerDragRef: { current: SidebarGroupPointerDrag | null };
    sidebarPointerDragRef: { current: SidebarPointerDrag | null };
    todayPointerDragRef: { current: TodayPointerDrag | null };
    wishlistGroupPointerDragRef: { current: WishlistGroupPointerDrag | null };
  };
  setters: {
    setActionDragId: Dispatch<SetStateAction<string | null>>;
    setBuilderKind: Dispatch<SetStateAction<"file" | "folder" | "url" | null>>;
    setConfig: Dispatch<SetStateAction<AppConfig | null>>;
    setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
    setDragActive: Dispatch<SetStateAction<boolean>>;
    setDropDraft: Dispatch<SetStateAction<DropDialogState | null>>;
    setImportDialogOpen: Dispatch<SetStateAction<boolean>>;
    setImportInitialError: Dispatch<SetStateAction<string | null>>;
    setImportInitialText: Dispatch<SetStateAction<string>>;
    setInboxPointerDrag: Dispatch<SetStateAction<InboxDragPreview | null>>;
    setJsonDrop: Dispatch<SetStateAction<"main" | "sidebar" | null>>;
    setOverlayPageDragId: Dispatch<SetStateAction<string | null>>;
    setProjectPointerDrag: Dispatch<SetStateAction<ProjectDragPreview | null>>;
    setReorderAnnouncement: Dispatch<SetStateAction<string>>;
    setSidebarGroupPointerDrag: Dispatch<SetStateAction<SidebarGroupDragPreview | null>>;
    setSidebarPointerDrag: Dispatch<SetStateAction<SidebarDragPreview | null>>;
    setTodayPointerDrag: Dispatch<SetStateAction<TodayDragPreview | null>>;
    setWishlistGroupPointerDrag: Dispatch<SetStateAction<WishlistGroupDragPreview | null>>;
    setWishlistGroupViews: Dispatch<SetStateAction<Record<string, WishlistGroupView>>>;
  };
  state: {
    config: AppConfig | null;
    groupNames: string[];
    overlayPages: OverlayPage[];
  };
};

export function useDashboardDragAndDrop(deps: DashboardDragAndDropDeps) {
  const { actions, refs, setters, state } = deps;
  const {
    addCandidateToToday,
    isTimerActiveForSource,
    persistConfig,
    promoteWishlistToProject,
    removeProjectNextStep,
    removeTodayItem,
    runActions,
    showToast,
    sourceEditBlocked,
    sourceEditBlockReason,
    toggleGroupCollapsed,
    warnSourceEditBlocked,
  } = actions;
  const {
    activeTimerRef,
    configRef,
    dragPathsRef,
    importOpenerRef,
    inboxPointerDragRef,
    lastDropRef,
    mainScrollAreaRef,
    projectAutoScrollFrameRef,
    projectAutoScrollSpeedRef,
    projectPointerDragRef,
    sidebarGroupPointerDragRef,
    sidebarPointerDragRef,
    todayPointerDragRef,
    wishlistGroupPointerDragRef,
  } = refs;
  const {
    setActionDragId,
    setBuilderKind,
    setConfig,
    setContextMenu,
    setDragActive,
    setDropDraft,
    setImportDialogOpen,
    setImportInitialError,
    setImportInitialText,
    setInboxPointerDrag,
    setJsonDrop,
    setOverlayPageDragId,
    setProjectPointerDrag,
    setReorderAnnouncement,
    setSidebarGroupPointerDrag,
    setSidebarPointerDrag,
    setTodayPointerDrag,
    setWishlistGroupPointerDrag,
    setWishlistGroupViews,
  } = setters;
  const { config, groupNames, overlayPages } = state;

  const mainDropStateRef = useRef({
    config,
    groupNames,
    overlayPages,
  });
  mainDropStateRef.current = {
    config,
    groupNames,
    overlayPages,
  };

  const openDropDialog = useCallback(
    async (input: DropResolveInput, suggestedLabel?: string | null) => {
      const state = mainDropStateRef.current;
      if (!state.config) return;
      try {
        const draft = await resolveDropItem(
          input.kind === "url" ? { ...input, suggestedLabel } : input,
        );
        setBuilderKind(null);
        setDropDraft({
          ...draft,
          label: draft.label,
          group: draft.group?.trim() || state.groupNames[0] || DEFAULT_BUTTON_GROUP,
          groupMode: state.groupNames.length > 0 ? "existing" : "new",
          existingGroup: draft.group?.trim() || state.groupNames[0] || DEFAULT_BUTTON_GROUP,
          newGroup: "",
          showInSidebar: true,
          showInOverlay: true,
          overlayPageId: null,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `登録できません: ${message}`);
      }
    },
    [setBuilderKind, setDropDraft, showToast],
  );

  const handleDroppedPaths = useCallback(
    async (paths: string[]) => {
      setDragActive(false);
      if (paths.length === 0) return;
      if (paths.length > 1) {
        showToast("warn", "複数ドロップ時は先頭の1件だけ登録します");
      }
      await openDropDialog({ kind: "path", value: paths[0] });
    },
    [openDropDialog, setDragActive, showToast],
  );

  const dropSideFromPosition = useCallback(
    (position: { x: number; y: number }): "main" | "sidebar" | null => {
      const element = document.elementFromPoint(position.x, position.y);
      if (element?.closest(".sidebar")) return "sidebar";
      if (element?.closest(".mainPanel")) return "main";
      return null;
    },
    [],
  );

  const dropModalOpen = useCallback(
    () => Boolean(document.querySelector('.modalBackdrop:not([data-exiting="true"])')),
    [],
  );

  const openImportDialog = useCallback(
    (text: string, error: string | null = null, opener?: HTMLElement | null) => {
      importOpenerRef.current =
        opener ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
      setImportInitialText(text);
      setImportInitialError(error);
      setImportDialogOpen(true);
    },
    [importOpenerRef, setImportDialogOpen, setImportInitialError, setImportInitialText],
  );

  const closeImportDialog = useCallback(() => {
    setImportDialogOpen(false);
    const opener = importOpenerRef.current;
    importOpenerRef.current = null;
    window.requestAnimationFrame(() => opener?.focus({ preventScroll: true }));
  }, [importOpenerRef, setImportDialogOpen]);

  const handleImported = useCallback(
    (response: ImportCommitResponse) => {
      setConfig(response.config);
      closeImportDialog();
      const counts = response.preview.counts;
      const total =
        counts.newProjects + counts.existingProjects + counts.nextSteps + counts.wishes;
      showToast("ok", `${total}件を取り込みました`, {
        detail: counts.rejected > 0 ? `${counts.rejected}件は取り込めませんでした` : undefined,
        actionLabel: "元に戻す",
        onAction: async () => {
          try {
            const undone = await undoImport(response.importId, response.fingerprint);
            setConfig(undone.config);
            return true;
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            showToast("warn", message.replace(/^changed:/, ""));
            return false;
          }
        },
      });
    },
    [closeImportDialog, setConfig, showToast],
  );

  const claimDrop = useCallback((paths: string[]) => {
    const signature = paths.join("\u0000");
    const now = Date.now();
    if (
      lastDropRef.current &&
      lastDropRef.current.signature === signature &&
      now - lastDropRef.current.at < 1000
    ) {
      return false;
    }
    lastDropRef.current = { signature, at: now };
    return true;
  }, [lastDropRef]);

  const handleDropAt = useCallback(
    async (paths: string[], cssPosition: { x: number; y: number } | null) => {
      setDragActive(false);
      setJsonDrop(null);
      if (paths.length === 0) return;
      if (!claimDrop(paths)) return;
      const modalOpen = dropModalOpen();
      const side = cssPosition ? dropSideFromPosition(cssPosition) : null;
      if (
        paths.length === 1 &&
        /\.json$/i.test(paths[0]) &&
        side === "main" &&
        !modalOpen
      ) {
        try {
          const text = await readImportJson(paths[0]);
          openImportDialog(text);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          openImportDialog("", message);
        }
        return;
      }
      await handleDroppedPaths(paths);
    },
    [
      claimDrop,
      dropModalOpen,
      dropSideFromPosition,
      handleDroppedPaths,
      openImportDialog,
      setDragActive,
      setJsonDrop,
    ],
  );

  const openRecycleBinDropDialog = useCallback(() => {
    const state = mainDropStateRef.current;
    setDropDraft({
      label: "ごみ箱",
      group: state.groupNames[0] ?? DEFAULT_BUTTON_GROUP,
      groupMode: state.groupNames.length > 0 ? "existing" : "new",
      existingGroup: state.groupNames[0] ?? DEFAULT_BUTTON_GROUP,
      newGroup: "",
      iconSource: null,
      action: {
        type: "open_shell_special",
        payload: { item: "recycle_bin" },
      },
      source: "Windowsデスクトップのごみ箱",
      showInSidebar: true,
      showInOverlay: true,
      overlayPageId: null,
    });
  }, [setDropDraft]);

  useEffect(() => {
    let mounted = true;
    let unlisten: (() => void) | undefined;

    listen<MainShellDropEvent>("main-shell-drop-result", (event) => {
      if (!mounted || event.payload.windowLabel !== "main") return;
      if (event.payload.stage === "error") {
        setDragActive(false);
        showToast("error", `D&Dを初期化できません: ${event.payload.message}`);
        return;
      }
      if (event.payload.stage === "dragEnter" || event.payload.stage === "dragOver") {
        const isJson =
          event.payload.paths.length === 1 && /\.json$/i.test(event.payload.paths[0]);
        if (isJson && event.payload.position && !dropModalOpen()) {
          setDragActive(false);
          setJsonDrop(dropSideFromPosition(dropPositionToCss(event.payload.position)));
        } else {
          setJsonDrop(null);
          setDragActive(true);
        }
        return;
      }
      if (event.payload.stage === "dragLeave") {
        setDragActive(false);
        setJsonDrop(null);
        return;
      }

      setDragActive(false);
      setJsonDrop(null);
      if (event.payload.paths.length > 0) {
        void handleDropAt(
          event.payload.paths,
          event.payload.position ? dropPositionToCss(event.payload.position) : null,
        );
        return;
      }
      if (event.payload.url) {
        void openDropDialog({ kind: "url", value: event.payload.url }, event.payload.label);
        return;
      }
      if (event.payload.shellSpecial === "recycle_bin") {
        openRecycleBinDropDialog();
      }
    })
      .then((dispose) => {
        if (mounted) {
          unlisten = dispose;
          void enableMainShellDrop().catch((error) => {
            const message = error instanceof Error ? error.message : String(error);
            showToast("error", `D&Dを初期化できません: ${message}`);
          });
        } else {
          dispose();
        }
      })
      .catch(() => undefined);

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [
    dropModalOpen,
    dropSideFromPosition,
    handleDropAt,
    openDropDialog,
    openRecycleBinDropDialog,
    setDragActive,
    setJsonDrop,
    showToast,
  ]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let mounted = true;

    getCurrentWebview()
      .onDragDropEvent((event) => {
        const payload = event.payload;
        if (payload.type === "enter") {
          dragPathsRef.current = payload.paths;
          const isJson =
            payload.paths.length === 1 && /\.json$/i.test(payload.paths[0]);
          if (isJson && !dropModalOpen()) {
            setDragActive(false);
            setJsonDrop(dropSideFromPosition(dropPositionToCss(payload.position)));
          } else {
            setJsonDrop(null);
            setDragActive(true);
          }
        } else if (payload.type === "over") {
          const paths = dragPathsRef.current;
          const isJson = paths.length === 1 && /\.json$/i.test(paths[0]);
          if (isJson && !dropModalOpen()) {
            setDragActive(false);
            setJsonDrop(dropSideFromPosition(dropPositionToCss(payload.position)));
          } else {
            setJsonDrop(null);
            setDragActive(true);
          }
        } else if (payload.type === "leave") {
          dragPathsRef.current = [];
          setDragActive(false);
          setJsonDrop(null);
        } else if (payload.type === "drop") {
          dragPathsRef.current = [];
          void handleDropAt(payload.paths, dropPositionToCss(payload.position));
        }
      })
      .then((dispose) => {
        if (mounted) {
          unlisten = dispose;
        } else {
          dispose();
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        showToast("error", `D&Dを初期化できません: ${message}`);
      });

    return () => {
      mounted = false;
      unlisten?.();
    };
  }, [
    dragPathsRef,
    dropModalOpen,
    dropSideFromPosition,
    handleDropAt,
    setDragActive,
    setJsonDrop,
    showToast,
  ]);

  const handleDomDragOver = (event: DragEvent<HTMLElement>) => {
    if (
      event.dataTransfer.types.includes(ACTION_DRAG_TYPE) ||
      event.dataTransfer.types.includes(OVERLAY_PAGE_DRAG_TYPE)
    ) {
      event.preventDefault();
      return;
    }
    event.preventDefault();
    setJsonDrop(null);
    setDragActive(true);
  };

  const handleDomDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setDragActive(false);
    setJsonDrop(null);

    if (event.dataTransfer.types.includes(ACTION_DRAG_TYPE)) {
      setActionDragId(null);
      return;
    }
    if (event.dataTransfer.types.includes(OVERLAY_PAGE_DRAG_TYPE)) {
      setOverlayPageDragId(null);
      return;
    }

    const text =
      event.dataTransfer.getData("text/uri-list") || event.dataTransfer.getData("text/plain");
    const url = firstDroppedUrl(text);
    if (!url) return;
    try {
      const dropped = new URL(url);
      if (
        dropped.origin === window.location.origin ||
        dropped.hostname === "tauri.localhost" ||
        dropped.hostname === "asset.localhost"
      ) {
        return;
      }
    } catch {
      return;
    }

    void openDropDialog({ kind: "url", value: url });
  };

  const moveButtonInSidebar = (
    draggedButtonId: string,
    targetGroupName: string,
    targetButtonId?: string,
  ) => {
    if (!config) return;
    if (targetButtonId === draggedButtonId) return;
    const draggedButton = config.buttons.find((button) => button.id === draggedButtonId);
    if (!draggedButton) return;

    const targetGroup = targetGroupName === DEFAULT_BUTTON_GROUP ? undefined : targetGroupName;
    const movedButton = { ...draggedButton, group: targetGroup };
    const withoutDragged = config.buttons.filter((button) => button.id !== draggedButtonId);
    const targetIndex = targetButtonId
      ? withoutDragged.findIndex((button) => button.id === targetButtonId)
      : -1;
    const draggedIndex = config.buttons.findIndex((button) => button.id === draggedButtonId);
    const originalTargetIndex = targetButtonId
      ? config.buttons.findIndex((button) => button.id === targetButtonId)
      : -1;

    let insertIndex: number;
    if (targetIndex >= 0) {
      insertIndex = draggedIndex < originalTargetIndex ? targetIndex + 1 : targetIndex;
    } else {
      const buttonsInGroup = withoutDragged
        .map((button, index) => ({ button, index }))
        .filter(({ button }) => buttonGroupName(button) === targetGroupName);
      const lastInGroup = buttonsInGroup[buttonsInGroup.length - 1];
      insertIndex = lastInGroup ? lastInGroup.index + 1 : withoutDragged.length;
    }

    const nextButtons = [...withoutDragged];
    nextButtons.splice(insertIndex, 0, movedButton);
    void persistConfig({ ...config, buttons: nextButtons });
  };

  const moveGroupInSidebar = (
    draggedGroupName: string,
    targetGroupName: string,
    placement: "before" | "after",
  ) => {
    if (!config || draggedGroupName === targetGroupName) return;

    const orderedGroups = uniqueGroupNames(config);
    const withoutDragged = orderedGroups.filter((name) => name !== draggedGroupName);
    const targetIndex = withoutDragged.indexOf(targetGroupName);
    if (targetIndex < 0) return;

    const insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
    const nextGroups = [...withoutDragged];
    nextGroups.splice(insertIndex, 0, draggedGroupName);
    void persistConfig({ ...config, groups: nextGroups });
  };

  const moveTodayItem = (
    draggedIndex: number,
    targetIndex: number,
    placement: "before" | "after",
  ) => {
    if (!config || draggedIndex === targetIndex) return;

    const draggedItem = config.today.items[draggedIndex];
    if (!draggedItem || !config.today.items[targetIndex]) return;

    const withoutDragged = config.today.items.filter((_, index) => index !== draggedIndex);
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) {
      insertIndex -= 1;
    }
    if (placement === "after") {
      insertIndex += 1;
    }

    const items = [...withoutDragged];
    items.splice(insertIndex, 0, draggedItem);
    void persistConfig({ ...config, today: { ...config.today, items } });
  };

  const moveProject = (
    draggedProjectId: string,
    targetProjectId: string,
    placement: "before" | "after",
  ) => {
    if (!config || draggedProjectId === targetProjectId) return;

    const draggedProject = config.projects.find((project) => project.id === draggedProjectId);
    const draggedIndex = config.projects.findIndex((project) => project.id === draggedProjectId);
    const targetIndex = config.projects.findIndex((project) => project.id === targetProjectId);
    if (!draggedProject || draggedIndex < 0 || targetIndex < 0) return;

    const withoutDragged = config.projects.filter((project) => project.id !== draggedProjectId);
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) {
      insertIndex -= 1;
    }
    if (placement === "after") {
      insertIndex += 1;
    }

    const projects = [...withoutDragged];
    projects.splice(insertIndex, 0, draggedProject);
    void persistConfig({ ...config, projects });
  };

  const moveInboxItem = (
    draggedIndex: number,
    targetIndex: number,
    placement: "before" | "after",
  ) => {
    if (!config || draggedIndex === targetIndex) return;
    const draggedItem = config.inbox[draggedIndex];
    const targetItem = config.inbox[targetIndex];
    if (!draggedItem || !targetItem) return;
    const projectIds = new Set(config.projects.map((project) => project.id));
    if (wishlistGroupKey(draggedItem, projectIds) !== wishlistGroupKey(targetItem, projectIds))
      return;

    const withoutDragged = config.inbox.filter((_, index) => index !== draggedIndex);
    let insertIndex = targetIndex;
    if (draggedIndex < targetIndex) insertIndex -= 1;
    if (placement === "after") insertIndex += 1;

    const inbox = [...withoutDragged];
    inbox.splice(insertIndex, 0, draggedItem);
    void persistConfig({ ...config, inbox });
  };

  const moveWishlistGroup = (
    draggedKey: string,
    targetKey: string,
    placement: "before" | "after",
  ) => {
    const current = configRef.current;
    if (!current || draggedKey === targetKey || draggedKey === "unassigned") return;
    const nextConfig = reorderWishlistGroups(
      current,
      draggedKey,
      targetKey,
      targetKey === "unassigned" ? "before" : placement,
    );
    if (nextConfig === current) return;
    void persistConfig(nextConfig);
  };

  const announceReorder = (label: string, position: number) => {
    setReorderAnnouncement(`「${label}」を${position}番目へ移動しました`);
  };

  const focusAfterReorder = (focusTarget: () => void) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(focusTarget);
    });
  };

  const moveSidebarButtonByOffset = async (buttonId: string, offset: -1 | 1) => {
    if (!config) return;
    const button = config.buttons.find((item) => item.id === buttonId);
    if (!button || !showButtonInSidebar(button)) return;
    const groupName = buttonGroupName(button);
    const groupButtons = config.buttons.filter(
      (item) => showButtonInSidebar(item) && buttonGroupName(item) === groupName,
    );
    const index = groupButtons.findIndex((item) => item.id === buttonId);
    const target = groupButtons[index + offset];
    if (index < 0 || !target) return;

    const withoutButton = config.buttons.filter((item) => item.id !== buttonId);
    const targetIndex = withoutButton.findIndex((item) => item.id === target.id);
    if (targetIndex < 0) return;
    const nextButtons = [...withoutButton];
    nextButtons.splice(targetIndex + (offset === 1 ? 1 : 0), 0, button);

    if (!(await persistConfig({ ...config, buttons: nextButtons }))) return;
    announceReorder(button.label, index + offset + 1);
    focusAfterReorder(() => {
      const wrapper = Array.from(
        document.querySelectorAll<HTMLElement>("[data-sidebar-button-id]"),
      ).find((element) => element.dataset.sidebarButtonId === buttonId);
      wrapper?.querySelector<HTMLButtonElement>(".quickButton")?.focus();
    });
  };

  const moveSidebarGroupByOffset = async (groupName: string, offset: -1 | 1) => {
    if (!config) return;
    const groups = uniqueGroupNames(config);
    const index = groups.indexOf(groupName);
    const target = groups[index + offset];
    if (index < 0 || !target) return;
    const nextGroups = [...groups];
    [nextGroups[index], nextGroups[index + offset]] = [
      nextGroups[index + offset],
      nextGroups[index],
    ];

    if (!(await persistConfig({ ...config, groups: nextGroups }))) return;
    announceReorder(groupName, index + offset + 1);
    focusAfterReorder(() => {
      const header = Array.from(
        document.querySelectorAll<HTMLButtonElement>("button[data-sidebar-group-name]"),
      ).find((element) => element.dataset.sidebarGroupName === groupName);
      header?.focus();
    });
  };

  const moveTodayItemByOffset = async (index: number, offset: -1 | 1) => {
    if (!config) return;
    const targetIndex = index + offset;
    const item = config.today.items[index];
    if (!item || !config.today.items[targetIndex]) return;
    const items = [...config.today.items];
    [items[index], items[targetIndex]] = [items[targetIndex], items[index]];

    if (!(await persistConfig({ ...config, today: { ...config.today, items } }))) return;
    announceReorder(item.text || "未入力", targetIndex + 1);
    focusAfterReorder(() => {
      document.querySelector<HTMLElement>(`[data-today-index="${targetIndex}"]`)?.focus();
    });
  };

  const moveInboxItemByOffset = async (index: number, offset: -1 | 1) => {
    if (!config) return;
    const item = config.inbox[index];
    if (!item) return;
    const projectIds = new Set(config.projects.map((project) => project.id));
    const key = wishlistGroupKey(item, projectIds);
    const groupIndexes = config.inbox.flatMap((candidate, candidateIndex) =>
      wishlistGroupKey(candidate, projectIds) === key ? [candidateIndex] : [],
    );
    const groupIndex = groupIndexes.indexOf(index);
    const targetIndex = groupIndexes[groupIndex + offset];
    if (targetIndex === undefined || !config.inbox[targetIndex]) return;
    const inbox = [...config.inbox];
    [inbox[index], inbox[targetIndex]] = [inbox[targetIndex], inbox[index]];

    if (!(await persistConfig({ ...config, inbox }))) return;
    setContextMenu(null);
    announceReorder(item.text, targetIndex + 1);
    focusAfterReorder(() => {
      document.querySelector<HTMLElement>(`[data-inbox-index="${targetIndex}"]`)?.focus();
    });
  };

  const startSidebarPointerDrag = (
    event: PointerEvent<HTMLButtonElement>,
    drag: InternalButtonDrag,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    sidebarPointerDragRef.current = {
      ...drag,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateSidebarPointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = sidebarPointerDragRef.current;
    if (!drag) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (drag.hasMoved) {
      const target = sidebarDropTargetFromPoint(event.clientX, event.clientY, drag.id);
      setSidebarPointerDrag({
        id: drag.id,
        group: drag.group,
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: drag.offsetX,
        offsetY: drag.offsetY,
        width: drag.width,
        height: drag.height,
        targetIndicator: target?.indicator,
        targetButtonId: target?.buttonId,
        targetGroupName: target?.groupName,
      });
    }
  };

  const finishSidebarPointerDrag = (
    event: PointerEvent<HTMLButtonElement>,
    button: LauncherButton,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const drag = sidebarPointerDragRef.current;
    sidebarPointerDragRef.current = null;
    setSidebarPointerDrag(null);

    if (!drag) return;
    if (!drag.hasMoved) {
      void runActions(button.id, button.actions);
      return;
    }

    const target = sidebarDropTargetFromPoint(event.clientX, event.clientY, drag.id);
    if (!target || target.buttonId === drag.id) return;
    moveButtonInSidebar(drag.id, target.groupName, target.buttonId);
  };

  const cancelSidebarPointerDrag = () => {
    sidebarPointerDragRef.current = null;
    setSidebarPointerDrag(null);
  };

  const startSidebarGroupPointerDrag = (
    event: PointerEvent<HTMLButtonElement>,
    groupName: string,
  ) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    sidebarGroupPointerDragRef.current = {
      group: groupName,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateSidebarGroupPointerDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const drag = sidebarGroupPointerDragRef.current;
    if (!drag) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (drag.hasMoved) {
      const target = sidebarGroupDropTargetFromPoint(event.clientX, event.clientY);
      setSidebarGroupPointerDrag({
        group: drag.group,
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: drag.offsetX,
        offsetY: drag.offsetY,
        width: drag.width,
        height: drag.height,
        targetGroupName: target?.groupName,
        placement: target?.placement,
      });
    }
  };

  const finishSidebarGroupPointerDrag = (
    event: PointerEvent<HTMLButtonElement>,
    groupName: string,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    const drag = sidebarGroupPointerDragRef.current;
    sidebarGroupPointerDragRef.current = null;
    setSidebarGroupPointerDrag(null);

    if (!drag) return;
    if (!drag.hasMoved) {
      toggleGroupCollapsed(groupName);
      return;
    }

    const target = sidebarGroupDropTargetFromPoint(event.clientX, event.clientY);
    if (!target) return;
    moveGroupInSidebar(drag.group, target.groupName, target.placement);
  };

  const cancelSidebarGroupPointerDrag = () => {
    sidebarGroupPointerDragRef.current = null;
    setSidebarGroupPointerDrag(null);
  };

  const startTodayPointerDrag = (event: PointerEvent<HTMLElement>, index: number) => {
    if (event.button !== 0 || isReorderBlockedTarget(event.target)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    todayPointerDragRef.current = {
      index,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateTodayPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = todayPointerDragRef.current;
    if (!drag) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (!drag.hasMoved) return;

    const current = configRef.current;
    const item = current?.today.items[drag.index];
    const removeEligible = Boolean(
      item && activeTimerRef.current?.sourceId !== todayTimerSourceId(item, drag.index),
    );
    const removeTargetActive =
      removeEligible &&
      (pointWithinTodayRemoveDropZone(event.clientX, event.clientY) ||
        draggedCardTopWithinTodayRemoveDropZone(
          event.clientX,
          event.clientY,
          drag.offsetX,
          drag.offsetY,
          drag.width,
        ));
    const target = todayDropTargetFromPoint(event.clientX, event.clientY);
    setTodayPointerDrag({
      index: drag.index,
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      width: drag.width,
      height: drag.height,
      removeEligible,
      removeTargetActive,
      targetIndex: target?.index,
      placement: target?.placement,
      targetIndicator: target && target.index !== drag.index ? target.indicator : undefined,
    });
  };

  const finishTodayPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = todayPointerDragRef.current;
    const current = configRef.current;
    const item = current?.today.items[drag?.index ?? -1];
    const sourceKey = item && drag ? todaySourceKey(item, drag.index) : null;
    const removeDrop =
      Boolean(
        item &&
        drag?.hasMoved &&
        activeTimerRef.current?.sourceId !== todayTimerSourceId(item, drag.index),
      ) &&
      (pointWithinTodayRemoveDropZone(event.clientX, event.clientY) ||
        draggedCardTopWithinTodayRemoveDropZone(
          event.clientX,
          event.clientY,
          drag?.offsetX ?? 0,
          drag?.offsetY ?? 0,
          drag?.width ?? 0,
        ));
    todayPointerDragRef.current = null;
    setTodayPointerDrag(null);

    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.hasMoved) return;
    if (removeDrop && sourceKey) {
      void removeTodayItem(sourceKey);
      return;
    }

    const target = todayDropTargetFromPoint(event.clientX, event.clientY);
    if (!target) return;
    moveTodayItem(drag.index, target.index, target.placement);
  };

  const cancelTodayPointerDrag = () => {
    todayPointerDragRef.current = null;
    setTodayPointerDrag(null);
  };

  const stopProjectAutoScroll = () => {
    projectAutoScrollSpeedRef.current = 0;
    if (projectAutoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(projectAutoScrollFrameRef.current);
      projectAutoScrollFrameRef.current = null;
    }
  };

  const continueProjectAutoScroll = () => {
    const scrollArea = mainScrollAreaRef.current;
    const speed = projectAutoScrollSpeedRef.current;
    if (!scrollArea || speed === 0) {
      projectAutoScrollFrameRef.current = null;
      return;
    }

    scrollArea.scrollTop += speed;
    projectAutoScrollFrameRef.current = window.requestAnimationFrame(continueProjectAutoScroll);
  };

  const updateProjectAutoScroll = (clientY: number) => {
    const scrollArea = mainScrollAreaRef.current;
    if (!scrollArea) return;

    const rect = scrollArea.getBoundingClientRect();
    const edgeSize = Math.min(72, rect.height * 0.2);
    let speed = 0;
    if (clientY < rect.top + edgeSize) {
      speed = -Math.max(4, Math.ceil((rect.top + edgeSize - clientY) / 4));
    } else if (clientY > rect.bottom - edgeSize) {
      speed = Math.max(4, Math.ceil((clientY - (rect.bottom - edgeSize)) / 4));
    }
    projectAutoScrollSpeedRef.current = Math.max(-18, Math.min(18, speed));

    if (projectAutoScrollSpeedRef.current === 0) {
      stopProjectAutoScroll();
    } else if (projectAutoScrollFrameRef.current === null) {
      projectAutoScrollFrameRef.current = window.requestAnimationFrame(continueProjectAutoScroll);
    }
  };

  const resolveProjectDropPlacement = (
    draggedId: string,
    target: { id: string; placement: "before" | "after" },
  ) => {
    const draggedIndex = config?.projects.findIndex((project) => project.id === draggedId) ?? -1;
    const targetIndex = config?.projects.findIndex((project) => project.id === target.id) ?? -1;
    if (draggedIndex < 0 || targetIndex < 0 || draggedIndex === targetIndex) {
      return target.placement;
    }
    return draggedIndex < targetIndex ? "after" : "before";
  };

  const startProjectPointerDrag = (event: PointerEvent<HTMLElement>, projectId: string) => {
    if (event.button !== 0 || isReorderBlockedTarget(event.target)) return;
    const current = configRef.current;
    if (!current) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    projectPointerDragRef.current = {
      id: projectId,
      sourceKey: `project:${projectId}`,
      origin: "nextStep",
      dayKey: current.today.date,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateProjectPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = projectPointerDragRef.current;
    if (!drag) return;

    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) {
      drag.hasMoved = true;
    }
    if (drag.hasMoved) {
      const overWishlist = pointWithinSelector(event.clientX, event.clientY, ".inboxBand");
      const overToday = pointWithinSelector(event.clientX, event.clientY, ".todayGrid");
      const current = configRef.current;
      const project = current?.projects.find((candidate) => candidate.id === drag.id);
      const candidate = current ? todayCandidateFromConfig(current, drag.sourceKey) : undefined;
      const matchingSourceKeys = candidate
        ? new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])])
        : new Set<string>();
      const todayGuidanceActive = Boolean(
        candidate &&
        current &&
        current.today.date === drag.dayKey &&
        current.today.items.length < TODAY_ITEM_LIMIT &&
        !current.today.items.some((item, index) =>
          matchingSourceKeys.has(todaySourceKey(item, index)),
        ) &&
        !isTimerActiveForSource(
          [candidate.sourceKey, ...(candidate.sourceAliases ?? [])],
          candidate.projectId,
        ),
      );
      const todayTarget = todayGuidanceActive
        ? todayAdoptionDropTargetFromPoint(event.clientX, event.clientY)
        : null;
      const wishlistEligible = Boolean(
        project?.nextStep?.text.trim() && !sourceEditBlocked(drag.sourceKey),
      );
      const target =
        overWishlist || overToday
          ? null
          : projectDropTargetFromPoint(event.clientX, event.clientY);
      const placement = target ? resolveProjectDropPlacement(drag.id, target) : undefined;
      setProjectPointerDrag({
        id: drag.id,
        pointerX: event.clientX,
        pointerY: event.clientY,
        offsetX: drag.offsetX,
        offsetY: drag.offsetY,
        width: drag.width,
        height: drag.height,
        targetId: todayTarget ? undefined : target?.id,
        placement: todayTarget ? undefined : placement,
        targetIndicator:
          !todayTarget && target && target.id !== drag.id && placement
            ? projectDropIndicator(target.id, placement)
            : undefined,
        wishlistTarget: overWishlist && wishlistEligible,
        wishlistEligible,
        todayTargetIndex: todayTarget?.insertionIndex,
        todayTargetIndicator: todayTarget?.indicator,
        todayGuidanceActive,
      });
      updateProjectAutoScroll(event.clientY);
    }
  };

  const finishProjectPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = projectPointerDragRef.current;
    projectPointerDragRef.current = null;
    setProjectPointerDrag(null);
    stopProjectAutoScroll();

    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.hasMoved) return;

    const current = configRef.current;
    const candidate = current ? todayCandidateFromConfig(current, drag.sourceKey) : undefined;
    const matchingSourceKeys = candidate
      ? new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])])
      : new Set<string>();
    const todayTarget = todayAdoptionDropTargetFromPoint(event.clientX, event.clientY);
    const canAdoptToday = Boolean(
      candidate &&
      current &&
      current.today.date === drag.dayKey &&
      current.today.items.length < TODAY_ITEM_LIMIT &&
      !current.today.items.some((item, index) =>
        matchingSourceKeys.has(todaySourceKey(item, index)),
      ) &&
      !isTimerActiveForSource(
        [candidate.sourceKey, ...(candidate.sourceAliases ?? [])],
        candidate.projectId,
      ),
    );
    if (candidate && todayTarget && canAdoptToday) {
      void addCandidateToToday(candidate, todayTarget.insertionIndex);
      return;
    }
    if (pointWithinSelector(event.clientX, event.clientY, ".todayGrid")) return;

    if (pointWithinSelector(event.clientX, event.clientY, ".inboxBand")) {
      const project = configRef.current?.projects.find((candidate) => candidate.id === drag.id);
      if (project?.nextStep?.text.trim() && !sourceEditBlocked(drag.sourceKey)) {
        void removeProjectNextStep(project, "return");
      } else if (project?.nextStep?.text.trim()) {
        warnSourceEditBlocked(drag.sourceKey);
      }
      return;
    }

    const target = projectDropTargetFromPoint(event.clientX, event.clientY);
    if (!target) return;
    moveProject(drag.id, target.id, resolveProjectDropPlacement(drag.id, target));
  };

  const cancelProjectPointerDrag = () => {
    if (!projectPointerDragRef.current) return;
    projectPointerDragRef.current = null;
    setProjectPointerDrag(null);
    stopProjectAutoScroll();
  };

  const startInboxPointerDrag = (event: PointerEvent<HTMLDivElement>, index: number) => {
    if (event.button !== 0 || isReorderBlockedTarget(event.target)) return;
    const current = configRef.current;
    const item = current?.inbox[index];
    if (!current || !item?.id) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.getBoundingClientRect();
    inboxPointerDragRef.current = {
      index,
      sourceKey: `wishlist:${item.id}`,
      origin: "wishlist",
      dayKey: current.today.date,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateInboxPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = inboxPointerDragRef.current;
    if (!drag) return;
    const current = configRef.current;
    const sourceId = drag.sourceKey.slice("wishlist:".length);
    const sourceIndex = current?.inbox.findIndex((item) => item.id === sourceId) ?? -1;
    if (sourceIndex < 0) {
      cancelInboxPointerDrag();
      return;
    }
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (!drag.hasMoved) return;

    const sourceItem = current?.inbox[sourceIndex];
    const sourceEditable = Boolean(
      sourceItem?.id && !sourceEditBlocked(`wishlist:${sourceItem.id}`),
    );
    const sourceProject = sourceItem?.projectId
      ? current?.projects.find((project) => project.id === sourceItem.projectId)
      : undefined;
    const candidate = current ? todayCandidateFromConfig(current, drag.sourceKey) : undefined;
    const matchingSourceKeys = candidate
      ? new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])])
      : new Set<string>();
    const todayGuidanceActive = Boolean(
      candidate &&
      current &&
      current.today.date === drag.dayKey &&
      current.today.items.length < TODAY_ITEM_LIMIT &&
      !current.today.items.some((item, index) =>
        matchingSourceKeys.has(todaySourceKey(item, index)),
      ) &&
      !isTimerActiveForSource(
        [candidate.sourceKey, ...(candidate.sourceAliases ?? [])],
        candidate.projectId,
      ),
    );
    const todayTarget = todayGuidanceActive
      ? todayAdoptionDropTargetFromPoint(event.clientX, event.clientY)
      : null;
    const nextStepEligible = Boolean(
      sourceEditable && sourceProject && !sourceEditBlocked(`project:${sourceProject.id}`),
    );
    const nextStepTargetProjectId =
      nextStepEligible && pointWithinSelector(event.clientX, event.clientY, ".projectsBand")
        ? sourceProject?.id
        : undefined;
    const candidateTarget =
      nextStepTargetProjectId || todayTarget
        ? null
        : inboxDropTargetFromPoint(event.clientX, event.clientY);
    const projectIds = new Set((current?.projects ?? []).map((project) => project.id));
    const targetItem = candidateTarget ? current?.inbox[candidateTarget.index] : undefined;
    const target =
      sourceItem &&
      targetItem &&
      wishlistGroupKey(sourceItem, projectIds) === wishlistGroupKey(targetItem, projectIds)
        ? candidateTarget
        : null;
    setInboxPointerDrag({
      index: sourceIndex,
      sourceKey: drag.sourceKey,
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      width: drag.width,
      height: drag.height,
      targetIndex: todayTarget ? undefined : target?.index,
      placement: todayTarget ? undefined : target?.placement,
      targetIndicator:
        !todayTarget && target && target.index !== drag.index ? target.indicator : undefined,
      nextStepEligible,
      nextStepTargetProjectId,
      todayTargetIndex: todayTarget?.insertionIndex,
      todayTargetIndicator: todayTarget?.indicator,
      todayGuidanceActive,
    });
    updateProjectAutoScroll(event.clientY);
  };

  const finishInboxPointerDrag = (event: PointerEvent<HTMLDivElement>) => {
    const drag = inboxPointerDragRef.current;
    inboxPointerDragRef.current = null;
    setInboxPointerDrag(null);
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.hasMoved) return;

    stopProjectAutoScroll();

    const current = configRef.current;
    const sourceIndex =
      current?.inbox.findIndex((item) => item.id === drag.sourceKey.slice("wishlist:".length)) ??
      -1;
    if (sourceIndex < 0) return;
    const sourceItem = current?.inbox[sourceIndex];
    const candidate = current ? todayCandidateFromConfig(current, drag.sourceKey) : undefined;
    const matchingSourceKeys = candidate
      ? new Set([candidate.sourceKey, ...(candidate.sourceAliases ?? [])])
      : new Set<string>();
    const todayTarget = todayAdoptionDropTargetFromPoint(event.clientX, event.clientY);
    const canAdoptToday = Boolean(
      candidate &&
      current &&
      current.today.date === drag.dayKey &&
      current.today.items.length < TODAY_ITEM_LIMIT &&
      !current.today.items.some((item, index) =>
        matchingSourceKeys.has(todaySourceKey(item, index)),
      ) &&
      !isTimerActiveForSource(
        [candidate.sourceKey, ...(candidate.sourceAliases ?? [])],
        candidate.projectId,
      ),
    );
    if (candidate && todayTarget && canAdoptToday) {
      void addCandidateToToday(candidate, todayTarget.insertionIndex);
      return;
    }
    if (pointWithinSelector(event.clientX, event.clientY, ".todayGrid")) return;
    const sourceProject = sourceItem?.projectId
      ? current?.projects.find((project) => project.id === sourceItem.projectId)
      : undefined;
    const overNextStep = pointWithinSelector(event.clientX, event.clientY, ".projectsBand");
    if (
      overNextStep &&
      sourceItem?.id &&
      sourceProject &&
      !sourceEditBlocked(`wishlist:${sourceItem.id}`) &&
      !sourceEditBlocked(`project:${sourceProject.id}`)
    ) {
      void promoteWishlistToProject(sourceItem.id);
      return;
    }
    if (overNextStep) {
      const blockReason = sourceItem?.id
        ? (sourceEditBlockReason(`wishlist:${sourceItem.id}`) ??
          (sourceProject ? sourceEditBlockReason(`project:${sourceProject.id}`) : null))
        : null;
      showToast("warn", blockReason ?? "このやりたいことは次の一手へ移動できません");
      return;
    }
    const target = inboxDropTargetFromPoint(event.clientX, event.clientY);
    if (!target) return;
    const placement =
      sourceIndex === target.index
        ? target.placement
        : sourceIndex < target.index
          ? "after"
          : "before";
    moveInboxItem(sourceIndex, target.index, placement);
  };

  const cancelInboxPointerDrag = () => {
    if (!inboxPointerDragRef.current) return;
    inboxPointerDragRef.current = null;
    setInboxPointerDrag(null);
    stopProjectAutoScroll();
  };

  const toggleWishlistGroup = (key: string) => {
    setWishlistGroupViews((current) => ({
      ...current,
      [key]: {
        ...current[key],
        collapsed: !current[key]?.collapsed,
      },
    }));
  };

  const startWishlistGroupPointerDrag = (
    event: PointerEvent<HTMLElement>,
    key: string,
    name: string,
  ) => {
    if (event.button !== 0 || key === "unassigned") return;
    const header = (event.target as Element).closest<HTMLElement>(".wishlistGroupHeader");
    if (!header || !event.currentTarget.contains(header)) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = header.getBoundingClientRect();
    wishlistGroupPointerDragRef.current = {
      key,
      name,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      width: rect.width,
      height: rect.height,
    };
  };

  const updateWishlistGroupPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = wishlistGroupPointerDragRef.current;
    if (!drag) return;
    const distance = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
    if (!drag.hasMoved && distance >= SIDEBAR_DRAG_THRESHOLD_PX) drag.hasMoved = true;
    if (!drag.hasMoved) return;
    const target = wishlistGroupDropTargetFromPoint(event.clientX, event.clientY);
    setWishlistGroupPointerDrag({
      key: drag.key,
      name: drag.name,
      pointerX: event.clientX,
      pointerY: event.clientY,
      offsetX: drag.offsetX,
      offsetY: drag.offsetY,
      width: drag.width,
      height: drag.height,
      targetKey: target?.key,
      placement: target?.placement,
      targetIndicator: target && target.key !== drag.key ? target.indicator : undefined,
    });
    updateProjectAutoScroll(event.clientY);
  };

  const finishWishlistGroupPointerDrag = (event: PointerEvent<HTMLElement>) => {
    const drag = wishlistGroupPointerDragRef.current;
    wishlistGroupPointerDragRef.current = null;
    setWishlistGroupPointerDrag(null);
    stopProjectAutoScroll();
    if (!drag) return;
    event.preventDefault();
    event.stopPropagation();
    if (!drag.hasMoved) {
      toggleWishlistGroup(drag.key);
      return;
    }
    const target = wishlistGroupDropTargetFromPoint(event.clientX, event.clientY);
    if (target && target.key !== drag.key) {
      moveWishlistGroup(drag.key, target.key, target.placement);
    }
  };

  const cancelWishlistGroupPointerDrag = () => {
    wishlistGroupPointerDragRef.current = null;
    setWishlistGroupPointerDrag(null);
    stopProjectAutoScroll();
  };

  return {
    announceReorder,
    cancelInboxPointerDrag,
    cancelProjectPointerDrag,
    cancelSidebarGroupPointerDrag,
    cancelSidebarPointerDrag,
    cancelTodayPointerDrag,
    cancelWishlistGroupPointerDrag,
    closeImportDialog,
    finishInboxPointerDrag,
    finishProjectPointerDrag,
    finishSidebarGroupPointerDrag,
    finishSidebarPointerDrag,
    finishTodayPointerDrag,
    finishWishlistGroupPointerDrag,
    handleDomDragOver,
    handleDomDrop,
    handleImported,
    moveInboxItemByOffset,
    moveSidebarButtonByOffset,
    moveSidebarGroupByOffset,
    moveTodayItemByOffset,
    openImportDialog,
    startInboxPointerDrag,
    startProjectPointerDrag,
    startSidebarGroupPointerDrag,
    startSidebarPointerDrag,
    startTodayPointerDrag,
    startWishlistGroupPointerDrag,
    toggleWishlistGroup,
    updateInboxPointerDrag,
    updateProjectPointerDrag,
    updateSidebarGroupPointerDrag,
    updateSidebarPointerDrag,
    updateTodayPointerDrag,
    updateWishlistGroupPointerDrag,
  };
}
