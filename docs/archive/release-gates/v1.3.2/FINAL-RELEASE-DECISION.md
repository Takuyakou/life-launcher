# Life Launcher v1.3.2 Final Release Decision

**APPROVED CANDIDATE — READY TO PUBLISH**

- Date: 2026-09-23 (JST)
- Approved application source: `1633a945b458a835e7dd4be6a25234ee7a9dd6e3`
- Config schema: 3, unchanged from v1.3.1.
- Publication: not performed at this decision point. P8.9-07 must independently verify remote state and published downloads.

The user approved the second review EXE. Official v1.3.2 binaries were built afterward from the versioned source with the existing NSIS/standalone/portable release pipeline; no review binary is in the candidate. The complete post-version gate passed: 413 Playwright tests, 129 Rust library tests, 2 capability tests, lint, build, Rust fmt/check/clippy, npm and Cargo vulnerability audits, public-safety check, and Defender custom scan. A further 22 focused Main display-size and alignment visual tests passed after packaging.

The candidate contains the expected Installer, Standalone EXE, Portable ZIP, and SHA256SUMS. Independent hashes, EXE version 1.3.2, ZIP contents, and release-note identity were verified. Standalone, extracted Portable, and test-installed EXEs each displayed a Main window and exited normally with separate synthetic schema 3 profiles. Silent uninstall removed the test install. A published v1.3.1 EXE generated a synthetic profile; the v1.3.2 candidate retained its Project/NextStep, Today, Wishlist, settings, and session data. The missing display-size field defaults to standard in the UI.

Known environment limits are recorded in [the gate report](p8.9-06-gate-report.md): this host already owns the default global hotkey, automatic WebView2 shutdown logs a class-unregister diagnostic despite exit 0, and final-package OS-level UI clicking was not automated. Browser/Rust tests cover the associated behaviors. No release blocker was observed.

Proceed automatically to P8.9-07. Stop if origin/main advanced unexpectedly, artifacts differ, tag or Release already exists, or remote download checks fail. Publish only after those checks pass, then write the public release report.
