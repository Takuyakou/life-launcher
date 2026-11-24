# ソフトウェアリセット

ソフトウェアリセットは、Life Launcherが所有する設定・活動データ・表示状態を初回起動状態へ戻すメンテナンス操作です。登録先のファイルや手順書を削除する操作ではありません。

## 実行手順

1. 設定の「メンテナンス」から「ソフトウェアリセット...」を選ぶ。
2. 「バックアップして続行」または「バックアップせず続行」を選ぶ。
3. 最終確認で「ソフトウェアリセット」を選ぶ。

実行中または一時停止中のTimer、Timer完了確認、早期終了確認がある場合は開始できません。Timerを終了してからやり直します。

「バックアップして続行」は、現在の`config.json`、`sessions.jsonl`、`notes.json`、`config.schema.json`を新しい検証済みZIPへ保存してから処理を続けます。「バックアップせず続行」はこのユーザー向けZIPだけを省略します。rollback用の内部snapshotはどちらの場合も作成します。

## 初期化するもの

| 対象 | 初期化後 |
| --- | --- |
| `config.json` | schema v3の初回起動設定。Quick、辞書、Project、NextStep、Wishlist、Today3、勝利条件、完了履歴は空 |
| `sessions.jsonl` / `notes.json` | 実行記録と互換notesは空 |
| `config.schema.json` | 現行schemaから再生成 |
| `icons/` | cacheを空にし、必要時に再生成 |
| app-owned localStorage | sidebar開閉、Builder順、手順書window表示、辞書focus lockなどを初期化 |
| window state | Main、Mini、辞書、手順書windowの保存位置・サイズを初期化 |
| autostart | 無効 |

設定に保存されたバックアップ先や手順書フォルダーのpathも解除されますが、pathが指す外部データは変更しません。

## 削除しないもの

- 登録していたアプリ、ショートカット、通常ファイル、フォルダー、URL。
- Markdown、Text、HTMLの手順書本体と、その周辺にあるCSS・画像などのasset。
- ユーザー指定のバックアップフォルダー、既存のバックアップZIP、フォルダー内の関連しないファイル。
- `%APPDATA%\life-launcher\backups`にある既存のconfig・Session・復元用バックアップ。
- インストール済みアプリ、配布物、ブラウザーデータ、clipboardなどLife Launcherの管理外にあるもの。

Life Launcher内に保存されている登録情報は初期化されます。外部対象を再登録する場合は、再起動後に改めて追加します。

## 失敗・中断時

frontendはapp-owned localStorageをcaptureしてからclearし、backendへsoftware reset commandを渡します。commandが検出可能な失敗を返した場合は、そのcaptureからlocalStorageを復元します。

backendはcommand受領後に、対象runtime fileの存在状態と内容、icon cache、window state、autostartの内部snapshotとdurable journalを保存してから変更を始めます。検出できる途中失敗ではsnapshotから元の状態へrollbackします。

processが途中で終了した場合は、次回起動時に通常のconfigを読み込む前にjournalを確認します。fresh stateが確定していない処理はsnapshotから復旧し、frontendがlocalStorageの復旧を適用してacknowledgeするまで復旧情報を保持します。復旧に失敗した証拠やsnapshotは削除せず、通常保存を継続して成功扱いにしません。

## 成功後

補助windowを閉じた後、Life Launcherのprocess restartを要求します。再起動後はProject 0件のcanonical fresh stateから、Project作成、NextStep設定、Wishlist追加、Today3採用、Timer実行、Session保存を開始できます。
