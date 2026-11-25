import type { Dispatch, SetStateAction } from "react";
import type { LauncherAction, OverlayPage } from "../types";
import type { ActionDraft, ButtonEditDraft } from "../app/dashboardTypes";
import { ACTION_DRAG_TYPE } from "../app/constants";
import { actionValue, makeAction, setActionValue } from "../app/helpers";
import { DEFAULT_BUTTON_GROUP } from "../constants";
import { GroupModeField } from "./GroupModeField";
import { UiIcon } from "./UiIcon";
import type { ExitPresenceAttributes } from "./ExitPresence";

// V163-A3: the Button edit dialog, moved out of App.tsx (same DOM, text and handlers).

export type ButtonEditDialogProps = {
  actionDragId: string | null;
  buttonEditDraft: ButtonEditDraft;
  groupNames: string[];
  overlayPages: OverlayPage[];
  setActionDragId: Dispatch<SetStateAction<string | null>>;
  setButtonEditDraft: Dispatch<SetStateAction<ButtonEditDraft | null>>;
  moveButtonAction: (draftIdValue: string, delta: -1 | 1) => void;
  moveButtonActionTo: (draggedId: string, targetId: string) => void;
  updateButtonAction: (draftIdValue: string, action: ActionDraft) => void;
  requestCloseButtonEdit: () => void;
  saveButtonEdit: () => void;
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
};

export function ButtonEditDialog(props: ButtonEditDialogProps) {
  const {
    actionDragId,
    buttonEditDraft,
    groupNames,
    moveButtonAction,
    moveButtonActionTo,
    overlayPages,
    requestCloseButtonEdit,
    saveButtonEdit,
    setActionDragId,
    setButtonEditDraft,
    updateButtonAction,
    exitProps,
  } = props;

  return (
    <div className="modalBackdrop" role="presentation" {...exitProps}>
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label="ボタン編集"
        aria-modal="true"
        className="dropDialog editDialog buttonEditDialog"
        role="dialog"
        tabIndex={-1}
      >
        <div className="buttonEditDialogHeader modalTitleRow">
          <div>
            <p className="eyebrow">Button</p>
            <h2>ボタンを編集</h2>
          </div>
          <button
            aria-label="ボタン編集を閉じる"
            className="iconButton"
            onClick={requestCloseButtonEdit}
            title="閉じる"
            type="button"
          >
            <UiIcon name="close" size={16} />
          </button>
        </div>

        <div className="buttonEditDialogBody app-scrollbar">
          <section className="buttonEditSection">
            <h3>基本</h3>
            <label className="fieldStack">
              <span>ラベル</span>
              <input autoComplete="off"
                className="textInput"
                maxLength={48}
                onChange={(event) =>
                  setButtonEditDraft({ ...buttonEditDraft, label: event.target.value })
                }
                value={buttonEditDraft.label}
              />
            </label>
            <GroupModeField
              existingGroup={buttonEditDraft.existingGroup}
              groupMode={buttonEditDraft.groupMode}
              groups={groupNames}
              newGroup={buttonEditDraft.newGroup}
              onExistingGroupChange={(existingGroup) =>
                setButtonEditDraft({ ...buttonEditDraft, existingGroup })
              }
              onGroupModeChange={(groupMode) =>
                setButtonEditDraft({
                  ...buttonEditDraft,
                  groupMode,
                  existingGroup:
                    buttonEditDraft.existingGroup || groupNames[0] || DEFAULT_BUTTON_GROUP,
                })
              }
              onNewGroupChange={(newGroup) =>
                setButtonEditDraft({ ...buttonEditDraft, newGroup })
              }
            />
          </section>

          <section className="buttonEditSection">
            <h3>表示先</h3>
            <div className="fieldStack">
              <span>表示先</span>
              <div className="displayTargetList">
                <label className="displayTargetItem">
                  <input
                    checked={buttonEditDraft.showInSidebar}
                    onChange={(event) =>
                      setButtonEditDraft({
                        ...buttonEditDraft,
                        showInSidebar: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <strong>左サイドバーに表示</strong>
                </label>
                <label className="displayTargetItem">
                  <input
                    checked={buttonEditDraft.showInOverlay}
                    onChange={(event) =>
                      setButtonEditDraft({
                        ...buttonEditDraft,
                        showInOverlay: event.target.checked,
                      })
                    }
                    type="checkbox"
                  />
                  <strong>Ctrl+K辞書に表示</strong>
                </label>
              </div>
            </div>

            {!buttonEditDraft.showInSidebar && !buttonEditDraft.showInOverlay && (
              <p className="visibilityWarning">
                サイドバーにも辞書にも表示されません。設定ファイル上には残ります。
              </p>
            )}

            {buttonEditDraft.showInOverlay && (
              <div className="fieldStack">
                <span>辞書ページ</span>
                <select
                  className="textInput"
                  onChange={(event) =>
                    setButtonEditDraft({
                      ...buttonEditDraft,
                      overlayPageId: event.target.value || null,
                    })
                  }
                  value={
                    overlayPages.some((page) => page.id === buttonEditDraft.overlayPageId)
                      ? (buttonEditDraft.overlayPageId ?? "")
                      : ""
                  }
                >
                  <option value="">未分類</option>
                  {overlayPages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name}
                    </option>
                  ))}
                </select>
                <small className="quietText quietText--small">
                  サイドバーのグループと辞書ページは別々に設定できます。
                </small>
              </div>
            )}
          </section>

          <details className="buttonEditOptional">
            <summary>検索・説明（任意）</summary>
            <div className="buttonEditOptionalBody">
              <label className="fieldStack">
                <span>検索キーワード</span>
                <textarea autoComplete="off"
                  className="textInput aliasesInput"
                  onChange={(event) =>
                    setButtonEditDraft({ ...buttonEditDraft, aliasesInput: event.target.value })
                  }
                  placeholder="editor, docs, よく使う"
                  value={buttonEditDraft.aliasesInput}
                />
              </label>
              <label className="fieldStack">
                <span>説明</span>
                <textarea autoComplete="off"
                  className="textInput aliasesInput"
                  onChange={(event) =>
                    setButtonEditDraft({ ...buttonEditDraft, description: event.target.value })
                  }
                  placeholder="よく使うアプリやフォルダを開く。"
                  value={buttonEditDraft.description}
                />
              </label>
            </div>
          </details>

          <section className="buttonEditSection">
            <h3>実行アクション</h3>
            <div className="fieldStack">
              <span>アクション</span>
              <div className="actionEditor">
                {buttonEditDraft.actions.map((action, index) => (
                  <div
                    className={
                      actionDragId === action.draftId
                        ? "actionRow buttonEditActionRow actionRow--dragging"
                        : "actionRow buttonEditActionRow"
                    }
                    draggable={buttonEditDraft.actions.length > 1}
                    key={action.draftId}
                    onDragStart={(event) => {
                      setActionDragId(action.draftId);
                      event.dataTransfer.setData(ACTION_DRAG_TYPE, action.draftId);
                      event.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => setActionDragId(null)}
                    onDragOver={(event) => {
                      const draggedId =
                        event.dataTransfer.getData(ACTION_DRAG_TYPE) || actionDragId;
                      if (!draggedId || draggedId === action.draftId) return;
                      event.preventDefault();
                    }}
                    onDrop={(event) => {
                      const draggedId =
                        event.dataTransfer.getData(ACTION_DRAG_TYPE) || actionDragId;
                      if (!draggedId || draggedId === action.draftId) return;
                      event.preventDefault();
                      moveButtonActionTo(draggedId, action.draftId);
                      setActionDragId(null);
                    }}
                  >
                    <select
                      onChange={(event) =>
                        updateButtonAction(
                          action.draftId,
                          makeAction(
                            event.target.value as LauncherAction["type"],
                            actionValue(action),
                          ),
                        )
                      }
                      value={action.type}
                    >
                      <option value="open_app">アプリ</option>
                      <option value="open_folder">フォルダ</option>
                      <option value="open_file">ファイル</option>
                      <option value="open_url">URL</option>
                      <option value="run_script">スクリプト</option>
                      <option value="open_shell_special">Windows特殊項目</option>
                    </select>
                    <input autoComplete="off"
                      className="textInput"
                      disabled={action.type === "open_shell_special"}
                      onChange={(event) =>
                        updateButtonAction(
                          action.draftId,
                          setActionValue(action, event.target.value),
                        )
                      }
                      value={actionValue(action)}
                    />
                    <div className="buttonEditActionButtons">
                      {buttonEditDraft.actions.length > 1 ? (
                        <>
                          <button
                            aria-label="アクションを上へ"
                            className="iconButton"
                            disabled={index === 0}
                            onClick={() => moveButtonAction(action.draftId, -1)}
                            title="上へ"
                            type="button"
                          >
                            ↑
                          </button>
                          <button
                            aria-label="アクションを下へ"
                            className="iconButton"
                            disabled={index === buttonEditDraft.actions.length - 1}
                            onClick={() => moveButtonAction(action.draftId, 1)}
                            title="下へ"
                            type="button"
                          >
                            ↓
                          </button>
                        </>
                      ) : null}
                      <button
                        aria-label="アクションを削除"
                        className="iconButton"
                        onClick={() =>
                          setButtonEditDraft({
                            ...buttonEditDraft,
                            actions: buttonEditDraft.actions.filter(
                              (item) => item.draftId !== action.draftId,
                            ),
                          })
                        }
                        title="削除"
                        type="button"
                      >
                        <UiIcon name="close" size={16} />
                      </button>
                    </div>
                  </div>
                ))}
                <button
                  className="primaryButton buttonEditAddAction"
                  onClick={() =>
                    setButtonEditDraft({
                      ...buttonEditDraft,
                      actions: [...buttonEditDraft.actions, makeAction("open_app")],
                    })
                  }
                  type="button"
                >
                  ＋ アクションを追加
                </button>
              </div>
            </div>
          </section>
        </div>

        <div className="dialogActions formDialogActions buttonEditDialogFooter">
          <button className="primaryButton" onClick={() => void saveButtonEdit()} type="button">
            保存
          </button>
          <button
            className="secondaryButton dialogCancelButton"
            onClick={requestCloseButtonEdit}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}
