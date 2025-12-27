# Route batch persistence cleanup and crash recovery alignment

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This ExecPlan must be maintained in accordance with `PLANS.md` in the repository root.

## Purpose / Big Picture

Users should be able to run route builds without accumulating unused persistence tables or opaque state, and the UI should detect interrupted builds using the same start/finish markers that shape uses today. After this change, route builds will no longer persist batch task results or cursor tables. Instead, progress is tracked in UI state and crash detection uses buildStartedAt/buildFinishedAt in the route draft data. If a build cannot be resumed, the UI will prompt for cleanup by data type before restarting, matching the shape workflow. This is observable by running a route build, interrupting it, and seeing the crash hint and cleanup choices appear, then rebuilding without stale state.

## Progress

- [x] (2025-12-27 03:06Z) Add this ExecPlan and keep it updated through completion.
- [x] (2025-12-27 03:40Z) Remove routeResults persistence and references, replacing read paths with current data sources.
- [x] (2025-12-27 03:40Z) Remove routeCursors persistence and references, shifting progress to UI state.
- [x] (2025-12-27 03:55Z) Align route build start/finish markers and crash insight with shape build monitor behavior.
- [x] (2025-12-27 03:55Z) Provide route cleanup actions for lineStrings and document recovery flow in UI copy.
- [ ] (2025-12-27 03:55Z) Validate with targeted typecheck and document results in TASKS.md.

## Surprises & Discoveries

- Observation: Route batch persistence relied on routeResults and routeCursors tables, but IDE-GSM builds never touched them.
  Evidence: `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx` uses worker import and only writes lineStrings.

## Decision Log

- Decision: Use buildStartedAt/buildFinishedAt on route draft data to drive crash detection, mirroring shape’s logic.
  Rationale: This matches the existing user-facing pattern and avoids keeping a cursor table.
  Date/Author: 2025-12-27 / Codex.
- Decision: Scope cleanup actions to lineStrings for now and clear route build monitor records locally.
  Rationale: Route builds currently persist lineStrings only; additional artifact tables were removed.
  Date/Author: 2025-12-27 / Codex.

## Outcomes & Retrospective

- (To be filled at milestone completion.)

## Context and Orientation

Route plugin build flow currently mixes a UI-driven IDE-GSM build path with a batch-oriented path that persists task results and cursor tables in `RouteDatabase`. The tables `routeResults` and `routeCursors` existed in `plugins/route-plugin/src/services/database/RouteDatabase.ts` and were used by `plugins/route-plugin/src/services/RouteBatchSession.ts` and `RouteBatchManager.ts`. The query API `packages/runtime-worker/src/services/RouteQueryService.ts` exposed `listRouteResults`, reading from `routeResults`. The IDE-GSM route build in `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx` persists `RouteLineString` records directly, so it does not use routeResults or routeCursors at all.

Shape’s crash detection and build monitoring is implemented in `plugins/shape-plugin/src/ui/utils/buildMonitor.ts` and `plugins/shape-plugin/src/ui/hooks/useBuildCrashInsight.ts`. Shape build progress step uses `buildStartedAt` and `buildFinishedAt` on the draft data to mark build start/finish and to infer crashes. Route now mirrors this pattern in its build step and adds a route-specific build monitor for localStorage storage.

Key tables and types:

- Route line data: `RouteDatabase.lineStrings` (RouteLineString) in `plugins/route-plugin/src/services/database/RouteDatabase.ts`.
- Route build UI step: `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`.
- Route processing settings UI: `plugins/route-plugin/src/ui/components/steps/RouteProcessingStep.tsx`.
- Route build monitor utilities: `plugins/route-plugin/src/ui/utils/buildMonitor.ts` and `plugins/route-plugin/src/ui/hooks/useRouteBuildCrashInsight.ts`.

A “build” in this context is the pipeline that ingests data, generates route geometry, and writes lineStrings and tiles. “Crash detection” means detecting an interrupted build by seeing a buildStartedAt timestamp with no buildFinishedAt, and showing a warning that suggests cleanup and restart.

## Plan of Work

First, remove the persistent batch result and cursor tables from the route database schema and delete their usage in runtime-worker and route plugin code. This includes `RouteBatchSession` writing `routeResults`, the query API listing results, and any cursor updates in `RouteBatchSession` or `RouteBatchManager`. Replace progress tracking with UI state: in the route build UI step, maintain progress in component state and draft fields only.

Second, add route build start/finish timestamps to the route draft entity and implement a route build monitor helper that mirrors shape’s logic (buildStartedAt/buildFinishedAt, crash insight). Integrate that in the route build step so that starting a build sets buildStartedAt and finishing sets buildFinishedAt, and crash insight is derived when a previous build started but did not finish.

Third, add cleanup actions in the route processing step for data types that can block restart. This includes deleting lineStrings and clearing the local build monitor record. These buttons should use route mutation APIs where possible and should reset the draft’s build markers to allow restart.

Finally, run `pnpm --filter @hierarchidb/route-plugin typecheck` and record results in TASKS.md. If runtime-worker types change, run its typecheck as well.

## Concrete Steps

All commands are run from the repository root `/Users/hiroya/WebstormProjects/hierarchidb`.

1) Update route database schema and delete routeResults/routeCursors usage.
   - Edit `plugins/route-plugin/src/services/database/RouteDatabase.ts` to remove `routeResults` and `routeCursors` tables and their schema entries.
   - Remove `RouteResultRow`/`RouteCursorRow` types.
   - Update `plugins/route-plugin/src/services/RouteBatchSession.ts` to stop writing to these tables.
   - Update `packages/runtime-worker/src/services/RouteQueryService.ts` to remove `listRouteResults`.

2) Add route build start/finish markers and crash insight.
   - Update the route draft entity type in `plugins/route-plugin/src/common/entities/RouteEntity.ts` to include `buildStartedAt` and `buildFinishedAt`.
   - Add route build monitor utilities in `plugins/route-plugin/src/ui/utils/buildMonitor.ts` and a crash insight hook in `plugins/route-plugin/src/ui/hooks/useRouteBuildCrashInsight.ts`.
   - Wire `RouteBuildStep` to set buildStartedAt/buildFinishedAt and record build monitor samples, and to surface crash hints in the UI.

3) Add cleanup actions for route data types.
   - Add a new mutation API `deleteRouteLineStrings(nodeId)` to remove lineStrings.
   - Add cleanup UI in `RouteProcessingStep` that calls the mutation API, clears the local build monitor record, and resets build markers.

4) Validate and log.
   - Run `pnpm --filter @hierarchidb/route-plugin typecheck` and capture the result.
   - Update TASKS.md with progress, results, and any blockers.

## Validation and Acceptance

- Run `pnpm --filter @hierarchidb/route-plugin typecheck` and expect exit code 0.
- Start a route build and interrupt it (or simulate a crash by reloading) to verify:
  - buildStartedAt is set, buildFinishedAt is not set, and crash insight appears in the UI.
  - Cleanup buttons allow deleting the lineStrings data and then the build can restart.
- Verify that no code references routeResults/routeCursors remain (`rg -n "routeResults|routeCursors"` returns only historical docs, if any).

## Idempotence and Recovery

Edits to schema and UI are idempotent if reapplied. If a step fails, revert the affected files or rerun after fixing compilation errors. Cleanup buttons are safe to run multiple times; they should be no-ops if data is already absent.

## Artifacts and Notes

- Example command:
  - pnpm --filter @hierarchidb/route-plugin typecheck
  - Expected: exit code 0, no TypeScript errors.

## Interfaces and Dependencies

- Route data types in `plugins/route-plugin/src/common/entities/RouteEntity.ts` and `RouteLineString.ts` define the draft fields and persistent line data.
- Route database is defined in `plugins/route-plugin/src/services/database/RouteDatabase.ts` and was updated to remove obsolete tables.
- Runtime-worker query and mutation APIs live under `packages/runtime-worker/src/services` and no longer depend on removed tables.
- Shape’s build monitoring logic is in `plugins/shape-plugin/src/ui/utils/buildMonitor.ts` and `plugins/shape-plugin/src/ui/hooks/useBuildCrashInsight.ts`. The route implementation mirrors this behavior in route-specific utilities.

Note: Updated Progress, Decision Log, and Context to reflect removal of routeResults/routeCursors and crash monitor integration, and added a cleanup scope decision.
