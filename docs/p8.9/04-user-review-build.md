# P8.9-04 User review build

## Review artifact

- Implementation source commit: `9d67914496b13e99f3f78d9de23c66c11d41ba19` on `p89/v1.3.2-review`.
- File: `review-build/p8.9-v1.3.2/Life-Launcher-P8.9-v1.3.2-review-2.exe`
- Size: 15,930,368 bytes
- SHA-256: `D6D492D8EDC211D71BB29A465F08CB1511801889739B138751CCB4ABA567CE0A`
- Standalone Tauri release-profile build, no installer or portable ZIP. This is not the official v1.3.2 release. Internal ProductVersion/FileVersion remain 1.3.1 until P8.9-06.

## Verification

- Synthetic APPDATA and LOCALAPPDATA startup: review-2 EXE created its isolated `life-launcher` profile and exited normally with code 0 after 8.4 seconds via the existing release-smoke exit hook. The first attempt was blocked by the earlier review EXE single-instance lock; the successful retry ran after that instance was closed.
- Main and Settings interaction: Playwright Tauri-mock tests cover the three presets, save/reload, Cancel, responsive bounds, large/xlarge D&D, Main top-menu sizing, and unchanged Records toolbar. A hands-on native Settings check remains part of user review.
- Full Playwright rerun: 409 passed, 48 skipped. Targeted Main/Settings/D&D/toolbar tests after the user feedback: 22/22 passed.
- Rust fmt/check/clippy and tests, npm lint/build/audit, Cargo audit, public safety, and diff check passed. Cargo audit has eight previously allowed warnings and no vulnerabilities.
- Visual comparison: 1920px standard/large/xlarge screenshots inspected; the xlarge Today3 heading remains one line.

## User review checklist

1. Check the Main heading axes: 今やる一手, 今日の3件, 次の一手, やりたいこと, 今日の実行. Counts, descriptions, and right actions should remain naturally aligned.
2. Open 今日の実行 and check item text against the timestamp and duration.
3. Confirm `先週のふりかえりが見られます` does not appear, while Records/weekly review still works.
4. In 設定 → 基本 → 表示, switch 標準 → 大 → 特大, save and reopen. The Main top menu should grow at wide widths; Sidebar, Records, Mini, Dictionary and Instruction Viewer should not grow.
5. At a wide window, compare the reading comfort of 大 and 特大. Also check Today3 dragging and a narrow window.

## Gate

Mandatory stop: awaiting explicit user review EXE approval. Do not edit historical GitHub Release bodies, bump official version, create release candidates, tag, publish, or replace v1.3.1 assets before approval.
