# アーカイブ

ここは読み取り専用の記録です。今の仕様は [../OVERVIEW.md](../OVERVIEW.md) と [../spec/current-spec.md](../spec/current-spec.md) を見てください。

## 開発段階と版の対応

公開時に履歴をまとめたため、各段階の文書は Git の上ではすべて v1.4.3 で入った形になっています。下の表の「対応する版」は、CHANGELOG と各文書の中の版の記載から決めた物です。「推定」と書いた行は、記載から一番近い版を選んでいます。

| フォルダー | 中身 | 対応する版 |
| --- | --- | --- |
| `phases/phase6/`・`phases/phase6.1/`・`phases/phase6.2/` | 今日の3件と候補の選択、登録完了の記録、開始環境、辞書の操作 | v1.1.0 |
| `phases/phase7/`・`phases/phase7.1/`・`phases/phase7.2/` | 早めの完了、編集の同期、Undo、セクションをまたぐ並べ替え、タイマーの操作の流れ | v1.2.0 |
| `phases/phase8/`・`phases/phase8.1/`・`phases/phase8.2/`・`phases/phase8.3/`・`phases/phase8.4/` | プロジェクト・次の一手・やりたいこと、設定の移行(v2→v3)、計測タイマー、ソフトウェアリセット、今日の3件の候補と今やる一手 | v1.3.0 |
| `phases/p8.7/` | 辞書の設定、ドラッグ登録 | v1.3.1 |
| `phases/p8.9/` | まとめての回帰確認と確認用ビルド | v1.3.x(推定) |
| `phases/phase9/` | 画面の見直しと基準画像(v1.3.4 時点) | v1.3.4 |
| `phases/phase9.5/` | 今やる一手の優先、色と枠の役割の整理 | v1.4.0 |
| `phases/phase9.6/` | タイマーの通知と時計、設定画面のキー操作 | v1.4.1 |
| `phases/phase9.7/` | タイトルバー、手順書ビューアーのキー操作、MHTML、JSON の取り込み | v1.4.2〜v1.4.3 |
| `phases/phase10/` | 画面の作り直し(UI/UX) | v1.5.0 |
| `release-gates/vX.Y.Z/` | 各版の公開前の監査・確認記録(v1.3.0〜) | 各フォルダー名の版 |
| `release-gates/preparation/` | v1.2.0・v1.3.0 の公開準備の下書き | v1.2.0・v1.3.0 |
| `reports/` | 性能・セキュリティの単発レポート、テストの見直し(2026-10-02)、インストーラーの確認画像 | — |

公開の検査に合わせて、次の 3 つは名前を変えました(中身は同じ):`release-gates/v1.3.0/p8.5-00-start-audit.md`(旧 `p8.5-00-baseline-audit.md`)・`release-gates/v1.3.1/p8.8-00-start-audit.md`(旧 `p8.8-00-baseline.md`)・`release-gates/v1.3.3/ui-05-nsis-report.md`(旧 `ui-05-nsis-work-report.md`)。
