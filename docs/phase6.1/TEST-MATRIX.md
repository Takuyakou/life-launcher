# Phase 6.1 — 自動検証・受入基準

## 1. 実在する検証入口

総合報告書§9の実在コマンドを基本とし、P61-00でpackage/CIと照合する。

```powershell
npm.cmd ci
npm.cmd run public:check
npm.cmd run lint
npm.cmd run build
npm.cmd run test:visual
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo check --manifest-path src-tauri/Cargo.toml
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets --all-features -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml
git diff --check
```

- `test:visual`は画像だけでなくbrowser操作検証の入口。既存の枠組みへ追加する。
- 存在しない`npm run test` / `npm run test:e2e`を必須にしない。
- 実在scriptが後から増えていた場合は確認して使う。空script・未実行PASSは禁止。
- インストール/auditのネットワーク失敗とコード検証失敗を区別する。
- 依存警告の対応を口実に無関係なpackage更新や`audit fix --force`を行わない。
- Stage途中は関連試験、P61-04で統合した全試験を実行。
- 55/55、Rust 92+2は報告書の過去値であり、今回の合格数として流用しない。

## 2. テスト環境

実ユーザーのconfig、Session、localStorage、手順書を使わない。
既存の隔離環境・Tauri mock・Clock制御を再利用する。
fixtureは一般的な架空項目と架空ID。個人名、病気、仕事、実ファイル名等を流用しない。
一定時間の待機を大量に入れず、状態条件とテスト用clockで確認する。
Timerを満了へ進める仕組みは既存テスト内だけ。本番へ「テスト用早送り」を増設しない。

## 3. P61-01 — 登録経路・派生候補

| ID | シナリオ | 期待結果 |
|---|---|---|
| FLOW-01 | Today3 header/body/空状態を確認 | 新規＋追加・自由入力formなし。timer/次の3件は維持 |
| FLOW-02 | Builder header/body/keyboard/context menuを確認 | 新規＋追加・Project作成・送付先select・dismissなし |
| FLOW-03 | NextStepの設定済み3件とWishlist4件を用意 | 正しいsourceで7候補。独立のBuilder登録なし |
| FLOW-04 | 空のNextStep、Session-only履歴を追加 | 空NextStep/独立Session候補なし。履歴は残る |
| FLOW-05 | 元のNextStep/Wishlistを編集 | Builder表示が更新。文字列でidentityを再生成しない |
| FLOW-06 | 元項目を削除 | 候補から消える。既存Today3/Sessionを巻き添えにしない |
| FLOW-07 | NextStep/Builderから同sourceの今日へを連打 | 現行identityで重複せず1件。元sourceが残る |
| FLOW-08 | Wishlistの今日へ | sourceが残り、未紐づきToday3のneutral表示を維持 |
| FLOW-09 | Today3満枠で今日へ | 4件目なし。誤った成功表示なし。短い上限説明 |
| FLOW-10 | 今日へ保存の失敗を注入 | 基準のrollback。source不変。成功Toastなし |
| FLOW-11 | ページ移動/開閉だけを実施 | 候補の新規永続化なし。関係ないsourceを書き換えない |
| FLOW-12 | Today3が空、候補あり | 「今日の候補を見る」でBuilderへ移動。form/Timerを開かない |
| FLOW-13 | 候補も0 | 登録元への案内。上段に新しい入力formを増やさない |
| FLOW-14 | 3件完了後に次の3件 | 履歴保持・次の枠・Builderへの案内。旧追加modalなし |
| FLOW-15 | 既存Session-source/manual Today3を読込 | データを消さず現行互換操作が可能 |
| FLOW-16 | 自由入力を必要とする既存の他機能を操作 | Quick/Project/勝利条件の登録・編集は壊れていない |

重複/採用後snapshotの詳細が報告書から確定しない部分は、P61-00で基準テストを記録する。
仕様変更が必要ならテスト期待値を勝手に新解釈へ差し替えず、人間承認を取る。

## 4. ページング・旧dismiss互換

| ID | シナリオ | 期待結果 |
|---|---|---|
| DATA-01 | 候補数0/1/5/6/8/10/11/50 | 5件/page、打切りなし、件数とページ数一致 |
| DATA-02 | 2ページ目で元sourceの最後の候補を削除 | 有効ページへclamp。blank pageに残らない |
| DATA-03 | 旧dismiss値を持つPhase 6形式configを読む | 元項目は新Builderに表示。old値を破壊しない |
| DATA-04 | DATA-03後にreload/別保存 | source/Today3/Session保持、消えたdismiss操作が復活しない |
| DATA-05 | 旧高いpage番号、source絞り込み、reload | page clamp/既存復元policyが働く |
| DATA-06 | 新Builderを操作 | 新しいdismiss値/候補保存配列を作らない |
| DATA-07 | 元source編集前にTimerを開始済み | 既存session target/snapshot/identity contract維持 |

ページ操作によるUI状態の保存まで一律禁止するのではない。
禁じるのは不要な**候補データ**やsourceの書込み。既存のpage/開閉復元は尊重する。

## 5. P61-02 — Modal / 登録UX

| ID | シナリオ | 期待結果 |
|---|---|---|
| FORM-01 | Wishlist headerの＋追加 | modalが1つ開く。行内入力なし。本文へfocus |
| FORM-02 | 有効な日本語本文を保存 | 1件だけ保存、Builderへ反映、元buttonへfocus return |
| FORM-03 | cancel/規定のEscape | 永続変更なし。次回に無関係な古い入力が混ざらない |
| FORM-04 | 空/空白だけ、上限超過、長い日本語 | 既存validation、見切れなし、エラーが読める |
| FORM-05 | 日本語IME確定のEnter | 変換確定だけで保存/closeしない |
| FORM-06 | 保存button連打 | 二重登録なし |
| FORM-07 | 保存例外/失敗 | dialog・入力保持、成功表示なし、再試行可能 |
| FORM-08 | Tab/Shift+Tab、focus-visible、Esc | dialog内操作・終了・focus returnが成立 |
| FORM-09 | スクリプト風文字列を入力 | テキストとして安全に扱い、HTMLとして実行しない |
| FORM-10 | NextStepの＋追加 | 詳細Project設定を保持し、titleが実際の作成対象と一致 |
| FORM-11 | 既存Projectの編集 | ID・action・手順書等を勝手に新規化/欠落しない |
| FORM-12 | Wishlistの既存context-menu編集 | 操作を保持。追加と編集の保存先を混同しない |

## 6. Timer / Today3の不変条件

| ID | シナリオ | 期待結果 |
|---|---|---|
| KEEP-01 | Timer0到達、満了dialog表示のみ | 終了確定前の扱いは基準を維持。今回早期完了へ変更しない |
| KEEP-02 | 満了後に終了確定 | 対応するToday3完了。Session/今日の実行の重複なし |
| KEEP-03 | 1分未満/以上の手動停止 | Today3未完了。記録条件は基準どおり |
| KEEP-04 | pause/再開/別Timerへ切替 | active Timer1本、pause時間処理・旧Timerの終了を維持 |
| KEEP-05 | Today3並べ替え後、別入口から満了確定 | stable source identityの関連付けが崩れない |
| KEEP-06 | 0/1/2/3項目、完了0〜3、次batch | existing条件維持。勝手な補充/大量枠を作らない |
| KEEP-07 | Do Nowの候補比較 | 今回の変更で候補源/順番をToday3限定へ書き換えていない |
| KEEP-08 | NextStep/Builderの開始buttonを検査 | 追加されない。開始はDo Now/Today3の現行経路 |

## 7. Quick / Dictionary / Securityの回帰

旧Phase 6の既存テストを実行し、作り直さない。
Explorer表示対象制限、IDのみ送信、Rust再解決、権限無追加、辞書矢印・カテゴリ色、
120件filter、initial focus、search入力を奪わない、Shift+F10/Menu key、
Main/他アプリのキーを奪わないことを維持する。

「このUIを直すために全Tauri権限を広げる」「Global key handlerを追加」は禁止。
報告書の保存失敗rollbackを後退させない。

## 8. P61-03 — Guide整合

| ID | シナリオ | 期待結果 |
|---|---|---|
| GUIDE-01 | アプリ内Guideを開く | 実装後の登録/選択/実行が説明される |
| GUIDE-02 | 旧追加/プルダウン/削除の説明を点検 | 新しく削った操作を案内していない |
| GUIDE-03 | 完了・次の3件の説明 | 満了後終了確定、手動停止との違い、履歴保持を実装と照合 |
| GUIDE-04 | ガイドに沿った最短操作を自動実行 | Wishlist登録→今日へ→開始が可能。Builder経由も可能 |
| GUIDE-05 | 推薦とToday3の説明 | 実コードより強い推薦条件を断定しない |
| GUIDE-06 | 多言語Guideがある場合 | 同じ事実と制約。ない場合に新翻訳systemは作らない |

## 9. Visual QA

最低幅: 860 / 1024 / 1366 / 1440 / 1920px（高さは既存presetを優先）。
Before/Afterは同一fixture・同一時刻・同一viewport。

状態:
- Main通常、補助section開閉、Today3が0/1/2/3。
- Today3全完了と「次の3件を選ぶ」。
- Builder0/5/6/11件、page2、今日へ選択済み・満枠feedback。
- Wishlist modal初期/入力中/validation/保存失敗。
- NextStep詳細dialog、Guideの入口と長文スクロール。

指標: 横overflow0、button/説明の重なり0、focus-visible、
Today3の3→2→1列維持、不要な＋追加や送付先select0（対象regionだけ）、
右クリック以外のキーボード等価経路維持。
見た目の微調整に伴う正当な差分を分類してからbaseline更新。
削除した旧buttonのスクショ期待値を、無関係なpixel matchのため復活させない。

## 10. 合格の定義

- 上記の新契約が自動検証され、旧Phase 6の無関係機能が回帰していない。
- 廃止した挙動を期待するテストは新契約へ置換し、旧ID→新IDの対応を報告。
  既存55件を数だけ維持する必要はないが、無関係なcoverageを減らさない。
- 「生成できた」「mockでPASS」「実TauriでPASS」を区別する。
- 失敗・未実行・環境BLOCKED・人間判断待ちをPASSに含めない。
- 人間は代表画像と仕様判断を確認。毎Stageで全機能を手動操作する前提にしない。
- 製品version/tag/Releaseは変更しない。最後は追加改善の承認待ちで停止。
