READY FOR USER APPROVAL

# Life Launcher v1.3.1 Final Release Decision

- Prepared: 2026-09-23
- Artifact source commit: `5591644c0107200cfbbfc81bf26f884c7881baa0`
- Target: Windows x64
- Config schema: `3`（v1.3.0から変更なし）
- Publication: 未実施。tag、GitHub Release、production uploadはユーザー承認待ち。

## Decision

P8.7-00からP8.7-06までの実装、統合回帰、version整合、Windows packaging、artifact safety、v1.3.0互換起動を確認した。release blockerは検出されていないため、v1.3.1は公開承認待ちのREADYと判定する。

## Artifacts

生成先: `release-candidate/v1.3.1`

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `Life-Launcher-v1.3.1-windows-x64-setup.exe` | 3,627,967 bytes | `2946A6A47BBABA5481480B658F66788C9B91B6197BB3570FEFC826DC95193260` |
| `Life-Launcher-v1.3.1-windows-x64.exe` | 15,910,912 bytes | `63CE1041BD715200CCF6CCDA2C9D0F515D977F1FEF06158C5A6EFFA62EC0E944` |
| `Life-Launcher-v1.3.1-windows-x64-portable.zip` | 5,021,035 bytes | `FD67C84EA8FA024C2D0E55271B89E795C80239319443CA7CB1B49097E57F127B` |

`SHA256SUMS.txt`の3件は再計算値と一致した。`release-notes.md`は`docs/releases/v1.3.1.md`とbyte単位で一致する。

## Verification

| Check | Result |
| --- | --- |
| Final-source full Playwright | 381 passed / 48 skipped / 0 failed（429 total） |
| Final polish focused regression | 28 passed / 2 environment skips / 0 failed |
| Integrated P8.7 focused regression | 46 passed / 0 failed |
| Instruction Viewer repeat | 20 passed / 0 failed（5 repeats） |
| Rust | 129 unit + 2 capability passed |
| `npm run lint` / `npm run build` | PASS |
| `npm run public:check` | PASS、381 files / 0 blockers |
| `npm audit --audit-level=low` | PASS、0 vulnerabilities |
| `cargo fmt --check` / `cargo check` / `cargo clippy -D warnings` | PASS |
| `cargo audit` | PASS、0 vulnerabilities / 8 allowed upstream warnings |
| Windows Defender custom scan | PASS、no threats |
| Silent installer install/uninstall | PASS、v1.3.1確認、登録残留なし |
| Portable ZIP | PASS、EXE + READMEのみ、EXE hashはstandaloneと一致 |
| Artifact privacy/secret scan | PASS |

両EXEのFileVersion / ProductVersionは`1.3.1`。Authenticodeは`NotSigned`。

## Upgrade Compatibility

config schemaはv1.3.0と同じ3で、今回の最終polishはschemaとmigrationを変更しない。統合baselineでは既存データ相当fixtureを隔離native buildで起動し、辞書項目、辞書順、既存ショートカットの保持とExitCode 0を確認した。final sourceでは全Playwright、129 Rust unit、2 capability contract、silent install/uninstallを再実行した。

- Dictionary preferenceが未保存なら`auto`、表示形式が未保存なら`tile`になることを確認。
- content saveがdashboard shortcutを再登録しないことを確認。
- shortcut登録失敗時もrestoreが完了し再試行可能であることを確認。
- Beginner Guideの10章構成、5-step start、open/closeと用語更新を確認。
- 手順書ビューアーのサイズ循環、splitter上限、登録解除、window capability最小権限を確認。

統合native smokeでは常駐中のユーザー所有v1.3.0には触れず、single-instanceだけを分離するsmoke用identifier overrideを使用した。最終polish後はofficial RCのsilent install/uninstallを隔離先で確認し、製品起動による実ユーザーデータ操作は行っていない。

## Release Notes

- Dictionary settings、tile/list、icon size、direct shortcutの改善
- launch成功Toastの整理
- Drop Register UIの整理
- Instruction Viewerのno-folder freeze修正、3段階size、可変sidebar、安全な登録解除
- 初めて使う人向けGuideへの刷新
- Timer操作、Project色hover、用語と表示のpolish

## Known Limitations

- Windows binariesはコード署名証明書がないため未署名。SmartScreen警告が出る可能性がある。
- Microsoft Edge WebView2 Runtimeが必要。Portable READMEにも明記済み。
- Viteの500 kB超chunk warningは既存で、build failureではない。
- `cargo audit`の8件は上流依存のunmaintained/unsound warning。既知allow扱いで、新規vulnerabilityは0件。
- official identifierのRC直接起動は、ユーザー所有v1.3.0の常駐を壊さないため実施していない。代わりに同一release sourceをsmoke専用identifierでnative起動し、official installer/standalone/portableはversion、hash、installability、内容を別途検証した。

## Exact Publish Plan

1. ユーザーからv1.3.1公開の明示承認を得る。
2. artifact source commit `5591644c0107200cfbbfc81bf26f884c7881baa0`を含む承認済みrelease commitへannotated tag `v1.3.1`を作成する。
3. GitHub Release `v1.3.1`を`docs/releases/v1.3.1.md`から作成する。
4. Installer、Standalone EXE、Portable ZIP、`SHA256SUMS.txt`をuploadする。
5. 公開後にdownloadした3 artifactのSHA-256を照合する。
6. ユーザーがLife Launcherを閉じた状態で、公開artifactの最終startup checkを行う。

この計画はまだ実行していない。
