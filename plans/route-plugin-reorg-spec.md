# Route Plugin Reorg Spec Detailing

This document expands the route plugin reorganization specifications based on existing plans in `plans/`.
Each section refines one plan item with route-specific behavior, integration points, and open questions.

## Stage 1: Runtime Worker Adapter Registration (Route)

Reference plan: `plans/shape-shared-extraction-stage1-runtime-worker.md`

### Scope

- Route plugin runtime-worker adapter registration and wiring only.
- Applies to runtime bootstrap and feature-flag handling.
- Does not change route batch session behavior or GIS processing logic.

### Goals

- Route plugin registers a runtime-worker adapter via the shared helper.
- The registration is invoked automatically during plugin wiring.
- Feature flag `ROUTE_RUNTIME_WORKER` gates runtime-worker usage and is safe to toggle at runtime.

### Non-goals

- No changes to RouteBatchSessionOrchestrator behavior or routing algorithms.
- No change to `RouteBatchManager` processing flow.
- No integration of GIS SDK or runtime-worker worker outputs in this stage.

### Current State (Observed)

- Route plugin exports `registerRouteRuntimeWorkerAdapters()` in
  `plugins/route-plugin/src/services/batch/adapters/registerRuntimeWorker.ts`.
- The function uses `registerPluginRuntimeWorkerAdapters()` from `@hierarchidb/runtime-worker`
  with `pluginId: 'route'` and `flagName: 'ROUTE_RUNTIME_WORKER'`.
- Route plugin does not currently export a `RuntimeWiring` hook, so the registration
  function is not called during `wirePluginsFromModules`.
- Runtime-worker adapter registration is therefore unused in the current route flow.

### Target Behavior

1) When the route plugin module is loaded, the runtime wiring hook triggers
   `registerRouteRuntimeWorkerAdapters()` exactly once per app session.
2) The adapter registration uses the shared helper to register a provider that:
   - Reads `ROUTE_RUNTIME_WORKER` from localStorage, global scope, or runtime env.
   - Returns `null` when the flag is disabled (default).
   - Attempts dynamic import of `@hierarchidb/runtime-worker-worker` when enabled.
   - Returns `null` if the worker package is unavailable or creation fails.
3) The registration is idempotent and never throws to callers.

### Integration Details

#### Runtime Wiring Export

Add a `RuntimeWiring` export in `plugins/route-plugin/src/index.ts`:

- `RuntimeWiring.registerRuntimeWorkerAdapters()` should lazy-import and call
  `registerRouteRuntimeWorkerAdapters()`.
- Use try/catch and swallow errors to match existing plugin wiring behavior.

Rationale: `packages/ui/worker-client/src/wiring/wirePlugins.ts` only invokes
`registerRuntimeWorkerAdapters` via `RuntimeWiring` or `runtimeWiring` exports.

#### Adapter Registration Flow

1) App loads plugin modules via plugin registry.
2) `wirePluginsFromModules()` scans exports and finds `RuntimeWiring`.
3) `RuntimeWiring.registerRuntimeWorkerAdapters()` invokes
   `registerRouteRuntimeWorkerAdapters()`.
4) `registerPluginRuntimeWorkerAdapters()` registers a provider in
   `RuntimeWorkerService` keyed by `pluginId = 'route'`.
5) The provider reads `ROUTE_RUNTIME_WORKER` at call time and returns either:
   - A Comlink-backed stage worker client (if worker package is available).
   - `null` (if flag disabled or worker unavailable).

### Flag Semantics

- Flag name: `ROUTE_RUNTIME_WORKER`.
- Default: disabled (`false`).
- Accepted values (case-insensitive): `1`, `true`, `on`, `enabled`.
- Lookup order:
  1) `localStorage.getItem('ROUTE_RUNTIME_WORKER')`
  2) `globalThis.ROUTE_RUNTIME_WORKER`
  3) `readRuntimeEnvValue('ROUTE_RUNTIME_WORKER')`

### Failure and Safety Behavior

- Dynamic import errors are swallowed and treated as `null` client.
- The helper never throws on missing worker package.
- The registration should not block UI or batch session creation.

### Acceptance Criteria (Route Scope)

- Route plugin exports a `RuntimeWiring` with `registerRuntimeWorkerAdapters`.
- `registerRouteRuntimeWorkerAdapters()` is invoked during plugin wiring.
- Enabling `ROUTE_RUNTIME_WORKER` does not crash when
  `@hierarchidb/runtime-worker-worker` is absent.

### Open Questions

- Should route plugin enable a local fallback (`allowLocalWorker = true`) to
  reuse `createStageWorkerClient` without the worker package?
- Should the route plugin log a warning when the flag is enabled but the worker
  package is missing, or remain silent for parity with shape/location?

## Next Stages

Planned to follow in order (not detailed yet in this document):

1) GIS SDK separation (`plans/gis-sdk-separation.md`)
2) Shape/Route API boundary adjustments (`plans/shape-route-api-rework.md`)
3) Download registry unification (`plans/shape-shared-extraction-stage2-download-registry.md`)
4) Tabular API unification (`plans/shape-shared-extraction-stage3-tabular-api.md`)
5) Progress hooks unification (`plans/shape-shared-extraction-stage4-progress-hooks.md`)
6) Batch session manager alignment (`plans/shape-shared-extraction-stage5-batch-session-manager.md`)
