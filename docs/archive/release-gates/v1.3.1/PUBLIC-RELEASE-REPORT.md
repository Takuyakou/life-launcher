Life Launcher v1.3.1 RELEASED

# P8.8-06 Publish and Remote Verification

- Published: 2026-09-23 (JST)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.3.1
- Annotated tag `v1.3.1` target: `3f87a773d4243a16a1b8ce55a9a33f95828cfeae`
- Application source: `30e80e6b5d48c63d1b0f56a3d16c32509641e5f8`
- Release state: published, not draft, not prerelease; exactly four assets.

## Published assets

All four assets were downloaded from GitHub into a fresh `.local-evaluation/p88-06-download-*` directory. Each downloaded file matched the local approved candidate byte-for-byte by SHA-256. The three binaries also matched the **downloaded** `SHA256SUMS.txt`.

| Asset | Bytes | SHA-256 |
| --- | ---: | --- |
| [Installer](https://github.com/Takuyakou/life-launcher/releases/download/v1.3.1/Life-Launcher-v1.3.1-windows-x64-setup.exe) | 3,629,920 | `335472B35CAD5E8A3DB9B450D4BF28DC48B78C66E401A3613A84863FECEB7F05` |
| [Standalone EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.3.1/Life-Launcher-v1.3.1-windows-x64.exe) | 15,912,448 | `5410BBF91C660827B00F09B0CA92341BC95D3DA5E5A73D8C982980EAF0DD0E1C` |
| [Portable ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.3.1/Life-Launcher-v1.3.1-windows-x64-portable.zip) | 5,021,566 | `CE28C04E018394DEBA0DB79AC56E1DE813F7F899C6F4EE6603B3CD0829D738F2` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.3.1/SHA256SUMS.txt) | 327 | `DE3F73898FCD31FEF014B838A3C86315274870D53030FE4CC9D1A5ECB5916D5B` |

## Remote verification

- Remote annotated tag peels to the exact approved release commit above; `v1.3.0` was not changed.
- GitHub Release body matches `docs/releases/v1.3.1.md` after surrounding whitespace normalization. User-facing body has no audited internal code terms.
- Both downloaded EXEs report ProductVersion 1.3.1.
- Downloaded portable ZIP contains only the standalone EXE and README; the ZIP's EXE hash equals the separately downloaded standalone EXE.
- The **downloaded** standalone EXE opened a responsive Main window using fresh isolated `APPDATA`, `LOCALAPPDATA`, `TEMP`, and WebView2 folders, created schema 3 config, and exited with code 0.
- The host's existing `Ctrl+Alt+Space` owner caused a logged skipped global-shortcut registration during startup. It did not prevent launch or config creation. The non-fatal WebView2 window-class unregister diagnostic also appeared on automatic exit. These are recorded test-environment limitations in the readiness report, not new release-verification failures.

Publication and remote verification succeeded. Post-publication documentation on `main` does not alter the published tag or assets.
