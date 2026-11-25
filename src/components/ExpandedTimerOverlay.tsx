import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";
import { UiIcon } from "./UiIcon";
import type { ExitPresenceAttributes } from "./ExitPresence";

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
  /** P10-08: "実行中" / "一時停止中" / "計測中". */
  status: string;
  /** P10-08: "N分のうち … ・ HH:MM に終わります" (paused keeps the pause note). */
  planLabel: string;
  /** P10-08: the mini window entry in the header. */
  onMini?: () => void;
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
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
  status,
  planLabel,
  onMini,
  exitProps,
}: ExpandedTimerOverlayProps) {
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeRef.current?.focus({ preventScroll: true });
  }, []);

  // V164: while the close motion plays, the overlay no longer takes Escape.
  const exiting = exitProps?.["data-exiting"] === "true";
  useEffect(() => {
    if (exiting) return;
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (
        event.key !== "Escape" ||
        complete ||
        document.querySelector('.modalBackdrop:not([data-exiting="true"])')
      ) {
        return;
      }
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };
    window.addEventListener("keydown", closeOnEscape, true);
    return () => window.removeEventListener("keydown", closeOnEscape, true);
  }, [complete, exiting, onClose]);

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
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
    <div className="expandedTimerBackdrop" {...exitProps}>
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label="拡大タイマー"
        aria-modal="true"
        className={complete ? "expandedTimer expandedTimer--complete" : "expandedTimer"}
        onKeyDown={handleKeyDown}
        ref={dialogRef}
        role="dialog"
      >
        {/* P10-14d (R1): the app mark, the app name and the state badge on the left,
            戻る and ミニ as text-only buttons on the right. The DOM keeps ミニ before
            戻る so the existing Tab / Shift+Tab path stays exactly the same; the
            header container reverses the row so 戻る sits left of ミニ on screen. */}
        <header className="expandedTimerHeader">
          <div className="expandedTimerBrand">
            <span className="topBrandIcon" aria-hidden="true">
              <img alt="" draggable={false} src="/life-launcher-icon.svg" />
            </span>
            <span className="expandedTimerBrandName">Life Launcher</span>
            <span
              className={
                complete
                  ? "timerStateBadge timerStateBadge--complete"
                  : paused
                    ? "timerStateBadge timerStateBadge--paused"
                    : "timerStateBadge timerStateBadge--running"
              }
            >
              {complete ? "時間になりました" : status}
            </span>
          </div>
          <div className="expandedTimerHeaderActions">
            {onMini && !complete && (
              <button
                aria-label="ミニタイマーにする"
                className="expandedTimerMiniButton"
                onClick={onMini}
                title="ミニタイマーにする"
                type="button"
              >
                <UiIcon name="miniMode" size={16} />
                <span>ミニ</span>
              </button>
            )}
            <button
              aria-label="メイン画面に戻る（タイマーは続きます）"
              className="expandedTimerClose"
              onClick={onClose}
              ref={closeRef}
              title="メイン画面に戻る（タイマーは続きます）"
              type="button"
            >
              <UiIcon name="collapse" size={16} />
              <span>戻る</span>
            </button>
          </div>
        </header>
        <div className="expandedTimerBody">
          <div className="expandedTimerIdentity">{identity}</div>
          <p className="expandedTimerTask" title={label}>{label}</p>

          <strong className={paused || complete ? "expandedTimerClock expandedTimerClock--paused" : "expandedTimerClock"}>
            {clock}
          </strong>
          {/* P10-08 (§7.2): plan line under the clock. */}
          {!complete && planLabel !== "" && (
            <p className="expandedTimerPlan">{planLabel}</p>
          )}
          {/* D12: there is no "あとで" column here. */}
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
