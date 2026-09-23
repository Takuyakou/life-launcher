# P8.9-05 Release prep and historical public copy

- User explicitly approved the second P8.9 review EXE after isolated smoke passed.
- Origin/main remained `3f5335bbae62418c66fe294a0cd0fbe42632599e`; the review branch was clean before this stage. Neither local tag nor GitHub Release v1.3.2 existed.
- Original v1.3.0, v1.2.0, v1.1.0, and v1.0.0 GitHub Release metadata, body, URL, date, and asset records were saved under `docs/p8.9/historical-release-backup/` before remote edits.
- Per-release body drafts are under `docs/p8.9/historical-release-drafts/`; their changes were reviewed against the original bodies.
- v1.3.0, v1.2.0, and v1.1.0 Release bodies were edited individually. Every changed line was reviewed for historical accuracy and natural Japanese. Each was fetched again before editing and read back afterward. Tags, titles, publication dates, and all four asset IDs/names/sizes/digests per Release remained unchanged.
- v1.0.0 had no targeted internal terminology; no edit was made.
- The v1.3.1 Release, tag, and assets remain untouched.
- v1.3.2 release notes are in `docs/releases/v1.3.2.md`. They describe only the new display-size options, Main alignment/activity polish, and removed weekly prompt. Web Demo is a separate process.

Proceed to P8.9-06 for official version bump, packaging, and full post-version gates.
