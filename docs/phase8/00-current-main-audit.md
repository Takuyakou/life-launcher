# P8-00 現行main監査

## 基準と範囲

- 監査日: 2026-09-13
- Repository: `Takuyakou/life-launcher`
- Release metadata: `1.2.0`。Phase 8の目標はv1.3だが、今回は変更しない。
- `git fetch origin --prune` 後の基準: `265dafebc8ef0e6a6a2d1ac5196a4765d13bd313`。
- 監査開始時は別の報告書ブランチにいたため、その未統合commitを保持し、`origin/main`から`docs/p8-00-current-main-audit`を作成した。監査ブランチ開始時はHEADとorigin/mainが一致し、working treeはclean。
- 優先順位: 現行コード、実テスト、現行仕様書、Phase 8指示、過去報告、参考HTML。
- 本PRは監査文書のみ。UI、保存モデル、依存関係、権限、Web Demo、version、Releaseは変更しない。

以下の行番号は基準commitの参照点。後続PRによる行移動があるため関数名も併用する。

## 結論

P8-00の監査は完了。P8-01以降は人間の承認まで開始しない。

1. 先行3修正は実装済み。再実装しない。
2. Today3完了カードを描画時に除外する処理はない。完了時も`done: true`として残る。除外・source完了/削除などの別操作と区別する。
3. 記録の`note`は行動文専用snapshotではない。過去の正確な行動文を現在のNextStepで補ってはいけない。
4. 辞書のactive groupとfocused groupは部分的に分離済み。一方、再表示は先頭タイルへ移すため、最後の項目・focus layer・scroll復元は未実装。
5. Builderの追加入口は新設対象。登録先選択と既存source登録への接続をP8-02で明示し、Today3へ直接自由入力する別モデルを作らない。

## 先行実装

| 項目 | コード根拠 | テストと判断 |
| --- | --- | --- |
| Builder Undo正規化 | `src-tauri/src/commands/config.rs` の `normalized_source_snapshot` / `apply_undo_today_selection` | 実型へdeserializeして再serializeしたsnapshotを比較。Rustの`undo_today_selection_accepts_frontend_defaulted_source_snapshot`と`phase72-toast-undo.spec.ts`が通過。再実装不要 |
| 他の一手 | `src/App.tsx:7506`付近 `showNextDoNowCandidate`、Do Now action/context menu | 2候補以上で表示、同じhandlerで循環、永続順序は変更しない。`phase72-selection-edit-menus.spec.ts:132` / `:159`通過 |
| 空状態の12px | `src/styles.css` の `.focusBand .sectionEmptyActions > span` | `padding-inline-start: 12px`が存在。空状態CTAテストは通過。ただし12pxそのものの専用geometry assertionはない。P8-02で空状態を置き換える際に新しい寸法契約を検証 |

ブラウザテストはTauri mockを使う。Rustテストと組み合わせた確認であり、実EXEの操作確認とは区別する。Toastテストの一部はDOM clickを利用するため、実ポインターの遮蔽まで一律に保証しない。

## フォームと追加入口

フィールド対応、文言、フォーム順序は[UI Label Map](00-ui-label-map.md)に記載。

| 対象 | 現行 | P8で変更する部分 |
| --- | --- | --- |
| Project追加/編集、NextStep編集 | 共通Project draftと保存、現在のToday snapshot同期 | 表示語、フォーム区分、開始環境/手順書の配置 |
| Wishlist追加 | 本文だけの小さいフォーム、IME/連打/保存失敗対応 | 文言・共通footer表現。既存の軽い登録用途を維持 |
| Wishlist編集 | 本文、Project、手順書、開始環境 | 共通picker・配置・表示語 |
| 手順書 | native select、登録ルートから候補列挙、既存参照/エラー保持 | 検索できる別picker。ルート/拡張子/安全検査は緩めない |
| Start Environment | 最大2件、draftから選択を反映、キャンセルで親draftを変えない | 既存interactionを再利用 |
| 次の一手バー | 独立追加button、バー右クリックにも追加 | 行contextにも同じ追加handlerを追加 |
| Wishlistバー | 独立追加button。専用バーcontextなし | バー/行contextから同じ追加フォームを開く入口 |
| 開閉操作 | `toggleDisclosureFromBar` (`App.tsx:709`)がbutton/input等を除外 | 分離は実装済み。追加操作のpointer/Enter/Spaceとhit areaを新UIで検証 |

Project行のcontextはToday採用、候補復帰、並べ替え、編集、完了、削除。Wishlist行は候補復帰、並べ替え、編集、完了、削除。現行の各行contextに新規source追加はない。

## Today3とBuilder

| 経路 | 現行動作と根拠 | 取扱い |
| --- | --- | --- |
| 描画 | `App.tsx:9164`で`config.today.items.map`。done filterなし | 既存仕様を維持 |
| 通常満了 | `App.tsx:5916`付近、対応項目だけ`done: true`へmap | 削除しない |
| 早期完了 | `App.tsx:5708`付近、記録保存後に対応項目のdone更新 | 削除しない。保存失敗と記録の耐久性を維持 |
| 完了カード | `App.tsx:9326`付近、Timer controlsの代わりに完了ラベル | 完了済みから再開始するUIは出さない |
| 次の3件 | `allTodayItemsCompleted`は正確に3件かつ全件done。`startNextTodayBatch` (`:6968`)のみ枠を空にする | 1/1、2/2で次batchを許可しない |
| 明示解除 | `removeTodayItem`、Builder候補除外、D&D移動 | source/sessionを残して当日の採用だけ解除。Undo契約保持 |
| source完了/削除 | `withoutSourceFromToday` (`:6407`)が対象採用も除去 | 既存仕様。単なるTimer完了とは別。P8で黙って変更しない |
| 日付切替 | Rust `config.rs:1398`付近で新日付へitemsをclear | 自動繰越なしを維持 |
| 旧schema移行 | Rust `config.rs:2246`付近に旧manual doneの正規化 | 現行同versionの完了保存と混同しない |
| source編集 | `src/sourceEdit.ts`で現行snapshot更新、done/sourceKey/orderを維持 | 過去記録を書き換えない |

P8-02の差分は空状態の高さ/CTA、selectedの弱いstatus表示、Builder追加入口が中心。現行selectedはdisabled採用buttonに「選択済み」と表示する (`App.tsx:9564`以降)。toggle解除ではない。

Builderバー (`App.tsx:9503`付近)には追加buttonがなく、空候補時は登録元へ移動するbuttonだけ。追加はNextStep/Wishlistのどちらを作るか選べる既存フォームへの入口とする案が自然だが、既定の登録先は現行コードからは決まらない。P8-02着手時にUI案として確定させる。

「完了カードは明示解除・次batch・日付変更以外で消さない」という新指示をsource完了/削除まで含めて解釈すると現仕様と衝突する。通常のToday3完了保持は既に満たしており、source lifecycleの変更は別途明示判断が必要。

## 記録

現行は`activeView === "records"`の一画面。先週のふりかえり、重点、鮮度レビュー、stats、追加、source完了履歴、週次Project集計、累計、検索可能なSession一覧、旧notes、footerが縦に並ぶ (`App.tsx:8409`以降)。3タブはまだない。

| 現行領域 | P8-03の配置 / 留意点 |
| --- | --- |
| 今日/今週/活動日数 | ふりかえり。現行のRust集計を使う |
| Project別今週/累計 | ふりかえりのaccordion。現状は合計/活動日中心で行動別明細なし |
| 完了した項目 | ふりかえり。現在は0件でもsectionが出るため、0件時非表示へ |
| 先週/重点/鮮度 | 今週を決める。最大3重点・鮮度の既存処理を移す |
| 最近のセッション | すべての記録。検索・期間・Project filterと追加/編集/削除を維持 |
| 旧notes履歴 | 以前のメモとして折り畳む。現行の編集/blur保存を維持 |
| 戻る | 現在はheaderの記録/メイン切替button (`:8325`)。明示的な「← メイン」へ |
| 設定/データフォルダ | header設定あり。記録footer (`:8838`)と各保存先リンクは整理し、設定からの正規入口を残す |

`SessionLogInput` / `SessionLogEntry`には独立したaction snapshotやsourceKeyはない。`startTimer` (`App.tsx:5763`)で`noteOverride`または開始時の`nextStep`/labelを`ActiveTimer.note`へ格納し、終了時にその値を保存する。Today3は採用本文を渡す。Projectは開始note templateを優先できる。手動追加/編集のnoteは自由文で空欄も正当。

現在の一覧は保存済み`session.note`を表示し、空は「noteなし」 (`App.tsx:8763`付近)。現在のProject.nextStepを履歴へ混ぜてはいない。この性質を維持する。詳細方針は[Data Impact](00-data-impact.md)。

Rust `sessions.rs:137`のProject集計キーはprojectId、ない場合は保存label。既存の最近30件はファイル逆順 (`:604`)であり、必ずしも実行日時降順ではない。P8の累計5件ページングで30件だけを使わず、全対象記録から明示的に日時sortし、同時刻は安定キーでtie-breakする。

## 辞書

- `DictionaryWindow.tsx:177`に`selectedPageKey`と`focusedPageKey`が別々にある。グループ横移動は`focusPageAt`、確定は`selectPageAt`。この区別は既存機能。
- `selectedButtonId`は項目選択/見た目に兼用。`effectiveSelectedButtonId`は無効IDを先頭へfallback (`:490`)。独立した`focusLayer`とgroup別last itemはない。
- `resetSearchAndFocus` (`:1061`)は検索/項目選択を消して先頭タイルをfocusする。辞書shownイベントでも実行される。検索の一時性は実装済み、最後の項目復元は未実装。
- 同じWebViewをhide/showする間のactive groupはReact stateとして残るが、WebView再作成後までの復元は保証されない。scrollの専用保存/復元契約もない。偶然残るDOM scrollを仕様としない。
- active groupの背景/下線とkeyboard outlineはCSSに存在する (`styles.css:346`)。active borderもaccentなので、P8では外枠とfocusの誤認を減らす。項目selectedとgroup focusの同時強調をfocus layerで整理する。
- 既存矢印/Enter/検索入力のnative操作、100件超、D&D保存/rollback、同monitor位置調整は回帰対象。ブラウザ上のposition計算テストを実multi-monitor smokeと呼ばない。

## ガイドと参照HTML

用語の同期一覧は[UI Label Map](00-ui-label-map.md)。ガイド本文の先行変更はしない。

後続の視覚基準は外部指示パックの `project-nextstep-add-redesign-final.html`、`today3-builder-empty-final.html`、`records-three-tabs-base.html`、`records-accordion-pagination.html`、`dictionary-focus-active-final.html`。records accordion mockはmain contentだけを参考にする。今回は参照ファイルの位置と用語を確認した段階であり、実装前の各HTMLの表示確認は該当stageで行う。fixtureやJavaScriptは移植しない。

## 検証と引き継ぎ

結果と未実施範囲は[作業報告](workreports/p8-00-report.md)。P8-00で見つかった設計判断はP8-01以降へ明示的に引き継ぎ、今回の監査PRに混ぜて実装しない。

過去報告の「Installer用ico欠落」はcurrent mainでは再現条件未確定。`src-tauri/icons/icon.ico`はGit追跡済みであり、単純な欠落とは言えない。標準Installerスクリプトは`tauri build --bundles nsis`を呼ぶ。今回はInstaller buildを実行していないためPASSとも障害確定ともせず、Release Prepでclean buildを再確認する。
