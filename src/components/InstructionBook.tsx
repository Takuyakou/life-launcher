import { useEffect, useMemo, useRef, useState } from "react";
import type {
  KeyboardEvent as ReactKeyboardEvent,
  PointerEvent as ReactPointerEvent,
  WheelEvent as ReactWheelEvent,
} from "react";
import { useReducedMotion } from "motion/react";
import {
  DEFAULT_INSTRUCTION_BOOK_STATE,
  bookAnnouncement,
  bookGroupIndexForPage,
  bookPageGroups,
  bookPageLabel,
  bookPageMime,
  bookProgressPercent,
} from "../instructionBook";
import {
  loadInstructionBookState,
  openInstructionBook,
  readInstructionBookPage,
  saveInstructionBookState,
} from "../tauri";
import type { InstructionBookOpenResult, InstructionBookState } from "../types";

type PageEntry = {
  status: "loading" | "ready" | "error";
  url?: string;
  error?: string;
};

type OutgoingOpening = {
  pages: number[];
  nonce: number;
};

const MAX_CACHED_PAGES = 12;
const PRELOAD_OPENINGS = 2;
const SAVE_DELAY_MS = 800;
const TURN_DURATION_MS = 120;
const WHEEL_THROTTLE_MS = 250;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function InstructionBook({ path, name }: { path: string; name: string }) {
  const reducedMotion = useReducedMotion() ?? false;
  const stageRef = useRef<HTMLDivElement>(null);
  const [book, setBook] = useState<InstructionBookOpenResult | null>(null);
  const [bookState, setBookState] = useState<InstructionBookState>(
    DEFAULT_INSTRUCTION_BOOK_STATE,
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [position, setPosition] = useState(1);
  const [cache, setCache] = useState<Map<number, PageEntry>>(new Map());
  const [hoverSide, setHoverSide] = useState<"left" | "right" | null>(null);
  const [outgoing, setOutgoing] = useState<OutgoingOpening | null>(null);
  const lastWheelRef = useRef(0);
  const cacheRef = useRef(cache);
  const stateRef = useRef(bookState);
  const positionRef = useRef(position);
  cacheRef.current = cache;
  stateRef.current = bookState;
  positionRef.current = position;

  useEffect(() => {
    let disposed = false;
    setBook(null);
    setLoadError(null);
    setCache(new Map());
    setOutgoing(null);
    setPosition(1);
    void Promise.all([openInstructionBook(path), loadInstructionBookState(path)])
      .then(([info, saved]) => {
        if (disposed) return;
        const restored: InstructionBookState = {
          ...DEFAULT_INSTRUCTION_BOOK_STATE,
          ...saved,
          direction: saved.direction === "ltr" ? "ltr" : "rtl",
          lastPage: Math.max(1, Math.floor(saved.lastPage || 1)),
        };
        const groups = bookPageGroups(
          info.pageCount,
          restored.spread,
          restored.coverSingle,
        );
        const start = groups[bookGroupIndexForPage(groups, restored.lastPage)]?.[0] ?? 1;
        setBook(info);
        setBookState({ ...restored, lastPage: start });
        setPosition(start);
      })
      .catch((error) => {
        if (!disposed) setLoadError(errorText(error));
      });
    return () => {
      disposed = true;
    };
  }, [path]);

  const groups = useMemo(
    () =>
      book
        ? bookPageGroups(book.pageCount, bookState.spread, bookState.coverSingle)
        : [],
    [book, bookState.spread, bookState.coverSingle],
  );
  const groupIndex = useMemo(
    () => bookGroupIndexForPage(groups, position),
    [groups, position],
  );
  const visiblePages = groups[groupIndex] ?? [];

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

  useEffect(
    () => () => {
      for (const entry of cacheRef.current.values()) {
        if (entry.url) URL.revokeObjectURL(entry.url);
      }
    },
    [],
  );

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

  useEffect(() => {
    if (!book) return;
    let cancelled = false;
    const needed = new Set(
      neededKey
        .split(",")
        .filter(Boolean)
        .map((value) => Number(value)),
    );
    for (const page of needed) {
      if (cacheRef.current.has(page)) continue;
      setCache((previous) => {
        const next = new Map(previous);
        next.set(page, { status: "loading" });
        return next;
      });
      void readInstructionBookPage(path, page - 1)
        .then((buffer) => {
          if (cancelled) return;
          const bytes = new Uint8Array(buffer);
          const mime = bookPageMime(bytes[0]);
          if (!mime) throw new Error("このページは画像ではないため表示しません");
          const url = URL.createObjectURL(
            new Blob([bytes.subarray(1)], { type: mime }),
          );
          setCache((previous) => {
            const next = new Map(previous);
            next.set(page, { status: "ready", url });
            while (next.size > MAX_CACHED_PAGES) {
              const oldest = Array.from(next.entries()).find(
                ([key, entry]) =>
                  !needed.has(key) && entry.status === "ready",
              );
              if (!oldest) break;
              if (oldest[1].url) URL.revokeObjectURL(oldest[1].url!);
              next.delete(oldest[0]);
            }
            return next;
          });
        })
        .catch((error) => {
          if (cancelled) return;
          setCache((previous) => {
            const next = new Map(previous);
            next.set(page, { status: "error", error: errorText(error) });
            return next;
          });
        });
    }
    return () => {
      cancelled = true;
    };
  }, [book, path, neededKey]);

  // Cross-fade the previous opening out for 120 ms (skipped when motion is reduced).
  const previousOpeningRef = useRef<{ position: number; pages: number[] } | null>(null);
  useEffect(() => {
    if (!book) {
      previousOpeningRef.current = null;
      return;
    }
    const previous = previousOpeningRef.current;
    const pages = groups[groupIndex] ?? [];
    previousOpeningRef.current = { position, pages };
    if (!previous || previous.position === position || reducedMotion) {
      setOutgoing(null);
      return;
    }
    setOutgoing({ pages: previous.pages, nonce: Date.now() });
    const timer = window.setTimeout(() => setOutgoing(null), TURN_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [book, groups, groupIndex, position, reducedMotion]);

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
    const clamped = Math.max(0, Math.min(groups.length - 1, index));
    const start = groups[clamped]?.[0];
    if (start !== undefined && start !== positionRef.current) {
      setPosition(start);
    }
  };
  const showPrevious = () => {
    if (canPrevious) goToOpening(groupIndex - 1);
  };
  const showNext = () => {
    if (canNext) goToOpening(groupIndex + 1);
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
    setBookState({ ...next, lastPage: start });
    setPosition(start);
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
      goToOpening(groups.length - 1);
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

  const renderOpening = (pages: number[], extraClass: string, current: boolean) => (
    <div
      className={`bookPageLayer ${extraClass}${bookState.direction === "rtl" ? " bookPageLayer--rtl" : ""}${
        pages.length === 1 ? " bookPageLayer--one" : ""
      }`}
      key={current ? `current-${position}` : `outgoing-${outgoing?.nonce ?? 0}`}
    >
      {pages.map((page) => {
        const entry = cache.get(page);
        if (!entry || entry.status === "loading") {
          return <div className="bookPagePending" key={page} />;
        }
        if (entry.status === "error") {
          return (
            <div className="bookPageError" key={page} role={current ? "alert" : undefined}>
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

  const label = bookPageLabel(visiblePages);
  const progress = bookProgressPercent(visiblePages[0] ?? 1, book.pageCount);
  return (
    <div className="bookPane">
      <div className="bookHeader">
        <div className="bookToolbar">
        <div className="bookPageLabel">
          {label}
          <span> / {book.pageCount}</span>
        </div>
        <div className="bookSeg" role="group" aria-label="ページの出し方">
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
        <div className="bookSeg" role="group" aria-label="めくる向き">
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
        <label className="bookCheck">
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
        onKeyDown={onKeyDown}
        onPointerDown={(event) => {
          if (event.target === event.currentTarget) stageRef.current?.focus();
        }}
        onPointerLeave={() => setHoverSide(null)}
        onPointerMove={onPointerMove}
        onWheel={onWheel}
        ref={stageRef}
        tabIndex={0}
      >
        {outgoing ? renderOpening(outgoing.pages, "bookPageLayer--outgoing", false) : null}
        {renderOpening(visiblePages, "bookPageLayer--current", true)}
        <button
          aria-label={leftAria}
          className="bookZone bookZone--left"
          data-available={leftAvailable}
          data-visible={hoverSide === "left" && leftAvailable}
          onClick={leftAction}
          onKeyDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.preventDefault()}
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
          data-visible={hoverSide === "right" && rightAvailable}
          onClick={rightAction}
          onKeyDown={(event) => event.stopPropagation()}
          onMouseDown={(event) => event.preventDefault()}
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
        >
          <b style={{ width: `${progress}%` }} />
        </div>
        <div aria-live="polite" className="srOnly">
          {bookAnnouncement(visiblePages)}
        </div>
      </div>
    </div>
  );
}
