/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect } from "react";
import type { MiniTimerCommand } from "../app/dashboardTypes";
import { emit, listen } from "@tauri-apps/api/event";
import {
  MINI_READY_EVENT,
  MINI_RETURN_EVENT,
  MINI_TIMER_COMMAND_EVENT,
  MINI_TIMER_SNAPSHOT_EVENT,
} from "../app/constants";

type Deps = Record<string, any>;

export function useMiniWindowSync(deps: Deps) {
  const {
    activeTimer,
    config,
    finishActiveTimerRef,
    hideMiniWindow,
    miniSnapshot,
    miniSnapshotRef,
    returnToMain,
    togglePause,
  } = deps;

  useEffect(() => {
    let disposed = false;
    let cleanup: Array<() => void> = [];

    const setup = async () => {
      const unlistenReady = await listen(MINI_READY_EVENT, () => {
        void emit(MINI_TIMER_SNAPSHOT_EVENT, miniSnapshotRef.current);
      });
      const unlistenCommand = await listen<MiniTimerCommand>(MINI_TIMER_COMMAND_EVENT, (event) => {
        if (event.payload.action === "pause") {
          togglePause();
          return;
        }
        if (event.payload.action === "finish" && activeTimer) {
          finishActiveTimerRef.current(activeTimer);
        }
      });
      const unlistenReturn = await listen(MINI_RETURN_EVENT, () => {
        void returnToMain().catch((error: any) =>
          console.error("[mini-mode] メイン復帰に失敗しました", error),
        );
      });

      if (disposed) {
        unlistenReady();
        unlistenCommand();
        unlistenReturn();
      } else {
        cleanup = [unlistenReady, unlistenCommand, unlistenReturn];
      }
    };

    void setup();

    return () => {
      disposed = true;
      cleanup.forEach((dispose) => dispose());
    };
  }, [activeTimer, finishActiveTimerRef, miniSnapshotRef, returnToMain, togglePause]);

  useEffect(() => {
    void emit(MINI_TIMER_SNAPSHOT_EVENT, miniSnapshot);
  }, [miniSnapshot]);

  useEffect(() => {
    if (config?.settings.miniMode !== false) return;
    void hideMiniWindow().catch(() => undefined);
  }, [hideMiniWindow, config?.settings.miniMode]);

}
