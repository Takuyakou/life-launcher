import type { Dispatch, SetStateAction } from "react";
import type { AppConfig, LauncherProject } from "../types";
import type { NumberInputDragField, TimerCompletionPrompt } from "../app/dashboardTypes";
import { DEFAULT_EXTEND_TIMER_MINUTES } from "../constants";
import { TimerCompletionDialog } from "./TimerCompletionDialog";
import type { ExitPresenceAttributes } from "./ExitPresence";

// V163-A4: the 「一手進みました」 dialog, moved out of App.tsx (same DOM, text and handlers).

export type CompletionFollowupDialogProps = {
  config: AppConfig;
  completionPrompt: TimerCompletionPrompt;
  completionProject: LauncherProject | undefined;
  completionCanEditResume: boolean;
  completionExtendDraft: string;
  completionExtendMinutes: number;
  completionResumeSaving: boolean;
  timerResumeDraft: string;
  numberInputDragging: NumberInputDragField | null;
  setCompletionExtendDraft: Dispatch<SetStateAction<string>>;
  setTimerResumeDraft: Dispatch<SetStateAction<string>>;
  cancelNumberInputDrag: (event: React.PointerEvent<HTMLElement>) => void;
  finishNumberInputDrag: (event: React.PointerEvent<HTMLElement>) => void;
  updateNumberInputDrag: (event: React.PointerEvent<HTMLElement>) => void;
  startNumberInputDrag: (
    event: React.PointerEvent<HTMLElement>,
    field: NumberInputDragField,
    value: number,
  ) => void;
  continueCompletedTimer: () => void;
  submitCompletedTimer: () => void;
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
};

export function CompletionFollowupDialog(props: CompletionFollowupDialogProps) {
  const {
    cancelNumberInputDrag,
    completionCanEditResume,
    completionExtendDraft,
    completionExtendMinutes,
    completionProject,
    completionPrompt,
    completionResumeSaving,
    config,
    continueCompletedTimer,
    finishNumberInputDrag,
    numberInputDragging,
    setCompletionExtendDraft,
    setTimerResumeDraft,
    startNumberInputDrag,
    submitCompletedTimer,
    timerResumeDraft,
    updateNumberInputDrag,
    exitProps,
  } = props;

  return (
    <TimerCompletionDialog
      exitProps={exitProps}
      canEditResume={completionCanEditResume}
      extendDraft={completionExtendDraft}
      extendDragging={numberInputDragging === "completionExtend"}
      extendFallback={config.settings.extendTimerMinutes ?? DEFAULT_EXTEND_TIMER_MINUTES}
      extendMinutes={completionExtendMinutes}
      onContinue={continueCompletedTimer}
      onExtendBlur={() => setCompletionExtendDraft(String(completionExtendMinutes))}
      onExtendChange={setCompletionExtendDraft}
      onExtendDragCancel={cancelNumberInputDrag}
      onExtendDragEnd={finishNumberInputDrag}
      onExtendDragMove={updateNumberInputDrag}
      onExtendDragStart={(event, value) =>
        startNumberInputDrag(event, "completionExtend", value)
      }
      onFinish={() => void submitCompletedTimer()}
      onResumeDraftChange={setTimerResumeDraft}
      project={completionProject}
      prompt={completionPrompt}
      resumeDraft={timerResumeDraft}
      saving={completionResumeSaving}
    />
  );
}
