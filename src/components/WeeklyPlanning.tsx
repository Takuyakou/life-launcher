import type { LauncherProject, AppConfig, WeeklyReviewResponse } from "../types";
import { buildWeeklyPrompt } from "../content/weeklyPrompt";
import {
  formatDuration,
  formatWeekRange,
  weeklyCompletedItems,
  weeklyProjectFacts,
} from "../weeklyPlanning";
import { resolveProjectColorId } from "../projectIdentity";
import { CopyButton } from "./CopyButton";
import { UiIcon } from "./UiIcon";

type WeeklyPlanningProps = {
  config: AppConfig;
  weeklyReview: WeeklyReviewResponse | null;
  staleNextStepProjects: LauncherProject[];
  staleNextStepDays: Map<string, number>;
  reviewingProjectId?: string | null;
  onWeeklyFocusChange: (projectId: string, checked: boolean) => void;
  onRewriteNextStep: (project: LauncherProject) => void;
  onMarkReviewed: (projectId: string) => void;
  onOpenImport: () => void;
  onDone: () => void;
  onCopyError: () => void;
};

const COMPLETED_LIMIT = 8;

export function WeeklyPlanning({
  config,
  weeklyReview,
  staleNextStepProjects,
  staleNextStepDays,
  reviewingProjectId = null,
  onWeeklyFocusChange,
  onRewriteNextStep,
  onMarkReviewed,
  onOpenImport,
  onDone,
  onCopyError,
}: WeeklyPlanningProps) {
  const projects = weeklyProjectFacts(config, weeklyReview);
  const completed = weeklyCompletedItems(config, weeklyReview);
  const visibleCompleted = completed.slice(0, COMPLETED_LIMIT);
  const focusProjects = config.projects.filter((project) => project.weeklyFocus === true);
  const stale = staleNextStepProjects.map((project) => ({
    project,
    days: staleNextStepDays.get(project.id) ?? 0,
  }));
  const weekRange = weeklyReview
    ? formatWeekRange(weeklyReview.previousWeekStart, weeklyReview.previousWeekEnd)
    : null;

  const copyPrompt = async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard API is not available");
      await navigator.clipboard.writeText(buildWeeklyPrompt(config, weeklyReview, stale));
    } catch (error) {
      onCopyError();
      throw error;
    }
  };

  return (
    <div className="weeklyPlanning">
      <div className="weeklyPlanningIntro">
        <h2 className="weeklyPlanningTitle">今週を決める</h2>
        <p>先週の事実を見て、今週に力を入れるものを3つまで選びます。評価や点数は付けません。</p>
      </div>

      <div className="weeklyPlanningColumns">
        <div className="weeklyPlanningColumn weeklyPlanningFacts">
          <div className="weeklyPlanningSection">
            <h3 className="weeklyPlanningKicker">
              先週の事実{weekRange ? ` ― ${weekRange}` : ""}
            </h3>
            <div className="weeklyPlanningStats">
              <div>
                <span>合計</span>
                <strong>{formatDuration(weeklyReview?.totalMinutes ?? 0)}</strong>
              </div>
              <div>
                <span>動いた日</span>
                <strong>{weeklyReview?.activeDays ?? 0}日</strong>
              </div>
              <div>
                <span>始めた回数</span>
                <strong>
                  {weeklyReview?.projects.reduce((sum, project) => sum + project.sessionCount, 0) ??
                    0}
                  回
                </strong>
              </div>
            </div>
          </div>

          <div className="weeklyPlanningProjectList">
            {projects.length === 0 ? (
              <p className="weeklyPlanningEmpty">先週の実行記録はありません。</p>
            ) : (
              projects.map((project) => (
                <div
                  className="weeklyPlanningProjectRow"
                  data-project-color={
                    project.project
                      ? resolveProjectColorId(project.project.id, project.project.colorId)
                      : undefined
                  }
                  key={project.key}
                >
                  <span
                    aria-hidden="true"
                    className={
                      project.project
                        ? "weeklyPlanningDot"
                        : "weeklyPlanningDot weeklyPlanningDot--missing"
                    }
                  />
                  <span className="weeklyPlanningProjectName" title={project.label}>
                    {project.label}
                  </span>
                  <span className="weeklyPlanningProjectCount">{project.sessionCount}回</span>
                  <span className="weeklyPlanningProjectMinutes">
                    {formatDuration(project.totalMinutes)}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="weeklyPlanningCompleted">
            <h3 className="weeklyPlanningKicker">完了にした項目 {completed.length}件</h3>
            {completed.length === 0 ? (
              <p className="weeklyPlanningEmpty">先週、完了にした項目はありません。</p>
            ) : (
              <ul>
                {visibleCompleted.map((item) => (
                  <li key={item.id}>
                    <UiIcon name="check" size={16} />
                    <span title={item.textSnapshot}>{item.textSnapshot}</span>
                  </li>
                ))}
                {completed.length > COMPLETED_LIMIT && (
                  <li className="weeklyPlanningMore">ほか {completed.length - COMPLETED_LIMIT}件</li>
                )}
              </ul>
            )}
          </div>
        </div>

        <div className="weeklyPlanningColumn weeklyPlanningPlan">
          <section className="weeklyPlanningFocus" aria-labelledby="weekly-focus-title">
            <div className="weeklyPlanningFocusHead">
              <h3 id="weekly-focus-title">今週の重点</h3>
              <span>{focusProjects.length} / 3</span>
            </div>
            {config.projects.length === 0 ? (
              <p className="weeklyPlanningEmpty">プロジェクトがありません。</p>
            ) : (
              <div className="weeklyPlanningFocusButtons">
                {config.projects.map((project) => (
                  <button
                    aria-pressed={project.weeklyFocus === true}
                    className="weeklyPlanningFocusButton"
                    data-project-color={resolveProjectColorId(project.id, project.colorId)}
                    key={project.id}
                    onClick={() => onWeeklyFocusChange(project.id, project.weeklyFocus !== true)}
                    type="button"
                  >
                    <span aria-hidden="true" className="weeklyPlanningDot" />
                    {project.name}
                  </button>
                ))}
              </div>
            )}
          </section>

          {stale.length > 0 && (
            <section className="weeklyPlanningStale" aria-labelledby="weekly-stale-title">
              <h3 id="weekly-stale-title">しばらく動いていないもの</h3>
              <div className="weeklyPlanningStaleList">
                {stale.map(({ project, days }) => (
                  <div
                    className="weeklyPlanningStaleRow"
                    data-project-color={resolveProjectColorId(project.id, project.colorId)}
                    key={project.id}
                  >
                    <span aria-hidden="true" className="weeklyPlanningDot" />
                    <div className="weeklyPlanningStaleCopy">
                      <strong>{project.name}</strong>
                      <span>
                        「{project.nextStep?.text ?? ""}」のまま{days}日
                      </span>
                    </div>
                    <div className="weeklyPlanningStaleActions">
                      <button
                        className="uiSmallButton"
                        onClick={() => onRewriteNextStep(project)}
                        type="button"
                      >
                        小さくする
                      </button>
                      <button
                        className="uiSmallButton"
                        disabled={reviewingProjectId === project.id}
                        onClick={() => onMarkReviewed(project.id)}
                        type="button"
                      >
                        このまま
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          <section aria-label="AIと相談する" className="weeklyPlanningAi">
            <div className="weeklyPlanningAiIntro">
              <h3>AIと相談して、今週の一手を足す</h3>
              <p>
                コピーされるのは、プロジェクト(名前・色・目標)・次の一手・やりたいこと・今週の重点・先週の時間と完了した項目だけです。アプリから外へは何も送りません。
              </p>
            </div>
            <div className="weeklyPlanningAiStep">
              <span aria-hidden="true" className="weeklyPlanningStepNumber">
                1
              </span>
              <CopyButton label="先週の事実を付けてコピー" onCopy={copyPrompt} />
            </div>
            <div className="weeklyPlanningAiStep">
              <span aria-hidden="true" className="weeklyPlanningStepNumber">
                2
              </span>
              <p>ChatGPT か Claude に貼って、返事の JSON をコピーする</p>
            </div>
            <div className="weeklyPlanningAiStep">
              <span aria-hidden="true" className="weeklyPlanningStepNumber">
                3
              </span>
              <button
                className="weeklyPlanningImportButton"
                onClick={onOpenImport}
                type="button"
              >
                貼り付けて、足す内容を確かめる
              </button>
            </div>
          </section>

          <div className="weeklyPlanningDone">
            <button className="primaryButton" onClick={onDone} type="button">
              この重点で決定
            </button>
            <span>重点のプロジェクトは「今やる一手」で先に出ます</span>
          </div>
        </div>
      </div>
    </div>
  );
}
