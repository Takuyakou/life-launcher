import type { Dispatch, ReactNode, SetStateAction } from "react";
import { motion } from "motion/react";
import type { LauncherProject, TodayItem } from "../types";
import type { TodayCandidate } from "../todayCandidates";
import { TODAY_ITEM_LIMIT } from "../constants";
import { springSnappy } from "../motion";
import { UiIcon } from "./UiIcon";

// V163-A2: the Today picker, moved out of App.tsx (same DOM, text and handlers).
// The two render helpers stay in App.tsx and come in as props, so the markup is unchanged.

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
  renderTodayPickerCandidate: (candidate: TodayCandidate) => ReactNode;
  renderTodayPickerSelectedItem: (item: TodayItem, index: number) => ReactNode;
  requestCloseTodayPicker: () => void;
  saveTodayPickerDraft: () => void;
};

export function TodayPickerDialog(props: TodayPickerDialogProps) {
  const {
    addTodayPickerQuickWish,
    moveTodayPickerItemToIndex,
    renderTodayPickerCandidate,
    renderTodayPickerSelectedItem,
    requestCloseTodayPicker,
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
  } = props;

  return (
    <div className="modalBackdrop" role="presentation">
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
                <input
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
