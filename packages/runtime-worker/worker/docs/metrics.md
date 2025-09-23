vk:doc kind=ref audience=dev scope=worker

# Command Metrics (Lightweight)

目的
- コマンド別の実行回数/失敗回数/合計レイテンシを常時収集する。

取得方法
- `services/utils/metrics.ts` の `commandMetrics.snapshot()` を利用（開発/テスト用途）。
- （将来）集計・外部出力は別PRで導入。

実装概要
- `CommandProcessor.processCommand` の開始/終了で計測し、`commandMetrics.record(kind, ms, success)` へ記録。

注意
- 現段階ではメモリ内にのみ保持。長期保持や可視化は後続で。
