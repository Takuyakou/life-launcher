APPROVED FOR PUBLICATION

# Life Launcher v1.3.0 Final Release Decision

## Decision

The Windows x64 v1.3.0 release candidate has received explicit user approval to publish. No release-blocking dependency issue, regression failure, migration/data-loss risk, reset/restore mismatch, rollback failure, version mismatch, private-data leak, native startup failure, source-identity corruption, or unresolved blocker-class defect remains.

No tag, GitHub Release, asset upload, or production deployment has been performed.

## Candidate identity

- Release branch: `fix/v13-victory-guide-release`
- Artifact source-code commit: `594dbfc`
- Audit evidence head before the approved UI follow-up: `8bed9d5`
- Branch relation: fast-forward from local `main`; 0 commits behind / 11 commits ahead before this report update
- Version: `1.3.0`
- Config/data schema: `3` (intentionally unchanged)
- Release notes: `docs/release/v1.3.0/release-notes.md`

The packaging scripts and application source used to build the artifacts match commit `594dbfc`. This commit adds the approved final empty-state typography, guidance copy, height-alignment regression coverage, and no unrelated behavior change.

## Final evidence

| Gate | Result | Evidence |
| --- | --- | --- |
| Baseline / security | FIXED-AND-PASS | `p8.5-00-baseline-audit.md`; npm 0 vulnerabilities; cargo 0 vulnerabilities; public scan clean |
| High-risk regression | PASS | `p8.5-01-high-risk-regression.md`; 359 Playwright passed / 48 intentional skips / 0 failed |
| Reset / Backup / Restore | PASS | `p8.5-02-reset-backup-restore-e2e.md`; rollback fault boundaries and isolated restore passed |
| Version / artifacts | FIXED-AND-PASS | `p8.5-03-artifact-report.md`; consistent v1.3.0 metadata, full post-version gate, Defender 0 new detections |
| Native smoke / upgrade | PASS | `p8.5-04-native-smoke.md`; standalone, portable, installer, reset, restore, Timer, auxiliary windows, and single-instance checks passed |
| Web Demo parity | DEFERRED / NON-BLOCKING | `p8.5-05-web-demo-parity.md`; current Web gates pass, v1.3 simultaneous deploy is not approved |
| Post-audit empty-state UI patch | PASS | Targeted Playwright 2 passed; production build passed; Tauri/NSIS package build passed; isolated standalone startup and artifact hash verification passed |

## Release assets

Candidate directory: `release-candidate/v1.3.0`

| Asset | SHA-256 |
| --- | --- |
| `Life-Launcher-v1.3.0-windows-x64-setup.exe` | `3C46DB7552B2AC0BAB4E0073D3B7C55ED48E42FC3579F3081932849B03376920` |
| `Life-Launcher-v1.3.0-windows-x64.exe` | `5A56761841D9643F339AADB0FB82786C6B5CB376F5AFF111E9B1A99D1A27C533` |
| `Life-Launcher-v1.3.0-windows-x64-portable.zip` | `77BCF09959CCE7C04021DE9BBEC76297DF45C87118CD9805E6AF8015573BDC33` |


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

The user explicitly approved continuing the Windows release on 2026-09-18. This approval does not approve a Web Demo deployment.

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

**Windows v1.3.0: APPROVED FOR PUBLICATION**

**Web Demo v1.3.0 parity deployment: DEFERRED / NOT APPROVED**


