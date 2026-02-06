# Implement Route Stage2/5/7 (GIS SDK, Naming Alignment, BaseBatchSessionManager)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repository root at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, GIS processing is centralized in the shared GIS SDK and invoked only through runtime-worker, batch config naming is consistent across shape/location/route, and batch session managers share a base implementation that owns lifecycle persistence. A developer can run shape/location/route typechecks without mismatched config naming, and batch sessions will report and persist status in a uniform way across plugins.

Note: The broader route reorg direction (RouteEntity/RouteLineString, IDE-GSM ingestion, Step2-6 behavior) is defined in `plans/route-plugin-reorg-spec.md` under "Revised Direction (2025-12)". This ExecPlan remains focused on Stage2/5/7 infrastructure only.

## Progress

- [x] (2025-12-26 20:41 JST) ExecPlan created.
- [ ] Stage 2 partially completed (2025-12-26 20:50 JST): StageProcessingService now uses EphemeralGisDB; remaining: adapter naming alignment and any SDK delegation gaps.
- [ ] Stage 5 partially completed (2025-12-26 21:05 JST): ObsolateBuildConfig aliases added for shape/location/route; remaining: finish naming alignment and update any remaining imports.
- [ ] Stage 7 partially completed (2025-12-26 21:25 JST): BaseBatchSessionManager hooks added and managers refactored; remaining: verify persistence coverage and adjust any remaining manager usage.
- [ ] Validation completed and results recorded in TASKS.md.

## Surprises & Discoveries

- Observation: runtime-worker already imports `@hierarchidb/gis-sdk`, but the SDK package is located under `packages/` and StageProcessingService still owns a local ephemeral buffer DB.
  Evidence: `packages/runtime-worker/src/services/StageProcessingService.ts`, `packages//src/index.ts`.
- Observation: shape/location/route batch sessions use `@hierarchidb/batch` (features/batch) while BaseBatchSessionManager lives in `packages/batch-runtime-services`.
  Evidence: `plugins/{shape,location,route}-plugin` imports `@hierarchidb/batch`, BaseBatchSessionManager imports `packages/batch-runtime-services/src/AbstractBatchSession.ts`.

## Decision Log

- Decision: Route uses runtime-worker only for GIS SDK access; direct SDK calls are not permitted.
  Rationale: Centralizes execution and preserves worker boundary semantics.
  Date/Author: 2025-12-26 / Codex
- Decision: BaseBatchSessionManager owns persistence hooks; plugin-specific persistence happens via hooks.
  Rationale: Keeps lifecycle semantics consistent while preserving plugin storage.
  Date/Author: 2025-12-26 / Codex
- Decision: Align batch config filenames to primary exports across shape/location/route, adding compatibility re-exports when needed.
  Rationale: Minimize breaking changes while enforcing consistent naming.
  Date/Author: 2025-12-26 / Codex

## Outcomes & Retrospective

Pending.

## Context and Orientation

Runtime-worker GIS processing lives in `packages/runtime-worker/src/services/StageProcessingService.ts`, which currently reads data from a local Dexie-based ephemeral DB and calls functions imported from `@hierarchidb/gis-sdk`. The GIS SDK code exists under `packages//src`, including `vectorTiles.ts` and `ephemeral/EphemeralGisDB.ts`.

Shape, location, and route batch managers are implemented under `plugins/*-plugin/src/services/batch`. Each plugin uses `@hierarchidb/batch` (located in `packages/`) for `AbstractBatchSession`, but the shared base manager lives under `packages/batch-runtime-services`.

Batch config/type naming is inconsistent: shape has `common/types/ObsolateBuildConfig.ts`, location has `common/types/batch-types.ts`, and route embeds processing config in `RouteEntity` types. The goal is to align filenames and exports while preserving public API compatibility.

## Plan of Work

First, complete Stage 2 by ensuring the GIS SDK is the exclusive home for GIS processing logic. Update runtime-worker’s StageProcessingService to stop owning an internal ephemeral buffer DB and instead use the SDK’s EphemeralGisDB (or equivalent shared buffer access) as the fallback data source. Ensure route continues to call runtime-worker for tile generation and that adapter/controller naming is consistent across plugins. Avoid direct SDK calls from route.

Second, implement Stage 5 naming alignment by normalizing batch config filenames and exports across shape/location/route. Create thin compatibility re-exports where needed to avoid breaking public APIs. Update internal imports in the three plugins to use the aligned names.

Third, implement Stage 7 by integrating BaseBatchSessionManager into shape/location/route managers. Extend the base with persistence hooks that are invoked on lifecycle transitions and progress updates, then move plugin-specific DB updates into those hooks. Ensure each manager registers AbstractBatchSession instances with the base so progress is emitted consistently.

## Concrete Steps

Stage 2 (GIS SDK):
  1) Update `packages/runtime-worker/src/services/StageProcessingService.ts` to replace the local ShapeEphemeralDB with the GIS SDK’s EphemeralGisDB access for buffer reads.
  2) Ensure StageProcessingService delegates all GIS computations to SDK functions (vector tiles, summaries).
  3) Align naming of adapter/controller components for shape/location/route, and collapse redundant adapters to direct runtime-worker calls where appropriate.
  4) Confirm route does not call SDK directly.

Stage 5 (Naming alignment):
  1) Inventory batch config/type files for shape/location/route and pick aligned names.
  2) Add new files with aligned names and re-export existing types where necessary.
  3) Update imports throughout plugins to use aligned names.
  4) Keep compatibility exports in place to avoid breaking downstream imports.

Stage 7 (BaseBatchSessionManager):
  1) Extend `packages/batch-runtime-services/src/BaseBatchSessionManager.ts` with optional persistence hooks, such as `onStatusChange` and `onProgress`.
  2) Refactor `plugins/shape-plugin/src/services/batch/BatchSessionManager.ts` to extend BaseBatchSessionManager and register ShapeBatchSession instances.
  3) Refactor `plugins/location-plugin/src/services/batch/BatchSessionManager.ts` likewise.
  4) Refactor `plugins/route-plugin/src/services/RouteBatchSessionOrchestrator.ts` to extend BaseBatchSessionManager and use shared progress emission.
  5) Move DB update logic into the new base hooks for each plugin.

## Validation and Acceptance

Run the following commands from the repository root and expect exit code 0:

  pnpm --filter @hierarchidb/runtime-worker typecheck
  pnpm --filter @hierarchidb/shape-plugin typecheck
  pnpm --filter @hierarchidb/location-plugin typecheck
  pnpm --filter @hierarchidb/route-plugin typecheck
  pnpm --filter @hierarchidb/batch-runtime-services typecheck

Acceptance requires:

1) StageProcessingService uses GIS SDK for all GIS logic and shared ephemeral buffers.
2) Batch config file naming is aligned across shape/location/route with compatibility exports.
3) Batch session managers extend BaseBatchSessionManager and use shared persistence hooks.

## Idempotence and Recovery

Changes are safe to reapply. If a step fails, revert the affected files and rerun typechecks. For Stage 5, keep compatibility re-exports so rollbacks do not break downstream imports.

## Artifacts and Notes

Record typecheck outputs and key diffs in `TASKS.md` under the Stage2/5/7 task log. Include any renamed file paths and compatibility export notes.

## Interfaces and Dependencies

- GIS SDK: `packages//src/index.ts`, `vectorTiles.ts`, `ephemeral/EphemeralGisDB.ts`.
- Runtime worker: `packages/runtime-worker/src/services/StageProcessingService.ts`.
- Base manager: `packages/batch-runtime-services/src/BaseBatchSessionManager.ts`.
- Plugin managers: `plugins/{shape,location,route}-plugin/src/services/batch`.
- Batch config types: `plugins/{shape,location,route}-plugin/src/common/types`.

Plan created on 2025-12-26 to execute Stage 2/5/7 in order.
