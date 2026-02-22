# Stage 4: Unify Batch Progress Hooks and Status Mapping

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repository root at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, shape, location, and route use a shared progress hook that handles worker bridge subscription and polling, while each plugin supplies only its mapping logic. This reduces duplicated logic and makes progress behavior consistent across plugins. The change is visible by verifying that plugin hooks delegate to the shared helper and by running plugin typechecks.

## Progress

- [ ] (2025-12-26 10:55 JST) Draft plan created; implementation not started.

## Surprises & Discoveries

- Observation: Shape uses `@hierarchidb/ui/batch` and has a dedicated mapping file, while location and route each reimplement progress hooks with different packages and error handling.
  Evidence: `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`, `plugins/shape-plugin/src/ui/hooks/progress/shapeBuildProgressMapping.ts`, `plugins/location-plugin/src/common/hooks/useLocationProgress.ts`, `plugins/route-plugin/src/ui/hooks/useRouteBatchProgress.ts`.

## Decision Log

- Decision: Extend `packages/ui/batch` to provide the shared hook for UI usage, with plugin-specific mappers passed in.
  Rationale: The shared hook already exists in `packages/ui/batch/src/hooks/useBatchProgressState.ts` and is designed for UI consumption.
  Date/Author: 2025-12-26 / Codex

## Outcomes & Retrospective

Pending. This section will summarize what was achieved and any remaining gaps after implementation.

## Context and Orientation

Batch progress hooks subscribe to worker bridge progress events and map the unified progress information to plugin-specific UI models. Shape already uses `useBatchProgressState` and a mapping file. Location and route directly use `useBatchProgress` with custom logic and different packages.

Key files:

- `packages/ui/batch/src/hooks/useBatchProgressState.ts`
- `plugins/shape-plugin/src/ui/hooks/useShapeProgress.ts`
- `plugins/shape-plugin/src/ui/hooks/progress/shapeBuildProgressMapping.ts`
- `plugins/location-plugin/src/common/hooks/useLocationProgress.ts`
- `plugins/route-plugin/src/ui/hooks/useRouteBatchProgress.ts`

A “progress hook” in this plan means a React hook that returns a progress snapshot, status information, and subscribe/unsubscribe controls for a batch session.

## Plan of Work

Create a shared hook in `packages/ui/batch` that wraps `useBatchProgressState` and accepts mapping functions. The hook should take `nodeType`, `sessionId`, and mapping functions for `mapStatusToUnified` and `mapUnifiedToPluginProgress`, with optional polling fallback configuration. Then, refactor shape, location, and route hooks to call the shared hook and supply their mapping functions. Keep plugin-specific types and UI model conversions in plugin files.

## Concrete Steps

1) Add a new helper in `packages/ui/batch/src/hooks/usePluginBatchProgress.ts` that exposes:

   - `usePluginBatchProgress({ nodeType, sessionId, mapStatusToUnified, mapUnifiedToPluginProgress, options })`

   The helper should call `useBatchProgressState` internally and return a merged object with `progress`, `status`, `isSubscribed`, and subscription helpers, plus any mapped output.

2) Export the helper from `packages/ui/batch/src/index.ts`.

3) Refactor shape’s `useShapeProgress` to call `usePluginBatchProgress`, keeping `shapeBuildProgressMapping.ts` for `statusToUnified`, `toShapeProgress`, and `toShapeStatus` functions.

4) Refactor location’s `useLocationProgress` to use the shared helper, porting its mapping logic into a plugin-local mapper. Preserve any auth-notification behavior by either adding optional callbacks to the shared helper or keeping a small wrapper that injects the auth override state.

5) Refactor route’s `useRouteBatchProgress` to use the shared helper and move its status mapping into a mapper function. Keep pause/resume logic separate if the shared helper does not cover mutation actions.

6) Align the progress packages so all three use `@hierarchidb/ui/batch` (or a single shared package) to avoid drifting APIs.

## Validation and Acceptance

- Run `pnpm --filter @hierarchidb/ui-build-progress typecheck` and expect exit code 0.
- Run `pnpm --filter @hierarchidb/shape-plugin typecheck`, `pnpm --filter @hierarchidb/location-plugin typecheck`, and `pnpm --filter @hierarchidb/route-plugin typecheck` and expect exit code 0.
- Verify that the plugin-specific hooks are wrappers around the shared helper, with mapping functions supplied from plugin files.

## Idempotence and Recovery

The change can be repeated safely. To rollback, restore each plugin’s original hook implementation and remove the shared helper export from `packages/ui/batch`.

## Artifacts and Notes

Expected usage example in a plugin:

  const { progress, status, isSubscribed } = usePluginBatchProgress({
    nodeType: 'shape',
    sessionId,
    mapStatusToUnified: statusToUnified,
    mapUnifiedToPluginProgress: toShapeProgress,
  });

## 追加調査メモ（2025-12-26）

- shape: UI から pause/resume の導線が存在（`ShapeBuildStep` → `BuildStep`）。
- route: UI hook が `pauseBatchSession`/`resumeBatchSession` を直接呼ぶ実装あり（`useRouteBatchProgress`）。
- location: UI に pause/resume ボタンはあるが、現状はローカル state の切替のみで WorkerBridge へ未接続（`BatchProgressDialog`）。
- location/route 開発時は pause/resume の UI ⇔ Worker の接続状況を前提条件として明記し、location 側の実配線を優先課題として扱う。

## Interfaces and Dependencies

- New helper: `usePluginBatchProgress` in `packages/ui/batch`.
- Depends on: `useBatchProgressState`, `getWorkerBridge`, `useBatchProgress`.
- Plugin-specific mapping functions remain in plugin modules.
