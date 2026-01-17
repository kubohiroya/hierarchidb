# Remove transform-by-zoom and unify Transform task handling

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root and must be maintained in accordance with it.

## Purpose / Big Picture

Users should be able to delete Transform caches and run Shape build steps without stale or deprecated task stages influencing the outcome. After this change, the system exposes a single Transform task stage ("transform"), and the UI should never treat `processingStatus` or `tileSummary` as reasons to skip Transform task execution. Success is observable by starting a build after deleting caches: the task queue should repopulate with Transform tasks and not show legacy "transform-by-zoom" records.

## Progress

- [x] (2026-01-17 19:20 JST) Collected references to transform-by-zoom across types, worker routing, task queues, and caches.
- [x] Removed transform-by-zoom from shared type definitions and task stage enums.
- [x] Updated worker/task queue mapping and session mappers to use transform only (shape + route).
- [x] Updated Transform cache deletion to clear stale task state and legacy stage rows.
- [x] Adjusted build polling/resume logic to rely on runtime status rather than draft processingStatus.
- [x] Run pnpm typecheck and capture results in TASKS.md.

## Surprises & Discoveries

- Observation: plugin-service-api is referenced via dist in tsconfig paths, so typecheck required rebuilding that package after stage type changes.
  Evidence: pnpm typecheck failed until `pnpm --filter @hierarchidb/plugin-service-api build` was run.

## Decision Log

- Decision: Remove transform-by-zoom entirely instead of aliasing to transform.
  Rationale: The request is for complete deprecation and a single authoritative Transform stage.
  Date/Author: 2026-01-17 / Codex.
- Decision: Clear legacy task rows on Transform cache deletion by removing any unknown task stages for the node.
  Rationale: Allows cleanup without keeping transform-by-zoom as a supported stage.
  Date/Author: 2026-01-17 / Codex.

## Outcomes & Retrospective

- Outcome: transform-by-zoom was removed from shared stage types and runtime mappings; task ordering now uses fetch/transform/vt only.
- Outcome: Transform cache deletion now clears stale task state without relying on deprecated stages, and task polling/resume uses runtime status rather than draft processingStatus.
- Outcome: pnpm typecheck completed successfully after rebuilding plugin-service-api.

## Context and Orientation

The Shape build pipeline uses a task queue and ephemeral caches to track progress across stages. Historically there were four stages: fetch, transform, transform-by-zoom, and vt. Transform cache deletion is triggered from the Shape Step4 UI and should remove all Transform-related caches and tasks. The files involved span shared types, the worker API, and the pipeline orchestration.

Key files to update:

- `packages/plugin-service-api/src/types/shapeBuildTypes.ts` for build stage type definitions.
- `packages/features/gis-sdk/src/ephemeral/EphemeralGisDB.ts` and `packages/features/shape-store/src/ShapeDB.ts` for stage enums and task types.
- `plugins/shape-plugin/src/worker/api.ts` for task queue mapping, stage ordering, and build status.
- `plugins/shape-plugin/src/services/batch/shapeSessionMappers.ts` for session stage mapping.
- `plugins/shape-plugin/src/ui/components/step4/useFetchConfigSection.ts` for cache deletion actions.
- `plugins/shape-plugin/src/ui/components/steps-provider.tsx` and `plugins/shape-plugin/src/ui/components/step5/useShapeBuildStep.ts` for build readiness checks and status usage.

Definitions used in this plan:

- "Transform cache" means the ephemeral transform cache buffers, transform error records, and transform-related task queue entries stored in the shape ephemeral DB.
- "Task queue" means the VT task queue stored in `VtTaskQueueDb` and exposed through `plugins/shape-plugin/src/worker/api.ts`.
- "Processing status" refers to `ShapeEntity.processingStatus`, a UI-facing summary of build state.
- "Tile summary" refers to `ShapeEntity.tileSummary`, a VT output summary (tile count, total bytes).

## Plan of Work

First, remove `transform-by-zoom` from shared type definitions so it cannot appear as a legal stage. Update each usage site (worker API, session mappers, task queue helpers) to use only `transform` and `vt` alongside `fetch`. Next, adjust cache deletion so that the Transform deletion action clears any legacy task records or caches that would otherwise persist and appear as failed tasks. Finally, ensure UI readiness checks and task execution triggers do not depend on `processingStatus` or `tileSummary` to skip Transform tasks. Keep the Transform stage execution based on queue presence and task generation only.

## Concrete Steps

Run these commands from the repository root:

  rg -n "transform-by-zoom" packages plugins app

For each file listed, replace the stage usage with `transform`, or remove the stage branch entirely if it is only for the deprecated stage. Use `apply_patch` for focused edits.

After edits, run:

  pnpm typecheck

Record exit code and any warnings in `TASKS.md` under task 2241.

## Validation and Acceptance

- Running `pnpm typecheck` must exit 0.
- The codebase must compile without any references to `transform-by-zoom` in TypeScript types or runtime logic.
- After deleting Transform cache in Step4, no legacy Transform task data remains; subsequent builds should enqueue fresh Transform tasks and not immediately surface stale failures.

## Idempotence and Recovery

Edits are source-only and safe to repeat. If an edit breaks compilation, revert just the impacted file and re-apply the change with smaller scope. To roll back entirely, revert the change set and return to the previous stage definitions.

## Artifacts and Notes

- Capture a short `rg` output snippet showing zero matches for transform-by-zoom after completion.
- Capture the `pnpm typecheck` summary line with exit 0.

## Interfaces and Dependencies

Use existing task queue and build pipeline modules. Do not introduce new dependencies. The final stage enum set must include only `fetch`, `transform`, and `vt` for Shape build flows. All task summary mapping and UI stage grouping must align to this set.

---

Plan change log: 2026-01-17 updated progress, recorded dist build discovery, and captured outcomes after typecheck completion.
