# P62-00 Web Demo Gap Audit

## 基準

- Repository: `Takuyakou/life-launcher-web`
- 監査対象main: `aaf4638d289780abf0cf1f5b9d8e8b3a2e984a52`
- 監査はread-onlyで行い、branch、working tree、deploymentを変更していない。
- Web DemoはWindows製品版の完全移植ではなく、中心体験を説明する独立React/Viteアプリである。

## 現在の実装

- `DemoState` schema version 2をlocalStorageへ保存し、timerだけreload時にidleへ戻す。
- Project、Wishlist、Today items、Sessionはsynthetic seedを使う。
- Today Builderはsource候補ではなく、既にToday3へ入っている`todayItems`のpreviewを表示する。
- Today3下の「候補から追加」が固定`TODAY_CANDIDATES`を直接Today3へ追加する。
- NextStepカードには5分/25分のtimer開始buttonがある。
- Wishlistは一覧表示のみで、Builderとのidentity連携を持たない。
- Today3はcheckboxで直接完了でき、native版の満了後終了確定とは簡略化されている。
- candidate exclusion、source completion、completion historyはない。
- Dictionaryは検索Demoで、Quick/Dictionaryのnative membership変更は持たない。
- backend、database、auth、analyticsはなく、ネットワーク0の既存E2Eがある。

## Phase 6.2本体との差分

| 領域 | Web Demo current | 本体Phase 6.2確定後の同期方針 |
|---|---|---|
| 登録元 | Project/Wishlistは表示されるがBuilder sourceではない | Project.nextStep + WishlistからBuilder候補を派生 |
| Builder | Today3 previewだけ | source別compact groupとBuilder唯一の`今日へ` |
| Today3追加 | Today3直下の固定候補button | Builderの`今日へ`から最大3件へ採用 |
| NextStep | timer開始buttonあり | 常設`今日へ`を置かず、登録元であることが伝わる表示へ |
| Wishlist | listのみ | Builder候補元としてstable IDで接続 |
| 候補除外 | なし | Demo stateで同日除外を簡略再現することを推奨 |
| source完了 | なし | repeatと明示完了の違いが中心体験に必要な範囲だけ再現 |
| Today3完了 | checkbox直結 | 「今日の完了でsourceは残る」ことを状態またはcopyで明示 |
| landing copy | 現行Phase 6相当 | 登録→Builder→Today3→開始へ更新 |

## P62-05で必須の変更

1. Project.nextStepとWishlistからBuilder候補を作る。
2. BuilderをNextStep/Wishlistのcompact group表示にする。
3. Today3直下の固定候補追加UIを除去し、Builderだけに`今日へ`を置く。
4. 最大3件、重複防止、sourceを残す採用契約を維持する。
5. Landing feature copyとDemo内説明を同じ中心導線へ更新する。
6. synthetic data、localStorage、network-zero、XSS対策、no backend/auth/analyticsを維持する。

## Demoへ入れないnative-only機能

- Explorer表示
- Quick/Dictionaryの実登録移動
- 実アプリ/ファイル/URL起動
- Start Environment Pickerによるnative launch設定
- Tauri window、tray、capability、filesystem security
- Rust推薦ロジックの再実装

開始環境は現在の「Web Demo上の演出」を維持し、native設定UIを模倣しない。

## optional sync

- `今日の候補から外す`をDemo stateへ追加し、元のProject/Wishlistが残ることを示す。
- `完了にする`とToday3完了の違いを、過剰なRecords実装なしで短く体験できるようにする。
- candidate exclusionを実装する場合、Demoの日付境界はlocal date keyで決定し、reloadで維持する。

## repository / deploy gate

- P62-05はWeb repositoryの別branch・別PRで実施する。
- Windows repositoryの履歴を混ぜない。
- Web本体仕様がP62-01〜04で確定する前に実装しない。
- PR作成後は停止し、human approvalなしにmain mergeまたはCloudflare production deployを行わない。
