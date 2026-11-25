import type { Dispatch, KeyboardEvent, SetStateAction } from "react";
import { motion } from "motion/react";
import type {
  ActiveTimer,
  ContextMenuTarget,
  DoNowCompletionHold,
  ToastTone,
} from "../app/dashboardTypes";
import type { InstructionWindowOpenOptions } from "../instructionWindow";
import { springSnappy } from "../motion";
import { resolveProjectColorId } from "../projectIdentity";
import type { DoNowCandidate, LauncherButton, LauncherProject } from "../types";
import type { NextStepEditorOptions } from "./CompletionNextStepDialog";
import { ProjectIdentity } from "./ProjectIdentity";
import { UiIcon } from "./UiIcon";

// V164-A2: the 「今やる一手」 band, moved out of App.tsx (same DOM, text and handlers).

export type DoNowBandProps = {
  actions: {
    acknowledgeDoNowCompletion: () => Promise<void>;
    finishActiveTimer: (timer: ActiveTimer) => void;
    openContextMenu: (
      target: ContextMenuTarget,
      x: number,
      y: number,
      opener?: HTMLElement | null,
    ) => void;
    openContextMenuFromKeyboard: (
      event: KeyboardEvent<HTMLElement>,
      target: ContextMenuTarget,
    ) => void;
    openInstructionWindow: (options: InstructionWindowOpenOptions) => Promise<unknown>;
    openNextStepEditor: (project: LauncherProject, options?: NextStepEditorOptions) => void;
    openProjectAddDialog: () => void;
    setDoNowExcludedProjectId: Dispatch<SetStateAction<string | null>>;
    setDoNowPickedProjectId: Dispatch<SetStateAction<string | null>>;
    showNextDoNowCandidate: () => void;
    showToast: (tone: ToastTone, message: string) => void;
    startDoNowProject: (
      project: LauncherProject,
      timerKind: "short" | "normal" | "measure",
    ) => void;
    togglePause: () => void;
  };
  data: {
    activeTimer: ActiveTimer | null;
    buttonsById: Map<string, LauncherButton>;
    doNowBookPage: number | null;
    doNowCandidates: Array<{ candidate: DoNowCandidate; project: LauncherProject }>;
    doNowCompletionHold: DoNowCompletionHold | null;
    doNowCompletionSaving: boolean;
    doNowCopyKey: string | null;
    doNowCopyShouldAnimate: boolean;
    doNowDefaultTimerMinutes: number;
    doNowInstructionPath: string;
    doNowOnlyExcluded: boolean;
    doNowReason: string;
    doNowSelection: { candidate: DoNowCandidate; project: LauncherProject } | undefined;
    doNowShortTimerMinutes: number;
    isDoNowRunning: boolean;
    missingButtonIds: Set<string>;
    missingInstructionProjectIds: Set<string>;
    nextStepSetupProject: LauncherProject | undefined;
    timerClock: string;
  };
};

export function DoNowBand({ actions, data }: DoNowBandProps) {
  const {
    acknowledgeDoNowCompletion,
    finishActiveTimer,
    openContextMenu,
    openContextMenuFromKeyboard,
    openInstructionWindow,
    openNextStepEditor,
    openProjectAddDialog,
    setDoNowExcludedProjectId,
    setDoNowPickedProjectId,
    showNextDoNowCandidate,
    showToast,
    startDoNowProject,
    togglePause,
  } = actions;
  const {
    activeTimer,
    buttonsById,
    doNowBookPage,
    doNowCandidates,
    doNowCompletionHold,
    doNowCompletionSaving,
    doNowCopyKey,
    doNowCopyShouldAnimate,
    doNowDefaultTimerMinutes,
    doNowInstructionPath,
    doNowOnlyExcluded,
    doNowReason,
    doNowSelection,
    doNowShortTimerMinutes,
    isDoNowRunning,
    missingButtonIds,
    missingInstructionProjectIds,
    nextStepSetupProject,
    timerClock,
  } = data;
  return (
<section
  className="doNowBand"
  aria-labelledby="do-now-title"
  data-skip-target="main"
  tabIndex={-1}
>
  {doNowCompletionHold ? (
    <div
      className="doNowContent doNowContent--hold"
      data-project-color={resolveProjectColorId(
        doNowCompletionHold.projectId,
        doNowCompletionHold.colorId,
      )}
    >
      <div className="doNowCopy">
        <div className="doNowKicker">
          <h2 id="do-now-title">今やる一手</h2>
          <span className="uiPill doNowProjectChip">
            <ProjectIdentity
              colorId={doNowCompletionHold.colorId}
              compact
              name={doNowCompletionHold.projectName}
              projectId={doNowCompletionHold.projectId}
            />
          </span>
        </div>
        <strong className="doNowHoldTitle" role="status">✓ 一手進みました</strong>
        <span className="doNowHoldTask">{doNowCompletionHold.taskText}</span>
        {doNowCompletionHold.minutes > 0 && (
          <span className="doNowHoldMinutes">実行 {doNowCompletionHold.minutes}分</span>
        )}
      </div>
                            <div className="doNowFooter">
        <button
          className="mainActionButton mainActionButton--neutral doNowHoldButton"
          disabled={doNowCompletionSaving}
          onClick={() => void acknowledgeDoNowCompletion()}
          type="button"
        >
          次の一手を見る
          <UiIcon name="chevronRight" size={16} aria-hidden="true" />
        </button>
      </div>
    </div>
  ) : doNowSelection ? (
    <div
      className="doNowContent doNowContent--active"
      data-project-color={resolveProjectColorId(
        doNowSelection.project.id,
        doNowSelection.project.colorId,
      )}
      onContextMenu={(event) => {
        if (doNowCandidates.length <= 1) return;
        event.preventDefault();
        event.stopPropagation();
        openContextMenu(
          { kind: "doNow" },
          event.clientX,
          event.clientY,
          event.currentTarget,
        );
      }}
      onKeyDown={(event) => {
        if (doNowCandidates.length > 1) {
          openContextMenuFromKeyboard(event, { kind: "doNow" });
        }
      }}
      tabIndex={doNowCandidates.length > 1 ? 0 : undefined}
    >
      <motion.div
        animate={{ opacity: 1, x: 0 }}
        className="doNowCopy"
        initial={doNowCopyShouldAnimate ? { opacity: 0, x: 12 } : false}
        key={doNowCopyKey ?? undefined}
        transition={springSnappy}
      >
        <div className="doNowKicker">
          <span aria-hidden="true" className="doNowStatusDot" />
          <h2 id="do-now-title">今やる一手</h2>
          <span className="uiPill doNowProjectChip">
            <ProjectIdentity
              colorId={doNowSelection.project.colorId}
              compact
              name={doNowSelection.project.name}
              projectId={doNowSelection.project.id}
            />
          </span>
          {isDoNowRunning && activeTimer && (
            <span
              className={
                activeTimer.paused
                  ? "uiPill uiPill--paused runningBadge runningBadge--paused"
                  : "uiPill uiPill--running runningBadge runningBadge--running"
              }
            >
              {activeTimer.paused
                ? "一時停止"
                : activeTimer.mode === "measure"
                  ? "計測中"
                  : "実行中"}
            </span>
          )}
          <span className="doNowReason">{doNowReason}</span>
        </div>
        <strong title={doNowSelection.project.nextStep?.text}>
          {doNowSelection.project.nextStep?.text}
        </strong>
        {(() => {
          const resumeNote = doNowSelection.project.nextStep?.resumeNote?.trim();
          return resumeNote ? (
            <p className="doNowResume" title={resumeNote}>
              <span className="doNowResumeLabel">次はここから</span>
              <span className="doNowResumeText">{resumeNote}</span>
            </p>
          ) : null;
        })()}
        {(() => {
          const openButtons = (doNowSelection.project.nextStep?.buttonIds ?? [])
            .map((id) => buttonsById.get(id))
            .filter((button): button is LauncherButton => Boolean(button));
          const trigger = doNowSelection.project.nextStep?.trigger?.trim();
          const instructionName = doNowInstructionPath
            ?.split(/[\\/]/)
            .filter(Boolean)
            .pop();
          const instructionMissing = missingInstructionProjectIds.has(
            doNowSelection.project.id,
          );
          if (!openButtons.length && !doNowInstructionPath && !trigger) return null;
          return (
            <div className="doNowMeta">
              {trigger ? (
                <span className="doNowMetaItem doNowTrigger" title={trigger}>
                  <UiIcon name="clock" size={16} />
                  {trigger}
                </span>
              ) : null}
              {trigger && (openButtons.length || doNowInstructionPath) ? (
                <span aria-hidden="true" className="doNowDivider" />
              ) : null}
              {openButtons.length || doNowInstructionPath ? (
                <span className="doNowMetaLabel">始めると一緒に開く</span>
              ) : null}
              {openButtons.map((button) => {
                const missing = missingButtonIds.has(button.id);
                return (
                  <span
                    className={
                      missing
                        ? "doNowOpenChip doNowOpenChip--missing"
                        : "doNowOpenChip"
                    }
                    key={button.id}
                    title={
                      missing
                        ? "見つかりません。次の一手の編集で選び直してください"
                        : undefined
                    }
                  >
                    <UiIcon name={missing ? "alert" : "external"} size={12} />
                    {button.label}
                    {missing && (
                      <span className="doNowMissingText">見つかりません</span>
                    )}
                  </span>
                );
              })}
              {doNowInstructionPath ? (
                <button
                  className={
                    instructionMissing
                      ? "doNowOpenChip doNowOpenChip--button doNowOpenChip--missing"
                      : "doNowOpenChip doNowOpenChip--button"
                  }
                  onClick={() => {
                    void openInstructionWindow({
                      path: doNowInstructionPath,
                      focus: true,
                    }).catch((error) => {
                      showToast(
                        "error",
                        `手順書を開けません: ${error instanceof Error ? error.message : String(error)}`,
                      );
                    });
                  }}
                  aria-label={
                    doNowBookPage !== null && !instructionMissing
                      ? `${instructionName || "手順書"}、${doNowBookPage}ページから`
                      : undefined
                  }
                  title={
                    instructionMissing
                      ? "見つかりません。次の一手の編集で選び直してください"
                      : undefined
                  }
                  type="button"
                >
                  <UiIcon name={instructionMissing ? "alert" : "book"} size={12} />
                  {instructionName || "手順書"}
                  {doNowBookPage !== null && !instructionMissing ? (
                    <span className="doNowOpenChipPage">p.{doNowBookPage}</span>
                  ) : null}
                  {instructionMissing && (
                    <span className="doNowMissingText">見つかりません</span>
                  )}
                </button>
              ) : null}
            </div>
          );
        })()}
      </motion.div>
      <div className="doNowFooter">
        <div className="doNowActions">
          {isDoNowRunning && activeTimer ? (
            <>
              {activeTimer.mode === "measure" && (
                <span className="measureElapsedClock">{timerClock}</span>
              )}
              <button
                aria-label={
                  activeTimer.paused
                    ? "このセッションを再開"
                    : "このセッションを一時停止"
                }
                className="runningPauseButton"
                onClick={togglePause}
                type="button"
              >
                <UiIcon name={activeTimer.paused ? "play" : "pause"} size={16} />
                {activeTimer.paused ? "再開" : "一時停止"}
              </button>
              <button
                className="runningStopButton"
                onClick={() => finishActiveTimer(activeTimer)}
                type="button"
              >
                <UiIcon name="stop" size={16} /> 終了
              </button>
            </>
          ) : (
            <>
              <button
                aria-label={`短時間タイマー${doNowShortTimerMinutes}分で始める`}
                className="doNowStartPrimary"
                onClick={() => startDoNowProject(doNowSelection.project, "short")}
                type="button"
              >
                <span className="timerStartDuration">
                  {doNowShortTimerMinutes}分で始める
                </span>
                <span aria-hidden="true" className="timerStartHoverGlyph">
                  <UiIcon name="play" size={16} />
                </span>
              </button>
              <button
                aria-label={`通常タイマー${doNowDefaultTimerMinutes}分で開始`}
                className="doNowStartSecondary"
                onClick={() => startDoNowProject(doNowSelection.project, "normal")}
                type="button"
              >
                <span className="timerStartDuration">
                  通常 {doNowDefaultTimerMinutes}分
                </span>
                <span aria-hidden="true" className="timerStartHoverGlyph">
                  <UiIcon name="play" size={16} />
                </span>
              </button>
              <button
                aria-label="時間を決めずに計測"
                className="doNowMeasureButton"
                onClick={() => startDoNowProject(doNowSelection.project, "measure")}
                title="時間を決めずに計測"
                type="button"
              >
                <UiIcon name="clock" size={16} />
                <span>計測</span>
              </button>
            </>
          )}
        </div>
        <div className="doNowSecondaryActions">
          {doNowCandidates.length > 1 && (
            <button
              className="uiSmallButton doNowAlternateButton"
              onClick={showNextDoNowCandidate}
              type="button"
            >
              <UiIcon name="refresh" size={16} />
              他の一手
            </button>
          )}
        </div>
      </div>
    </div>
  ) : (
    <>
      <div className="doNowHeading">
        <h2 id="do-now-title">今やる一手</h2>
      </div>
      <div className="doNowEmpty">
        <div className="doNowEmptyContent">
          <strong>
            {doNowOnlyExcluded
              ? "今は他に提案できる一手がありません。"
              : nextStepSetupProject
              ? "次の一手を設定すると、ここに提案されます。"
              : "プロジェクトを作り、次の一手を設定すると提案されます。"}
          </strong>
          <span>
            {doNowOnlyExcluded
              ? "取り組んだ一手は、もう一度候補を見ると表示できます。"
              : "迷ったときに、今の状況から始めやすい「次にやること」を1つだけ提示します。"}
          </span>
          <button
            className={doNowOnlyExcluded
              ? "mainActionButton mainActionButton--neutral"
              : "mainActionButton mainActionButton--gold"}
            onClick={() => {
              if (doNowOnlyExcluded) {
                setDoNowExcludedProjectId(null);
                setDoNowPickedProjectId(null);
              } else if (nextStepSetupProject) {
                openNextStepEditor(nextStepSetupProject);
              } else {
                openProjectAddDialog();
              }
            }}
            type="button"
          >
            <UiIcon name={doNowOnlyExcluded ? "refresh" : "add"} size={16} />
            {doNowOnlyExcluded
              ? "候補をもう一度見る"
              : nextStepSetupProject ? "次の一手を設定" : "プロジェクトを追加"}
          </button>
        </div>
      </div>
    </>
  )}
</section>
  );
}
