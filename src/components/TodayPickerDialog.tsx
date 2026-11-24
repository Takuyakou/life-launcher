import type { Dispatch, SetStateAction } from "react";
import { motion } from "motion/react";
import type { ActiveTimer } from "../app/dashboardTypes";
import { todayEntries, todaySourceKey, todayTimerSourceId } from "../app/helpers";
import type { LauncherProject, TodayItem } from "../types";
import type { TodayCandidate } from "../todayCandidates";
import { TODAY_ITEM_LIMIT } from "../constants";
import { springSnappy } from "../motion";
import { resolveProjectColorId } from "../projectIdentity";
import { timerRunsTodayItem } from "../timerSource";
import { UiIcon } from "./UiIcon";
import type { ExitPresenceAttributes } from "./ExitPresence";

// V163-A2: the Today picker, moved out of App.tsx (same DOM, text and handlers).
// V164-A3: the two row renderers came in from App.tsx, so the markup is still unchanged.

export type TodayPickerDialogProps = {
  todayPickerDraftItems: TodayItem[];
  todayPickerDragIndex: number | null;
  todayPickerFilter: string;
  todayPickerPills: Array<{ key: string; label: string; color: string | null }>;
  todayPickerQuickProject: LauncherProject | undefined;
  todayPickerQuickText: string;
  todayPickerSaving: boolean;
  todayPickerVisibleNextSteps: TodayCandidate[];
  todayPickerVisibleWishlist: TodayCandidate[];
  setTodayPickerFilter: Dispatch<SetStateAction<string>>;
  setTodayPickerQuickText: Dispatch<SetStateAction<string>>;
  addTodayPickerQuickWish: () => void;
  moveTodayPickerItemToIndex: (index: number) => void;
  requestCloseTodayPicker: () => void;
  saveTodayPickerDraft: () => void;
  /** V164-A3: what the two row renderers need from the screen. */
  rows: {
    activeTimer: ActiveTimer | null;
    chooseTodayCandidate: (candidate: TodayCandidate) => void;
    moveTodayPickerItem: (fromIndex: number, toIndex: number) => void;
    projectsById: Map<string, LauncherProject>;
    removeTodayPickerDraftItem: (index: number) => void;
    setTodayPickerDragIndex: Dispatch<SetStateAction<number | null>>;
    todayPickerCandidateSelected: (candidate: TodayCandidate) => boolean;
  };
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
};

export function TodayPickerDialog(props: TodayPickerDialogProps) {
  const {
    addTodayPickerQuickWish,
    moveTodayPickerItemToIndex,
    requestCloseTodayPicker,
    rows,
    saveTodayPickerDraft,
    setTodayPickerFilter,
    setTodayPickerQuickText,
    todayPickerDraftItems,
    todayPickerDragIndex,
    todayPickerFilter,
    todayPickerPills,
    todayPickerQuickProject,
    todayPickerQuickText,
    todayPickerSaving,
    todayPickerVisibleNextSteps,
    todayPickerVisibleWishlist,
    exitProps,
  } = props;

  const renderTodayPickerSelectedItem = (item: TodayItem, index: number) => {
    const project = item.projectId ? rows.projectsById.get(item.projectId) : undefined;
    const pickerItemRunning = timerRunsTodayItem(
      todayEntries(todayPickerDraftItems),
      rows.activeTimer,
      todayTimerSourceId(item, index),
      todaySourceKey(item, index),
    );
    return (
      <div
        className={[
          "todayPickerSlot todayPickerSlot--selected todayPickerRow todayPickerRow--selected",
          todayPickerDragIndex === index ? "todayPickerSlot--dragging" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-project-color={
          project ? resolveProjectColorId(project.id, project.colorId) : undefined
        }
        data-today-picker-slot-index={index}
        draggable={!todayPickerSaving}
        key={`today-selected:${todaySourceKey(item, index)}`}
        onDragEnd={() => rows.setTodayPickerDragIndex(null)}
        onDragOver={(event) => {
          if (todayPickerDragIndex === null) return;
          event.preventDefault();
        }}
        onDragStart={(event) => {
          event.dataTransfer.effectAllowed = "move";
          event.dataTransfer.setData("text/plain", String(index));
          rows.setTodayPickerDragIndex(index);
        }}
        onDrop={(event) => {
          event.preventDefault();
          moveTodayPickerItemToIndex(index);
        }}
        onKeyDown={(event) => {
          if (!event.altKey || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
          event.preventDefault();
          rows.moveTodayPickerItem(index, event.key === "ArrowUp" ? index - 1 : index + 1);
        }}
        tabIndex={0}
      >
        <span aria-hidden="true" className="todayPickerSlotIndex">
          {index + 1}
        </span>
        <div className="todayPickerSlotCopy">
          {project && (
            <span className="todayPickerSlotProject">
              <span aria-hidden="true" className="todayPickerDot" />
              {project.name}
            </span>
          )}
          <strong className="todayPickerSlotTask" title={item.text}>
            {item.text}
          </strong>
        </div>
        <button
          aria-label="今日から外す"
          className="todayPickerRemoveButton"
          disabled={todayPickerSaving || pickerItemRunning}
          onClick={() => rows.removeTodayPickerDraftItem(index)}
          onPointerDown={(event) => event.stopPropagation()}
          title={pickerItemRunning ? "タイマーを停止してから外してください" : undefined}
          type="button"
        >
          <UiIcon name="close" size={16} />
        </button>
      </div>
    );
  };

  const renderTodayPickerCandidate = (candidate: TodayCandidate) => {
    const project = candidate.projectId ? rows.projectsById.get(candidate.projectId) : undefined;
    const selected = rows.todayPickerCandidateSelected(candidate);
    return (
      <div
        className="todayPickerRow"
        data-project-color={
          project ? resolveProjectColorId(project.id, project.colorId) : "uncategorized"
        }
        key={candidate.key}
      >
        <div className="todayPickerCopy">
          <span className="todayPickerProject">
            <span aria-hidden="true" className="todayPickerDot" />
            {project?.name ?? "未分類"}
          </span>
          <strong className="todayPickerTask" title={candidate.text}>
            {candidate.text}
          </strong>
        </div>
        {selected ? (
          <span className="uiPill uiPill--good todayPickerSelectedStatus">✓ 選択済み</span>
        ) : (
          <button
            className="todayPickerAddButton"
            disabled={todayPickerSaving || todayPickerDraftItems.length >= TODAY_ITEM_LIMIT}
            onClick={() => void rows.chooseTodayCandidate(candidate)}
            title={
              todayPickerDraftItems.length >= TODAY_ITEM_LIMIT
                ? "今日の3件は3件埋まっています"
                : undefined
            }
            type="button"
          >
            ＋ 今日へ
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="modalBackdrop" role="presentation" {...exitProps}>
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label="今日やるものを選ぶ"
        aria-modal="true"
        className="dropDialog todayPickerDialog"
        role="dialog"
        tabIndex={-1}
      >
        <div className="todayPickerHead">
          <div className="todayPickerHeadCopy">
            <p className="eyebrow">Today</p>
            <h2>今日やるものを選ぶ</h2>
          </div>
          <p className="todayPickerIntro">3件まで。決めたら、あとは始めるだけです</p>
          <button
            aria-label="今日やるものを選ぶを閉じる"
            autoFocus
            className="iconButton"
            disabled={todayPickerSaving}
            onClick={requestCloseTodayPicker}
            title="閉じる"
            type="button"
          >
            <UiIcon name="close" size={16} />
          </button>
        </div>

        {/* V163-B7: the filter pills sit between the heading and the two columns. */}
        <div
          aria-label="プロジェクトで絞り込む"
          className="todayPickerFilterBar"
          role="group"
        >
          {todayPickerPills.map((pill) => (
            <button
              aria-pressed={todayPickerFilter === pill.key}
              className={
                todayPickerFilter === pill.key
                  ? "todayPickerFilterPill todayPickerFilterPill--active"
                  : "todayPickerFilterPill"
              }
              key={pill.key}
              onClick={() => setTodayPickerFilter(pill.key)}
              type="button"
            >
              {pill.color !== null && (
                <span
                  aria-hidden="true"
                  className="todayPickerFilterDot"
                  data-project-color={pill.color}
                />
              )}
              {pill.label}
            </button>
          ))}
        </div>

        <div className="todayPickerBody">
          <section className="todayPickerSource">
            <div
              className="todayPickerSourceGroup"
              data-today-picker-section="next-step"
            >
              <h3 className="todayPickerGroupTitle">次の一手</h3>
              <div className="todayPickerList">
                {todayPickerVisibleNextSteps.length === 0 ? (
                  <p className="todayPickerEmpty">追加できる次の一手はありません</p>
                ) : (
                  todayPickerVisibleNextSteps.map((candidate) =>
                    renderTodayPickerCandidate(candidate),
                  )
                )}
              </div>
            </div>
            <div
              className="todayPickerSourceGroup"
              data-today-picker-section="wishlist"
            >
              <h3 className="todayPickerGroupTitle">やりたいこと</h3>
              <div className="todayPickerList">
                {todayPickerVisibleWishlist.length === 0 ? (
                  <p className="todayPickerEmpty">追加できるやりたいことはありません</p>
                ) : (
                  todayPickerVisibleWishlist.map((candidate) =>
                    renderTodayPickerCandidate(candidate),
                  )
                )}
              </div>
              {/* V163-B7: one compact line of quick add, under the wishlist list. */}
              <form
                className="todayPickerQuickAdd"
                onSubmit={(event) => {
                  event.preventDefault();
                  addTodayPickerQuickWish();
                }}
              >
                <input autoComplete="off"
                  aria-label={
                    todayPickerQuickProject
                      ? `「${todayPickerQuickProject.name}」のやりたいことを追加`
                      : "やりたいことを追加"
                  }
                  className="todayPickerQuickAddInput"
                  disabled={todayPickerSaving}
                  maxLength={120}
                  onChange={(event) => setTodayPickerQuickText(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    if (event.nativeEvent.isComposing || event.keyCode === 229) {
                      event.preventDefault();
                      return;
                    }
                    event.preventDefault();
                    addTodayPickerQuickWish();
                  }}
                  placeholder={
                    todayPickerQuickProject
                      ? `「${todayPickerQuickProject.name}」のやりたいことを足して今日へ`
                      : "やりたいことを足して今日へ"
                  }
                  type="text"
                  value={todayPickerQuickText}
                />
                <button
                  className="secondaryButton todayPickerQuickAddButton"
                  disabled={todayPickerSaving}
                  type="submit"
                >
                  ＋ 追加
                </button>
              </form>
            </div>
          </section>

          <section
            className="todayPickerDestination"
            data-today-picker-section="selected"
          >
            <div className="todayPickerDestinationHeader">
              <h3>今日の3件</h3>
              <div
                aria-label={`今日の3件 ${todayPickerDraftItems.length}件`}
                className="todayPickerCounter"
              >
                <strong>{todayPickerDraftItems.length} / 3</strong>
              </div>
              <span className="todayPickerDragHint">ドラッグで順番を変えられます</span>
            </div>
            <div
              aria-label={`今日の3件の選択状況 ${todayPickerDraftItems.length}/3`}
              aria-valuemax={TODAY_ITEM_LIMIT}
              aria-valuemin={0}
              aria-valuenow={todayPickerDraftItems.length}
              className="todayPickerProgress"
              role="progressbar"
            >
              {/* V163-M3: the fill springs to the new count (scaleX, as before, so it rests the same). */}
              <motion.span
                animate={{ scaleX: todayPickerDraftItems.length / TODAY_ITEM_LIMIT }}
                initial={false}
                transition={springSnappy}
              />
            </div>
            <div className="todayPickerSlots">
              {Array.from({ length: TODAY_ITEM_LIMIT }, (_, index) => {
                const item = todayPickerDraftItems[index];
                return item ? (
                  renderTodayPickerSelectedItem(item, index)
                ) : (
                  <div
                    className="todayPickerSlot todayPickerSlot--empty"
                    data-today-picker-slot-index={index}
                    key={`empty:${index}`}
                    onDragOver={(event) => {
                      if (todayPickerDragIndex === null) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      moveTodayPickerItemToIndex(index);
                    }}
                  >
                    <span className="todayPickerSlotIndex">{index + 1}</span>
                    <span className="todayPickerSlotEmptyLabel">
                      空けておいてもかまいません
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="dialogActions formDialogActions">
          <button
            className="primaryButton todayPickerConfirmButton"
            disabled={todayPickerSaving}
            onClick={() => void saveTodayPickerDraft()}
            type="button"
          >
            {todayPickerSaving ? "保存中…" : "決定"}
          </button>
          <button
            className="dangerButton todayPickerCancelButton"
            disabled={todayPickerSaving}
            onClick={requestCloseTodayPicker}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}
