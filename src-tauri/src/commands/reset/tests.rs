use super::*;
use std::sync::atomic::{AtomicBool, Ordering};

struct TestPlatform(AtomicBool);
impl ResetPlatform for TestPlatform {
    fn autostart_enabled(&self) -> Result<bool, String> {
        Ok(self.0.load(Ordering::Acquire))
    }
    fn set_autostart(&self, enabled: bool) -> Result<(), String> {
        self.0.store(enabled, Ordering::Release);
        Ok(())
    }
    fn close_auxiliary_windows(&self) -> Result<(), String> {
        Ok(())
    }
    fn remove_window_state_plugin(&self) -> bool {
        true
    }
}

#[test]
fn autostart_reconciliation_accepts_an_idempotent_disable_error() {
    let result = reconcile_autostart_state(
        false,
        || Err("指定されたファイルが見つかりません。 (os error 2)".to_string()),
        || Ok(false),
    );

    assert!(result.is_ok());
}

#[test]
fn autostart_reconciliation_keeps_a_real_state_mismatch_fatal() {
    let error = reconcile_autostart_state(
        false,
        || Err("registry access denied".to_string()),
        || Ok(true),
    )
    .unwrap_err();

    assert_eq!(error, "failed to update autostart: registry access denied");
}

struct FailAt(&'static str);
impl FailureInjector for FailAt {
    fn check(&self, point: &str) -> Result<(), String> {
        if point == self.0 {
            Err(format!("injected failure at {point}"))
        } else {
            Ok(())
        }
    }
}

struct Fixture {
    root: PathBuf,
    paths: ResetPaths,
    original: BTreeMap<String, Vec<u8>>,
    external: PathBuf,
    backup: PathBuf,
}

impl Fixture {
    fn new(label: &str) -> Self {
        let root = std::env::temp_dir().join(format!(
            "life-launcher-p83-{label}-{}-{}",
            std::process::id(),
            crate::datetime::timestamp_nanos(crate::datetime::now_utc())
        ));
        let data_dir = root.join("appdata").join("life-launcher");
        let backups_dir = data_dir.join("backups");
        let window_state = root.join("tauri").join(".window-state.json");
        fs::create_dir_all(&backups_dir).unwrap();
        fs::create_dir_all(window_state.parent().unwrap()).unwrap();
        let mut old_config = initial_config();
        old_config.groups.push("old".to_string());
        old_config.settings.auto_start = true;
        let entries = [
            (
                "config.json",
                serde_json::to_vec_pretty(&old_config).unwrap(),
            ),
            ("sessions.jsonl", b"{\"minutes\":25}\n".to_vec()),
            ("notes.json", b"{\"old\":{}}".to_vec()),
            ("config.schema.json", b"{\"old\":true}".to_vec()),
        ];
        let mut original = BTreeMap::new();
        for (name, bytes) in entries {
            fs::write(data_dir.join(name), &bytes).unwrap();
            original.insert(name.to_string(), bytes);
        }
        fs::create_dir_all(data_dir.join("icons")).unwrap();
        fs::write(data_dir.join("icons").join("old.png"), b"icon").unwrap();
        fs::create_dir_all(data_dir.join("icons").join("nested").join("empty")).unwrap();
        fs::write(
            data_dir.join("icons").join("nested").join("second.ico"),
            b"second-icon",
        )
        .unwrap();
        fs::write(&window_state, b"window").unwrap();
        let backup = backups_dir.join("existing.zip");
        fs::write(&backup, b"backup").unwrap();
        let external = root.join("instruction.html");
        fs::write(&external, b"external").unwrap();
        Self {
            paths: ResetPaths {
                marker: data_dir.join(RESET_MARKER_FILE),
                recovery: data_dir.join(RESET_RECOVERY_FILE),
                data_dir,
                backups_dir,
                window_state,
            },
            root,
            original,
            external,
            backup,
        }
    }

    fn input(&self) -> SoftwareResetInput {
        SoftwareResetInput {
            create_user_backup: false,
            timer_state: None,
            local_storage_snapshot: BTreeMap::from([(
                LOCAL_STORAGE_KEYS[0].to_string(),
                Some("old".to_string()),
            )]),
            local_storage_cleared: true,
        }
    }

    fn assert_preserved(&self) {
        assert_eq!(fs::read(&self.external).unwrap(), b"external");
        assert_eq!(fs::read(&self.backup).unwrap(), b"backup");
    }

    fn assert_rolled_back(&self) {
        for (name, bytes) in &self.original {
            assert_eq!(fs::read(self.paths.data_dir.join(name)).unwrap(), *bytes);
        }
        assert_eq!(
            fs::read(self.paths.data_dir.join("icons").join("old.png")).unwrap(),
            b"icon"
        );
        assert_eq!(
            fs::read(
                self.paths
                    .data_dir
                    .join("icons")
                    .join("nested")
                    .join("second.ico")
            )
            .unwrap(),
            b"second-icon"
        );
        assert!(self
            .paths
            .data_dir
            .join("icons")
            .join("nested")
            .join("empty")
            .is_dir());
        assert_eq!(fs::read(&self.paths.window_state).unwrap(), b"window");
        self.assert_preserved();
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[test]
fn reset_creates_canonical_fresh_state_and_preserves_external_data() {
    let fixture = Fixture::new("success");
    let platform = TestPlatform(AtomicBool::new(true));
    software_reset_at_paths(&fixture.paths, &platform, &fixture.input(), &NoFailures).unwrap();
    let marker = read_marker(&fixture.paths.marker).unwrap();
    assert_eq!(marker.phase, ResetPhase::CommittedAwaitingRestartValidation);
    validate_fresh_state(&fixture.paths, &marker, &platform, true).unwrap();
    assert_eq!(
        serde_json::to_value(read_current_config(&fixture.paths).unwrap()).unwrap(),
        serde_json::to_value(initial_config()).unwrap()
    );
    assert!(fs::read(fixture.paths.data_dir.join("sessions.jsonl"))
        .unwrap()
        .is_empty());
    assert!(!platform.0.load(Ordering::Acquire));
    assert!(!fixture.paths.window_state.exists());
    assert!(fixture.paths.marker.exists());
    assert!(!fixture.paths.recovery.exists());
    fixture.assert_preserved();
}

#[test]
fn failure_at_every_mutating_boundary_restores_exact_bytes() {
    for point in [
        "stage",
        "commit:config.json",
        "commit:sessions.jsonl",
        "commit:notes.json",
        "commit:config.schema.json",
        "commit:icons",
        "commit:autostart",
        "validate",
        "commit:windows",
        "commit:plugin",
    ] {
        let fixture = Fixture::new(&point.replace(':', "-"));
        let platform = TestPlatform(AtomicBool::new(true));
        let error =
            software_reset_at_paths(&fixture.paths, &platform, &fixture.input(), &FailAt(point))
                .unwrap_err();
        assert!(error.contains("rolled back"), "{point}: {error}");
        fixture.assert_rolled_back();
        assert!(platform.0.load(Ordering::Acquire));
        assert!(!fixture.paths.marker.exists());
    }
}

#[test]
fn preflight_rejects_uncleared_or_unapproved_local_storage() {
    let mut input = SoftwareResetInput {
        create_user_backup: false,
        timer_state: None,
        local_storage_snapshot: BTreeMap::from([(
            LOCAL_STORAGE_KEYS[0].to_string(),
            Some("old".to_string()),
        )]),
        local_storage_cleared: true,
    };
    assert!(validate_local_storage_input(&input).is_ok());
    input.local_storage_cleared = false;
    assert!(validate_local_storage_input(&input).is_err());
    input.local_storage_cleared = true;
    input
        .local_storage_snapshot
        .insert("unrelated".into(), None);
    assert!(validate_local_storage_input(&input).is_err());
}

#[test]
fn journal_uses_last_valid_full_record_when_tail_is_truncated() {
    let fixture = Fixture::new("journal-tail");
    let platform = TestPlatform(AtomicBool::new(true));
    let mut marker = prepare_snapshot(
        &fixture.paths,
        &platform,
        &fixture.input().local_storage_snapshot,
    )
    .unwrap();
    marker.phase = ResetPhase::Committing;
    write_marker(&fixture.paths, &marker).unwrap();

    let mut journal = OpenOptions::new()
        .append(true)
        .open(&fixture.paths.marker)
        .unwrap();
    journal
        .write_all(br#"{"version":2,"transactionId"#)
        .unwrap();
    journal.sync_all().unwrap();

    let recovered = read_marker(&fixture.paths.marker).unwrap();
    assert_eq!(recovered.phase, ResetPhase::Committing);
    assert_eq!(recovered.transaction_id, marker.transaction_id);
}

#[test]
fn recovery_is_retained_until_acknowledged() {
    let fixture = Fixture::new("recovery-ack");
    let recovery = SoftwareResetRecovery {
        message: "recover".to_string(),
        local_storage_snapshot: fixture.input().local_storage_snapshot,
    };
    append_json_record(&fixture.paths.recovery, &recovery).unwrap();

    assert_eq!(
        load_recovery_at(&fixture.paths.recovery)
            .unwrap()
            .unwrap()
            .message,
        "recover"
    );
    assert!(fixture.paths.recovery.exists());
    assert!(load_recovery_at(&fixture.paths.recovery).unwrap().is_some());

    acknowledge_recovery_at(&fixture.paths.recovery).unwrap();
    assert!(!fixture.paths.recovery.exists());
    assert!(load_recovery_at(&fixture.paths.recovery).unwrap().is_none());
}

#[test]
fn snapshot_verification_rejects_corrupt_icons_and_window_state() {
    let icons_fixture = Fixture::new("corrupt-icons");
    let platform = TestPlatform(AtomicBool::new(true));
    let marker = prepare_snapshot(
        &icons_fixture.paths,
        &platform,
        &icons_fixture.input().local_storage_snapshot,
    )
    .unwrap();
    fs::write(
        snapshot_path(&marker).join("icons").join("old.png"),
        b"changed",
    )
    .unwrap();
    assert!(verify_snapshot(&marker)
        .unwrap_err()
        .contains("tree snapshot differs"));

    let window_fixture = Fixture::new("corrupt-window");
    let marker = prepare_snapshot(
        &window_fixture.paths,
        &platform,
        &window_fixture.input().local_storage_snapshot,
    )
    .unwrap();
    fs::write(snapshot_path(&marker).join("window-state.json"), b"changed").unwrap();
    assert!(verify_snapshot(&marker)
        .unwrap_err()
        .contains("window-state snapshot bytes changed"));
}

#[test]
fn configured_backup_folder_inside_icons_is_rejected_before_reset() {
    let mut fixture = Fixture::new("backup-in-icons");
    let backup_folder = fixture.paths.data_dir.join("icons").join("user-backups");
    fs::create_dir_all(&backup_folder).unwrap();
    let existing_backup = backup_folder.join("keep.zip");
    fs::write(&existing_backup, b"keep").unwrap();
    let mut config = read_current_config(&fixture.paths).unwrap();
    config.settings.backup_folder = Some(backup_folder.to_string_lossy().to_string());
    let config_bytes = serde_json::to_vec_pretty(&config).unwrap();
    fs::write(fixture.paths.data_dir.join("config.json"), &config_bytes).unwrap();
    fixture
        .original
        .insert("config.json".to_string(), config_bytes);

    let platform = TestPlatform(AtomicBool::new(true));
    let error = software_reset_at_paths(&fixture.paths, &platform, &fixture.input(), &NoFailures)
        .unwrap_err();
    assert!(error.contains("backup folder is inside the icon cache"));
    assert_eq!(fs::read(existing_backup).unwrap(), b"keep");
    assert!(!fixture.paths.marker.exists());
    fixture.assert_rolled_back();
}

#[test]
fn fresh_validation_uses_transaction_staged_config() {
    let fixture = Fixture::new("staged-date");
    let platform = TestPlatform(AtomicBool::new(false));
    let marker = prepare_snapshot(
        &fixture.paths,
        &platform,
        &fixture.input().local_storage_snapshot,
    )
    .unwrap();
    stage_fresh_state(&marker).unwrap();
    let stage = snapshot_path(&marker).join("stage");
    let mut staged: AppConfig =
        serde_json::from_slice(&fs::read(stage.join("config.json")).unwrap()).unwrap();
    staged.today.date = "2000-01-01".to_string();
    let staged_bytes = serde_json::to_vec_pretty(&staged).unwrap();
    write_synced(&stage.join("config.json"), &staged_bytes).unwrap();
    for name in RUNTIME_FILES {
        fs::copy(stage.join(name), fixture.paths.data_dir.join(name)).unwrap();
    }
    replace_icons_with_empty(&fixture.paths.data_dir.join("icons")).unwrap();

    validate_fresh_state(&fixture.paths, &marker, &platform, false).unwrap();
}
