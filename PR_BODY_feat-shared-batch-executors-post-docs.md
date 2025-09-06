# chore(shared-batch): unify executors across plugins, add POST to adapter, update docs

## Summary
- Unify Batch executors for shape/location/route via `@hierarchidb/batch` (`mapChunks`).
- Adopt `AbstractBatchSession` for shape/location (route already using); delegate pause/resume/cancel and ProgressEvent updates.
- Share Download adapter (AuthRecovery + DownloadService + DexieChunkStorage):
  - GET: unified via `createSharedDownloadService()`
  - POST: add `postJson()` helper in runtime-shared adapter (used by location Overpass/custom when applicable)
- Route tests extended:
  - Lane gating (osm_route concurrency=1)
  - Pause/resume cursor honoring
- Docs updated (node-type README): reflect shared execution, download, and session abstraction.

## Affected Packages
- packages/runtime-shared/batch-processor: +downloadAdapter (POST helper)
- packages/node-type/shape-plugin: SessionController uses BatchService for all stages; BatchSessionManager delegates fully to ShapeBatchSession; shared download adapter
- packages/node-type/location-plugin: LocationBatchSession wired; GET via shared adapter; control via shared session
- packages/node-type/route-plugin: RouteBatchSession pause loop fix; lane + pause tests
- packages/node-type/README.md: architecture updates and route table row

## Rollout & Risks
- Behavior parity maintained; executor unification reduces divergence. Pause/resume behavior is more consistent.
- Dexie schema changes only in route (additive tables already merged previously).

## DoD
- [ ] `pnpm test -w` green for touched packages
- [ ] Manual: shape/location/route batch launch, pause, resume, finish; verify progress and results

## Rollback
- Revert commits; legacy paths were removed but can be restored from history.
