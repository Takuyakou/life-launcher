import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import type { MouseEvent, PointerEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_BUTTON_GROUP } from "../constants";
import {
  cancelDictionaryTilePointer,
  DICTIONARY_TILE_DRAG_THRESHOLD_PX,
  IDLE_DICTIONARY_TILE_POINTER_STATE,
  moveDictionaryTilePointer,
  pressDictionaryTile,
  releaseDictionaryTilePointer,
  type DictionaryTilePointerState,
} from "../dictionaryTilePointer";
import {
  moveIdToSlot,
  nearestSlotIndex,
} from "../dictionaryTileReorder";
import {
  announceDictionaryReady,
  hideDictionaryWindow,
  listenForDictionaryShown,
} from "../dictionaryWindow";
import {
  getButtonsForOverlayPage,
  getOverlayPageCounts,
  getOverlayPageNameForButton,
  isOverlayPageKeyAvailable,
  OVERLAY_ALL_PAGE_KEY,
  OVERLAY_UNCLASSIFIED_PAGE_KEY,
  overlayCustomPageKey,
  overlayPageIdFromKey,
  searchOverlayButtons,
} from "../overlayPages";
import {
  ensureButtonIconCache,
  executeActions,
  listenForConfigChanges,
  loadConfig,
} from "../tauri";
import type { AppConfig, LauncherAction, LauncherButton } from "../types";
import { useDictionaryFeatureParity } from "./DictionaryFeatureParity";
import { DictionaryFeatureParityUi } from "./DictionaryFeatureParityUi";
import { UiIcon } from "./UiIcon";

type DictionaryResizeDirection =
  "East" | "North" | "NorthEast" | "NorthWest" | "South" | "SouthEast" | "SouthWest" | "West";

type DictionaryPageTab = {
  key: string;
  name: string;
};

type DictionaryPagePointerDrag = {
  pageId: string;
  pointerId: number;
  startX: number;
  startY: number;
  dragging: boolean;
  targetId: string | null;
  after: boolean;
};
type DictionaryTileDragPreview = {
  sourceId: string;
  sourcePageKey: string;
  ids: string[];
  initialIds: string[];
  pointerX: number;
  pointerY: number;
  width: number;
  height: number;
  slots: Array<{ left: number; top: number; width: number; height: number }>;
  initialScrollTop: number;
  pageTargetKey: string | null;
};

const DICTIONARY_FOCUS_LOCK_STORAGE_KEY = "life-launcher.dictionary-focus-lock";
const DICTIONARY_TILE_GHOST_OFFSET_PX = 10;
const DICTIONARY_PAGE_HOVER_SWITCH_DELAY_MS = 240;

function readDictionaryFocusLock(): boolean {
  try {
    return window.localStorage.getItem(DICTIONARY_FOCUS_LOCK_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

const resizeHandles: Array<{ direction: DictionaryResizeDirection; className: string }> = [
  { direction: "North", className: "dictionaryResizeHandle--north" },
  { direction: "NorthEast", className: "dictionaryResizeHandle--northEast" },
  { direction: "East", className: "dictionaryResizeHandle--east" },
  { direction: "SouthEast", className: "dictionaryResizeHandle--southEast" },
  { direction: "South", className: "dictionaryResizeHandle--south" },
  { direction: "SouthWest", className: "dictionaryResizeHandle--southWest" },
  { direction: "West", className: "dictionaryResizeHandle--west" },
  { direction: "NorthWest", className: "dictionaryResizeHandle--northWest" },
];

function dictionaryPageDropTargetFromPoint(
  x: number,
  y: number,
  sourceId?: string,
): { targetId: string; after: boolean } | null {
  const tabs = Array.from(
    document.querySelectorAll<HTMLElement>(".dictionaryPageTab[data-overlay-page-id]"),
  ).flatMap((element) => {
    const targetId = element.dataset.overlayPageId;
    return targetId ? [{ element, rect: element.getBoundingClientRect(), targetId }] : [];
  });
  if (tabs.length === 0) return null;

  const top = Math.min(...tabs.map(({ rect }) => rect.top));
  const bottom = Math.max(...tabs.map(({ rect }) => rect.bottom));
  if (y < top - 8 || y > bottom + 8) return null;

  const target =
    tabs.find(({ rect }) => x >= rect.left && x <= rect.right) ??
    tabs.reduce((closest, candidate) =>
      Math.abs(x - (candidate.rect.left + candidate.rect.width / 2)) <
      Math.abs(x - (closest.rect.left + closest.rect.width / 2))
        ? candidate
        : closest,
    );
  const sourceIndex = sourceId ? tabs.findIndex((tab) => tab.targetId === sourceId) : -1;
  const targetIndex = tabs.findIndex((tab) => tab.targetId === target.targetId);
  return {
    targetId: target.targetId,
    after:
      sourceIndex >= 0 && targetIndex >= 0 && sourceIndex !== targetIndex
        ? sourceIndex < targetIndex
        : x >= target.rect.left + target.rect.width / 2,
  };
}
function actionValue(action: LauncherAction): string {
  if (action.type === "open_url") return action.payload.url;
  if (action.type === "open_shell_special") return "recycle_bin";
  return action.payload.path;
}

function iconForAction(action: LauncherAction | undefined): string {
  switch (action?.type) {
    case "open_app":
      return "▣";
    case "open_folder":
      return "□";
    case "open_url":
      return "↗";
    case "run_script":
      return ">";
    case "open_shell_special":
      return "♻";
    case "open_file":
    default:
      return "◇";
  }
}

function isSafeIconSourcePath(path: string): boolean {
  const cleanPath = path.trim();
  return Boolean(cleanPath) && !/^https?:\/\//i.test(cleanPath);
}

function buttonHasIconCacheSource(button: LauncherButton): boolean {
  if (button.iconSource?.trim()) return isSafeIconSourcePath(button.iconSource);
  return button.actions.some((action) => {
    const value = actionValue(action).trim();
    if (!value) return false;
    return action.type === "open_url" ? /^https?:\/\//i.test(value) : true;
  });
}

export function DictionaryWindow() {
  const dictionaryWindow = useMemo(() => (isTauri() ? getCurrentWindow() : null), []);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [selectedPageKey, setSelectedPageKey] = useState(OVERLAY_ALL_PAGE_KEY);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedButtonId, setSelectedButtonId] = useState<string | null>(null);
  const [launchingButtonId, setLaunchingButtonId] = useState<string | null>(null);
  const [launchError, setLaunchError] = useState<string | null>(null);
  const [buttonIconSources, setButtonIconSources] = useState<Record<string, string>>({});
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const pagePointerDragRef = useRef<DictionaryPagePointerDrag | null>(null);
  const pageClickSuppressionRef = useRef<string | null>(null);
  const [pagePointerDrag, setPagePointerDrag] = useState<DictionaryPagePointerDrag | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchFocusFrameRef = useRef<number | null>(null);
  const launchInFlightRef = useRef(false);
  const dictionaryVisibleRef = useRef(false);
  const [focusLocked, setFocusLocked] = useState(readDictionaryFocusLock);
  const focusLockedRef = useRef(focusLocked);
  const focusProtectionRef = useRef(false);
  const focusProtectionTimerRef = useRef<number | null>(null);
  const focusRestoreTimerRef = useRef<number | null>(null);
  const windowDragActiveRef = useRef(false);
  const dictionaryBlockingRef = useRef(false);
  const tilePointerRef = useRef<DictionaryTilePointerState>(IDLE_DICTIONARY_TILE_POINTER_STATE);
  const tilePointerTargetRef = useRef<HTMLElement | null>(null);
  const tileGridRef = useRef<HTMLUListElement | null>(null);
  const tilePointerResetFrameRef = useRef<number | null>(null);
  const tileItemRefs = useRef<Map<string, HTMLLIElement>>(new Map());
  const tileRectsBeforeRenderRef = useRef<Map<string, DOMRect> | null>(null);
  const dictionaryBodyRef = useRef<HTMLDivElement | null>(null);
  const autoScrollFrameRef = useRef<number | null>(null);
  const pageHoverSwitchTimerRef = useRef<number | null>(null);
  const pageHoverSwitchTargetRef = useRef<string | null>(null);
  const dragPreviewRef = useRef<DictionaryTileDragPreview | null>(null);
  const dropInFlightRef = useRef(false);
  const [dragPreview, setDragPreview] = useState<DictionaryTileDragPreview | null>(null);
  const [tilePointer, setTilePointer] = useState<DictionaryTilePointerState>(
    IDLE_DICTIONARY_TILE_POINTER_STATE,
  );

  const updateTilePointer = useCallback((next: DictionaryTilePointerState) => {
    tilePointerRef.current = next;
    setTilePointer(next);
  }, []);

  const resetTilePointer = useCallback(() => {
    if (tilePointerResetFrameRef.current !== null) {
      window.cancelAnimationFrame(tilePointerResetFrameRef.current);
      tilePointerResetFrameRef.current = null;
    }
    if (autoScrollFrameRef.current !== null) {
      window.cancelAnimationFrame(autoScrollFrameRef.current);
      autoScrollFrameRef.current = null;
    }
    if (pageHoverSwitchTimerRef.current !== null) {
      window.clearTimeout(pageHoverSwitchTimerRef.current);
      pageHoverSwitchTimerRef.current = null;
    }
    pageHoverSwitchTargetRef.current = null;
    focusProtectionRef.current = false;
    tilePointerTargetRef.current = null;
    dragPreviewRef.current = null;
    setDragPreview(null);
    updateTilePointer(IDLE_DICTIONARY_TILE_POINTER_STATE);
  }, [updateTilePointer]);

  const scheduleTilePointerReset = useCallback(() => {
    if (tilePointerResetFrameRef.current !== null) {
      window.cancelAnimationFrame(tilePointerResetFrameRef.current);
    }
    tilePointerResetFrameRef.current = window.requestAnimationFrame(resetTilePointer);
  }, [resetTilePointer]);

  const hideWindow = useCallback(async () => {
    if (!dictionaryWindow) return;
    dictionaryVisibleRef.current = false;
    await hideDictionaryWindow();
  }, [dictionaryWindow]);

  const protectFocusForClick = useCallback(() => {
    if (focusProtectionTimerRef.current !== null) {
      window.clearTimeout(focusProtectionTimerRef.current);
    }
    focusProtectionRef.current = true;
    focusProtectionTimerRef.current = window.setTimeout(() => {
      focusProtectionTimerRef.current = null;
      focusProtectionRef.current = false;
    }, 750);
  }, []);

  const toggleFocusLock = useCallback(() => {
    setFocusLocked((current) => {
      const next = !current;
      focusLockedRef.current = next;
      try {
        window.localStorage.setItem(DICTIONARY_FOCUS_LOCK_STORAGE_KEY, String(next));
      } catch {
        // The current window still keeps the selected state when storage is unavailable.
      }
      return next;
    });
  }, []);

  useEffect(() => {
    if (!dictionaryWindow) return;

    document.title = "Life Launcher - Dictionary";
    let disposed = false;
    const unlistenPromise = dictionaryWindow.onCloseRequested((event) => {
      event.preventDefault();
      void hideWindow();
    });
    void announceDictionaryReady();

    return () => {
      disposed = true;
      void unlistenPromise
        .then((unlisten) => {
          if (disposed) unlisten();
        })
        .catch(() => undefined);
    };
  }, [dictionaryWindow, hideWindow]);

  useEffect(() => {
    if (!dictionaryWindow) return;
    let disposed = false;
    const restoreFocus = () => {
      if (focusRestoreTimerRef.current !== null) {
        window.clearTimeout(focusRestoreTimerRef.current);
      }
      focusRestoreTimerRef.current = window.setTimeout(() => {
        focusRestoreTimerRef.current = null;
        if (dictionaryVisibleRef.current) void dictionaryWindow.setFocus().catch(() => undefined);
      }, 0);
    };
    const unlistenPromise = dictionaryWindow.onFocusChanged(({ payload: focused }) => {
      if (focused || !dictionaryVisibleRef.current) return;
      if (windowDragActiveRef.current) return;
      if (focusProtectionRef.current || dictionaryBlockingRef.current) {
        restoreFocus();
        return;
      }
      if (!focusLockedRef.current) {
        void hideWindow();
      }
    });
    return () => {
      disposed = true;
      if (focusRestoreTimerRef.current !== null) {
        window.clearTimeout(focusRestoreTimerRef.current);
      }
      void unlistenPromise
        .then((unlisten) => {
          if (disposed) unlisten();
        })
        .catch(() => undefined);
    };
  }, [dictionaryWindow, hideWindow]);

  useEffect(() => {
    let disposed = false;
    let reloadTimer: number | null = null;

    const refreshConfig = async () => {
      try {
        const response = await loadConfig();
        if (disposed) return;
        setConfig(response.config);
        setConfigError(response.error ?? null);
      } catch (error) {
        if (disposed) return;
        setConfigError(error instanceof Error ? error.message : String(error));
      }
    };

    void refreshConfig();
    const unlistenPromise = listenForConfigChanges(() => {
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);
      reloadTimer = window.setTimeout(() => void refreshConfig(), 250);
    });

    return () => {
      disposed = true;
      if (reloadTimer !== null) window.clearTimeout(reloadTimer);
      void unlistenPromise.then((unlisten) => unlisten()).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    if (!config) return;
    let disposed = false;
    const visibleButtons = config.buttons.filter(
      (button) => button.showInOverlay !== false && buttonHasIconCacheSource(button),
    );
    setButtonIconSources({});

    void Promise.all(
      visibleButtons.map(async (button) => {
        try {
          return [button.id, await ensureButtonIconCache(button)] as const;
        } catch {
          return [button.id, null] as const;
        }
      }),
    ).then((entries) => {
      if (disposed) return;
      setButtonIconSources(() => {
        const next: Record<string, string> = {};
        for (const [buttonId, source] of entries) {
          if (source) next[buttonId] = source;
        }
        return next;
      });
    });

    return () => {
      disposed = true;
    };
  }, [config]);

  const overlayPages = useMemo(() => config?.overlayPages ?? [], [config?.overlayPages]);
  const pageTabs = useMemo<DictionaryPageTab[]>(
    () => [
      { key: OVERLAY_ALL_PAGE_KEY, name: "すべて" },
      { key: OVERLAY_UNCLASSIFIED_PAGE_KEY, name: "未分類" },
      ...overlayPages.map((page) => ({ key: overlayCustomPageKey(page.id), name: page.name })),
    ],
    [overlayPages],
  );
  const effectiveSelectedPageKey = isOverlayPageKeyAvailable(selectedPageKey, overlayPages)
    ? selectedPageKey
    : OVERLAY_ALL_PAGE_KEY;
  const selectDictionaryPage = useCallback((pageKey: string) => {
    setSelectedPageKey(pageKey);
    setSelectedButtonId(null);
  }, []);
  const schedulePageHoverSwitch = useCallback(
    (pageKey: string | null) => {
      if (!pageKey || pageKey === effectiveSelectedPageKey) {
        if (pageHoverSwitchTimerRef.current !== null) {
          window.clearTimeout(pageHoverSwitchTimerRef.current);
          pageHoverSwitchTimerRef.current = null;
        }
        pageHoverSwitchTargetRef.current = null;
        return;
      }
      if (pageHoverSwitchTargetRef.current === pageKey) return;
      if (pageHoverSwitchTimerRef.current !== null) {
        window.clearTimeout(pageHoverSwitchTimerRef.current);
      }
      pageHoverSwitchTargetRef.current = pageKey;
      pageHoverSwitchTimerRef.current = window.setTimeout(() => {
        pageHoverSwitchTimerRef.current = null;
        pageHoverSwitchTargetRef.current = null;
        selectDictionaryPage(pageKey);
      }, DICTIONARY_PAGE_HOVER_SWITCH_DELAY_MS);
    },
    [effectiveSelectedPageKey, selectDictionaryPage],
  );
  const parity = useDictionaryFeatureParity({
    config,
    setConfig,
    selectedPageKey: effectiveSelectedPageKey,
    searchActive: Boolean(searchQuery.trim()),
    selectPage: selectDictionaryPage,
  });
  dictionaryBlockingRef.current = parity.blocking || parity.dragActive;
  const pageCounts = useMemo(
    () => getOverlayPageCounts(config?.buttons ?? [], overlayPages),
    [config?.buttons, overlayPages],
  );
  const selectedButtons = useMemo(
    () =>
      getButtonsForOverlayPage(
        config?.buttons ?? [],
        effectiveSelectedPageKey,
        overlayPages,
        config?.dictionaryOrder,
      ),
    [config?.buttons, config?.dictionaryOrder, effectiveSelectedPageKey, overlayPages],
  );
  const renderedPageButtons = useMemo(() => {
    if (!dragPreview || dragPreview.sourcePageKey !== effectiveSelectedPageKey) {
      return selectedButtons;
    }
    const byId = new Map(selectedButtons.map((button) => [button.id, button]));
    return dragPreview.ids
      .map((id) => byId.get(id))
      .filter((button): button is LauncherButton => Boolean(button));
  }, [dragPreview, effectiveSelectedPageKey, selectedButtons]);
  const tileDragActive = dragPreview !== null;
  const dragSourceButton = dragPreview
    ? config?.buttons.find((button) => button.id === dragPreview.sourceId) ?? null
    : null;
  const searchResults = useMemo(
    () =>
      searchOverlayButtons(
        config?.buttons ?? [],
        overlayPages,
        searchQuery,
        config?.dictionaryOrder,
      ),
    [config?.buttons, config?.dictionaryOrder, overlayPages, searchQuery],
  );
  const displayedButtons = searchQuery.trim() ? searchResults : selectedButtons;
  const displayedButtonIds = useMemo(
    () => displayedButtons.map((button) => button.id),
    [displayedButtons],
  );
  const effectiveSelectedButtonId =
    selectedButtonId && displayedButtonIds.includes(selectedButtonId)
      ? selectedButtonId
      : (displayedButtonIds[0] ?? null);
  const selectedButton =
    displayedButtons.find((button) => button.id === effectiveSelectedButtonId) ?? null;
  const selectedResultIndex = effectiveSelectedButtonId
    ? displayedButtonIds.indexOf(effectiveSelectedButtonId)
    : -1;

  useEffect(() => {
    setSelectedButtonId((current) =>
      current && displayedButtonIds.includes(current) ? current : (displayedButtonIds[0] ?? null),
    );
  }, [displayedButtonIds]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      tabRefs.current
        .get(effectiveSelectedPageKey)
        ?.scrollIntoView({ behavior: "auto", block: "nearest", inline: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [effectiveSelectedPageKey, pageTabs]);

  const selectPageAt = useCallback(
    (index: number, focusTab = false) => {
      if (pageTabs.length === 0) return;
      const normalizedIndex = (index + pageTabs.length) % pageTabs.length;
      const nextPage = pageTabs[normalizedIndex];
      if (!nextPage) return;
      setSelectedPageKey(nextPage.key);
      setSelectedButtonId(null);
      if (focusTab) {
        window.requestAnimationFrame(() => tabRefs.current.get(nextPage.key)?.focus());
      }
    },
    [pageTabs],
  );

  const selectPageByOffset = useCallback(
    (offset: -1 | 1, focusTab = false) => {
      const currentIndex = pageTabs.findIndex((tab) => tab.key === effectiveSelectedPageKey);
      selectPageAt(Math.max(0, currentIndex) + offset, focusTab);
    },
    [effectiveSelectedPageKey, pageTabs, selectPageAt],
  );

  const runButton = useCallback(
    async (button: LauncherButton | null | undefined) => {
      if (!button || launchInFlightRef.current) return;
      if (button.actions.length === 0) {
        setLaunchError("実行アクションが登録されていません。");
        return;
      }

      launchInFlightRef.current = true;
      setLaunchingButtonId(button.id);
      setLaunchError(null);
      try {
        let results: Awaited<ReturnType<typeof executeActions>>;
        try {
          results = await executeActions(button.actions);
        } catch (error) {
          setLaunchError(
            error instanceof Error && error.message.trim()
              ? error.message
              : "項目を起動できませんでした。もう一度お試しください。",
          );
          return;
        }

        const failedResult = results.find((result, index) => result.index !== index || !result.ok);
        if (results.length !== button.actions.length || failedResult) {
          setLaunchError(
            failedResult?.message?.trim() || "項目を起動できませんでした。設定を確認してください。",
          );
          return;
        }

        try {
          await hideWindow();
        } catch {
          setLaunchError("起動しましたが辞書を閉じられませんでした。");
        }
      } finally {
        launchInFlightRef.current = false;
        setLaunchingButtonId(null);
      }
    },
    [hideWindow],
  );

  const setDragPreviewCurrent = useCallback((next: DictionaryTileDragPreview | null) => {
    dragPreviewRef.current = next;
    setDragPreview(next);
  }, []);

  const pageTargetAtPointer = useCallback((clientX: number, clientY: number) => {
    return (
      document
        .elementFromPoint(clientX, clientY)
        ?.closest<HTMLElement>("[data-overlay-page-key]")?.dataset.overlayPageKey ?? null
    );
  }, []);
  const previewIdsAtPointer = useCallback(
    (current: DictionaryTileDragPreview, clientX: number, clientY: number) => {
      const scrollDelta =
        (dictionaryBodyRef.current?.scrollTop ?? current.initialScrollTop) -
        current.initialScrollTop;
      const slots = current.slots.map((slot) => ({
        ...slot,
        top: slot.top - scrollDelta,
      }));
      return moveIdToSlot(
        current.ids,
        current.sourceId,
        nearestSlotIndex(clientX, clientY, slots),
      );
    },
    [],
  );

  const updateDragPreviewPosition = useCallback(
    (clientX: number, clientY: number) => {
      const current = dragPreviewRef.current;
      if (!current) return;
      const hoveredPageKey = pageTargetAtPointer(clientX, clientY);
      schedulePageHoverSwitch(hoveredPageKey);
      const pageTargetKey =
        hoveredPageKey ??
        (effectiveSelectedPageKey !== current.sourcePageKey ? effectiveSelectedPageKey : null);
      const nextIds = pageTargetKey
        ? current.ids
        : previewIdsAtPointer(current, clientX, clientY);
      if (nextIds !== current.ids) {
        tileRectsBeforeRenderRef.current = new Map(
          current.ids.flatMap((id) => {
            const rect = tileItemRefs.current.get(id)?.getBoundingClientRect();
            return rect ? [[id, rect] as const] : [];
          }),
        );
      }
      setDragPreviewCurrent({
        ...current,
        ids: nextIds,
        pointerX: clientX,
        pointerY: clientY,
        pageTargetKey,
      });
    },
    [effectiveSelectedPageKey, pageTargetAtPointer, previewIdsAtPointer, schedulePageHoverSwitch, setDragPreviewCurrent],
  );

  useLayoutEffect(() => {
    const previousRects = tileRectsBeforeRenderRef.current;
    tileRectsBeforeRenderRef.current = null;
    if (!previousRects || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    for (const [id, previousRect] of previousRects) {
      const node = tileItemRefs.current.get(id);
      if (!node || id === dragPreviewRef.current?.sourceId) continue;
      const nextRect = node.getBoundingClientRect();
      const deltaX = previousRect.left - nextRect.left;
      const deltaY = previousRect.top - nextRect.top;
      if (deltaX === 0 && deltaY === 0) continue;
      node.animate(
        [
          { transform: "translate(" + deltaX + "px, " + deltaY + "px)" },
          { transform: "translate(0, 0)" },
        ],
        { duration: 140, easing: "cubic-bezier(0.2, 0, 0, 1)" },
      );
    }
  }, [dragPreview?.ids]);

  useEffect(() => {
    if (!tileDragActive) return;
    const tick = () => {
      const current = dragPreviewRef.current;
      const body = dictionaryBodyRef.current;
      if (!current || !body) return;
      const rect = body.getBoundingClientRect();
      const edge = Math.min(48, rect.height / 4);
      let speed = 0;
      if (current.pointerY < rect.top + edge) {
        speed = -Math.ceil(((rect.top + edge - current.pointerY) / edge) * 12);
      } else if (current.pointerY > rect.bottom - edge) {
        speed = Math.ceil(((current.pointerY - (rect.bottom - edge)) / edge) * 12);
      }
      if (speed !== 0) {
        const previousScrollTop = body.scrollTop;
        body.scrollTop += speed;
        if (body.scrollTop !== previousScrollTop) {
          updateDragPreviewPosition(current.pointerX, current.pointerY);
        }
      }
      autoScrollFrameRef.current = window.requestAnimationFrame(tick);
    };
    autoScrollFrameRef.current = window.requestAnimationFrame(tick);
    return () => {
      if (autoScrollFrameRef.current !== null) {
        window.cancelAnimationFrame(autoScrollFrameRef.current);
        autoScrollFrameRef.current = null;
      }
    };
  }, [tileDragActive, updateDragPreviewPosition]);
  useEffect(() => {
    if (!tileDragActive) return;
    const recalculate = () => {
      const current = dragPreviewRef.current;
      if (current) updateDragPreviewPosition(current.pointerX, current.pointerY);
    };
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(recalculate);
    if (tileGridRef.current) observer?.observe(tileGridRef.current);
    if (dictionaryBodyRef.current) observer?.observe(dictionaryBodyRef.current);
    window.addEventListener("resize", recalculate);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", recalculate);
    };
  }, [tileDragActive, updateDragPreviewPosition]);
  const cancelTilePointer = useCallback(
    (pointerId?: number) => {
      if (dropInFlightRef.current || tilePointerRef.current.phase === "DROPPING") return false;
      const next = cancelDictionaryTilePointer(tilePointerRef.current, pointerId);
      if (next === tilePointerRef.current) return false;
      const target = tilePointerTargetRef.current;
      const capturedPointerId = pointerId ?? tilePointerRef.current.pointerId;
      updateTilePointer(next);
      if (target && capturedPointerId !== null && target.hasPointerCapture(capturedPointerId)) {
        try {
          target.releasePointerCapture(capturedPointerId);
        } catch {
          // Capture can already be released by the browser during cancellation.
        }
      }
      scheduleTilePointerReset();
      return true;
    },
    [scheduleTilePointerReset, updateTilePointer],
  );

  const pressTile = useCallback(
    (event: PointerEvent<HTMLButtonElement>, button: LauncherButton) => {
      const next = pressDictionaryTile(tilePointerRef.current, {
        buttonId: button.id,
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
        button: event.button,
        isPrimary: event.isPrimary,
        disabled: Boolean(searchQuery.trim()) || launchInFlightRef.current,
      });
      if (next === tilePointerRef.current) return;
      const captureTarget = tileGridRef.current ?? event.currentTarget;
      try {
        captureTarget.setPointerCapture(event.pointerId);
      } catch {
        resetTilePointer();
        return;
      }
      event.preventDefault();
      event.currentTarget.focus();
      tilePointerTargetRef.current = captureTarget;
      focusProtectionRef.current = true;
      setSelectedButtonId(button.id);
      updateTilePointer(next);
    },
    [resetTilePointer, searchQuery, updateTilePointer],
  );

  const moveTile = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const previous = tilePointerRef.current;
      const next = moveDictionaryTilePointer(previous, event);
      if (next === previous && previous.phase !== "DRAGGING") return;
      event.preventDefault();

      if (previous.phase === "PRESSED" && next.phase === "DRAGGING") {
        const sourceId = next.buttonId ?? "";
        const sourceTile = tileItemRefs.current
          .get(sourceId)
          ?.querySelector<HTMLButtonElement>(".dictionaryTile");
        const rect = sourceTile?.getBoundingClientRect();
        if (!rect) {
          cancelTilePointer(event.pointerId);
          return;
        }
        const initialIds = selectedButtons.map((button) => button.id);
        const slots = initialIds
          .map((id) => tileItemRefs.current.get(id)?.getBoundingClientRect())
          .filter((slot): slot is DOMRect => Boolean(slot))
          .map((slot) => ({
            left: slot.left,
            top: slot.top,
            width: slot.width,
            height: slot.height,
          }));
        if (slots.length !== initialIds.length) {
          cancelTilePointer(event.pointerId);
          return;
        }
        const preview: DictionaryTileDragPreview = {
          sourceId,
          sourcePageKey: effectiveSelectedPageKey,
          ids: initialIds,
          initialIds,
          pointerX: event.clientX,
          pointerY: event.clientY,
          width: rect.width,
          height: rect.height,
          slots,
          initialScrollTop: dictionaryBodyRef.current?.scrollTop ?? 0,
          pageTargetKey: null,
        };
        setDragPreviewCurrent(preview);
        updateTilePointer(next);
        updateDragPreviewPosition(event.clientX, event.clientY);
        return;
      }

      if (previous.phase === "DRAGGING") {
        updateDragPreviewPosition(event.clientX, event.clientY);
      }
    },
    [
      cancelTilePointer,
      effectiveSelectedPageKey,
      selectedButtons,
      setDragPreviewCurrent,
      updateDragPreviewPosition,
      updateTilePointer,
    ],
  );

  const releaseTile = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      const button = config?.buttons.find(
        (candidate) => candidate.id === tilePointerRef.current.buttonId,
      );
      const result = releaseDictionaryTilePointer(tilePointerRef.current, event.pointerId);
      if (result.effect === "NONE") return;
      event.preventDefault();
      updateTilePointer(result.state);
      if (result.effect === "LAUNCH") {
        resetTilePointer();
        void runButton(button);
        return;
      }

      const currentPreview = dragPreviewRef.current;
      const hoveredPageKey = pageTargetAtPointer(event.clientX, event.clientY);
      const preview = currentPreview
        ? {
            ...currentPreview,
            ids: hoveredPageKey
              ? currentPreview.ids
              : previewIdsAtPointer(currentPreview, event.clientX, event.clientY),
            pointerX: event.clientX,
            pointerY: event.clientY,
            pageTargetKey:
              hoveredPageKey ??
              (effectiveSelectedPageKey !== currentPreview.sourcePageKey
                ? effectiveSelectedPageKey
                : null),
          }
        : null;
      dragPreviewRef.current = preview;
      if (
        preview?.pageTargetKey &&
        preview.pageTargetKey !== OVERLAY_ALL_PAGE_KEY &&
        preview.pageTargetKey !== preview.sourcePageKey &&
        !dropInFlightRef.current
      ) {
        dropInFlightRef.current = true;
        void parity
          .moveButtonToPage(preview.sourceId, overlayPageIdFromKey(preview.pageTargetKey))
          .finally(() => {
            dropInFlightRef.current = false;
            resetTilePointer();
          });
        return;
      }
      if (
        !preview ||
        preview.initialIds.every((id, index) => id === preview.ids[index]) ||
        dropInFlightRef.current
      ) {
        resetTilePointer();
        return;
      }

      dropInFlightRef.current = true;
      const sourceId = preview.sourceId;
      void parity
        .reorderVisibleButtons({
          pageKey: effectiveSelectedPageKey,
          sourceId,
          beforeIds: preview.initialIds,
          afterIds: preview.ids,
        })
        .finally(() => {
          dropInFlightRef.current = false;
          resetTilePointer();
          window.requestAnimationFrame(() => {
            tileItemRefs.current.get(sourceId)?.querySelector<HTMLButtonElement>("button")?.focus();
          });
        });
    },
    [
      effectiveSelectedPageKey,
      pageTargetAtPointer,
      parity,
      previewIdsAtPointer,
      config,
      resetTilePointer,
      runButton,
      updateTilePointer,
    ],
  );

  const clickTile = useCallback(
    (event: MouseEvent<HTMLButtonElement>, button: LauncherButton) => {
      if (event.detail !== 0) {
        event.preventDefault();
        return;
      }
      void runButton(button);
    },
    [runButton],
  );

  useEffect(() => {
    const cancelOnBlur = () => cancelTilePointer();
    window.addEventListener("blur", cancelOnBlur);
    return () => window.removeEventListener("blur", cancelOnBlur);
  }, [cancelTilePointer]);

  useEffect(() => {
    if (searchQuery.trim()) cancelTilePointer();
  }, [cancelTilePointer, searchQuery]);

  useEffect(
    () => () => {
      if (tilePointerResetFrameRef.current !== null) {
        window.cancelAnimationFrame(tilePointerResetFrameRef.current);
      }
      if (pageHoverSwitchTimerRef.current !== null) {
        window.clearTimeout(pageHoverSwitchTimerRef.current);
      }
      if (focusProtectionTimerRef.current !== null) {
        window.clearTimeout(focusProtectionTimerRef.current);
      }
    },
    [],
  );

  const resetSearchAndFocus = useCallback(() => {
    setSearchQuery("");
    setSelectedButtonId(null);
    setLaunchError(null);
    if (searchFocusFrameRef.current !== null) {
      window.cancelAnimationFrame(searchFocusFrameRef.current);
    }
    searchFocusFrameRef.current = window.requestAnimationFrame(() => {
      searchFocusFrameRef.current = null;
      searchInputRef.current?.focus();
    });
  }, []);

  useEffect(() => {
    resetSearchAndFocus();
    if (!dictionaryWindow) {
      return () => {
        if (searchFocusFrameRef.current !== null) {
          window.cancelAnimationFrame(searchFocusFrameRef.current);
        }
      };
    }

    let disposed = false;
    const unlistenPromise = listenForDictionaryShown(() => {
      dictionaryVisibleRef.current = true;
      resetSearchAndFocus();
    });
    return () => {
      disposed = true;
      if (searchFocusFrameRef.current !== null) {
        window.cancelAnimationFrame(searchFocusFrameRef.current);
      }
      void unlistenPromise
        .then((unlisten) => {
          if (disposed) unlisten();
        })
        .catch(() => undefined);
    };
  }, [dictionaryWindow, resetSearchAndFocus]);

  useEffect(() => {
    if (!searchQuery.trim() || selectedResultIndex < 0) return;
    const frame = window.requestAnimationFrame(() => {
      document
        .getElementById("dictionary-search-result-" + selectedResultIndex)
        ?.scrollIntoView({ behavior: "auto", block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [searchQuery, selectedResultIndex]);

  const moveSelectedButton = useCallback(
    (offset: -1 | 1) => {
      if (displayedButtons.length === 0) return;
      const currentIndex = Math.max(
        0,
        displayedButtons.findIndex((button) => button.id === effectiveSelectedButtonId),
      );
      const nextIndex = (currentIndex + offset + displayedButtons.length) % displayedButtons.length;
      setSelectedButtonId(displayedButtons[nextIndex]?.id ?? null);
    },
    [displayedButtons, effectiveSelectedButtonId],
  );

  useEffect(() => {
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape" && cancelTilePointer()) {
        event.preventDefault();
        return;
      }
      if (
        (tilePointerRef.current.phase === "PRESSED" ||
          tilePointerRef.current.phase === "DRAGGING") &&
        event.key === "Tab" &&
        event.ctrlKey
      ) {
        event.preventDefault();
        return;
      }
      if (event.isComposing || parity.blocking) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      const searchHasFocus = target === searchInputRef.current;

      if (event.key === "Tab" && event.ctrlKey) {
        event.preventDefault();
        selectPageByOffset(event.shiftKey ? -1 : 1);
        return;
      }
      if (event.key === "Escape") {
        event.preventDefault();
        if (searchQuery) {
          setSearchQuery("");
          setSelectedButtonId(null);
          searchInputRef.current?.focus();
        } else {
          void hideWindow();
        }
        return;
      }
      if (searchHasFocus && event.key === "ArrowDown") {
        event.preventDefault();
        moveSelectedButton(1);
        return;
      }
      if (searchHasFocus && event.key === "ArrowUp") {
        event.preventDefault();
        moveSelectedButton(-1);
        return;
      }
      if (searchHasFocus && event.key === "Enter") {
        event.preventDefault();
        void runButton(selectedButton);
        return;
      }
      if (
        !event.ctrlKey &&
        !event.altKey &&
        !event.metaKey &&
        event.key.length === 1 &&
        !target?.closest("button, input, select, textarea, [contenteditable='true']")
      ) {
        event.preventDefault();
        setSearchQuery((current) => current + event.key);
        setSelectedButtonId(null);
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [
    hideWindow,
    moveSelectedButton,
    runButton,
    searchQuery,
    selectPageByOffset,
    selectedButton,
    parity.blocking,
    cancelTilePointer,
  ]);

  const setPageDragState = useCallback((next: DictionaryPagePointerDrag | null) => {
    pagePointerDragRef.current = next;
    setPagePointerDrag(next);
  }, []);

  const pressPageTab = useCallback(
    (event: PointerEvent<HTMLButtonElement>, pageId: string) => {
      if (event.button !== 0 || !event.isPrimary || pagePointerDragRef.current) return;
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        return;
      }
      if (focusProtectionTimerRef.current !== null) {
        window.clearTimeout(focusProtectionTimerRef.current);
        focusProtectionTimerRef.current = null;
      }
      focusProtectionRef.current = true;
      setPageDragState({
        pageId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        dragging: false,
        targetId: null,
        after: false,
      });
    },
    [setPageDragState],
  );

  const movePageTab = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const current = pagePointerDragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      const distance = Math.hypot(event.clientX - current.startX, event.clientY - current.startY);
      if (!current.dragging && distance < DICTIONARY_TILE_DRAG_THRESHOLD_PX) return;
      event.preventDefault();
      const target = dictionaryPageDropTargetFromPoint(event.clientX, event.clientY, current.pageId);
      setPageDragState({
        ...current,
        dragging: true,
        targetId: target?.targetId !== current.pageId ? (target?.targetId ?? null) : null,
        after: target?.after ?? false,
      });
    },
    [setPageDragState],
  );

  const releasePageTab = useCallback(
    (event: PointerEvent<HTMLButtonElement>) => {
      const current = pagePointerDragRef.current;
      if (!current || current.pointerId !== event.pointerId) return;
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
      setPageDragState(null);
      if (!current.dragging) {
        focusProtectionRef.current = false;
        return;
      }
      protectFocusForClick();
      event.preventDefault();
      pageClickSuppressionRef.current = current.pageId;
      window.requestAnimationFrame(() => {
        pageClickSuppressionRef.current = null;
      });
      if (current.targetId) {
        void parity.movePageTo(current.pageId, current.targetId, current.after);
      }
    },
    [parity, protectFocusForClick, setPageDragState],
  );

  const cancelPageTab = useCallback(
    (pointerId: number) => {
      const current = pagePointerDragRef.current;
      if (!current || current.pointerId !== pointerId) return;
      protectFocusForClick();
      setPageDragState(null);
    },
    [protectFocusForClick, setPageDragState],
  );
  const startDragging = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (event.button !== 0) return;
      if (event.target instanceof HTMLElement && event.target.closest("button")) return;
      event.preventDefault();
      windowDragActiveRef.current = true;
      focusProtectionRef.current = true;
      const dragging = dictionaryWindow?.startDragging();
      if (!dragging) {
        windowDragActiveRef.current = false;
        protectFocusForClick();
        return;
      }
      void dragging
        .catch((error) => {
          console.error("[dictionary] failed to start window drag", error);
        })
        .finally(() => {
          windowDragActiveRef.current = false;
          protectFocusForClick();
        });
    },
    [dictionaryWindow, protectFocusForClick],
  );

  const startResizeDragging = useCallback(
    (event: PointerEvent<HTMLDivElement>, direction: DictionaryResizeDirection) => {
      if (event.button !== 0) return;
      event.preventDefault();
      void dictionaryWindow?.startResizeDragging(direction).catch((error) => {
        console.error("[dictionary] failed to start window resize", error);
      });
    },
    [dictionaryWindow],
  );

  const renderButtonIcon = (button: LauncherButton, className = "dictionaryTileIcon") => {
    const source = buttonIconSources[button.id];
    if (source) {
      return <img alt="" className={className + " buttonIconImage"} src={source} />;
    }
    return (
      <span aria-hidden="true" className={className}>
        {button.icon ?? iconForAction(button.actions[0])}
      </span>
    );
  };

  return (
    <main
      aria-label="辞書"
      className={
        parity.dragActive
          ? "dictionaryWindowShell dictionaryWindowShell--dragging"
          : "dictionaryWindowShell"
      }
      onDragOver={parity.onDragOver}
      onDrop={parity.onDrop}
    >
      {resizeHandles.map(({ direction, className }) => (
        <div
          aria-hidden="true"
          className={`dictionaryResizeHandle ${className}`}
          key={direction}
          onPointerDown={(event) => startResizeDragging(event, direction)}
        />
      ))}
      <header
        className="dictionaryWindowTitlebar"
        data-tauri-drag-region
        onPointerDown={startDragging}
      >
        <div className="dictionaryWindowTitle">
          <UiIcon name="book" size={16} />
          <span>Life Launcher</span>
          <strong>辞書</strong>
        </div>
        <div className="dictionaryWindowTitleActions">
          <button
            aria-label={focusLocked ? "範囲外クリックで閉じる: オフ" : "範囲外クリックで閉じる: オン"}
            aria-pressed={focusLocked}
            className="dictionaryWindowLock"
            onClick={toggleFocusLock}
            title={focusLocked ? "ロック中: 範囲外をクリックしても閉じません" : "ロック解除中: 範囲外クリックで閉じます"}
            type="button"
          >
            <UiIcon name={focusLocked ? "lock" : "unlock"} size={16} />
          </button>
          <button
          aria-label="辞書ウィンドウを閉じる"
          className="dictionaryWindowClose"
          onClick={() => void hideWindow()}
          title="閉じる"
          type="button"
        >
            <UiIcon name="close" size={16} />
          </button>
        </div>
      </header>
      <section className="dictionaryWindowContent">
        <div aria-atomic="true" aria-live="polite" className="srOnly">
          {parity.reorderAnnouncement}
        </div>
        <div aria-label="辞書ページ" className="dictionaryPageTabs app-scrollbar" role="tablist">
          {pageTabs.map((tab, index) => {
            const selected = tab.key === effectiveSelectedPageKey;
            const customPage = overlayPages.find(
              (page) => overlayCustomPageKey(page.id) === tab.key,
            );
            const pageDragIsSource = Boolean(
              customPage && customPage.id === pagePointerDrag?.pageId,
            );
            const pageDragIsTarget = Boolean(
              customPage && customPage.id === pagePointerDrag?.targetId,
            );
            return (
              <button
                aria-controls="dictionary-page-panel"
                aria-selected={selected}
                className={[
                  "dictionaryPageTab",
                  customPage ? "" : "dictionaryPageTab--fixed",
                  selected ? "dictionaryPageTab--selected" : "",
                  pageDragIsSource && pagePointerDrag?.dragging
                    ? "dictionaryPageTab--dragging"
                    : "",
                  dragPreview?.pageTargetKey === tab.key &&
                  tab.key !== effectiveSelectedPageKey &&
                  tab.key !== OVERLAY_ALL_PAGE_KEY
                    ? "dictionaryPageTab--tile-drop-target"
                    : "",
                  pageDragIsTarget
                    ? pagePointerDrag?.after
                      ? "dictionaryPageTab--drop-after"
                      : "dictionaryPageTab--drop-before"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-overlay-page-id={customPage?.id}
                data-overlay-page-key={tab.key}
                id={"dictionary-page-tab-" + index}
                key={tab.key}
                onContextMenu={
                  customPage ? (event) => parity.pageMenu(event, customPage) : undefined
                }
                onLostPointerCapture={(event) => cancelPageTab(event.pointerId)}
                onPointerCancel={(event) => cancelPageTab(event.pointerId)}
                onPointerDown={
                  customPage ? (event) => pressPageTab(event, customPage.id) : undefined
                }
                onPointerMove={customPage ? movePageTab : undefined}
                onPointerUp={customPage ? releasePageTab : undefined}
                onClick={(event) => {
                  if (customPage && pageClickSuppressionRef.current === customPage.id) {
                    event.preventDefault();
                    return;
                  }
                  setSelectedPageKey(tab.key);
                  setSelectedButtonId(null);
                }}
                onKeyDown={(event) => {
                  if (customPage) {
                    parity.keyboardMenu(event, { kind: "page", page: customPage });
                    if (event.defaultPrevented) return;
                  }
                  let nextIndex: number | null = null;
                  if (event.key === "ArrowRight") nextIndex = index + 1;
                  if (event.key === "ArrowLeft") nextIndex = index - 1;
                  if (event.key === "Home") nextIndex = 0;
                  if (event.key === "End") nextIndex = pageTabs.length - 1;
                  if (nextIndex === null) return;
                  event.preventDefault();
                  event.stopPropagation();
                  selectPageAt(nextIndex, true);
                }}
                ref={(node) => {
                  if (node) tabRefs.current.set(tab.key, node);
                  else tabRefs.current.delete(tab.key);
                }}
                role="tab"
                tabIndex={selected ? 0 : -1}
                title={tab.name}
                type="button"
              >
                <span>{tab.name}</span>
                <small>{pageCounts.get(tab.key) ?? 0}</small>
              </button>
            );
          })}
          <button
            aria-label="辞書ページを追加"
            className="dictionaryPageTab dictionaryPageTab--add"
            onPointerDown={protectFocusForClick}
            onClick={() => parity.setPageDraft({ mode: "add", name: "" })}
            title="辞書ページを追加"
            type="button"
          >
            <UiIcon name="add" size={16} />
          </button>
        </div>
        <label className="dictionarySearchField">
          <span className="dictionarySearchLabel">辞書を検索</span>
          <input
            aria-activedescendant={
              searchQuery.trim() && selectedResultIndex >= 0
                ? "dictionary-search-result-" + selectedResultIndex
                : undefined
            }
            aria-busy={launchingButtonId !== null}
            aria-controls={searchQuery.trim() ? "dictionary-search-results" : undefined}
            aria-label="辞書を検索"
            autoComplete="off"
            className="dictionarySearchInput"
            onChange={(event) => {
              setSearchQuery(event.target.value);
              setSelectedButtonId(null);
            }}
            onKeyDown={(event) => {
              if (selectedButton)
                parity.keyboardMenu(event, { kind: "button", button: selectedButton });
            }}
            placeholder="ラベル・グループ・ページ・キーワードから検索"
            ref={searchInputRef}
            spellCheck={false}
            type="search"
            value={searchQuery}
          />
        </label>
        <div
          aria-labelledby={
            "dictionary-page-tab-" +
            Math.max(
              0,
              pageTabs.findIndex((tab) => tab.key === effectiveSelectedPageKey),
            )
          }
          className="dictionaryWindowBody app-scrollbar"
          id="dictionary-page-panel"
          ref={dictionaryBodyRef}
          role="tabpanel"
        >
          {parity.dragActive ? (
            <div className="dictionaryDropHint" role="status">
              ここにドロップして辞書へ登録
            </div>
          ) : null}
          {parity.error && !parity.blocking ? (
            <div className="dictionaryLaunchStatus dictionaryLaunchStatus--error" role="alert">
              {parity.error}
            </div>
          ) : parity.status ? (
            <div className="dictionaryLaunchStatus" role="status">
              {parity.status}
            </div>
          ) : null}
          {config && configError ? (
            <div className="dictionaryWindowConfigWarning" role="status">
              辞書の更新を読み込めません: {configError}
            </div>
          ) : null}
          {launchError ? (
            <div className="dictionaryLaunchStatus dictionaryLaunchStatus--error" role="alert">
              {launchError}
            </div>
          ) : launchingButtonId ? (
            <div className="dictionaryLaunchStatus" role="status">
              項目を起動しています...
            </div>
          ) : null}
          {!config ? (
            <div className="dictionaryWindowState" role="status">
              <span>
                {configError ? "辞書を読み込めません: " + configError : "辞書を読み込んでいます"}
              </span>
            </div>
          ) : searchQuery.trim() ? (
            searchResults.length > 0 ? (
              <div
                aria-label="全ページの検索結果"
                className="dictionarySearchResults"
                id="dictionary-search-results"
                role="listbox"
              >
                <p className="dictionarySearchScope">
                  <span>全ページの検索結果</span>
                  <small>{searchResults.length}件</small>
                </p>
                {searchResults.map((button, index) => {
                  const selected = button.id === effectiveSelectedButtonId;
                  const groupName = button.group?.trim() || DEFAULT_BUTTON_GROUP;
                  const pageName = getOverlayPageNameForButton(button, overlayPages);
                  return (
                    <button
                      aria-selected={selected}
                      className={
                        selected
                          ? "dictionarySearchResult dictionarySearchResult--selected"
                          : "dictionarySearchResult"
                      }
                      disabled={launchingButtonId !== null}
                      id={"dictionary-search-result-" + index}
                      key={button.id}
                      onClick={() => void runButton(button)}
                      onContextMenu={(event) => parity.buttonMenu(event, button)}
                      onKeyDown={(event) => parity.keyboardMenu(event, { kind: "button", button })}
                      onMouseEnter={() => setSelectedButtonId(button.id)}
                      role="option"
                      tabIndex={-1}
                      title={[
                        button.label,
                        pageName,
                        groupName,
                        button.description,
                        ...(button.aliases ?? []),
                      ]
                        .filter(Boolean)
                        .join(" / ")}
                      type="button"
                    >
                      {renderButtonIcon(button, "dictionarySearchResultIcon")}
                      <span className="dictionarySearchResultCopy">
                        <strong>{button.label}</strong>
                        <small>
                          {pageName} ・ {groupName}
                          {button.description ? " ・ " + button.description : ""}
                        </small>
                      </span>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="dictionaryWindowState">
                <strong>該当する項目がありません</strong>
                <span>検索語を変えてください。</span>
              </div>
            )
          ) : selectedButtons.length > 0 || tileDragActive ? (
            <ul
              aria-label="辞書の登録項目"
              className="dictionaryTileGrid"
              onLostPointerCapture={(event) => cancelTilePointer(event.pointerId)}
              onPointerCancel={(event) => cancelTilePointer(event.pointerId)}
              onPointerMove={moveTile}
              onPointerUp={releaseTile}
              ref={tileGridRef}
            >
              {renderedPageButtons.map((button) => {
                const selected = button.id === effectiveSelectedButtonId;
                const pointerPhase =
                  tilePointer.buttonId === button.id ? tilePointer.phase.toLowerCase() : "idle";
                return (
                  <li
                    className={
                      dragPreview?.sourceId === button.id
                        ? "dictionaryTileItem dictionaryTileItem--placeholder"
                        : "dictionaryTileItem"
                    }
                    key={button.id}
                    ref={(node) => {
                      if (node) tileItemRefs.current.set(button.id, node);
                      else tileItemRefs.current.delete(button.id);
                    }}
                  >
                    <button
                      aria-current={selected ? "true" : undefined}
                      className={[
                        "dictionaryTile",
                        selected ? "dictionaryTile--selected" : "",
                        dragPreview?.sourceId === button.id
                          ? "dictionaryTile--placeholder"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      data-pointer-state={pointerPhase}
                      disabled={launchingButtonId !== null}
                      onClick={(event) => clickTile(event, button)}
                      onContextMenu={(event) => parity.buttonMenu(event, button)}
                      onFocus={() => setSelectedButtonId(button.id)}
                      onKeyDown={(event) => parity.keyboardMenu(event, { kind: "button", button })}
                      onMouseEnter={() => setSelectedButtonId(button.id)}
                      onPointerDown={(event) => pressTile(event, button)}
                      tabIndex={selected ? 0 : -1}
                      title={button.label}
                      type="button"
                    >
                      {renderButtonIcon(button)}
                      <span>{button.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div className="dictionaryWindowState">
              <strong>
                {effectiveSelectedPageKey === OVERLAY_ALL_PAGE_KEY
                  ? "まだ辞書に項目がありません"
                  : "このページには項目がありません"}
              </strong>
              <span>ファイル・フォルダ・URLをドロップして登録できます。</span>
            </div>
          )}
        </div>
      </section>
      {dragPreview && dragSourceButton ? (
        <div
          aria-hidden="true"
          className="dictionaryTileGhost"
          style={{
            height: dragPreview.height,
            left: dragPreview.pointerX + DICTIONARY_TILE_GHOST_OFFSET_PX,
            top: dragPreview.pointerY + DICTIONARY_TILE_GHOST_OFFSET_PX,
            width: dragPreview.width,
          }}
        >
          {renderButtonIcon(dragSourceButton)}
          <span>{dragSourceButton.label}</span>
        </div>
      ) : null}      <DictionaryFeatureParityUi c={parity} />
    </main>
  );
}
