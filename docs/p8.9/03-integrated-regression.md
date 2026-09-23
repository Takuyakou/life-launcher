# P8.9-03 Integrated regression

## Result

PASS for the implementation and automated gates. Review EXE and native smoke remain P8.9-04.

- P8.9 targeted visual/settings/responsive/large-and-xlarge D&D tests: 20 passed across 620/860/1080/1440/1920 widths and all three presets.
- Adjacent Main, Picker, and D&D tests: 57 passed, 13 skipped in the focused run.
- Full Playwright: first run 408 passed, 48 skipped, one Instruction Viewer tree expansion timeout. The isolated test passed; full rerun with 45-second per-test Windows timing allowance passed: 409 passed, 48 skipped.
- Rust fmt/check/clippy and 129 unit plus 2 capability tests: PASS.
- npm ci, lint, production build, npm audit: PASS (existing >500 kB bundle warning).
- Cargo audit: zero vulnerabilities, eight pre-existing allowed advisory warnings.
- Public safety check: PASS; git diff --check: PASS.
- 1920px standard/large/xlarge screenshots inspected. Standard retains prior density; larger presets use broader Main width without changing sidebar or top toolbar. The initially wrapped xlarge Today3 heading was corrected.
- Weekly Main prompt absent. Records weekly review remains available.
- The optional preference uses config schema v3 and defaults to standard for legacy configurations. Save/reload and Cancel behavior were exercised.

## Boundaries

No production user data was used. Historical release bodies, v1.3.1 tag/assets, official version strings, and Web Demo remain untouched. Native synthetic-profile smoke follows with the review EXE.
