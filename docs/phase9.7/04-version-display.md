# P97-04 — バージョンの表示(メンテナンスとタスクトレイ) 報告

- 日付: 2026-11-07
- ブランチ: `feature/p97-04-version-display`（`main` = `25e1002` から）
- 判定: **DONE**

## 実装内容の要約

設定 →「メンテナンス」の一番下に「バージョン <package.json の version>」を1行で出し、タスクトレイの説明を「Life Launcher <tauri.conf.json の version>」（テスト用の起動では「Life Launcher (テスト) <version>」）にした。数字はビルド時とアプリの情報から作り、リリースでバージョンを上げれば自動で変わる。

## 変更ファイル一覧

| ファイル | 変更 |
| --- | --- |
| `vite.config.ts` | `define` で `__APP_VERSION__` に `package.json` の `version` を埋め込む |
| `src/version.ts` | 新規。`declare const __APP_VERSION__` と `APP_VERSION` |
| `src/App.tsx` | メンテナンスの一番下に「バージョン <version>」の1行 |
| `src/styles.css` | `.settingsVersion`（控えめな文字、`--line-soft` の区切り線） |
| `src-tauri/src/lib.rs` | `tray_tooltip_text(test_profile, version)` と、`app.package_info().version` から作るトレイの説明。単体テスト1件 |
| `tsconfig.node.json` | `resolveJsonModule`（`vite.config.ts` の `package.json` の読み込み） |
| `tests/visual/phase97-version.spec.ts` | 新規。3テスト |
| `docs/spec/current-spec.md` | §2.1（トレイの説明）、§19.1（メンテナンスのバージョン）、§29（テスト用の見分け） |
| `docs/phase9.7/04-version-display.md` | この報告 |

## 完了条件ごとの結果

- [x] 2か所にバージョンが出る。数字は `package.json` と `tauri.conf.json` から自動で作られる → 画面は Vite の `define`、トレイは `app.package_info().version`
- [x] バージョンを上げても基準画像が変わらない → 下の「更新した基準画像」
- [x] `docs/spec/current-spec.md` にバージョンの表示を書いた → §2.1・§19.1・§29
- [x] 必須ゲートがローカルで通る → 下の表

## 実行したゲートと結果

| ゲート | 結果 |
| --- | --- |
| `npm.cmd run public:check` | PASS（3632ファイル、blocker 0） |
| `npm.cmd run lint` | PASS（警告0） |
| `npm.cmd run build` | PASS |
| `npm.cmd run test:visual` | **623/623 PASS**（新規3件を含む。2.5分 / 150.5秒） |
| `cargo fmt --manifest-path src-tauri/Cargo.toml -- --check` | PASS |
| `cargo check --manifest-path src-tauri/Cargo.toml` | PASS |
| `cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings` | PASS |
| `cargo test --manifest-path src-tauri/Cargo.toml` | **146 PASS**（145 unit + 1 capability） |
| `git diff --check` | PASS |

- `public:check`・`lint`・`build` の3つは続けて実行し、合計 20.6秒。
- visual の1回目は `phase82-countup-ui.spec.ts` の「Measure layout stays bounded in 3 column mode at 1440」が1件だけ時間切れで失敗した。単独実行と2回目の全件実行では通過しており、この Stage の変更（CSS は `.settingsVersion` のみ）とは関係しない既存の flaky と判断した。2回目の結果を上の表に書いている。

## 更新した基準画像

**0枚**。mask は使っていない。理由:

- 画像比較にメンテナンスタブの画像はない（`phase9-visual.spec.ts` の `settings-basic` は「基本」タブ）。
- バージョンの行はメンテナンスの節の中だけにあり、「基本」タブでは節ごと `settingsSection--hidden` で隠れる。
- `phase97-version.spec.ts` の「the version line stays out of the Basic settings screenshot」で、基本タブのとき `.settingsVersion` が非表示、メンテナンスで表示されることを確かめた。バージョンを上げても `settings-basic` の画像は変わらない。

## 判断メモ

- **画面の数字**: Vite の `define` で `package.json` の `version` を `__APP_VERSION__` に埋め込む。`src/version.ts` は型だけを宣言し、ビルド時に置き換わる。Vite の dev server で動く画像比較のテストでも同じ値になる。
- **トレイの数字**: `app.package_info().version`（`tauri.conf.json` の `version`）から作る。`tray_tooltip_text(test_profile, version)` を純粋関数にして、普段の起動とテスト用の起動の両方を単体テストで確かめた。
- **現在のバージョン**: 1.4.2。P97-08 で `package.json` と `tauri.conf.json` を 1.4.3 に上げると、メンテナンスとトレイの両方が自動で 1.4.3 になる。手で書き換える場所は増えていない。
- **既存のテスト**: `readme-contract.spec.ts` の「5か所のバージョンがそろっている」テストは、消さず・緩めず、そのまま通っている。
- **見た目**: バージョンの行は `quietText quietText--small`（13px の控えめな文字）に、既存の `--line-soft` の区切り線を付けた。新しい色は作っていない。ボタン・リンクは付けていない。
- **出さない場所**: メイン画面・ミニタイマー・手順書ビューアー・辞書には出さない（メンテナンスの節の中だけに置いた）。メイン画面に出ないことはテストでも確かめた。

## 実機で確かめること（P97-08 の実機確認の一覧に入れる）

1. 設定 → メンテナンスの一番下に「バージョン 1.4.3」と出る
2. タスクトレイのアイコンにマウスを乗せると「Life Launcher 1.4.3」と出る（テスト用の起動では「Life Launcher (テスト) 1.4.3」）
3. 普段のアプリとテスト用の起動が同時に動いているとき、タスクトレイの2つのアイコンのどちらがテスト用か、説明と右クリックのメニュー（P97-01）で見分けられる

## 提案

- 将来、メンテナンスタブの画像比較を足すときは、バージョンの行を `mask` するか、テスト時だけ決まった値を出す必要がある。今はメンテナンスの画像がないため、そのままにしてある。
- タスクトレイの説明は、OS の通知領域の幅によっては長い文字が切れることがある。実機で「Life Launcher (テスト) 1.4.3」が読めるか確認する。
- `phase82-countup-ui.spec.ts` のレイアウトテストは、今回の全件実行で1回だけ時間切れになった。並列実行時の flaky と考えられるので、P97-08 の前に何度か繰り返して安定性を見るとよい。
