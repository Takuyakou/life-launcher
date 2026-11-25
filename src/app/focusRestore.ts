// V165 PR 0: only the overlays that own focus may block a delayed focus return. The inline
// `.nextStepOpenMenu[role="menu"]` does not own focus and must not match this selector.
export const FOCUS_OWNING_OVERLAY_SELECTOR =
  '.modalBackdrop:not([data-exiting="true"]), .searchPaletteBackdrop:not([data-exiting="true"]), .expandedTimerBackdrop:not([data-exiting="true"]), [role="dialog"][aria-modal="true"]:not([data-exiting="true"]):not([data-exiting="true"] *), [data-focus-overlay="true"]:not([data-exiting="true"]):not([data-exiting="true"] *)';

export function shouldSkipFocusRestore(returnTarget: HTMLElement | null): boolean {
  return Array.from(document.querySelectorAll<HTMLElement>(FOCUS_OWNING_OVERLAY_SELECTOR)).some(
    (overlay) => !returnTarget || !overlay.contains(returnTarget),
  );
}
