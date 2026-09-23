READY FOR USER APPROVAL

# Life Launcher v1.3.1 Final Release Decision

- Prepared: 2026-09-23 (JST)
- Application source commit: `30e80e6b5d48c63d1b0f56a3d16c32509641e5f8`
- Platform: Windows x64
- Config schema: 3 (unchanged from v1.3.0)
- Publication: **not performed**. No `v1.3.1` tag or GitHub Release exists at this decision point.

## Decision

P8.8-00 baseline, P8.8-01 final full regression, P8.8-02 public-copy audit, P8.8-03 final package audit, and P8.8-04 isolated native/upgrade smoke are complete. The final UI fixes found during native smoke were included in the official artifacts: Dictionary settings no longer block Main interaction, and the empty Instruction Viewer no longer duplicates the upper folder-load button. No listed P8.8-05 blocker was observed. The candidate is **READY FOR USER APPROVAL**, subject to the explicit publication authorization required by P8.8-06.

## Final artifacts

Local candidate: `release-candidate/v1.3.1`. `SHA256SUMS.txt` matches independently recomputed values; `release-notes.md` matches `docs/releases/v1.3.1.md` byte-for-byte.

| Artifact | Bytes | SHA-256 |
| --- | ---: | --- |
| `Life-Launcher-v1.3.1-windows-x64-setup.exe` | 3,629,920 | `335472B35CAD5E8A3DB9B450D4BF28DC48B78C66E401A3613A84863FECEB7F05` |
| `Life-Launcher-v1.3.1-windows-x64.exe` | 15,912,448 | `5410BBF91C660827B00F09B0CA92341BC95D3DA5E5A73D8C982980EAF0DD0E1C` |
| `Life-Launcher-v1.3.1-windows-x64-portable.zip` | 5,021,566 | `CE28C04E018394DEBA0DB79AC56E1DE813F7F899C6F4EE6603B3CD0829D738F2` |

The standalone executable is AMD64, both EXEs report 1.3.1, the ZIP contains only the identical standalone EXE and README, and the candidate directory contains only the expected five release files. Windows Defender custom scan found no new detection; source/public safety scan passed with zero blockers; no personal profile paths, fixture paths, or private-key markers were found in the standalone binary.

## Test evidence

- Final application source: Playwright 391 passed, 48 skipped, 0 failed; the no-folder picker cancel/select pair passed five repetitions each on the release baseline.
- Rust: 129 unit tests and 2 capability tests passed; `cargo fmt --check`, `cargo check --locked`, and clippy with `-D warnings` passed.
- `npm run lint`, `npm run build`, `npm audit --audit-level=low`, and `npm run public:check` passed; npm audit found 0 vulnerabilities.
- `cargo audit` found 0 vulnerabilities and reported 8 previously allowed upstream warnings (6 unmaintained, 2 unsound).
- Final standalone, portable, and installed executables each opened a responsive native Main window under separate synthetic profiles, created schema 3 settings, and exited with code 0. Silent install and uninstall succeeded.
- v1.3.0-generated isolated settings upgraded with synthetic dictionary, launcher, Project/NextStep, Today, Wishlist, shortcuts, and session data intact. Missing dictionary display preferences defaulted to `auto` icon size and `tile` mode.
- Native final UI confirmed the empty Viewer has no body load button, upper `読み込み` remains, Dictionary settings allow Main Guide interaction, and list mode saves. Earlier same-feature native candidate confirmed Button Edit, Viewer four-step sizing, Mini, and Guide. Details and limits are in `p8.8-04-native-smoke.md`.

## Known limitations

- Windows binaries are unsigned; SmartScreen may warn. Microsoft Edge WebView2 Runtime is required.
- This host's default `Ctrl+Alt+Space` hotkey was already held by another process. Fresh candidates logged a skipped registration but stayed usable with no save error. OS-level global-shortcut open/hide/reopen repetition was not safe to run here; browser regression covers shortcut configuration and the isolated upgrade retained the launcher setting. This is a test-environment limit, not an observed v1.3.1 regression.
- Actual Windows folder-picker cancellation, external-file drag/drop, and NextStep linking were not repeated via OS input automation on the final binary. Their focused browser and backend checks passed; no native failure was observed.
- Vite's existing chunk-size warning remains non-fatal. The 8 `cargo audit` warnings above remain accepted upstream dependency risks.

## Exact publish plan

1. Obtain explicit user authorization to publish v1.3.1 after this READY decision.
2. Fetch origin; confirm remote state, clean `main`, reviewed release commit, no existing `v1.3.1` tag/Release, current hashes, release copy, and expected asset set. Stop if origin unexpectedly advanced.
3. Push reviewed `main`, create and push an annotated `v1.3.1` tag at the approved release commit, and create the GitHub Release from `docs/releases/v1.3.1.md` with exactly Installer, Standalone EXE, Portable ZIP, and `SHA256SUMS.txt`.
4. Download all four published assets into a fresh isolated directory. Verify names, sizes, SHA-256, EXE versions, ZIP contents, and isolated standalone startup. Record URLs and results in `PUBLIC-RELEASE-REPORT.md`.

No push, tag, or release publication is part of this decision report.
