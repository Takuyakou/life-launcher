import type { PointerEventHandler, ReactNode, Ref } from "react";
import { UiIcon } from "./UiIcon";

export type TimerPanelVariant = "sidebar" | "mini";
export type TimerPanelState = "waiting" | "running" | "paused" | "complete";

type TimerPanelProps = {
  variant: TimerPanelVariant;
  label: string;
  status: string;
  state: TimerPanelState;
  clock: string;
  progressPercent: number | null;
  active: boolean;
  paused: boolean;
  onPause: () => void;
  onFinish: () => void;
  onExpand?: () => void;
  expandButtonRef?: Ref<HTMLButtonElement>;
  waitingContent?: ReactNode;
  identity?: ReactNode;
  clockAdjustable?: boolean;
  clockDragging?: boolean;
  onClockPointerCancel?: PointerEventHandler<HTMLDivElement>;
  onClockPointerDown?: PointerEventHandler<HTMLDivElement>;
  onClockPointerMove?: PointerEventHandler<HTMLDivElement>;
  onClockPointerUp?: PointerEventHandler<HTMLDivElement>;
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
  onExpand,
  expandButtonRef,
  waitingContent,
  identity,
  clockAdjustable = false,
  clockDragging = false,
  onClockPointerCancel,
  onClockPointerDown,
  onClockPointerMove,
  onClockPointerUp,
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
      className={variant === "sidebar" ? "timerDock timerPanel" : "timerPanel timerPanel--mini"}
      onContextMenu={
        variant === "sidebar"
          ? (event) => {
              event.preventDefault();
              event.stopPropagation();
            }
          : undefined
      }
      onPointerDownCapture={() => window.getSelection()?.removeAllRanges()}
    >
      <div className="timerMeta">
        {variant === "sidebar" ? (
          <div className="timerMetaTop">
            <span>Timer</span>
            {active && onExpand && (
              <button
                aria-label="タイマーを大きく表示"
                className="timerExpandButton"
                onClick={onExpand}
                ref={expandButtonRef}
                title="タイマーを大きく表示"
                type="button"
              >
                <UiIcon name="maximize" size={16} />
              </button>
            )}
          </div>
        ) : (
          <span>タイマー</span>
        )}
        {identity ?? <strong>{label}</strong>}
      </div>
      <div className="timerStateRow">
        <span className={stateClass}>{status}</span>
      </div>
      <div
        className={[
          "timerClock",
          paused ? "timerClock--paused" : "",
          clockAdjustable ? "timerClock--adjustable" : "",
          clockDragging ? "timerClock--dragging" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerCancel={onClockPointerCancel}
        onPointerDown={onClockPointerDown}
        onPointerMove={onClockPointerMove}
        onPointerUp={onClockPointerUp}
        title={clockAdjustable ? "上下にドラッグして分数を変更" : undefined}
      >
        {clock}
      </div>
      {progressPercent !== null && (
        <div className="timerProgress" aria-hidden="true">
          <span style={{ width: `${progressPercent}%` }} />
        </div>
      )}
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
            <UiIcon name="stop" size={16} /> 終了
          </button>
        </div>
      ) : (
        (waitingContent ?? <span className="miniQuietText">開始ボタンから計測できます</span>)
      )}
    </section>
  );
}
