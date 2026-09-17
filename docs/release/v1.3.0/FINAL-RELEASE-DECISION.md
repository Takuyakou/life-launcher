READY FOR USER APPROVAL

# Life Launcher v1.3.0 Final Release Decision

## Decision

The Windows x64 v1.3.0 release candidate is ready for explicit user approval to publish. No release-blocking dependency issue, regression failure, migration/data-loss risk, reset/restore mismatch, rollback failure, version mismatch, private-data leak, native startup failure, source-identity corruption, or unresolved blocker-class defect remains.

No tag, GitHub Release, asset upload, or production deployment has been performed.

## Candidate identity

- Release branch: `fix/v13-victory-guide-release`
- Artifact source-code commit: `6f968cb`
- Audit evidence head before this decision: `024abe1`
- Branch relation: fast-forward from local `main`; 0 commits behind / 9 commits ahead before this report
- Version: `1.3.0`
- Config/data schema: `3` (intentionally unchanged)
- Release notes: `docs/release/v1.3.0/release-notes.md`

The packaging scripts and application source used to build the artifacts match commit `6f968cb`. Later commits through `024abe1` add only audit/release documentation.

## Final evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Baseline / security | FIXED-AND-PASS | `p8.5-00-baseline-audit.md`; npm 0 vulnerabilities; cargo 0 vulnerabilities; public scan clean |
| High-risk regression | PASS | `p8.5-01-high-risk-regression.md`; 359 Playwright passed / 48 intentional skips / 0 failed |
| Reset / Backup / Restore | PASS | `p8.5-02-reset-backup-restore-e2e.md`; rollback fault boundaries and isolated restore passed |
| Version / artifacts | FIXED-AND-PASS | `p8.5-03-artifact-report.md`; consistent v1.3.0 metadata, full post-version gate, Defender 0 new detections |
| Native smoke / upgrade | PASS | `p8.5-04-native-smoke.md`; standalone, portable, installer, reset, restore, Timer, auxiliary windows, and single-instance checks passed |
| Web Demo parity | DEFERRED / NON-BLOCKING | `p8.5-05-web-demo-parity.md`; current Web gates pass, v1.3 simultaneous deploy is not approved |

## Release assets

Candidate directory: `release-candidate/v1.3.0`

| Asset | SHA-256 |
| --- | --- |
| `Life-Launcher-v1.3.0-windows-x64-setup.exe` | `4B34410ECFC58413026D0D1927EF46A34EA4B32C7E5F42E6ADD85430211F4D58` |
| `Life-Launcher-v1.3.0-windows-x64.exe` | `44DCD009D1A739F09EA966BB0725D64596204F5F6B2A7208A1EFA1ACE4A87998` |
| `Life-Launcher-v1.3.0-windows-x64-portable.zip` | `85B0ACC333B4E7E81628BE64C038E96175DE8B31590DEC1769E009A1194504A1` |


## Web Demo decision

- Repository: `Takuyakou/life-launcher-web`
- Audit branch: `release/v1.3.0-parity-audit`
- Audit/security commit: `4fd1cd9`
- Current gates: unit 53 passed; E2E 31 passed / 1 intentional skip; visual 16 passed; lint/build/public safety PASS; npm audit 0.
- Production status: unchanged; no deploy performed.
- v1.3 parity status: not ready. The old permanent Builder, non-Project Wishlist model, missing source-lock UI, and incomplete Do Now Project-color follow must be addressed in a dedicated follow-up.

Windows v1.3.0 may be released without updating the Web Demo. The Web Demo must not be promoted as v1.3 parity from the audited branch.

## Known limitations

- Windows binaries are not Authenticode-signed; SmartScreen may warn.
- Windows 10 or later, x64, and Microsoft Edge WebView2 Runtime are required.
- There is no automatic updater; upgrades are manual.
- Native GUI smoke used the host's current DPI/WebView2 environment; the wider viewport matrix is covered by Playwright rather than repeated native-DPI runs.
- Vite reports a non-blocking approximately 556 kB JavaScript chunk warning.
- Existing local `main` is already ahead of `origin/main`; the complete outgoing history must be reviewed before push.

## Approval boundary

The next actions publish immutable public state. They require explicit user approval. Approval for the Windows release does not approve a Web Demo deployment.

## Exact Windows publish plan

Run only after approval:

1. Fetch `origin` and confirm it has not advanced unexpectedly.
2. In the canonical checkout, fast-forward local `main` to `fix/v13-victory-guide-release` and confirm a clean tree.
3. Rerun the lightweight final checks: version metadata, `git diff --check`, asset hashes, and tag absence.
4. Create annotated tag `v1.3.0` on the approved merged commit.
5. Push `main` and `v1.3.0` to `origin`.
6. Create GitHub Release `v1.3.0` using `docs/release/v1.3.0/release-notes.md`.
7. Upload exactly the installer, standalone EXE, portable ZIP, and `SHA256SUMS.txt`.
8. Download all four assets from GitHub into a new temporary directory and compare the three distributable hashes byte-for-byte with `SHA256SUMS.txt`.
9. Run a lightweight downloaded-asset smoke: ZIP contents, PE/version metadata, and one isolated startup.
10. Verify release links and record the final public release URL.
11. Do not deploy the Web Demo. Open a separate parity implementation/review cycle and request deployment approval only after P8.5-05 acceptance passes.

## Final status

**Windows v1.3.0: READY FOR USER APPROVAL**

**Web Demo v1.3.0 parity deployment: DEFERRED / NOT APPROVED**


