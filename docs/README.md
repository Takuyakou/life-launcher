# Life Launcher のドキュメント

このフォルダーでは、今の仕様と、過去の開発記録を分けて置いています。今の Life Launcher を知るには、上の 2 つの文書だけを読めば足ります。

## 置き場所

| パス | 状態 | 中身 |
| --- | --- | --- |
| [OVERVIEW.md](OVERVIEW.md) | **現行** | 全体概要・アーキテクチャ・設計のポイント・主な機能 |
| [spec/current-spec.md](spec/current-spec.md) | **現行** | 今の版の UI/UX・機能・設定の詳しい仕様 |
| [releases/](releases/) | 公開履歴 | 版ごとの公開リリースノート（`vX.Y.Z.md`）だけ |
| [screenshots/](screenshots/README.md) | 現行の画像 | README に載せる合成データのスクリーンショットと、その作り方 |
| [archive/](archive/README.md) | **アーカイブ** | 過去の開発段階（Phase 6〜10 / P8.7 / P8.9）の記録・リリースの監査記録・単発のレポート |

## 決まり

1. **今の仕様の正本は 2 つだけ**
   - [OVERVIEW.md](OVERVIEW.md) と [spec/current-spec.md](spec/current-spec.md) の 2 つです。
   - どちらも冒頭に、対象バージョン・状態・最終更新を書き、リリースのたびに版と中身をそろえます。
2. **今の文書と作業の記録を混ぜない**
   - `docs/` の直下は `README.md`・`OVERVIEW.md`・`spec/`・`releases/`・`screenshots/`・`archive/` の 6 つだけにします。
   - 開発中の指示書や作業ログはリポジトリの外で管理します。リポジトリに残す監査記録・リリースの確認記録は `archive/release-gates/vX.Y.Z/` に置きます。
3. **自動で確かめる**
   - `docs/` 直下の 6 つ、現行 2 文書の対象バージョン、`releases/` のファイル名、主な文書の相対リンク切れを、CI のテスト（`tests/visual/readme-contract.spec.ts`）で毎回確かめます。
