# @hierarchidb/runtime-stage-worker

WebWorker を使った「ステージ並列実行」の共通基盤（予定）。

- shape-plugin を正としつつ、location-plugin / route-plugin でも同型の並列実行ができるようにする。
- pause/abort/maxConcurrent/progress の契約は `@hierarchidb/batch-session-ports` を参照。

## スコープ（計画）

- Worker 実行（workerFactory で生成）
- 並列度制御（maxConcurrent）
- pause/abort の協調（StageControls）
- progress の集約（throttle も含め将来拡張）

現時点では「器」だけを提供し、実際の worker 実装や comlink 依存は持ち込まない。

詳細: `docs/refactoring-plan-shape-to-location-route.md`

