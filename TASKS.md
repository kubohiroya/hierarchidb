2026) fix/styler/step5-radio-label-click (P1) — 完了 (2026-01-07)
- 要点：Styler Step5 のターゲット選択でラベルテキストをクリックしてもラジオが選択されるよう FormControlLabel で関連付け、既存レイアウトを維持。
- 原因/影響範囲：ラジオとラベルを別要素で描画し for 関連付けがなかったため、ラベルクリックが無反応だった。影響範囲は Styler Step5 のターゲット選択 UI。
- 修正内容と適用範囲：ターゲットオプション行を FormControlLabel に置き換え、Radio とラベルテキストを一体化。適用範囲は `StylerTargetStep` のターゲット選択部分。
- 検証：未実施（UI クリック範囲改善のみ、手動/自動テスト未実行）。
- ロールバック手順：`plugins/styler-plugin/src/ui/components/StylerTargetStep.tsx` と `TASKS.md` の差分を revert する。
- 運用ログ：
  - start: 2026-01-07 10:15 JST Step5 ラジオボタンのラベルクリック対応に着手。
  - done: 2026-01-07 11:05 JST FormControlLabel でラジオとラベルを結合し、ラベルクリックで選択できるよう修正。検証: 未実施（UI クリック範囲改善のみ、手動/自動テスト未実行）。ロールバック: 上記差分を revert。

