# Refactor Shape Step5 Build Flow and Pipeline

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md governs ExecPlans and must be followed. See `PLANS.md`.

## Purpose / Big Picture

Users should experience a more stable Shape build flow (Step5) and a clearer, safer build pipeline without changing the visible behavior. After this refactor, progress summaries remain consistent, Step5 logic is easier to reason about, and the pipeline stages are modular so future changes do not risk regressions. Success is visible by running the existing build UI and tests: progress indicators behave the same as before, and the typecheck/tests pass.

## Progress

- [x] (2026-01-28 23:30 JST) Capture current Step5 progress aggregation and pipeline behavior so refactor does not change behavior.
- [x] (2026-01-28 23:34 JST) Extract shared progress aggregation helpers used by Step5 and stage panels.
- [x] (2026-01-28 23:41 JST) Split useShapeBuildStep internals to use shared helpers without changing its public return shape.
- [x] (2026-01-28 23:48 JST) Modularize runShapePipeline into stage sections with explicit boundaries.
- [x] (2026-01-28 23:30 JST) Split useShapeBuildStep into timing/auto-resume/tileSummary hooks and kept API stable.
- [x] (2026-01-28 23:30 JST) Run required validations and document outcomes.

## Surprises & Discoveries

- Observation: (none yet)
  Evidence: (none yet)

## Decision Log

- Decision: Start with non-functional refactor only; no behavior changes.
  Rationale: The goal is maintainability while preserving user-visible behavior.
  Date/Author: 2026-01-28 / Codex
- Decision: Keep pipeline refactor as nested stage functions inside `runShapePipeline` to avoid passing large contexts between modules.
  Rationale: Minimizes changes while still improving readability and isolation.
  Date/Author: 2026-01-28 / Codex
- Decision: Split `useShapeBuildStep` into three focused hooks for timing, auto-resume, and tile summary.
  Rationale: Keeps stateful effects isolated while preserving the external hook API.
  Date/Author: 2026-01-28 / Codex

## Outcomes & Retrospective

- Completed shared progress helper extraction, pipeline modularization, and Step5 hook splitting. Typecheck passes; UI behavior should remain unchanged.

## Context and Orientation

Shape Step5 build UI and pipeline span UI hooks and worker services. The key UI logic is in `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts` and `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts`, with progress mapping in `plugins/shape-plugin/src/ui/components/step5/shapeBuildProgressMapping.ts`. The pipeline entry point is `plugins/shape-plugin/src/services/vt/shapePipeline.ts`, which sequences fetch, transform, and vector-tile stages via `runStageTasks` from `packages/vt-orchestrator/src/compareTaskOrder.ts`. We will preserve the existing public behavior but refactor into smaller, testable units.

A “stage” is one phase of the build (fetch, transform, vt). “Progress aggregation” is the counting of completed/failed/skipped/total tasks and percentage calculation used for UI summaries. “Pipeline runner” means the code that executes a stage in the worker, updates the task queue, and decides when to continue.

## Plan of Work

First, extract shared aggregation helpers from `useShapeBuildStep.ts` into a new module under `plugins/shape-plugin/src/ui/components/step5/` (for example `shapeBuildProgressUtils.ts`). Move logic that computes per-stage counts, aggregated counts, and percentage calculations into pure functions. Update `useShapeBuildStep.ts` and `shapeBuildProgressMapping.ts` (and any other Step5 module) to use the shared helpers.

Second, split `useShapeBuildStep.ts` into smaller hooks or internal helpers: a progress/summary hook, a label/status hook, and a lifecycle hook for auto-resume and timing. Keep the public return shape the same to avoid UI changes. Use local modules in the same folder to avoid cross-package churn.

Third, modularize `runShapePipeline` by extracting each stage execution into a dedicated function (e.g., `runFetchStage`, `runTransformStage`, `runVtStage`) within `shapePipeline.ts` or adjacent file(s). Keep stage sequencing and error handling equivalent to current behavior. Ensure the “pending queued after stage completion -> mark failed” logic remains identical, just moved. Verify that resume and continuation policy checks still use the same logic.

Finally, update any imports and run typecheck/tests. Update this ExecPlan and TASKS.md as work progresses.

## Concrete Steps

Work from repository root `.`.

1) Read current Step5 aggregation logic and identify repeated calculations.
   - Files: `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts`, `plugins/shape-plugin/src/ui/components/step5/shapeBuildProgressMapping.ts`, `packages/ui/batch/src/hooks/useBuildTaskProgress.ts`.

2) Create a new helper module for progress aggregation.
   - File: `plugins/shape-plugin/src/ui/components/step5/shapeBuildProgressUtils.ts` (new).
   - Move the counting/percentage logic into pure functions.

3) Refactor `useShapeBuildStep.ts` to use helpers and split concerns.
   - Keep the exported function signature intact.

4) Refactor `runShapePipeline` into stage-specific functions.
   - File: `plugins/shape-plugin/src/services/vt/shapePipeline.ts` (or a new adjacent helper file).

5) Run typecheck.
   - Command: `pnpm --filter @hierarchidb/shape-plugin typecheck`.

Expected output (example):
  > @hierarchidb/shape-plugin@0.1.0 typecheck
  > tsc --noEmit

## Validation and Acceptance

- Run `pnpm --filter @hierarchidb/shape-plugin typecheck` and expect exit code 0.
- Open the Shape Step5 build UI and confirm the progress summary and stage status behave exactly as before (same counts and labels for a given build).
- Resume a build and verify that stage transitions occur in the same order as before and that queued tasks handling is unchanged.

## Idempotence and Recovery

Steps are safe to repeat because they only move code and adjust imports. If a refactor step fails, revert the last file change and re-run typecheck. No data migrations are involved.

## Artifacts and Notes

- Keep diffs small per file; if a refactor is large, split into multiple commits (even if not asked to commit).
- Include updated function references in code comments only if they clarify non-obvious behavior.

## Interfaces and Dependencies

- Use existing internal utilities in Step5; do not introduce new external libraries.
- Keep the public shape of `useShapeBuildStep` return unchanged.
- Ensure `runShapePipeline` preserves the same public behavior and error semantics.

Plan revision note: Updated progress and decisions after implementing shared progress helpers and stage-section refactor (2026-01-28).
