import type { PointerEventHandler, ReactNode, Ref } from "react";
import { AnimatePresence, motion } from "motion/react";
import { springSnappy } from "../motion";
import { UiIcon } from "./UiIcon";

export type TimerPanelVariant = "sidebar" | "mini";
export type TimerPanelState = "waiting" | "running" | "paused" | "complete";

type TimerPanelProps = {
  variant: TimerPanelVariant;
  label: string;
  actionText?: string;
  status: string;
  state: TimerPanelState;
  clock: string;
  progressPercent: number | null;
  active: boolean;
  paused: boolean;
  onPause: () => void;
  onFinish: () => void;
  onExpand?: () => void;
  /** P10-07: the idle row above the action text ("今日 N分・N回"). */
  todaySummary?: string;
  /** P10-07: idle only — the mini-window button in the expand slot. */
  onMini?: () => void;
  miniDisabled?: boolean;
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

/**
 * P10-07 (D37): the idle minutes roll digit by digit when the value changes.
 * Only the idle, adjustable clock uses this; running clocks (mm:ss) stay plain text.
 */
function RollingClock({ clock }: { clock: string }) {
  const match = clock.match(/^(\d+)(.*)$/);
  if (!match) return <>{clock}</>;
  const [, digits, suffix] = match;
  return (
    <span className="timerClockRolling">
      {Array.from(digits).map((digit, index) => (
        <span className="timerClockDigit" key={`${index}-${digits.length}`}>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.span
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "-100%", opacity: 0 }}
              initial={{ y: "100%", opacity: 0 }}
              key={digit + "-" + index}
              transition={springSnappy}
            >
              {digit}
            </motion.span>
          </AnimatePresence>
        </span>
      ))}
      <span className="timerClockUnit">{suffix}</span>
    </span>
  );
}

export function TimerPanel({
  variant,
  label,
  actionText,
  status,
  state,
  clock,
  progressPercent,
  active,
  paused,
  onPause,
  onFinish,
  onExpand,
  todaySummary,
  onMini,
  miniDisabled = false,
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
  // The idle mini is only a heading, a badge and a hint: no second "waiting" word, no clock.
  const idleMini = variant === "mini" && !active;
  const stateClass =
    state === "complete"
      ? "timerStateBadge timerStateBadge--complete"
      : state === "paused"
        ? "timerStateBadge timerStateBadge--paused"
        : state === "running"
          ? "timerStateBadge timerStateBadge--running"
          : "timerStateBadge";

  /**
   * P10-14d N1: the mini window is one horizontal line. The project/action stay on the left,
   * the remaining clock and the icon buttons on the right. Every label and action of the old
   * mini header is kept (the header itself is replaced by this line).
   */
  if (variant === "mini") {
    const displayClock = state === "complete" ? "00:00" : clock;

    return (
      <section
        className={[
          "timerPanel timerPanel--mini",
          active ? "timerPanel--active" : "",
          idleMini ? "timerPanel--idle" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        onPointerDownCapture={() => window.getSelection()?.removeAllRanges()}
      >
        {!idleMini && progressPercent !== null && (
          <div className="timerProgress timerProgress--mini" aria-hidden="true">
            <span style={{ width: `${progressPercent ?? 0}%` }} />
          </div>
        )}
        <div className="miniTopline">
          {idleMini ? (
            <>
              <span className="miniTimerText miniTimerText--idle">
                <span className="miniIdleHead">
                  <span className="timerMeta">
                    <span>タイマー</span>
                  </span>
                  <span className={stateClass}>{status}</span>
                </span>
                <span className="miniQuietText">開始ボタンから計測できます</span>
              </span>
              {onExpand && (
                <button
                  aria-label="タイマーを大きく表示"
                  className="miniIconButton miniIconButton--expand"
                  onClick={onExpand}
                  title="タイマーを大きく表示"
                  type="button"
                >
                  <UiIcon name="maximize" size={16} />
                </button>
              )}
            </>
          ) : (
            <>
              <span className="miniTimerText">
                {identity}
                {(actionText ?? label) !== undefined && (
                  <strong className="timerActionText" title={actionText ?? label}>
                    {actionText ?? label}
                  </strong>
                )}
                <span className={`${stateClass} visuallyHidden`}>{status}</span>
              </span>
              <div
                aria-label={clockAdjustable ? clock : undefined}
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
                {clockAdjustable ? (
                  <span aria-hidden="true">
                    <RollingClock clock={displayClock} />
                  </span>
                ) : (
                  displayClock
                )}
              </div>
              <div className="timerControls">
                <button
                  aria-label={paused ? "再開" : "一時停止"}
                  className="miniIconButton"
                  onClick={onPause}
                  title={paused ? "再開" : "一時停止"}
                  type="button"
                >
                  <UiIcon name={paused ? "play" : "pause"} size={16} />
                </button>
                <button
                  aria-label="終了"
                  className="miniIconButton miniIconButton--finish"
                  onClick={onFinish}
                  title="終了"
                  type="button"
                >
                  <UiIcon name="stop" size={16} />
                </button>
                {onExpand && (
                  <button
                    aria-label="タイマーを大きく表示"
                    className="miniIconButton"
                    onClick={onExpand}
                    ref={expandButtonRef}
                    title="タイマーを大きく表示"
                    type="button"
                  >
                    <UiIcon name="maximize" size={16} />
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      className={[
        variant === "sidebar" ? "timerDock timerPanel" : "timerPanel timerPanel--mini",
        active ? "timerPanel--active" : "",
        idleMini ? "timerPanel--idle" : "",
      ]
        .filter(Boolean)
        .join(" ")}
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
            {active && onExpand ? (
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
            ) : !active && onMini ? (
              <button
                aria-label="ミニタイマーにする"
                className="timerExpandButton"
                disabled={miniDisabled}
                onClick={onMini}
                title="ミニタイマーにする"
                type="button"
              >
                <UiIcon name="miniMode" size={16} />
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <span>タイマー</span>
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
          </>
        )}
        {todaySummary ? (
          <span aria-label={todaySummary.replace("・", "、")} className="timerTodaySummary">
            {todaySummary}
          </span>
        ) : (
          identity
        )}
        {!idleMini && (actionText ?? (identity ? undefined : label)) !== undefined && (
          <strong className="timerActionText" title={actionText ?? label}>
            {actionText ?? label}
          </strong>
        )}
      </div>
      <div className="timerStateRow">
        <span className={stateClass}>{status}</span>
      </div>
      {!idleMini && (
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
          aria-label={clockAdjustable ? clock : undefined}
        >
          {clockAdjustable ? (
            <span aria-hidden="true">
              <RollingClock clock={clock} />
            </span>
          ) : (
            clock
          )}
        </div>
      )}
      {!idleMini && variant === "sidebar" && (
        <div className="timerProgress" aria-hidden="true">
          <span style={{ width: `${progressPercent ?? 0}%` }} />
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
