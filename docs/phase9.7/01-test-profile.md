# P97-01 — テスト用の起動（普段のデータから切り離す） 報告

- 日付: 2026-11-07
- ブランチ: `feature/p97-01-test-profile`（v1.4.2 公開後の `main` = `5a56617` から）
- 判定: **DONE（実機確認 1〜8 は未実施。次に行う）**

## 実装内容の要約

環境変数 `LIFE_LAUNCHER_TEST_PROFILE` に絶対パスが入っているときだけ、保存先（データ・窓の状態・WebView2）をテスト用のフォルダへ切り替え、自動起動の登録・グローバルショートカット・1つしか起動しない仕組みを触らずに起動するようにした。保存先は起動の最初に `AppPaths` として1回だけ決め、全処理がそこを見る。テスト用の起動はウィンドウのタイトル・サイドバーの「テスト」・トレイで見分けられる。

## 保存先に触れていた場所と直し方（漏れがないことの確認）

| 場所 | 元の作り | 直し方 |
| --- | --- | --- |
| `src-tauri/src/app_paths.rs`（新規） | — | 起動の最初に1回だけ保存先を決める `AppPaths`。`LIFE_LAUNCHER_TEST_PROFILE` の検証（正規化・実体解決・普段の保存先と同じ/中/親の拒否・ドライブのルート拒否・書き込み確認）もここ |
| `commands/config.rs` `config_dir_path()` / `schema_path()` | `%APPDATA%` を直接読む | `app_paths::data_dir()` を見る |
| `commands/notes.rs` `notes_path()` | `%APPDATA%\\life-launcher` を直接読む | `app_paths::data_dir()` を見る |
| `commands/sessions.rs` `sessions_path()` | 同上 | 同上 |
| `lib.rs` single-instance | 常に付ける | テスト用の起動では付けない（普段のアプリと同時に起動できる） |
| `lib.rs` autostart プラグイン | 登録 | プラグインは登録するが、テスト用では `enable()/disable()` を呼ばない（下の2行） |
| `lib.rs` window-state プラグイン | 既定の保存先（`app_config_dir`） | テスト用では `with_filename(<プロファイル>\\window-state.json)` |
| `lib.rs` メインウィンドウの作成 | `tauri.conf.json` が作る | `"create": false` にし、`setup` で `WebviewWindowBuilder::from_config` から作る。テスト用では `.data_directory(<プロファイル>\\webview)` |
| `lib.rs` asset プロトコルの範囲 | `$HOME/AppData/Roaming/life-launcher/icons` だけ | テスト用ではプロファイルのフォルダも許可（アイコンのキャッシュがそこにあるため） |
| `lib.rs` トレイ | 説明「Life Launcher」 | テスト用では説明「Life Launcher (テスト)」と、メニューの一番上に押せない項目「テスト用の起動」 |
| `startup.rs` `sync_autostart()` | 設定に合わせて登録・解除 | `should_sync_autostart(テスト用か)` が偽なら何もしない（単体テストあり） |
| `startup.rs` `register_shortcuts()` | OS に登録 | `should_register_shortcuts(テスト用か)` が偽なら何もしない（単体テストあり） |
| `src/App.tsx` 設定の保存時の自動起動 | `enableAutostart()` / `disableAutostart()` | テスト用では呼ばない（`testProfile.testProfile` で分岐） |
| `src/App.tsx` 自動起動の切り替え | 同上 | 同上 |
| `src/App.tsx` ミニタイマーの窓 | `new WebviewWindow(...)` | テスト用では `dataDirectory: <webview>` を渡す |
| `src/instructionWindow.ts` / `src/dictionaryWindow.ts` | 同上 | 同上 |
| `src/App.tsx` サイドバー | 「Quick」だけ | テスト用では「テスト」の小さな印を足す（今ある色の変数だけ） |
| `src/App.tsx` 設定画面 | 「Windows自動起動」 | テスト用では「テスト用の起動では、自動起動に登録しません」と添える |
| `commands/config.rs` の既存の単体テスト（`%APPDATA%` を一時フォルダへ向ける） | — | `AppPaths` を初期化していないときは従来どおり `%APPDATA%\\life-launcher` を使うフォールバックを残し、無変更で通る |

## 変更ファイル一覧

| ファイル | 変更 |
| --- | --- |
| `src-tauri/src/app_paths.rs` | 新規。保存先の決定・検証・全体への公開（単体テスト7件） |
| `src-tauri/src/lib.rs` | 起動の最初の決定、single-instance の条件、メインウィンドウの作成と WebView2 の保存先、window-state のファイル、asset の範囲、トレイ、`test_profile_info` の登録、エラーダイアログ |
| `src-tauri/src/startup.rs` | 自動起動とショートカットの分岐（単体テスト2件） |
| `src-tauri/src/commands/config.rs` | 保存先を `app_paths` へ、`test_profile_info` を追加 |
| `src-tauri/src/commands/notes.rs` `sessions.rs` | 保存先を `app_paths` へ |
| `src-tauri/tauri.conf.json` | メインウィンドウを `"create": false` に |
| `src/App.tsx` | テスト用の起動の取得、自動起動を呼ばない分岐、「テスト」の印、設定画面の注意、ミニの `dataDirectory` |
| `src/tauri.ts` | `test_profile_info` の呼び出し（1回だけ）と、窓に渡す WebView2 のフォルダ |
| `src/instructionWindow.ts` `src/dictionaryWindow.ts` | 窓を作るときの `dataDirectory` |
| `src/styles.css` | 「テスト」の印と設定の注記（新しい色なし） |
| `scripts/start-test-profile.ps1` | 新規。`-Exe` / `-Profile` / `-CopyCurrentData`、同じ検証、環境変数は子プロセスだけ |
| `tests/visual/tauriMock.ts` | `test_profile_info` と `setTestProfile` |
| `tests/visual/phase97-test-profile.spec.ts` | 新規。2テスト |
| `README.md` / `README.en.md` | 開発の説明にテスト用の起動を追加 |
| `docs/spec/current-spec.md` | §29「テスト用の起動（実機確認）」を追加 |

## 完了条件ごとの結果

- [x] 環境変数が無いときの動きが変わっていない → 既存のテストがすべて通る（下のゲート）
- [x] 保存先を起動の最初に1回だけ決め、すべての処理がそれを使う → 上の表
- [x] テスト用の起動で、普段の場所（設定フォルダ、窓の状態、WebView2、自動起動の登録）を読まず、書かない → 実装（実機確認 1〜8 で確認する）
- [x] テスト用のフォルダの検証で、普段の保存先に届くパスを断る → 単体テスト7件（ジャンクション経由を含む）
- [x] 普段のアプリが動いていても、テスト用の起動ができ、見分けられる → single-instance を付けない・タイトル/印/トレイ
- [x] `scripts/start-test-profile.ps1` がある。仕様書と開発の説明に書いた
- [ ] 実機で確かめること 1.〜8. の結果が報告にある → **未実施（この後行う。下に手順）**
- [x] 必須ゲートがローカルで通る

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | PASS |
| `npm.cmd run lint` | PASS（警告0） |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | **591/591 PASS**（新規2件を含む。約2.3分） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | **141 PASS**（新規9件を含む） |
| `git diff --check` | PASS |

## 更新した基準画像

**0枚**。「テスト」の印はテスト用の起動のときだけ出るので、普段の画面の基準画像は変わらない。印そのものは画像比較のテストで文字を確かめている。

## 判断メモ

- **Tauri の `WindowConfig.data_directory` は絶対パスを受け付けない**（相対パスだけを `%LOCALAPPDATA%\<ラベル>\<相対>` に解決し、絶対パスは無視する）。`Context.config` は非公開で実行時に変えられないため、メインウィンドウを `"create": false` にして `setup` で作り、テスト用のときだけ `.data_directory()` を渡す形にした。普段の起動では今までと同じ設定で作る。
- 窓の状態は `tauri-plugin-window-state` が `app_config_dir` 固定なので、`with_filename()` に**絶対パス**を渡して切り替えた（`Path::join` は絶対パスを受け取ると置き換える）。プラグインの `on_window_ready` で復元するため、ウィンドウを `setup` で作っても順序の問題はない。
- `dirs` は Windows では既知のフォルダ API を使うため、`APPDATA`/`LOCALAPPDATA` の環境変数では切り替わらない（Phase 9.6 の判定書の注と同じ）。だから WebView2 と窓の状態は、上の2つの方法で切り替えた。
- 保存先は `AppPaths` のグローバル1つ。`config_dir_path()` には「未初期化なら `%APPDATA%`」のフォールバックを残した。これは**既存の単体テストが `%APPDATA%` を一時フォルダへ向けて保存先を組み立てている**ためで、アプリの起動では必ず最初に `AppPaths` を入れるので通らない。
- アイコンのキャッシュは asset プロトコルの範囲が `tauri.conf.json` に固定されているため、テスト用のときだけ実行時に範囲を足した。
- `scripts/start-test-profile.ps1` は PowerShell 5.1 でも動くように、`Start-Process -Environment`（7 以降）ではなく `ProcessStartInfo.EnvironmentVariables` を使った。

## 実機で確かめること（この後行う。普段のアプリを終了してもらう必要がある）

1. 普段のアプリのプロセスが無いことを確かめる
2. 普段の場所の状態を記録する（`%APPDATA%\life-launcher` の全ファイルのハッシュと更新日時、`.window-state.json`、WebView2 のフォルダの最終更新、`HKCU\...\Run` の Life Launcher の値）
3. 書き込みの見張り: Process Monitor が使えるか確かめる（管理者権限が要るならオーナーに頼む。使えなければ 2. と 7. の比較だけで判断し、そのことを報告に書く）
4. release ビルドの単体 EXE を `start-test-profile.ps1 -CopyCurrentData` で起動する（コピーした設定の `autoStart` がオフなら、テスト用の `config.json` だけをオンにしてから起動する）
5. テスト用の起動の中で、設定を1つ変えて保存、短時間タイマーを始めて終える、窓を動かす、「Windows自動起動」をオフ→オンにして保存、手順書ビューアーと辞書を開く（画面操作は Claude が行う）
6. テスト用の起動を終了する（タスクトレイの「終了」）
7. 2. と同じものを記録し、**すべて変わっていない**ことを確かめる。テスト用のフォルダに、変えた設定・記録・窓の状態・WebView2 のデータがあることを確かめる
8. 普段のアプリを起動してもらい、続けて同じ EXE をテスト用で起動して、**両方が同時に動く**こと、タイトルとトレイで見分けられること、普段のアプリのショートカットが効くことを確かめる

## 提案

- `.gitignore` の `release-candidate/` で既定のプロファイルの置き場所はカバーされている。P97-08 の判定書に「テスト用の起動」の節を足すのは、リリース手順（P97-08）で行う
- `tauri.conf.json` の `create: false` は、普段の起動でもウィンドウの作り方が変わる（結果は同じ）。実機確認 1〜8 で起動と窓の状態の復元を確かめる
