import type {
  Dispatch,
  KeyboardEvent,
  MutableRefObject,
  PointerEvent,
  SetStateAction,
} from "react";
import { PROJECT_CARD_COMPACT_LIMIT } from "../app/constants";
import { TODAY_ITEM_LIMIT } from "../constants";
import type {
  ContextMenuTarget,
  InboxDragPreview,
  ProjectDragPreview,
} from "../app/dashboardTypes";
import { toggleDisclosureFromBar } from "../app/helpers";
import { resolveProjectColorId } from "../projectIdentity";
import { SOURCE_LOCK_REASON, sourceLockedByUnfinishedToday } from "../sourceEdit";
import type { TodayCandidate } from "../todayCandidates";
import type { AppConfig, LauncherProject } from "../types";
import type { NextStepEditorOptions } from "./CompletionNextStepDialog";
import { ProjectIdentity } from "./ProjectIdentity";
import { SectionCollapse } from "./SectionCollapse";
import { UiIcon } from "./UiIcon";

// V164-A3: the 「次の一手」 band, moved out of App.tsx (same DOM, text and handlers).

export type NextStepsSectionProps = {
  actions: {
    addCandidateToToday: (candidate: TodayCandidate, insertionIndex?: number) => Promise<boolean>;
    cancelProjectPointerDrag: () => void;
    clearProjectNextStep: (project: LauncherProject) => void;
    finishProjectPointerDrag: (event: PointerEvent<HTMLElement>) => void;
    handleRowShortcutKey: (
      event: KeyboardEvent<HTMLElement>,
      handlers: { activate?: () => void; edit?: () => void; remove?: () => void },
    ) => boolean;
    markNextStepReviewed: (projectId: string) => Promise<unknown>;
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
    openImportDialog: (
      text: string,
      error?: string | null,
      opener?: HTMLElement | null,
    ) => void;
    openNextStepEditor: (project: LauncherProject, options?: NextStepEditorOptions) => void;
    openProjectAddDialog: () => void;
    setProjectsListExpanded: Dispatch<SetStateAction<boolean>>;
    setProjectsOpen: Dispatch<SetStateAction<boolean>>;
    sourceEditBlockReason: (key: string, allowTodaySourceSync?: boolean) => string | null;
    sourceEditBlocked: (key: string, allowTodaySourceSync?: boolean) => boolean;
    startProjectPointerDrag: (event: PointerEvent<HTMLElement>, projectId: string) => void;
    startProjectShort: (project: LauncherProject) => void;
    todayCandidateSelected: (candidate: TodayCandidate) => boolean;
    updateProjectPointerDrag: (event: PointerEvent<HTMLElement>) => void;
  };
  config: AppConfig;
  drag: {
    inboxPointerDrag: InboxDragPreview | null;
    projectPointerDrag: ProjectDragPreview | null;
  };
  dragActive: boolean;
  nextStepReviewBusy: string | null;
  projectListAnchorRef: MutableRefObject<{ id: string; index: number } | null>;
  projectsListExpanded: boolean;
  projectsOpen: boolean;
  rawTodayBuilderCandidates: TodayCandidate[];
  staleNextStepMap: Map<string, number>;
  visibleProjects: LauncherProject[];
};

export function NextStepsSection({
  actions,
  config,
  drag,
  dragActive,
  nextStepReviewBusy,
  projectListAnchorRef,
  projectsListExpanded,
  projectsOpen,
  rawTodayBuilderCandidates,
  staleNextStepMap,
  visibleProjects,
}: NextStepsSectionProps) {
  const {
    addCandidateToToday,
    cancelProjectPointerDrag,
    clearProjectNextStep,
    finishProjectPointerDrag,
    handleRowShortcutKey,
    markNextStepReviewed,
    openContextMenu,
    openContextMenuFromKeyboard,
    openImportDialog,
    openNextStepEditor,
    openProjectAddDialog,
    setProjectsListExpanded,
    setProjectsOpen,
    sourceEditBlockReason,
    sourceEditBlocked,
    startProjectPointerDrag,
    startProjectShort,
    todayCandidateSelected,
    updateProjectPointerDrag,
  } = actions;
  const { inboxPointerDrag, projectPointerDrag } = drag;
  void SOURCE_LOCK_REASON;
  void sourceLockedByUnfinishedToday;
  return (
<section
  className={[
    "projectsBand",
    inboxPointerDrag?.nextStepEligible ? "sourceReturnBand--target" : "",
    inboxPointerDrag?.nextStepTargetProjectId ? "sourceReturnBand--active" : "",
  ]
    .filter(Boolean)
    .join(" ")}
  onContextMenu={(event) => {
    event.preventDefault();
    openContextMenu(
      { kind: "projects" },
      event.clientX,
      event.clientY,
      event.currentTarget,
    );
  }}
  tabIndex={-1}
>
  <div
    className="disclosureHeader"
    onClick={(event) =>
      toggleDisclosureFromBar(event, () => setProjectsOpen((open) => !open))
    }
    onContextMenu={(event) => {
      event.preventDefault();
      openContextMenu(
        { kind: "projects" },
        event.clientX,
        event.clientY,
        event.currentTarget,
      );
    }}
    tabIndex={-1}
  >
    <button
      aria-expanded={projectsOpen}
      className="disclosure"
      onClick={() => setProjectsOpen((open) => !open)}
      type="button"
    >
      <UiIcon name={projectsOpen ? "chevronDown" : "chevronRight"} size={16} />
      <span className="disclosureLabel">
        <strong>次の一手</strong>
      </span>
    </button>
    <span className="disclosureCount">{config.projects.length}件</span>
    <span className="disclosureDescription">
      迷ったときに戻る再開地点。プロジェクトごとに1つだけ設定。
    </span>
    <div className="disclosureHeaderActions">
      <button
        className="sectionGhostButton mainActionButton mainActionButton--neutral"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openImportDialog("", null, event.currentTarget);
        }}
        title="ChatGPTやClaudeに作ってもらった内容を、まとめて足します"
        type="button"
      >
        ＋ まとめて取り込む
      </button>
      <button
        aria-label="プロジェクトを追加"
        className="uiSmallButton sectionAddButton sectionAddButton--barHitTarget nextStepHeaderAdd nextStepHeaderAdd--project mainActionButton mainActionButton--neutral"
        onPointerDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation();
          openProjectAddDialog();
        }}
        title="プロジェクトを追加"
        type="button"
      >
        ＋ プロジェクト
      </button>
      <button
        aria-label="次の一手の操作"
        aria-haspopup="menu"
        className="sectionMenuButton"
        onClick={(event) => {
          event.stopPropagation();
          const rect = event.currentTarget.getBoundingClientRect();
          openContextMenu(
            { kind: "projects" },
            rect.left,
            rect.bottom,
            event.currentTarget,
          );
        }}
        onPointerDown={(event) => event.stopPropagation()}
        title="次の一手の操作"
        type="button"
      >
        <span aria-hidden="true">…</span>
      </button>
    </div>
  </div>
  {inboxPointerDrag?.nextStepEligible && (
    <div
      className={
        inboxPointerDrag.nextStepTargetProjectId
          ? "sourceReturnDropZone sourceReturnDropZone--active"
          : "sourceReturnDropZone"
      }
    >
      <span className="dropHintLabel">
        <span aria-hidden="true">↓</span>
        <span>ここにドロップして次の一手を設定する</span>
      </span>
    </div>
  )}
  <SectionCollapse open={projectsOpen} dragActive={dragActive}>
    <div
      className={
        config.projects.length === 0
          ? "nextStepBody nextStepBody--empty"
          : "nextStepBody"
      }
    >
      {config.projects.length === 0 && (
        <div className="sectionEmptyState">
          <div className="sectionEmptyStateContent">
            <strong>プロジェクトを設定しましょう</strong>
            <span>取り組みたいことをまとめると、次の一手を決められます</span>
            <button
              className="mainActionButton mainActionButton--gold"
              onClick={openProjectAddDialog}
              type="button"
            >
              <UiIcon name="add" size={16} />
              プロジェクトを設定
            </button>
          </div>
        </div>
      )}
      <div className="projectGrid">
        {visibleProjects.map((project) => {
          const projectSourceKey = `project:${project.id}`;
          const placeholderActionable =
            !project.nextStep?.text.trim() && !sourceEditBlocked(projectSourceKey);
          const sourceLocked = Boolean(
            project.nextStep &&
            sourceLockedByUnfinishedToday(config, projectSourceKey),
          );
          const todayCandidate = rawTodayBuilderCandidates.find(
            (candidate) => candidate.sourceKey === projectSourceKey,
          );
          const alreadySelected = Boolean(
            todayCandidate && todayCandidateSelected(todayCandidate),
          );
          return (
            <article
              className={[
                "nextStepRow sourceListRow",
                "nextStepCard",
                projectPointerDrag?.id === project.id
                  ? "nextStepRow--dragging"
                  : "",
                inboxPointerDrag?.nextStepTargetProjectId === project.id
                  ? "nextStepCard--dropTarget"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              data-project-color={resolveProjectColorId(
                project.id,
                project.colorId,
              )}
              data-project-id={project.id}
              key={project.id}
              onContextMenu={(event) => {
                event.preventDefault();
                openContextMenu(
                  { kind: "nextStep", project },
                  event.clientX,
                  event.clientY,
                  event.currentTarget,
                );
              }}
              onFocus={() => {
                const index = config.projects.findIndex(
                  (item) => item.id === project.id,
                );
                projectListAnchorRef.current = { id: project.id, index };
              }}
              onBlur={(event) => {
                if (!(event.relatedTarget instanceof Node) ||
                    !event.currentTarget.contains(event.relatedTarget)) {
                  projectListAnchorRef.current = null;
                }
              }}
              onKeyDown={(event) => {
                if (
                  handleRowShortcutKey(event, {
                    activate: () => startProjectShort(project),
                    edit: () => openNextStepEditor(project),
                    remove: () => clearProjectNextStep(project),
                  })
                )
                  return;
                openContextMenuFromKeyboard(event, { kind: "nextStep", project });
              }}
              onPointerCancel={cancelProjectPointerDrag}
              onPointerDown={(event) => startProjectPointerDrag(event, project.id)}
              onPointerMove={updateProjectPointerDrag}
              onPointerUp={finishProjectPointerDrag}
              tabIndex={0}
            >
              {/* P10-14 (§4.4): one horizontal row: Project / action text / actions. */}
              <div
                className="nextStepProjectRegion"
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openContextMenu(
                    { kind: "nextStep", project },
                    event.clientX,
                    event.clientY,
                    event.currentTarget,
                  );
                }}
                onKeyDown={(event) =>
                  openContextMenuFromKeyboard(event, { kind: "nextStep", project })
                }
                tabIndex={0}
              >
                <h3>
                  <ProjectIdentity
                    compact
                    colorId={project.colorId}
                    name={project.name}
                    projectId={project.id}
                  />
                </h3>
              </div>
              <div
                className="nextStepActionRegion"
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  openContextMenu(
                    { kind: "nextStep", project },
                    event.clientX,
                    event.clientY,
                    event.currentTarget,
                  );
                }}
                onKeyDown={(event) =>
                  openContextMenuFromKeyboard(event, { kind: "nextStep", project })
                }
                tabIndex={0}
              >
                <div className="nextStepTextRegion">
                  <p
                    className={
                      project.nextStep?.text.trim()
                        ? ""
                        : placeholderActionable
                          ? "projectNextStepPlaceholder projectNextStepPlaceholder--action"
                          : "projectNextStepPlaceholder"
                    }
                    onClick={
                      placeholderActionable
                        ? (event) => {
                            event.stopPropagation();
                            openNextStepEditor(project);
                          }
                        : undefined
                    }
                    onPointerDown={
                      placeholderActionable
                        ? (event) => event.stopPropagation()
                        : undefined
                    }
                    title={
                      project.nextStep?.text.trim() || "まだ次の一手がありません"
                    }
                  >
                    {project.nextStep?.trigger?.trim() && (
                      <span className="projectNextStepTrigger">
                        {project.nextStep.trigger.trim()} ▸{" "}
                      </span>
                    )}
                    {project.nextStep?.text.trim() || "まだ次の一手がありません"}
                  </p>
                  {staleNextStepMap.has(project.id) && (
                    <div className="nextStepFreshness">
                      <span>
                        {staleNextStepMap.get(project.id)}日同じ一手です。大きすぎるかもしれません
                      </span>
                      <span className="nextStepFreshnessActions">
                        <button
                          className="uiSmallButton nextStepFreshnessButton"
                          onClick={() => openNextStepEditor(project, { mode: "edit" })}
                          onPointerDown={(event) => event.stopPropagation()}
                          type="button"
                        >
                          小さくする
                        </button>
                        <button
                          className="uiSmallButton nextStepFreshnessButton"
                          disabled={nextStepReviewBusy === project.id}
                          onClick={() => void markNextStepReviewed(project.id)}
                          onPointerDown={(event) => event.stopPropagation()}
                          type="button"
                        >
                          このまま
                        </button>
                      </span>
                    </div>
                  )}
                </div>
                <div className="nextStepRowMeta">
                  {sourceLocked && (
                    <span
                      aria-label="今日の3件で使用中のためロック中"
                      className="sourceLockBadge"
                      tabIndex={0}
                      title={SOURCE_LOCK_REASON}
                    >
                      <UiIcon name="lock" size={16} />
                    </span>
                  )}
                  {alreadySelected && (
                    <span className="uiPill uiPill--good nextStepTodayStatus">✓ 今日の3件</span>
                  )}
                  {project.nextStep?.text.trim() ? (
                    !sourceLocked && (
                      <div className="nextStepCardActions">
                        <button
                          className="uiSmallButton nextStepRowAction nextStepRowAction--change mainActionButton mainActionButton--neutral"
                          disabled={sourceEditBlocked(projectSourceKey)}
                          onClick={(event) => {
                            event.stopPropagation();
                            openNextStepEditor(project);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          title={sourceEditBlockReason(projectSourceKey) ?? undefined}
                          type="button"
                        >
                          編集
                        </button>
                        <button
                          className="nextStepTodayAdd mainActionButton mainActionButton--neutral"
                          disabled={
                            !todayCandidate ||
                            alreadySelected ||
                            config.today.items.length >= TODAY_ITEM_LIMIT
                          }
                          onClick={(event) => {
                            event.stopPropagation();
                            if (todayCandidate)
                              void addCandidateToToday(todayCandidate);
                          }}
                          onPointerDown={(event) => event.stopPropagation()}
                          title={
                            alreadySelected
                              ? "今日の3件にあります"
                              : config.today.items.length >= TODAY_ITEM_LIMIT
                                ? "今日の3件は3件埋まっています"
                                : "今日の3件に追加"
                          }
                          type="button"
                        >
                          ＋ 今日へ
                        </button>
                      </div>
                    )
                  ) : (
                    <button
                      className="uiSmallButton nextStepRowAction nextStepRowAction--set mainActionButton mainActionButton--neutral"
                      disabled={sourceEditBlocked(projectSourceKey)}
                      onClick={(event) => {
                        event.stopPropagation();
                        openNextStepEditor(project);
                      }}
                      onPointerDown={(event) => event.stopPropagation()}
                      title={sourceEditBlockReason(projectSourceKey) ?? undefined}
                      type="button"
                    >
                      次の一手を設定
                    </button>
                  )}
                </div>
                <span aria-hidden="true" className="uiKey rowKeyHint">
                  Enter
                </span>
                <button
                  aria-label={`${project.name}の次の一手の操作`}
                  aria-haspopup="menu"
                  className="sourceRowMenu nextStepRegionMenu"
                  onClick={(event) => {
                    event.stopPropagation();
                    const rect = event.currentTarget.getBoundingClientRect();
                    openContextMenu(
                      { kind: "nextStep", project },
                      rect.left,
                      rect.bottom,
                      event.currentTarget,
                    );
                  }}
                  onPointerDown={(event) => event.stopPropagation()}
                  title="次の一手の操作"
                  type="button"
                >
                  <span aria-hidden="true">…</span>
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {config.projects.length > PROJECT_CARD_COMPACT_LIMIT && (
        <div className="sourceListControls nextStepCardControls">
          <button
            className="mainActionButton mainActionButton--neutral"
            onClick={() => {
              projectListAnchorRef.current = null;
              setProjectsListExpanded((expanded) => !expanded);
            }}
            type="button"
          >
            {projectsListExpanded
              ? "− 折りたたむ"
              : `＋ 残り${config.projects.length - PROJECT_CARD_COMPACT_LIMIT}件を表示`}
          </button>
        </div>
      )}
      {projectPointerDrag?.targetIndicator && (
        <div
          aria-hidden="true"
          className="projectDropIndicator"
          style={projectPointerDrag.targetIndicator}
        />
      )}
      {projectPointerDrag?.todayTargetIndicator && (
        <div
          aria-hidden="true"
          className="todayDropIndicator"
          style={projectPointerDrag.todayTargetIndicator}
        />
      )}
      {projectPointerDrag && (
        <div
          aria-hidden="true"
          className={
            projectPointerDrag.todayTargetIndex !== undefined
              ? "projectDragGhost projectDragGhost--today"
              : "projectDragGhost"
          }
          style={{
            left: projectPointerDrag.pointerX - projectPointerDrag.offsetX,
            top: projectPointerDrag.pointerY - projectPointerDrag.offsetY,
            width: Math.min(300, projectPointerDrag.width),
          }}
        >
          {(() => {
            const project = config.projects.find(
              (item) => item.id === projectPointerDrag.id,
            );
            return project ? (
              <>
                <ProjectIdentity
                  colorId={project.colorId}
                  compact
                  name={project.name}
                  projectId={project.id}
                />
                <strong>{project.nextStep?.text || "次の一手を書く"}</strong>
              </>
            ) : null;
          })()}
        </div>
      )}
    </div>
  </SectionCollapse>
</section>
  );
}
