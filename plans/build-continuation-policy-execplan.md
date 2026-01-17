# Add build continuation policy for shape/location/route

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repository at `PLANS.md`. This plan must be maintained in accordance with it.

## Purpose / Big Picture

Users need to control how batch builds behave when errors occur. After this change, the TreeConsole toolbar exposes a “Build continuation policy” selector with three choices: always finish all stages, finish the current stage then stop, or stop immediately on the first error. The choice is persisted in TreeConsole settings and is applied to shape, location, and route build execution so users can see the effect by starting a build and observing whether it continues or stops after an error.

## Progress

- [x] (2026-01-17 14:00 JST) Created task entry in `TASKS.md` and acknowledged scope.
- [x] (2026-01-17 14:02 JST) Create and publish this ExecPlan in `plans/build-continuation-policy-execplan.md`.
- [ ] Add build continuation policy type to shared types and TreeConsole settings.
- [ ] Add TreeConsole toolbar UI controls and i18n strings.
- [ ] Apply policy to shape pipeline, location session, and route batch execution.
- [ ] Run `pnpm typecheck` and record results in `TASKS.md` and here.
- [ ] Update `Progress`, `Decision Log`, and `Outcomes & Retrospective` with results.

## Surprises & Discoveries

- Observation: Shape build uses `runStageTasks` from `@hierarchidb/vt-orchestrator` with `failureHandling: 'stop'`, so policy mapping must happen at pipeline call sites.
  Evidence: `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`, `plugins/shape-plugin/src/services/vt/shapeVtPipeline.ts`.
- Observation: Route build uses `RouteBatchSession` and currently throws if any failures occur after all tasks complete.
  Evidence: `plugins/route-plugin/src/services/RouteBatchSession.ts`.
- Observation: Location build uses `LocationSessionController` and catches/logs errors without surfacing them as failures.
  Evidence: `plugins/location-plugin/src/services/batch/LocationSessionController.ts`.

## Decision Log

- Decision: Use a single string union policy with three values shared across shape/location/route and stored in TreeConsole settings.
  Rationale: Keeps the UI and build configs aligned without forcing a plugin-specific enum.
  Date/Author: 2026-01-17 / Codex

## Outcomes & Retrospective

- Pending. Will be filled after implementation.

## Context and Orientation

TreeConsole toolbar UI lives in `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx` and `TreeConsoleToolbarContent.tsx`, with translations in `app/public/locales/en/common.json` and `app/public/locales/ja/common.json` under `treeConsole.toolbar.*`. Settings persistence is in `packages/util/src/treeConsoleSettings.ts` and is consumed in `app/src/router/pages/tree/console/useTreeConsoleToolbarActions.ts` and in shape build defaults at `plugins/shape-plugin/src/ui/components/step4/useShapeBuildConfigStep.ts`.

Shape builds run through `plugins/shape-plugin/src/services/vt/shapeVtPipeline.ts` and `shapeFetchStage.ts` which call `runStageTasks` from `@hierarchidb/vt-orchestrator`. Location builds use `LocationSessionController` and `LocationBatchSession` (`plugins/location-plugin/src/services/batch/*.ts`). Route builds use `RouteBatchSession` for batch tasks and IDE-GSM import via `RouteMutationService` (`packages/runtime-worker/src/services/RouteMutationService.ts`). Build configuration types are in `packages/features/gis-sdk/src/config.ts` (shape), `packages/features/location-store/src/index.ts` (location), and `packages/features/route-store/src/index.ts` (route). Shared types are exported from `packages/common/types/src/index.ts`.

## Plan of Work

First, define a shared `BuildContinuationPolicy` type in `packages/common/types/src/progress-types.ts` (or a new common-types file) and export it from `packages/common/types/src/index.ts`. Update `packages/util/src/treeConsoleSettings.ts` to store the policy, with a default value that maps to “finish all stages.” Update `loadTreeConsoleSettings` and `saveTreeConsoleSettings` to validate and persist it.

Next, extend TreeConsole toolbar props to accept `buildContinuationPolicy` and `onBuildContinuationPolicyChange`, pass them through `TreeConsoleToolbar` and `TreeConsoleToolbarContent`, and add UI to `SettingsMenu` (a new radio group section under settings). Add i18n strings to `app/public/locales/en/common.json` and `app/public/locales/ja/common.json` for the new labels and options. Update `app/src/router/pages/tree/console/useTreeConsoleToolbarActions.ts` to load/store the policy and wire handlers. Ensure the new setting does not touch unrelated files (specifically exclude `pnpm-lock.yaml` and `plans/ui-map-interaction-core-execplan.md`).

Then apply the policy to build execution:

- Shape: add `buildContinuationPolicy?: BuildContinuationPolicy` to `BaseBuildConfig` in `packages/features/gis-sdk/src/config.ts`. In `shapeFetchStage.ts` and `shapeVtPipeline.ts`, map the policy to `failureHandling` values (`finish_all_stages` -> `continue`, `finish_stage_then_stop` -> `continue` + post-stage failure check, `stop_on_first_error` -> `stop`). After each stage, check for failed tasks via `listTasksByStageAndStatus` and throw to stop if the policy is `finish_stage_then_stop` and failures exist. Maintain existing cleanup behavior.

- Location: add `buildContinuationPolicy?: BuildContinuationPolicy` to `UnifiedLocationBatchConfig` in `packages/features/location-store/src/index.ts` and to `LocationBatchConfig` in `plugins/location-plugin/src/services/batch/LocationBatchSession.ts`. Pass the policy from `UnifiedLocationBatchManager.performStart` to `LocationBatchSession` (and/or `LocationSessionController`) and implement logic so errors are tracked. For `stop_on_first_error`, throw immediately on failure; for `finish_stage_then_stop`, complete the current stage and throw afterward if any failure occurred; for `finish_all_stages`, allow completion without throwing.

- Route: add `buildContinuationPolicy?: BuildContinuationPolicy` to `RouteBatchConfig` in `packages/features/route-store/src/index.ts`. In `RouteBatchSession.processBatch`, track failures per stage and apply the policy. For `stop_on_first_error`, abort further tasks after the first failure (skip scheduling new tasks where possible). For `finish_stage_then_stop`, complete the current stage, then throw before the next stage if any failures occurred. For `finish_all_stages`, complete all stages and do not throw on failure, but still mark failed tasks in the task queue.

Finally, run `pnpm typecheck` and record output in `TASKS.md` and this plan. Update the plan’s `Progress`, `Decision Log`, and `Outcomes & Retrospective` with results and any follow-ups.

## Concrete Steps

1) Add the shared policy type and TreeConsole settings.
   - Edit `packages/common/types/src/progress-types.ts` and export from `packages/common/types/src/index.ts`.
   - Edit `packages/util/src/treeConsoleSettings.ts` to add `buildContinuationPolicy` with validation and default.

2) Add TreeConsole toolbar UI.
   - Edit `packages/ui/treeconsole/toolbar/src/types.ts` to add new props.
   - Edit `packages/ui/treeconsole/toolbar/src/components/TreeConsoleToolbar.tsx` and `TreeConsoleToolbarContent.tsx` to pass policy props.
   - Edit `packages/ui/treeconsole/toolbar/src/components/toolbar/SettingsMenu.tsx` to add the radio group and labels.
   - Edit `app/src/router/pages/tree/console/useTreeConsoleToolbarActions.ts` to load/store policy.
   - Edit `app/public/locales/en/common.json` and `app/public/locales/ja/common.json` to add strings.

3) Apply policy in shape, location, and route builds.
   - Edit `packages/features/gis-sdk/src/config.ts` for shape build config.
   - Edit `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts` and `plugins/shape-plugin/src/services/vt/shapeVtPipeline.ts` for policy mapping.
   - Edit `packages/features/location-store/src/index.ts`, `plugins/location-plugin/src/services/batch/LocationBatchSession.ts`, and `plugins/location-plugin/src/services/batch/LocationSessionController.ts` to use policy.
   - Edit `packages/features/route-store/src/index.ts` and `plugins/route-plugin/src/services/RouteBatchSession.ts` to use policy.

4) Run validation.
   - From repo root: `pnpm typecheck`.
   - Capture success output and update logs.

Expected transcript snippet (success):
  > pnpm typecheck
  ...
  Tasks:    <N> successful, <N> total
  ...

## Validation and Acceptance

Start the app and open the TreeConsole toolbar settings. Verify the new “Build continuation policy” radio group appears and persists between reloads. Start a shape/location/route build and intentionally introduce a failure (e.g., data source mismatch or invalid input) to confirm behavior:

- “Finish all stages” continues to the final stage without stopping.
- “Finish current stage then stop” completes the current stage’s remaining tasks and stops before the next stage.
- “Stop on first error” halts quickly after the first failure.

Run `pnpm typecheck` and expect exit code 0.

## Idempotence and Recovery

These changes are additive. Re-running the steps is safe. Rollback is a clean revert of the modified files, which restores the prior toolbar menu and default build behavior.

## Artifacts and Notes

None yet. Add key command output and any diff excerpts here as implementation proceeds.

## Interfaces and Dependencies

- `BuildContinuationPolicy`: string union shared across shape/location/route.
- `TreeConsoleSettings.buildContinuationPolicy`: persisted to localStorage under `TREE_CONSOLE_SETTINGS_STORAGE_KEY`.
- `TreeConsoleToolbarProps.buildContinuationPolicy` and `onBuildContinuationPolicyChange` for UI wiring.
- Shape build config: `BaseBuildConfig.buildContinuationPolicy?: BuildContinuationPolicy`.
- Location config: `UnifiedLocationBatchConfig.buildContinuationPolicy?: BuildContinuationPolicy` and `LocationBatchConfig.buildContinuationPolicy?: BuildContinuationPolicy`.
- Route config: `RouteBatchConfig.buildContinuationPolicy?: BuildContinuationPolicy`.

Plan update note: Initial version created to satisfy ExecPlan requirement and to cover shared UI + build pipeline changes. Future updates will record progress and decisions.

Plan update note (2026-01-17 14:02 JST): Marked ExecPlan creation as complete.
