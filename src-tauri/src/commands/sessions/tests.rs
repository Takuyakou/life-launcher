use super::*;
use crate::models::TodayItem;

fn candidate_project(id: &str, weekly_focus: Option<bool>, step: Option<&str>) -> Project {
    let mut project = crate::models::sample_config().projects.remove(0);
    project.id = id.to_string();
    project.name = id.to_string();
    project.weekly_focus = weekly_focus;
    if let Some(text) = step {
        project.next_step.as_mut().expect("next step").text = text.to_string();
    } else {
        project.next_step = None;
    }
    project
}

fn no_today() -> Today {
    let mut today = crate::models::sample_config().today;
    today.date = "2026-07-16".to_string();
    today.items.clear();
    today
}

fn today_with(items: Vec<TodayItem>) -> Today {
    let mut today = no_today();
    today.items = items;
    today
}

fn today_item(source_key: &str, generation: Option<&str>, done: bool) -> TodayItem {
    let mut item = crate::models::sample_config().today.items.remove(0);
    item.done = done;
    item.source_key = Some(source_key.to_string());
    item.source_generation_id = generation.map(str::to_string);
    item
}

fn project_with_generation(
    id: &str,
    weekly_focus: Option<bool>,
    generation: Option<&str>,
) -> Project {
    let mut project = candidate_project(id, weekly_focus, Some(&format!("{id} step")));
    project.next_step.as_mut().expect("next step").generation_id = generation.map(str::to_string);
    project
}

fn candidate_order(candidates: &[DoNowCandidate]) -> Vec<&str> {
    candidates
        .iter()
        .map(|candidate| candidate.project_id.as_str())
        .collect()
}

#[test]
fn do_now_candidates_put_the_project_in_today3_first_even_against_focus_and_today_sessions() {
    let projects = vec![
        project_with_generation("focus", Some(true), Some("g-focus")),
        project_with_generation("adopted", Some(false), Some("g1")),
    ];
    // "adopted" is not a weekly focus and already ran today, yet its Next Step is in Today3.
    let entries = vec![candidate_session("adopted", "2026-07-16", "09:00")];
    let today = today_with(vec![today_item("project:adopted", Some("g1"), false)]);

    let candidates = build_do_now_candidates(&projects, &entries, &today, "2026-07-16");

    assert_eq!(candidate_order(&candidates), vec!["adopted", "focus"]);
    assert_eq!(candidates[0].reason, "today3");
    assert_eq!(candidates[1].reason, "noToday");
    // Not a filter: the other Project stays selectable.
    assert_eq!(candidates.len(), 2);
}

#[test]
fn do_now_candidates_ignore_today3_items_that_are_not_the_current_unfinished_next_step() {
    let projects = vec![
        project_with_generation("focus", Some(true), Some("g-focus")),
        project_with_generation("target", Some(false), Some("g1")),
    ];
    let cases = [
        (
            "finished item",
            today_item("project:target", Some("g1"), true),
        ),
        (
            "different generation",
            today_item("project:target", Some("g0"), false),
        ),
        (
            "item has no generation",
            today_item("project:target", None, false),
        ),
        (
            "manual item",
            today_item("manual:target", Some("g1"), false),
        ),
        (
            "wishlist item",
            today_item("wishlist:target", Some("g1"), false),
        ),
    ];
    for (name, item) in cases {
        let candidates =
            build_do_now_candidates(&projects, &[], &today_with(vec![item]), "2026-07-16");
        assert_eq!(
            candidate_order(&candidates),
            vec!["focus", "target"],
            "{name}"
        );
        assert!(
            candidates
                .iter()
                .all(|candidate| candidate.reason != "today3"),
            "{name}"
        );
    }

    // Only the Next Step has a generation, or only the item has one: no match.
    let only_project = vec![
        project_with_generation("focus", Some(true), None),
        project_with_generation("target", Some(false), Some("g1")),
    ];
    let candidates = build_do_now_candidates(
        &only_project,
        &[],
        &today_with(vec![today_item("project:target", None, false)]),
        "2026-07-16",
    );
    assert_eq!(candidate_order(&candidates), vec!["focus", "target"]);
}

#[test]
fn do_now_candidates_treat_missing_generation_on_both_sides_as_a_match() {
    let projects = vec![
        project_with_generation("focus", Some(true), None),
        project_with_generation("legacy", Some(false), None),
    ];
    let today = today_with(vec![today_item("project:legacy", None, false)]);

    let candidates = build_do_now_candidates(&projects, &[], &today, "2026-07-16");

    assert_eq!(candidate_order(&candidates), vec!["legacy", "focus"]);
    assert_eq!(candidates[0].reason, "today3");
}

#[test]
fn do_now_candidates_ignore_a_today_state_from_another_day() {
    let projects = vec![
        project_with_generation("focus", Some(true), Some("g-focus")),
        project_with_generation("adopted", Some(false), Some("g1")),
    ];
    let mut today = today_with(vec![today_item("project:adopted", Some("g1"), false)]);
    today.date = "2026-07-15".to_string();

    let candidates = build_do_now_candidates(&projects, &[], &today, "2026-07-16");

    assert_eq!(candidate_order(&candidates), vec!["focus", "adopted"]);
    assert!(candidates
        .iter()
        .all(|candidate| candidate.reason != "today3"));
}

#[test]
fn do_now_candidates_keep_the_existing_order_among_several_today3_projects() {
    let projects = vec![
        project_with_generation("plain", Some(false), Some("g-plain")),
        project_with_generation("focus", Some(true), Some("g-focus")),
        project_with_generation("outside", Some(true), Some("g-outside")),
    ];
    let today = today_with(vec![
        today_item("project:plain", Some("g-plain"), false),
        today_item("project:focus", Some("g-focus"), false),
    ]);

    let candidates = build_do_now_candidates(&projects, &[], &today, "2026-07-16");

    // Today3 group first, in Today3's left-to-right order (P10-04 / D27); the rest follow.
    assert_eq!(
        candidate_order(&candidates),
        vec!["plain", "focus", "outside"]
    );
    assert_eq!(candidates[0].reason, "today3");
    assert_eq!(candidates[1].reason, "today3");
    assert_ne!(candidates[2].reason, "today3");
}

#[test]
fn do_now_candidates_match_the_old_order_when_today3_is_empty_or_all_finished() {
    let projects = vec![
        project_with_generation("a", Some(false), Some("ga")),
        project_with_generation("b", Some(true), Some("gb")),
        project_with_generation("c", None, Some("gc")),
    ];
    let entries = vec![candidate_session("b", "2026-07-16", "09:00")];
    let old = build_do_now_candidates(&projects, &entries, &no_today(), "2026-07-16");
    let finished = today_with(vec![
        today_item("project:a", Some("ga"), true),
        today_item("project:b", Some("gb"), true),
        today_item("project:c", Some("gc"), true),
    ]);
    let all_finished = build_do_now_candidates(&projects, &entries, &finished, "2026-07-16");

    assert_eq!(candidate_order(&all_finished), candidate_order(&old));
    assert_eq!(
        all_finished
            .iter()
            .map(|c| c.reason.as_str())
            .collect::<Vec<_>>(),
        old.iter().map(|c| c.reason.as_str()).collect::<Vec<_>>()
    );
}

#[test]
fn p10_04_today3_position_orders_candidates_by_the_card_order() {
    let projects = vec![
        project_with_generation("a", None, Some("ga")),
        project_with_generation("b", None, Some("gb")),
        project_with_generation("c", None, Some("gc")),
    ];
    let today = today_with(vec![
        today_item("project:b", Some("gb"), false),
        today_item("project:a", Some("ga"), false),
    ]);

    let candidates = build_do_now_candidates(&projects, &[], &today, "2026-07-16");

    assert_eq!(candidate_order(&candidates), vec!["b", "a", "c"]);
    assert_eq!(candidates[0].reason, "today3");
    assert_eq!(candidates[1].reason, "today3");
    assert_ne!(candidates[2].reason, "today3");
}

#[test]
fn p10_04_finished_today3_cards_do_not_give_a_position() {
    let projects = vec![
        project_with_generation("a", None, Some("ga")),
        project_with_generation("b", None, Some("gb")),
    ];
    let today = today_with(vec![
        today_item("project:b", Some("gb"), true),
        today_item("project:a", Some("ga"), false),
    ]);

    let candidates = build_do_now_candidates(&projects, &[], &today, "2026-07-16");

    assert_eq!(candidate_order(&candidates), vec!["a", "b"]);
    assert_eq!(candidates[0].reason, "today3");
    assert_ne!(candidates[1].reason, "today3");
}

#[test]
fn p10_04_empty_today3_keeps_the_manual_order() {
    let projects = vec![
        project_with_generation("a", None, Some("ga")),
        project_with_generation("b", None, Some("gb")),
        project_with_generation("c", None, Some("gc")),
    ];

    let candidates = build_do_now_candidates(&projects, &[], &no_today(), "2026-07-16");

    assert_eq!(candidate_order(&candidates), vec!["a", "b", "c"]);
    assert!(candidates
        .iter()
        .all(|candidate| candidate.reason != "today3"));
}

#[test]
fn p10_04_all_finished_today3_keeps_the_manual_order() {
    let projects = vec![
        project_with_generation("a", None, Some("ga")),
        project_with_generation("b", None, Some("gb")),
        project_with_generation("c", None, Some("gc")),
    ];
    let today = today_with(vec![
        today_item("project:c", Some("gc"), true),
        today_item("project:a", Some("ga"), true),
    ]);

    let candidates = build_do_now_candidates(&projects, &[], &today, "2026-07-16");

    assert_eq!(candidate_order(&candidates), vec!["a", "b", "c"]);
    assert!(candidates
        .iter()
        .all(|candidate| candidate.reason != "today3"));
}

#[test]
fn p10_04_manual_and_wishlist_cards_do_not_give_a_position() {
    let projects = vec![
        project_with_generation("a", None, Some("ga")),
        project_with_generation("b", None, Some("gb")),
        project_with_generation("c", None, Some("gc")),
    ];
    let today = today_with(vec![
        today_item("manual:one", None, false),
        today_item("wishlist:legacy-1", None, false),
    ]);

    let candidates = build_do_now_candidates(&projects, &[], &today, "2026-07-16");

    assert_eq!(candidate_order(&candidates), vec!["a", "b", "c"]);
    assert!(candidates
        .iter()
        .all(|candidate| candidate.reason != "today3"));
}

#[test]
fn p10_04_a_rewritten_next_step_loses_its_today3_position() {
    let projects = vec![
        project_with_generation("a", None, Some("ga")),
        project_with_generation("b", None, Some("g-new")),
        project_with_generation("c", None, Some("gc")),
    ];
    let today = today_with(vec![today_item("project:b", Some("g-old"), false)]);

    let candidates = build_do_now_candidates(&projects, &[], &today, "2026-07-16");

    assert_eq!(candidate_order(&candidates), vec!["a", "b", "c"]);
    assert!(candidates
        .iter()
        .all(|candidate| candidate.reason != "today3"));
}

#[test]
fn p10_04_today3_leads_then_focus_then_manual_order() {
    let projects = vec![
        project_with_generation("a", Some(true), Some("ga")),
        project_with_generation("b", None, Some("gb")),
        project_with_generation("c", None, Some("gc")),
    ];
    let today = today_with(vec![today_item("project:c", Some("gc"), false)]);

    let candidates = build_do_now_candidates(&projects, &[], &today, "2026-07-16");

    assert_eq!(candidate_order(&candidates), vec!["c", "a", "b"]);
    assert_eq!(candidates[0].reason, "today3");
}

#[test]
fn p10_04_today3_from_another_day_gives_no_position() {
    let projects = vec![
        project_with_generation("a", None, Some("ga")),
        project_with_generation("b", None, Some("gb")),
    ];
    let mut today = today_with(vec![
        today_item("project:b", Some("gb"), false),
        today_item("project:a", Some("ga"), false),
    ]);
    today.date = "2026-07-15".to_string();

    let candidates = build_do_now_candidates(&projects, &[], &today, "2026-07-16");

    assert_eq!(candidate_order(&candidates), vec!["a", "b"]);
    assert!(candidates
        .iter()
        .all(|candidate| candidate.reason != "today3"));
}

fn candidate_session(project_id: &str, date: &str, started_at: &str) -> SessionLogEntry {
    SessionLogEntry {
        id: None,
        date: date.to_string(),
        project_id: Some(project_id.to_string()),
        label: project_id.to_string(),
        started_at: started_at.to_string(),
        minutes: 10,
        note: String::new(),
        manual: false,
    }
}

#[test]
fn reads_legacy_session_without_note() {
    let path = std::env::temp_dir().join(format!(
        "life-launcher-legacy-session-{}.jsonl",
        datetime::timestamp_nanos(datetime::now_local())
    ));
    fs::write(
        &path,
        r#"{"date":"2026-07-08","projectId":"compose","label":"サンプル学習","startedAt":"10:00","minutes":12}"#,
    )
    .expect("write legacy session");

    let entries = read_session_entries(&path).expect("read sessions");
    assert_eq!(entries.len(), 1);
    assert_eq!(entries[0].note, "");

    let _ = fs::remove_file(path);
}

#[test]
fn normalizes_manual_session_start_time() {
    assert_eq!(
        normalize_started_at("0:05").expect("normalize midnight range"),
        "00:05"
    );
    assert_eq!(
        normalize_started_at("23:59").expect("normalize latest minute"),
        "23:59"
    );
    assert!(normalize_started_at("24:00").is_err());
    assert!(normalize_started_at("10:99").is_err());
}

#[test]
fn recent_sessions_returns_latest_thirty_with_notes() {
    let entries = (0..35)
        .map(|index| SessionLogEntry {
            id: None,
            date: "2026-07-08".to_string(),
            project_id: Some("compose".to_string()),
            label: format!("サンプル学習{index}"),
            started_at: format!("10:{index:02}"),
            minutes: 10,
            note: format!("note {index}"),
            manual: false,
        })
        .collect::<Vec<_>>();

    let recent = recent_sessions(&entries);
    assert_eq!(recent.len(), 30);
    assert_eq!(recent[0].note, "note 34");
    assert_eq!(recent[29].note, "note 5");
}

#[test]
fn project_totals_include_all_records_and_keep_unclassified_entries() {
    let entries = vec![
        SessionLogEntry {
            id: None,
            date: "2026-07-01".to_string(),
            project_id: Some("compose".to_string()),
            label: "サンプル学習".to_string(),
            started_at: "10:00".to_string(),
            minutes: 25,
            note: String::new(),
            manual: false,
        },
        SessionLogEntry {
            id: None,
            date: "2026-07-20".to_string(),
            project_id: Some("compose".to_string()),
            label: "サンプル学習".to_string(),
            started_at: "11:00".to_string(),
            minutes: 15,
            note: String::new(),
            manual: true,
        },
        SessionLogEntry {
            id: None,
            date: "2026-07-20".to_string(),
            project_id: Some("compose".to_string()),
            label: "サンプル学習".to_string(),
            started_at: "11:30".to_string(),
            minutes: 5,
            note: String::new(),
            manual: false,
        },
        SessionLogEntry {
            id: None,
            date: "2026-07-20".to_string(),
            project_id: None,
            label: String::new(),
            started_at: "12:00".to_string(),
            minutes: 10,
            note: String::new(),
            manual: false,
        },
    ];

    let totals = project_totals(&entries);

    assert_eq!(totals.len(), 2);
    assert_eq!(totals[0].project_id.as_deref(), Some("compose"));
    assert_eq!(totals[0].active_days, 2);
    assert_eq!(totals[0].total_minutes, 45);
    assert_eq!(totals[1].project_id, None);
    assert_eq!(totals[1].label, "未分類");
    assert_eq!(totals[1].active_days, 1);
    assert_eq!(totals[1].total_minutes, 10);
}

#[test]
fn next_step_suggestions_are_project_scoped_trimmed_unique_and_limited_to_latest_five() {
    let path = std::env::temp_dir().join(format!(
        "life-launcher-next-step-suggestions-{}.jsonl",
        datetime::timestamp_nanos(datetime::now_local())
    ));
    let mut entries = [
        "alpha", "beta", "gamma", "delta", "epsilon", "zeta", " zeta ", "  ",
    ]
    .into_iter()
    .map(|note| {
        let mut entry = candidate_session("compose", "2026-07-08", "10:00");
        entry.note = note.to_string();
        entry
    })
    .collect::<Vec<_>>();
    let mut other = candidate_session("other", "2026-07-08", "11:00");
    other.note = "other note".to_string();
    entries.push(other);
    let mut unclassified = candidate_session("today", "2026-07-08", "12:00");
    unclassified.project_id = None;
    unclassified.note = "today note".to_string();
    entries.push(unclassified);
    for entry in &entries {
        append_session_entry(&path, entry).expect("append session");
    }

    assert_eq!(
        serde_json::to_value(read_session_entries(&path).expect("read sessions"))
            .expect("serialize read entries"),
        serde_json::to_value(&entries).expect("serialize appended entries")
    );
    let before = fs::read(&path).expect("read original bytes");
    assert_eq!(
        load_next_step_suggestions_from_path(&path, " compose ").expect("load suggestions"),
        vec!["zeta", "epsilon", "delta", "gamma", "beta"]
    );
    assert_eq!(
        load_next_step_suggestions_from_path(&path, "other").expect("load other project"),
        vec!["other note"]
    );
    for project_id in ["", "  ", "unknown"] {
        assert!(load_next_step_suggestions_from_path(&path, project_id)
            .expect("load empty suggestions")
            .is_empty());
    }
    assert_eq!(fs::read(&path).expect("read unchanged bytes"), before);
    let _ = fs::remove_file(path);
}

#[test]
fn weekly_review_aggregates_only_previous_week_facts() {
    let entries = vec![
        SessionLogEntry {
            id: None,
            date: "2026-07-06".to_string(),
            project_id: Some("compose".to_string()),
            label: "サンプル学習".to_string(),
            started_at: "10:00".to_string(),
            minutes: 30,
            note: String::new(),
            manual: false,
        },
        SessionLogEntry {
            id: None,
            date: "2026-07-06".to_string(),
            project_id: Some("compose".to_string()),
            label: "サンプル学習".to_string(),
            started_at: "11:00".to_string(),
            minutes: 15,
            note: String::new(),
            manual: true,
        },
        SessionLogEntry {
            id: None,
            date: "2026-07-12".to_string(),
            project_id: Some("study".to_string()),
            label: "学習".to_string(),
            started_at: "14:00".to_string(),
            minutes: 20,
            note: String::new(),
            manual: false,
        },
        SessionLogEntry {
            id: None,
            date: "2026-07-13".to_string(),
            project_id: Some("compose".to_string()),
            label: "サンプル学習".to_string(),
            started_at: "09:00".to_string(),
            minutes: 99,
            note: String::new(),
            manual: false,
        },
    ];
    let current_week_start = datetime::parse_date("2026-07-13").expect("date");
    let previous_week_start = datetime::parse_date("2026-07-06").expect("date");
    let previous_week_end = datetime::parse_date("2026-07-12").expect("date");

    let review = build_weekly_review(
        &entries,
        current_week_start,
        previous_week_start,
        previous_week_end,
    );

    assert_eq!(review.week_key, "2026-07-13");
    assert_eq!(review.total_minutes, 65);
    assert_eq!(review.active_days, 2);
    assert_eq!(review.projects.len(), 2);
    let compose = review
        .projects
        .iter()
        .find(|project| project.project_id.as_deref() == Some("compose"))
        .expect("compose summary");
    assert_eq!(compose.session_count, 2);
    assert_eq!(compose.total_minutes, 45);
}

#[test]
fn do_now_candidates_follow_explainable_priority_rules() {
    let mut projects = crate::models::sample_config().projects;
    projects[0].id = "first".to_string();
    projects[0].weekly_focus = Some(true);
    projects[0].next_step.as_mut().expect("next step").text = "first step".to_string();
    projects[1].id = "second".to_string();
    projects[1].weekly_focus = Some(true);
    projects[1].next_step.as_mut().expect("next step").text = "second step".to_string();
    let mut third = projects[0].clone();
    third.id = "third".to_string();
    third.name = "third".to_string();
    third.next_step.as_mut().expect("next step").text = "third step".to_string();
    projects.push(third);

    let entries = vec![
        SessionLogEntry {
            id: None,
            date: "2026-07-16".to_string(),
            project_id: Some("first".to_string()),
            label: "first".to_string(),
            started_at: "11:00".to_string(),
            minutes: 10,
            note: String::new(),
            manual: false,
        },
        SessionLogEntry {
            id: None,
            date: "2026-07-16".to_string(),
            project_id: Some("second".to_string()),
            label: "second".to_string(),
            started_at: "09:00".to_string(),
            minutes: 10,
            note: String::new(),
            manual: false,
        },
    ];

    let candidates = build_do_now_candidates(&projects, &entries, &no_today(), "2026-07-16");

    assert_eq!(
        candidates
            .iter()
            .map(|candidate| candidate.project_id.as_str())
            .collect::<Vec<_>>(),
        vec!["third", "second", "first"]
    );
    assert_eq!(candidates[0].reason, "noToday");
    assert_eq!(candidates[1].reason, "oldestSession");
}

#[test]
fn do_now_candidates_include_non_focus_exclude_empty_and_use_manual_order_for_ties() {
    let projects = vec![
        candidate_project("first", Some(true), Some("first step")),
        candidate_project("second", Some(true), Some("second step")),
        candidate_project("excluded", Some(false), Some("non-focus step")),
        candidate_project("empty", Some(true), None),
    ];
    let entries = vec![
        candidate_session("first", "2026-07-16", "10:00"),
        candidate_session("second", "2026-07-16", "10:00"),
    ];

    let candidates = build_do_now_candidates(&projects, &entries, &no_today(), "2026-07-16");

    assert_eq!(candidates.len(), 3);
    assert_eq!(
        candidates
            .iter()
            .map(|candidate| candidate.project_id.as_str())
            .collect::<Vec<_>>(),
        vec!["first", "second", "excluded"]
    );
    assert_eq!(candidates[0].reason, "manualOrder");
    assert_eq!(candidates[1].reason, "manualOrder");
    assert_eq!(candidates[2].reason, "noToday");
}

#[test]
fn do_now_candidates_rank_all_non_focus_projects_by_today_and_last_session() {
    let mut projects = crate::models::sample_config().projects;
    projects[0].id = "today".to_string();
    projects[0].weekly_focus = Some(false);
    projects[0].next_step.as_mut().expect("next step").text = "today step".to_string();
    projects[1].id = "old".to_string();
    projects[1].weekly_focus = None;
    projects[1].next_step.as_mut().expect("next step").text = "old step".to_string();
    let mut recent = projects[0].clone();
    recent.id = "recent".to_string();
    recent.name = "recent".to_string();
    recent.next_step.as_mut().expect("next step").text = "recent step".to_string();
    projects.push(recent);

    let session = |project_id: &str, date: &str| SessionLogEntry {
        id: None,
        date: date.to_string(),
        project_id: Some(project_id.to_string()),
        label: project_id.to_string(),
        started_at: "10:00".to_string(),
        minutes: 10,
        note: String::new(),
        manual: false,
    };
    let entries = vec![
        session("today", "2026-07-16"),
        session("old", "2026-05-01"),
        session("recent", "2026-07-01"),
    ];

    let candidates = build_do_now_candidates(&projects, &entries, &no_today(), "2026-07-16");

    assert_eq!(
        candidates
            .iter()
            .map(|candidate| candidate.project_id.as_str())
            .collect::<Vec<_>>(),
        vec!["old", "recent", "today"]
    );
    assert_eq!(
        candidates
            .iter()
            .map(|candidate| candidate.reason.as_str())
            .collect::<Vec<_>>(),
        vec!["noToday", "noToday", "oldestSession"]
    );
}

#[test]
fn do_now_candidates_prioritize_focus_without_using_it_as_eligibility() {
    let mut projects = vec![
        candidate_project("focus", Some(true), Some("focus step")),
        candidate_project("available", Some(false), Some("available step")),
    ];
    let today_entry = candidate_session("focus", "2026-07-16", "10:00");
    let ranked = build_do_now_candidates(&projects, &[today_entry], &no_today(), "2026-07-16");
    assert_eq!(
        ranked
            .iter()
            .map(|candidate| candidate.project_id.as_str())
            .collect::<Vec<_>>(),
        vec!["focus", "available"]
    );

    projects[0].next_step = None;
    let fallback = build_do_now_candidates(&projects, &[], &no_today(), "2026-07-16");
    assert_eq!(fallback.len(), 1);
    assert_eq!(fallback[0].project_id, "available");
}

#[test]
fn do_now_candidates_use_manual_order_for_equal_state_and_empty_without_steps() {
    let mut projects = vec![
        candidate_project("first", None, Some("first step")),
        candidate_project("second", Some(false), Some("second step")),
    ];

    let tied = build_do_now_candidates(&projects, &[], &no_today(), "2026-07-16");
    assert_eq!(
        tied.iter()
            .map(|candidate| candidate.project_id.as_str())
            .collect::<Vec<_>>(),
        vec!["first", "second"]
    );

    projects
        .iter_mut()
        .for_each(|project| project.next_step = None);
    assert!(build_do_now_candidates(&projects, &[], &no_today(), "2026-07-16").is_empty());
}

#[test]
fn restart_support_requires_an_existing_session_at_least_fourteen_days_old() {
    let mut project = crate::models::sample_config().projects.remove(0);
    project.weekly_focus = Some(true);
    project.next_step.as_mut().expect("next step").text = "resume".to_string();

    let new_project = build_do_now_candidates(&[project.clone()], &[], &no_today(), "2026-07-16");
    assert!(!new_project[0].restart_eligible);

    let session_at = |date: &str| SessionLogEntry {
        id: None,
        date: date.to_string(),
        project_id: Some(project.id.clone()),
        label: project.name.clone(),
        started_at: "10:00".to_string(),
        minutes: 10,
        note: String::new(),
        manual: false,
    };
    let thirteen_days = build_do_now_candidates(
        &[project.clone()],
        &[session_at("2026-07-03")],
        &no_today(),
        "2026-07-16",
    );
    let fourteen_day_session = session_at("2026-07-02");
    let fourteen_days = build_do_now_candidates(
        &[project],
        &[fourteen_day_session],
        &no_today(),
        "2026-07-16",
    );

    assert!(!thirteen_days[0].restart_eligible);
    assert!(fourteen_days[0].restart_eligible);
}

#[test]
fn active_days_count_unique_current_week_dates_including_manual_sessions() {
    let entry = |date: &str, started_at: &str, manual: bool| SessionLogEntry {
        id: None,
        date: date.to_string(),
        project_id: Some("project".to_string()),
        label: "project".to_string(),
        started_at: started_at.to_string(),
        minutes: 10,
        note: String::new(),
        manual,
    };
    let entries = vec![
        entry("2026-07-12", "10:00", false),
        entry("2026-07-13", "09:00", false),
        entry("2026-07-13", "11:00", true),
        entry("2026-07-15", "12:00", false),
        entry("2026-07-20", "08:00", false),
    ];

    assert_eq!(
        active_days_between(
            &entries,
            datetime::parse_date("2026-07-13").expect("date"),
            datetime::parse_date("2026-07-19").expect("date"),
        ),
        2
    );
    assert_eq!(
        active_days_between(
            &[],
            datetime::parse_date("2026-07-13").expect("date"),
            datetime::parse_date("2026-07-19").expect("date"),
        ),
        0
    );
}

// V151-S3-2: these sessions were written by the v1.5.0 app itself (the public demo profile
// and the lead's v1.5.0 test profile). The weekly numbers must not change in v1.5.1.
#[test]
fn reads_v150_sessions_with_the_same_weekly_numbers() {
    let entries = |source: &str| {
        source
            .lines()
            .filter(|line| !line.trim().is_empty())
            .map(|line| serde_json::from_str::<SessionLogEntry>(line).expect("v1.5.0 session"))
            .collect::<Vec<_>>()
    };
    let public = entries(include_str!(
        "../../../tests/fixtures/v150/public/sessions-v150.jsonl"
    ));
    let public_review = build_weekly_review(
        &public,
        datetime::parse_date("2026-11-02").expect("current week"),
        datetime::parse_date("2026-10-26").expect("previous week"),
        datetime::parse_date("2026-11-01").expect("previous week end"),
    );
    assert_eq!(public_review.week_key, "2026-11-02");
    assert_eq!(public_review.previous_week_start, "2026-10-26");
    assert_eq!(public_review.previous_week_end, "2026-11-01");
    assert_eq!(public_review.total_minutes, 3);
    assert_eq!(public_review.active_days, 2);
    assert_eq!(public_review.projects.len(), 2);
    assert_eq!(
        public_review.projects[0].project_id.as_deref(),
        Some("sample-learning")
    );
    assert_eq!(public_review.projects[0].session_count, 1);
    assert_eq!(public_review.projects[0].total_minutes, 1);
    assert_eq!(
        public_review.projects[1].project_id.as_deref(),
        Some("sample-stretch")
    );
    assert_eq!(public_review.projects[1].session_count, 1);
    assert_eq!(public_review.projects[1].total_minutes, 2);

    let lead = entries(include_str!(
        "../../../tests/fixtures/v150/lead/sessions-v150.jsonl"
    ));
    let lead_review = build_weekly_review(
        &lead,
        datetime::parse_date("2026-11-23").expect("current week"),
        datetime::parse_date("2026-11-16").expect("previous week"),
        datetime::parse_date("2026-11-22").expect("previous week end"),
    );
    assert_eq!(lead_review.total_minutes, 2);
    assert_eq!(lead_review.active_days, 1);
    assert_eq!(lead_review.projects.len(), 1);
    assert_eq!(lead_review.projects[0].label, "運動");
    assert_eq!(lead_review.projects[0].session_count, 2);
    assert_eq!(lead_review.projects[0].total_minutes, 2);
}

#[test]
fn crossing_midnight_session_uses_its_recorded_end_day_without_changing_old_rows() {
    let crossing = SessionLogEntry {
        id: Some("crossing".to_string()),
        date: "2026-09-26".to_string(),
        project_id: None,
        label: "crossing".to_string(),
        started_at: "23:58".to_string(),
        minutes: 10,
        note: String::new(),
        manual: false,
    };
    let entries = vec![crossing];
    assert!(filter_session_entries(
        &entries,
        Some(&SessionEntriesFilter {
            date_scope: Some("today".to_string()),
            query: None,
            project_id: None,
        }),
        "2026-09-25"
    )
    .expect("previous day")
    .is_empty());
    assert_eq!(
        filter_session_entries(
            &entries,
            Some(&SessionEntriesFilter {
                date_scope: Some("today".to_string()),
                query: None,
                project_id: None,
            }),
            "2026-09-26"
        )
        .expect("end day")
        .len(),
        1
    );
}
