import type { ManualSessionDraft, SessionEditDraft } from "../app/dashboardTypes";
import { resolveProjectColorId } from "../projectIdentity";
import type { LauncherProject } from "../types";
import { ProjectIdentity } from "./ProjectIdentity";
import type { ExitPresenceAttributes } from "./ExitPresence";

function SessionProjectField({
  projects,
  projectsById,
  projectId,
  fallbackName,
  onSelectProject,
}: {
  projects: LauncherProject[];
  projectsById: Map<string, LauncherProject>;
  projectId: string | null;
  fallbackName: string;
  onSelectProject: (value: string) => void;
}) {
  const selectedProject = projectId ? projectsById.get(projectId) : undefined;

  return (
    <>
      <label className="fieldStack">
        <span>プロジェクト</span>
        <select
          className="textInput"
          onChange={(event) => onSelectProject(event.target.value)}
          value={projectId ?? ""}
        >
          <option value="">未分類</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.name}
            </option>
          ))}
        </select>
      </label>
      {projectId && selectedProject && (
        <div
          className="sessionProjectIdentity"
          data-project-color={resolveProjectColorId(projectId, selectedProject.colorId)}
        >
          <ProjectIdentity
            colorId={selectedProject.colorId}
            name={selectedProject.name || fallbackName}
            projectId={projectId}
          />
        </div>
      )}
    </>
  );
}

type ManualSessionDialogProps = {
  draft: ManualSessionDraft;
  projects: LauncherProject[];
  projectsById: Map<string, LauncherProject>;
  onDraftChange: (next: ManualSessionDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
};

/** Modal dialog for manually adding a session record. */
export function ManualSessionDialog({
  draft,
  projects,
  projectsById,
  onDraftChange,
  onSave,
  onCancel,
  exitProps,
}: ManualSessionDialogProps) {
  return (
    <div className="modalBackdrop" role="presentation" {...exitProps}>
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label="実行記録を追加"
        aria-modal="true"
        className="dropDialog modalLongForm"
        role="dialog"
        tabIndex={-1}
      >
        <div>
          <p className="eyebrow">Session</p>
          <h2>実行記録を追加</h2>
        </div>

        <SessionProjectField
          fallbackName=""
          onSelectProject={(value) =>
            onDraftChange({
              ...draft,
              projectId: value || null,
            })
          }
          projectId={draft.projectId}
          projects={projects}
          projectsById={projectsById}
        />

        <div className="editGrid">
          <label className="fieldStack">
            <span>日付</span>
            <input autoComplete="off"
              className="textInput"
              onChange={(event) => onDraftChange({ ...draft, date: event.target.value })}
              type="date"
              value={draft.date}
            />
          </label>
          <label className="fieldStack">
            <span>開始時刻</span>
            <input autoComplete="off"
              className="textInput"
              onChange={(event) =>
                onDraftChange({
                  ...draft,
                  startedAt: event.target.value,
                })
              }
              step={60}
              type="time"
              value={draft.startedAt}
            />
          </label>
          <label className="fieldStack">
            <span>分数</span>
            <input autoComplete="off"
              className="textInput"
              min={1}
              onChange={(event) => onDraftChange({ ...draft, minutes: event.target.value })}
              type="number"
              value={draft.minutes}
            />
          </label>
        </div>

        <label className="fieldStack">
          <span>実行内容</span>
          <input autoComplete="off"
            className="textInput"
            onChange={(event) => onDraftChange({ ...draft, note: event.target.value })}
            value={draft.note}
          />
        </label>

        <div className="dialogActions formDialogActions">
          <button className="primaryButton" onClick={onSave} type="button">
            追加
          </button>
          <button
            className="secondaryButton dialogCancelButton"
            onClick={onCancel}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}

type SessionEditDialogProps = {
  draft: SessionEditDraft;
  projects: LauncherProject[];
  projectsById: Map<string, LauncherProject>;
  onDraftChange: (next: SessionEditDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  /** V164 (E1): attributes for the close motion; the backdrop is removed when it ends. */
  exitProps?: ExitPresenceAttributes;
};

/** Modal dialog for editing an existing session record. */
export function SessionEditDialog({
  draft,
  projects,
  projectsById,
  onDraftChange,
  onSave,
  onCancel,
  exitProps,
}: SessionEditDialogProps) {
  return (
    <div className="modalBackdrop" role="presentation" {...exitProps}>
      <div aria-hidden="true" className="modalDragBand" data-tauri-drag-region="" />
      <section
        aria-label="実行記録を編集"
        aria-modal="true"
        className="dropDialog editDialog"
        role="dialog"
        tabIndex={-1}
      >
        <div>
          <p className="eyebrow">Session</p>
          <h2>実行記録を編集</h2>
        </div>

        <SessionProjectField
          fallbackName={draft.label}
          onSelectProject={(value) => {
            const project = projects.find((item) => item.id === value);
            onDraftChange({
              ...draft,
              projectId: project?.id ?? null,
              label: project?.name ?? draft.label,
            });
          }}
          projectId={draft.projectId}
          projects={projects}
          projectsById={projectsById}
        />

        <label className="fieldStack">
          <span>ラベル</span>
          <input autoComplete="off"
            className="textInput"
            maxLength={80}
            onChange={(event) => onDraftChange({ ...draft, label: event.target.value })}
            value={draft.label}
          />
        </label>

        <div className="editGrid">
          <label className="fieldStack">
            <span>日付</span>
            <input autoComplete="off"
              className="textInput"
              onChange={(event) => onDraftChange({ ...draft, date: event.target.value })}
              type="date"
              value={draft.date}
            />
          </label>
          <label className="fieldStack">
            <span>開始</span>
            <input autoComplete="off"
              className="textInput"
              maxLength={16}
              onChange={(event) => onDraftChange({ ...draft, startedAt: event.target.value })}
              value={draft.startedAt}
            />
          </label>
          <label className="fieldStack">
            <span>分数</span>
            <input autoComplete="off"
              className="textInput"
              min={1}
              onChange={(event) => onDraftChange({ ...draft, minutes: event.target.value })}
              type="number"
              value={draft.minutes}
            />
          </label>
        </div>

        <label className="fieldStack">
          <span>実行内容</span>
          <input autoComplete="off"
            className="textInput"
            onChange={(event) => onDraftChange({ ...draft, note: event.target.value })}
            value={draft.note}
          />
        </label>

        <div className="dialogActions formDialogActions">
          <button className="primaryButton" onClick={onSave} type="button">
            保存
          </button>
          <button
            className="secondaryButton dialogCancelButton"
            onClick={onCancel}
            type="button"
          >
            キャンセル
          </button>
        </div>
      </section>
    </div>
  );
}
