import { useEffect, useRef } from "react";
import { OVERLAY_PAGE_NAME_MAX_CHARS } from "../constants";
import type { LauncherAction } from "../types";
import { ConfirmDialog } from "./ConfirmDialog";
import { ContextMenu, ContextMenuItem } from "./ContextMenu";
import {
  makeAction,
  setValue,
  valueOf,
  type DictionaryFeatureParityController,
} from "./DictionaryFeatureParity";
import { UiIcon } from "./UiIcon";

const DIALOG_FOCUSABLE =
  "button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex='-1'])";

function DictionaryDialogBehavior({
  onRequestClose,
  suspended,
}: {
  onRequestClose: () => void;
  suspended: boolean;
}) {
  const markerRef = useRef<HTMLSpanElement | null>(null);
  const closeRef = useRef(onRequestClose);
  closeRef.current = onRequestClose;

  useEffect(() => {
    const dialog = markerRef.current?.closest<HTMLElement>("[role='dialog']");
    if (!dialog) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => {
      const target = dialog.querySelector<HTMLElement>("[autofocus], " + DIALOG_FOCUSABLE);
      (target ?? dialog).focus();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
      opener?.focus();
    };
  }, []);

  useEffect(() => {
    if (suspended) return;
    const dialog = markerRef.current?.closest<HTMLElement>("[role='dialog']");
    if (!dialog) return;
    const focusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE)).filter(
        (element) => !element.hidden,
      );
    const onKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const items = focusable();
      if (!items.length) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (event.target instanceof Node && !dialog.contains(event.target))
        (focusable()[0] ?? dialog).focus();
    };
    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("focusin", onFocusIn, true);
    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("focusin", onFocusIn, true);
    };
  }, [suspended]);

  return <span aria-hidden="true" ref={markerRef} style={{ display: "none" }} />;
}

export function DictionaryFeatureParityUi({ c }: { c: DictionaryFeatureParityController }) {
  const {
    addButtonToSidebar,
    buttonDraft,
    canMoveButton,
    confirmation,
    deleteButton,
    deletePage,
    dropDraft,
    editButton,
    error,
    groups,
    menu,
    moveButton,
    movePage,
    pageDraft,
    pageError,
    pages,
    register,
    requestCloseButtonEdit,
    saveButton,
    savePage,
    setButtonDraft,
    setConfirmation,
    setDropDraft,
    setError,
    setMenu,
    setPageDraft,
    searchActive,
  } = c;
  return (
    <>
      {menu ? (
        <ContextMenu
          ariaLabel="辞書の操作メニュー"
          onClose={() => setMenu(null)}
          opener={menu.opener}
          x={menu.x}
          y={menu.y}
        >
          {menu.kind === "button" ? (
            <>
              {!searchActive ? (
                <>
                  <ContextMenuItem
                    disabled={!canMoveButton(menu.button.id, -1)}
                    onClick={() => void moveButton(menu.button, -1, menu.opener)}
                  >
                    前へ移動
                  </ContextMenuItem>
                  <ContextMenuItem
                    disabled={!canMoveButton(menu.button.id, 1)}
                    onClick={() => void moveButton(menu.button, 1, menu.opener)}
                  >
                    後ろへ移動
                  </ContextMenuItem>
                </>
              ) : null}
              <ContextMenuItem
                disabled={menu.button.showInSidebar !== false}
                onClick={() => void addButtonToSidebar(menu.button.id)}
              >
                サイドバーに追加
              </ContextMenuItem>
              <ContextMenuItem onClick={() => editButton(menu.button)}>編集</ContextMenuItem>
              <ContextMenuItem
                className="contextMenuDanger"
                onClick={() => deleteButton(menu.button)}
              >
                削除
              </ContextMenuItem>
            </>
          ) : (
            <>
              <ContextMenuItem
                disabled={pages.findIndex((page) => page.id === menu.page.id) <= 0}
                onClick={() => {
                  const opener = menu.opener;
                  void movePage(menu.page.id, -1).finally(() => {
                    window.requestAnimationFrame(() => opener.focus());
                  });
                }}
              >
                上へ移動
              </ContextMenuItem>
              <ContextMenuItem
                disabled={pages.findIndex((page) => page.id === menu.page.id) >= pages.length - 1}
                onClick={() => {
                  const opener = menu.opener;
                  void movePage(menu.page.id, 1).finally(() => {
                    window.requestAnimationFrame(() => opener.focus());
                  });
                }}
              >
                下へ移動
              </ContextMenuItem>
              <ContextMenuItem
                onClick={() =>
                  setPageDraft({ mode: "rename", pageId: menu.page.id, name: menu.page.name })
                }
              >
                名前を変更
              </ContextMenuItem>
              <ContextMenuItem className="contextMenuDanger" onClick={() => deletePage(menu.page)}>
                ページを削除
              </ContextMenuItem>
            </>
          )}
        </ContextMenu>
      ) : null}
      {pageDraft ? (
        <div className="modalBackdrop" role="presentation">
          <section
            aria-label={pageDraft.mode === "add" ? "辞書ページ追加" : "辞書ページ名変更"}
            aria-modal="true"
            className="dropDialog dictionaryParityDialog"
            role="dialog"
            tabIndex={-1}
          >
            <DictionaryDialogBehavior
              onRequestClose={() => {
                setError(null);
                setPageDraft(null);
              }}
              suspended={Boolean(confirmation)}
            />
            <div>
              <p className="eyebrow">Dictionary page</p>
              <h2>{pageDraft.mode === "add" ? "ページを追加" : "名前を変更"}</h2>
            </div>
            <label className="fieldStack">
              <span>ページ名</span>
              <input
                autoFocus
                className="textInput"
                maxLength={OVERLAY_PAGE_NAME_MAX_CHARS}
                onChange={(event) => setPageDraft({ ...pageDraft, name: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !pageError(pageDraft.name, pageDraft.pageId))
                    void savePage();
                  if (event.key === "Escape") setPageDraft(null);
                }}
                value={pageDraft.name}
              />
              {pageError(pageDraft.name, pageDraft.pageId) ? (
                <small className="fieldError">{pageError(pageDraft.name, pageDraft.pageId)}</small>
              ) : null}
            </label>
            {error ? (
              <p className="fieldError" role="alert">
                {error}
              </p>
            ) : null}
            <div className="dialogActions">
              <button
                className="secondaryButton"
                onClick={() => {
                  setError(null);
                  setPageDraft(null);
                }}
                type="button"
              >
                キャンセル
              </button>
              <button
                className="primaryButton"
                disabled={Boolean(pageError(pageDraft.name, pageDraft.pageId))}
                onClick={() => void savePage()}
                type="button"
              >
                {pageDraft.mode === "add" ? "追加" : "保存"}
              </button>
            </div>
          </section>
        </div>
      ) : null}{" "}
      {dropDraft ? (
        <div className="modalBackdrop" role="presentation">
          <section
            aria-label="ボタン登録"
            aria-modal="true"
            className="dropDialog modalLongForm dictionaryParityDialog app-scrollbar"
            role="dialog"
            tabIndex={-1}
          >
            <DictionaryDialogBehavior
              onRequestClose={() => {
                setError(null);
                setDropDraft(null);
              }}
              suspended={Boolean(confirmation)}
            />
            <div>
              <p className="eyebrow">Register</p>
              <h2>辞書へ登録</h2>
            </div>
            <label className="fieldStack">
              <span>ラベル</span>
              <input
                autoFocus
                className="textInput"
                maxLength={48}
                onChange={(event) => setDropDraft({ ...dropDraft, label: event.target.value })}
                value={dropDraft.label}
              />
            </label>
            <label className="fieldStack">
              <span>グループ</span>
              <input
                className="textInput"
                list="dictionary-groups"
                onChange={(event) => setDropDraft({ ...dropDraft, group: event.target.value })}
                value={dropDraft.group}
              />
            </label>
            <datalist id="dictionary-groups">
              {groups.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
            <div className="displayTargetList">
              <label className="displayTargetItem">
                <input
                  checked={dropDraft.showInSidebar}
                  onChange={(event) =>
                    setDropDraft({ ...dropDraft, showInSidebar: event.target.checked })
                  }
                  type="checkbox"
                />
                <strong>左サイドバーに表示</strong>
              </label>
              <label className="displayTargetItem">
                <input
                  checked={dropDraft.showInOverlay}
                  onChange={(event) =>
                    setDropDraft({ ...dropDraft, showInOverlay: event.target.checked })
                  }
                  type="checkbox"
                />
                <strong>辞書に表示</strong>
              </label>
            </div>
            {dropDraft.showInOverlay ? (
              <label className="fieldStack">
                <span>辞書ページ</span>
                <select
                  className="textInput"
                  onChange={(event) =>
                    setDropDraft({ ...dropDraft, overlayPageId: event.target.value || null })
                  }
                  value={dropDraft.overlayPageId ?? ""}
                >
                  <option value="">未分類</option>
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <p className="dropSource">{dropDraft.source}</p>
            {error ? (
              <p className="fieldError" role="alert">
                {error}
              </p>
            ) : null}
            <div className="dialogActions">
              <button
                className="secondaryButton"
                onClick={() => {
                  setError(null);
                  setDropDraft(null);
                }}
                type="button"
              >
                キャンセル
              </button>
              <button className="primaryButton" onClick={() => void register()} type="button">
                登録
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {buttonDraft ? (
        <div className="modalBackdrop" role="presentation">
          <section
            aria-label="ボタン編集"
            aria-modal="true"
            className="dropDialog editDialog modalLongForm dictionaryParityDialog app-scrollbar"
            role="dialog"
            tabIndex={-1}
          >
            <DictionaryDialogBehavior
              onRequestClose={requestCloseButtonEdit}
              suspended={Boolean(confirmation)}
            />
            <div>
              <p className="eyebrow">Button</p>
              <h2>ボタンを編集</h2>
            </div>
            <div className="editGrid">
              <label className="fieldStack">
                <span>ラベル</span>
                <input
                  autoFocus
                  className="textInput"
                  maxLength={48}
                  onChange={(event) =>
                    setButtonDraft({ ...buttonDraft, label: event.target.value })
                  }
                  value={buttonDraft.label}
                />
              </label>
              <label className="fieldStack">
                <span>アイコン</span>
                <input
                  className="textInput"
                  maxLength={4}
                  onChange={(event) => setButtonDraft({ ...buttonDraft, icon: event.target.value })}
                  value={buttonDraft.icon}
                />
              </label>
            </div>
            <label className="fieldStack">
              <span>グループ</span>
              <input
                className="textInput"
                list="dictionary-edit-groups"
                onChange={(event) => setButtonDraft({ ...buttonDraft, group: event.target.value })}
                value={buttonDraft.group}
              />
            </label>
            <datalist id="dictionary-edit-groups">
              {groups.map((group) => (
                <option key={group} value={group} />
              ))}
            </datalist>
            <div className="displayTargetList">
              <label className="displayTargetItem">
                <input
                  checked={buttonDraft.showInSidebar}
                  onChange={(event) =>
                    setButtonDraft({ ...buttonDraft, showInSidebar: event.target.checked })
                  }
                  type="checkbox"
                />
                <strong>左サイドバーに表示</strong>
              </label>
              <label className="displayTargetItem">
                <input
                  checked={buttonDraft.showInOverlay}
                  onChange={(event) =>
                    setButtonDraft({ ...buttonDraft, showInOverlay: event.target.checked })
                  }
                  type="checkbox"
                />
                <strong>辞書に表示</strong>
              </label>
            </div>
            {buttonDraft.showInOverlay ? (
              <div className="overlayPagePicker">
                <select
                  className="textInput"
                  onChange={(event) =>
                    setButtonDraft({ ...buttonDraft, overlayPageId: event.target.value || null })
                  }
                  value={buttonDraft.overlayPageId ?? ""}
                >
                  <option value="">未分類</option>
                  {pages.map((page) => (
                    <option key={page.id} value={page.id}>
                      {page.name}
                    </option>
                  ))}
                </select>
                <button
                  className="secondaryButton"
                  onClick={() => setPageDraft({ mode: "add", name: "", assignToButton: true })}
                  type="button"
                >
                  + 新しいページ
                </button>
              </div>
            ) : null}
            <label className="fieldStack">
              <span>検索キーワード</span>
              <textarea
                className="textInput aliasesInput"
                onChange={(event) =>
                  setButtonDraft({ ...buttonDraft, aliasesInput: event.target.value })
                }
                value={buttonDraft.aliasesInput}
              />
            </label>
            <label className="fieldStack">
              <span>説明</span>
              <textarea
                className="textInput aliasesInput"
                onChange={(event) =>
                  setButtonDraft({ ...buttonDraft, description: event.target.value })
                }
                value={buttonDraft.description}
              />
            </label>
            <div className="actionEditor">
              {buttonDraft.actions.map((action, index) => (
                <div className="actionRow" key={action.draftId}>
                  <select
                    onChange={(event) => {
                      const next = makeAction(
                        event.target.value as LauncherAction["type"],
                        valueOf(action),
                      );
                      setButtonDraft({
                        ...buttonDraft,
                        actions: buttonDraft.actions.map((item) =>
                          item.draftId === action.draftId ? next : item,
                        ),
                      });
                    }}
                    value={action.type}
                  >
                    <option value="open_app">アプリ</option>
                    <option value="open_folder">フォルダ</option>
                    <option value="open_file">ファイル</option>
                    <option value="open_url">URL</option>
                    <option value="run_script">スクリプト</option>
                    <option value="open_shell_special">Windows特殊項目</option>
                  </select>
                  <input
                    className="textInput"
                    disabled={action.type === "open_shell_special"}
                    onChange={(event) =>
                      setButtonDraft({
                        ...buttonDraft,
                        actions: buttonDraft.actions.map((item) =>
                          item.draftId === action.draftId
                            ? setValue(action, event.target.value)
                            : item,
                        ),
                      })
                    }
                    value={valueOf(action)}
                  />
                  <button
                    aria-label="アクションを上へ"
                    className="iconButton"
                    disabled={index === 0}
                    onClick={() => {
                      const actions = [...buttonDraft.actions];
                      [actions[index - 1], actions[index]] = [actions[index], actions[index - 1]];
                      setButtonDraft({ ...buttonDraft, actions });
                    }}
                    type="button"
                  >
                    ↑
                  </button>
                  <button
                    aria-label="アクションを下へ"
                    className="iconButton"
                    disabled={index === buttonDraft.actions.length - 1}
                    onClick={() => {
                      const actions = [...buttonDraft.actions];
                      [actions[index + 1], actions[index]] = [actions[index], actions[index + 1]];
                      setButtonDraft({ ...buttonDraft, actions });
                    }}
                    type="button"
                  >
                    ↓
                  </button>
                  <button
                    aria-label="アクションを削除"
                    className="iconButton"
                    onClick={() =>
                      setButtonDraft({
                        ...buttonDraft,
                        actions: buttonDraft.actions.filter(
                          (item) => item.draftId !== action.draftId,
                        ),
                      })
                    }
                    type="button"
                  >
                    <UiIcon name="close" size={16} />
                  </button>
                </div>
              ))}
              <button
                className="secondaryButton"
                onClick={() =>
                  setButtonDraft({
                    ...buttonDraft,
                    actions: [...buttonDraft.actions, makeAction("open_app")],
                  })
                }
                type="button"
              >
                アクション追加
              </button>
            </div>
            {error ? (
              <p className="fieldError" role="alert">
                {error}
              </p>
            ) : null}
            <div className="dialogActions">
              <button className="secondaryButton" onClick={requestCloseButtonEdit} type="button">
                キャンセル
              </button>
              <button className="primaryButton" onClick={() => void saveButton()} type="button">
                保存
              </button>
            </div>
          </section>
        </div>
      ) : null}
      <ConfirmDialog
        {...(confirmation ?? { title: "", confirmLabel: "確定", onConfirm: () => undefined })}
        onCancel={() => setConfirmation(null)}
        open={Boolean(confirmation)}
      />
    </>
  );
}
