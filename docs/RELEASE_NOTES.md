# Release Notes — 2025-09-02

This release focuses on making CommandProcessor the single execution path for core mutations and tightening Undo/Redo guarantees, with cleanup of deprecated flags and updated docs.

Highlights
- CommandProcessor routing: create/update/move/remove/recover are now always routed via CP (legacy paths removed)
- Reliable create Undo/Redo: preserves created node id across undo/redo cycles
- Trash holder flow: safer trash behavior (recover by holder decode), legacy-compatible fallback
- Error model unified: Core `CommandResult` / `ErrorCode` across worker
- Working Copy commit V2: integrated via CP behind flag, legacy path remains
- Policy C: blocks move/remove when WC exists in subtree (indexed search optimization)
- Headless tests: Node + fake-indexeddb scenarios for CP / WC / Policy C
- Trash migration tool: legacy <-> holder with metrics and rollback
- Lightweight command metrics（常時有効）

Flags
- Removed: `WORKER_USE_CMDPROC_CREATE_UPDATE`, `WORKER_USE_CMDPROC_MOVE_REMOVE`, `WORKER_WC_COMMIT_V2`, `WORKER_TRASH_USE_HOLDER`, `WORKER_POLICY_C`, `WORKER_ENTITY_UNIFIED`, `WORKER_METRICS_ENABLED`, `WORKER_TX_ENABLED` — いずれも最新実装に統一されました。
- Batch Control API V2 は常時有効化され、`BATCH_CONTROL_API_V2` フラグは廃止しました。
- Node-type プラグインのフラグ（`SHAPE_DOWNLOAD_STRATEGY`, `LOCATION_TABULAR`, `ROUTE_SEAROUTE`, `ROUTE_LANE_CAPS`, `ROUTE_TABULAR`）は恒久 ON 化しました。
- UI Dialog のレガシーモードフラグ `UI_DIALOG_ALLOW_LEGACY_DISPLAYMODE` を撤去しました。

Rollback
- If necessary, revert to the tag prior to 2025-09-02 changes. All removals are non-destructive and data-safe.

Notes
- See CHANGELOG for detailed entries and doc links.
