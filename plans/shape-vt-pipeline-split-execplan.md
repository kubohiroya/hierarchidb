# Shape VT pipeline split into stages

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with PLANS.md at the repository root.

## Purpose / Big Picture

This change makes the shape vector tile pipeline easier to reason about and test by splitting the monolithic pipeline into distinct stages: fetch, transform, vt, metadata, and cleanup. After this change, a developer can locate each stage in its own file, test its inputs and outputs in isolation, and understand how task creation, execution, and persistence flow. The user-visible behavior (generated tiles, stage progress, metadata) should remain the same. A human can verify success by running the same build and seeing the same tiles and metadata counts, plus tests that pass before and after the refactor.

## Progress

- [x] (2026-01-26 23:40 JST) Read PLANS.md and locate the current pipeline implementation.
- [x] (2026-01-26 23:58 JST) Draft the stage boundaries and identify the outputs for each stage.
- [x] (2026-01-27 00:20 JST) Create stage modules and move code with zero behavior changes.
- [x] (2026-01-27 00:20 JST) Wire the new stage modules from the pipeline entry point.
- [x] (2026-01-27 00:24 JST) Run typecheck for @hierarchidb/shape-plugin (exit 0).
- [ ] (2026-01-27 00:27 JST) Run shape-plugin tests (exit 0; 9 passed / 1 skipped).

## Surprises & Discoveries

- Observation: shape-plugin full-flow test depends on external network and can fail when geoboundaries.org is unreachable.
  Evidence: Earlier vitest failure reported ENOTFOUND for geoboundaries.org; current run succeeded.

## Decision Log

- Decision: Split the pipeline into five stage modules and keep a thin orchestrator in shapePipeline.ts.
  Rationale: Maintains the current entry point while making each stage independently testable.
  Date/Author: 2026-01-26 / Codex

- Decision: Extract shared helpers into shapePipelineShared.ts to avoid circular imports between stage modules and the orchestrator.
  Rationale: Allows stage modules to reuse task builders and cache helpers while keeping shapePipeline.ts minimal.
  Date/Author: 2026-01-27 / Codex

## Outcomes & Retrospective

- Completed pipeline split into stage modules with unchanged behavior. Tests pass in networked environment; keep note about external dependency.

## Context and Orientation

The current pipeline lives in `plugins/shape-plugin/src/services/vt/shapePipeline.ts`. It handles task queue cleanup, stage task creation, stage execution for fetch/transform/vt, metadata extraction, and cache cleanup. It also constructs tile records and resolves metadata lookups. Supporting helpers live in the same file (for example `buildFeatureMetadataFromTransformCaches`, `buildBands`, and task filtering helpers). The pipeline uses the task queue from `@hierarchidb/vt-orchestrator` and stores tiles via `shapeMutationAPIImpl` and metadata via `shapeMutationAPIImpl.putFeatureMetadata`. This plan preserves the public entry point `runShapePipeline` but will move most of its logic into stage modules. A “stage module” is a file that contains the function and types needed for one pipeline stage, for example “transform stage” tasks and execution.

## Plan of Work

First, capture the current stage boundaries by locating the sections inside `runShapePipeline`: fetch stage, transform stage, vt stage, metadata and stage metadata updates, and cleanup. For each stage, define a small input/output interface so it can be invoked from a thin orchestrator. Then create new files under `plugins/shape-plugin/src/services/vt/` to hold the extracted logic. Proposed files:

- `shapePipelineStages.ts` for common helpers like `summarizeStageCounts`, `resetStageRunningTasks`, and `finalizePendingStageTasks`.
- `shapeFetchStageRunner.ts` for the fetch stage wrapper that calls `runShapeFetchStage` and decides stop conditions.
- `shapeTransformStageRunner.ts` for task building, filtering, and `runStageTasks` for transform.
- `shapeVtStageRunner.ts` for vt task building, vt handler creation, and vt stage execution.
- `shapeMetadataStage.ts` for feature metadata extraction and stage metadata updates.
- `shapePipelineCleanup.ts` for cleanup and recycling toggles.

Adjust filenames if the existing codebase prefers another naming convention; the key is that each stage has its own file and the orchestrator imports them. Ensure each new module exports a single main function and any local types it needs. The orchestrator in `shapePipeline.ts` should keep only orchestration, shared initialization, and sequence control.

During extraction, keep behavior identical. Do not change task payload shapes, task ordering, or error handling. After moving code, update imports and ensure the TS types compile. If new module needs access to constants or helpers, move those helpers out of `shapePipeline.ts` into shared modules rather than duplicating logic.

Add or update unit tests where feasible. If there are existing tests that cover pipeline behavior, update them only if required by type changes. If no direct tests exist, add tests for the newly extracted helpers such as task filtering and band construction. Keep tests deterministic and based on existing fixtures. If a test would require large data, keep it as a small “task-building” test.

## Concrete Steps

1) Inventory stage sections in `shapePipeline.ts` and note what they return (for example, stop conditions or task counts). Update the Progress section to reflect the planned stage boundaries.

2) Create the new stage modules and move helpers without changing logic. For each module, write a short top-of-file comment describing the stage.

3) Modify `shapePipeline.ts` to import the stage runners and call them in sequence, passing the same parameters and respecting `buildContinuationPolicy` logic.

4) Run typecheck for shape-plugin.

   Working directory: repository root
   Command:
     pnpm --filter @hierarchidb/shape-plugin typecheck

   Expected result:
     Exit code 0

5) Run shape-plugin tests if they cover this area.

   Working directory: repository root
   Command:
     pnpm --filter @hierarchidb/shape-plugin test

   Expected result:
     Exit code 0

6) Update the linked GitHub Issue log entries with start/update/done, including the command outputs summary.

## Validation and Acceptance

Acceptance is satisfied when the pipeline still produces the same tile records and metadata for a given node, and the task stages execute in the same order with no change in counts. This should be demonstrated via tests passing, and by running a build that previously succeeded (if you have a local repro). The core acceptance proof is: `pnpm --filter @hierarchidb/shape-plugin typecheck` exits 0, and any stage tests added for task building pass.

## Idempotence and Recovery

All extraction steps are safe to repeat because they move code into new modules without altering runtime data. If the refactor fails, revert the new module files and re-assemble the code back into `shapePipeline.ts`. No data migrations are involved.

## Artifacts and Notes

- Expected diff: new stage runner files in `plugins/shape-plugin/src/services/vt/` and a reduced `shapePipeline.ts` with orchestration only.
- Example proof (typecheck):
  pnpm --filter @hierarchidb/shape-plugin typecheck
  ...exit 0...

## Interfaces and Dependencies

- The orchestrator `runShapePipeline` remains the public entry point.
- Stage runner functions must accept the existing `ShapePipelineParams` and derived inputs.
- Use `@hierarchidb/vt-orchestrator` helpers as they exist today; do not change their public interfaces.
- No new external libraries are introduced.

Revision note: Initial plan created to split shape pipeline into explicit stages while preserving behavior and tests.
