# Implement recycled task status for shape build resume

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked in at `/Users/hiroya/WebstormProjects/hierarchidb/PLANS.md`. This ExecPlan must be maintained in accordance with PLANS.md.

## Purpose / Big Picture

After this change, the Step5 task list for shape builds will show cache-reuse work as a distinct `recycled` task status with a green "Recycled" chip, while recycled tasks will not contribute to progress counts or percentage. Users can resume a session and immediately see which tasks were reused without inflating total/completed counts, and the progress display will safely show `0/0` without divide-by-zero errors when all tasks are recycled.

## Progress

- [x] 2026-02-14 22:28 JST Added a task refresh path in `useShapeBuildTasks` and invoked it from resume in `useShapeBuildStep`.
- [x] 2026-02-14 22:29 JST Added a unit test covering `refresh()` in `useShapeBuildTasks`.
- [x] 2026-02-14 23:35 JST Updated shared task status type unions to include `recycled` where task status is used.
- [x] 2026-02-14 23:35 JST Replaced `cacheReuse` metadata marking with `status=recycled` in worker pipeline resume paths.
- [x] 2026-02-14 23:35 JST Purged legacy cacheReuse-based tasks when detected to avoid stale schema.
- [x] 2026-02-14 23:35 JST Updated UI labeling, color, and icon logic to distinguish `recycled` from `skipped`.
- [x] 2026-02-14 23:35 JST Updated progress counting to exclude `recycled` from numerator and denominator and return `0/0`.
- [x] 2026-02-14 23:35 JST Updated translations and tests to reflect `recycled` status.
- [x] 2026-02-14 23:41 JST Ran `pnpm -w turbo run test --filter @hierarchidb/shape-plugin` (exit 0).
- [x] 2026-02-14 23:44 JST Removed legacy task statuses (`regression`, `warning`, `rebuild-reserved`) across Worker/UI/types and purged old-schema tasks.
- [x] 2026-02-14 23:44 JST Added task queue seeding from buildTasks so Step5 list is populated during/after build.
- [x] 2026-02-14 23:45 JST Bumped EphemeralDB to v7 and added upgrade to ensure `fetchCacheMeta`/`transformCacheMeta` tables exist.
- [x] 2026-02-14 23:45 JST Ran focused shape-plugin tests and full filtered typecheck (exit 0).

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Treat `recycled` as a task status distinct from `skipped`, with success coloring and no contribution to progress numerator or denominator.
  Rationale: User requirement; recycled tasks represent reused results and should not bias progress counts.
  Date/Author: 2026-02-14 / Codex
- Decision: Legacy tasks with `metadata.cacheReuse` will trigger a full delete of task queue entries for that node.
  Rationale: User accepted deleting old-schema tasks; detection via legacy metadata avoids deleting new-schema sessions.
  Date/Author: 2026-02-14 / Codex

## Outcomes & Retrospective

- Pending.

## Context and Orientation

Shape build tasks live in the ephemeral task queue (`packages/vt-orchestrator/src/task/taskQueue.ts`) and are exposed to UI via the shape worker API (`plugins/shape-plugin/src/worker/api.ts`). UI state and progress counts are derived from `useShapeBuildTasks` and `useShapeBuildProgressSummary` in `plugins/shape-plugin/src/ui/components/build-progress/`. The task status unions are defined in `packages/build-api/src/task-queue-types.ts` and mirrored in shape-specific types in `packages/shape-api/src/shapeBuildTypes.ts`, `packages/shape-store/src/ShapeDB.ts`, and `plugins/shape-plugin/src/common/types/build.ts`. The Step5 task list is rendered by `TaskListVirtualized.tsx`, which currently decides iconography based on legacy metadata.

## Plan of Work

First, update task status type unions across shared packages and shape-specific types to include `recycled`. This ensures status values are accepted in the worker, UI, and tests without type errors.

Second, replace cache-reuse metadata with status transitions during resume. Introduce a helper in the shape pipeline stages to mark completed tasks as `recycled` (using `allowTerminalStatusTransition`) when `resumeExistingTasks` is true. Remove any `metadata.cacheReuse` writes. Add a legacy cleanup step in the worker task subscription: when a snapshot detects any task with `metadata.cacheReuse`, delete all tasks for that node and emit the resulting snapshot so old-schema tasks are purged.

Third, update the UI to distinguish `recycled` from `skipped`. Add a `Recycled` label and a success-colored chip, update status mapping in `useBuildProgressPanelState`, and update task icon selection in `TaskListVirtualized` to use the `recycled` status instead of metadata.

Fourth, update progress counting to exclude recycled tasks from numerator and denominator. This involves `packages/ui/batch/src/utils/taskProgressSummary.ts`, `useShapeBuildProgressSummary`, and worker-side `summarizeTaskQueueStatus` / `buildStageStatus` so progress totals ignore recycled tasks. Ensure percentage computation handles `0/0` by returning `0` without dividing.

Fifth, update translations and tests. Add translation keys for `recycled`, adjust existing tests or add new ones to cover recycled status display, and update any task status filtering logic that assumes only queued/running/completed/failed/skipped.

Finally, run the shape-plugin test suite, confirm exit 0, and record results in the issue.

## Concrete Steps

1. Update shared task status unions:
   - Edit `/Users/hiroya/WebstormProjects/hierarchidb/packages/build-api/src/task-queue-types.ts` to include `recycled`.
   - Edit `/Users/hiroya/WebstormProjects/hierarchidb/packages/shape-api/src/shapeBuildTypes.ts` and `/Users/hiroya/WebstormProjects/hierarchidb/packages/shape-store/src/ShapeDB.ts` to include `recycled`.
   - Edit `/Users/hiroya/WebstormProjects/hierarchidb/packages/vt-orchestrator/src/types/_BuildConfig.ts` and `/Users/hiroya/WebstormProjects/hierarchidb/packages/gis-sdk/src/ephemeral/EphemeralDBRecordTypes.ts` where BuildTaskStatus is defined.

2. Replace cacheReuse marking with recycled status:
   - Edit `/Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin/src/services/vt/shapePipelineStageHelpers.ts` to rename and rework `markStageTasksCacheReused` into `markStageTasksRecycled`, updating task status to `recycled` with `allowTerminalStatusTransition`.
   - Update callers in `shapePipelineFetchStage.ts`, `shapePipelineTransformStage.ts`, and `shapePipelineVtStage.ts`.

3. Purge legacy cacheReuse tasks:
   - Edit `/Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin/src/worker/api.ts` in `subscribeToTasks` to detect legacy `metadata.cacheReuse` and delete all tasks for that node before sending a snapshot.

4. Update UI status and icon logic:
   - Edit `/Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin/src/ui/components/build-progress/TaskListVirtualized.tsx` to select the Recycling icon when `task.status === 'recycled'`.
   - Edit `/Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin/src/ui/components/build-progress/useBuildProgressPanelState.ts` to add `recycled` to label/color mapping and treat it as distinct from skipped.
   - Add translation keys in `/Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin/src/ui/locales/en.json` and `ja.json`.

5. Update progress counting and avoid divide-by-zero:
   - Edit `/Users/hiroya/WebstormProjects/hierarchidb/packages/ui/batch/src/utils/taskProgressSummary.ts` to exclude recycled tasks from total and done counts.
   - Edit `/Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin/src/ui/components/build-progress/useShapeBuildProgressSummary.ts` to use the updated summary and ensure `0/0` displays as zero without division.
   - Edit worker-side `summarizeTaskQueueStatus` and `buildStageStatus` in `/Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin/src/worker/api.ts` to exclude recycled from totals.

6. Update tests:
   - Extend `/Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin/src/ui/__tests__/components/build-progress/TaskListVirtualized.unit.test.tsx` to assert icon selection based on `status: 'recycled'`.
   - Add a unit test in `/Users/hiroya/WebstormProjects/hierarchidb/plugins/shape-plugin/src/ui/__tests__/hooks/unit/useShapeBuildTasks.unit.test.tsx` or `useShapeBuildProgressSummary` to verify recycled exclusion from totals.

7. Run tests:
   - From `/Users/hiroya/WebstormProjects/hierarchidb`, run:
     - `pnpm -w turbo run test --filter @hierarchidb/shape-plugin`
   - Expect exit 0 and updated tests to pass.

## Validation and Acceptance

Acceptance is met when:

1. Resuming a build produces tasks with `status=recycled` for reused work, and the UI displays a green "Recycled" chip distinct from "Skipped".
2. Progress counts exclude recycled tasks so the completed/total display and percentage do not count them; when only recycled tasks exist, the display shows `0/0` without a divide-by-zero error.
3. Old-schema tasks with `metadata.cacheReuse` are deleted on subscription.
4. `pnpm -w turbo run test --filter @hierarchidb/shape-plugin` exits 0, and the new/updated tests pass.

## Idempotence and Recovery

All edits are source changes and can be re-run safely. If any step fails, re-run the command after fixing the error. Rollback is a `git revert` of the commit(s) produced by this plan.

## Artifacts and Notes

Expected test command:
  pnpm -w turbo run test --filter @hierarchidb/shape-plugin

Expected summary excerpt:
  Test Files  X passed | Y skipped
  Tests       A passed | B skipped

## Interfaces and Dependencies

The task status `recycled` must be accepted by:
- `TaskStatus` in `packages/build-api/src/task-queue-types.ts`.
- Shape task status types in `packages/shape-api/src/shapeBuildTypes.ts`, `packages/shape-store/src/ShapeDB.ts`, and `plugins/shape-plugin/src/common/types/build.ts`.

`TaskListVirtualized` must render:
- Recycling icon for `status === 'recycled'`.
- AddBox icon for non-recycled tasks.

`useBuildProgressPanelState` must render:
- Label "Recycled" and success color for `status === 'recycled'`.

`buildTaskCountSummary` must exclude recycled tasks from total and done counts, while keeping skipped logic unchanged.

## Plan Updates

2026-02-14: Created initial ExecPlan with requirements for `recycled` status, legacy cleanup, and progress exclusion.
2026-02-14: Added task queue seeding, legacy status removal, and EphemeralDB v7 upgrade to cover resume list and NotFoundError fixes.
