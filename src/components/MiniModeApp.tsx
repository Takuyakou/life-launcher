import { MINI_READY_EVENT, MINI_RETURN_EVENT, MINI_TIMER_COMMAND_EVENT, MINI_TIMER_SNAPSHOT_EVENT } from "../app/constants";
import type { MiniTimerCommand, MiniTimerSnapshot } from "../app/dashboardTypes";
import { type PointerEvent, type MouseEvent as ReactMouseEvent, useEffect, useMemo, useState } from "react";
import { ProjectIdentity } from "./ProjectIdentity";
import { TimerPanel } from "./TimerPanel";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { emit, listen } from "@tauri-apps/api/event";
import { inactiveMiniSnapshot, writeMiniPosition } from "../app/miniWindow";

export function MiniModeApp() {
  const [snapshot, setSnapshot] = useState<MiniTimerSnapshot>(inactiveMiniSnapshot);
  const miniWindow = useMemo(() => WebviewWindow.getCurrent(), []);

  useEffect(() => {
    const unlisten = listen<MiniTimerSnapshot>(MINI_TIMER_SNAPSHOT_EVENT, (event) => {
      setSnapshot(event.payload);
    });
    void emit(MINI_READY_EVENT);

    return () => {
      unlisten.then((dispose) => dispose()).catch(() => undefined);
    };
  }, []);

  useEffect(() => {
    const unlisten = miniWindow.onMoved((event) => {
      writeMiniPosition(event.payload.x, event.payload.y);
    });

    return () => {
      unlisten.then((dispose) => dispose()).catch(() => undefined);
    };
  }, [miniWindow]);

  const sendCommand = (action: MiniTimerCommand["action"]) => {
    void emit(MINI_TIMER_COMMAND_EVENT, { action } satisfies MiniTimerCommand);
  };

  const startMiniDrag = (event: PointerEvent<HTMLElement>) => {
    if (event.target instanceof Element && event.target.closest("button")) return;
    void miniWindow.startDragging().catch(() => undefined);
  };

  const requestMainFromMini = () => {
    void emit(MINI_RETURN_EVENT).catch(() => undefined);
  };

  // P97-02 D: ボタンや入力欄の上のダブルクリックではメイン画面に戻らない
  // （一時停止・再開を素早く2回押すと戻ってしまっていた）。
  const requestMainFromMiniOnDoubleClick = (event: ReactMouseEvent<HTMLElement>) => {
    const target = event.target;
    if (target instanceof Element && target.closest("button, input, textarea, select, a, label, [role='button']")) {
      return;
    }
    requestMainFromMini();
  };

  return (
    <main
      className="miniShell"
      onDoubleClick={requestMainFromMiniOnDoubleClick}
      onPointerDown={startMiniDrag}
    >
      <TimerPanel
        active={snapshot.active}
        clock={snapshot.remainingClock}
        identity={
          snapshot.projectId ? (
            <ProjectIdentity
              colorId={snapshot.projectColorId}
              compact
              name={snapshot.projectName}
              projectId={snapshot.projectId}
            />
          ) : undefined
        }
        actionText={snapshot.active ? snapshot.actionText || snapshot.label : undefined}
        label={snapshot.active ? snapshot.label : "待機中"}
        onExpand={requestMainFromMini}
        onFinish={() => sendCommand("finish")}
        onPause={() => sendCommand("pause")}
        paused={snapshot.paused}
        progressPercent={snapshot.progressPercent}
        projectColorId={snapshot.projectColorId}
        state={snapshot.active ? (snapshot.paused ? "paused" : "running") : "waiting"}
        status={
          snapshot.active
            ? snapshot.paused
              ? "一時停止中"
              : snapshot.mode === "measure"
                ? "計測中"
                : "実行中"
            : "待機中"
        }
        variant="mini"
      />
    </main>
  );
}
