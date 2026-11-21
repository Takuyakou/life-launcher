import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { lastInputWasKeyboard } from "../focusModality";
import {
  DEFAULT_INSTRUCTION_BOOK_STATE,
  bookAnnouncement,
  bookGroupIndexForPage,
  bookPageFromRatio,
  bookPageGroups,
  bookPageLabel,
  bookPageMime,
  bookProgressPercent,
  parseBookJumpPage,
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
  error?: string;
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
const WHEEL_THROTTLE_MS = 250;

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

async function decodeImageUrl(url: string): Promise<void> {
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch {
    // Keep the entry ready if decode rejects so <img> renders whatever the browser supports.
  }
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
  const jumpInputRef = useRef<HTMLInputElement>(null);
  const jumpClosingRef = useRef(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const lastWheelRef = useRef(0);
  const bookTokenRef = useRef(0);
  const inFlightRef = useRef<Map<number, Promise<void>>>(new Map());
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
    const inFlight = inFlightRef.current;
    inFlight.clear();
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
    positionRef.current = 1;
    setPosition(1);
    setShownPosition(1);
    void Promise.all([openInstructionBook(path), loadInstructionBookState(path)])
      .then(([info, saved]) => {
        if (bookTokenRef.current !== token) return;
        const restored: InstructionBookState = {
          ...DEFAULT_INSTRUCTION_BOOK_STATE,
          ...saved,
          direction: saved.direction === "ltr" ? "ltr" : "rtl",
          lastPage: Math.max(1, Math.floor(saved.lastPage || 1)),
        };
        const initialGroups = bookPageGroups(
          info.pageCount,
          restored.spread,
          restored.coverSingle,
        );
        const start = initialGroups[bookGroupIndexForPage(initialGroups, restored.lastPage)]?.[0] ?? 1;
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
      inFlight.clear();
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
  }, [book, path, bookState.direction, bookState.spread, bookState.coverSingle, position]);

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

  // V161-B2: keep in-flight page loads alive across rapid turns; discard only when the book changes.
  useEffect(() => {
    if (!book) return;
    const token = bookTokenRef.current;
    const needed = neededKey
      .split(",")
      .filter(Boolean)
      .map((value) => Number(value));
    for (const page of needed) {
      const existing = cacheRef.current.get(page);
      if (existing && existing.status !== "loading") continue;
      if (inFlightRef.current.has(page)) continue;
      if (!existing) {
        setCache((previous) => {
          if (previous.has(page)) return previous;
          const next = new Map(previous);
          next.set(page, { status: "loading" });
          return next;
        });
      }
      const promise = readInstructionBookPage(path, page - 1)
        .then(async (buffer) => {
          if (bookTokenRef.current !== token) return;
          const bytes = new Uint8Array(buffer);
          const mime = bookPageMime(bytes[0]);
          if (!mime) throw new Error("このページは画像ではないため表示しません");
          const url = URL.createObjectURL(
            new Blob([bytes.subarray(1)], { type: mime }),
          );
          await decodeImageUrl(url);
          if (bookTokenRef.current !== token) {
            URL.revokeObjectURL(url);
            return;
          }
          setCache((previous) => {
            if (bookTokenRef.current !== token) {
              URL.revokeObjectURL(url);
              return previous;
            }
            const next = new Map(previous);
            const old = next.get(page);
            if (old?.url && old.url !== url) URL.revokeObjectURL(old.url);
            next.set(page, { status: "ready", url, decoded: true });
            while (next.size > MAX_CACHED_PAGES) {
              const oldest = Array.from(next.entries()).find(
                ([key, entry]) =>
                  !protectedPagesRef.current.has(key) &&
                  entry.status === "ready" &&
                  entry.decoded,
              );
              if (!oldest) break;
              if (oldest[1].url) URL.revokeObjectURL(oldest[1].url);
              next.delete(oldest[0]);
            }
            return next;
          });
        })
        .catch((error) => {
          if (bookTokenRef.current !== token) return;
          setCache((previous) => {
            const next = new Map(previous);
            next.set(page, { status: "error", error: errorText(error) });
            return next;
          });
        })
        .finally(() => {
          if (inFlightRef.current.get(page) === promise) {
            inFlightRef.current.delete(page);
          }
        });
      inFlightRef.current.set(page, promise);
    }
  }, [book, path, neededKey]);

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
  const goToOpening = (index: number) => {
    const currentGroups = groupsRef.current;
    const clamped = Math.max(0, Math.min(currentGroups.length - 1, index));
    const nextPages = currentGroups[clamped] ?? [];
    const start = nextPages[0];
    if (start === undefined || start === positionRef.current) return;
    clearHoldTimer();
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
  const showPrevious = () => {
    const idx = currentTargetGroupIndex();
    if (idx > 0) goToOpening(idx - 1);
  };
  const showNext = () => {
    const idx = currentTargetGroupIndex();
    if (idx < groupsRef.current.length - 1) goToOpening(idx + 1);
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
    positionRef.current = start;
    setBookState({ ...next, lastPage: start });
    setPosition(start);
    setShownPosition(start);
  };
  const changeDirection = (direction: "rtl" | "ltr") => {
    setBookState((current) => ({ ...current, direction }));
  };
  const changeSpread = (spread: boolean) => changeLayout({ spread });
  const changeCoverSingle = (coverSingle: boolean) =>
    changeLayout({ coverSingle });

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const key = event.key;
    const forwardKey =
      key === "ArrowLeft"
        ? bookState.direction === "rtl"
        : key === "ArrowRight"
          ? bookState.direction === "ltr"
          : false;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      if (forwardKey) showNext();
      else showPrevious();
      return;
    }
    if (key === "PageDown" || key === " ") {
      event.preventDefault();
      if (key === " " && event.shiftKey) showPrevious();
      else showNext();
      return;
    }
    if (key === "PageUp") {
      event.preventDefault();
      showPrevious();
      return;
    }
    if (key === "Home") {
      event.preventDefault();
      goToOpening(0);
      return;
    }
    if (key === "End") {
      event.preventDefault();
      goToOpening(groupsRef.current.length - 1);
    }
  };

  const onWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (event.ctrlKey || event.deltaY === 0) return;
    const now = Date.now();
    if (now - lastWheelRef.current < WHEEL_THROTTLE_MS) return;
    lastWheelRef.current = now;
    if (event.deltaY > 0) showNext();
    else showPrevious();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    setHoverSide(ratio < 0.3 ? "left" : ratio > 0.7 ? "right" : null);
  };

  const renderOpening = (pages: number[]) => (
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
        return (
          <img
            alt={`${page}ページ`}
            className="bookPageImage"
            draggable={false}
            key={page}
            src={entry.url}
          />
        );
      })}
    </div>
  );

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
              <input
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
            見開き
          </button>
          <button
            aria-pressed={!bookState.spread}
            onClick={() => changeSpread(false)}
            type="button"
          >
            1ページ
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
            右から左
          </button>
          <button
            aria-pressed={bookState.direction === "ltr"}
            onClick={() => changeDirection("ltr")}
            type="button"
          >
            左から右
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
        </div>
        {book.truncated ? (
          <p className="bookNotice">5,000ページまで表示しています</p>
        ) : null}
      </div>
      <div
        aria-label={`${name}のページ`}
        className={`bookStage${bookState.direction === "rtl" ? " bookStage--rtl" : ""}${
          visiblePages.length === 1 ? " bookStage--one" : ""
        }`}
        data-focus-ring={focusRing ? "true" : undefined}
        onBlur={() => setFocusRing(false)}
        onFocus={() => setFocusRing(lastInputWasKeyboard())}
        onKeyDown={onKeyDown}
        onMouseDown={(event) => {
          if (!jumpOpen) event.preventDefault();
          setFocusRing(false);
          if (!jumpOpen) focusStage();
        }}
        onPointerDown={() => {
          setFocusRing(false);
          if (!jumpOpen) focusStage();
        }}
        onPointerLeave={() => setHoverSide(null)}
        onPointerMove={onPointerMove}
        onWheel={onWheel}
        ref={stageRef}
        tabIndex={0}
      >
        {renderOpening(visiblePages)}
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
        <div aria-live="polite" className="srOnly">
          {bookAnnouncement(targetPages)}
        </div>
      </div>
    </div>
  );
}
