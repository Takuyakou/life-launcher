import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { SlidingFace } from "./SlidingFace";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
} from "react";
import { lastInputWasKeyboard } from "../focusModality";
import {
  BOOK_ZOOM_STEPS,
  DEFAULT_BOOK_ZOOM_PERCENT,
  DEFAULT_INSTRUCTION_BOOK_STATE,
  bookAnnouncement,
  bookGroupIndexForPage,
  bookPageFromRatio,
  bookPageGroups,
  bookPageLabel,
  bookPageMime,
  bookProgressPercent,
  fitBookPageSize,
  normalizeBookZoomPercent,
  parseBookJumpPage,
  stepBookZoomPercent,
} from "../instructionBook";
import {
  closeInstructionBook,
  loadInstructionBookState,
  openInstructionBook,
  readInstructionBookPage,
  saveInstructionBookState,
} from "../tauri";
import type { InstructionBookOpenResult, InstructionBookState } from "../types";

type PageEntry = {
  status: "loading" | "ready" | "error";
  url?: string;
  decoded?: boolean;
  naturalWidth?: number;
  naturalHeight?: number;
  error?: string;
};

type PageReadQueue = {
  waiting: number[];
  active: number;
};

type ScrubState = {
  ratio: number;
  page: number;
  trackWidth: number;
  dragging: boolean;
};

const MAX_CACHED_PAGES = 12;
const PRELOAD_OPENINGS = 2;
const SAVE_DELAY_MS = 800;
const DECODE_HOLD_MS = 150;
// V163-B1: page reads in flight at once; the rest wait in a queue ordered by distance.
const MAX_PAGE_READS = 2;
const EMPTY_IMAGE_ERROR = "このページの画像を表示できませんでした";
const WHEEL_THROTTLE_MS = 250;
const ZOOM_WHEEL_THROTTLE_MS = 120;
const STAGE_PADDING_X = 24;
const STAGE_PADDING_Y = 32;
const SPREAD_GAP_PX = 2;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isTypingTarget(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement;
}

function isPageSettled(entry: PageEntry | undefined): boolean {
  if (!entry) return false;
  return (entry.status === "ready" && Boolean(entry.decoded)) || entry.status === "error";
}

async function decodeImageUrl(url: string): Promise<{ width: number; height: number }> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    // Keep the entry ready if decode rejects so <img> renders whatever the browser supports.
  }
  return { width: image.naturalWidth, height: image.naturalHeight };
}

export function InstructionBook({ path, name }: { path: string; name: string }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const focusedOnOpenRef = useRef(false);
  const [focusRing, setFocusRing] = useState(false);
  const focusStage = useCallback(() => {
    stageRef.current?.focus({ preventScroll: true });
  }, []);
  const [book, setBook] = useState<InstructionBookOpenResult | null>(null);
  const [bookState, setBookState] = useState<InstructionBookState>(
    DEFAULT_INSTRUCTION_BOOK_STATE,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [position, setPosition] = useState(1);
  const [shownPosition, setShownPosition] = useState(1);
  const [cache, setCache] = useState<Map<number, PageEntry>>(new Map());
  const [hoverSide, setHoverSide] = useState<"left" | "right" | null>(null);
  const [jumpOpen, setJumpOpen] = useState(false);
  const [jumpValue, setJumpValue] = useState("");
  const [scrub, setScrub] = useState<ScrubState | null>(null);
  const [stageSize, setStageSize] = useState({ width: 0, height: 0 });
  const [panning, setPanning] = useState(false);
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const jumpClosingRef = useRef(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastWheelRef = useRef(0);
  const lastZoomWheelRef = useRef(0);
  const stageSizeRef = useRef({ width: 0, height: 0 });
  const pendingScrollResetRef = useRef<"start" | "bottom" | null>(null);
  const scrollAnchorRef = useRef<{ rx: number; ry: number; vx: number; vy: number } | null>(null);
  const wheelHandlersRef = useRef<{
    zoomPercent: number;
    stepZoom: (delta: 1 | -1, point?: { clientX: number; clientY: number }) => void;
    showNext: () => void;
    showPrevious: () => void;
  }>({
    zoomPercent: DEFAULT_BOOK_ZOOM_PERCENT,
    stepZoom: () => undefined,
    showNext: () => undefined,
    showPrevious: () => undefined,
  });
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startLeft: number;
    startTop: number;
  } | null>(null);
  const bookTokenRef = useRef(0);
  // Pages read for the open book; a page is read again only after it leaves the cache.
  const requestedPagesRef = useRef<Set<number>>(new Set());
  // V163-B1: one queue per open book, so a read of a closed book never frees a slot of the next.
  const readQueueRef = useRef<PageReadQueue>({ waiting: [], active: 0 });
  const lastGroupIndexRef = useRef(0);
  const turnDirectionRef = useRef<1 | -1>(1);
  const holdTimerRef = useRef<number | null>(null);
  const protectedPagesRef = useRef<Set<number>>(new Set());
  const groupsRef = useRef<number[][]>([]);
  const cacheRef = useRef(cache);
  const stateRef = useRef(bookState);
  const positionRef = useRef(position);
  cacheRef.current = cache;
  stateRef.current = bookState;
  positionRef.current = position;

  const clearHoldTimer = useCallback(() => {
    if (holdTimerRef.current !== null) {
      window.clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    bookTokenRef.current += 1;
    const token = bookTokenRef.current;
    const requestedPages = requestedPagesRef.current;
    requestedPages.clear();
    readQueueRef.current = { waiting: [], active: 0 };
    lastGroupIndexRef.current = 0;
    turnDirectionRef.current = 1;
    clearHoldTimer();
    for (const entry of cacheRef.current.values()) {
      if (entry.url) URL.revokeObjectURL(entry.url);
    }
    cacheRef.current = new Map();
    focusedOnOpenRef.current = false;
    setBook(null);
    setLoadError(null);
    setCache(new Map());
    setJumpOpen(false);
    setScrub(null);
    setPanning(false);
    panRef.current = null;
    pendingScrollResetRef.current = null;
    scrollAnchorRef.current = null;
    positionRef.current = 1;
    setPosition(1);
    setShownPosition(1);
    void Promise.all([openInstructionBook(path), loadInstructionBookState(path)])
      .then(([info, saved]) => {
        if (bookTokenRef.current !== token) return;
        const zoomPercent = normalizeBookZoomPercent(saved.zoomPercent);
        const restored: InstructionBookState = {
          ...DEFAULT_INSTRUCTION_BOOK_STATE,
          ...saved,
          direction: saved.direction === "ltr" ? "ltr" : "rtl",
          lastPage: Math.max(1, Math.floor(saved.lastPage || 1)),
          zoomPercent,
        };
        const initialGroups = bookPageGroups(
          info.pageCount,
          restored.spread,
          restored.coverSingle,
        );
        const start = initialGroups[bookGroupIndexForPage(initialGroups, restored.lastPage)]?.[0] ?? 1;
        pendingScrollResetRef.current = zoomPercent > 100 ? "start" : null;
        setBook(info);
        setBookState({ ...restored, lastPage: start });
        positionRef.current = start;
        setPosition(start);
        setShownPosition(start);
      })
      .catch((error) => {
        if (bookTokenRef.current === token) setLoadError(errorText(error));
      });
    return () => {
      bookTokenRef.current += 1;
      requestedPages.clear();
      readQueueRef.current = { waiting: [], active: 0 };
      clearHoldTimer();
      for (const entry of cacheRef.current.values()) {
        if (entry.url) URL.revokeObjectURL(entry.url);
      }
      cacheRef.current = new Map();
      void closeInstructionBook(path).catch(() => undefined);
    };
  }, [path, clearHoldTimer]);

  const groups = useMemo(
    () =>
      book
        ? bookPageGroups(book.pageCount, bookState.spread, bookState.coverSingle)
        : [],
    [book, bookState.spread, bookState.coverSingle],
  );
  groupsRef.current = groups;
  const groupIndex = useMemo(
    () => bookGroupIndexForPage(groups, position),
    [groups, position],
  );
  const targetPages = useMemo(() => groups[groupIndex] ?? [], [groups, groupIndex]);
  const shownGroupIndex = useMemo(
    () => bookGroupIndexForPage(groups, shownPosition),
    [groups, shownPosition],
  );
  const visiblePages = useMemo(
    () => groups[shownGroupIndex] ?? [],
    [groups, shownGroupIndex],
  );

  useEffect(() => {
    if (!book) return;
    const timer = window.setTimeout(() => {
      void saveInstructionBookState(path, {
        ...stateRef.current,
        lastPage: positionRef.current,
      }).catch(() => undefined);
    }, SAVE_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [
    book,
    path,
    bookState.direction,
    bookState.spread,
    bookState.coverSingle,
    bookState.zoomPercent,
    position,
  ]);

  useEffect(() => {
    if (!book) return;
    const flush = () => {
      if (document.visibilityState === "hidden") {
        void saveInstructionBookState(path, {
          ...stateRef.current,
          lastPage: positionRef.current,
        }).catch(() => undefined);
      }
    };
    const onPageHide = () => {
      void saveInstructionBookState(path, {
        ...stateRef.current,
        lastPage: positionRef.current,
      }).catch(() => undefined);
    };
    document.addEventListener("visibilitychange", flush);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", flush);
      window.removeEventListener("pagehide", onPageHide);
    };
  }, [book, path]);

  // Keep the current opening and two on each side ready.
  const neededPages = useMemo(() => {
    const pages = new Set<number>();
    for (
      let index = Math.max(0, groupIndex - PRELOAD_OPENINGS);
      index <= Math.min(groups.length - 1, groupIndex + PRELOAD_OPENINGS);
      index += 1
    ) {
      for (const page of groups[index] ?? []) pages.add(page);
    }
    return Array.from(pages).sort((left, right) => left - right);
  }, [groups, groupIndex]);
  const neededKey = neededPages.join(",");

  protectedPagesRef.current = new Set([
    ...visiblePages,
    ...targetPages,
    ...neededPages,
  ]);

  // V161-B2 / V163-B1: reads already sent are never cancelled (their answers go into the cache),
  // but pages still waiting are dropped when they are no longer needed. At most two reads run at
  // once: the target opening first, then one opening away, then two; ahead of the turn first.
  useEffect(() => {
    if (!book) return;
    const token = bookTokenRef.current;
    const queue = readQueueRef.current;
    if (groupIndex !== lastGroupIndexRef.current) {
      turnDirectionRef.current = groupIndex > lastGroupIndexRef.current ? 1 : -1;
      lastGroupIndexRef.current = groupIndex;
    }
    const needed = new Set(
      neededKey
        .split(",")
        .filter(Boolean)
        .map((value) => Number(value)),
    );
    const dropped = queue.waiting.filter((page) => !needed.has(page));
    if (dropped.length > 0) {
      queue.waiting = queue.waiting.filter((page) => needed.has(page));
      for (const page of dropped) requestedPagesRef.current.delete(page);
      setCache((previous) => {
        let next: Map<number, PageEntry> | null = null;
        for (const page of dropped) {
          if (previous.get(page)?.status !== "loading") continue;
          next ??= new Map(previous);
          next.delete(page);
        }
        return next ?? previous;
      });
    }
    const added: number[] = [];
    for (const page of needed) {
      if (requestedPagesRef.current.has(page)) continue;
      requestedPagesRef.current.add(page);
      queue.waiting.push(page);
      added.push(page);
    }
    if (added.length > 0) {
      setCache((previous) => {
        let next: Map<number, PageEntry> | null = null;
        for (const page of added) {
          if (previous.has(page)) continue;
          next ??= new Map(previous);
          next.set(page, { status: "loading" });
        }
        return next ?? previous;
      });
    }
    const pageGroups = groupsRef.current;
    const rank = (page: number) => {
      const index = bookGroupIndexForPage(pageGroups, page);
      const distance = Math.abs(index - groupIndex);
      const behind = distance > 0 && Math.sign(index - groupIndex) !== turnDirectionRef.current ? 1 : 0;
      return distance * 2 + behind;
    };
    queue.waiting.sort((left, right) => rank(left) - rank(right) || left - right);

    const settle = (page: number, entry: PageEntry) => {
      setCache((previous) => {
        if (bookTokenRef.current !== token) {
          if (entry.url) URL.revokeObjectURL(entry.url);
          return previous;
        }
        const next = new Map(previous);
        const old = next.get(page);
        if (old?.url && old.url !== entry.url) URL.revokeObjectURL(old.url);
        next.set(page, entry);
        while (next.size > MAX_CACHED_PAGES) {
          const oldest = Array.from(next.entries()).find(
            ([key, cached]) =>
              !protectedPagesRef.current.has(key) &&
              cached.status === "ready" &&
              cached.decoded,
          );
          if (!oldest) break;
          if (oldest[1].url) URL.revokeObjectURL(oldest[1].url);
          next.delete(oldest[0]);
          requestedPagesRef.current.delete(oldest[0]);
        }
        return next;
      });
    };
    const read = async (page: number) => {
      try {
        const buffer = await readInstructionBookPage(path, page - 1);
        if (bookTokenRef.current !== token) return;
        const bytes = new Uint8Array(buffer);
        const mime = bookPageMime(bytes[0]);
        if (!mime) throw new Error("このページは画像ではないため表示しません");
        const url = URL.createObjectURL(new Blob([bytes.subarray(1)], { type: mime }));
        const dimensions = await decodeImageUrl(url);
        if (bookTokenRef.current !== token) {
          URL.revokeObjectURL(url);
          return;
        }
        if (dimensions.width === 0 || dimensions.height === 0) {
          URL.revokeObjectURL(url);
          settle(page, { status: "error", error: EMPTY_IMAGE_ERROR });
          return;
        }
        settle(page, {
          status: "ready",
          url,
          decoded: true,
          naturalWidth: dimensions.width,
          naturalHeight: dimensions.height,
        });
      } catch (error) {
        if (bookTokenRef.current !== token) return;
        settle(page, { status: "error", error: errorText(error) });
      }
    };
    const pump = () => {
      if (bookTokenRef.current !== token || readQueueRef.current !== queue) return;
      while (queue.active < MAX_PAGE_READS && queue.waiting.length > 0) {
        const page = queue.waiting.shift()!;
        queue.active += 1;
        void read(page).finally(() => {
          queue.active -= 1;
          pump();
        });
      }
    };
    pump();
  }, [book, path, neededKey, groupIndex]);

  // V161-B1: once every page of the target opening is decoded within 150 ms, switch immediately.
  useEffect(() => {
    if (!book || shownPosition === position) return;
    if (targetPages.length > 0 && targetPages.every((page) => isPageSettled(cache.get(page)))) {
      clearHoldTimer();
      setShownPosition(position);
    }
  }, [book, cache, targetPages, position, shownPosition, clearHoldTimer]);

  const openingSettled =
    visiblePages.length > 0 &&
    visiblePages.every((page) => {
      const entry = cache.get(page);
      return entry !== undefined && entry.status !== "loading";
    });

  const visibleSizesKey = visiblePages
    .map((page) => {
      const entry = cache.get(page);
      return `${page}:${entry?.naturalWidth ?? 0}x${entry?.naturalHeight ?? 0}`;
    })
    .join(",");
  const bookLoaded = Boolean(book);
  const zoomPercent = normalizeBookZoomPercent(bookState.zoomPercent);
  const isZoomed = zoomPercent > DEFAULT_BOOK_ZOOM_PERCENT;

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !bookLoaded) return;
    const updateSize = () => {
      const width = stage.offsetWidth;
      const height = stage.offsetHeight;
      if (width <= 0 || height <= 0) return;
      const previous = stageSizeRef.current;
      if (previous.width === width && previous.height === height) return;
      if (
        previous.width > 0 &&
        previous.height > 0 &&
        normalizeBookZoomPercent(stateRef.current.zoomPercent) > DEFAULT_BOOK_ZOOM_PERCENT
      ) {
        const sw = Math.max(1, stage.scrollWidth);
        const sh = Math.max(1, stage.scrollHeight);
        scrollAnchorRef.current = {
          rx: (stage.scrollLeft + stage.clientWidth / 2) / sw,
          ry: (stage.scrollTop + stage.clientHeight / 2) / sh,
          vx: width / 2,
          vy: height / 2,
        };
      }
      stageSizeRef.current = { width, height };
      setStageSize({ width, height });
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(stage);
    return () => observer.disconnect();
  }, [bookLoaded]);

  useEffect(() => {
    const stage = stageRef.current;
    if (!stage || !bookLoaded) return;
    const onNativeWheel = (event: WheelEvent) => {
      const handlers = wheelHandlersRef.current;
      if (event.ctrlKey) {
        event.preventDefault();
        if (event.deltaY === 0) return;
        const now = Date.now();
        if (now - lastZoomWheelRef.current < ZOOM_WHEEL_THROTTLE_MS) return;
        lastZoomWheelRef.current = now;
        handlers.stepZoom(event.deltaY < 0 ? 1 : -1, {
          clientX: event.clientX,
          clientY: event.clientY,
        });
        return;
      }
      if (handlers.zoomPercent > DEFAULT_BOOK_ZOOM_PERCENT) {
        if (event.shiftKey && event.deltaY !== 0) {
          event.preventDefault();
          stage.scrollLeft += event.deltaY;
        }
        return;
      }
      if (event.deltaY === 0) return;
      event.preventDefault();
      const now = Date.now();
      if (now - lastWheelRef.current < WHEEL_THROTTLE_MS) return;
      lastWheelRef.current = now;
      if (event.deltaY > 0) handlers.showNext();
      else handlers.showPrevious();
    };
    stage.addEventListener("wheel", onNativeWheel, { passive: false });
    return () => stage.removeEventListener("wheel", onNativeWheel);
  }, [bookLoaded]);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage || !book) return;
    if (!isZoomed) {
      pendingScrollResetRef.current = null;
      scrollAnchorRef.current = null;
      if (stage.scrollLeft !== 0) stage.scrollLeft = 0;
      if (stage.scrollTop !== 0) stage.scrollTop = 0;
      return;
    }
    const reset = pendingScrollResetRef.current;
    if (reset) {
      const allSized =
        visiblePages.length > 0 &&
        visiblePages.every((page) => {
          const entry = cacheRef.current.get(page);
          return (
            entry?.status === "error" ||
            (entry?.status === "ready" && (entry.naturalWidth ?? 0) > 0)
          );
        });
      if (!allSized || stageSize.width <= 0) return;
      pendingScrollResetRef.current = null;
      scrollAnchorRef.current = null;
      const maxLeft = Math.max(0, stage.scrollWidth - stage.clientWidth);
      const maxTop = Math.max(0, stage.scrollHeight - stage.clientHeight);
      stage.scrollLeft = bookState.direction === "rtl" ? maxLeft : 0;
      stage.scrollTop = reset === "bottom" ? maxTop : 0;
      return;
    }
    const anchor = scrollAnchorRef.current;
    if (anchor) {
      scrollAnchorRef.current = null;
      const maxLeft = Math.max(0, stage.scrollWidth - stage.clientWidth);
      const maxTop = Math.max(0, stage.scrollHeight - stage.clientHeight);
      stage.scrollLeft = Math.min(maxLeft, Math.max(0, stage.scrollWidth * anchor.rx - anchor.vx));
      stage.scrollTop = Math.min(maxTop, Math.max(0, stage.scrollHeight * anchor.ry - anchor.vy));
    }
  }, [
    book,
    isZoomed,
    zoomPercent,
    shownPosition,
    stageSize.width,
    stageSize.height,
    bookState.direction,
    bookState.spread,
    bookState.coverSingle,
    visibleSizesKey,
    visiblePages,
  ]);

  useEffect(() => {
    if (!jumpOpen) return;
    jumpInputRef.current?.focus({ preventScroll: true });
    jumpInputRef.current?.select();
  }, [jumpOpen]);

  // V160-S6: when a book opens (including reload, list, search and Do Now), put the keyboard
  // on the pages so the arrow keys work without clicking first. Never steal focus from a field.
  useEffect(() => {
    if (!book || !openingSettled || focusedOnOpenRef.current) return;
    focusedOnOpenRef.current = true;
    if (isTypingTarget(document.activeElement)) return;
    focusStage();
  }, [book, openingSettled, focusStage]);

  if (loadError) {
    return (
      <div className="bookStatus bookStatus--error" role="alert">
        {loadError}
      </div>
    );
  }
  if (!book) {
    return (
      <div className="bookStatus" role="status">
        ZIP を開いています…
      </div>
    );
  }

  const canPrevious = groupIndex > 0;
  const canNext = groupIndex < groups.length - 1;
  const goToOpening = (index: number, scrollReset: "start" | "bottom" = "start") => {
    const currentGroups = groupsRef.current;
    const clamped = Math.max(0, Math.min(currentGroups.length - 1, index));
    const nextPages = currentGroups[clamped] ?? [];
    const start = nextPages[0];
    if (start === undefined || start === positionRef.current) return;
    clearHoldTimer();
    if (normalizeBookZoomPercent(stateRef.current.zoomPercent) > DEFAULT_BOOK_ZOOM_PERCENT) {
      pendingScrollResetRef.current = scrollReset;
    }
    positionRef.current = start;
    setPosition(start);
    const settledNow =
      nextPages.length > 0 &&
      nextPages.every((page) => isPageSettled(cacheRef.current.get(page)));
    if (settledNow) {
      setShownPosition(start);
    } else {
      holdTimerRef.current = window.setTimeout(() => {
        holdTimerRef.current = null;
        setShownPosition(positionRef.current);
      }, DECODE_HOLD_MS);
    }
  };
  const currentTargetGroupIndex = () =>
    bookGroupIndexForPage(groupsRef.current, positionRef.current);
  const showPrevious = (scrollReset: "start" | "bottom" = "start") => {
    const idx = currentTargetGroupIndex();
    if (idx > 0) goToOpening(idx - 1, scrollReset);
  };
  const showNext = (scrollReset: "start" | "bottom" = "start") => {
    const idx = currentTargetGroupIndex();
    if (idx < groupsRef.current.length - 1) goToOpening(idx + 1, scrollReset);
  };
  const applyZoom = (nextRaw: number, clientPoint?: { clientX: number; clientY: number }) => {
    const nextZoom = normalizeBookZoomPercent(nextRaw);
    const currentZoom = normalizeBookZoomPercent(stateRef.current.zoomPercent);
    if (nextZoom === currentZoom) return;
    const stage = stageRef.current;
    if (stage && nextZoom > DEFAULT_BOOK_ZOOM_PERCENT) {
      const rect = stage.getBoundingClientRect();
      const vx = clientPoint ? clientPoint.clientX - rect.left : stage.clientWidth / 2;
      const vy = clientPoint ? clientPoint.clientY - rect.top : stage.clientHeight / 2;
      const sw = Math.max(1, stage.scrollWidth);
      const sh = Math.max(1, stage.scrollHeight);
      scrollAnchorRef.current = {
        rx: (stage.scrollLeft + vx) / sw,
        ry: (stage.scrollTop + vy) / sh,
        vx,
        vy,
      };
    } else {
      scrollAnchorRef.current = null;
    }
    pendingScrollResetRef.current = null;
    setHoverSide(null);
    setScrub(null);
    setPanning(false);
    panRef.current = null;
    setBookState((current) => ({ ...current, zoomPercent: nextZoom }));
  };
  const stepZoom = (delta: 1 | -1, clientPoint?: { clientX: number; clientY: number }) => {
    const currentZoom = normalizeBookZoomPercent(stateRef.current.zoomPercent);
    applyZoom(stepBookZoomPercent(currentZoom, delta), clientPoint);
  };
  wheelHandlersRef.current = {
    zoomPercent,
    stepZoom,
    showNext: () => showNext("start"),
    showPrevious: () => showPrevious("start"),
  };
  const goToPage = (page: number) => {
    const clamped = Math.max(1, Math.min(book.pageCount, page));
    goToOpening(bookGroupIndexForPage(groupsRef.current, clamped));
  };
  const openJumpInput = () => {
    jumpClosingRef.current = false;
    const current = groupsRef.current[currentTargetGroupIndex()]?.[0] ?? positionRef.current;
    setJumpValue(String(current));
    setJumpOpen(true);
  };
  const closeJumpInput = (returnFocus: boolean) => {
    if (jumpClosingRef.current) return;
    jumpClosingRef.current = true;
    setJumpOpen(false);
    if (returnFocus) focusStage();
  };
  const submitJump = () => {
    if (jumpClosingRef.current) return;
    jumpClosingRef.current = true;
    const parsed = parseBookJumpPage(jumpValue, book.pageCount);
    setJumpOpen(false);
    if (parsed !== null) goToPage(parsed);
    focusStage();
  };
  const onPaneKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (
      event.ctrlKey &&
      !event.altKey &&
      !event.metaKey &&
      !event.shiftKey &&
      event.key.toLowerCase() === "g"
    ) {
      if (isTypingTarget(event.target as Element) || isTypingTarget(document.activeElement)) {
        return;
      }
      event.preventDefault();
      openJumpInput();
    }
  };
  const readScrubPoint = (clientX: number, target: HTMLElement) => {
    const rect = target.getBoundingClientRect();
    const trackWidth = Math.max(1, rect.width);
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / trackWidth));
    const page = bookPageFromRatio(ratio, book.pageCount, bookState.direction);
    return { ratio, page, trackWidth };
  };
  const leftIsNext = bookState.direction === "rtl";
  const leftAction = leftIsNext ? showNext : showPrevious;
  const rightAction = leftIsNext ? showPrevious : showNext;
  const leftAvailable = leftIsNext ? canNext : canPrevious;
  const rightAvailable = leftIsNext ? canPrevious : canNext;
  const leftArrow = "‹";
  const rightArrow = "›";
  const leftLabel = leftIsNext ? "次のページ(←)" : "前のページ(←)";
  const rightLabel = leftIsNext ? "前のページ(→)" : "次のページ(→)";
  const leftAria = leftIsNext ? "次のページ" : "前のページ";
  const rightAria = leftIsNext ? "前のページ" : "次のページ";

  const changeLayout = (patch: Partial<InstructionBookState>) => {
    const next = { ...stateRef.current, ...patch };
    const nextGroups = bookPageGroups(
      book.pageCount,
      next.spread,
      next.coverSingle,
    );
    const start =
      nextGroups[bookGroupIndexForPage(nextGroups, positionRef.current)]?.[0] ?? 1;
    clearHoldTimer();
    if (normalizeBookZoomPercent(next.zoomPercent) > DEFAULT_BOOK_ZOOM_PERCENT) {
      pendingScrollResetRef.current = "start";
    }
    positionRef.current = start;
    setBookState({ ...next, lastPage: start });
    setPosition(start);
    setShownPosition(start);
  };
  const changeDirection = (direction: "rtl" | "ltr") => {
    if (isZoomed) pendingScrollResetRef.current = "start";
    setBookState((current) => ({ ...current, direction }));
  };
  const changeSpread = (spread: boolean) => changeLayout({ spread });
  const changeCoverSingle = (coverSingle: boolean) =>
    changeLayout({ coverSingle });

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const key = event.key;
    if (!event.ctrlKey && !event.metaKey && !event.altKey) {
      if (key === "+" || key === "=") {
        event.preventDefault();
        stepZoom(1);
        return;
      }
      if (key === "-") {
        event.preventDefault();
        stepZoom(-1);
        return;
      }
      if (key === "0") {
        event.preventDefault();
        applyZoom(DEFAULT_BOOK_ZOOM_PERCENT);
        return;
      }
    }
    const forwardKey =
      key === "ArrowLeft"
        ? bookState.direction === "rtl"
        : key === "ArrowRight"
          ? bookState.direction === "ltr"
          : false;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      if (forwardKey) showNext("start");
      else showPrevious("start");
      return;
    }
    if (isZoomed && (key === "ArrowUp" || key === "ArrowDown")) {
      event.preventDefault();
      const stage = event.currentTarget;
      stage.scrollTop += (key === "ArrowDown" ? 1 : -1) * stage.clientHeight * 0.15;
      return;
    }
    if (key === "PageDown" || key === " ") {
      event.preventDefault();
      const forward = !(key === " " && event.shiftKey);
      if (isZoomed) {
        const stage = event.currentTarget;
        if (forward) {
          if (stage.scrollTop + stage.clientHeight >= stage.scrollHeight - 2) {
            showNext("start");
          } else {
            stage.scrollTop += stage.clientHeight * 0.85;
          }
        } else if (stage.scrollTop <= 2) {
          showPrevious("bottom");
        } else {
          stage.scrollTop -= stage.clientHeight * 0.85;
        }
        return;
      }
      if (forward) showNext("start");
      else showPrevious("start");
      return;
    }
    if (key === "PageUp") {
      event.preventDefault();
      if (isZoomed) {
        const stage = event.currentTarget;
        if (stage.scrollTop <= 2) {
          showPrevious("bottom");
        } else {
          stage.scrollTop -= stage.clientHeight * 0.85;
        }
        return;
      }
      showPrevious("start");
      return;
    }
    if (key === "Home") {
      event.preventDefault();
      goToOpening(0, "start");
      return;
    }
    if (key === "End") {
      event.preventDefault();
      goToOpening(groupsRef.current.length - 1, "start");
    }
  };

  const onStagePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    setFocusRing(false);
    if (!jumpOpen) focusStage();
    if (isZoomed && event.button === 0 && !jumpOpen) {
      panRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startLeft: event.currentTarget.scrollLeft,
        startTop: event.currentTarget.scrollTop,
      };
      setPanning(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const onStagePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (panRef.current && panRef.current.pointerId === event.pointerId) {
      event.currentTarget.scrollLeft = panRef.current.startLeft - (event.clientX - panRef.current.startX);
      event.currentTarget.scrollTop = panRef.current.startTop - (event.clientY - panRef.current.startY);
      return;
    }
    if (isZoomed) {
      if (hoverSide !== null) setHoverSide(null);
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    setHoverSide(ratio < 0.3 ? "left" : ratio > 0.7 ? "right" : null);
  };

  const endPan = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panRef.current || panRef.current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    panRef.current = null;
    setPanning(false);
  };

  const availW = Math.max(1, stageSize.width - STAGE_PADDING_X);
  const availH = Math.max(1, stageSize.height - STAGE_PADDING_Y);
  const zoomedScale = zoomPercent / 100;

  const renderOpening = (pages: number[]) => {
    const slotW = pages.length <= 1 ? availW : Math.max(1, (availW - SPREAD_GAP_PX) / 2);
    return (
      <div
        className={`bookPageLayer bookPageLayer--current${
          bookState.direction === "rtl" ? " bookPageLayer--rtl" : ""
        }${pages.length === 1 ? " bookPageLayer--one" : ""}`}
      >
        {pages.map((page) => {
          const entry = cache.get(page);
          if (!entry || entry.status === "loading") {
            return <div className="bookPagePending" key={page} />;
          }
          if (entry.status === "error") {
            return (
              <div className="bookPageError" key={page} role="alert">
                {entry.error}
              </div>
            );
          }
          const fit =
            stageSize.width > 0 && stageSize.height > 0 && (entry.naturalWidth ?? 0) > 0
              ? fitBookPageSize(entry.naturalWidth!, entry.naturalHeight!, slotW, availH)
              : null;
          const imgStyle =
            fit && fit.width > 0
              ? {
                  width: `${fit.width * zoomedScale}px`,
                  height: `${fit.height * zoomedScale}px`,
                }
              : undefined;
          return (
            <img
              alt={`${page}ページ`}
              className="bookPageImage"
              draggable={false}
              key={page}
              src={entry.url}
              style={imgStyle}
            />
          );
        })}
      </div>
    );
  };

  const previewPages = scrub?.dragging
    ? groups[bookGroupIndexForPage(groups, scrub.page)] ?? targetPages
    : targetPages;
  const label = bookPageLabel(previewPages);
  const currentLabel = bookPageLabel(targetPages);
  const progressPage = previewPages[previewPages.length - 1] ?? position;
  const progress = bookProgressPercent(progressPage, book.pageCount);
  const scrubTooltipHalf =
    (tooltipRef.current?.offsetWidth ?? (scrub && scrub.page >= 100 ? 52 : 44)) / 2;
  const scrubTooltipLeft = scrub
    ? Math.min(
        Math.max(scrubTooltipHalf, scrub.ratio * scrub.trackWidth),
        Math.max(scrubTooltipHalf, scrub.trackWidth - scrubTooltipHalf),
      )
    : 0;

  return (
    <div className="bookPane" onKeyDown={onPaneKeyDown}>
      <div className="bookHeader">
        <div className="bookToolbar">
        <div className="bookPageJump">
          <button
            aria-hidden={jumpOpen || undefined}
            aria-label={`ページを指定して移る(今 ${currentLabel} / ${book.pageCount})`}
            className="bookPageLabel"
            data-hidden={jumpOpen ? "true" : undefined}
            onClick={openJumpInput}
            onMouseDown={(event) => event.preventDefault()}
            tabIndex={jumpOpen ? -1 : 0}
            type="button"
          >
            {label}
            <span> / {book.pageCount}</span>
          </button>
          {jumpOpen ? (
            <div className="bookPageJumpForm">
              <input autoComplete="off"
                aria-label="移動するページ番号"
                className="bookJumpInput"
                inputMode="numeric"
                onBlur={(event) => {
                  const related = event.relatedTarget;
                  closeJumpInput(!isTypingTarget(related));
                }}
                onChange={(event) => setJumpValue(event.currentTarget.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    if (event.nativeEvent.isComposing || event.keyCode === 229) return;
                    event.preventDefault();
                    submitJump();
                    return;
                  }
                  if (event.key === "Escape") {
                    event.preventDefault();
                    event.stopPropagation();
                    closeJumpInput(true);
                  }
                }}
                ref={jumpInputRef}
                type="text"
                value={jumpValue}
              />
              <span className="bookJumpTotal">/ {book.pageCount}</span>
              <div className="bookJumpHint">Enter で移動・Esc でやめる</div>
            </div>
          ) : null}
        </div>
        <div
          className="bookSeg"
          onMouseDown={(event) => {
            if (!jumpOpen) event.preventDefault();
          }}
          role="group"
          aria-label="ページの出し方"
        >
          <button
            aria-pressed={bookState.spread}
            onClick={() => changeSpread(true)}
            type="button"
          >
            {bookState.spread && <SlidingFace className="bookSegFace" layoutId="book-spread-face" />}
            <span className="bookSegLabel">見開き</span>
          </button>
          <button
            aria-pressed={!bookState.spread}
            onClick={() => changeSpread(false)}
            type="button"
          >
            {!bookState.spread && <SlidingFace className="bookSegFace" layoutId="book-spread-face" />}
            <span className="bookSegLabel">1ページ</span>
          </button>
        </div>
        <div
          className="bookSeg"
          onMouseDown={(event) => {
            if (!jumpOpen) event.preventDefault();
          }}
          role="group"
          aria-label="めくる向き"
        >
          <button
            aria-pressed={bookState.direction === "rtl"}
            onClick={() => changeDirection("rtl")}
            type="button"
          >
            {bookState.direction === "rtl" && (
              <SlidingFace className="bookSegFace" layoutId="book-direction-face" />
            )}
            <span className="bookSegLabel">右から左</span>
          </button>
          <button
            aria-pressed={bookState.direction === "ltr"}
            onClick={() => changeDirection("ltr")}
            type="button"
          >
            {bookState.direction === "ltr" && (
              <SlidingFace className="bookSegFace" layoutId="book-direction-face" />
            )}
            <span className="bookSegLabel">左から右</span>
          </button>
        </div>
        <label
          className="bookCheck"
          onMouseDown={(event) => {
            if (!jumpOpen) event.preventDefault();
          }}
        >
          <input
            checked={bookState.coverSingle}
            onChange={(event) => changeCoverSingle(event.currentTarget.checked)}
            type="checkbox"
          />
          <i aria-hidden="true" />
          <span>表紙は1ページ</span>
        </label>
        <div className="bookSpacer" />
        <div
          aria-label="拡大と縮小"
          className="bookSeg bookZoomSeg"
          onMouseDown={(event) => {
            if (!jumpOpen) event.preventDefault();
          }}
          role="group"
        >
          <button
            aria-label="縮小"
            disabled={zoomPercent <= BOOK_ZOOM_STEPS[0]}
            onClick={() => stepZoom(-1)}
            type="button"
          >
            −
          </button>
          <button
            aria-label={
              zoomPercent === DEFAULT_BOOK_ZOOM_PERCENT
                ? "表示倍率 全体(押すと全体に戻す)"
                : `表示倍率 ${zoomPercent}%(押すと全体に戻す)`
            }
            aria-pressed={isZoomed}
            className="bookZoomReset"
            onClick={() => applyZoom(DEFAULT_BOOK_ZOOM_PERCENT)}
            type="button"
          >
            {zoomPercent === DEFAULT_BOOK_ZOOM_PERCENT ? "全体" : `${zoomPercent}%`}
          </button>
          <button
            aria-label="拡大"
            disabled={zoomPercent >= BOOK_ZOOM_STEPS[BOOK_ZOOM_STEPS.length - 1]}
            onClick={() => stepZoom(1)}
            type="button"
          >
            +
          </button>
        </div>
        </div>
        {book.truncated ? (
          <p className="bookNotice">5,000ページまで表示しています</p>
        ) : null}
      </div>
      <div
        aria-label={`${name}のページ`}
        className={`bookStage${bookState.direction === "rtl" ? " bookStage--rtl" : ""}${
          visiblePages.length === 1 ? " bookStage--one" : ""
        }${isZoomed ? " bookStage--zoomed" : ""}`}
        data-focus-ring={focusRing ? "true" : undefined}
        data-panning={isZoomed && panning ? "true" : undefined}
        onBlur={() => setFocusRing(false)}
        onFocus={() => setFocusRing(lastInputWasKeyboard())}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => {
          if (!jumpOpen) event.preventDefault();
          setFocusRing(false);
          if (!jumpOpen) focusStage();
        }}
        onPointerCancel={endPan}
        onPointerDown={onStagePointerDown}
        onPointerLeave={() => setHoverSide(null)}
        onPointerMove={onStagePointerMove}
        onPointerUp={endPan}
        ref={stageRef}
        tabIndex={0}
      >
        {renderOpening(visiblePages)}
        {!isZoomed ? (
          <>
            <button
              aria-label={leftAria}
              className="bookZone bookZone--left"
              data-available={leftAvailable}
              data-visible={!jumpOpen && hoverSide === "left" && leftAvailable}
              onClick={() => {
                if (jumpOpen) {
                  closeJumpInput(true);
                  return;
                }
                leftAction();
              }}
              onKeyDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => {
                if (!jumpOpen) event.preventDefault();
              }}
              tabIndex={-1}
              type="button"
            >
              <span>{leftArrow}</span>
              <em>{leftLabel}</em>
            </button>
            <button
              aria-label={rightAria}
              className="bookZone bookZone--right"
              data-available={rightAvailable}
              data-visible={!jumpOpen && hoverSide === "right" && rightAvailable}
              onClick={() => {
                if (jumpOpen) {
                  closeJumpInput(true);
                  return;
                }
                rightAction();
              }}
              onKeyDown={(event) => event.stopPropagation()}
              onMouseDown={(event) => {
                if (!jumpOpen) event.preventDefault();
              }}
              tabIndex={-1}
              type="button"
            >
              <span>{rightArrow}</span>
              <em>{rightLabel}</em>
            </button>
            <div
              className={`bookProgress${bookState.direction === "ltr" ? " bookProgress--ltr" : ""}${
                visiblePages.length === 1 ? " bookProgress--single" : ""
              }`}
              data-active={scrub ? "true" : "false"}
              onClick={(event) => event.stopPropagation()}
              onMouseDown={(event) => {
                event.stopPropagation();
                if (!jumpOpen) event.preventDefault();
              }}
              onPointerCancel={() => setScrub(null)}
              onPointerDown={(event) => {
                event.stopPropagation();
                if (event.button !== 0) return;
                if (jumpOpen) {
                  closeJumpInput(true);
                  return;
                }
                setHoverSide(null);
                event.currentTarget.setPointerCapture(event.pointerId);
                const point = readScrubPoint(event.clientX, event.currentTarget);
                setScrub({ ...point, dragging: true });
              }}
              onPointerEnter={(event) => {
                setHoverSide(null);
                const point = readScrubPoint(event.clientX, event.currentTarget);
                setScrub((current) => ({ ...point, dragging: current?.dragging ?? false }));
              }}
              onPointerLeave={() => {
                setScrub((current) => (current?.dragging ? current : null));
              }}
              onPointerMove={(event) => {
                event.stopPropagation();
                setHoverSide(null);
                const point = readScrubPoint(event.clientX, event.currentTarget);
                setScrub((current) => ({ ...point, dragging: current?.dragging ?? false }));
              }}
              onPointerUp={(event) => {
                event.stopPropagation();
                if (!scrub?.dragging) return;
                if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                  event.currentTarget.releasePointerCapture(event.pointerId);
                }
                const point = readScrubPoint(event.clientX, event.currentTarget);
                setScrub({ ...point, dragging: false });
                goToPage(point.page);
                focusStage();
              }}
            >
              <div className="bookProgressTrack">
                <b style={{ width: `${progress}%` }} />
                {scrub ? (
                  <>
                    <span
                      className="bookProgressMarker"
                      style={{ left: `${scrub.ratio * 100}%` }}
                    />
                    <span
                      className="bookProgressThumb"
                      style={
                        bookState.direction === "rtl"
                          ? { right: `${progress}%` }
                          : { left: `${progress}%` }
                      }
                    />
                    <div
                      className="bookProgressTooltip"
                      ref={tooltipRef}
                      style={{ left: `${scrubTooltipLeft}px` }}
                    >
                      p.{scrub.page}
                    </div>
                  </>
                ) : null}
              </div>
            </div>
          </>
        ) : null}
        <div aria-live="polite" className="srOnly">
          {bookAnnouncement(targetPages)}
        </div>
      </div>
    </div>
  );
}
