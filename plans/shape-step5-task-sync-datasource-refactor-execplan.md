# Refactor shape Step5 task sync and data source configuration

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` in the repository root.

## Purpose / Big Picture

Shape Step5 currently has duplicated task sync logic, and data source configuration/validation is spread across multiple places. This plan consolidates task sync into a single hook, splits the fetch stage logic into smaller functions, and centralizes data source definitions and validation. After this change, a reader can resume builds reliably without the sync logic diverging, and the code has a single source of truth for data sources and validation. You can see the change working by running `pnpm --filter @hierarchidb/shape-plugin typecheck` successfully and by verifying that data source selection and build status UI remain functional.

## Progress

- [x] (2026-01-28 23:20 JST) Created task entry in the retired local task log for this refactor and recorded start log.
- [x] (2026-01-28 23:30 JST) Introduced `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTaskSync.ts` and refactored `useShapeBuildTasks.ts` to use it.
- [x] (2026-01-28 23:35 JST) Added `plugins/shape-plugin/src/common/utils/estimates.ts` and removed usage of `plugins/shape-plugin/src/common/mock/data.ts` in Step3.
- [x] (2026-01-28 23:38 JST) Added `SHAPE_DATA_SOURCE_BY_NAME` and updated data source lookups in Step2/Step3/CountryAvailabilityResolver.
- [x] (2026-01-28 23:40 JST) Centralized data source validation in `common/types/data-source.ts` and replaced local validation in `plugins/shape-plugin/src/worker/api.ts`.
- [x] (2026-01-28 23:41 JST) Split `shapeFetchStage.ts` to extract payload resolution and task reconciliation helpers.
- [x] (2026-01-28 23:45 JST) Audited for remaining references to deprecated data source configs or mock files; none remain in code.
- [x] (2026-01-28 23:46 JST) Ran `pnpm --filter @hierarchidb/shape-plugin typecheck` and confirmed success.
- [x] (2026-01-28 23:46 JST) Updated the retired local task log with progress logs for this refactor.

## Surprises & Discoveries

- Observation: None so far.
  Evidence: Not applicable.

## Decision Log

- Decision: Centralize data source validation in `common/types/data-source.ts` via `isDataSourceName`/`requireDataSourceName`.
  Rationale: Ensures validation logic is shared between UI and worker code.
  Date/Author: 2026-01-28 (Codex).
- Decision: Use a dedicated hook `useShapeBuildTaskSync` rather than a reducer for now.
  Rationale: Keeps changes scoped and avoids a larger state management rewrite.
  Date/Author: 2026-01-28 (Codex).
- Decision: Expand `isDataSourceName` to accept `unknown` and guard with a runtime type check.
  Rationale: Allows validation of values sourced from untyped records without local casting.
  Date/Author: 2026-01-28 (Codex).

## Outcomes & Retrospective

- Outcome: Task sync logic and data source config/validation are centralized, fetch stage branching is split into smaller helpers, and shape-plugin typecheck passes. No regressions observed in static checks. Follow-up testing remains manual in the UI.

## Context and Orientation

The shape plugin provides the Step5 build UI and the backend pipeline for shape generation. Task status is displayed in the UI based on synced task lists and summaries coming from the worker. The relevant files are:

- `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTasks.ts` — existing hook that keeps task lists and summaries in sync with incoming updates.
- `plugins/shape-plugin/src/ui/components/step5/useShapeBuildTaskSync.ts` — new helper hook that encapsulates sync and flush logic.
- `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts` — build pipeline stage where fetch tasks are created and executed.
- `plugins/shape-plugin/src/common/types/constants.ts` — shared data source configuration, now intended to be single source of truth.
- `plugins/shape-plugin/src/common/types/data-source.ts` — shared data source type and validation functions.
- `plugins/shape-plugin/src/ui/components/step2/useShapeDataSourceStep.ts` and `plugins/shape-plugin/src/ui/components/step3/useShapeCountrySelectionStep.ts` — UI data source selection logic.
- `plugins/shape-plugin/src/services/datasources/CountryAvailabilityResolver.ts` — resolves which countries are available per data source.
- `plugins/shape-plugin/src/worker/api.ts` — validates data source inputs on the worker side.

A “task sync” here means receiving a list of task updates and integrating them into the UI’s local list while preserving ordering and update sequencing. “Fetch stage” refers to the first stage of the shape build pipeline, where raw data is pulled for each tile. “Data source configuration” refers to the list of supported data sources and their labels/options, which should live in one shared file.

## Plan of Work

First, verify that all task sync logic has moved into `useShapeBuildTaskSync.ts` and that `useShapeBuildTasks.ts` is only composing the hook and exposing a minimal API. Next, ensure the fetch stage has clearly separated helper functions for payload resolution and task reconciliation, and that the main runner is readable and still handles resume semantics. Then, centralize data source configuration by using `SHAPE_DATA_SOURCE_BY_NAME` and remove any remaining references to the old `DATA_SOURCE_CONFIGS` or `common/mock/data.ts`. Finally, unify validation by using `isDataSourceName` and `requireDataSourceName` everywhere data sources are checked, including worker API entry points.

## Concrete Steps

1) Search for remaining references to deprecated configs or mocks:

   - Working directory: repository root.
   - Run `rg -n "DATA_SOURCE_CONFIGS|mock/data" plugins/shape-plugin` and update any remaining usage to `SHAPE_DATA_SOURCE_BY_NAME` or new utilities.

2) Inspect `shapeFetchStage.ts` to confirm the helpers are used correctly. If any helper returns values that are unused or still duplicated, simplify the runner and add short comments where the logic is non-obvious.

3) Run `pnpm --filter @hierarchidb/shape-plugin typecheck` from the repository root and record the result in the linked GitHub Issue under this task.

## Validation and Acceptance

- Run `pnpm --filter @hierarchidb/shape-plugin typecheck` and expect exit code 0.
- Spot-check the UI code: `useShapeBuildTasks.ts` should read as a thin wrapper over `useShapeBuildTaskSync.ts` without duplicated merging logic.
- Spot-check data source selection: `useShapeDataSourceStep.ts` and `useShapeCountrySelectionStep.ts` should use `SHAPE_DATA_SOURCE_BY_NAME` and `isDataSourceName`.

## Idempotence and Recovery

All steps are safe to repeat. If typecheck fails after changes, revert the local edits in the relevant file(s) or temporarily reintroduce the previous config reference, then rerun typecheck. If behavior is incorrect, revert the refactor commit(s) to restore the pre-refactor logic.

## Artifacts and Notes

Expected command transcript example:

  $ pnpm --filter @hierarchidb/shape-plugin typecheck
  ...
  Done in <N>s

## Interfaces and Dependencies

- `useShapeBuildTaskSync.ts` should export a hook returning the synchronized task list, summary, and functions for scheduling flushes.
- `common/types/data-source.ts` must export `isDataSourceName` and `requireDataSourceName`, and `common/types/constants.ts` must export `SHAPE_DATA_SOURCE_BY_NAME`.
- UI and worker modules should depend on the shared validation utilities rather than local copies.

Plan updated on 2026-01-28 to capture typecheck completion and the `isDataSourceName` signature adjustment.
