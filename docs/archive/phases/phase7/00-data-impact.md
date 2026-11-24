# P7.0 Data Impact

## 今回

- schemaVersion=2 / app=1.1.0を維持。migration・設定・Session formatの変更なし。
- 製品TypeScript/CSSの変更なし。Rustはcfg(test)内のテスト2件のみ追加。
- 保存済み利用者データ、EXE、Web Demo、README画像、公開Releaseに変更なし。
- 新しい監査用fixtureは既存synthetic fixtureから生成。個人データを使わない。

## P7.1に必要な更新範囲

完了を選んだ時だけ、対象TodayItemのdoneを更新し、既存Session記録を一度だけ行う。
未完了終了はSessionのみ。どちらも元Project/Wishlist/候補/履歴を削除・完了扱いしない。
sourceKey、snapshot、Today3配列順、batch境界を保持する。
既存shortTimerMinutesがあるため永続的なthreshold列やschema追加は不要。
一時的なpending stop state / Timer instance identityの追加は検討対象。

## 保存の限界

config保存とSession appendは別APIで、現在原子的なtransactionではない。
persistConfigは失敗時にUIを戻すがfinishTimerは先にTimerをクリアする。
planned完了はconfig保存結果falseでもSessionへ進む。
early実装では処理途中の再入力、記録失敗、done保存失敗、再試行の二重記録を試験すること。
既存の保存契約を「両方常に同時に成功する」と記述しない。

## レビュー事項

1. snapshot式 `min(5, validSnapshotOr5)` 分を採用する。
2. 旧snapshot補完は既存migrationを維持。runtime fallbackとは分ける。
3. Today直接一致は1件優先。Do Nowは採用Project sourceへ照合する。
4. Escape/close、ダイアログ待機時間、失敗時の再試行設計をP7.1着手時に確認する。
5. plannedの複数一致、延長state/ref差、stale/double finishをP7.1の回帰対象にする。

本監査でこれらの製品修正は行わない。P7.0承認後に次段階仕様を再読する。
