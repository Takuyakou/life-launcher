// V160-B2: pure helpers for the image-book view. The page numbers here are 1-based.
import type { InstructionBookState } from "./types";

export const BOOK_ZOOM_STEPS = [100, 125, 150, 200, 300, 400] as const;
export const DEFAULT_BOOK_ZOOM_PERCENT = 100;

export const DEFAULT_INSTRUCTION_BOOK_STATE: InstructionBookState = {
  direction: "rtl",
  spread: true,
  coverSingle: true,
  lastPage: 1,
  zoomPercent: DEFAULT_BOOK_ZOOM_PERCENT,
};

export function normalizeBookZoomPercent(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return DEFAULT_BOOK_ZOOM_PERCENT;
  return (BOOK_ZOOM_STEPS as readonly number[]).includes(value) ? value : DEFAULT_BOOK_ZOOM_PERCENT;
}

export function stepBookZoomPercent(current: number, delta: 1 | -1): number {
  const index = BOOK_ZOOM_STEPS.indexOf(normalizeBookZoomPercent(current) as (typeof BOOK_ZOOM_STEPS)[number]);
  const nextIndex = Math.max(0, Math.min(BOOK_ZOOM_STEPS.length - 1, (index >= 0 ? index : 0) + delta));
  return BOOK_ZOOM_STEPS[nextIndex];
}

export function fitBookPageSize(
  naturalWidth: number,
  naturalHeight: number,
  slotWidth: number,
  slotHeight: number,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0 || slotWidth <= 0 || slotHeight <= 0) {
    return { width: 0, height: 0 };
  }
  const scale = Math.min(slotWidth / naturalWidth, slotHeight / naturalHeight);
  return {
    width: naturalWidth * scale,
    height: naturalHeight * scale,
  };
}

/** The groups of pages shown at once: an opening pair, one page, or the single cover. */
export function bookPageGroups(
  pageCount: number,
  spread: boolean,
  coverSingle: boolean,
): number[][] {
  const pages = Math.max(0, Math.floor(pageCount));
  if (!spread) {
    return Array.from({ length: pages }, (_, index) => [index + 1]);
  }
  const groups: number[][] = [];
  let page = 1;
  if (coverSingle && pages > 0) {
    groups.push([1]);
    page = 2;
  }
  while (page <= pages) {
    groups.push(page + 1 <= pages ? [page, page + 1] : [page]);
    page += 2;
  }
  return groups;
}

/** The group that contains `page` (clamped to the existing groups). */
export function bookGroupIndexForPage(groups: number[][], page: number): number {
  if (groups.length === 0) return 0;
  const found = groups.findIndex((group) => group.includes(page));
  if (found >= 0) return found;
  if (page < groups[0][0]) return 0;
  return groups.length - 1;
}

/** "34–35" for an opening, "34" for one page. The total is rendered separately. */
export function bookPageLabel(pages: number[]): string {
  if (pages.length === 0) return "";
  if (pages.length === 1) return String(pages[0]);
  return `${pages[0]}–${pages[pages.length - 1]}`;
}

/** The text read by the aria-live region. */
export function bookAnnouncement(pages: number[]): string {
  if (pages.length === 0) return "";
  return `${pages.join("、")}ページ`;
}

/** V161-B4: `(page - 1) / (pageCount - 1) * 100` (0% at page 1, 100% at the end or single page). */
export function bookProgressPercent(page: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  if (pageCount === 1) return 100;
  const clamped = Math.max(1, Math.min(pageCount, page));
  return Math.min(100, Math.max(0, ((clamped - 1) / (pageCount - 1)) * 100));
}

/** Inverse of `bookProgressPercent` for scrub clicks/drags along the progress bar. */
export function bookPageFromRatio(
  ratio: number,
  pageCount: number,
  direction: "rtl" | "ltr",
): number {
  if (pageCount <= 1) return 1;
  const clamped = Math.min(1, Math.max(0, ratio));
  const effective = direction === "rtl" ? 1 - clamped : clamped;
  return 1 + Math.round(effective * (pageCount - 1));
}

/** Parse a jump input string, normalizing full-width digits `０`–`９` and clamping to `1..pageCount`. */
export function parseBookJumpPage(raw: string, pageCount: number): number | null {
  if (pageCount <= 0) return null;
  const normalized = raw
    .replace(/[０-９]/g, (digit) => String.fromCharCode(digit.charCodeAt(0) - 0xfee0))
    .trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(1, Math.min(pageCount, parsed));
}

export function bookPageMime(type: number): string | null {
  if (type === 1) return "image/jpeg";
  if (type === 2) return "image/png";
  if (type === 3) return "image/gif";
  if (type === 4) return "image/webp";
  return null;
}

export function isInstructionBookName(name: string): boolean {
  return name.toLocaleLowerCase().endsWith(".zip");
}
