import type { Dispatch, SetStateAction } from "react";
import type { AppConfig, LauncherProject } from "../types";
import type { ProjectEditDraft } from "../app/dashboardTypes";
import { PROJECT_COLOR_IDS, PROJECT_COLOR_LABELS } from "../projectIdentity";
import { UiIcon } from "./UiIcon";
import type { ExitPresenceAttributes } from "./ExitPresence";

// V163-A2: the Project edit dialog, moved out of App.tsx (same DOM, text and handlers).

export type ProjectEditDialogProps = {
  config: AppConfig;
  projectEditDraft: ProjectEditDraft;
  projectEditSaving: boolean;
  setProjectEditDraft: Dispatch<SetStateAction<ProjectEditDraft | null>>;
  setProjectWeeklyFocus: (checked: boolean) => void;
  closeProjectEditDialog: (afterSuccessfulSave?: boolean) => void;
  requestProjectDeletion: (project: LauncherProject) => void;
  saveProjectEdit: () => void;
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
};

export function ProjectEditDialog(props: ProjectEditDialogProps) {
  const {
    closeProjectEditDialog,
    config,
    projectEditDraft,
    projectEditSaving,
    requestProjectDeletion,
    saveProjectEdit,
    setProjectEditDraft,
    setProjectWeeklyFocus,
    exitProps,
  } = props;

  return (
    <div className="modalBackdrop" role="presentation" {...exitProps}>
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label={projectEditDraft.isNew ? "プロジェクトを追加" : "プロジェクトを編集"}
        aria-modal="true"
        className="dropDialog editDialog modalLongForm app-scrollbar"
        role="dialog"
        tabIndex={-1}
      >
        <div className="modalTitleRow">
          <div>
            <p className="eyebrow">Project</p>
            <h2>{projectEditDraft.isNew ? "プロジェクトを追加" : "プロジェクトを編集"}</h2>
            {projectEditDraft.isNew && (
              <p className="dialogLead">継続して進めるテーマを登録します。</p>
            )}
          </div>
          <button
            aria-label={`${projectEditDraft.isNew ? "プロジェクトを追加" : "プロジェクトを編集"}を閉じる`}
            className="iconButton"
            disabled={projectEditSaving}
            onClick={() => closeProjectEditDialog()}
            title="閉じる"
            type="button"
          >
            <UiIcon name="close" size={16} />
          </button>
        </div>

        <h3 className="formSectionHeading">基本</h3>
        <label className="fieldStack">
          <span>プロジェクト名</span>
          <input autoComplete="off"
            autoFocus={projectEditDraft.isNew}
            className="textInput"
            maxLength={48}
            onChange={(event) =>
              setProjectEditDraft({ ...projectEditDraft, name: event.target.value })
            }
            value={projectEditDraft.name}
          />
        </label>

        <label className="fieldStack">
          <span>目標（任意）</span>
          <input autoComplete="off"
            className="textInput"
            maxLength={60}
            onChange={(event) =>
              setProjectEditDraft({ ...projectEditDraft, northStar: event.target.value })
            }
            placeholder="EPを1枚完成させる"
            value={projectEditDraft.northStar}
          />
          <small className="fieldHint">このプロジェクトで実現したい目標を1行で書きます。</small>
        </label>

        <label className="projectWeeklyFocusToggle">
          <input
            checked={projectEditDraft.weeklyFocus}
            onChange={(event) => setProjectWeeklyFocus(event.target.checked)}
            type="checkbox"
          />
          <span>今週の重点にする</span>
        </label>

        <h3 className="formSectionHeading">見た目</h3>
        <div className="fieldStack">
          <span>プロジェクトカラー</span>
          <div
            aria-label="プロジェクトカラー"
            className="projectColorPalette"
            role="radiogroup"
          >
            {PROJECT_COLOR_IDS.map((colorId) => (
              <button
                aria-checked={projectEditDraft.colorId === colorId}
                aria-label={PROJECT_COLOR_LABELS[colorId]}
                className={
                  projectEditDraft.colorId === colorId
                    ? "projectColorSwatch projectColorSwatch--selected"
                    : "projectColorSwatch"
                }
                data-project-color={colorId}
                key={colorId}
                onClick={() => setProjectEditDraft({ ...projectEditDraft, colorId })}
                role="radio"
                title={PROJECT_COLOR_LABELS[colorId]}
                type="button"
              >
                <span aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>

        {!projectEditDraft.isNew && (
          <section className="projectDangerZone" aria-labelledby="project-danger-zone-title">
            <h3 id="project-danger-zone-title">危険な操作</h3>
            <p>
              このプロジェクトと、現在登録されている関連項目を削除します。過去の実行記録は残ります。
            </p>
            <button
              className="dangerButton projectDeleteButton"
              disabled={projectEditSaving}
              onClick={() => {
                const project = config.projects.find(
                  (candidate) => candidate.id === projectEditDraft.id,
                );
                if (project) requestProjectDeletion(project);
              }}
              type="button"
            >
              プロジェクトを削除…
            </button>
          </section>
        )}

        <div className="dialogActions formDialogActions">
          <button
            className="primaryButton"
            disabled={!projectEditDraft.name.trim() || projectEditSaving}
            onClick={saveProjectEdit}
            type="button"
          >
            {projectEditSaving
              ? "保存しています…"
              : projectEditDraft.isNew
                ? "プロジェクトを追加"
                : "保存"}
          </button>
          <button
            className="secondaryButton dialogCancelButton"
            disabled={projectEditSaving}
            onClick={() => closeProjectEditDialog()}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}
