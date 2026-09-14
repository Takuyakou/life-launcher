import { useState, type KeyboardEvent } from "react";
import { ProjectIdentity } from "./components/ProjectIdentity";
import { UiIcon } from "./components/UiIcon";
import type {
  AppConfig,
  LauncherProject,
  NotesHistoryResponse,
  SessionEntryRow,
  SessionEntriesResponse,
  SessionSummaryResponse,
  WeeklyReviewProjectSummary,
  WeeklyReviewResponse,
} from "./types";

type RecordsTab = "review" | "planning" | "all";
type RecordsDateScope = "today" | "week" | "all";
type WeeklyReviewDisplayProject = {
  summary: WeeklyReviewProjectSummary;
  project?: LauncherProject;
};

type RecordsViewProps = {
  config: AppConfig;
  sessionSummary: SessionSummaryResponse | null;
  weeklyReview: WeeklyReviewResponse | null;
  weeklyReviewProjects: WeeklyReviewDisplayProject[];
  staleNextStepProjects: LauncherProject[];
  filteredSessions: SessionEntriesResponse | null;
  weekSessions: SessionEntryRow[];
  allSessions: SessionEntryRow[];
  notesHistory: NotesHistoryResponse | null;
  sessionSearch: string;
  sessionProjectFilter: string;
  sessionDateScope: RecordsDateScope;
  onBack: () => void;
  onSearchChange: (value: string) => void;
  onProjectFilterChange: (value: string) => void;
  onDateScopeChange: (value: RecordsDateScope) => void;
  onWeeklyFocusChange: (projectId: string, checked: boolean) => void;
  onEditProject: (project: LauncherProject) => void;
  onTryShort: (project: LauncherProject) => void;
  onMarkReviewed: (projectId: string) => void;
  onAddSession: () => void;
  onOpenSessionMenu: (session: SessionEntryRow, x: number, y: number, opener: HTMLElement) => void;
  onHistoryNoteChange: (date: string, index: number, value: string) => void;
  onHistoryNoteBlur: (date: string) => void;
};

const HISTORY_PAGE_SIZE = 5;

function projectRowKey(projectId: string | null | undefined, label: string) {
  return projectId || `label:${label}`;
}

function sessionsForProject(
  sessions: SessionEntryRow[],
  projectId: string | null | undefined,
  label: string,
) {
  return sessions.filter((session) =>
    projectId ? session.projectId === projectId : !session.projectId && session.label === label,
  );
}

function actionSnapshot(session: SessionEntryRow) {
  return session.note.trim() || "実行内容の記録なし";
}

function threeNotes(items: string[]) {
  return Array.from({ length: 3 }, (_, index) => items[index] ?? "");
}

export function RecordsView({
  config,
  sessionSummary,
  weeklyReview,
  weeklyReviewProjects,
  staleNextStepProjects,
  filteredSessions,
  weekSessions,
  allSessions,
  notesHistory,
  sessionSearch,
  sessionProjectFilter,
  sessionDateScope,
  onBack,
  onSearchChange,
  onProjectFilterChange,
  onDateScopeChange,
  onWeeklyFocusChange,
  onEditProject,
  onTryShort,
  onMarkReviewed,
  onAddSession,
  onOpenSessionMenu,
  onHistoryNoteChange,
  onHistoryNoteBlur,
}: RecordsViewProps) {
  const [tab, setTab] = useState<RecordsTab>("review");
  const [weeklyExpanded, setWeeklyExpanded] = useState<Record<string, boolean>>({});
  const [cumulativeExpanded, setCumulativeExpanded] = useState<Record<string, boolean>>({});
  const [cumulativePages, setCumulativePages] = useState<Record<string, number>>({});

  const openKeyboardMenu = (event: KeyboardEvent<HTMLElement>, session: SessionEntryRow) => {
    if (event.key !== "ContextMenu" && !(event.shiftKey && event.key === "F10")) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    onOpenSessionMenu(session, rect.left, rect.bottom + 4, event.currentTarget);
  };

  return (
    <section className="recordsView" data-skip-target="records" tabIndex={-1}>
      <header className="recordsViewHeader">
        <button className="recordsBackButton" onClick={onBack} type="button">
          <UiIcon name="back" size={16} />
          メイン
        </button>
        <nav aria-label="記録の表示" className="recordsTabs" role="tablist">
          {([
            ["review", "ふりかえり"],
            ["planning", "今週を決める"],
            ["all", "すべての記録"],
          ] as const).map(([key, label]) => (
            <button
              aria-selected={tab === key}
              className={tab === key ? "recordsTab recordsTab--active" : "recordsTab"}
              key={key}
              onClick={() => setTab(key)}
              role="tab"
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
      </header>

      {tab === "review" && (
        <div className="recordsTabPanel" role="tabpanel">
          <div className="recordsStats">
            <div><span>今日</span><strong>{sessionSummary?.todayMinutes ?? 0}分</strong></div>
            <div><span>今週</span><strong>{sessionSummary?.weekMinutes ?? 0}分</strong></div>
            <div><span>活動日数</span><strong>{sessionSummary?.activeDays ?? 0}日</strong></div>
          </div>

          <section className="recordsSection">
            <div className="sectionHeading">
              <h2>プロジェクト別（今週）</h2>
              <span>{sessionSummary?.date ?? config.today.date}</span>
            </div>
            {sessionSummary?.projects.length ? (
              <div className="recordsAccordionList">
                {sessionSummary.projects.map((project) => {
                  const key = projectRowKey(project.projectId, project.label);
                  const expanded = weeklyExpanded[key] === true;
                  const sessions = sessionsForProject(weekSessions, project.projectId, project.label);
                  const source = project.projectId
                    ? config.projects.find((item) => item.id === project.projectId)
                    : undefined;
                  return (
                    <article className="recordsAccordion" key={key}>
                      <button
                        aria-expanded={expanded}
                        className="recordsAccordionSummary"
                        onClick={() => setWeeklyExpanded((current) => ({ ...current, [key]: !expanded }))}
                        type="button"
                      >
                        <UiIcon name={expanded ? "chevronDown" : "chevronRight"} size={16} />
                        {project.projectId ? (
                          <ProjectIdentity colorId={source?.colorId} name={project.label} projectId={project.projectId} />
                        ) : <span>{project.label}</span>}
                        <strong>{project.totalMinutes}分</strong>
                      </button>
                      {expanded && (
                        <div className="recordsAccordionBody">
                          {sessions.length ? sessions.map((session) => (
                            <div className="recordsActionHistoryRow" key={session.rowKey}>
                              <time>{session.date}</time>
                              <span title={actionSnapshot(session)}>{actionSnapshot(session)}</span>
                              <strong>{session.minutes}分</strong>
                            </div>
                          )) : <p className="quietText quietText--small">該当する実行記録はありません。</p>}
                          <footer><span>{sessions.length}回</span><strong>合計 {project.totalMinutes}分</strong></footer>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : <p className="quietText">今週の実行記録はありません。</p>}
          </section>

          <section className="recordsSection">
            <div className="sectionHeading"><h2>プロジェクト別累計</h2><span>すべての記録</span></div>
            {sessionSummary?.allTimeProjects.length ? (
              <div className="recordsAccordionList">
                {sessionSummary.allTimeProjects.map((project) => {
                  const key = projectRowKey(project.projectId, project.label);
                  const expanded = cumulativeExpanded[key] === true;
                  const sessions = sessionsForProject(allSessions, project.projectId, project.label);
                  const pageCount = Math.max(1, Math.ceil(sessions.length / HISTORY_PAGE_SIZE));
                  const page = Math.min(cumulativePages[key] ?? 1, pageCount);
                  const pageSessions = sessions.slice((page - 1) * HISTORY_PAGE_SIZE, page * HISTORY_PAGE_SIZE);
                  const source = project.projectId
                    ? config.projects.find((item) => item.id === project.projectId)
                    : undefined;
                  return (
                    <article className="recordsAccordion" key={key}>
                      <button
                        aria-expanded={expanded}
                        className="recordsAccordionSummary"
                        onClick={() => setCumulativeExpanded((current) => ({ ...current, [key]: !expanded }))}
                        type="button"
                      >
                        <UiIcon name={expanded ? "chevronDown" : "chevronRight"} size={16} />
                        {project.projectId ? (
                          <ProjectIdentity colorId={source?.colorId} name={project.label} projectId={project.projectId} />
                        ) : <span>{project.label}</span>}
                        <span>{project.activeDays}日</span>
                        <strong>{project.totalMinutes}分</strong>
                      </button>
                      {expanded && (
                        <div className="recordsAccordionBody">
                          {pageSessions.length ? pageSessions.map((session) => (
                            <div className="recordsActionHistoryRow" key={session.rowKey}>
                              <time>{session.date}</time>
                              <span title={actionSnapshot(session)}>{actionSnapshot(session)}</span>
                              <strong>{session.minutes}分</strong>
                            </div>
                          )) : <p className="quietText quietText--small">該当する実行記録はありません。</p>}
                          {sessions.length > HISTORY_PAGE_SIZE && (
                            <nav aria-label={`${project.label}の履歴ページ`} className="recordsPagination">
                              <button disabled={page <= 1} onClick={() => setCumulativePages((current) => ({ ...current, [key]: page - 1 }))} type="button">‹ 前へ</button>
                              {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                                <button aria-current={page === number ? "page" : undefined} key={number} onClick={() => setCumulativePages((current) => ({ ...current, [key]: number }))} type="button">{number}</button>
                              ))}
                              <button disabled={page >= pageCount} onClick={() => setCumulativePages((current) => ({ ...current, [key]: page + 1 }))} type="button">次へ ›</button>
                            </nav>
                          )}
                          <footer>
                            <span>新しい順 / {sessions.length ? `${(page - 1) * HISTORY_PAGE_SIZE + 1}–${Math.min(page * HISTORY_PAGE_SIZE, sessions.length)}件を表示` : "0件"}</span>
                            <strong>合計 {project.totalMinutes}分</strong>
                          </footer>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            ) : <p className="quietText">実行記録はまだありません。</p>}
          </section>

          {config.sourceCompletions.length > 0 && (
            <section className="recordsSection sourceCompletionSection">
              <div className="sectionHeading">
                <div className="recordsInlineHeading"><h2>完了した項目</h2><span>今後の候補から外した、完了済みの項目</span></div>
                <span>{config.sourceCompletions.length}件</span>
              </div>
              <div className="sourceCompletionList">
                {[...config.sourceCompletions].reverse().map((completion) => (
                  <div className="sourceCompletionRow" key={completion.id}>
                    <div className="sourceCompletionMeta">
                      <span>{completion.completedAt.slice(0, 10)}</span>
                      <span>{completion.sourceType === "nextStep" ? "次の一手" : "やりたいこと"}</span>
                      {completion.projectNameSnapshot && <span>{completion.projectNameSnapshot}</span>}
                    </div>
                    <strong>{completion.textSnapshot}</strong>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "planning" && (
        <div className="recordsTabPanel" role="tabpanel">
          <section className="weeklyReviewSection" aria-labelledby="weekly-review-title">
            <div className="sectionHeading">
              <div><h2 id="weekly-review-title">先週のふりかえり</h2>{weeklyReview && <span>{weeklyReview.previousWeekStart} - {weeklyReview.previousWeekEnd}</span>}</div>
            </div>
            <div className="weeklyReviewFacts">
              <div><span>合計時間</span><strong>{weeklyReview?.totalMinutes ?? 0}分</strong></div>
              <div><span>活動日数</span><strong>{weeklyReview?.activeDays ?? 0}日</strong></div>
              <div><span>動かしたプロジェクト</span><strong>{weeklyReviewProjects.length}件</strong></div>
            </div>
            <div className="weeklyReviewBlock">
              <div className="recordsInlineHeading"><h3>動かしたプロジェクト</h3><span>先週の実行記録に残ったプロジェクト</span></div>
              {weeklyReviewProjects.length ? (
                <div className="weeklyReviewProjectList">
                  {weeklyReviewProjects.map(({ summary, project }) => (
                    <div className="weeklyReviewProjectRow" key={summary.projectId ?? `label:${summary.label}`}>
                      <div>
                        {project ? <ProjectIdentity colorId={project.colorId} name={project.name} projectId={project.id} /> : <strong>{summary.label}</strong>}
                        {project?.northStar && <span className="weeklyReviewNorthStar">目標: {project.northStar}</span>}
                      </div>
                      <span>{summary.sessionCount}回・{summary.totalMinutes}分</span>
                    </div>
                  ))}
                </div>
              ) : <p className="quietText">先週の実行記録はありません。</p>}
            </div>
            <div className="weeklyReviewBlock">
              <div className="weeklyReviewBlockHeading">
                <div className="recordsInlineHeading"><h3>今週の重点</h3><span>今週優先して進めるプロジェクトを最大3件まで選びます</span></div>
                <span>{config.projects.filter((project) => project.weeklyFocus === true).length}/3</span>
              </div>
              <div className="weeklyFocusChecklist">
                {config.projects.map((project) => (
                  <label key={project.id}>
                    <input checked={project.weeklyFocus === true} onChange={(event) => onWeeklyFocusChange(project.id, event.target.checked)} type="checkbox" />
                    <ProjectIdentity colorId={project.colorId} name={project.name} projectId={project.id} />
                  </label>
                ))}
              </div>
            </div>
            {staleNextStepProjects.length > 0 && (
              <div className="weeklyReviewBlock freshnessReview" aria-labelledby="freshness-title">
                <div className="recordsInlineHeading"><h3 id="freshness-title">鮮度レビュー</h3><span>次の一手を14日以上更新・確認していないプロジェクト</span></div>
                <div className="freshnessReviewList">
                  {staleNextStepProjects.map((project) => (
                    <div className="freshnessReviewRow" key={project.id}>
                      <div className="freshnessReviewCopy">
                        <ProjectIdentity colorId={project.colorId} name={project.name} projectId={project.id} />
                        <strong>{project.nextStep?.text}</strong><span>次の一手が14日以上同じです</span>
                      </div>
                      <div className="freshnessReviewActions">
                        <button onClick={() => onEditProject(project)} type="button">書き直す</button>
                        <button onClick={() => onTryShort(project)} type="button">短時間で試す</button>
                        <button onClick={() => onMarkReviewed(project.id)} type="button">このまま</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {tab === "all" && (
        <div className="recordsTabPanel" role="tabpanel">
          <section className="recordsSection">
            <div className="sectionHeading">
              <h2>最近の実行記録</h2>
              <button className="sectionLinkButton" onClick={onAddSession} type="button">実行記録を追加</button>
            </div>
            <div className="recordsFilters">
              <input aria-label="実行記録を検索" className="textInput" onChange={(event) => onSearchChange(event.target.value)} placeholder="検索" value={sessionSearch} />
              <div className="filterGroup" aria-label="期間">
                <span>期間</span><div className="segmentRow">
                  {([ ["week", "今週"], ["today", "今日"], ["all", "すべて"] ] as const).map(([value, label]) => (
                    <button className={sessionDateScope === value ? "segmentButton segmentButton--active" : "segmentButton"} key={value} onClick={() => onDateScopeChange(value)} type="button">{label}</button>
                  ))}
                </div>
              </div>
              <div className="filterGroup" aria-label="プロジェクト">
                <span>プロジェクト</span><div className="projectFilterRow">
                  <button className={sessionProjectFilter ? "filterChip" : "filterChip filterChip--active"} onClick={() => onProjectFilterChange("")} type="button">すべて</button>
                  {config.projects.map((project) => (
                    <button className={sessionProjectFilter === project.id ? "filterChip filterChip--active" : "filterChip"} key={project.id} onClick={() => onProjectFilterChange(project.id)} type="button">{project.name}</button>
                  ))}
                </div>
              </div>
            </div>
            {filteredSessions?.entries.length ? (
              <div className="recentSessionList recordsCompactList">
                {filteredSessions.entries.map((session) => (
                  <article
                    className="recentSessionRow recordsCompactRow"
                    key={session.rowKey}
                    onContextMenu={(event) => { event.preventDefault(); onOpenSessionMenu(session, event.clientX, event.clientY, event.currentTarget); }}
                    onKeyDown={(event) => openKeyboardMenu(event, session)}
                    tabIndex={0}
                  >
                    <time>{session.date}</time><span>{session.startedAt}</span>
                    {session.projectId ? (
                      <ProjectIdentity colorId={config.projects.find((item) => item.id === session.projectId)?.colorId} compact name={session.label} projectId={session.projectId} />
                    ) : <strong>{session.label}</strong>}
                    <span className="recordsCompactAction" title={actionSnapshot(session)}>{actionSnapshot(session)}</span>
                    <strong>{session.minutes}分</strong>
                    <button aria-label={`${session.date} ${session.label}の操作`} className="sourceRowMenu recordsSessionMenuButton" onClick={(event) => { const rect = event.currentTarget.getBoundingClientRect(); onOpenSessionMenu(session, rect.left, rect.bottom, event.currentTarget); }} type="button">⋯</button>
                  </article>
                ))}
              </div>
            ) : <p className="quietText">条件に一致する実行記録がありません。検索語またはフィルターを変更してください。</p>}
          </section>

          <details className="recordsSection recordsOlderNotes">
            <summary>以前のメモ</summary>
            {notesHistory?.entries.length ? (
              <div className="notesHistoryList">
                {notesHistory.entries.map((entry) => (
                  <div className="notesHistoryDay" key={entry.date}>
                    <strong>{entry.date}</strong>
                    <div className="notesList">
                      {threeNotes(entry.items).map((item, index) => (
                        <input aria-label={`${entry.date} できたこと ${index + 1}`} className="textInput" key={index} maxLength={120} onBlur={() => onHistoryNoteBlur(entry.date)} onChange={(event) => onHistoryNoteChange(entry.date, index, event.target.value)} value={item} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : <p className="quietText">以前のメモはありません。</p>}
          </details>
        </div>
      )}
    </section>
  );
}
