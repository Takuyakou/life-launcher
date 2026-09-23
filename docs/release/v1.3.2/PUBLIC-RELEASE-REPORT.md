Life Launcher v1.3.2 RELEASED

# P8.9-07 Public Release Report

- Published: 2026-09-23 (JST)
- Release: https://github.com/Takuyakou/life-launcher/releases/tag/v1.3.2
- Approved Main/tag target: `8899ded8318752c23d904aad65e9d78fda9d97ab`
- Annotated tag object: `26c1983d928fd76bedcd569825d2bc7c41f256d0`
- Application source: `1633a945b458a835e7dd4be6a25234ee7a9dd6e3`
- GitHub Release is published, not a draft or prerelease, and is the latest Release.

## Download verification

All four assets were freshly downloaded from GitHub into a new synthetic folder. Each size and SHA256 exactly matched the locally approved candidate, and the downloaded SHA256SUMS verified all three binaries.

| Asset | Bytes | SHA256 |
| --- | ---: | --- |
| [Installer](https://github.com/Takuyakou/life-launcher/releases/download/v1.3.2/Life-Launcher-v1.3.2-windows-x64-setup.exe) | 3,627,709 | `599B32B7B4317304C3BEC1A1DB79EB72071E5F16C8445D5486F5E68290112B0D` |
| [Standalone EXE](https://github.com/Takuyakou/life-launcher/releases/download/v1.3.2/Life-Launcher-v1.3.2-windows-x64.exe) | 15,930,880 | `B308339377CD58C64D3069608220128505966EFF5E8CB2462A0F357CF7A639DD` |
| [Portable ZIP](https://github.com/Takuyakou/life-launcher/releases/download/v1.3.2/Life-Launcher-v1.3.2-windows-x64-portable.zip) | 5,020,113 | `8998F6D509C49195DA029E69A769ACF513C2811FD032DC671B1B6584A64464FD` |
| [SHA256SUMS.txt](https://github.com/Takuyakou/life-launcher/releases/download/v1.3.2/SHA256SUMS.txt) | 327 | `7CF03337790817A9098D86715F5A9F7D935A0C6ECD086AB8A263B59CFAAFF98E` |

The downloaded Installer and Standalone EXE both report ProductVersion and FileVersion 1.3.2. The Portable ZIP contains exactly the same EXE plus `README.txt`. The freshly downloaded Standalone EXE displayed a Main window under an isolated schema 3 profile and exited normally with code 0 after 9 seconds.

The remote Release body matches the approved release notes after line-ending normalization. The GitHub `latest` endpoint returned `v1.3.2`. The remote main and annotated tag target both matched the approved commit. Historical v1.3.0, v1.2.0, v1.1.0, and v1.0.0 Release metadata, asset IDs/names/sizes/digests, dates, and approved bodies were read back unchanged from the P8.9-05 audit.

Full test, artifact, native smoke, environment warning, and synthetic upgrade evidence is recorded in [the final gate report](p8.9-06-gate-report.md) and [the approval decision](FINAL-RELEASE-DECISION.md). Web Demo is a separate release process and was not modified here.
