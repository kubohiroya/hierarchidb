# feat(route): adopt shared batch session + download (M1)

## Summary
- Migrate route-plugin batch to shared architecture:
  - Use `runtime-shared/AbstractBatchSession` via new `RouteBatchSession`.
  - Switch data fetch to `@hierarchidb/download` with AuthRecovery (shared download adapter).
  - Unify progress with `@hierarchidb/common-type` `ProgressEvent`.
  - Add idempotent session reuse (jobKey) and pause/resume (Dexie cursor).
  - Reinstate lane gating (osrm=1, searoute=3, local/great_circle=64).
  - Remove local `batch-shim`.
- Add minimal tests: idempotency; pause/resume smoke.

## Scope
- packages/runtime-shared/batch-processor: add `downloadAdapter.ts` (shared DownloadService factory).
- packages/node-type/route-plugin:
  - package.json deps: `@hierarchidb/batch`, `@hierarchidb/download`, `@hierarchidb/auth-recovery`.
  - DB v2: `routeCursors`, `routeResults`.
  - new `services/RouteBatchSession.ts` (extends AbstractBatchSession).
  - `services/RouteBatchManager.ts`: delegate to session; jobKey; pause/resume; lane gating; progress bridge.
  - `orchestrator/RouteSourceOrchestrator.ts`: use DownloadService; 401/403 notify AuthRegistry.
  - remove `services/batch-shim.ts`.
  - tests: idempotency / pause-resume.

## Flags / Rollout
- No runtime flags introduced; behavior compatible.
- Session idempotency/pause-resume are internal improvements; UI continues to work via progress emitter/store DI.

## DoD
- [ ] `pnpm --filter @hierarchidb/route-plugin typecheck && pnpm --filter @hierarchidb/route-plugin test` green.
- [ ] Manual smoke: Launch batch (recompute), verify progress; pause then resume; verify finish.
- [ ] OSRM lane gating respected (no parallel OSRM calls above 1 per lane).

## Risk & Mitigation
- Progress bridge regression → covered by minimal tests and manual smoke.
- Dexie schema bump (v2) → additive tables only; no breaking change.

## Rollback
- Revert this PR; restore `batch-shim.ts`; revert manager/orchestrator changes.

## Screens/Notes
- N/A (behavioral refactor; UI unchanged except more stable progress).
