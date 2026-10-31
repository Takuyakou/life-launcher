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

// Settings dialog fields: arrows always move focus ("navigating"); Enter, a click or typing starts
// "editing", where the field behaves natively. Enter commits, Esc restores the value from before.
const SETTINGS = ".settingsDialog";
const FIELD = 'input:not([type="checkbox"]):not([type="radio"]):not([readonly])';
let editing: { input: HTMLInputElement; original: string } | null = null;

const isEditing = (element: Element | null) =>
  element !== null && editing?.input === element && element.isConnected;

function startEditing(input: HTMLInputElement, selectAll: boolean) {
  editing = { input, original: input.value };
  input.dataset.editing = "true";
  if (selectAll) input.select();
}

function stopEditing(revert: boolean) {
  if (!editing) return;
  const { input, original } = editing;
  editing = null;
  delete input.dataset.editing;
  if (revert && input.value !== original) {
    // The native setter plus an input event reaches React's onChange for a controlled input.
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(input, original);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function settingsFieldKey(event: KeyboardEvent) {
  const input = document.activeElement;
  if (
    event.isComposing ||
    event.altKey ||
    event.ctrlKey ||
    event.metaKey ||
    !(input instanceof HTMLInputElement) ||
    !input.closest(SETTINGS)
  ) return;
  if (input.matches(FIELD)) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (isEditing(input)) stopEditing(false);
      else startEditing(input, true);
    } else if (event.key === "Escape" && isEditing(input)) {
      event.preventDefault();
      event.stopPropagation();
      stopEditing(true);
    }
  } else if (event.key === "Enter" && !event.repeat && (input.type === "checkbox" || input.type === "radio")) {
    event.preventDefault();
    input.click();
  }
}

export function installSettingsFieldEditing(): () => void {
  const target = (event: Event) => (event.target instanceof HTMLInputElement ? event.target : null);
  // Typing or clicking a field edits it too; beforeinput still sees the value from before the change.
  const onEdit = (event: Event) => {
    const input = target(event);
    if (input?.closest(SETTINGS) && input.matches(FIELD) && !isEditing(input)) startEditing(input, false);
  };
  const onFocusOut = (event: Event) => {
    if (isEditing(target(event))) stopEditing(false);
  };
  document.addEventListener("keydown", settingsFieldKey);
  document.addEventListener("beforeinput", onEdit, true);
  document.addEventListener("pointerdown", onEdit, true);
  document.addEventListener("focusout", onFocusOut, true);
  return () => {
    document.removeEventListener("keydown", settingsFieldKey);
    document.removeEventListener("beforeinput", onEdit, true);
    document.removeEventListener("pointerdown", onEdit, true);
    document.removeEventListener("focusout", onFocusOut, true);
  };
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
  const settingsInput =
    current instanceof HTMLInputElement && current.closest(SETTINGS) !== null && !isEditing(current);
  if (!settingsInput && current.matches('input:not([type="checkbox"]), textarea, select, [contenteditable="true"]')) return;
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
    // A number field or radio would otherwise change its value or caret on an arrow key.
    if (settingsInput) event.preventDefault();
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
      const group = current.closest(
        '.dialogActions, .builderSourceModes, .displayTargetList, .settingsButtonRow, .settingsGrid, .settingsToggleGrid, .settingsDisplayChoices, .shortcutCaptureControl, .folderPickerRow',
      );
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
    const timerControls = sidebar.querySelector<HTMLElement>('.timerDock .timerControls');
    const timerActions = timerControls ? available(timerControls) : [];
    const sidebarItems = available(sidebar).filter((item) => !item.closest('.timerDock'));
    if (timerActions.includes(current)) {
      if (event.key === "ArrowUp") focus(sidebarItems[sidebarItems.length - 1], event);
      else if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "ArrowDown") {
        const direction = event.key === "ArrowLeft" ? -1 : 1;
        focus(timerActions[timerActions.indexOf(current) + direction], event);
      }
      return;
    }
    if (current.closest('.timerDock') && timerActions.length > 0) {
      if (event.key === "ArrowUp") focus(sidebarItems[sidebarItems.length - 1], event);
      else if (event.key === "ArrowDown" || event.key === "ArrowRight") focus(timerActions[0], event);
      return;
    }
    if (event.key === "ArrowRight") focus(available(main)[0], event);
    else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      const items = timerActions.length ? sidebarItems : available(sidebar);
      const next = items[items.indexOf(current) + (event.key === "ArrowDown" ? 1 : -1)];
      if (next) focus(next, event);
      else if (event.key === "ArrowDown") focus(timerActions[0], event);
      else focus(available(toolbar)[0], event);
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
