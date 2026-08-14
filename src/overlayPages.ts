import type { LauncherButton, OverlayPage } from "./types";
import { DEFAULT_BUTTON_GROUP } from "./constants";

export const OVERLAY_ALL_PAGE_KEY = "fixed:all";
export const OVERLAY_UNCLASSIFIED_PAGE_KEY = "fixed:unclassified";
const OVERLAY_CUSTOM_PAGE_PREFIX = "custom:";

export function orderOverlayButtons(
  buttons: LauncherButton[],
  dictionaryOrder?: string[],
): LauncherButton[] {
  if (!dictionaryOrder) return buttons.filter((button) => button.showInOverlay !== false);

  const buttonsById = new Map(buttons.map((button) => [button.id, button]));
  const ordered: LauncherButton[] = [];
  const seen = new Set<string>();

  for (const id of dictionaryOrder) {
    const button = buttonsById.get(id);
    if (button && button.showInOverlay !== false && !seen.has(id)) {
      ordered.push(button);
      seen.add(id);
    }
  }

  for (const button of buttons) {
    if (button.showInOverlay !== false && !seen.has(button.id)) {
      ordered.push(button);
      seen.add(button.id);
    }
  }

  return ordered;
}

export function overlayCustomPageKey(pageId: string): string {
  return `${OVERLAY_CUSTOM_PAGE_PREFIX}${pageId}`;
}

export function overlayPageIdFromKey(pageKey: string): string | null {
  return pageKey.startsWith(OVERLAY_CUSTOM_PAGE_PREFIX)
    ? pageKey.slice(OVERLAY_CUSTOM_PAGE_PREFIX.length)
    : null;
}

export function getOverlayPageKeyForButton(
  button: LauncherButton,
  overlayPages: OverlayPage[],
): string {
  const pageId = button.overlayPageId?.trim();
  return pageId && overlayPages.some((page) => page.id === pageId)
    ? overlayCustomPageKey(pageId)
    : OVERLAY_UNCLASSIFIED_PAGE_KEY;
}

export function getOverlayPageNameForButton(
  button: LauncherButton,
  overlayPages: OverlayPage[],
): string {
  const pageId = button.overlayPageId?.trim();
  return overlayPages.find((page) => page.id === pageId)?.name ?? "未分類";
}

export function searchOverlayButtons(
  buttons: LauncherButton[],
  overlayPages: OverlayPage[],
  query: string,
  dictionaryOrder?: string[],
): LauncherButton[] {
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleButtons = orderOverlayButtons(buttons, dictionaryOrder);
  if (!normalizedQuery) return visibleButtons;

  return visibleButtons.filter((button) => {
    const searchableValues = [
      button.label,
      button.group?.trim() || DEFAULT_BUTTON_GROUP,
      getOverlayPageNameForButton(button, overlayPages),
      button.description ?? "",
      ...(button.aliases ?? []),
    ];
    return searchableValues.some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });
}

export function getButtonsForOverlayPage(
  buttons: LauncherButton[],
  pageKey: string,
  overlayPages: OverlayPage[],
  dictionaryOrder?: string[],
): LauncherButton[] {
  const visibleButtons = orderOverlayButtons(buttons, dictionaryOrder);
  if (pageKey === OVERLAY_ALL_PAGE_KEY) return visibleButtons;
  return visibleButtons.filter(
    (button) => getOverlayPageKeyForButton(button, overlayPages) === pageKey,
  );
}

export function getOverlayPageCounts(
  buttons: LauncherButton[],
  overlayPages: OverlayPage[],
): Map<string, number> {
  const counts = new Map<string, number>([
    [OVERLAY_ALL_PAGE_KEY, 0],
    [OVERLAY_UNCLASSIFIED_PAGE_KEY, 0],
    ...overlayPages.map((page) => [overlayCustomPageKey(page.id), 0] as const),
  ]);

  for (const button of buttons) {
    if (button.showInOverlay === false) continue;
    counts.set(OVERLAY_ALL_PAGE_KEY, (counts.get(OVERLAY_ALL_PAGE_KEY) ?? 0) + 1);
    const pageKey = getOverlayPageKeyForButton(button, overlayPages);
    counts.set(pageKey, (counts.get(pageKey) ?? 0) + 1);
  }

  return counts;
}

export function isOverlayPageKeyAvailable(pageKey: string, overlayPages: OverlayPage[]): boolean {
  if (pageKey === OVERLAY_ALL_PAGE_KEY || pageKey === OVERLAY_UNCLASSIFIED_PAGE_KEY) return true;
  const pageId = overlayPageIdFromKey(pageKey);
  return pageId !== null && overlayPages.some((page) => page.id === pageId);
}

export function getOverlayDropPageId(
  pageKey: string,
  overlayPages: OverlayPage[],
  overlayOpen: boolean,
  searchActive: boolean,
): string | null {
  if (!overlayOpen || searchActive) return null;
  const pageId = overlayPageIdFromKey(pageKey);
  return pageId && overlayPages.some((page) => page.id === pageId) ? pageId : null;
}
