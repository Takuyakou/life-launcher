import type { ActiveTimer, MiniTimerSnapshot } from "./dashboardTypes";
import { MINI_POSITION_STORAGE_KEY, MINI_READY_EVENT, MINI_WINDOW_HEIGHT_PX, MINI_WINDOW_SAFE_MARGIN_PX, MINI_WINDOW_WIDTH_PX } from "./constants";
import { MiniWindowPosition } from "../types";
import { type Monitor, availableMonitors, primaryMonitor } from "@tauri-apps/api/window";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen } from "@tauri-apps/api/event";

export function isMiniModeView(): boolean {
  return new URLSearchParams(window.location.search).get("view") === "mini";
}

export function isInstructionView(): boolean {
  return new URLSearchParams(window.location.search).get("view") === "instruction";
}

export function isDictionaryView(): boolean {
  return new URLSearchParams(window.location.search).get("view") === "dictionary";
}

export function timerActionText(timer: Pick<ActiveTimer, "actionText" | "label">): string {
  return timer.actionText?.trim() || timer.label;
}

export function inactiveMiniSnapshot(): MiniTimerSnapshot {
  return {
    active: false,
    label: "",
    actionText: "",
    mode: "countdown",
    remainingClock: "00:00",
    paused: false,
    progressPercent: 0,
    projectId: null,
    projectName: "",
    projectColorId: null,
  };
}

export function readMiniPosition(): MiniWindowPosition | null {
  try {
    const raw = window.localStorage.getItem(MINI_POSITION_STORAGE_KEY);
    if (!raw) return null;
    const position = JSON.parse(raw) as { x?: unknown; y?: unknown };
    if (!isFiniteMiniPosition(position)) return null;
    return { x: position.x, y: position.y };
  } catch {
    return null;
  }
}

export function writeMiniPosition(x: number, y: number) {
  window.localStorage.setItem(MINI_POSITION_STORAGE_KEY, JSON.stringify({ x, y }));
}

export function clearMiniPosition() {
  window.localStorage.removeItem(MINI_POSITION_STORAGE_KEY);
}

export function isFiniteMiniPosition(
  position: {
    x?: unknown;
    y?: unknown;
  } | null,
): position is MiniWindowPosition {
  return (
    typeof position?.x === "number" &&
    typeof position.y === "number" &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y)
  );
}

export function monitorWorkArea(monitor: Monitor) {
  return {
    left: monitor.workArea.position.x,
    top: monitor.workArea.position.y,
    right: monitor.workArea.position.x + monitor.workArea.size.width,
    bottom: monitor.workArea.position.y + monitor.workArea.size.height,
  };
}

export function isMiniPositionInMonitor(position: MiniWindowPosition, monitor: Monitor): boolean {
  const workArea = monitorWorkArea(monitor);
  return (
    position.x >= workArea.left &&
    position.y >= workArea.top &&
    position.x + MINI_WINDOW_WIDTH_PX <= workArea.right &&
    position.y + MINI_WINDOW_HEIGHT_PX <= workArea.bottom
  );
}

export function bottomRightMiniPosition(monitor: Monitor): MiniWindowPosition {
  const workArea = monitorWorkArea(monitor);
  const x = Math.max(
    workArea.left + MINI_WINDOW_SAFE_MARGIN_PX,
    workArea.right - MINI_WINDOW_WIDTH_PX - MINI_WINDOW_SAFE_MARGIN_PX,
  );
  const y = Math.max(
    workArea.top + MINI_WINDOW_SAFE_MARGIN_PX,
    workArea.bottom - MINI_WINDOW_HEIGHT_PX - MINI_WINDOW_SAFE_MARGIN_PX,
  );
  return { x: Math.round(x), y: Math.round(y) };
}

export async function resolveSafeMiniPosition(
  savedPosition: MiniWindowPosition | null,
): Promise<MiniWindowPosition> {
  const monitors = await availableMonitors();
  if (
    savedPosition &&
    monitors.some((monitor) => isMiniPositionInMonitor(savedPosition, monitor))
  ) {
    return { x: Math.round(savedPosition.x), y: Math.round(savedPosition.y) };
  }

  const monitor = (await primaryMonitor()) ?? monitors[0];
  return monitor ? bottomRightMiniPosition(monitor) : { x: 16, y: 16 };
}

export function waitForMiniWindowCreated(miniWindow: WebviewWindow): Promise<void> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const resolveOnce = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const rejectOnce = (message: string) => {
      if (settled) return;
      settled = true;
      reject(new Error(message));
    };

    void miniWindow.once("tauri://created", resolveOnce).catch((error) => {
      rejectOnce(error instanceof Error ? error.message : String(error));
    });
    void miniWindow
      .once<unknown>("tauri://error", (event) => {
        rejectOnce(event.payload ? String(event.payload) : "ミニウィンドウの作成に失敗しました");
      })
      .catch((error) => {
        rejectOnce(error instanceof Error ? error.message : String(error));
      });
  });
}

export async function createMiniReadyWaiter(timeoutMs = 10_000): Promise<{
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
    rejectReady(new Error("ミニウィンドウの準備がタイムアウトしました"));
  }, timeoutMs);
  const unlisten = await listen(MINI_READY_EVENT, () => {
    if (settled) return;
    settled = true;
    window.clearTimeout(timeoutId);
    resolveReady();
  });

  return {
    promise,
    dispose: () => {
      settled = true;
      window.clearTimeout(timeoutId);
      unlisten();
    },
  };
}

export function sameMiniPosition(
  left: MiniWindowPosition | null | undefined,
  right: MiniWindowPosition,
): boolean {
  return left ? Math.round(left.x) === right.x && Math.round(left.y) === right.y : false;
}
