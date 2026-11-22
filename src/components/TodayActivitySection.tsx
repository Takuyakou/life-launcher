import { toggleDisclosureFromBar } from "../app/helpers";
import type { LauncherProject, SessionEntryRow } from "../types";
import { ProjectIdentity } from "./ProjectIdentity";
import { SectionCollapse } from "./SectionCollapse";
import { UiIcon } from "./UiIcon";

type TodayActivitySectionProps = {
  open: boolean;
  onToggle: () => void;
  count: number;
  entries: SessionEntryRow[];
  projects: LauncherProject[];
  dragActive: boolean;
};

/** Collapsible section displaying automatically recorded timer sessions for today. */
export function TodayActivitySection({
  open,
  onToggle,
  count,
  entries,
  projects,
  dragActive,
}: TodayActivitySectionProps) {
  return (
    <section className="todayActivityBand">
      <div
        className="disclosureHeader"
        onClick={(event) => toggleDisclosureFromBar(event, onToggle)}
      >
        <button
          aria-expanded={open}
          className="disclosure"
          onClick={onToggle}
          type="button"
        >
          <UiIcon name={open ? "chevronDown" : "chevronRight"} size={16} />
          <span className="disclosureLabel">
            <strong>今日の実行</strong>
          </span>
        </button>
        <span className="disclosureCount">{count}件</span>
        <span className="disclosureDescription">タイマーで実行した内容</span>
        <span className="uiPill uiPill--good todayActivityAutoBadge">自動</span>
      </div>

      <SectionCollapse open={open} dragActive={dragActive}>
        <div className="todayActivityBody">
          {count > 0 ? (
            <div className="todayActivityList">
              {entries.map((session) => {
                const project = session.projectId
                  ? projects.find((item) => item.id === session.projectId)
                  : undefined;
                return (
                  <div className="todayActivityRow" key={session.rowKey}>
                    <div className="todayActivityIdentity">
                      {project ? (
                        <ProjectIdentity
                          colorId={project.colorId}
                          compact
                          name={session.label || project.name}
                          projectId={project.id}
                        />
                      ) : (
                        <>
                          <span aria-hidden="true" className="todayActivityDot" />
                          <span>{session.label || "記録"}</span>
                        </>
                      )}
                    </div>
                    <span className="todayActivityStartedAt">{session.startedAt}</span>
                    <strong>{session.minutes}分</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="quietText">今日はまだ実行記録がありません。</p>
          )}
        </div>
      </SectionCollapse>
    </section>
  );
}
