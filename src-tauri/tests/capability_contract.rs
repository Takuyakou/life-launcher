use std::collections::BTreeSet;

use serde_json::Value;

struct ExpectedCapability {
    source: &'static str,
    identifier: &'static str,
    window: &'static str,
    permissions: &'static [&'static str],
}

fn string_set(values: &Value, key: &str) -> BTreeSet<String> {
    values[key]
        .as_array()
        .unwrap_or_else(|| panic!("{key} must be an array"))
        .iter()
        .map(|value| {
            value
                .as_str()
                .unwrap_or_else(|| panic!("{key} must contain strings"))
                .to_string()
        })
        .collect()
}

#[test]
fn window_capabilities_match_the_reviewed_least_privilege_contract() {
    let expected = [
        ExpectedCapability {
            source: include_str!("../capabilities/default.json"),
            identifier: "main-capability",
            window: "main",
            permissions: &[
                "autostart:allow-disable",
                "autostart:allow-enable",
                "core:default",
                "core:webview:allow-create-webview-window",
                "core:window:allow-close",
                "core:window:allow-hide",
                "core:window:allow-set-always-on-top",
                "core:window:allow-set-focus",
                "core:window:allow-set-focusable",
                "core:window:allow-set-position",
                "core:window:allow-set-size",
                "core:window:allow-show",
                "core:window:allow-unminimize",
                "window-state:allow-restore-state",
                "window-state:allow-save-window-state",
            ],
        },
        ExpectedCapability {
            source: include_str!("../capabilities/dictionary.json"),
            identifier: "dictionary-capability",
            window: "dictionary",
            permissions: &[
                "core:default",
                "core:window:allow-hide",
                "core:window:allow-set-focus",
                "core:window:allow-start-dragging",
                "core:window:allow-start-resize-dragging",
                "window-state:allow-save-window-state",
            ],
        },
        ExpectedCapability {
            source: include_str!("../capabilities/instruction.json"),
            identifier: "instruction-capability",
            window: "life-launcher-instruction",
            permissions: &[
                "core:default",
                "core:window:allow-destroy",
                "core:window:allow-set-always-on-top",
            ],
        },
        ExpectedCapability {
            source: include_str!("../capabilities/mini.json"),
            identifier: "mini-capability",
            window: "life-launcher-mini",
            permissions: &["core:default", "core:window:allow-start-dragging"],
        },
    ];

    for capability in expected {
        let parsed: Value = serde_json::from_str(capability.source).expect("valid capability JSON");
        assert_eq!(parsed["identifier"], capability.identifier);
        assert_eq!(
            string_set(&parsed, "windows"),
            BTreeSet::from([capability.window.to_string()])
        );
        assert_eq!(
            string_set(&parsed, "permissions"),
            capability
                .permissions
                .iter()
                .map(|permission| permission.to_string())
                .collect()
        );
    }
}

#[test]
fn webviews_do_not_receive_unused_opener_or_global_shortcut_permissions() {
    for source in [
        include_str!("../capabilities/default.json"),
        include_str!("../capabilities/dictionary.json"),
        include_str!("../capabilities/instruction.json"),
        include_str!("../capabilities/mini.json"),
    ] {
        let parsed: Value = serde_json::from_str(source).expect("valid capability JSON");
        let permissions = string_set(&parsed, "permissions");
        assert!(permissions.iter().all(|permission| {
            !permission.starts_with("opener:")
                && !permission.starts_with("global-shortcut:")
                && permission != "autostart:allow-is-enabled"
        }));
    }
}
