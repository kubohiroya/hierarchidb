# Shape extract2 zoom ranges and scaled simplification

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is maintained in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Enable extract2 to generate tasks per configured zoom range segment and scale simplification strength based on the most detailed zoom in each segment. This makes low-zoom ranges more aggressively simplified while preserving detail at higher zooms. Users can verify that the zoom-range slider and segment settings control extract2 behavior and that vectortile processing starts only after extract2 tasks for those ranges complete.

## Progress

- [x] (2026-01-04 14:40 JST) Review how zoom range segmentation is currently stored and how extract2 task generation flows.
- [x] (2026-01-04 15:10 JST) Add a shared helper to build zoom range segments (range + breakpoints) and wire it into SessionController.
- [x] (2026-01-04 15:10 JST) Expand extract2 task generation to create per-range tasks and persist zoomRange/zoomLevels/tolerance in inputs.
- [x] (2026-01-04 15:10 JST) Ensure per-task inputs override extract2 defaults in ShapeWorkerExtract2Adapter.
- [ ] Verify that vectortile inputs use tileId relations so each zoom range’s extract2 outputs are used as intended.
- [x] (2026-01-04 15:10 JST) Update type definitions (shape-store / plugin-service-api / common types) to carry new input fields.
- [x] (2026-01-04 15:10 JST) Update test expectations or add tests for the new task generation behavior.
- [ ] Record final notes, rollback details, and verification results in TASKS.md (log updated; verification pending).

## Surprises & Discoveries

- None observed so far.

## Decision Log

- Decision: Scale extract2 tolerance linearly by `overallMaxZoom / rangeMaxZoom` for each zoom range segment.
  Rationale: Lower zoom ranges become more simplified while the highest zoom range keeps the configured tolerance, which matches the expected detail gradient.
  Date/Author: 2026-01-04 / Codex

## Outcomes & Retrospective

- Pending (to be filled after completion).

## Context and Orientation

- Batch stages are orchestrated in `plugins/shape-plugin/src/services/batch/SessionController.ts` in the order download → extract1 → extract2 → vectortile.
- extract2 task generation lives in `plugins/shape-plugin/src/services/batch/session/extract2/resolveExtract2BuildStrategy.ts` and the task builders under `session/extract2/`.
- extract2 execution uses per-task inputs loaded by `plugins/shape-plugin/src/services/batch/adapters/ShapeWorkerExtractAdapters.ts` and forwarded to the worker pool.
- Task input data types live in `packages/features/shape-store/src/ShapeDB.ts` and `packages/plugin-service-api/src/types/shapeBatchTypes.ts`.
- Zoom segmentation settings originate in `BatchConfig.tileConfig.zoomBreakpoints` and are mapped into `BatchSessionConfig.vectorTiles` in `plugins/shape-plugin/src/worker/api.ts`.

## Plan of Work

Add `zoomBreakpoints` to the session config for vector tiles, build zoom range segments in SessionController, and pass those segments into extract2 task generation. For each range, generate a task with range-specific `zoomLevels`, `zoomRange`, and `tolerance`. Extend task IDs to include a zoom-range label to avoid collisions. Update extract2 adapters so per-task inputs override defaults, and adjust tests to reflect the new task count and inputs.

## Concrete Steps

1. Extend `Extract2TaskInputData` in `packages/features/shape-store/src/ShapeDB.ts` and `packages/plugin-service-api/src/types/shapeBatchTypes.ts` with `zoomRange`, `zoomRangeLabel`, and `tolerance`.
2. Add `zoomBreakpoints?: number[]` to `GenerateVectorTilesConfig` in `plugins/shape-plugin/src/common/types/BatchConfig.ts` and map `tileConfig.zoomBreakpoints` in `plugins/shape-plugin/src/worker/api.ts`.
3. Introduce `plugins/shape-plugin/src/services/batch/session/extract2/zoomRanges.ts` and use it from SessionController.
4. Update extract2 task builders (`buildExtract2TasksFromExtract1.ts`, `extract2/topojsonGrouping.ts`) to create tasks per zoom range and store per-range inputs.
5. Adjust `processingIds.ts` to incorporate `zoomRangeLabel` in task IDs.
6. Update extract2 adapters (`ShapeWorkerExtractAdapters.ts`, `LocalExtractAdapters.ts`) so per-task input overrides defaults.
7. Update or add tests for the new task count and input payloads.

## Validation and Acceptance

- Manual: set zoom range 0–7, segments 2, breakpoints [0,4,7]; verify extract2 tasks persist ranges [0,4] and [4,7] with distinct IDs and tolerances, and vectortile starts only after extract2 completes.
- Tests: run `pnpm --filter @hierarchidb/shape-plugin test` and confirm updated extract2 task generation tests pass.

## Idempotence and Recovery

- Zoom range segment generation is deterministic; re-running does not change persisted data beyond re-registering tasks.
- Rollback by reverting extract2 task generation changes and task ID updates, restoring the previous single-range behavior.

## Artifacts and Notes

- None yet.

## Interfaces and Dependencies

- `Extract2TaskInputData` adds `zoomRange?: [number, number]`, `zoomRangeLabel?: string`, `tolerance?: number`.
- `GenerateVectorTilesConfig` adds `zoomBreakpoints?: number[]`.
- `buildProcessingTaskId` accepts `zoomRangeLabel` and includes it in the ID.

Update Note (2026-01-04): Progress entries were updated to reflect implemented steps and tests updated.
