import type { ReactNode } from "react";
import { UiIcon } from "./UiIcon";

export type TimerPanelVariant = "sidebar" | "mini";
export type TimerPanelState = "waiting" | "running" | "paused" | "complete";

type TimerPanelProps = {
  variant: TimerPanelVariant;
  label: string;
  status: string;
  state: TimerPanelState;
  clock: string;
  progressPercent: number;
  active: boolean;
  paused: boolean;
  onPause: () => void;
  onFinish: () => void;
  waitingContent?: ReactNode;
  identity?: ReactNode;
};

export function TimerPanel({
  variant,
  label,
  status,
  state,
  clock,
  progressPercent,
  active,
  paused,
  onPause,
  onFinish,
  waitingContent,
  identity,
}: TimerPanelProps) {
  const stateClass =
    state === "complete"
      ? "timerStateBadge timerStateBadge--complete"
      : state === "paused"
        ? "timerStateBadge timerStateBadge--paused"
        : state === "running"
          ? "timerStateBadge timerStateBadge--running"
          : "timerStateBadge";

  return (
    <section
      className={
        variant === "sidebar" ? "timerDock timerPanel" : "timerPanel timerPanel--mini"
      }
    >
      <div className="timerMeta">
        <span>{variant === "sidebar" ? "Timer" : "タイマー"}</span>
        {identity ?? <strong>{label}</strong>}
      </div>
      <div className="timerStateRow">
        <span className={stateClass}>{status}</span>
      </div>
      <div className={paused ? "timerClock timerClock--paused" : "timerClock"}>{clock}</div>
      <div className="timerProgress" aria-hidden="true">
        <span style={{ width: `${progressPercent}%` }} />
      </div>
      {active ? (
        <div className="timerControls">
          <button className="secondaryButton" onClick={onPause} type="button">
            <UiIcon name={paused ? "play" : "pause"} size={16} /> {paused ? "再開" : "一時停止"}
          </button>
          <button
            className="secondaryButton secondaryButton--finish"
            onClick={onFinish}
            type="button"
          >
            終了
          </button>
        </div>
      ) : (
        waitingContent ?? <span className="miniQuietText">開始ボタンから計測できます</span>
      )}
    </section>
  );
}
