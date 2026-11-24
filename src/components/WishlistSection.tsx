import type {
  Dispatch,
  KeyboardEvent,
  MutableRefObject,
  PointerEvent,
  ReactNode,
  RefObject,
  SetStateAction,
} from "react";
import {
  SOURCE_LIST_COMPACT_LIMIT,
  SOURCE_LIST_PAGINATION_THRESHOLD,
} from "../app/constants";
import type {
  ContextMenuTarget,
  InboxDragPreview,
  ProjectDragPreview,
  WishlistGroupDragPreview,
  WishlistGroupView,
} from "../app/dashboardTypes";
import { sourceListRange, toggleDisclosureFromBar } from "../app/helpers";
import { groupWishlistForDisplay } from "../nextStepWishlist";
import { resolveProjectColorId } from "../projectIdentity";
import { canonicalSourceKey, SOURCE_LOCK_REASON, sourceLockedByUnfinishedToday } from "../sourceEdit";
import type { AppConfig, LauncherProject } from "../types";
import { ProjectIdentity } from "./ProjectIdentity";
import { SectionCollapse } from "./SectionCollapse";
import { UiIcon } from "./UiIcon";

// V164-A4: the 「やりたいこと」 band, moved out of App.tsx (same DOM, text and handlers).

export type WishlistSectionProps = {
  actions: {
    beginInboxEdit: (index: number, origin?: "source" | "today" | "builder") => void;
    cancelInboxPointerDrag: () => void;
    cancelWishlistGroupPointerDrag: () => void;
    deleteInboxItem: (index: number) => void;
    finishInboxPointerDrag: (event: PointerEvent<HTMLDivElement>) => void;
    finishWishlistGroupPointerDrag: (event: PointerEvent<HTMLElement>) => void;
    handleRowShortcutKey: (
      event: KeyboardEvent<HTMLElement>,
      handlers: { activate?: () => void; edit?: () => void; remove?: () => void },
    ) => boolean;
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
    openInboxAddDialog: (opener?: HTMLButtonElement, projectId?: string) => void;
    promoteInboxToNextStep: (index: number) => void;
    setInboxOpen: Dispatch<SetStateAction<boolean>>;
    setWishlistGroupViews: Dispatch<
      SetStateAction<Record<string, WishlistGroupView>>
    >;
    sourceEditBlockReason: (key: string, allowTodaySourceSync?: boolean) => string | null;
    sourceEditBlocked: (key: string, allowTodaySourceSync?: boolean) => boolean;
    startInboxPointerDrag: (event: PointerEvent<HTMLDivElement>, index: number) => void;
    startWishlistGroupPointerDrag: (
      event: PointerEvent<HTMLElement>,
      key: string,
      name: string,
    ) => void;
    toggleWishlistGroup: (key: string) => void;
    updateInboxPointerDrag: (event: PointerEvent<HTMLDivElement>) => void;
    updateWishlistGroupPointerDrag: (event: PointerEvent<HTMLElement>) => void;
  };
  config: AppConfig;
  drag: {
    inboxPointerDrag: InboxDragPreview | null;
    projectPointerDrag: ProjectDragPreview | null;
    wishlistGroupPointerDrag: WishlistGroupDragPreview | null;
  };
  dragActive: boolean;
  inboxAddOpen: boolean;
  inboxListAnchorRef: MutableRefObject<{ id: string; index: number } | null>;
  inboxOpen: boolean;
  inboxSummaryOverflow: boolean;
  inboxSummaryRef: RefObject<HTMLSpanElement>;
  inboxSummaryTitle: string;
  projectsById: Map<string, LauncherProject>;
  renderInboxGroupSummaryItems: (copy: boolean) => ReactNode;
  wishlistGroups: ReturnType<typeof groupWishlistForDisplay>;
  wishlistGroupViews: Record<string, WishlistGroupView>;
  wishlistItemIsCurrentNextStep: (item: AppConfig["inbox"][number]) => boolean;
};

export function WishlistSection({
  actions,
  config,
  drag,
  dragActive,
  inboxAddOpen,
  inboxListAnchorRef,
  inboxOpen,
  inboxSummaryOverflow,
  inboxSummaryRef,
  inboxSummaryTitle,
  projectsById,
  renderInboxGroupSummaryItems,
  wishlistGroups,
  wishlistGroupViews,
  wishlistItemIsCurrentNextStep,
}: WishlistSectionProps) {
  const {
    beginInboxEdit,
    cancelInboxPointerDrag,
    cancelWishlistGroupPointerDrag,
    deleteInboxItem,
    finishInboxPointerDrag,
    finishWishlistGroupPointerDrag,
    handleRowShortcutKey,
    openContextMenu,
    openContextMenuFromKeyboard,
    openInboxAddDialog,
    promoteInboxToNextStep,
    setInboxOpen,
    setWishlistGroupViews,
    sourceEditBlockReason,
    sourceEditBlocked,
    startInboxPointerDrag,
    startWishlistGroupPointerDrag,
    toggleWishlistGroup,
    updateInboxPointerDrag,
    updateWishlistGroupPointerDrag,
  } = actions;
  const { inboxPointerDrag, projectPointerDrag, wishlistGroupPointerDrag } = drag;
  void SOURCE_LOCK_REASON;
  void sourceLockedByUnfinishedToday;
  void canonicalSourceKey;
  void sourceListRange;
  void toggleDisclosureFromBar;
  void SOURCE_LIST_COMPACT_LIMIT;
  void SOURCE_LIST_PAGINATION_THRESHOLD;
  return (
<section
  className={[
    "inboxBand",
    projectPointerDrag?.wishlistEligible ? "sourceReturnBand--target" : "",
    projectPointerDrag?.wishlistTarget ? "sourceReturnBand--active" : "",
  ]
    .filter(Boolean)
    .join(" ")}
  onContextMenu={(event) => {
    event.preventDefault();
    openContextMenu(
      { kind: "inboxes" },
      event.clientX,
      event.clientY,
      event.currentTarget,
    );
  }}
>
  <div
    className="disclosureHeader"
    data-inbox-header
    onContextMenu={(event) => {
      event.preventDefault();
      event.stopPropagation();
      openContextMenu(
        { kind: "inboxes" },
        event.clientX,
        event.clientY,
        event.currentTarget,
      );
    }}
    onKeyDown={(event) => openContextMenuFromKeyboard(event, { kind: "inboxes" })}
    tabIndex={-1}
    onClick={(event) =>
      toggleDisclosureFromBar(event, () => setInboxOpen((open) => !open))
    }
  >
    <button
      aria-describedby="wishlist-group-summary"
      aria-expanded={inboxOpen}
      className="disclosure"
      onClick={() => setInboxOpen((open) => !open)}
      type="button"
    >
      <UiIcon name={inboxOpen ? "chevronDown" : "chevronRight"} size={16} />
      <span className="disclosureLabel">
        <strong>やりたいこと</strong>
      </span>
    </button>
    <span className="disclosureCount">{config.inbox.length}件</span>
    {inboxOpen ? (
      <span className="disclosureDescription">
        他にやりたいこと。今日やるものは「今日の3件」から選べます。
      </span>
    ) : (
      // P10-06 (D26): closed, the header shows the groups as dots and counts.
      <span
        aria-hidden="true"
        className="disclosureDescription inboxGroupSummary"
        data-overflow={inboxSummaryOverflow ? "true" : "false"}
        ref={inboxSummaryRef}
        title={inboxSummaryTitle}
      >
        <span className="inboxGroupSummaryTrack">
          {renderInboxGroupSummaryItems(false)}
          {inboxSummaryOverflow ? renderInboxGroupSummaryItems(true) : null}
        </span>
      </span>
    )}
    <span className="visuallyHidden" id="wishlist-group-summary">
      {`やりたいこと ${config.inbox.length}件。${wishlistGroups
        .map((group) => `${group.name} ${group.items.length}件`)
        .join("、")}`}
    </span>
    <div className="disclosureHeaderActions">
      <button
        aria-label="やりたいことを追加"
        className="uiSmallButton sectionAddButton sectionAddButton--barHitTarget nextStepHeaderAdd nextStepHeaderAdd--wishlist mainActionButton mainActionButton--neutral"
        disabled={inboxAddOpen}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openInboxAddDialog(event.currentTarget);
        }}
        title="やりたいことを追加"
        type="button"
      >
        ＋ やりたいこと
      </button>
      <button
        aria-label="やりたいことの操作"
        aria-haspopup="menu"
        className="sectionMenuButton"
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          openContextMenu(
            { kind: "inboxes" },
            rect.left,
            rect.bottom,
            event.currentTarget,
          );
        }}
        onPointerDown={(event) => event.stopPropagation()}
        title="やりたいことの操作"
        type="button"
      >
        <span aria-hidden="true">…</span>
      </button>
    </div>
  </div>

  {projectPointerDrag?.wishlistEligible && (
    <div
      className={
        projectPointerDrag?.wishlistTarget
          ? "sourceReturnDropZone sourceReturnDropZone--active"
          : "sourceReturnDropZone"
      }
    >
      <span className="dropHintLabel">
        <span aria-hidden="true">↓</span>
        <span>ここにドロップしてやりたいことへ戻す</span>
      </span>
    </div>
  )}

  <SectionCollapse open={inboxOpen} dragActive={dragActive}>
    <div className="inboxBody">
      {config.inbox.length === 0 && (
        <div className="sectionEmptyState">
          <div className="sectionEmptyStateContent">
            <strong>やりたいことを設定しましょう</strong>
            <span>あとでやりたいことを登録して、今日やる候補にできます</span>
            <button
              className="mainActionButton mainActionButton--gold"
              disabled={inboxAddOpen}
              onClick={(event) => openInboxAddDialog(event.currentTarget)}
              type="button"
            >
              <UiIcon name="add" size={16} />
              やりたいことを追加する
            </button>
          </div>
        </div>
      )}
      <div className="inboxGroups">
        {wishlistGroups.map((group) => {
          const view = wishlistGroupViews[group.key] ?? {};
          const range = sourceListRange(
            group.items.length,
            Boolean(view.expanded),
            view.page ?? 1,
          );
          const collapsed = Boolean(view.collapsed);
          const visibleItems = group.items.slice(range.start, range.end);
          const groupProject = group.projectId
            ? projectsById.get(group.projectId)
            : undefined;
          // P10-06 (D25): a Project group with no Next Step asks for one.
          const groupNeedsNextStep = Boolean(
            group.key !== "unassigned" && groupProject && !groupProject.nextStep?.text.trim(),
          );
          return (
            <section
              className={[
                "wishlistGroup",
                group.key === "unassigned" ? "wishlistGroup--unassigned" : "",
                wishlistGroupPointerDrag?.key === group.key
                  ? "wishlistGroup--dragging"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-project-color={
                groupProject
                  ? resolveProjectColorId(groupProject.id, groupProject.colorId)
                  : undefined
              }
              data-wishlist-group={group.key}
              key={group.key}
              onPointerCancel={cancelWishlistGroupPointerDrag}
              onPointerDown={(event) =>
                startWishlistGroupPointerDrag(event, group.key, group.name)
              }
              onPointerMove={updateWishlistGroupPointerDrag}
              onPointerUp={finishWishlistGroupPointerDrag}
            >
              <button
                aria-expanded={!collapsed}
                className={
                  group.key === "unassigned"
                    ? "wishlistGroupHeader wishlistGroupHeader--fixed"
                    : "wishlistGroupHeader"
                }
                onClick={(event) => {
                  if (event.detail === 0 || group.key === "unassigned") {
                    toggleWishlistGroup(group.key);
                  }
                }}
                onContextMenu={(event) => {
                  if (!groupProject) return;
                  event.preventDefault();
                  event.stopPropagation();
                  openContextMenu(
                    { kind: "project", project: groupProject },
                    event.clientX,
                    event.clientY,
                    event.currentTarget,
                  );
                }}
                onKeyDown={(event) => {
                  if (groupProject) {
                    openContextMenuFromKeyboard(event, {
                      kind: "project",
                      project: groupProject,
                    });
                  }
                }}
                title={
                  group.key === "unassigned"
                    ? "未分類は並べ替えできません"
                    : groupProject
                      ? `${group.name}（ドラッグでグループを並べ替え、右クリックで編集）`
                      : "ドラッグでグループを並べ替え"
                }
                type="button"
              >
                <UiIcon
                  name={collapsed ? "chevronRight" : "chevronDown"}
                  size={16}
                />
                {groupProject ? (
                  <ProjectIdentity
                    colorId={groupProject.colorId}
                    compact
                    name={group.name}
                    projectId={groupProject.id}
                  />
                ) : (
                  <strong>未分類</strong>
                )}
                {groupNeedsNextStep && (
                  <span className="uiPill wishlistNextStepMissing">次の一手が未設定</span>
                )}
                <span>{group.items.length}件</span>
              </button>
              <SectionCollapse open={!collapsed} dragActive={dragActive}>
                <>
                  <div className="inboxList">
                    {visibleItems.map(({ item, index }) => {
                      const sourceKey = item.id ? `wishlist:${item.id}` : null;
                      const sourceLocked = Boolean(
                        sourceKey &&
                        sourceLockedByUnfinishedToday(config, sourceKey),
                      );
                      const selected = Boolean(
                        sourceKey &&
                        config.today.items.some((todayItem) => {
                          if (todayItem.sourceKey) {
                            return (
                              canonicalSourceKey(config, todayItem.sourceKey) ===
                              sourceKey
                            );
                          }
                          return (
                            todayItem.projectId === item.projectId &&
                            todayItem.text.trim() === item.text.trim()
                          );
                        }),
                      );
                      const nextStepSelected = wishlistItemIsCurrentNextStep(item);
                      return (
                        <div
                          className={
                            inboxPointerDrag?.index === index
                              ? "inboxRow sourceListRow inboxRow--dragging"
                              : "inboxRow sourceListRow"
                          }
                          data-inbox-index={index}
                          data-inbox-id={item.id}
                          key={item.id ?? `${item.text}-${index}`}
                          onFocus={() => {
                            if (item.id)
                              inboxListAnchorRef.current = { id: item.id, index };
                          }}
                          onBlur={(event) => {
                            if (!(event.relatedTarget instanceof Node) ||
                                !event.currentTarget.contains(event.relatedTarget)) {
                              inboxListAnchorRef.current = null;
                            }
                          }}
                          onContextMenu={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            openContextMenu(
                              { kind: "inbox", index, itemText: item.text },
                              event.clientX,
                              event.clientY,
                              event.currentTarget,
                            );
                          }}
                          onKeyDown={(event) => {
                            if (
                              handleRowShortcutKey(event, {
                                activate: () => promoteInboxToNextStep(index),
                                edit: () => beginInboxEdit(index),
                                remove: () => deleteInboxItem(index),
                              })
                            )
                              return;
                            openContextMenuFromKeyboard(event, {
                              kind: "inbox",
                              index,
                              itemText: item.text,
                            });
                          }}
                          onPointerCancel={cancelInboxPointerDrag}
                          onPointerDown={(event) =>
                            startInboxPointerDrag(event, index)
                          }
                          onPointerMove={updateInboxPointerDrag}
                          onPointerUp={finishInboxPointerDrag}
                          tabIndex={0}
                        >
                          <span className="inboxItemText" title={item.text}>
                            {sourceLocked && (
                              <span
                                aria-label="今日の3件で使用中のためロック中"
                                className="sourceLockBadge sourceLockBadge--wishlist"
                                tabIndex={0}
                                title={SOURCE_LOCK_REASON}
                              >
                                <UiIcon name="lock" size={16} />
                              </span>
                            )}
                            {item.text}
                          </span>
                          <div className="wishlistRowActions">
                            <span className="wishlistNextStepSlot">
                              {!nextStepSelected && !sourceLocked ? (
                                <button
                                  aria-label={`${item.text}の次の一手にする`}
                                  className={
groupNeedsNextStep
? "wishlistNextStepAction nextStepRowAction nextStepRowAction--set mainActionButton mainActionButton--gold"
: "wishlistNextStepAction nextStepRowAction nextStepRowAction--set mainActionButton mainActionButton--neutral"
}
                                  disabled={
                                    !item.id ||
                                    sourceEditBlocked(`wishlist:${item.id}`)
                                  }
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    promoteInboxToNextStep(index);
                                  }}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  title={
                                    item.id
                                      ? (sourceEditBlockReason(
                                          `wishlist:${item.id}`,
                                        ) ?? "次の一手にする")
                                      : "次の一手にする"
                                  }
                                  type="button"
                                >
                                  ▷ 次の一手にする
                                </button>
                              ) : null}
                            </span>
                            {nextStepSelected && (
                              <span className="wishlistNextStepStatus">
                                ✓ 次の一手に設定済み
                              </span>
                            )}
                            {selected && (
                              <span className="wishlistTodayStatus">
                                ✓ 今日の3件に設定済み
                              </span>
                            )}
                            <span aria-hidden="true" className="uiKey rowKeyHint">
                              Enter
                            </span>
                            <button
                              aria-label={`${item.text}の操作`}
                              aria-haspopup="menu"
                              className="sourceRowMenu"
                              onClick={(event) => {
                                const rect =
                                  event.currentTarget.getBoundingClientRect();
                                openContextMenu(
                                  { kind: "inbox", index, itemText: item.text },
                                  rect.left,
                                  rect.bottom,
                                  event.currentTarget,
                                );
                              }}
                              title="操作メニュー"
                              type="button"
                            >
                              <span aria-hidden="true">…</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {group.items.length > SOURCE_LIST_COMPACT_LIMIT &&
                    group.items.length < SOURCE_LIST_PAGINATION_THRESHOLD && (
                      <div className="sourceListControls">
                        <button
                          className="mainActionButton mainActionButton--neutral"
                          onClick={() =>
                            setWishlistGroupViews((current) => ({
                              ...current,
                              [group.key]: {
                                ...current[group.key],
                                expanded: !view.expanded,
                              },
                            }))
                          }
                          type="button"
                        >
                          {view.expanded
                            ? "5件だけ表示"
                            : `残り${group.items.length - SOURCE_LIST_COMPACT_LIMIT}件をもっと見る`}
                        </button>
                      </div>
                    )}
                  {group.items.length >= SOURCE_LIST_PAGINATION_THRESHOLD && (
                    <nav
                      aria-label={`${group.name}のやりたいことページ`}
                      className="sourceListPagination"
                    >
                      <button
                        className="mainActionButton mainActionButton--neutral"
                        disabled={range.page <= 1}
                        onClick={() =>
                          setWishlistGroupViews((current) => ({
                            ...current,
                            [group.key]: {
                              ...current[group.key],
                              page: Math.max(1, range.page - 1),
                            },
                          }))
                        }
                        type="button"
                      >
                        <UiIcon name="chevronLeft" size={16} /> 前へ
                      </button>
                      <span>
                        {range.page} / {range.pageCount}
                      </span>
                      <button
                        className="mainActionButton mainActionButton--neutral"
                        disabled={range.page >= range.pageCount}
                        onClick={() =>
                          setWishlistGroupViews((current) => ({
                            ...current,
                            [group.key]: {
                              ...current[group.key],
                              page: Math.min(range.pageCount, range.page + 1),
                            },
                          }))
                        }
                        type="button"
                      >
                        次へ <UiIcon name="chevronRight" size={16} />
                      </button>
                    </nav>
                  )}
                </>
              </SectionCollapse>
            </section>
          );
        })}
      </div>
      {inboxPointerDrag?.targetIndicator && (
        <div
          aria-hidden="true"
          className="inboxDropIndicator"
          style={inboxPointerDrag.targetIndicator}
        />
      )}
      {inboxPointerDrag?.todayTargetIndicator && (
        <div
          aria-hidden="true"
          className="todayDropIndicator"
          style={inboxPointerDrag.todayTargetIndicator}
        />
      )}
      {wishlistGroupPointerDrag?.targetIndicator && (
        <div
          aria-hidden="true"
          className="wishlistGroupDropIndicator"
          style={wishlistGroupPointerDrag.targetIndicator}
        />
      )}
      {wishlistGroupPointerDrag && (
        <div
          aria-hidden="true"
          className="wishlistGroupDragGhost"
          style={{
            left:
              wishlistGroupPointerDrag.pointerX - wishlistGroupPointerDrag.offsetX,
            top:
              wishlistGroupPointerDrag.pointerY - wishlistGroupPointerDrag.offsetY,
            width: Math.min(320, wishlistGroupPointerDrag.width),
          }}
        >
          {wishlistGroupPointerDrag.name}
        </div>
      )}
      {inboxPointerDrag &&
        (() => {
          const item = config.inbox.find(
            (entry) =>
              entry.id === inboxPointerDrag.sourceKey.slice("wishlist:".length),
          );
          const project = item?.projectId
            ? projectsById.get(item.projectId)
            : undefined;
          return item ? (
            <div
              aria-hidden="true"
              className="inboxDragGhost"
              style={{
                left: inboxPointerDrag.pointerX - inboxPointerDrag.offsetX,
                top: inboxPointerDrag.pointerY - inboxPointerDrag.offsetY,
                width: Math.min(300, inboxPointerDrag.width),
              }}
            >
              <span className="inboxProjectIdentity">
                {project ? (
                  <ProjectIdentity
                    colorId={project.colorId}
                    compact
                    name={project.name}
                    projectId={project.id}
                  />
                ) : (
                  <span className="sourceProjectNone">プロジェクトなし</span>
                )}
              </span>
              <strong>{item.text}</strong>
            </div>
          ) : null;
        })()}
    </div>
  </SectionCollapse>
</section>
  );
}
