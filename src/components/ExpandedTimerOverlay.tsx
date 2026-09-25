import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { UiIcon } from "./UiIcon";

type ExpandedTimerOverlayProps = {
  clock: string;
  identity?: ReactNode;
  label: string;
  complete: boolean;
  paused: boolean;
  progressPercent: number | null;
  onClose: () => void;
  onFinish: () => void;
  onPause: () => void;
};

export function ExpandedTimerOverlay({
  clock,
  identity,
  label,
  complete,
  paused,
  progressPercent,
  onClose,
  onFinish,
  onPause,
}: ExpandedTimerOverlayProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onClose();
      return;
    }
    if (event.key !== "Tab") return;
    const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
    if (!buttons.length) return;
    const first = buttons[0];
    const last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div className="expandedTimerBackdrop">
      <section
        aria-label="拡大タイマー"
        aria-modal="true"
        className={complete ? "expandedTimer expandedTimer--complete" : "expandedTimer"}
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        <header className="expandedTimerHeader">
          <span className="expandedTimerEyebrow">Timer</span>
          <button
            aria-label="拡大表示を閉じる"
            className="expandedTimerClose"
            onClick={onClose}
            ref={closeRef}
            title="拡大表示を閉じる"
            type="button"
          >
            <UiIcon name="close" size={24} />
          </button>
        </header>
        <div className="expandedTimerBody">
          <div className="expandedTimerIdentity">{identity}</div>
          <p className="expandedTimerTask" title={label}>{label}</p>
          <span className={complete ? "expandedTimerState expandedTimerState--complete" : "expandedTimerState"}>
            {complete ? "時間になりました" : paused ? "一時停止中" : "実行中"}
          </span>
          <strong className={paused || complete ? "expandedTimerClock expandedTimerClock--paused" : "expandedTimerClock"}>
            {clock}
          </strong>
          {progressPercent !== null && (
            <div aria-hidden="true" className="expandedTimerProgress">
              <span style={{ width: `${progressPercent}%` }} />
            </div>
          )}
          {!complete && <div className="expandedTimerActions">
            <button className="secondaryButton" onClick={onPause} type="button">
              <UiIcon name={paused ? "play" : "pause"} size={20} />
              {paused ? "再開" : "一時停止"}
            </button>
            <button className="secondaryButton secondaryButton--finish" onClick={onFinish} type="button">
              <UiIcon name="stop" size={20} /> 終了
            </button>
          </div>}
        </div>
        <p className="expandedTimerHint">Escで戻る（タイマーは継続します）</p>
      </section>
    </div>
  );
}
