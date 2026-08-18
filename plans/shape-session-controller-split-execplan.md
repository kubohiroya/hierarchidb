# Split SessionController and Route Batch Data Through APIs

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked in at `PLANS.md`. Maintain this document in accordance with that file.

## Purpose / Big Picture

After this change, the shape-plugin batch pipeline will run without any direct Dexie access inside `SessionController`. All batch data reads and writes (tasks, buffers, metadata, tiles, stats) will flow through public APIs (TreeQueryAPI and ShapeQueryAPI/ShapeMutationAPI), and `SessionController` will only orchestrate stage transitions. This makes the batch flow easier to reason about, easier to test, and consistent with the project rule that persistent data is accessed via API layers rather than direct database calls.

A human can verify the change by running the same batch flow (download → extract1 → extract2 → vector tile) and observing identical progress updates and tile outputs, while also seeing that no `Dexie` tables are referenced directly in `SessionController`. Shape-plugin typechecking must remain green.

## Progress

- [x] (2025-12-31 05:40 JST) Reviewed SessionController and cataloged Dexie access points for tasks, buffers, tiles, and metadata.
- [x] (2025-12-31 05:40 JST) Defined API additions in ShapeQueryAPI/ShapeMutationAPI and added shapeBatchTypes for batch/metadata/buffer records.
- [x] (2025-12-31 05:40 JST) Split SessionController into TaskRegistry/ArtifactStore plus a local API client, and removed direct Dexie imports.
- [x] (2025-12-31 05:45 JST) Replaced SessionController Dexie calls with API calls and ran `pnpm --filter @hierarchidb/shape-plugin typecheck` (exit 0).
- [ ] (2025-12-31 05:45 JST) Evaluate adapter-level Dexie usage and decide if follow-up migration is required.

## Surprises & Discoveries

- Observation: none yet.
  Evidence: n/a

## Decision Log

- Decision: Start by extending ShapeQueryAPI/ShapeMutationAPI instead of introducing a brand-new batch API.
  Rationale: These APIs already exist on the worker bridge and are the explicit surface used in UI and plugins; expanding them keeps wiring minimal and aligns with the user request to use TreeQueryAPI/ShapeQueryAPI as the primary path.
  Date/Author: 2025-12-31 / Codex
- Decision: Introduce LocalShapeQueryApi/LocalShapeMutationApi in shape-plugin to back SessionController without WorkerBridge.
  Rationale: SessionController runs in plugin-side code where WorkerBridge may be unavailable in tests; a local implementation keeps API boundaries while avoiding UI-only dependencies.
  Date/Author: 2025-12-31 / Codex

## Outcomes & Retrospective

SessionController now delegates batch task and artifact access to TaskRegistry/ArtifactStore, using ShapeQueryAPI/ShapeMutationAPI implementations instead of direct Dexie calls. The shape-plugin typecheck succeeds. Remaining consideration: adapters still touch Dexie directly, so a follow-up migration may be needed if the API-only rule should extend beyond SessionController.

## Context and Orientation

The shape-plugin batch pipeline is implemented in `plugins/shape-plugin/src/services/batch/SessionController.ts`. It currently orchestrates stages (`download`, `extract1`, `extract2`, `vectortile`) and also reads/writes Dexie tables directly via:

- `plugins/shape-plugin/src/services/database/ShapeDB.ts` (re-export of `@hierarchidb/shape-store`), which exposes batch tasks and vector tiles.
- `plugins/shape-plugin/src/services/database/EphemeralShapeDB.ts` for raw and extracted buffers.
- `plugins/shape-plugin/src/services/database/ShapeTileMetadataDB.ts` for source/feature metadata.
- `@hierarchidb/gis-sdk` `TilesDB` for vector tile storage.

The repo already defines public APIs for shape data:

- `packages/plugin-service-api/src/types/ShapeQueryAPI.ts` (read-only, currently batch status + tiles)
- `packages/plugin-service-api/src/types/ShapeMutationAPI.ts` (delete/cleanup operations)
- `packages/runtime-worker/src/services/ShapeQueryService.ts` (runtime implementation)
- `packages/runtime-worker/src/services/ShapeMutationService.ts` (runtime implementation)
- `packages/common/api/src/WorkerAPI.ts` (exposes APIs to the client)
- `packages/ui/worker-client/src/workerBridge.ts` (client-side access)

Tree data and working copy configuration are retrieved through `packages/common/api/src/TreeQueryAPI.ts`, accessed via WorkerAPI `getQueryAPI()`.

Terminology used here:

- Stage: One phase in the batch pipeline (download, extract1, extract2, vectortile).
- Task registry: A service that creates, updates, and resolves batch tasks (status, input, output) for a stage.
- Repository: A service that reads/writes batch artifacts (buffers, metadata, tiles) through APIs.
- Stats service: A service that computes geometry stats summaries and persists them via APIs.

## Plan of Work

First, inventory every direct database access inside `SessionController`. Each access will be assigned to one of the new services. The goal is to isolate concerns:

- SessionController becomes a stage orchestrator (start/stop/transition and progress reporting).
- Stage builders construct task lists and input maps from stage outputs.
- Task registry writes and reads task records via ShapeQueryAPI/ShapeMutationAPI.
- Repository handles raw/extracted buffers, vector tiles, and metadata reads/writes.
- Stats service summarizes geometry stats and persists stage summaries.

Next, extend the public APIs (ShapeQueryAPI/ShapeMutationAPI) so they can represent everything SessionController currently needs. All new methods must be implemented in `ShapeQueryService` and `ShapeMutationService`, then wired through WorkerAPI and workerBridge. If a method belongs to Tree data (e.g., draftData/draftMetadata), keep it on TreeQueryAPI or TreeMutationAPI.

Finally, refactor SessionController to use the new services and API methods. Remove direct Dexie imports. Update any dependent adapters or tests as needed, but keep the runtime behavior the same (e.g., completed tasks are skipped, metadata is persisted per stage, vector tiles are synchronized). Run shape-plugin typecheck and record the result.

## Concrete Steps

1) Catalog Dexie usage in SessionController.
   - File: `plugins/shape-plugin/src/services/batch/SessionController.ts`
   - Make a list of every call to ShapeDB/EphemeralShapeDB/ShapeTileMetadataDB/TilesDB.
   - Map each usage to the future service: TaskRegistry, Repository, or Stats.

2) Define API surface additions.
   - Files:
     - `packages/plugin-service-api/src/types/ShapeQueryAPI.ts`
     - `packages/plugin-service-api/src/types/ShapeMutationAPI.ts`
   - Add methods for:
     - batch task upsert/update/query (by nodeId, stage)
     - batch task input/output storage
     - raw/extracted buffer read/write
     - source/feature metadata upsert/delete/query
     - vector tile storage and retrieval (if not already covered)
   - Use explicit types; do not introduce loosely typed metadata bags. Values should be defined by TaskPayload and stored in Dexie by the API implementation.

3) Implement new API methods on runtime-worker services and wire them through WorkerAPI.
   - Files:
     - `packages/runtime-worker/src/services/ShapeQueryService.ts`
     - `packages/runtime-worker/src/services/ShapeMutationService.ts`
     - `packages/runtime-worker/src/WorkerService.ts`
     - `packages/common/api/src/WorkerAPI.ts`
     - `packages/ui/worker-client/src/workerBridge.ts`
   - Ensure each API method calls the existing Dexie tables, but only inside the service layer. SessionController must not access Dexie directly.

4) Split SessionController responsibilities.
   - Create new modules under `plugins/shape-plugin/src/services/batch/`:
     - `SessionTaskRegistry.ts` for batch task CRUD (API only).
     - `StageTaskBuilder.ts` or separate builder files for download/extract1/extract2/vectortile.
     - `BatchArtifactRepository.ts` for buffers, metadata, tile storage.
     - `StageStatsService.ts` for geometry stats summarization and persistence.
   - Update `SessionController.ts` to instantiate these services and delegate.
   - Remove all direct Dexie imports from SessionController.

5) Update adapters and callers.
   - If adapters or helpers previously relied on direct Dexie types, update them to accept inputs from the registry or repository.
   - Ensure Download/Extract/VectorTile stages still receive their inputs via `inputsByTaskId` maps.

6) Validate.
   - Run `pnpm --filter @hierarchidb/shape-plugin typecheck` from the repo root.
   - If new tests are added, run them and record results in the linked GitHub Issue worklog.

## Validation and Acceptance

- Run in repo root:
  - `pnpm --filter @hierarchidb/shape-plugin typecheck`
- Expected result: exit 0.
- Acceptance: SessionController no longer imports Dexie-related modules; all batch artifacts are accessed via ShapeQueryAPI/ShapeMutationAPI or TreeQueryAPI. Stage behavior remains unchanged (download → extract1 → extract2 → vectortile), and existing UI progress updates still reflect stage/task status.

## Idempotence and Recovery

- The refactor should be safe to re-run; new services are additive and can be re-edited without data migration.
- If issues occur, revert `plugins/shape-plugin/src/services/batch/**` changes and the API additions in `packages/plugin-service-api`, `packages/runtime-worker`, `packages/common/api`, and `packages/ui/worker-client`.

## Artifacts and Notes

- Expected command transcript for validation:
  - `pnpm --filter @hierarchidb/shape-plugin typecheck`
  - `...`
  - `Done in <time>`

## Interfaces and Dependencies

- Use existing types from `@hierarchidb/shape-store` and `@hierarchidb/plugin-service-api` for batch task and metadata records. Do not reintroduce `task.metadata` or `task.config` into task records.
- New API methods must be present in both TypeScript interface files and the runtime implementations.
- SessionController should only depend on:
  - Stage adapters
  - The new registry/repository/stats services
  - ShapeQueryAPI/ShapeMutationAPI/TreeQueryAPI clients via WorkerAPI

Update note: 2025-12-31 05:45 JST — Marked completed progress items, recorded the local API client decision, and documented the adapter-level follow-up as an open item after completing the SessionController/API refactor.
