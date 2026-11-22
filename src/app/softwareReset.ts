import { GROUP_COLLAPSE_STORAGE_KEY, WEEKLY_REVIEW_SEEN_STORAGE_KEY } from "../constants";
import { SoftwareResetStorageSnapshot } from "../types";
import { loadSoftwareResetRecovery } from "../tauri";

export const SOFTWARE_RESET_TIMER_MESSAGE = "実行中のタイマーを終了してからリセットしてください。";
export const SOFTWARE_RESET_STORAGE_KEYS = [
  GROUP_COLLAPSE_STORAGE_KEY,
  WEEKLY_REVIEW_SEEN_STORAGE_KEY,
  "life-launcher-mini-position",
  "life-launcher-today-builder-order",
  "life-launcher-instruction-always-on-top",
  "life-launcher-instruction-last-opened-path",
  "life-launcher-instruction-expanded-folders",
  "life-launcher-instruction-tree-order-v1",
  "life-launcher.dictionary-focus-lock",
  "life-launcher-today-builder-dismissed",
] as const;

export let softwareResetRecoveryPromise: ReturnType<typeof loadSoftwareResetRecovery> | null = null;

export function getSoftwareResetRecoveryForBoot() {
  softwareResetRecoveryPromise ??= loadSoftwareResetRecovery();
  return softwareResetRecoveryPromise;
}

export function captureSoftwareResetStorage(): SoftwareResetStorageSnapshot {
  return Object.fromEntries(
    SOFTWARE_RESET_STORAGE_KEYS.map((key) => [key, window.localStorage.getItem(key)]),
  );
}

export function clearSoftwareResetStorage() {
  SOFTWARE_RESET_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

export function restoreSoftwareResetStorage(snapshot: SoftwareResetStorageSnapshot) {
  SOFTWARE_RESET_STORAGE_KEYS.forEach((key) => {
    const value = snapshot[key];
    if (value === null || value === undefined) {
      window.localStorage.removeItem(key);
    } else {
      window.localStorage.setItem(key, value);
    }
  });
}
