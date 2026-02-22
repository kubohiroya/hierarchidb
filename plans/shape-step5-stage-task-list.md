# Shape Step5 stage task list and colored progress display

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is located at `PLANS.md` from the repository root and this plan must be maintained in accordance with it.

## Purpose / Big Picture

After this change, the Step5 Build screen in the shape plugin shows a stage-by-stage list of batch tasks. Each stage pane lists its tasks vertically with a per-task progress bar and a colored status indicator, and the pane header shows a completed/total count that updates as processing proceeds. A user can observe this by opening Step5, starting a batch session, and watching the task list fill and advance through stages.

## Progress

- [x] (2025-12-21 08:35 JST) Create a shared build-task summary type in `packages/common/api/src/BatchControlAPI.ts` and expose `getBatchTasks` on `WorkerAPI`.
- [x] (2025-12-21 08:40 JST) Expose a `getBatchTasks` entry in the worker API facade in `app/src/worker-runtime/worker.ts` and wire a nodeType → provider map from loaded plugin modules.
- [x] (2025-12-21 08:45 JST) Implement shape worker task retrieval in `plugins/shape-plugin/src/worker/api.ts` and export a summary provider from `plugins/shape-plugin/src/worker/index.ts`.
- [x] (2025-12-21 08:55 JST) Add a UI hook that fetches batch tasks via `WorkerBridge` and use it in Step5 to render task lists and update pane header counts.
- [x] (2025-12-21 09:00 JST) Update `BuildStep` to accept custom stage content and pane progress overrides, then supply it from Step5.
- [x] (2025-12-21 09:05 JST) Add i18n labels for task list UI and record verification/rollback in `TASKS.md`.

## Surprises & Discoveries

- Observation: `pnpm --filter @hierarchidb/shape-plugin typecheck` fails due to pre-existing runtime-worker/shape-plugin/spreadsheet-plugin type errors unrelated to this change.
  Evidence: TS18048/TS2322 in `packages/runtime-worker/src/services/StageProcessingService.ts` and missing `StepComponentProps` exports.

## Decision Log

- Decision: Use a new common API task summary (`BatchTaskSummary`) instead of the shape plugin’s full `BatchTask` type to keep `WorkerAPI` generic.
  Rationale: `WorkerAPI` is shared across the app; a slim, plugin-agnostic payload avoids coupling to shape-specific types.
  Date/Author: 2025-12-21 / Codex

## Outcomes & Retrospective

- Step5 now renders per-stage task lists with per-task progress and status chips, and pane header counts are computed from live task data. Verification via `pnpm --filter @hierarchidb/shape-plugin typecheck` still fails due to pre-existing unrelated errors.

## Context and Orientation

Step5 in the shape plugin uses `BuildStep` (`packages/components/src/BuildStep.tsx`), which in turn renders `LRUSplitView` panes with a simple stage title, description, and a stage-level progress bar. The pane headers are rendered by `packages/ui/lru-splitview/src/components/PaneHeader.tsx` and can show a task-count chip and progress percentage if `PaneProgress` includes `taskCount` and `completedCount`. The worker API exposed to the UI is defined in `packages/common/api/src/WorkerAPI.ts` and implemented in the worker entry at `app/src/worker-runtime/worker.ts`. The shape worker API lives in `plugins/shape-plugin/src/worker/api.ts` and currently has a stub for `getBatchTasks`.

In this plan, “task summary” means the minimal data needed to show a task row in the UI: task id, stage, status, progress percentage, and optional message/timestamps. “Stage pane” refers to one `LRUSplitView` pane per batch stage (download, extract1, extract2, vectorTiles).

## Plan of Work

First, add a generic task summary type to `packages/common/api/src/BatchControlAPI.ts` and export it from `packages/common/api/src/index.ts`. Extend `packages/common/api/src/WorkerAPI.ts` to include a new `getBatchTasks(nodeType, sessionId)` method returning an array of task summaries. Update `packages/ui/worker-client/src/workerBridge.ts` to expose this method to UI callers.

Second, update the worker entry at `app/src/worker-runtime/worker.ts` so the API facade includes `getBatchTasks`. Build a provider map from the loaded plugin modules: if a module export includes a `getBatchTasks` function, register it for that node type. The facade should call the provider for the requested node type and return an empty list if none exists.

Third, implement task retrieval in `plugins/shape-plugin/src/worker/api.ts` so `getBatchTasks(sessionId)` returns actual task data from `ShapeDB`. Add a small mapping helper to convert `BatchTaskRecord` to the shape `BatchTask` type and to the new `BatchTaskSummary`. Export a provider function from `plugins/shape-plugin/src/worker/index.ts` (for example `getBatchTasks`) so the worker entry can register it. Keep the export thin and type-only, and avoid pulling UI dependencies into worker code.

Fourth, add a new UI hook in `plugins/shape-plugin/src/ui/hooks/useShapeBuildTasks.ts` that uses `getBuildWorkerBridge().getBuildTasks('shape', sessionId)` to fetch tasks. Expose a `refresh` function and a `tasks` array. Trigger refresh when progress updates (use the existing `useShapeProgress` timestamp or stage changes) and also on a modest polling interval (e.g. 2000ms) while a session is active.

Fifth, update `packages/components/src/BuildStep.tsx` to accept an optional `renderStageContent` callback and optional `paneProgress` overrides. If `renderStageContent` is provided, use it instead of the default stage description + progress bar in the pane body. If `paneProgress` is provided, pass it through to `LRUSplitView`; otherwise keep the existing computed values.

Sixth, update `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx` to group tasks by stage, compute per-stage task counts and a per-stage progress value, and pass both the `renderStageContent` callback and `paneProgress` into `BuildStep`. The stage content should render a vertical list of tasks with a `LinearProgress` bar and a colored status chip per task. Use consistent status colors (e.g. running=primary/info, completed=success, failed=error, cancelled=warning, waiting=default). Provide a small empty-state message when a stage has no tasks yet.

Finally, add i18n keys for the new task list labels and empty-state string in `plugins/shape-plugin/src/ui/locales/en.json` and `plugins/shape-plugin/src/ui/locales/ja.json`. Update `TASKS.md` progress logs and checklists, and record any command outputs from validation.

## Concrete Steps

1) Update common API types and WorkerAPI interface.
   - Edit `packages/common/api/src/BatchControlAPI.ts` to add a `BatchTaskSummary` type.
   - Edit `packages/common/api/src/WorkerAPI.ts` to add `getBatchTasks(nodeType, sessionId): Promise<BatchTaskSummary[]>`.
   - Edit `packages/common/api/src/index.ts` to export the new type.

2) Update the worker API facade.
   - Edit `app/src/worker-runtime/worker.ts` to collect per-nodeType `getBatchTasks` providers from loaded plugin modules and expose `getBatchTasks` on the Comlink API object.

3) Implement shape worker task retrieval.
   - Edit `plugins/shape-plugin/src/worker/api.ts` so `getBatchTasks(sessionId)` reads `shapeDB.getBatchTasks(sessionId)` and maps results to the shape `BatchTask` type.
   - Edit `plugins/shape-plugin/src/worker/index.ts` to export a task summary provider (for example, `getBatchTasks` returning `BatchTaskSummary[]`).

4) Add UI hook and wire Step5.
   - Add `plugins/shape-plugin/src/ui/hooks/useShapeBuildTasks.ts`.
   - Update `plugins/shape-plugin/src/ui/hooks/index.ts` to export the hook.
   - Update `plugins/shape-plugin/src/ui/components/steps/ShapeBuildStep.tsx` to call the hook, compute per-stage task stats, and render task lists per pane.

5) Extend BuildStep.
   - Edit `packages/components/src/BuildStep.tsx` to accept `renderStageContent` and `paneProgress` props and pass them into `LRUSplitView`.

6) Add i18n labels.
   - Edit `plugins/shape-plugin/src/ui/locales/en.json` and `plugins/shape-plugin/src/ui/locales/ja.json` with keys for task list labels and empty state.

## Validation and Acceptance

Run the following in the repo root:

  pnpm --filter @hierarchidb/shape-plugin typecheck

Acceptance is met when Step5 shows per-stage task lists with a progress bar and colored status for each task, and the pane headers display updated completed/total counts while a batch session is running.

## Idempotence and Recovery

All steps are additive and safe to re-run. If a step fails, re-run the same edit after fixing the reported error. To rollback, revert the touched files and re-run `pnpm --filter @hierarchidb/shape-plugin typecheck`.

## Artifacts and Notes

Record any validation outputs (command, exit code, short error summaries) in `TASKS.md` under the current worklog.

## Interfaces and Dependencies

New/updated interfaces:

  - `BatchTaskSummary` in `packages/common/api/src/BatchControlAPI.ts` with fields: `taskId`, `stage`, `status`, `progress`, `message?`, `startedAt?`, `completedAt?`.
  - `WorkerAPI.getBatchTasks(nodeType, sessionId)` returning `BatchTaskSummary[]`.
  - `BuildStepPanelProps.renderStageContent?: (stage, progress) => ReactNode` and `BuildStepPanelProps.paneProgress?: PaneProgress[]`.
  - `useShapeBuildTasks(sessionId)` returning `{ tasks, refresh, error }`.

Dependencies to use:

  - `shapeDB.getBatchTasks` from `plugins/shape-plugin/src/services/database/ShapeDB.ts` for worker-side task retrieval.
  - `getWorkerBridge` from `@hierarchidb/ui-worker-client` for UI access to `getBatchTasks`.

Plan revision note: Initial plan created to implement stage-level task lists and per-task progress display for Step5.

Plan revision note (2025-12-21): Updated Progress checklist to reflect completed implementation steps.
Plan revision note (2025-12-21): Added Surprises entry documenting typecheck failures unrelated to this change.
Plan revision note (2025-12-21): Updated Outcomes & Retrospective with current completion status and verification note.
