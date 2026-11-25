import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import { AnimatePresence } from "motion/react";
import { DEFAULT_BUTTON_GROUP } from "../constants";
import { buttonGroupName, uniqueGroupNames } from "../app/helpers";
import type { ContextMenuState } from "../app/dashboardTypes";
import { canRevealLauncherButton } from "../launcherReveal";
import { showButtonInSidebar, todaySourceKey } from "../app/helpers";
import { canonicalSourceKey } from "../sourceEdit";
import { legacyWishlistSourceKey, wishlistSourceKey } from "../todayCandidates";
import type { TodayCandidate } from "../todayCandidates";
import type {
  AppConfig,
  LauncherButton,
  LauncherProject,
  SessionEntryRow,
  TodayItem,
} from "../types";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import { ExitPresence } from "./ExitPresence";
import type { NextStepEditorOptions } from "./CompletionNextStepDialog";

// V164-A4: the right-click / action menu, moved out of App.tsx (same DOM, text and handlers).

export type DashboardContextMenuProps = {
  actions: {
    addCandidateToToday: (candidate: TodayCandidate, insertionIndex?: number) => Promise<boolean>;
    beginInboxEdit: (index: number, origin?: "source" | "today" | "builder") => void;
    clearProjectNextStep: (project: LauncherProject) => void;
    completeInboxItem: (index: number) => void;
    deleteButton: (button: LauncherButton) => void;
    deleteGroup: (groupName: string) => void;
    deleteInboxItem: (index: number) => void;
    dismissContextMenu: (restoreFocus?: boolean) => void;
    handleContextMenuShortcut: (key: string) => boolean;
    moveInboxItemByOffset: (index: number, offset: -1 | 1) => Promise<void>;
    moveSidebarButtonByOffset: (buttonId: string, offset: -1 | 1) => Promise<void>;
    moveSidebarButtonToDictionary: (button: LauncherButton) => Promise<void>;
    moveSidebarGroupByOffset: (groupName: string, offset: -1 | 1) => Promise<void>;
    moveTodayItemByOffset: (index: number, offset: -1 | 1) => Promise<void>;
    openButtonBuilder: (groupName?: string) => void;
    openButtonEditDialog: (button: LauncherButton) => void;
    openGroupDialog: () => void;
    openGroupRenameDialog: (groupName?: string) => void;
    openImportDialog: (
      text: string,
      error?: string | null,
      opener?: HTMLElement | null,
    ) => void;
    openInboxAddDialog: (opener?: HTMLButtonElement, projectId?: string) => void;
    openNextStepEditor: (project: LauncherProject, options?: NextStepEditorOptions) => void;
    openProjectAddDialog: () => void;
    openProjectEditDialog: (
      project: LauncherProject,
      origin?: "source" | "today" | "builder",
    ) => void;
    openProjectManagement: () => void;
    openSessionEditDialog: (session: SessionEntryRow) => void;
    promoteInboxToNextStep: (index: number) => void;
    removeTodayItem: (sourceKey: string) => Promise<void>;
    requestProjectDeletion: (project: LauncherProject) => void;
    requestSessionDelete: (session: SessionEntryRow) => void;
    revealButtonInExplorer: (button: LauncherButton) => Promise<void>;
    setContextMenu: Dispatch<SetStateAction<ContextMenuState | null>>;
    showNextDoNowCandidate: () => void;
    sourceEditBlockReason: (key: string, allowTodaySourceSync?: boolean) => string | null;
    sourceEditBlocked: (key: string, allowTodaySourceSync?: boolean) => boolean;
    wishlistItemIsCurrentNextStep: (item: AppConfig["inbox"][number]) => boolean;
  };
  config: AppConfig;
  configRef: MutableRefObject<AppConfig | null>;
  contextMenu: ContextMenuState | null;
  contextMenuReturnFocusRef: MutableRefObject<HTMLElement | null>;
  contextMenuTodayAdd: {
    candidate: TodayCandidate;
    disabled: boolean;
    reason: string | undefined;
  } | null;
  inboxNeighborIndex: (index: number, offset: -1 | 1) => number | undefined;
  isTimerActiveForSource: (sourceKeys: string[], projectId?: string) => boolean;
  isTimerOnTodayItem: (item: TodayItem, index: number) => boolean;
};

export function DashboardContextMenu({
  actions,
  config,
  configRef,
  contextMenu,
  contextMenuReturnFocusRef,
  contextMenuTodayAdd,
  inboxNeighborIndex,
  isTimerActiveForSource,
  isTimerOnTodayItem,
}: DashboardContextMenuProps) {
  const {
    addCandidateToToday,
    beginInboxEdit,
    clearProjectNextStep,
    completeInboxItem,
    deleteButton,
    deleteGroup,
    deleteInboxItem,
    dismissContextMenu,
    handleContextMenuShortcut,
    moveInboxItemByOffset,
    moveSidebarButtonByOffset,
    moveSidebarButtonToDictionary,
    moveSidebarGroupByOffset,
    moveTodayItemByOffset,
    openButtonBuilder,
    openButtonEditDialog,
    openGroupDialog,
    openGroupRenameDialog,
    openImportDialog,
    openInboxAddDialog,
    openNextStepEditor,
    openProjectAddDialog,
    openProjectEditDialog,
    openProjectManagement,
    openSessionEditDialog,
    promoteInboxToNextStep,
    removeTodayItem,
    requestProjectDeletion,
    requestSessionDelete,
    revealButtonInExplorer,
    setContextMenu,
    showNextDoNowCandidate,
    sourceEditBlockReason,
    sourceEditBlocked,
    wishlistItemIsCurrentNextStep,
  } = actions;
  void DEFAULT_BUTTON_GROUP;
  void buttonGroupName;
  void uniqueGroupNames;
  void canRevealLauncherButton;
  void showButtonInSidebar;
  void todaySourceKey;
  void canonicalSourceKey;
  void legacyWishlistSourceKey;
  void wishlistSourceKey;
  return (
<AnimatePresence initial={false}>
  {contextMenu && (
    <ExitPresence key="context-menu">
      {(exiting, exitProps) => (
        <ContextMenu
          exitProps={exitProps}
          ariaLabel="操作メニュー"
          onClose={() => dismissContextMenu(false)}
          onShortcutKey={handleContextMenuShortcut}
          opener={contextMenuReturnFocusRef.current}
          x={contextMenu.x}
          y={contextMenu.y}
        >
          {contextMenu.kind === "doNow" ? (
            <ContextMenuItem onClick={showNextDoNowCandidate} type="button">
              他の一手
            </ContextMenuItem>
          ) : contextMenu.kind === "button" ? (
            <>
              {showButtonInSidebar(contextMenu.button) && (
                <>
                  <ContextMenuItem
                    disabled={
                      (config?.buttons ?? [])
                        .filter(
                          (button) =>
                            showButtonInSidebar(button) &&
                            buttonGroupName(button) === buttonGroupName(contextMenu.button),
                        )
                        .findIndex((button) => button.id === contextMenu.button.id) <= 0
                    }
                    onClick={() => void moveSidebarButtonByOffset(contextMenu.button.id, -1)}
                    type="button"
                  >
                    上へ移動
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={(() => {
                      const groupButtons = (config?.buttons ?? []).filter(
                        (button) =>
                          showButtonInSidebar(button) &&
                          buttonGroupName(button) === buttonGroupName(contextMenu.button),
                      );
                      return (
                        groupButtons.findIndex((button) => button.id === contextMenu.button.id) >=
                        groupButtons.length - 1
                      );
                    })()}
                    onClick={() => void moveSidebarButtonByOffset(contextMenu.button.id, 1)}
                    type="button"
                  >
                    下へ移動
                  </ContextMenuItem>
                </>
              )}
              <ContextMenuItem
                onClick={() => openButtonEditDialog(contextMenu.button)}
                type="button"
              >
                編集
              </ContextMenuItem>
              {canRevealLauncherButton(contextMenu.button) ? (
                <ContextMenuItem
                  onClick={() => void revealButtonInExplorer(contextMenu.button)}
                  type="button"
                >
                  エクスプローラーで表示する
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem
                className="contextMenuSeparatorBefore"
                onClick={() => void moveSidebarButtonToDictionary(contextMenu.button)}
                type="button"
              >
                辞書に移動
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger contextMenuSeparatorBefore"
                onClick={() => deleteButton(contextMenu.button)}
                type="button"
              >
                削除
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "today" ? (
            <>
              <ContextMenuItem
                disabled={
                  !config.today.items[contextMenu.index]?.sourceKey ||
                  !canonicalSourceKey(config, config.today.items[contextMenu.index].sourceKey!) ||
                  sourceEditBlocked(
                    canonicalSourceKey(config, config.today.items[contextMenu.index].sourceKey!) ??
                      "",
                    true,
                  )
                }
                title={
                  config.today.items[contextMenu.index]?.sourceKey
                    ? (sourceEditBlockReason(
                        canonicalSourceKey(
                          config,
                          config.today.items[contextMenu.index].sourceKey!,
                        ) ?? "",
                        true,
                      ) ?? undefined)
                    : undefined
                }
                onClick={() => {
                  const current = configRef.current;
                  const item = current?.today.items[contextMenu.index];
                  if (!current || !item?.sourceKey) return;
                  const key = canonicalSourceKey(current, item.sourceKey);
                  if (!key || sourceEditBlocked(key, true)) return;
                  const project = current.projects.find((p) => `project:${p.id}` === key);
                  if (project) openNextStepEditor(project, { origin: "today" });
                  else {
                    const index = current.inbox.findIndex((i) => `wishlist:${i.id}` === key);
                    if (index >= 0) beginInboxEdit(index, "today");
                  }
                }}
                shortcut="F2"
                type="button"
              >
                編集
              </ContextMenuItem>
              <ContextMenuItem
                disabled={contextMenu.index <= 0}
                onClick={() => void moveTodayItemByOffset(contextMenu.index, -1)}
                type="button"
              >
                左へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={contextMenu.index >= (config?.today.items.length ?? 0) - 1}
                onClick={() => void moveTodayItemByOffset(contextMenu.index, 1)}
                type="button"
              >
                右へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={
                  !!config?.today.items[contextMenu.index] &&
                  isTimerOnTodayItem(config.today.items[contextMenu.index], contextMenu.index)
                }
                title={
                  config?.today.items[contextMenu.index] &&
                  isTimerOnTodayItem(config.today.items[contextMenu.index], contextMenu.index)
                    ? "タイマーを停止してから外してください"
                    : undefined
                }
                onClick={() => {
                  setContextMenu(null);
                  const item = config?.today.items[contextMenu.index];
                  if (item) void removeTodayItem(todaySourceKey(item, contextMenu.index));
                }}
                shortcut="Delete"
                type="button"
              >
                今日の3件から外す
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "inbox" ? (
            <>
              <ContextMenuItem
                disabled={
                  sourceEditBlocked(`wishlist:${config?.inbox[contextMenu.index]?.id ?? ""}`) ||
                  Boolean(
                    config?.inbox[contextMenu.index] &&
                    wishlistItemIsCurrentNextStep(config.inbox[contextMenu.index]),
                  )
                }
                onClick={() => promoteInboxToNextStep(contextMenu.index)}
                title={
                  sourceEditBlockReason(`wishlist:${config?.inbox[contextMenu.index]?.id ?? ""}`) ??
                  undefined
                }
                type="button"
              >
                {config?.inbox[contextMenu.index] &&
                wishlistItemIsCurrentNextStep(config.inbox[contextMenu.index])
                  ? "次の一手に設定済み"
                  : "次の一手にする"}
              </ContextMenuItem>
              <ContextMenuItem
                disabled={inboxNeighborIndex(contextMenu.index, -1) === undefined}
                onClick={() => void moveInboxItemByOffset(contextMenu.index, -1)}
                type="button"
              >
                上へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={inboxNeighborIndex(contextMenu.index, 1) === undefined}
                onClick={() => void moveInboxItemByOffset(contextMenu.index, 1)}
                type="button"
              >
                下へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={sourceEditBlocked(`wishlist:${config.inbox[contextMenu.index]?.id}`)}
                title={
                  sourceEditBlockReason(`wishlist:${config.inbox[contextMenu.index]?.id}`) ??
                  undefined
                }
                onClick={() => beginInboxEdit(contextMenu.index)}
                shortcut="F2"
                type="button"
              >
                編集
              </ContextMenuItem>
              <ContextMenuItem
                disabled={
                  !config?.inbox[contextMenu.index] ||
                  sourceEditBlocked(`wishlist:${config?.inbox[contextMenu.index]?.id ?? ""}`) ||
                  isTimerActiveForSource([
                    wishlistSourceKey(config.inbox[contextMenu.index], contextMenu.index),
                    legacyWishlistSourceKey(config.inbox[contextMenu.index]),
                  ])
                }
                onClick={() => completeInboxItem(contextMenu.index)}
                type="button"
              >
                完了にする
              </ContextMenuItem>
              {contextMenuTodayAdd ? (
                <ContextMenuItem
                  disabled={contextMenuTodayAdd.disabled}
                  onClick={() => {
                    const candidate = contextMenuTodayAdd.candidate;
                    setContextMenu(null);
                    void addCandidateToToday(candidate);
                  }}
                  shortcut="T"
                  title={contextMenuTodayAdd.reason}
                  type="button"
                >
                  今日の3件に入れる
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem
                className="contextMenuDanger"
                disabled={
                  !config?.inbox[contextMenu.index] ||
                  sourceEditBlocked(`wishlist:${config?.inbox[contextMenu.index]?.id ?? ""}`) ||
                  isTimerActiveForSource([
                    wishlistSourceKey(config.inbox[contextMenu.index], contextMenu.index),
                    legacyWishlistSourceKey(config.inbox[contextMenu.index]),
                  ])
                }
                onClick={() => deleteInboxItem(contextMenu.index)}
                shortcut="Delete"
                type="button"
              >
                削除
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "nextStep" ? (
            <>
              <ContextMenuItem
                onClick={() => openProjectEditDialog(contextMenu.project)}
                type="button"
              >
                プロジェクトを編集
              </ContextMenuItem>
              {contextMenu.project.nextStep?.text.trim() ? (
                <>
                  <ContextMenuItem
                    disabled={sourceEditBlocked(`project:${contextMenu.project.id}`)}
                    onClick={() => openNextStepEditor(contextMenu.project)}
                    shortcut="F2"
                    title={sourceEditBlockReason(`project:${contextMenu.project.id}`) ?? undefined}
                    type="button"
                  >
                    次の一手を編集
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={sourceEditBlocked(`project:${contextMenu.project.id}`)}
                    onClick={() =>
                      openNextStepEditor(contextMenu.project, {
                        mode: "promote",
                        text: "",
                        projectLocked: true,
                      })
                    }
                    title={sourceEditBlockReason(`project:${contextMenu.project.id}`) ?? undefined}
                    type="button"
                  >
                    別の行動に入れ替える
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={sourceEditBlocked(`project:${contextMenu.project.id}`)}
                    onClick={() => clearProjectNextStep(contextMenu.project)}
                    shortcut="Delete"
                    title={sourceEditBlockReason(`project:${contextMenu.project.id}`) ?? undefined}
                    type="button"
                  >
                    次の一手を未設定にする
                  </ContextMenuItem>
                </>
              ) : (
                <ContextMenuItem
                  disabled={sourceEditBlocked(`project:${contextMenu.project.id}`)}
                  onClick={() => openNextStepEditor(contextMenu.project)}
                  title={sourceEditBlockReason(`project:${contextMenu.project.id}`) ?? undefined}
                  type="button"
                >
                  次の一手を設定
                </ContextMenuItem>
              )}
              {contextMenuTodayAdd ? (
                <ContextMenuItem
                  disabled={contextMenuTodayAdd.disabled}
                  onClick={() => {
                    const candidate = contextMenuTodayAdd.candidate;
                    setContextMenu(null);
                    void addCandidateToToday(candidate);
                  }}
                  shortcut="T"
                  title={contextMenuTodayAdd.reason}
                  type="button"
                >
                  今日の3件に入れる
                </ContextMenuItem>
              ) : null}
              <ContextMenuItem
                className="contextMenuDanger contextMenuSeparatorBefore"
                onClick={() => requestProjectDeletion(contextMenu.project)}
                type="button"
              >
                プロジェクトを削除…
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "project" ? (
            <>
              <ContextMenuItem
                onClick={() => openProjectEditDialog(contextMenu.project)}
                type="button"
              >
                プロジェクトを編集
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuSeparatorBefore"
                onClick={openProjectManagement}
                type="button"
              >
                プロジェクトを管理
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger contextMenuSeparatorBefore"
                onClick={() => requestProjectDeletion(contextMenu.project)}
                type="button"
              >
                プロジェクトを削除…
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "projects" ? (
            <>
              <ContextMenuItem onClick={openProjectAddDialog} type="button">
                プロジェクトを追加
              </ContextMenuItem>
              <ContextMenuItem onClick={() => openImportDialog("")} type="button">
                まとめて取り込む
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "inboxes" ? (
            <>
              <ContextMenuItem onClick={() => openInboxAddDialog()} type="button">
                やりたいことを追加
              </ContextMenuItem>
              <ContextMenuItem onClick={() => openImportDialog("")} type="button">
                まとめて取り込む
              </ContextMenuItem>
            </>
          ) : contextMenu.kind === "session" ? (
            <>
              <ContextMenuItem
                onClick={() => openSessionEditDialog(contextMenu.session)}
                type="button"
              >
                編集
              </ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger"
                onClick={() => requestSessionDelete(contextMenu.session)}
                type="button"
              >
                削除
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem onClick={openGroupDialog} type="button">
                グループを追加
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() => openButtonBuilder(contextMenu.groupName)}
                type="button"
              >
                ボタンを追加
              </ContextMenuItem>
              {contextMenu.groupName && (
                <>
                  <ContextMenuItem
                    disabled={uniqueGroupNames(config).indexOf(contextMenu.groupName) <= 0}
                    onClick={() => void moveSidebarGroupByOffset(contextMenu.groupName!, -1)}
                    type="button"
                  >
                    上へ移動
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={
                      uniqueGroupNames(config).indexOf(contextMenu.groupName) >=
                      uniqueGroupNames(config).length - 1
                    }
                    onClick={() => void moveSidebarGroupByOffset(contextMenu.groupName!, 1)}
                    type="button"
                  >
                    下へ移動
                  </ContextMenuItem>
                </>
              )}
              {!contextMenu.groupName ? null : contextMenu.groupName === DEFAULT_BUTTON_GROUP ? (
                <ContextMenuItem disabled type="button">
                  その他は削除不可
                </ContextMenuItem>
              ) : (
                <>
                  <ContextMenuItem
                    onClick={() => openGroupRenameDialog(contextMenu.groupName)}
                    type="button"
                  >
                    名前を変更
                  </ContextMenuItem>
                  <ContextMenuItem
                    className="contextMenuDanger"
                    onClick={() => {
                      if (contextMenu.groupName) deleteGroup(contextMenu.groupName);
                    }}
                    type="button"
                  >
                    {contextMenu.groupName ? `${contextMenu.groupName}を削除` : "グループ削除"}
                  </ContextMenuItem>
                </>
              )}
            </>
          )}
        </ContextMenu>
      )}
    </ExitPresence>
  )}
</AnimatePresence>
  );
}
