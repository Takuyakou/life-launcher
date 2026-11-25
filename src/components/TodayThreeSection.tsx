import type { Dispatch, KeyboardEvent, PointerEvent, SetStateAction } from "react";
import { EXECUTION_TRIGGER_MAX_CHARS, TODAY_ITEM_LIMIT } from "../constants";
import type {
  ActiveTimer,
  CompletionFeedback,
  ContextMenuTarget,
  InboxDragPreview,
  ProjectDragPreview,
  ToastTone,
  TodayDragPreview,
} from "../app/dashboardTypes";
import { todaySourceKey, todayTimerSourceId, toggleDisclosureFromBar } from "../app/helpers";
import type { InstructionWindowOpenOptions } from "../instructionWindow";
import { resolveProjectColorId } from "../projectIdentity";
import { wishlistSourceKey } from "../todayCandidates";
import type { TimerMode } from "../timerRuntime";
import type {
  AppConfig,
  DoNowCandidate,
  LauncherAction,
  LauncherButton,
  LauncherProject,
  TodayItem,
} from "../types";
import { ProjectIdentity } from "./ProjectIdentity";
import { SectionCollapse } from "./SectionCollapse";
import { UiIcon } from "./UiIcon";

// V164-A3: the 「今日の3件」 band, moved out of App.tsx (same DOM, text and handlers).

export type TodayThreeSectionProps = {
  actions: {
    beginTodayTriggerEdit: (index: number) => void;
    cancelTodayPointerDrag: () => void;
    cancelTodayTriggerEdit: () => void;
    editTodayRowItem: (index: number) => void;
    finishActiveTimer: (timer: ActiveTimer) => void;
    finishTodayPointerDrag: (event: PointerEvent<HTMLElement>) => void;
    handleRowShortcutKey: (
      event: KeyboardEvent<HTMLElement>,
      handlers: { activate?: () => void; edit?: () => void; remove?: () => void },
    ) => boolean;
    handleTodayTriggerKeyDown: (event: KeyboardEvent<HTMLInputElement>, index: number) => void;
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
    openTodayPicker: (opener: HTMLElement) => void;
    removeTodayItem: (sourceKey: string) => Promise<void>;
    setTodayOpen: Dispatch<SetStateAction<boolean>>;
    setTodayTriggerDraft: Dispatch<SetStateAction<string>>;
    showToast: (tone: ToastTone, message: string) => void;
    startNextTodayBatch: () => Promise<void>;
    startTimer: (
      sourceId: string,
      label: string,
      projectId: string | null,
      actions?: LauncherAction[],
      targetMinutes?: number,
      noteOverride?: string,
      instructionPathOverride?: string,
      instructionOpenOnStartOverride?: boolean,
      mode?: TimerMode,
      doNowProject?: LauncherProject,
      expandOnStart?: boolean,
    ) => Promise<void>;
    startTodayItemShort: (
      item: TodayItem,
      index: number,
      timerSourceId: string,
      minutes: number,
    ) => void;
    startTodayPointerDrag: (event: PointerEvent<HTMLElement>, index: number) => void;
    togglePause: () => void;
    updateTodayPointerDrag: (event: PointerEvent<HTMLElement>) => void;
  };
  data: {
    activeTimer: ActiveTimer | null;
    allTodayItemsCompleted: boolean;
    buttonsById: Map<string, LauncherButton>;
    completionFeedback: CompletionFeedback | null;
    config: AppConfig;
    doNowSelection: { candidate: DoNowCandidate; project: LauncherProject };
    isTimerOnTodayItem: (item: TodayItem, index: number) => boolean;
    projectsById: Map<string, LauncherProject>;
    timerClock: string;
    todayAllCompleted: boolean;
    todayCompletedCount: number;
    todayOpen: boolean;
    todayTriggerDraft: string;
    todayTriggerEditingIndex: number | null;
  };
  drag: {
    inboxPointerDrag: InboxDragPreview | null;
    projectPointerDrag: ProjectDragPreview | null;
    todayPointerDrag: TodayDragPreview | null;
  };
  dragActive: boolean;
};

export function TodayThreeSection({ actions, data, drag, dragActive }: TodayThreeSectionProps) {
  const {
    beginTodayTriggerEdit,
    cancelTodayPointerDrag,
    cancelTodayTriggerEdit,
    editTodayRowItem,
    finishActiveTimer,
    finishTodayPointerDrag,
    handleRowShortcutKey,
    handleTodayTriggerKeyDown,
    openContextMenu,
    openContextMenuFromKeyboard,
    openInstructionWindow,
    openTodayPicker,
    removeTodayItem,
    setTodayOpen,
    setTodayTriggerDraft,
    showToast,
    startNextTodayBatch,
    startTimer,
    startTodayItemShort,
    startTodayPointerDrag,
    togglePause,
    updateTodayPointerDrag,
  } = actions;
  const {
    activeTimer,
    allTodayItemsCompleted,
    buttonsById,
    completionFeedback,
    config,
    doNowSelection,
    isTimerOnTodayItem,
    projectsById,
    timerClock,
    todayAllCompleted,
    todayCompletedCount,
    todayOpen,
    todayTriggerDraft,
    todayTriggerEditingIndex,
  } = data;
  const { inboxPointerDrag, projectPointerDrag, todayPointerDrag } = drag;
  return (
<section className="focusBand">
  <div
    className="todaySectionBar"
    onClick={(event) =>
      toggleDisclosureFromBar(event, () => setTodayOpen((open) => !open))
    }
  >
    <button
      aria-expanded={todayOpen}
      className="todaySectionDisclosure"
      onClick={() => setTodayOpen((open) => !open)}
      type="button"
    >
      <UiIcon name={todayOpen ? "chevronDown" : "chevronRight"} size={16} />
      <h2>今日の3件</h2>
    </button>
    {config.today.items.length === 0 ? (
      <span className="todaySectionCount">0件</span>
    ) : (
      <span
        className={
          todayAllCompleted
            ? "todayCompletionSummary todayCompletionSummary--complete"
            : "todayCompletionSummary"
        }
      >
        {todayCompletedCount} / {config.today.items.length} 完了
      </span>
    )}
    <span className="todaySectionDescription">
      今日やると決めたもの。タイマーから開始します。
    </span>
  </div>
  <SectionCollapse open={todayOpen} dragActive={dragActive}>
    <>
      <div className="todayGridRegion">
        <div
          className={[
            "todayGrid",
            config.today.items.length === 0 ? "todayGrid--empty" : "",
            completionFeedback?.kind === "todayAll"
              ? "todayGrid--allCompleteReward"
              : "",
            projectPointerDrag?.todayGuidanceActive ||
            inboxPointerDrag?.todayGuidanceActive
              ? "todayGrid--dropGuidance"
              : "",
            projectPointerDrag?.todayTargetIndicator ||
            inboxPointerDrag?.todayTargetIndicator
              ? "todayGrid--dropTarget"
              : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {(projectPointerDrag?.todayGuidanceActive ||
            inboxPointerDrag?.todayGuidanceActive) && (
            <div aria-hidden="true" className="todayDropGuidanceOverlay">
              <span className="dropHintLabel">↓ ここにドロップして「今日の3件」に追加</span>
            </div>
          )}
          {config.today.items.length === 0 && (
            <div className="todayEmptyState">
              <div className="todayEmptyStateContent">
                <strong>今日やるものを選びましょう</strong>
                <span>次の一手・やりたいことから選べます</span>
                <button
                  className="mainActionButton mainActionButton--gold"
                  onClick={(event) => openTodayPicker(event.currentTarget)}
                  type="button"
                >
                  <UiIcon name="add" size={16} />
                  今日やるものを選ぶ
                </button>
              </div>
            </div>
          )}
          {config.today.items.map((item, index) => {
            const timerSourceId = todayTimerSourceId(item, index);
            const isRunningTodayItem = activeTimer !== null && isTimerOnTodayItem(item, index);
            const project = item.projectId
              ? projectsById.get(item.projectId)
              : undefined;
            const todayInstructionPath =
              item.instructionPath?.trim() ||
              project?.nextStep?.instructionPath?.trim();
            const hasLinkedSource =
              (item.sourceKey?.startsWith("project:") &&
                Boolean(project?.nextStep)) ||
              (item.sourceKey?.startsWith("wishlist:") &&
                config.inbox.some(
                  (source, sourceIndex) =>
                    wishlistSourceKey(source, sourceIndex) === item.sourceKey,
                ));
            const shortMinutes =
              hasLinkedSource && project?.nextStep?.shortTimerMinutes == null
                ? config.settings.shortTimerMinutes
                : (item.shortTimerMinutes ??
                  project?.nextStep?.shortTimerMinutes ??
                  config.settings.shortTimerMinutes);
            const defaultMinutes =
              hasLinkedSource && project?.nextStep?.defaultTimerMinutes == null
                ? config.settings.defaultTimerMinutes
                : (item.defaultTimerMinutes ??
                  project?.nextStep?.defaultTimerMinutes ??
                  config.settings.defaultTimerMinutes);
            // P10-04's rule, used again here: the unfinished card adopted from
            // the current Next Step of the Project shown in "Do Now".
            const hereNowProject = doNowSelection?.project;
            const isHereNowTodayItem =
              !item.done &&
              Boolean(hereNowProject) &&
              item.sourceKey?.trim() === `project:${hereNowProject.id}` &&
              item.sourceGenerationId === hereNowProject.nextStep?.generationId;
            return (
              <article
                className={[
                  "todayRow",
                  todayPointerDrag?.index === index ? "todayRow--dragging" : "",
                  isRunningTodayItem ? "todayRow--running" : "",
                  item.done ? "todayRow--complete" : "",
                  completionFeedback?.kind === "today" &&
                  completionFeedback.sourceKey === todaySourceKey(item, index)
                    ? "todayRow--justCompleted"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                data-today-index={index}
                data-project-color={
                  project
                    ? resolveProjectColorId(project.id, project.colorId)
                    : undefined
                }
                key={todaySourceKey(item, index)}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openContextMenu(
                    { kind: "today", index, itemText: item.text },
                    event.clientX,
                    event.clientY,
                    event.currentTarget,
                  );
                }}
                onKeyDown={(event) => {
                  if (
                    handleRowShortcutKey(event, {
                      activate: () =>
                        startTodayItemShort(
                          item,
                          index,
                          timerSourceId,
                          shortMinutes,
                        ),
                      edit: () => editTodayRowItem(index),
                      remove: () =>
                        void removeTodayItem(todaySourceKey(item, index)),
                    })
                  )
                    return;
                  openContextMenuFromKeyboard(event, {
                    kind: "today",
                    index,
                    itemText: item.text,
                  });
                }}
                onPointerCancel={cancelTodayPointerDrag}
                onPointerDown={(event) => startTodayPointerDrag(event, index)}
                onPointerMove={updateTodayPointerDrag}
                onPointerUp={finishTodayPointerDrag}
                tabIndex={0}
              >
                <div className="todayRowTopActions">
                  {isHereNowTodayItem && (
                    <span
                      aria-label="今やる一手"
                      className="uiPill uiPill--project todayHereBadge"
                      data-project-color={
                        project
                          ? resolveProjectColorId(project.id, project.colorId)
                          : undefined
                      }
                      role="status"
                    >
                      今やる一手
                    </span>
                  )}
                  <span aria-hidden="true" className="uiKey rowKeyHint">
                    Enter
                  </span>
                  <button
                    aria-label={`${item.text || "未入力"}の操作`}
                    aria-haspopup="menu"
                    className="sourceRowMenu todayRowMenu"
                    onClick={(event) => {
                      const rect = event.currentTarget.getBoundingClientRect();
                      openContextMenu(
                        { kind: "today", index, itemText: item.text },
                        rect.left,
                        rect.bottom,
                        event.currentTarget,
                      );
                    }}
                    onPointerDown={(event) => event.stopPropagation()}
                    title="操作メニュー"
                    type="button"
                  >
                    <span aria-hidden="true">…</span>
                  </button>
                </div>
                <span
                  aria-label={item.done ? "今日の分は完了" : "未完了"}
                  className={
                    item.done
                      ? "todayCompletionStatus todayCompletionStatus--complete"
                      : "todayCompletionStatus"
                  }
                  role="status"
                >
                  {item.done ? "✓" : "○"}
                </span>
                <div
                  className={
                    project
                      ? "todayItemCopy"
                      : "todayItemCopy todayItemCopy--withoutIdentity"
                  }
                >
                  <div className="todayItemMeta">
                    {item.projectId && projectsById.has(item.projectId) && (
                      <span className="todayProjectIdentity">
                        <ProjectIdentity
                          colorId={projectsById.get(item.projectId)?.colorId}
                          compact
                          name={projectsById.get(item.projectId)?.name ?? ""}
                          projectId={item.projectId}
                        />
                      </span>
                    )}
                    {/* P10-05 (§4.3): the card linked to this moment's step. */}
                    {isRunningTodayItem && (
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
                  </div>
                  <span
                    className={
                      item.done
                        ? "todayTextButton todayTextButton--done"
                        : "todayTextButton"
                    }
                    title={item.text || "未入力"}
                  >
                    {item.text || "未入力"}
                  </span>
                </div>
                <div className="todayCardFooter">
                  <div className="todayCardSecondaryActions">
                    {todayInstructionPath && (
                      <button
                        aria-label={`${item.text || "未入力"}の手順書を開く`}
                        className="doNowInstructionButton todayInstructionButton mainActionButton mainActionButton--neutral"
                        onClick={() => {
                          void openInstructionWindow({
                            path: todayInstructionPath,
                            focus: true,
                          }).catch((error) => {
                            showToast(
                              "error",
                              `手順書を開けません: ${error instanceof Error ? error.message : String(error)}`,
                            );
                          });
                        }}
                        onPointerDown={(event) => event.stopPropagation()}
                        title="手順書を開く"
                        type="button"
                      >
                        <UiIcon name="book" size={16} /> 手順書
                      </button>
                    )}
                    <button
                      aria-label="今日の3件から外す"
                      className="todayRemoveButton mainActionButton mainActionButton--neutral"
                      disabled={isRunningTodayItem}
                      onClick={() =>
                        void removeTodayItem(todaySourceKey(item, index))
                      }
                      onPointerDown={(event) => event.stopPropagation()}
                      title={
                        isRunningTodayItem
                          ? "タイマーを停止してから外してください"
                          : "今日の3件から外す"
                      }
                      type="button"
                    >
                      <UiIcon name="back" size={16} />
                      <span className="todayRemoveLabel">外す</span>
                    </button>
                  </div>
                  <div className="todayTimerCluster">
                    <div className="todayTriggerZone">
                      {todayTriggerEditingIndex === index ? (
                        <input autoComplete="off"
                          aria-label="いつ・何の後にやる？"
                          autoFocus
                          className="todayTriggerInput"
                          maxLength={EXECUTION_TRIGGER_MAX_CHARS}
                          onBlur={cancelTodayTriggerEdit}
                          onChange={(event) =>
                            setTodayTriggerDraft(event.target.value)
                          }
                          onKeyDown={(event) =>
                            handleTodayTriggerKeyDown(event, index)
                          }
                          onPointerDown={(event) => event.stopPropagation()}
                          placeholder="例: 21時 / 夕食後"
                          value={todayTriggerDraft}
                        />
                      ) : (
                        <button
                          className={
                            item.trigger
                              ? "todayTriggerButton"
                              : "todayTriggerButton todayTriggerButton--empty"
                          }
                          onClick={() => beginTodayTriggerEdit(index)}
                          onPointerDown={(event) => event.stopPropagation()}
                          type="button"
                        >
                          {item.trigger ? `${item.trigger} ▸` : "+ きっかけ"}
                        </button>
                      )}
                    </div>
                    {item.done ? (
                      <span className="todayCompletedLabel">今日の分は完了</span>
                    ) : isRunningTodayItem ? (
                      <div
                        className={
                          activeTimer.mode === "measure"
                            ? "todayTimerActions todayTimerActions--running todayTimerActions--measure"
                            : "todayTimerActions todayTimerActions--running"
                        }
                      >
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
                          title={
                            activeTimer.paused
                              ? "このセッションを再開"
                              : "このセッションを一時停止"
                          }
                          type="button"
                        >
                          <UiIcon
                            name={activeTimer.paused ? "play" : "pause"}
                            size={16}
                          />
                          {activeTimer.paused
                            ? "再開"
                            : activeTimer.mode === "measure"
                              ? "停止"
                              : "一時停止"}
                        </button>
                        <button
                          className="runningStopButton"
                          onClick={() => finishActiveTimer(activeTimer)}
                          title="このセッションを終了"
                          type="button"
                        >
                          <UiIcon name="stop" size={16} /> 終了
                        </button>
                      </div>
                    ) : (
                      <div className="todayTimerActions">
                        <button
                          aria-label={`短時間タイマー${shortMinutes}分で開始`}
                          className="todayStartButton todayStartButton--short"
                          disabled={!item.text.trim()}
                          onClick={() => void startTodayItemShort(item, index, timerSourceId, shortMinutes)}
                          title={`短時間タイマー: ${shortMinutes}分`}
                          type="button"
                        >
                          <span aria-hidden="true" className="nextStepStartGlyph">
                            <UiIcon name="play" size={16} />
                          </span>
                          <span
                            aria-hidden="true"
                            className="nextStepStartDuration"
                          >
                            {shortMinutes}分
                          </span>
                        </button>
                        <button
                          aria-label={`通常タイマー${defaultMinutes}分で開始`}
                          className="todayStartButton todayStartButton--normal"
                          disabled={!item.text.trim()}
                          onClick={() =>
                            void startTimer(
                              timerSourceId,
                              item.projectId && projectsById.has(item.projectId)
                                ? (projectsById.get(item.projectId)?.name ??
                                    item.text)
                                : item.text,
                              item.projectId && projectsById.has(item.projectId)
                                ? item.projectId
                                : null,
                              (item.buttonIds ?? []).flatMap(
                                (buttonId) =>
                                  buttonsById.get(buttonId)?.actions ?? [],
                              ),
                              defaultMinutes,
                              item.text,
                              item.instructionPath,
                              item.instructionOpenOnStart,
                              "countdown",
                              undefined,
                              item.sourceKey?.startsWith("project:") &&
                                item.expandTimerOnStart === true,
                            )
                          }
                          title={`通常タイマー: ${defaultMinutes}分`}
                          type="button"
                        >
                          <span aria-hidden="true" className="nextStepStartGlyph">
                            <UiIcon name="play" size={16} />
                          </span>
                          <span
                            aria-hidden="true"
                            className="nextStepStartDuration"
                          >
                            {defaultMinutes}分
                          </span>
                        </button>
                        <button
                          aria-label="時間を決めずに計測"
                          className="todayMeasureButton"
                          disabled={!item.text.trim()}
                          onClick={() =>
                            void startTimer(
                              timerSourceId,
                              item.projectId && projectsById.has(item.projectId)
                                ? (projectsById.get(item.projectId)?.name ??
                                    item.text)
                                : item.text,
                              item.projectId && projectsById.has(item.projectId)
                                ? item.projectId
                                : null,
                              (item.buttonIds ?? []).flatMap(
                                (buttonId) =>
                                  buttonsById.get(buttonId)?.actions ?? [],
                              ),
                              undefined,
                              item.text,
                              item.instructionPath,
                              item.instructionOpenOnStart,
                              "measure",
                              undefined,
                              item.sourceKey?.startsWith("project:") &&
                                item.expandTimerOnStart === true,
                            )
                          }
                          title="時間を決めずに計測"
                          type="button"
                        >
                          <UiIcon name="clock" size={16} />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
          {config.today.items.length > 0 &&
            config.today.items.length < TODAY_ITEM_LIMIT &&
            !todayPointerDrag && (
              <button
                className="todayPickerEntry"
                onClick={(event) => openTodayPicker(event.currentTarget)}
                type="button"
              >
                <span className="todayPickerEntryVisual">
                  <UiIcon name="add" size={16} />
                  今日やるものを選ぶ
                </span>
              </button>
            )}
          {todayPointerDrag?.targetIndicator && (
            <div
              aria-hidden="true"
              className="todayDropIndicator"
              style={todayPointerDrag.targetIndicator}
            />
          )}
          {todayPointerDrag &&
            (() => {
              const draggedItem = config.today.items[todayPointerDrag.index];
              if (!draggedItem) return null;
              const draggedProject = draggedItem.projectId
                ? projectsById.get(draggedItem.projectId)
                : undefined;
              return (
                <div
                  aria-hidden="true"
                  className="todayDragGhost"
                  data-project-color={
                    draggedProject
                      ? resolveProjectColorId(
                          draggedProject.id,
                          draggedProject.colorId,
                        )
                      : undefined
                  }
                  style={{
                    height: todayPointerDrag.height,
                    left: todayPointerDrag.pointerX - todayPointerDrag.offsetX,
                    top: todayPointerDrag.pointerY - todayPointerDrag.offsetY,
                    width: todayPointerDrag.width,
                  }}
                >
                  {draggedProject && (
                    <span className="todayProjectIdentity">
                      <ProjectIdentity
                        colorId={draggedProject.colorId}
                        compact
                        name={draggedProject.name}
                        projectId={draggedProject.id}
                      />
                    </span>
                  )}
                  <strong>{draggedItem.text || "未入力"}</strong>
                </div>
              );
            })()}
        </div>

        {todayPointerDrag && (
          <div
            aria-disabled={!todayPointerDrag.removeEligible}
            className={[
              "todayRemoveDropZone",
              todayPointerDrag.removeTargetActive
                ? "todayRemoveDropZone--active"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
          >
            <span className="dropHintLabel">↓ ここにドロップして今日の3件から外す</span>
          </div>
        )}
      </div>

      {completionFeedback?.kind === "todayAll" && (
        <div className="todayAllCompletionReward" role="status">
          <span aria-hidden="true">✓</span>
          今日の3件、完了！
        </div>
      )}

      {allTodayItemsCompleted && (
        <div className="todayNextBatch">
          <button
            className="secondaryButton mainActionButton mainActionButton--neutral"
            onClick={() => void startNextTodayBatch()}
            type="button"
          >
            <UiIcon name="add" size={16} />
            次の3件を選ぶ
          </button>
          <span>まだやりたいときだけ、次の枠を作れます。</span>
        </div>
      )}
    </>
  </SectionCollapse>
</section>
  );
}
