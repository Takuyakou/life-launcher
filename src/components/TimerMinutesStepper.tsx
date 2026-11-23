import type { PointerEvent } from "react";

type TimerMinutesStepperProps = {
  /** Used in the accessible names: 「{label}タイマーを{step}分減らす」「{label}タイマー分数」. */
  label: string;
  value: string;
  fallback: number;
  /** How many minutes − and ＋ move (typing and dragging still move by 1). */
  step?: number;
  dragging: boolean;
  disabled?: boolean;
  onValueChange: (value: string) => void;
  onBlur?: () => void;
  onDragStart: (event: PointerEvent<HTMLElement>, value: number) => void;
  onDragMove: (event: PointerEvent<HTMLElement>) => void;
  onDragEnd: (event: PointerEvent<HTMLElement>) => void;
  onDragCancel: (event: PointerEvent<HTMLElement>) => void;
};

/** V163-B4: the minutes field with − / ＋ and up/down drag (Next step edit and the timer prompt). */
export function TimerMinutesStepper({
  label,
  value,
  fallback,
  step = 1,
  dragging,
  disabled = false,
  onValueChange,
  onBlur,
  onDragStart,
  onDragMove,
  onDragEnd,
  onDragCancel,
}: TimerMinutesStepperProps) {
  const current = () => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };
  // −/＋ move from the current value by `step` and stay in 1..240 (no rounding to the step).
  const stepBy = (delta: number) =>
    onValueChange(String(Math.min(240, Math.max(1, current() + delta * step))));

  return (
    <div className="nextStepTimerStepper">
      <button
        aria-label={`${label}タイマーを${step}分減らす`}
        className="nextStepTimerStepButton"
        disabled={disabled}
        onClick={() => stepBy(-1)}
        type="button"
      >
        −
      </button>
      <label
        className={
          dragging
            ? "nextStepTimerStepperValue fieldStack--numberDrag fieldStack--numberDragging"
            : "nextStepTimerStepperValue fieldStack--numberDrag"
        }
        onPointerCancel={onDragCancel}
        onPointerDown={(event) => onDragStart(event, Number.parseInt(value, 10) || fallback)}
        onPointerMove={onDragMove}
        onPointerUp={onDragEnd}
        title="上下にドラッグして分数を調整"
      >
        <input autoComplete="off"
          aria-label={`${label}タイマー分数`}
          className="nextStepTimerValueInput"
          disabled={disabled}
          inputMode="numeric"
          max="240"
          min="1"
          onBlur={onBlur}
          onChange={(event) => onValueChange(event.target.value)}
          placeholder={String(fallback)}
          type="number"
          value={value}
        />
        <span aria-hidden="true" className="nextStepTimerStepperUnit">
          分
        </span>
      </label>
      <button
        aria-label={`${label}タイマーを${step}分増やす`}
        className="nextStepTimerStepButton"
        disabled={disabled}
        onClick={() => stepBy(1)}
        type="button"
      >
        ＋
      </button>
    </div>
  );
}
