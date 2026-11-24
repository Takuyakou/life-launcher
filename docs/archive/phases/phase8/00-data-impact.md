# P8-00 Data Impact

基準: `265dafebc8ef0e6a6a2d1ac5196a4765d13bd313`。
本書は後続stageの制約と提案。P8-00ではモデル/保存処理を変更していない。

## 変えない契約

| データ | 制約 |
| --- | --- |
| `Project` / `projects` / `projectId` | UIの「取り組み」への変更だけでschemaを改名しない |
| `northStar`, `nextStep`, `nextStepTrigger` | 現行optional/空欄/長さ/鮮度更新契約を維持 |
| Wishlist `inbox[].id` | 後方互換stable ID。本文や配列indexを新しいidentityにしない |
| Today3 | sourceKey、done、順序、date、採用時の本文/環境/分数snapshotを保持 |
| source編集 | 明示保存で現在の採用snapshotも更新する既存契約。過去Sessionは不変 |
| selection Undo | operation token、日付、source snapshot比較、最新configへの対象単位逆差分 |
| Timer | 単一active、実行中source編集/解除guard、二重確定防止、既存動的早期完了 |
| source completion | `sourceCompletions`の独立snapshot。Today3.done、Sessionとは別の履歴 |
| `buttonIds` | 順序と最大2件、未設定fallbackを維持 |
| 手順書 | 登録ルート、許可形式、backend path検査、HTML read-only/securityを維持 |
| 保存 | optimistic変更の失敗rollback。成功通知は保存成功後のみ |
| D&D | pointermoveはpreview、dropで保存、失敗rollback。レイアウト変更だけで保存回数を増やさない |

根拠: `src/types.ts:100`以降、`src/sourceEdit.ts`、`src/App.tsx`の`persistConfig`、`undoTodaySelectionOperation`、`addTodayBuilderCandidate`周辺、Rust `commands/config.rs`。

## 実行記録の行動文

`SessionLogEntry`の保存値はid/date/projectId/label/startedAt/minutes/note/manual。独立したactionTextやsourceKeyはない (`src-tauri/src/models.rs:395`)。

| 経路 | 保存noteの意味 |
| --- | --- |
| Today3開始 | 採用snapshot本文を開始時にTimerへ渡す |
| Project / 今やる一手 | 開始note templateがあれば優先、なければ開始時NextStep |
| launcher等 | overrideがなければProject NextStepまたはlabel |
| 手動実行記録 | ユーザーの自由文。空欄も許容 |
| 後から編集した記録 | ユーザーが編集したnote。元の行動文と同一とは限らない |
| noteを持たない旧記録 | Rustのdefaultで空文字。後から行動文を復元する材料がない |

P8-03の既定提案は「保存済みnoteを履歴文として表示し、空欄は未記録と表示」。現時点のNextStep、Today3、sourceCompletionsから過去行動を推測して埋めない。ラベルも保存済みlabelを基本とし、現行Projectは色などの補助にのみ用いる。

将来、新規記録に厳密な行動snapshotを必要とする場合はoptional field追加と開始/終了/手動編集の契約を別途設計する。旧データのbackfillやnoteとactionの同一視はしない。P8-00はschema追加を承認したものではない。

## P8-03集計案

- データ集合: `load_session_entries`の全対象記録。`recentSessions`の30件だけから累計を作らない。
- Project identity: projectIdがあればそれ、なければ保存labelを名前空間付きの別キーとして扱う。現在の名称変更で別Projectを統合しない。既存summaryと合計一致を検証する。
- 週次明細: 保存dateと保存noteによって分類。noteの外側空白のみ整理し、内側空白/全半角/大文字小文字/句読点を勝手に同一視しない。空noteは未記録groupとする。この案は実装時にテストで固定する。
- 同じ文面でも別projectIdは別group。同日同文の複数記録は回数と分数を加算するが、元記録を破壊的に統合しない。
- 日付: 現行の業務日dateとday-start設定を基準とする。ブラウザが現在のタイムゾーンから過去dateを再生成しない。
- 累計明細: 保存date/startedAt降順、同時刻は安定したrowKey/元順でtie-break。手動追加は挿入順と実行日が異なるため、単なるreverseでは不足。
- Projectごとに5件/page、展開とpage stateはUIだけ。検索/削除等で件数が減った場合は有効pageへclamp。別Projectのpageを動かさない。
- 一覧の検索/期間filterと全体statsの集計scopeを混同しない。空/旧記録/削除済みProject/大量記録を実テストで確認する。
- 既存JSONL編集のrowKey、backup、未知/壊れた行の扱いは維持する。

## Today3の衝突点

通常のTimer完了は項目を残す。sourceそのものの完了/削除は現行仕様で対応Today3も取り除く。この違いは仕様書にも記載済み。

P8-02の「完了カードを残す」はまずTimer完了のrender/mutationを保証するものとして扱う。source完了/削除まで解除禁止に変えるなら、現行lifecycle変更として実装前に明示確認する。doneの一括リセット、max3変更、自動補充は行わない。

Builder追加入口はsourceを作る入口であり、採用結果や候補順へ独自の永続オブジェクトを作らない。候補source選択、追加後focus、取消、保存失敗の挙動をP8-02で確定させる。

## 辞書state

P8-04ではactive group、focused group/item、last valid item、focus layer、scrollをUI stateとして区別する。既存configにUI操作のたびに書き込まない。

- hidden/show間の復元を第一対象とし、アプリ再起動までの永続化は指示で確定してから選ぶ。
- 検索は一時値で、再表示時に空へ。検索結果用selectionと通常groupのlast itemを混ぜない。
- 項目/グループ削除後は存在確認してfallback。group focus中に古いtileを選択強調し続けない。
- scrollはrender/候補確定後に有効範囲へ復元し、focusによる自動scrollとの順序をテストする。
- main/別アプリ/入力欄のキー操作を奪わない。既存window shown/focus保護、位置調整を維持。

## Security / Release

P8-00の変更は文書のみ。network、favicon、CSP、capabilities、filesystem command、実データに変更なし。公開文書に個人の実データやローカル絶対パスを転記しない。

本監査は新しい包括的セキュリティ保証やv1.3 Release Gateではない。P8-06のclean install、dependency audit、全回帰、Release Prepでの配布物確認は別途必要。
