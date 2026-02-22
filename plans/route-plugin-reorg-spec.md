# Route Plugin Reorg Spec Detailing

This document expands the route plugin reorganization specifications based on existing plans in `plans/`.
Each section refines one plan item with route-specific behavior, integration points, and open questions.

## Revised Direction (2025-12)

This section supersedes earlier assumptions that route data sources and processing must mirror legacy route flows. The intent is to keep route-plugin thin and move shared behaviors into shared packages, following the shape/location reorg pattern.

### Core Data Model Refresh

- `RouteEntity` is the single source of truth for dialog state.
- `RouteEntity` is stored in `TreeNode<RouteEntity>.data` and `TreeNode<RouteEntity>.draftData` (draft is `Partial<RouteEntity>`).
- Step 2 (Data Source), Step 3 (Country selection), and Step 4 (Settings) only update `RouteEntity` fields.
- `RouteLineString` is a persisted output from Stage 1 (see below) and is not required to render the dialog steps.

### Step Flow and Build Stages

1) Step 2: Data Source selection
   - Select a data source and update `RouteEntity` only.
2) Step 3: Country selection
   - Update `RouteEntity` selection fields only.
3) Step 4: Settings
   - Update `RouteEntity` settings only.
4) Step 5: Build (three stages)
   - Stage 1: Route data construction
     - Fetch/parse source data.
     - Resolve `LocationPoint` entries from sibling location nodes by name (exact match).
     - Build `RouteLineString` objects with resolved coordinates.
     - Persist the `RouteLineString` results.
   - Stage 2: Waypoint construction
     - Populate `RouteLineString.waypoints`:
       - AIRWAY: great-circle points.
       - WATERWAY: searoute.js points.
       - Others: `undefined` (straight line).
     - Future: OSRM/OpenStreetMap routing for roads/rails.
   - Stage 3: Tile generation
     - Generate vector tiles from the LineString bounding boxes.
     - Persist tiles/metadata.
5) Step 6: Preview
   - Two tabs: "Map Preview" and "Metadata Table".
   - Map Preview:
     - Show start/end icons (airport/port/station) using the same mechanism as location preview.
     - Style lines by mode:
       - AIRWAY: red
       - WATERWAY: blue
       - H_RAILWAY: orange
       - RAILWAY: green
       - ROAD (highway): light gray
       - ROAD (general): dark gray

### IDE-GSM Strategy (CSV)

IDE-GSM ingestion is defined as a CSV strategy. The first row is the header row with the exact columns:

`Start,End,Name,Distance,Speed,Border,Overhead,Loading,Mode,Quality,Oneway,Freight,Country1,Region1,Country2,Region2`

Rules:

- Rows start at line 2.
- `Start` and `End` must match `LocationPointProperties.name` (exact match) from the IDE-GSM location data source.
- Use `LocationQueryAPI` to resolve the location and obtain coordinates.
  - Build `startPoint`/`endPoint` from the resolved latitude/longitude.
  - Map `Country1` → `startPoint.admin0Name`, `Region1` → `startPoint.admin1Name`,
    `Country2` → `endPoint.admin0Name`, `Region2` → `endPoint.admin1Name`.
- `Name` maps to `RouteEntity.name`.
- `Mode` maps to `ROUTE_MODES`:
  - `0` → ROAD
  - `1` → WATERWAY
  - `2` → AIRWAY
  - `3` → RAILWAY
  - `4` → H_RAILWAY
- All other columns (`Distance`, `Speed`, `Border`, `Overhead`, `Loading`, `Quality`, `Oneway`, `Freight`)
  are preserved as metadata.

Open questions:

- If `Start`/`End` lookup fails, skip the row and record the error.
  - During build, collect error entries (row + reason) and show a summary dialog when the build completes.
- `Distance`/`Speed` are normalized into dedicated fields.
  - When waypoint generation runs for AIRWAY (great-circle) or WATERWAY (searoute-js),
    overwrite `Distance`/`Speed` with the route-derived values.

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

## Stage 2: GIS SDK Separation (Route)

Reference plan: `plans/gis-sdk-separation.md`

### Scope

- Route plugin integration points for GIS SDK (vector tile generation pipeline).
- Shared SDK package boundaries and dependencies as they affect route.
- Runtime-worker no longer owns GIS logic; route should consume the SDK via worker or direct calls.

### Goals

- Route plugin uses the same GIS SDK pipeline as shape/location for tile generation.
- Route-specific configuration maps into SDK inputs without duplicating GIS logic.
- Runtime-worker delegates GIS work to SDK, keeping route processing consistent across plugins.

### Non-goals

- No change to RouteBatchSessionOrchestrator semantics beyond new SDK call sites.
- No change to route UI step ordering or dialog behavior.
- No new route data sources or transport modes in this stage.

### Current State (Observed)

- Runtime-worker still contains GIS-specific logic in
  `packages/runtime-worker/src/services/StageProcessingService.ts`.
- Route plugin does not currently call into GIS processing directly.
- RouteBatchSessionOrchestrator persists route results and progress but does not
  own any GIS-specific algorithms.

### Target Behavior

1) A GIS SDK package owns vector tile generation and GeoJSON normalization.
2) Runtime-worker delegates GIS work to the SDK and does not import GIS libraries directly.
3) Route plugin invokes GIS SDK only through runtime-worker stage processing (no direct SDK calls).

### Integration Details

#### SDK Ownership and Dependencies

- GIS SDK owns GIS dependencies (`geojson-vt`, `@turf/*`, GeoJSON utilities).
- Runtime-worker removes GIS-specific imports and only coordinates SDK calls.
- Route plugin depends on the SDK only via public API surface.

#### Route Adapter Expectations

Route should expose or implement a thin adapter that:

- Maps route results to a GeoJSON FeatureCollection or SDK-compatible input.
- Passes route configuration (e.g., tile settings, metadata options) to the SDK.
- Receives SDK outputs (tile buffers, metadata) and persists them in route storage.
- Align adapter/controller naming and roles across shape/location/route. If an adapter is
  purely a thin pass-through, prefer direct calls into runtime-worker to avoid redundancy.

#### Route Storage Updates

- Route DB persistence remains in `plugins/route-plugin/src/services/database/RouteDB.ts`.
- The SDK should not write into route-specific DB tables directly.
- Route plugin remains responsible for linking SDK outputs to nodeId and sessionId.

### Data Flow (Route)

1) Route batch builds route results (RouteBatchManager/Orchestrator).
2) Route adapter converts results into SDK input.
3) GIS SDK generates vector tiles + optional metadata.
4) Route plugin persists outputs and updates route progress.

### Acceptance Criteria (Route Scope)

- Route plugin can generate vector tiles through the SDK pipeline (manual or test).
- Runtime-worker no longer embeds GIS algorithm code.
- Route plugin does not directly depend on runtime-worker GIS internals.

### Open Questions

- How should adapter/controller naming be normalized across shape/location/route
  while still allowing runtime-worker-only execution?

### Implementation Plan (Stage 2)

1) GIS SDK skeleton and runtime-worker delegation
   - Add `packages/` with vector tile generation API and metadata helpers.
   - Move GIS logic from `packages/runtime-worker/src/services/StageProcessingService.ts` into SDK.
   - Update runtime-worker to call SDK functions and drop direct GIS library imports.
2) Route integration (runtime-worker only)
   - Ensure route processing uses runtime-worker stage client for vector tiles only.
   - Replace route-specific adapter/controller naming to match shape/location conventions.
   - If an adapter is a pure pass-through, collapse it to direct runtime-worker calls.
3) Tile settings alignment (route config owns settings)
   - Keep tile settings in route config types; pass them to runtime-worker as execution options.
   - Align config field naming with shape/location (min/max zoom, buffer, tileSize).
4) Metadata alignment
   - Define SDK output metadata schema aligned to shape/location.
   - Map route outputs into the shared schema before persistence.
5) Validation
   - `pnpm --filter @hierarchidb/runtime-worker typecheck`
   - `pnpm --filter @hierarchidb/route-plugin typecheck`
   - `pnpm --filter @hierarchidb/shape-plugin typecheck`
   - `pnpm --filter @hierarchidb/location-plugin typecheck`
6) Rollback
   - Revert SDK package additions and runtime-worker delegation changes.
   - Restore pre-SDK logic in `StageProcessingService.ts`.

## Stage 3: Shape/Route API Boundary Adjustments (Route)

Reference plan: `plans/shape-route-api-rework.md`

### Scope

- Route Query/Mutation API surfaces as shared Worker APIs.
- Route data access for external packages (UI, app, plugins).
- Eliminate direct Dexie access outside runtime-worker services.

### Goals

- RouteQueryAPI remains the read-only interface for persisted route artifacts.
- RouteMutationAPI provides cleanup and mutation operations for persisted route data.
- UI and app code access route data via WorkerAPI/workerBridge only.

### Non-goals

- No new route batch processing features.
- No changes to route generation algorithms or transport modes.
- No changes to route DB schema unless required by API contracts.

### Current State (Observed)

- `RouteQueryAPI` is exposed via runtime-worker services and WorkerAPI.
- `RouteMutationAPI` was recently added for cleanup operations.
- Route DB remains in `plugins/route-plugin/src/services/database/RouteDB.ts`.
- UI steps use draft data and do not yet invoke route Query/Mutation APIs directly.

### Target Behavior

1) RouteQueryAPI and RouteMutationAPI are the only shared boundaries for route persistence.
2) No external package (UI/app/plugins) accesses route Dexie tables directly.
3) Cleanup flows (node deletion, build reset, etc.) use RouteMutationAPI instead of DB access.

### Integration Details

#### API Surfaces

- `packages/plugin-service-api` defines `RouteQueryAPI` and `RouteMutationAPI`.
- `packages/runtime-worker` implements:
  - `RouteQueryService` (read-only)
  - `RouteMutationService` (cleanup/write)
- `packages/common/api/src/WorkerAPI.ts` exposes:
  - `getRouteQueryAPI()`
  - `getRouteMutationAPI()`
- `app/src/worker-runtime/worker.ts` and
  `packages/ui/worker-client/src/workerBridge.ts` proxy these APIs.

#### Intended Consumers

- UI layer: use workerBridge to read route results for preview/summary UI.
- App layer: use WorkerAPI for cleanup or cross-plugin composition (e.g., map).
- Plugins: use WorkerAPI rather than importing `RouteDatabase` directly.

### Acceptance Criteria (Route Scope)

- Route data reads for UI/preview are possible via RouteQueryAPI.
- Route cleanup paths call RouteMutationAPI (no direct DB access).
- WorkerAPI/workerBridge expose both Query and Mutation APIs without leaking DB types.

### Open Questions

- Which RouteQueryAPI methods are required by UI preview (e.g., tile summary vs raw routes)?
- Should route results be exposed as GroupEntity-like DTOs or route-specific DTOs?
- Do we need a route-specific metadata summary API aligned with shape/location?

## Stage 4: Download Registry Unification (Route)

Reference plan: `plans/shape-shared-extraction-stage2-download-registry.md`

### Scope

- Route download registry wrapper and auth notifier integration.
- Shared download service cache policy and plugin defaults for route.
- Route plugin usage of `@hierarchidb/download` shared registry functions.

### Goals

- Route download logic is a thin wrapper around the shared registry.
- Route uses consistent auth notification behavior and CORS proxy resolution.
- Route download service caching follows the shared `pluginId + options` policy.

### Non-goals

- No changes to route data sources beyond registry wiring.
- No changes to download UI/UX beyond auth notifications.
- No changes to batch orchestration or route generation logic.

### Current State (Observed)

- `plugins/route-plugin/src/services/download/registry.ts` already wraps
  `@hierarchidb/download` registry functions with `pluginId = 'route'`.
- Route defaults use `perHostConcurrency: 4` and rely on shared registry
  for caching and auth notification behavior.

### Target Behavior

1) Route download registry remains a thin wrapper with no custom caching logic.
2) Auth notification precedence follows shared registry rules:
   - Plugin host registration
   - AuthNotificationRegistry fallback
   - Legacy globals
3) Route download service options are merged with shared defaults deterministically.

### Integration Details

#### Registry Wrapper

- Keep `registerRouteDownloadServiceFactory`, `getRouteDownloadService`,
  and `registerRouteAuthNotifier` as wrapper functions.
- Route wrapper should not reimplement auth fetch or CORS resolution.

#### Cache Policy

- Cache key: `route + json(options)` where options include `dbPrefix`,
  `perHostConcurrency`, and `corsProxyBaseURL`.
- Default options should be explicit to avoid drift from other plugins.

### Acceptance Criteria (Route Scope)

- Route registry code remains thin (no bespoke download helper).
- Auth-required events for route use the shared notifier precedence.
- Route download service reuse follows the shared cache policy.

### Open Questions

- Should route override `dbPrefix` explicitly or inherit shared defaults?
- Should route enforce a higher concurrency default for large datasets?

## Stage 5: Tabular API Unification (Route)

Reference plan: `plans/shape-shared-extraction-stage3-tabular-api.md`

### Scope

- Route tabular API factory and metadata manager wiring.
- Shared tabular factory in spreadsheet plugin and route integration.
- CORS proxy handling for route tabular downloads.

### Goals

- Route uses shared `createPluginTabularApi` from spreadsheet plugin.
- Route metadata manager is minimal or eliminated in favor of shared helper.
- CORS proxy handling aligns with shared download registry policy.

### Non-goals

- No changes to route data source selection UI.
- No changes to tabular processing algorithms in `@hierarchidb/ui-tabular`.
- No migration of tabular metadata DB contents.

### Current State (Observed)

- Route already calls `createPluginTabularApi` from `@hierarchidb/spreadsheet-plugin`.
- Route defines `RouteTabularMetadataManager` with DB name `route-tabular-metadata-db`.
- Route enables CORS proxy via `enableCorsProxy: true`.

### Target Behavior

1) Route factory remains a thin wrapper around shared helper.
2) Metadata DB name stays consistent and is passed to the shared helper.
3) CORS proxy resolution is centralized (shared helper + Stage 4 download registry).
4) Batch config file naming and exported type names are aligned across shape/location/route.

### Alignment Notes

- Align batch config file naming (`ObsolateBuildConfig.ts`, `build-types.ts`, etc.) across plugins.
- Prefer matching file names to their primary exported type names.

### Integration Details

#### Factory Wrapper

- `createRouteTabularApi()` should only:
  - Build or reuse a metadata manager with the route DB name.
  - Call `createPluginTabularApi({ pluginId: 'route', metadataManager, enableCorsProxy: true })`.
- Avoid subclassing metadata managers if a shared helper can accept DB name directly.

#### CORS Proxy Handling

- Prefer using a shared URL resolver from the download registry once available.
- If `enableCorsProxy` remains, ensure it reads the shared `VITE_CORS_PROXY_BASE_URL`
  precedence (Vite env → global ENV).

### Acceptance Criteria (Route Scope)

- Route tabular factory is a thin wrapper with no duplicated driver logic.
- Route metadata DB name remains `route-tabular-metadata-db`.
- CORS proxy behavior matches the shared helper behavior.

### Open Questions

- Should route keep a dedicated metadata manager class or use a shared factory for metadata?
- Should `enableCorsProxy` be replaced with an explicit URL transformer from Stage 4?

### Implementation Plan (Stage 5)

1) Inventory batch config naming across shape/location/route.
2) Align filenames to primary exports (e.g., `ObsolateBuildConfig.ts`, `build-types.ts`).
3) Update imports and re-exports in plugin entry points to preserve public API.
4) Validate with plugin typechecks and update any doc references.
5) Rollback by reverting file moves and import adjustments.

## Stage 6: Progress Hooks Unification (Route)

Reference plan: `plans/shape-shared-extraction-stage4-progress-hooks.md`

### Scope

- Route progress hook and status mapping.
- Shared `usePluginBatchProgress` integration for route.
- Pause/resume wiring alignment with WorkerBridge.

### Goals

- Route progress hook delegates to shared UI-build-progress helper.
- Route-specific status mapping remains in plugin-local logic.
- Pause/resume controls remain available and use WorkerBridge.

### Non-goals

- No changes to route batch orchestration logic.
- No changes to route build UI layout or step order.
- No change to progress event schema emitted by the worker.

### Current State (Observed)

- Route already uses `usePluginBatchProgress` from `@hierarchidb/ui-build-progress`.
- `useRouteBatchProgress` owns pause/resume mutations and maps status to unified
  progress locally.
- Route uses WorkerBridge to pause/resume, and local state to show mutation status.

### Target Behavior

1) Route continues to use the shared progress helper with plugin-specific mapping.
2) Pause/resume logic stays outside the shared helper to avoid coupling.
3) Route hook returns a consistent shape for UI (snapshot/progress/status).

### Integration Details

#### Mapping Functions

- Keep `statusToUnified` and helpers in the route hook or move to a dedicated
  mapper module if shared with other route components.
- Ensure `mapUnifiedToStatus` returns the raw `BatchSessionStatus` so UI can
  access `status`, `lastActivity`, and `error` fields.

#### Pause/Resume Controls

- Continue calling `WorkerBridge.pauseBatchSession` and `resumeBatchSession`.
- Ensure `isMutating` state reflects in-flight pause/resume actions.
- Keep error reporting (`mutationError`) in the route hook.

### Acceptance Criteria (Route Scope)

- Route hook is a thin wrapper around `usePluginBatchProgress` plus pause/resume.
- Route UI receives unified progress info with correct phase mapping.
- Pause/resume errors are surfaced without breaking progress subscription.

### Open Questions

- Should pause/resume move to a shared hook (e.g., `useBatchControl`) for route?
- Should route hook expose raw worker progress events in addition to unified snapshot?

## Stage 7: Batch Session Manager Alignment (Route)

Reference plan: `plans/shape-shared-extraction-stage5-build-session-manager.md`

### Scope

- Route batch session manager architecture and shared base alignment.
- Relationship between `RouteBatchSessionOrchestrator` and shared base manager.
- Progress emission and lifecycle control standardization.

### Goals

- Route aligns lifecycle control with `BaseBatchSessionManager` semantics.
- Progress emission follows `BatchProgressEvent` consistently.
- Route retains existing orchestration logic while adopting shared base behavior.

### Non-goals

- No change to route batch algorithms or data model.
- No change to UI/Worker API surface beyond manager wiring.
- No new pause/resume features beyond existing behavior.

### Current State (Observed)

- Route uses `RouteBatchSessionOrchestrator` implementing `IBatchSessionManager`.
- Progress is forwarded through an internal emitter that maps to `BatchProgressEvent`.
- Route session state is persisted in `RouteDatabase` (pending sessions, cursors).

### Target Behavior

1) Route uses a shared base manager or a delegating wrapper that conforms to it.
2) Session lifecycle actions (start/pause/resume/cancel/status) behave like other plugins.
3) Progress listeners are registered and cleaned up via a shared mechanism.
4) Persistence is centralized in the base manager (shared) rather than per-plugin managers.

### Integration Details

#### Manager Strategy

Two viable options must be decided and documented:

- Option A: Make `RouteBatchSessionOrchestrator` extend `BaseBatchSessionManager`
  and move its internal listener handling to `registerSession`/`emitProgress`.
- Option B: Create `RouteBatchSessionManager` that extends `BaseBatchSessionManager`
  and delegates work to `RouteBatchSessionOrchestrator`.

Decision: Adopt Option A for route, and refactor shape/location to use BaseBatchSessionManager as well.
Rationale: One shared base for lifecycle + persistence reduces drift and keeps session semantics aligned.

#### Persistence Hooks

- Move persistence responsibilities into the shared base manager where possible.
- Route-specific persistence (pending sessions, cursors) should be invoked via
  base-manager hooks to keep lifecycle semantics consistent across plugins.

### Acceptance Criteria (Route Scope)

- Route manager conforms to shared lifecycle and progress emission.
- Route progress listeners are registered through shared base APIs.
- Existing route batch flows continue to function without behavior regression.

### Open Questions

- How should base-manager persistence hooks be structured to accommodate
  shape (Dexie), location (ephemeral), and route (RouteDatabase) updates?

### Implementation Plan (Stage 7)

1) Introduce/extend BaseBatchSessionManager hooks for persistence and progress emission.
2) Refactor route: make `RouteBatchSessionOrchestrator` extend `BaseBatchSessionManager`.
3) Refactor shape/location managers to extend the shared base and migrate persistence logic into base hooks.
4) Ensure progress listeners are registered via base manager APIs.
5) Validation
   - `pnpm --filter @hierarchidb/build-runtime-services typecheck`
   - `pnpm --filter @hierarchidb/shape-plugin typecheck`
   - `pnpm --filter @hierarchidb/location-plugin typecheck`
   - `pnpm --filter @hierarchidb/route-plugin typecheck`
6) Rollback by restoring pre-base managers and removing shared base hook usage.

## Next Stages

Planned to follow in order (not detailed yet in this document):

1) Batch session manager alignment (`plans/shape-shared-extraction-stage5-build-session-manager.md`)
