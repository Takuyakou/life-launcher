import { invoke } from "@tauri-apps/api/core";
import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { emit, emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import {
  availableMonitors,
  currentMonitor,
  primaryMonitor,
  type Monitor,
} from "@tauri-apps/api/window";

export const DICTIONARY_WINDOW_LABEL = "dictionary";
export const DICTIONARY_READY_EVENT = "dictionary-ready";
export const DICTIONARY_SHOWN_EVENT = "dictionary-shown";
export const DICTIONARY_VISIBILITY_EVENT = "dictionary-visibility-changed";

const INITIAL_WIDTH = 760;
const INITIAL_HEIGHT = 520;
const MIN_WIDTH = 420;
const MIN_HEIGHT = 300;
const SAFE_MARGIN = 16;
const WINDOW_STATE_POSITION_AND_SIZE = 3;
const TOGGLE_EVENT_DEDUPLICATION_MS = 250;

let openInFlight: Promise<WebviewWindow> | null = null;
let toggleInFlight: Promise<void> | null = null;
let lastToggleRequestAt = 0;

function dictionaryUrl(): string {
  return "/?view=dictionary";
}

function monitorBounds(monitor: Pick<Monitor, "workArea">) {
  return {
    left: monitor.workArea.position.x,
    top: monitor.workArea.position.y,
    right: monitor.workArea.position.x + monitor.workArea.size.width,
    bottom: monitor.workArea.position.y + monitor.workArea.size.height,
  };
}

type WindowGeometry = {
  position: { x: number; y: number };
  size: { width: number; height: number };
};

export function resolveDictionaryWindowGeometry(
  position: WindowGeometry["position"],
  size: WindowGeometry["size"],
  monitor: Pick<Monitor, "workArea">,
): WindowGeometry {
  const bounds = monitorBounds(monitor);
  const availableWidth = Math.max(1, bounds.right - bounds.left - SAFE_MARGIN * 2);
  const availableHeight = Math.max(1, bounds.bottom - bounds.top - SAFE_MARGIN * 2);
  const width = Math.min(size.width, availableWidth);
  const height = Math.min(size.height, availableHeight);
  const minX = bounds.left + SAFE_MARGIN;
  const minY = bounds.top + SAFE_MARGIN;
  const maxX = Math.max(minX, bounds.right - width - SAFE_MARGIN);
  const maxY = Math.max(minY, bounds.bottom - height - SAFE_MARGIN);
  const centerX = position.x + size.width / 2;
  const centerY = position.y + size.height / 2;
  const isCenteredOnTarget =
    centerX >= bounds.left &&
    centerX < bounds.right &&
    centerY >= bounds.top &&
    centerY < bounds.bottom;

  return {
    position: {
      x: isCenteredOnTarget
        ? Math.min(Math.max(position.x, minX), maxX)
        : Math.round(minX + (maxX - minX) / 2),
      y: isCenteredOnTarget
        ? Math.min(Math.max(position.y, minY), maxY)
        : Math.round(minY + (maxY - minY) / 2),
    },
    size: { width, height },
  };
}

async function placeDictionaryWindowSafely(dictionaryWindow: WebviewWindow) {
  const [monitors, ownerMonitor, fallbackMonitor] = await Promise.all([
    availableMonitors(),
    currentMonitor().catch(() => null),
    primaryMonitor().catch(() => null),
  ]);
  const targetMonitor = ownerMonitor ?? fallbackMonitor ?? monitors[0];
  if (!targetMonitor) return;

  const [position, size] = await Promise.all([
    dictionaryWindow.outerPosition().catch(() => null),
    dictionaryWindow.outerSize().catch(() => null),
  ]);
  if (!position || !size) return;

  const geometry = resolveDictionaryWindowGeometry(position, size, targetMonitor);

  if (geometry.size.width !== size.width || geometry.size.height !== size.height) {
    await dictionaryWindow.setSize(new PhysicalSize(geometry.size.width, geometry.size.height));
  }

  if (geometry.position.x !== position.x || geometry.position.y !== position.y) {
    await dictionaryWindow.setPosition(
      new PhysicalPosition(geometry.position.x, geometry.position.y),
    );
  }
}

async function restoreDictionaryWindowBounds() {
  await invoke("plugin:window-state|restore_state", {
    label: DICTIONARY_WINDOW_LABEL,
    flags: WINDOW_STATE_POSITION_AND_SIZE,
  });
}

async function saveDictionaryWindowBounds() {
  await invoke("plugin:window-state|save_window_state", {
    flags: WINDOW_STATE_POSITION_AND_SIZE,
  });
}

async function showAndFocusDictionaryWindow(dictionaryWindow: WebviewWindow) {
  await placeDictionaryWindowSafely(dictionaryWindow);
  await dictionaryWindow.show();
  await dictionaryWindow.unminimize();
  await dictionaryWindow.setFocus();
  await emitTo(DICTIONARY_WINDOW_LABEL, DICTIONARY_SHOWN_EVENT);
  await setDictionaryMainDimmed(true);
}

function waitForWindowCreated(dictionaryWindow: WebviewWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };

    void dictionaryWindow
      .once("tauri://created", () => finish(resolve))
      .catch((error) => {
        finish(() => reject(error));
      });
    void dictionaryWindow
      .once<unknown>("tauri://error", (event) => {
        finish(() =>
          reject(new Error(String(event.payload ?? "Failed to create Dictionary window."))),
        );
      })
      .catch((error) => finish(() => reject(error)));
  });
}

async function createDictionaryReadyWaiter(timeoutMs = 10_000): Promise<{
  promise: Promise<void>;
  dispose: () => void;
}> {
  let settled = false;
  let resolveReady: () => void = () => undefined;
  let rejectReady: (error: Error) => void = () => undefined;
  const promise = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const timeoutId = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    rejectReady(new Error("Timed out while preparing Dictionary window."));
  }, timeoutMs);
  const unlisten = await listen(DICTIONARY_READY_EVENT, () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeoutId);
    resolveReady();
  });

  return {
    promise,
    dispose: () => {
      window.clearTimeout(timeoutId);
      unlisten();
    },
  };
}

async function openDictionaryWindowInternal(): Promise<WebviewWindow> {
  const existing = await WebviewWindow.getByLabel(DICTIONARY_WINDOW_LABEL);
  if (existing) {
    await showAndFocusDictionaryWindow(existing);
    return existing;
  }

  const readyWaiter = await createDictionaryReadyWaiter();
  const dictionaryWindow = new WebviewWindow(DICTIONARY_WINDOW_LABEL, {
    url: dictionaryUrl(),
    title: "Life Launcher - Dictionary",
    width: INITIAL_WIDTH,
    height: INITIAL_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    resizable: true,
    decorations: false,
    skipTaskbar: true,
    parent: "main",
    focus: false,
    visible: false,
  });

  try {
    await Promise.all([waitForWindowCreated(dictionaryWindow), readyWaiter.promise]);
    await restoreDictionaryWindowBounds();
    await showAndFocusDictionaryWindow(dictionaryWindow);
    return dictionaryWindow;
  } catch (error) {
    await dictionaryWindow.close().catch(() => undefined);
    throw error;
  } finally {
    readyWaiter.dispose();
  }
}

export function openDictionaryWindow(): Promise<WebviewWindow> {
  if (openInFlight) return openInFlight;
  openInFlight = openDictionaryWindowInternal().finally(() => {
    openInFlight = null;
  });
  return openInFlight;
}

export async function hideDictionaryWindow(): Promise<void> {
  const dictionaryWindow = await WebviewWindow.getByLabel(DICTIONARY_WINDOW_LABEL);
  if (!dictionaryWindow) return;
  await saveDictionaryWindowBounds();
  await dictionaryWindow.hide();
  await setDictionaryMainDimmed(false);
}

export function setDictionaryMainDimmed(dimmed: boolean): Promise<void> {
  return emitTo("main", DICTIONARY_VISIBILITY_EVENT, dimmed);
}

async function toggleDictionaryWindowInternal(): Promise<void> {
  const dictionaryWindow = await WebviewWindow.getByLabel(DICTIONARY_WINDOW_LABEL);
  if (!dictionaryWindow) {
    await openDictionaryWindow();
    return;
  }

  const [visible, focused] = await Promise.all([
    dictionaryWindow.isVisible(),
    dictionaryWindow.isFocused(),
  ]);
  if (visible && focused) {
    await hideDictionaryWindow();
    return;
  }

  await showAndFocusDictionaryWindow(dictionaryWindow);
}

export function toggleDictionaryWindow(): Promise<void> {
  if (toggleInFlight) return toggleInFlight;

  const requestedAt = Date.now();
  if (requestedAt - lastToggleRequestAt < TOGGLE_EVENT_DEDUPLICATION_MS) {
    return Promise.resolve();
  }
  lastToggleRequestAt = requestedAt;

  toggleInFlight = toggleDictionaryWindowInternal().finally(() => {
    toggleInFlight = null;
  });
  return toggleInFlight;
}

export async function announceDictionaryReady(): Promise<void> {
  await emit(DICTIONARY_READY_EVENT);
}

export function listenForDictionaryShown(onShown: () => void): Promise<() => void> {
  return listen(DICTIONARY_SHOWN_EVENT, onShown);
}
