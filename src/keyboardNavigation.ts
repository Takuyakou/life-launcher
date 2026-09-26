const FOCUSABLE =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex="0"]';

function available(container: Element): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (element) =>
      element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== "hidden" &&
      !element.closest('[aria-hidden="true"], [inert]'),
  );
}

function focus(target: HTMLElement | undefined, event: KeyboardEvent): boolean {
  if (!target) return false;
  event.preventDefault();
  target.focus({ preventScroll: true });
  target.scrollIntoView({ block: "nearest", inline: "nearest" });
  return true;
}

function step(container: Element, current: HTMLElement, offset: number, event: KeyboardEvent) {
  const items = available(container);
  const index = items.indexOf(current);
  return focus(items[index + offset], event);
}

export function navigateAppArrow(event: KeyboardEvent, captureActive: boolean): void {
  if (
    captureActive ||
    event.defaultPrevented ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
  ) return;
  const current = document.activeElement;
  if (!(current instanceof HTMLElement)) return;
  if (current.matches('input:not([type="checkbox"]), textarea, select, [contenteditable="true"]')) return;
  if (current.closest('[role="menu"], .launcherOverlay')) return;

  const modals = Array.from(
    document.querySelectorAll<HTMLElement>('.modalBackdrop [role="dialog"][aria-modal="true"]'),
  );
  const modal = modals[modals.length - 1];
  const timer = document.querySelector<HTMLElement>('.expandedTimer[role="dialog"]');
  const surface = modal ?? timer;
  if (surface) {
    if (!surface.contains(current)) {
      const first = surface.querySelector<HTMLElement>('.settingsTabs [role="tab"]') ?? available(surface)[0];
      focus(first, event);
      return;
    }
    const tab = current.closest<HTMLElement>('.settingsTabs [role="tab"]');
    if (tab && (event.key === "ArrowLeft" || event.key === "ArrowRight")) {
      const tabs = available(tab.closest('.settingsTabs')!);
      const next = tabs[tabs.indexOf(tab) + (event.key === "ArrowRight" ? 1 : -1)];
      if (focus(next, event)) next.click();
      return;
    }
    if (tab && event.key === "ArrowDown") {
      focus(available(surface.querySelector('.settingsSection:not(.settingsSection--hidden)') ?? surface)[0], event);
      return;
    }
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      step(surface, current, event.key === "ArrowDown" ? 1 : -1, event);
    } else {
      const group = current.closest('.dialogActions, .builderSourceModes, .displayTargetList, .settingsButtonRow');
      if (group) step(group, current, event.key === "ArrowRight" ? 1 : -1, event);
    }
    return;
  }

  const sidebar = document.querySelector<HTMLElement>('.sidebar');
  const toolbar = document.querySelector<HTMLElement>('.topBar');
  const main = document.querySelector<HTMLElement>('.mainScrollArea');
  if (!sidebar || !toolbar || !main) return;
  if (current === document.body) {
    focus(available(sidebar)[0], event);
    return;
  }
  if (sidebar.contains(current)) {
    if (event.key === "ArrowRight") focus(available(main)[0], event);
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const moved = step(sidebar, current, event.key === "ArrowDown" ? 1 : -1, event);
      if (!moved && event.key === "ArrowUp") focus(available(toolbar)[0], event);
    }
    return;
  }
  if (toolbar.contains(current)) {
    if (event.key === "ArrowDown") focus(available(main)[0], event);
    else if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      const moved = step(toolbar, current, event.key === "ArrowRight" ? 1 : -1, event);
      if (!moved && event.key === "ArrowLeft") focus(available(sidebar)[0], event);
    }
    return;
  }
  if (!main.contains(current)) return;
  if (event.key === "ArrowLeft") {
    const group = current.closest('.todayGrid, .dialogActions, .todayPickerRow');
    if (group && step(group, current, -1, event)) return;
    focus(available(sidebar)[0], event);
  } else if (event.key === "ArrowRight") {
    const group = current.closest('.todayGrid, .dialogActions, .todayPickerRow');
    if (group) step(group, current, 1, event);
  } else {
    const moved = step(main, current, event.key === "ArrowDown" ? 1 : -1, event);
    if (!moved && event.key === "ArrowUp") focus(available(toolbar)[0], event);
  }
}
