# P8.9-00 Current-state audit

- Branch: `p89/v1.3.2-review`, based on `3f5335b` (v1.3.1 main); initial tree clean.
- Version: 1.3.1, configuration schema version 3. v1.3.1 tag and release remain untouched.
- Baseline: npm ci/lint/build, relevant Playwright (20), Rust fmt/check/clippy, Rust tests (129+2), npm audit, cargo audit, public:check and diff check pass. Cargo audit reports eight permitted existing warnings and zero vulnerabilities.
- Main alignment move/no-move: move only empty Do Now heading, four section name text nodes, and Today Activity identity text. Do not move chevrons, counts, progress, descriptions, right actions, Today3 cards, NextStep rows, Wishlist groups or Activity time/duration.
- Weekly prompt: `applyWeeklyReview` sets banner state via localStorage; only Main renders it. Records weekly review state/data remains independent and must stay.
- Settings: Basic draft, dirty comparison and atomic `persistConfig` save. Frontend Zod and Rust JSON schema require an optional setting; schema version remains 3. Missing preference means standard.
- Sizing: `.mainScrollContent` has 1180px max width; Main and Records share `.mainPanel`. Presets must target Main content only, not top bar or Records. CSS must preserve responsive grid and native D&D hit testing.
- Historical release read-only audit: v1.3.0 contains Project/Today3/Drop Zone/Source Lock terminology; v1.2.0 contains Today3/Project/Wishlist/Today Builder/Session; v1.1.0 contains Today3; v1.0.0 has no matching terms. Bodies are not edited before review EXE approval.
