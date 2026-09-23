# P8.9-04 User review build

## Review artifact

- Implementation source commit: `27d86978931da0cba04f63f6ebd07853502985d4` on `p89/v1.3.2-review`.
- File: `review-build/p8.9-v1.3.2/Life-Launcher-P8.9-v1.3.2-review.exe`
- Size: 15,929,856 bytes
- SHA-256: `3FC61E96289E4B0C9B635412094970881B368F284BEA0B8D418C520E85924244`
- Standalone Tauri release-profile build, no installer or portable ZIP. This is not the official v1.3.2 release. Internal ProductVersion/FileVersion remain 1.3.1 until P8.9-06.

## Verification

- Synthetic APPDATA and LOCALAPPDATA startup: process started, created only the isolated `life-launcher` data folder, and exited normally with code 0 through the existing release-smoke exit hook after eight seconds.
- Main and Settings interaction: Playwright Tauri-mock tests cover the three presets, save/reload, Cancel, scoped Records/toolbar behavior, responsive bounds, and large/xlarge D&D. A hands-on native Settings check remains part of user review.
- Full Playwright rerun: 409 passed, 48 skipped. Targeted scaled D&D tests added afterward: 20/20 passed.
- Rust fmt/check/clippy and tests, npm lint/build/audit, Cargo audit, public safety, and diff check passed. Cargo audit has eight previously allowed warnings and no vulnerabilities.
- Visual comparison: 1920px standard/large/xlarge screenshots inspected; the xlarge Today3 heading remains one line.

## User review checklist

1. Check the Main heading axes: 今やる一手, 今日の3件, 次の一手, やりたいこと, 今日の実行. Counts, descriptions, and right actions should remain naturally aligned.
2. Open 今日の実行 and check item text against the timestamp and duration.
3. Confirm `先週のふりかえりが見られます` does not appear, while Records/weekly review still works.
4. In 設定 → 基本 → 表示, switch 標準 → 大 → 特大, save and reopen. Sidebar, top toolbar, Records, Mini, Dictionary and Instruction Viewer should not grow.
5. At a wide window, compare the reading comfort of 大 and 特大. Also check Today3 dragging and a narrow window.

## Gate

Mandatory stop: awaiting explicit user review EXE approval. Do not edit historical GitHub Release bodies, bump official version, create release candidates, tag, publish, or replace v1.3.1 assets before approval.
