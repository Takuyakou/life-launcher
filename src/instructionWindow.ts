import { PhysicalPosition, PhysicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { emitTo, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { availableMonitors, primaryMonitor, type Monitor } from "@tauri-apps/api/window";

export const INSTRUCTION_WINDOW_LABEL = "life-launcher-instruction";
export const INSTRUCTION_OPEN_EVENT = "instruction-open-requested";
export const INSTRUCTION_READY_EVENT = "instruction-ready";
export const INSTRUCTION_WINDOW_SHOW_EVENT = "instruction-window-show";
export const INSTRUCTION_RELOAD_TREE_EVENT = "instruction-reload-tree";
export const INSTRUCTION_ALWAYS_ON_TOP_KEY = "life-launcher-instruction-always-on-top";
export const INSTRUCTION_LAST_OPENED_PATH_KEY = "life-launcher-instruction-last-opened-path";

const INITIAL_WIDTH = 960;
const INITIAL_HEIGHT = 680;
const MIN_WIDTH = 720;
const MIN_HEIGHT = 480;
const SAFE_MARGIN = 16;
const WINDOW_STATE_POSITION_AND_SIZE = 3;

export type InstructionOpenRequest = {
  path?: string;
};

export type InstructionWindowOpenOptions = InstructionOpenRequest & {
  focus: boolean;
};

export function readInstructionAlwaysOnTop(): boolean {
  return window.localStorage.getItem(INSTRUCTION_ALWAYS_ON_TOP_KEY) !== "false";
}

export function writeInstructionAlwaysOnTop(value: boolean) {
  window.localStorage.setItem(INSTRUCTION_ALWAYS_ON_TOP_KEY, String(value));
}

export function readLastInstructionPath(): string | null {
  const path = window.localStorage.getItem(INSTRUCTION_LAST_OPENED_PATH_KEY)?.trim();
  return path && /^[A-Za-z]:[\\/]/.test(path) ? path : null;
}

export function writeLastInstructionPath(path: string) {
  window.localStorage.setItem(INSTRUCTION_LAST_OPENED_PATH_KEY, path);
}

function monitorBounds(monitor: Monitor) {
  return {
    left: monitor.workArea.position.x,
    top: monitor.workArea.position.y,
    right: monitor.workArea.position.x + monitor.workArea.size.width,
    bottom: monitor.workArea.position.y + monitor.workArea.size.height,
  };
}

async function placeInstructionWindowSafely(instructionWindow: WebviewWindow) {
  const monitors = await availableMonitors();
  const fallbackMonitor = (await primaryMonitor()) ?? monitors[0];
  if (!fallbackMonitor) return;

  const [position, size] = await Promise.all([
    instructionWindow.outerPosition().catch(() => null),
    instructionWindow.outerSize().catch(() => null),
  ]);
  if (!position || !size) return;

  const currentMonitor = monitors.find((monitor) => {
    const bounds = monitorBounds(monitor);
    return (
      position.x < bounds.right &&
      position.x + size.width > bounds.left &&
      position.y < bounds.bottom &&
      position.y + size.height > bounds.top
    );
  });
  const monitor = currentMonitor ?? fallbackMonitor;
  const bounds = monitorBounds(monitor);
  const availableWidth = Math.max(1, bounds.right - bounds.left - SAFE_MARGIN * 2);
  const availableHeight = Math.max(1, bounds.bottom - bounds.top - SAFE_MARGIN * 2);
  const width = Math.min(size.width, availableWidth);
  const height = Math.min(size.height, availableHeight);

  if (width !== size.width || height !== size.height) {
    await instructionWindow.setSize(new PhysicalSize(width, height));
  }

  const maxX = Math.max(bounds.left + SAFE_MARGIN, bounds.right - width - SAFE_MARGIN);
  const maxY = Math.max(bounds.top + SAFE_MARGIN, bounds.bottom - height - SAFE_MARGIN);
  const x = Math.min(Math.max(position.x, bounds.left + SAFE_MARGIN), maxX);
  const y = Math.min(Math.max(position.y, bounds.top + SAFE_MARGIN), maxY);
  if (x !== position.x || y !== position.y || !currentMonitor) {
    await instructionWindow.setPosition(new PhysicalPosition(Math.round(x), Math.round(y)));
  }
}

async function restoreInstructionWindowBounds() {
  await invoke("plugin:window-state|restore_state", {
    label: INSTRUCTION_WINDOW_LABEL,
    flags: WINDOW_STATE_POSITION_AND_SIZE,
  });
}

async function showInstructionWindow(
  instructionWindow: WebviewWindow,
  focus: boolean,
  alreadyVisible: boolean,
) {
  if (focus) {
    await instructionWindow.setFocusable(true);
    await instructionWindow.show();
    await instructionWindow.unminimize();
    await instructionWindow.setFocus();
    return;
  }

  if (alreadyVisible) return;
  await instructionWindow.setFocusable(false);
  try {
    await instructionWindow.show();
  } finally {
    await instructionWindow.setFocusable(true);
  }
}

function waitForWindowCreated(instructionWindow: WebviewWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      callback();
    };
    void instructionWindow.once("tauri://created", () => finish(resolve)).catch((error) => {
      finish(() => reject(error));
    });
    void instructionWindow
      .once<unknown>("tauri://error", (event) => {
        finish(() => reject(new Error(String(event.payload ?? "手順書ウィンドウを作成できません"))));
      })
      .catch((error) => finish(() => reject(error)));
  });
}

async function createReadyWaiter(timeoutMs = 10_000): Promise<{
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
    rejectReady(new Error("手順書ウィンドウの準備がタイムアウトしました"));
  }, timeoutMs);
  const unlisten = await listen(INSTRUCTION_READY_EVENT, () => {
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

function instructionUrl(path?: string): string {
  const params = new URLSearchParams({ view: "instruction" });
  if (path) params.set("path", path);
  return `/?${params.toString()}`;
}

export async function openInstructionWindow({
  path,
  focus,
}: InstructionWindowOpenOptions): Promise<WebviewWindow> {
  const existing = await WebviewWindow.getByLabel(INSTRUCTION_WINDOW_LABEL);
  if (existing) {
    const alreadyVisible = await existing.isVisible();
    await placeInstructionWindowSafely(existing);
    await existing.setAlwaysOnTop(readInstructionAlwaysOnTop());
    if (path) {
      await emitTo(INSTRUCTION_WINDOW_LABEL, INSTRUCTION_OPEN_EVENT, { path });
    }
    await showInstructionWindow(existing, focus, alreadyVisible);
    return existing;
  }

  const readyWaiter = await createReadyWaiter();
  const instructionWindow = new WebviewWindow(INSTRUCTION_WINDOW_LABEL, {
    url: instructionUrl(path),
    title: "Life Launcher 手順書",
    width: INITIAL_WIDTH,
    height: INITIAL_HEIGHT,
    minWidth: MIN_WIDTH,
    minHeight: MIN_HEIGHT,
    resizable: true,
    alwaysOnTop: readInstructionAlwaysOnTop(),
    focus: false,
    focusable: false,
    visible: false,
  });
  try {
    await Promise.all([waitForWindowCreated(instructionWindow), readyWaiter.promise]);
    await restoreInstructionWindowBounds();
    await placeInstructionWindowSafely(instructionWindow);
    await showInstructionWindow(instructionWindow, focus, false);
    return instructionWindow;
  } catch (error) {
    await instructionWindow.close().catch(() => undefined);
    throw error;
  } finally {
    readyWaiter.dispose();
  }
}

export async function resetInstructionWindowPosition(): Promise<void> {
  const instructionWindow = await openInstructionWindow({
    path: readLastInstructionPath() ?? undefined,
    focus: true,
  });
  const monitors = await availableMonitors();
  const monitor = (await primaryMonitor()) ?? monitors[0];
  if (!monitor) return;

  const bounds = monitorBounds(monitor);
  const width = Math.min(INITIAL_WIDTH, Math.max(MIN_WIDTH, bounds.right - bounds.left - SAFE_MARGIN * 2));
  const height = Math.min(
    INITIAL_HEIGHT,
    Math.max(MIN_HEIGHT, bounds.bottom - bounds.top - SAFE_MARGIN * 2),
  );
  const x = bounds.left + Math.max(SAFE_MARGIN, Math.round((bounds.right - bounds.left - width) / 2));
  const y = bounds.top + Math.max(SAFE_MARGIN, Math.round((bounds.bottom - bounds.top - height) / 2));
  await instructionWindow.setSize(new PhysicalSize(width, height));
  await instructionWindow.setPosition(new PhysicalPosition(x, y));
  await invoke("plugin:window-state|save_window_state", {
    flags: WINDOW_STATE_POSITION_AND_SIZE,
  });
}
