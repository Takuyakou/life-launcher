import type { Dispatch, SetStateAction } from "react";
import type { OverlayPage } from "../types";
import type { DropDialogState } from "../app/dashboardTypes";
import { actionDescription } from "../app/helpers";
import { DEFAULT_BUTTON_GROUP } from "../constants";
import { GroupModeField } from "./GroupModeField";
import { UiIcon } from "./UiIcon";

// V163-A3: the Drop Register / Button Builder dialog, moved out of App.tsx
// (same DOM, text and handlers).

export type BuilderKind = "file" | "folder" | "url";

export type DropRegisterDialogProps = {
  builderBusy: boolean;
  builderKind: BuilderKind | null;
  builderSource: string;
  dropDraft: DropDialogState;
  groupNames: string[];
  overlayPages: OverlayPage[];
  setBuilderKind: Dispatch<SetStateAction<BuilderKind | null>>;
  setBuilderLabelTouched: Dispatch<SetStateAction<boolean>>;
  setBuilderModeDrafts: Dispatch<
    SetStateAction<
      Partial<Record<BuilderKind, { source: string; label: string; labelTouched: boolean }>>
    >
  >;
  setDropDraft: Dispatch<SetStateAction<DropDialogState | null>>;
  confirmDropRegistration: () => void;
  pickBuilderSource: () => void;
  switchBuilderKind: (kind: BuilderKind) => void;
  updateBuilderSource: (source: string) => void;
};

export function DropRegisterDialog(props: DropRegisterDialogProps) {
  const {
    builderBusy,
    builderKind,
    builderSource,
    confirmDropRegistration,
    dropDraft,
    groupNames,
    overlayPages,
    pickBuilderSource,
    setBuilderKind,
    setBuilderLabelTouched,
    setBuilderModeDrafts,
    setDropDraft,
    switchBuilderKind,
    updateBuilderSource,
  } = props;

  return (
    <div className="modalBackdrop" role="presentation">
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label={builderKind ? "Button Builder" : "ボタン登録"}
        aria-modal="true"
        className="dropDialog modalLongForm"
        role="dialog"
        tabIndex={-1}
      >
        <div>
          <p className="eyebrow">{builderKind ? "Button Builder" : "Drop Register"}</p>
          <h2>ボタンを追加</h2>
        </div>

        {builderKind && (
          <div className="builderSourceFields">
            <span>追加元</span>
            <div className="builderSourceModes" role="group" aria-label="追加元">
              {(["file", "folder", "url"] as const).map((kind) => (
                <button
                  aria-pressed={builderKind === kind}
                  className={
                    builderKind === kind
                      ? "builderSourceMode builderSourceMode--active"
                      : "builderSourceMode"
                  }
                  key={kind}
                  onClick={() => switchBuilderKind(kind)}
                  type="button"
                >
                  <UiIcon
                    name={kind === "file" ? "fileText" : kind === "folder" ? "folder" : "external"}
                    size={16}
                  />
                  {kind === "file" ? "ファイル" : kind === "folder" ? "フォルダ" : "URL"}
                </button>
              ))}
            </div>
            <div className="fieldStack">
              <label htmlFor="builder-source-input">
                {builderKind === "file" ? "ファイル" : builderKind === "folder" ? "フォルダ" : "URL"}
              </label>
              <div className="builderSourceInputRow">
                <input autoComplete="off"
                  className="textInput"
                  id="builder-source-input"
                  onChange={(event) => updateBuilderSource(event.target.value)}
                  placeholder={builderKind === "url" ? "https://example.com/" : "パスを入力"}
                  value={builderSource}
                />
                {builderKind !== "url" && (
                  <button
                    className="secondaryButton"
                    onClick={() => void pickBuilderSource()}
                    type="button"
                  >
                    参照...
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <label className="fieldStack">
          <span>ラベル</span>
          <input autoComplete="off"
            className="textInput"
            onChange={(event) => {
              if (builderKind) setBuilderLabelTouched(true);
              setDropDraft({ ...dropDraft, label: event.target.value });
            }}
            value={dropDraft.label}
          />
          <small>ファイル名・フォルダ名・URLから自動入力します。必要なら変更できます。</small>
        </label>

        <GroupModeField
          existingGroup={dropDraft.existingGroup}
          groupMode={dropDraft.groupMode}
          groups={groupNames}
          newGroup={dropDraft.newGroup}
          onExistingGroupChange={(existingGroup) =>
            setDropDraft({ ...dropDraft, existingGroup })
          }
          onGroupModeChange={(groupMode) =>
            setDropDraft({
              ...dropDraft,
              groupMode,
              existingGroup: dropDraft.existingGroup || groupNames[0] || DEFAULT_BUTTON_GROUP,
            })
          }
          onNewGroupChange={(newGroup) => setDropDraft({ ...dropDraft, newGroup })}
        />

        <div className="fieldStack">
          <span>表示先</span>
          <div className="displayTargetList">
            <label className="displayTargetItem">
              <input
                checked={dropDraft.showInSidebar}
                onChange={(event) =>
                  setDropDraft({ ...dropDraft, showInSidebar: event.target.checked })
                }
                type="checkbox"
              />
              <span>
                <strong>左サイドバーに表示</strong>
                <small>Quickからすぐ開く項目に向いています</small>
              </span>
            </label>
            <label className="displayTargetItem">
              <input
                checked={dropDraft.showInOverlay}
                onChange={(event) =>
                  setDropDraft({ ...dropDraft, showInOverlay: event.target.checked })
                }
                type="checkbox"
              />
              <span>
                <strong>Ctrl+K辞書に表示</strong>
                <small>検索して開く項目に向いています</small>
              </span>
            </label>
          </div>
        </div>

        {!dropDraft.showInSidebar && !dropDraft.showInOverlay && (
          <p className="visibilityWarning">
            サイドバーにも辞書にも表示されません。設定ファイル上には残ります。
          </p>
        )}

        {dropDraft.showInOverlay && (
          <label className="fieldStack">
            <span>辞書ページ</span>
            <select
              className="textInput"
              onChange={(event) =>
                setDropDraft({
                  ...dropDraft,
                  overlayPageId: event.target.value || null,
                })
              }
              value={
                overlayPages.some((page) => page.id === dropDraft.overlayPageId)
                  ? (dropDraft.overlayPageId ?? "")
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
          </label>
        )}

        <div className="fieldStack">
          <span>登録先</span>
          <p className="dropSource">
            <UiIcon
              name={
                (builderKind ? builderKind === "url" : dropDraft.action.type === "open_url")
                  ? "external"
                  : (builderKind ? builderKind === "folder" : dropDraft.action.type === "open_folder")
                    ? "folder"
                    : "fileText"
              }
              size={16}
            />
            <span>
              {builderKind ? builderSource || "未選択" : actionDescription(dropDraft.action)}
            </span>
          </p>
        </div>

        {builderKind && (
          <div className="builderPreview" aria-label="サイドバーのプレビュー">
            <small>Sidebar Preview</small>
            <div className="builderPreviewItem">
              <UiIcon
                name={builderKind === "file" ? "fileText" : builderKind === "folder" ? "folder" : "external"}
                size={20}
              />
              <span>{dropDraft.label || "名称未設定"}</span>
            </div>
          </div>
        )}

        <div className="dialogActions dropRegisterActions">
          <button
            className="primaryButton"
            disabled={builderBusy}
            onClick={() => void confirmDropRegistration()}
            type="button"
          >
            追加
          </button>
          <button
            className="dangerButton"
            onClick={() => {
              setDropDraft(null);
              setBuilderKind(null);
              setBuilderModeDrafts({});
            }}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}
