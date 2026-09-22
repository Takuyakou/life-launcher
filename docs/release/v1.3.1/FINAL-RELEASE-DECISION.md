READY FOR USER APPROVAL

# Life Launcher v1.3.1 Final Release Decision

- Prepared: 2026-09-23
- Artifact source commit: `fbd17de8cdb57f8770b53a51318b184f2ee7cc56`
- Target: Windows x64
- Config schema: `3`（v1.3.0から変更なし）
- Publication: 未実施。tag、GitHub Release、production uploadはユーザー承認待ち。

## Decision

P8.7-00からP8.7-06までの実装、統合回帰、version整合、Windows packaging、artifact safety、v1.3.0互換起動を確認した。release blockerは検出されていないため、v1.3.1は公開承認待ちのREADYと判定する。

## Artifacts

生成先: `release-candidate/v1.3.1`

| Artifact | Size | SHA-256 |
| --- | ---: | --- |
| `Life-Launcher-v1.3.1-windows-x64-setup.exe` | 3,627,593 bytes | `E94335084A776531EC90DA95B066B44912CA4638727034073F852A08B33DB1C0` |
| `Life-Launcher-v1.3.1-windows-x64.exe` | 15,900,672 bytes | `76743D24844E2ACFB3CCC86A10A2A5DE752F9D6A66E0C92ED01ECF8378EDD001` |
| `Life-Launcher-v1.3.1-windows-x64-portable.zip` | 5,019,857 bytes | `C9D6C8AC76DBCAD40C7EAF47A685B670E219149B0F40AEF8FAC196772771046B` |

`SHA256SUMS.txt`の3件は再計算値と一致した。`release-notes.md`は`docs/releases/v1.3.1.md`とbyte単位で一致する。

## Verification

| Check | Result |
| --- | --- |
| Post-version full Playwright | 375 passed / 48 skipped / 0 failed（423 total） |
| P8.7 focused regression | 46 passed / 0 failed |
| Instruction Viewer repeat | 20 passed / 0 failed（5 repeats） |
| Final compatibility focus | 4 passed / 0 failed |
| Rust | 129 unit + 2 capability passed |
| `npm run lint` / `npm run build` | PASS |
| `npm run public:check` | PASS、380 files / 0 blockers |
| `npm audit --audit-level=low` | PASS、0 vulnerabilities |
| `cargo fmt --check` / `cargo check` / `cargo clippy -D warnings` | PASS |
| `cargo audit` | PASS、0 vulnerabilities / 8 allowed upstream warnings |
| Windows Defender custom scan | PASS、no threats |
| Silent installer install/uninstall | PASS、v1.3.1確認、登録残留なし |
| Portable ZIP | PASS、EXE + READMEのみ、EXE hashはstandaloneと一致 |
| Artifact privacy/secret scan | PASS |

両EXEのFileVersion / ProductVersionは`1.3.1`。Authenticodeは`NotSigned`。

## Upgrade Compatibility

v1.3.0と同じschema 3の既存データ相当fixtureを、v1.3.1 release sourceの隔離native buildで起動した。辞書項目、辞書順、既存ショートカットを保持し、ExitCode 0で終了した。migrationは発生しない。

- Dictionary preferenceが未保存なら`auto`になることをpost-version testで確認。
- content saveがdashboard shortcutを再登録しないことを確認。
- shortcut登録失敗時もrestoreが完了し再試行可能であることを確認。
- Beginner Guideの10章構成、5-step start、open/closeを確認。

常駐中のユーザー所有v1.3.0には触れず、single-instanceだけを分離するsmoke用identifier overrideを使用した。製品コード、frontend bundle、schemaはartifact sourceと同一である。

## Release Notes

- Dictionary settings、tile size、direct shortcutの改善
- launch成功Toastの整理
- Drop Register UIの整理
- Instruction Viewerのno-folder freeze修正とUI整理
- 初めて使う人向けGuideへの刷新
- 用語と表示のpolish

## Known Limitations

- Windows binariesはコード署名証明書がないため未署名。SmartScreen警告が出る可能性がある。
- Microsoft Edge WebView2 Runtimeが必要。Portable READMEにも明記済み。
- Viteの500 kB超chunk warningは既存で、build failureではない。
- `cargo audit`の8件は上流依存のunmaintained/unsound warning。既知allow扱いで、新規vulnerabilityは0件。
- official identifierのRC直接起動は、ユーザー所有v1.3.0の常駐を壊さないため実施していない。代わりに同一release sourceをsmoke専用identifierでnative起動し、official installer/standalone/portableはversion、hash、installability、内容を別途検証した。

## Exact Publish Plan

1. ユーザーからv1.3.1公開の明示承認を得る。
2. artifact source commit `fbd17de8cdb57f8770b53a51318b184f2ee7cc56`を含む承認済みrelease commitへannotated tag `v1.3.1`を作成する。
3. GitHub Release `v1.3.1`を`docs/releases/v1.3.1.md`から作成する。
4. Installer、Standalone EXE、Portable ZIP、`SHA256SUMS.txt`をuploadする。
5. 公開後にdownloadした3 artifactのSHA-256を照合する。
6. ユーザーがLife Launcherを閉じた状態で、公開artifactの最終startup checkを行う。

この計画はまだ実行していない。
