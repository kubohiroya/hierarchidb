# Replace ShapeAPI with ShapeQueryAPI/ShapeMutationAPI and add RouteMutationAPI (location deferred)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repo at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, any package can read or update persisted shape and route artifacts through stable Worker APIs without touching plugin-internal Dexie tables. Shape-specific ad hoc APIs are removed, and Shape operations are split into read-only Query and write-only Mutation surfaces, while batch execution continues via the shared build-control APIs. You can see this working by calling `getShapeQueryAPI()` and `getShapeMutationAPI()` from the UI worker client and observing that shape results, tile metadata, and cleanup actions work without importing the shape plugin directly.

## Progress

- [x] 2025-12-26 16:58 JST: Created initial ExecPlan and recorded context/approach for Shape/Route APIs.
- [x] 2025-12-26 17:12 JST: Inventory completed; removed useShapeAPI exports/tests and verified no runtime UI usage remains.
- [x] 2025-12-26 17:12 JST: Defined ShapeQueryAPI/ShapeMutationAPI and RouteMutationAPI in plugin-service-api and updated exports.
- [x] 2025-12-26 17:12 JST: Implemented runtime-worker services and WorkerAPI wiring (worker runtime + ui worker client).
- [x] 2025-12-26 17:12 JST: Migrated shape-plugin worker exports to build-only entry points and removed ShapeAPI surface.
- [ ] 2025-12-26 17:12 JST: Update tests/docs, then validate with targeted typechecks (completed: docs/tests updated; remaining: run typecheck commands).

## Surprises & Discoveries

None yet.

## Decision Log

- Decision: Defer LocationQuery/LocationMutation changes and focus only on Shape/Route APIs.
  Rationale: User requested location be postponed while proceeding with Shape/Route.
  Date/Author: 2025-12-26, Codex
- Decision: Keep batch execution on the shared build-control API and remove batch responsibilities from the new Query/Mutation APIs.
  Rationale: Batch control already exists in `packages/common/api` and is wired through `WorkerAPI`; mixing batch with query/mutation would reintroduce the monolithic ShapeAPI.
  Date/Author: 2025-12-26, Codex
- Decision: Preserve a worker-internal batch export (`shapeBatchAPI`) for runtime batch control while removing public ShapeAPI types and hooks.
  Rationale: The worker runtime still needs batch entry points, but external consumers should use ShapeQueryAPI/ShapeMutationAPI and shared batch control.
  Date/Author: 2025-12-26, Codex

## Outcomes & Retrospective

Not started.

## Context and Orientation

The current Shape plugin exposes a monolithic `ShapeAPI` and `shapePluginAPI` in `plugins/shape-plugin/src/worker/api.ts`, which is registered in `plugins/shape-plugin/src/worker/plugin.ts` under `api: shapePluginAPI`. The UI hook `plugins/shape-plugin/src/ui/hooks/useShapeAPI.ts` is stubbed and unused in runtime, but tests and docs still reference it. Shape persistence is split between CoreDB TreeNode payloads (handled in `plugins/shape-plugin/src/worker/handlers/ShapeEntityService.ts`) and Dexie tables in `plugins/shape-plugin/src/services/database/ShapeDB.ts`.

Route persistence lives in `plugins/route-plugin/src/services/database/RouteDB.ts`. Runtime Worker already exposes `RouteQueryAPI` through `packages/runtime-worker/src/services/RouteQueryService.ts` and `packages/common/api/src/WorkerAPI.ts`.

The Worker API facade is defined in `packages/common/api/src/WorkerAPI.ts` and wired in `app/src/worker-runtime/worker.ts` and `packages/ui/worker-client/src/workerBridge.ts`. The plugin-service-api type package lives at `packages/plugin-service-api/src/types` and is the canonical place to define Query/Mutation APIs.

In this plan, “Query API” means a read-only interface that does not mutate stored state. “Mutation API” means a write-only interface that updates or deletes persisted records. “Batch-control API” refers to the existing shared batch session methods in `packages/common/api/src/BatchControlAPI.ts` and their `WorkerAPI` wrapper.

## Plan of Work

First, inventory the existing ShapeAPI surface and decide which methods map to Query, which map to Mutation, and which belong to batch control or are obsolete. The guiding rule is that Query APIs only read persisted data, Mutation APIs only write or delete persisted data, and build-control remains separate. The `ShapeWorkerPlugin` registration will stop exporting `api: shapePluginAPI` and instead export new query/mutation adapters, while any build-only entry points are kept behind a smaller, dedicated internal interface used by the worker runtime.

Next, define new `ShapeQueryAPI`, `ShapeMutationAPI`, and `RouteMutationAPI` in `packages/plugin-service-api/src/types`, then export them from `packages/plugin-service-api/src/index.ts`. The Shape APIs will cover: reading batch session state, processed feature counts, vector tile metadata, and stored tile data; and mutating cleanup operations such as deleting sessions, tasks, tiles, and cached data for a node. The Route mutation API will cover cleanup of routeResults and routeCache for a node, and will be implemented using `RouteDatabase`.

Then, implement new runtime-worker services: `ShapeQueryService`, `ShapeMutationService`, and `RouteMutationService`. These services should construct their plugin DBs internally (using dynamic imports of `@hierarchidb/shape-plugin` and `@hierarchidb/route-plugin/database`), read/write only through those DB instances, and expose deterministic read/write behavior. Update `packages/runtime-worker/src/WorkerService.ts` to instantiate these services and provide getters. Add new methods to `packages/common/api/src/WorkerAPI.ts` and the worker runtime API facade in `app/src/worker-runtime/worker.ts`, then expose them from `packages/ui/worker-client/src/workerBridge.ts`.

Finally, refactor the shape-plugin worker exports: remove `ShapeAPI` type exports from `plugins/shape-plugin/src/common/types/index.ts` and the `useShapeAPI` hook plus its tests. The worker plugin should stop exposing `api: shapePluginAPI` and instead rely on the runtime-worker `ShapeQueryAPI`/`ShapeMutationAPI` wiring. Any remaining build-specific calls should use the shared build-control API rather than plugin-specific methods. Update or remove docs referencing the old ShapeAPI.

## Concrete Steps

1) Inventory the ShapeAPI surface and current uses.
   - Command (repo root):
     rg -n "ShapeAPI|shapePluginAPI|useShapeAPI" plugins/shape-plugin/src
   - Expected outcome: identify all direct references and confirm runtime UI has no active dependency.

2) Define new interfaces.
   - Edit `packages/plugin-service-api/src/types/ShapeQueryAPI.ts` and `packages/plugin-service-api/src/types/ShapeMutationAPI.ts` (new files).
   - Edit `packages/plugin-service-api/src/types/RouteMutationAPI.ts` (new file).
   - Update `packages/plugin-service-api/src/index.ts` to export these types.

3) Implement runtime-worker services.
   - Add `packages/runtime-worker/src/services/ShapeQueryService.ts` and `packages/runtime-worker/src/services/ShapeMutationService.ts`.
   - Add `packages/runtime-worker/src/services/RouteMutationService.ts`.
   - Update `packages/runtime-worker/src/WorkerService.ts` to instantiate and return these services.

4) Wire WorkerAPI surface.
   - Update `packages/common/api/src/WorkerAPI.ts` to add:
     - getShapeQueryAPI(): Promise<ShapeQueryAPI>
     - getShapeMutationAPI(): Promise<ShapeMutationAPI>
     - getRouteMutationAPI(): Promise<RouteMutationAPI>
   - Update `app/src/worker-runtime/worker.ts` to expose these methods via Comlink.
   - Update `packages/ui/worker-client/src/workerBridge.ts` to add corresponding methods.

5) Remove the ShapeAPI surface from shape-plugin.
   - Remove `ShapeAPI` exports from `plugins/shape-plugin/src/common/types/index.ts` and `plugins/shape-plugin/src/index.ts`.
   - Delete `plugins/shape-plugin/src/ui/hooks/useShapeAPI.ts` and its unit tests.
   - Update `plugins/shape-plugin/src/worker/plugin.ts` to stop exporting `api: shapePluginAPI`; keep batch internals private.
   - Update docs referencing ShapeAPI under `plugins/shape-plugin/docs` or `docs/deprecated` as needed.

## Validation and Acceptance

Run targeted typechecks and confirm behavior:

- `pnpm --filter @hierarchidb/runtime-worker typecheck`
- `pnpm --filter @hierarchidb/plugin-service-api typecheck`
- `pnpm --filter @hierarchidb/shape-plugin typecheck`
- `pnpm --filter @hierarchidb/route-plugin typecheck`

Acceptance is met when:

- `getShapeQueryAPI()` and `getShapeMutationAPI()` are available from the WorkerAPI client and return working proxies.
- `getRouteMutationAPI()` is available and can remove routeResults for a node (verified by a small test or a manual call).
- The shape plugin no longer exposes `ShapeAPI`, and no runtime references remain.
- The shared build-control API continues to start and monitor shape batch sessions without needing `shapePluginAPI` outside the worker-internal batch adapter.

## Idempotence and Recovery

All steps are additive and reversible. If the new APIs cause regressions, revert the added types and services, then restore the previous `ShapeAPI` exports and `shapePluginAPI` exposure in `plugins/shape-plugin/src/worker/plugin.ts`. No data migrations are required, and the Dexie schemas remain unchanged.

## Artifacts and Notes

Example interface sketch (implemented signatures):

  export interface ShapeQueryAPI {
    listBatchSessions(nodeId: NodeId): Promise<ShapeBatchSessionSummary[]>;
    getBatchSession(sessionId: string): Promise<ShapeBatchSessionSummary | null>;
    listBatchTasks(sessionId: string): Promise<ShapeBatchTaskSummary[]>;
    getProcessingStatus(nodeId: NodeId): Promise<ShapeProcessingStatus | null>;
    getProcessedFeatureCount(nodeId: NodeId): Promise<number>;
    getVectorTileInfo(nodeId: NodeId, z: number, x: number, y: number): Promise<ShapeTileInfo | null>;
    getVectorTile(nodeId: NodeId, z: number, x: number, y: number): Promise<Uint8Array | null>;
    listVectorTiles(nodeId: NodeId): Promise<ShapeTileSummaryEntry[]>;
    getVectorTileSummary(nodeId: NodeId): Promise<ShapeTileSummary>;
  }

  export interface ShapeMutationAPI {
    deleteBatchSession(sessionId: string): Promise<void>;
    deleteBatchTasks(sessionId: string): Promise<void>;
    deleteVectorTiles(nodeId: NodeId): Promise<void>;
    deleteTileBuffers(nodeId: NodeId): Promise<void>;
    deleteFeatureBuffers(nodeId: NodeId): Promise<void>;
    deleteFeatures(nodeId: NodeId): Promise<void>;
    clearCache(nodeId: NodeId): Promise<number>;
    cleanupProcessingData(nodeId: NodeId): Promise<void>;
  }

  export interface RouteMutationAPI {
    deleteRouteResults(nodeId: NodeId): Promise<void>;
    deleteRouteCache(nodeId: NodeId): Promise<void>;
    deleteRouteCursors(nodeId: NodeId): Promise<void>;
    deletePendingSessions(nodeId: NodeId): Promise<void>;
  }

## Interfaces and Dependencies

Use `@hierarchidb/plugin-service-api` as the single source of truth for the new interfaces. Runtime implementations must live in `packages/runtime-worker/src/services` and should only import plugin DBs through dynamic imports to avoid bundler issues. The UI must access these APIs only through `WorkerAPI` methods wired in `app/src/worker-runtime/worker.ts` and `packages/ui/worker-client/src/workerBridge.ts`.

Location-related APIs are explicitly excluded from this plan and must not be changed during implementation.

Plan updated on 2025-12-26: initial ExecPlan creation for Shape/Route API rework.
Plan updated on 2025-12-26: recorded implementation progress and decisions after wiring new APIs.
