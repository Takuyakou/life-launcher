// V160-B2: pure helpers for the image-book view. The page numbers here are 1-based.
import type { InstructionBookState } from "./types";

export const DEFAULT_INSTRUCTION_BOOK_STATE: InstructionBookState = {
  direction: "rtl",
  spread: true,
  coverSingle: true,
  lastPage: 1,
};

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

/** The progress bar fills up to the first page of the opening (the mock's 28% at 34/120). */
export function bookProgressPercent(firstPage: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return Math.min(100, Math.max(0, (firstPage / pageCount) * 100));
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
