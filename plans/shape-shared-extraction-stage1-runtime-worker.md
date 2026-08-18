# Stage 1: Unify Runtime Worker Adapter Registration

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repository root at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, all plugins register runtime-worker adapters through one shared helper. A developer can enable the same feature-flagged runtime worker behavior for shape, location, and route without duplicating logic in each plugin. This reduces drift and makes it easier to add or adjust flags in one place. The change is visible by running a plugin typecheck and seeing that each plugin now calls a shared registration function rather than custom logic.

## Progress

- [ ] (2025-12-26 10:55 JST) Draft plan created; implementation not started.
- [ ] (2025-12-26 11:41 JST) Review update drafted; flag policy and dependency notes added.

## Surprises & Discoveries

- Observation: Each plugin has its own `RuntimeWorkerClient` and `registerRuntimeWorker` file, with subtle differences in flag and import logic.
  Evidence: `plugins/shape-plugin/src/services/batch/adapters/registerRuntimeWorker.ts`, `plugins/location-plugin/src/services/batch/adapters/registerRuntimeWorker.ts`, `plugins/route-plugin/src/services/batch/adapters/registerRuntimeWorker.ts`.
- Observation: Shape uses a direct `createStageWorkerClient` import, while location/route use a dynamic import of `@hierarchidb/runtime-worker-worker`.
  Evidence: `plugins/shape-plugin/src/services/batch/adapters/registerRuntimeWorker.ts` vs. location/route equivalents.

## Decision Log

- Decision: Centralize registration logic in `packages/runtime-worker` rather than a plugin package.
  Rationale: The shared logic is runtime-worker-specific and already depends on `registerRuntimeWorkerClient` and `createStageWorkerClient`.
  Date/Author: 2025-12-26 / Codex
- Decision: Use a consistent flag naming convention (`<PLUGIN>_RUNTIME_WORKER`) and add `SHAPE_RUNTIME_WORKER` for shape.
  Rationale: Location/route already use this pattern; shape needs parity for shared behavior toggling.
  Date/Author: 2025-12-26 / Codex

## Outcomes & Retrospective

Pending. This section will summarize what was achieved and any remaining gaps after implementation.

## Context and Orientation

The runtime worker client is a Comlink-backed stage-processing client used by plugin batch sessions. Each plugin currently defines:

- A thin wrapper for `registerRuntimeWorkerClient` and `getRuntimeWorkerClient`.
- A plugin-specific `registerRuntimeWorkerAdapters` function that decides when to create the worker client.

Key files:

- `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerClient.ts`
- `plugins/shape-plugin/src/services/batch/adapters/registerRuntimeWorker.ts`
- `plugins/location-plugin/src/services/batch/adapters/RuntimeWorkerClient.ts`
- `plugins/location-plugin/src/services/batch/adapters/registerRuntimeWorker.ts`
- `plugins/route-plugin/src/services/batch/adapters/RuntimeWorkerClient.ts`
- `plugins/route-plugin/src/services/batch/adapters/registerRuntimeWorker.ts`
- `packages/runtime-worker/src/index.ts`

A “runtime worker client” is a stage-processing client created by `createStageWorkerClient` that runs in a Web Worker. Registration means a plugin calls `registerRuntimeWorkerClient(pluginId, provider)` so that batch managers can later request a client by plugin id.

Flag evaluation is currently implemented separately per plugin using `localStorage`, global scope variables, and `readRuntimeEnvValue`. The unified helper must preserve this behavior while allowing optional overrides for environments that use direct client creation.

## Plan of Work

Create a shared helper in `packages/runtime-worker/src` that encapsulates the feature-flag check, optional dynamic import of `@hierarchidb/runtime-worker-worker`, and the final `registerRuntimeWorkerClient` call. The helper must accept a plugin id and a flag name. It should also allow a custom client factory for environments where `createStageWorkerClient` is directly available. After adding the helper and exporting it, replace the plugin-specific `registerRuntimeWorkerAdapters` implementations in shape, location, and route with thin wrappers that call the new helper using their plugin id and flag name. Keep the plugin-specific `RuntimeWorkerClient` wrapper modules, but remove any custom logic duplicated across plugins.

If the helper uses `readRuntimeEnvValue`, update `packages/runtime-worker` dependencies to include `@hierarchidb/util`. Document the new `SHAPE_RUNTIME_WORKER` flag in the linked GitHub Issue or a central feature-flag document so it is discoverable alongside location/route flags.

## Concrete Steps

1) Add a new helper module in `packages/runtime-worker/src/pluginRuntimeWorkerAdapters.ts` with a function similar to:

   - `registerPluginRuntimeWorkerAdapters({ pluginId, flagName, createClient })` where:
     - `pluginId` is a string like `shape`, `location`, or `route`.
     - `flagName` is the feature flag to enable the runtime worker client, defaulting to `PLUGINID_RUNTIME_WORKER` if omitted.
     - `createClient` optionally overrides the default dynamic import of `@hierarchidb/runtime-worker-worker` and calls `createStageWorkerClient`.

   The function should encapsulate the existing logic from location/route to read runtime flag values (localStorage, global, `readRuntimeEnvValue`) and fall back safely when the worker package is unavailable.

2) Export the new helper from `packages/runtime-worker/src/index.ts`.

3) Update `plugins/shape-plugin/src/services/batch/adapters/registerRuntimeWorker.ts` to call the helper with `pluginId: 'shape'` and flag `SHAPE_RUNTIME_WORKER`, and remove direct use of `createStageWorkerClient` unless the helper override path is needed in tests.

4) Update `plugins/location-plugin/src/services/batch/adapters/registerRuntimeWorker.ts` and `plugins/route-plugin/src/services/batch/adapters/registerRuntimeWorker.ts` to call the helper with their plugin id and existing flag names. Keep the existing export names to avoid downstream changes.

5) Ensure that any tests or types that depend on the previous module structure continue to compile, and add a unit test in `packages/runtime-worker` if a shared helper needs coverage.

6) Update documentation or task logs to record the new `SHAPE_RUNTIME_WORKER` flag and its default (off).

## Validation and Acceptance

- Run `pnpm --filter @hierarchidb/runtime-worker typecheck` and expect exit code 0.
- Run `pnpm --filter @hierarchidb/shape-plugin typecheck`, `pnpm --filter @hierarchidb/location-plugin typecheck`, and `pnpm --filter @hierarchidb/route-plugin typecheck` and expect exit code 0.
- Confirm that each plugin’s `registerRuntimeWorkerAdapters` is a thin wrapper using the shared helper.
- In a dev environment, toggle `SHAPE_RUNTIME_WORKER=1` (via localStorage or env) and confirm the helper attempts to create a worker client without throwing when the worker package is absent.

## Idempotence and Recovery

The steps are additive and safe to re-run. If something goes wrong, revert the updated plugin adapter files and the new helper module, then re-run the same typecheck commands to confirm the previous behavior has returned.

## Artifacts and Notes

Expected snippet after refactor (example structure, not exact code):

  export function registerShapeRuntimeWorkerAdapters(): Promise<void> {
    return registerPluginRuntimeWorkerAdapters({
      pluginId: 'shape',
      flagName: 'SHAPE_RUNTIME_WORKER',
    });
  }

## Interfaces and Dependencies

- New helper: `registerPluginRuntimeWorkerAdapters` in `packages/runtime-worker`.
- Existing dependencies: `registerRuntimeWorkerClient`, `getRuntimeWorkerClient`, `createStageWorkerClient`, `readRuntimeEnvValue`.
- No new external dependencies.

Revision note (2025-12-26): 形プラグインのフラグ追加、依存追加の可能性、動的 import の優先順を明記するため各節を追記した。
