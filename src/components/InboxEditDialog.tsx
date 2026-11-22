import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { AppConfig, LauncherButton, OverlayPage } from "../types";
import type { InstructionChoice } from "../app/dashboardTypes";
import { InstructionPicker } from "../InstructionPicker";
import { StartEnvironmentPicker } from "../StartEnvironmentPicker";
import { ProjectIdentity } from "./ProjectIdentity";

// V163-A2: the Wishlist edit dialog, moved out of App.tsx (same DOM, text and handlers).

export type InboxEditDialogProps = {
  config: AppConfig;
  inboxEditDraft: string;
  inboxEditProjectId: string;
  inboxEditButtonIds: string[];
  inboxEditInstructionPath: string;
  inboxEditInstructionOpenOnStart: boolean;
  instructionChoices: InstructionChoice[];
  instructionChoicesError: string | null;
  instructionChoicesLoading: boolean;
  overlayPages: OverlayPage[];
  projectSelectableButtons: LauncherButton[];
  renderButtonIcon: (button: LauncherButton, className: string) => ReactNode;
  setInboxEditDraft: Dispatch<SetStateAction<string>>;
  setInboxEditProjectId: Dispatch<SetStateAction<string>>;
  setInboxEditButtonIds: Dispatch<SetStateAction<string[]>>;
  setInboxEditInstructionPath: Dispatch<SetStateAction<string>>;
  setInboxEditInstructionOpenOnStart: Dispatch<SetStateAction<boolean>>;
  refreshInstructionChoices: () => void;
  closeInboxEditDialog: (afterSuccessfulSave?: boolean) => void;
  commitInboxEdit: () => void;
  sourceEditSaving: boolean;
};

export function InboxEditDialog(props: InboxEditDialogProps) {
  const {
    closeInboxEditDialog,
    commitInboxEdit,
    config,
    inboxEditButtonIds,
    inboxEditDraft,
    inboxEditInstructionOpenOnStart,
    inboxEditInstructionPath,
    inboxEditProjectId,
    instructionChoices,
    instructionChoicesError,
    instructionChoicesLoading,
    overlayPages,
    projectSelectableButtons,
    refreshInstructionChoices,
    renderButtonIcon,
    setInboxEditButtonIds,
    setInboxEditDraft,
    setInboxEditInstructionOpenOnStart,
    setInboxEditInstructionPath,
    setInboxEditProjectId,
    sourceEditSaving,
  } = props;

  return (
    <div className="modalBackdrop" role="presentation">
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label="やりたいこと編集"
        aria-modal="true"
        className="dropDialog inboxEditDialog"
        role="dialog"
        tabIndex={-1}
      >
        <div>
          <p className="eyebrow">Wishlist</p>
          <h2>やりたいことを編集</h2>
        </div>

        <label className="fieldStack">
          <span>やりたいこと</span>
          <input
            autoFocus
            className="textInput"
            maxLength={120}
            onChange={(event) => setInboxEditDraft(event.target.value)}
            value={inboxEditDraft}
          />
        </label>

        <fieldset className="inboxProjectChoices">
          <legend>プロジェクト</legend>
          <label>
            <input
              checked={!inboxEditProjectId}
              name="inbox-project"
              onChange={() => setInboxEditProjectId("")}
              type="radio"
            />
            <span>プロジェクトなし</span>
          </label>
          {config.projects.map((project) => (
            <label key={project.id}>
              <input
                checked={inboxEditProjectId === project.id}
                name="inbox-project"
                onChange={() => setInboxEditProjectId(project.id)}
                type="radio"
              />
              <ProjectIdentity
                colorId={project.colorId}
                compact
                name={project.name}
                projectId={project.id}
              />
            </label>
          ))}
        </fieldset>

        <h3 className="formSectionHeading">開始環境</h3>
        <p className="formSectionDescription">
          一緒に使う道具や、開始時に確認する手順を設定します。
        </p>
        <StartEnvironmentPicker
          buttons={projectSelectableButtons}
          onChange={setInboxEditButtonIds}
          overlayPages={overlayPages}
          renderIcon={renderButtonIcon}
          selectedIds={inboxEditButtonIds}
        />
        <InstructionPicker
          choices={instructionChoices}
          error={instructionChoicesError}
          loading={instructionChoicesLoading}
          onChange={(instructionPath) => {
            setInboxEditInstructionPath(instructionPath);
            setInboxEditInstructionOpenOnStart(
              instructionPath
                ? inboxEditInstructionPath
                  ? inboxEditInstructionOpenOnStart
                  : true
                : false,
            );
          }}
          onRetry={() => void refreshInstructionChoices()}
          selectedPath={inboxEditInstructionPath}
        />
        <label className="projectWeeklyFocusToggle projectInstructionStartToggle">
          <input
            checked={inboxEditInstructionOpenOnStart}
            disabled={!inboxEditInstructionPath}
            onChange={(event) => setInboxEditInstructionOpenOnStart(event.target.checked)}
            type="checkbox"
          />
          <span>開始時に手順書を開く</span>
        </label>
        <div className="dialogActions formDialogActions">
          <button
            className="primaryButton"
            disabled={!inboxEditDraft.trim() || sourceEditSaving}
            onClick={commitInboxEdit}
            type="button"
          >
            保存
          </button>
          <button
            className="secondaryButton dialogCancelButton"
            onClick={() => closeInboxEditDialog()}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}
