import type { PointerEvent } from "react";
import type { TimerCompletionPrompt } from "../app/dashboardTypes";
import { timerActionText } from "../app/miniWindow";
import type { LauncherProject } from "../types";
import { ProjectIdentity } from "./ProjectIdentity";
import { TimerMinutesStepper } from "./TimerMinutesStepper";
import { UiIcon } from "./UiIcon";

type TimerCompletionDialogProps = {
  prompt: TimerCompletionPrompt;
  project: LauncherProject | undefined;
  canEditResume: boolean;
  resumeDraft: string;
  saving: boolean;
  onResumeDraftChange: (value: string) => void;
  /** V163-B4: the minutes 「続ける」 adds, editable here (−/＋ by 5, typing and dragging by 1). */
  extendDraft: string;
  extendMinutes: number;
  extendFallback: number;
  extendDragging: boolean;
  onExtendChange: (value: string) => void;
  onExtendBlur: () => void;
  onExtendDragStart: (event: PointerEvent<HTMLElement>, value: number) => void;
  onExtendDragMove: (event: PointerEvent<HTMLElement>) => void;
  onExtendDragEnd: (event: PointerEvent<HTMLElement>) => void;
  onExtendDragCancel: (event: PointerEvent<HTMLElement>) => void;
  onContinue: () => void;
  onFinish: () => void;
};

/** Prompt shown when a countdown timer reaches its planned duration. */
export function TimerCompletionDialog({
  prompt,
  project,
  canEditResume,
  resumeDraft,
  saving,
  onResumeDraftChange,
  extendDraft,
  extendMinutes,
  extendFallback,
  extendDragging,
  onExtendChange,
  onExtendBlur,
  onExtendDragStart,
  onExtendDragMove,
  onExtendDragEnd,
  onExtendDragCancel,
  onContinue,
  onFinish,
}: TimerCompletionDialogProps) {
  return (
    <div className="modalBackdrop" role="presentation">
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label="タイマー満了"
        aria-modal="true"
        className="dropDialog timerCompleteDialog"
        role="dialog"
        tabIndex={-1}
      >
        <div className="timerCompleteHeader">
          <span aria-hidden="true" className="timerCompleteMark">
            <UiIcon name="clock" size={20} />
          </span>
          <div>
            <p className="eyebrow">Timer</p>
            <h2 className="timerCompleteText">予定時間になりました</h2>
          </div>
        </div>

        <div className="timerCompleteSubject">
          {project && (
            <ProjectIdentity
              colorId={project.colorId}
              compact
              name={project.name}
              projectId={project.id}
            />
          )}
          <span className="timerCompleteMinutes">予定 {prompt.targetMinutes}分</span>
          <strong className="timerCompleteHeading">{timerActionText(prompt)}</strong>
        </div>

        {canEditResume && (
          <>
            <label className="fieldStack timerResumeField">
              <span>次はここから(任意)</span>
              <input
                aria-label="次はここから(任意)"
                className="textInput"
                disabled={saving}
                maxLength={80}
                onChange={(event) => onResumeDraftChange(event.target.value)}
                onKeyDown={(event) => {
                  if (
                    event.key === "Enter" &&
                    !event.nativeEvent.isComposing &&
                    event.keyCode !== 229
                  ) {
                    event.preventDefault();
                    onFinish();
                  }
                }}
                placeholder="例: 3章の途中から"
                value={resumeDraft}
              />
            </label>
            <p className="timerResumeHint">
              書くと、次に「今やる一手」に出たときに、行動の下に出ます。
            </p>
          </>
        )}

        <div className="timerCompleteExtendRow">
          <span className="timerCompleteExtendLabel">延長分数</span>
          <TimerMinutesStepper
            disabled={saving}
            dragging={extendDragging}
            fallback={extendFallback}
            label="延長"
            onBlur={onExtendBlur}
            onDragCancel={onExtendDragCancel}
            onDragEnd={onExtendDragEnd}
            onDragMove={onExtendDragMove}
            onDragStart={onExtendDragStart}
            onValueChange={onExtendChange}
            step={5}
            value={extendDraft}
          />
        </div>

        <div className="dialogActions">
          <button
            className="secondaryButton"
            data-initial-focus=""
            disabled={saving}
            onClick={onContinue}
            type="button"
          >
            続ける(+{extendMinutes}分)
          </button>
          <button
            className="secondaryButton secondaryButton--finish"
            disabled={saving}
            onClick={onFinish}
            type="button"
          >
            終わる
          </button>
        </div>
      </section>
    </div>
  );
}
