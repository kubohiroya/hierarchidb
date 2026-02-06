# Align extract task settings with TreeQueryAPI SSOT

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repo at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

Extract task execution currently reads tolerance, min-area, zoom levels, and tile size from task fields or untyped payloads. After this change, batch tasks are typed with generics, and each task’s input/output payloads are minimal, typed keys stored in Dexie. Extract1/Extract2 execution always reads settings from the ShapeEntity draft stored on the TreeNode via TreeQueryAPI, making the draft data the single source of truth. You can see it working by running an extract stage and observing that the adapters and worker only use TreeQueryAPI-derived settings and typed task payloads.

## Progress

- [x] (2025-12-30 18:22 JST) Created this ExecPlan and captured target files and approach.
- [ ] Define typed task input/output payloads and generic BatchTaskRecord (Download/Extract1/Extract2/VectorTile).
- [ ] Replace task-field usage with TreeQueryAPI-derived settings in Extract1/2 adapters and worker.
- [ ] Remove ExtractTask field copies (tolerance/minArea/zoomLevels/tileSize) and update task builders.
- [ ] Update task registration and status updates to use typed input/output payloads in Dexie.
- [ ] Validate extract execution paths and update TASKS.md log with results.

## Surprises & Discoveries

- Observation: None yet.
  Evidence: N/A

## Decision Log

- Decision: Use generic BatchTaskRecord with typed input/output payloads and keep only minimal keys in Dexie (no untyped Record payloads).
  Rationale: Enforces SSOT in Dexie with explicit schemas and removes ad-hoc payload usage.
  Date/Author: 2025-12-30 / Codex

- Decision: Use TreeQueryService (TreeQueryAPI implementation) to read TreeNode draft data for extract settings at execution time.
  Rationale: Keeps configuration in the draft SSOT and avoids persisting config copies in task payloads.
  Date/Author: 2025-12-30 / Codex

## Outcomes & Retrospective

- Pending. This will be updated after implementation and validation.

## Context and Orientation

Shape batch processing lives in `plugins/shape-plugin/src/services/batch/`. `SessionController.ts` builds Extract1/Extract2 tasks and registers them in Dexie. `LocalExtractAdapters.ts` runs in-process; `ShapeWorkerExtractAdapters.ts` dispatches to `shapeStageWorker.ts` via Comlink. Task payloads are stored in `packages//src/ShapeDB.ts` as `BatchTaskRecord`. The source of truth for shape Settings is `ShapeEntity.draftData.batchConfig`, persisted on the TreeNode. TreeQueryAPI (defined in `packages/common/api/src/TreeQueryAPI.ts`) is the read-only API for accessing TreeNode data; TreeQueryService (runtime-worker) implements it on top of CoreDB. This change will remove untyped `Record<string, unknown>` payloads, add typed input/output payloads for all task types, and read extract settings from TreeQueryAPI at execution time.

## Plan of Work

First, define typed input/output payloads for all task types and make `BatchTaskRecord` generic in `packages//src/ShapeDB.ts`. Add `DownloadTaskInputData`, `DownloadTaskOutputData`, `Extract1TaskInputData`, `Extract1TaskOutputData`, `Extract2TaskInputData`, `Extract2TaskOutputData`, `VectorTileTaskInputData`, and `VectorTileTaskOutputData`. Replace `Record<string, unknown>` usages throughout the shape-plugin with these typed payloads. Update `shapeDB` helpers and any task registration logic to use typed payloads.

Next, expose TreeQueryService for plugin usage by exporting it from `packages/runtime-worker/src/index.ts`, allowing shape-plugin code to obtain a TreeQueryAPI without deep imports. Add a helper in `plugins/shape-plugin/src/services/batch/utils/` that acquires TreeQueryAPI via TreeQueryService and CoreDB, loads the TreeNode by `nodeId`, and extracts `ShapeEntity` draft data. Use `mergeBatchConfig` with `DEFAULT_PROCESSING_CONFIG` to normalize defaults. From the merged config, compute Extract1 settings (tolerance, minimumArea, feature filter parameters) and Extract2 settings (tolerance, zoomLevels, tileSize, quantize, extractionMode, enablePerFeatureExtraction). The helper should prefer `draftData` when present and fall back to `data` only if draftData is missing, logging a warning when a fallback is required.

Then, update `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts` and `plugins/shape-plugin/src/services/batch/adapters/ShapeWorkerExtractAdapters.ts` to call the helper once per adapter invocation, then construct an execution input object by combining typed task input payloads with SSOT-derived settings. Ensure the execution input includes `tolerance`, `minimumArea`, `zoomLevels`, and `tileSize` from TreeQueryAPI, while task payloads remain minimal. The adapters should no longer reference `task.tolerance`, `task.minArea`, `task.zoomLevels`, or `task.tileSize`.

Then, update `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` to remove all task-field fallbacks for those settings and rely solely on execution input values. This keeps the worker consistent with the adapters’ TreeQueryAPI-derived settings.

Finally, remove the redundant fields from `ExtractTask` in `plugins/shape-plugin/src/common/types/build.ts` and update task builders in `plugins/shape-plugin/src/services/batch/SessionController.ts` to stop setting those fields. Adjust any remaining references accordingly.

## Concrete Steps

1) Export TreeQueryService from runtime-worker.
   - Edit `packages/runtime-worker/src/index.ts` and add `export { TreeQueryService } from './services/TreeQueryService.js';`.

2) Add a helper to resolve extract settings from TreeQueryAPI.
   - Create `plugins/shape-plugin/src/services/batch/utils/resolveExtractSettings.ts` (new file).
   - Use `CoreDB.getSingleton()` and `TreeQueryService.getSingleton(coreDB)` to obtain TreeQueryAPI.
   - Use `query.getNode(nodeId)` to read the TreeNode and extract draftData.
   - Use `mergeBatchConfig` with `DEFAULT_PROCESSING_CONFIG` to compute settings.
   - Return a structured object with extract1/extract2 settings used by adapters.

3) Update LocalExtractAdapters and ShapeWorkerExtractAdapters.
   - In `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts`, call the helper once at the start of `process()` and merge settings into each task’s `input` before use.
   - In `plugins/shape-plugin/src/services/batch/adapters/ShapeWorkerExtractAdapters.ts`, do the same and ensure the `input` passed to the worker contains the SSOT-derived values.
   - Remove uses of `task.tolerance`, `task.minArea`, `task.zoomLevels`, and `task.tileSize`.

4) Update shapeStageWorker to use inputs only.
   - In `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`, replace `task.*` fallbacks with `input.*` for the specified fields.

5) Remove redundant ExtractTask fields and task builder assignments.
   - Edit `plugins/shape-plugin/src/common/types/build.ts` to remove those properties from `ExtractTask`.
   - Remove their assignments in `plugins/shape-plugin/src/services/batch/SessionController.ts` when building Extract1/Extract2 tasks.

6) Update TASKS.md log with outcomes, reasons, rollback, and verification status.

## Validation and Acceptance

Run the following from the repo root:

  - pnpm --filter @hierarchidb/shape-plugin typecheck
  - pnpm --filter @hierarchidb/shape-plugin test

Acceptance criteria:

- Task payloads are typed (no `Record<string, unknown>` for `inputData`/`outputData`).
- Extract adapters and the stage worker no longer read task-field copies for tolerance/minArea/zoomLevels/tileSize.
- Extract settings are resolved via TreeQueryAPI from ShapeEntity draft data.
- TypeScript builds without references to removed task fields.
- Batch extraction still runs with the expected settings derived from the draft config.

## Idempotence and Recovery

These steps are safe to repeat. Roll back by reverting changes to:

- `packages/runtime-worker/src/index.ts`
- `plugins/shape-plugin/src/services/batch/utils/resolveExtractSettings.ts`
- `plugins/shape-plugin/src/services/batch/adapters/LocalExtractAdapters.ts`
- `plugins/shape-plugin/src/services/batch/adapters/ShapeWorkerExtractAdapters.ts`
- `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`
- `plugins/shape-plugin/src/common/types/build.ts`
- `plugins/shape-plugin/src/services/batch/SessionController.ts`

## Artifacts and Notes

- Expected code excerpt after changes (example):

  resolveExtractSettings(nodeId) -> { extract1: { tolerance, minimumArea }, extract2: { tolerance, zoomLevels, tileSize } }
  input = { ...input, ...settings.extract1 }

## Interfaces and Dependencies

- TreeQueryAPI: `packages/common/api/src/TreeQueryAPI.ts` (read-only TreeNode access).
- TreeQueryService: `packages/runtime-worker/src/services/TreeQueryService.ts` (TreeQueryAPI implementation).
- CoreDB: `packages/runtime-worker/src/services/CoreDB.ts` (Dexie-backed storage).
- ShapeEntity: `plugins/shape-plugin/src/common/types/ShapeEntity.ts` (source of draft batchConfig).
- mergeBatchConfig/DEFAULT_PROCESSING_CONFIG: `plugins/shape-plugin/src/services/utils/utils.ts` and `plugins/shape-plugin/src/common/types/constants.ts`.

Plan update note (2025-12-30 18:36 JST): Expanded ExecPlan to introduce typed task payloads and generic BatchTaskRecord alongside TreeQueryAPI-based extract settings.
