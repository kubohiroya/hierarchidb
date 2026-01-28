# Location/Route Step4-6 Vector Tile Settings, Build, and Metadata

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repository root at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

After implementing this plan, both the Location and Route plugins will mirror the Shape plugin’s later steps: Step 4 will expose vector tile generation settings (worker concurrency and zoom range), Step 5 will run a two-stage build (Stage 1: generate point/line GeoJSON, Stage 2: delegate vector tile generation using the runtime-worker path aligned with Shape), and Step 6 will display metadata with columns tailored to each plugin. Users will be able to configure how many workers generate tiles, set the zoom range for produced tiles, trigger builds that persist tiles and metadata, and inspect the resulting metadata table inside the dialog.

## Progress

- [x] (2025-12-31 04:10 UTC) ExecPlan created with scope, context, and milestones.
- [x] (2025-12-31 05:25 UTC) Step 4 settings implemented for Location and Route (UI + data model + validation).
- [x] (2025-12-31 05:55 UTC) Step 5 build pipeline implemented for Location and Route (Stage1 GeoJSON, Stage2 vector tiles via runtime-worker).
- [x] (2025-12-31 06:10 UTC) Step 6 metadata preview implemented for Location and Route with plugin-specific columns.
- [ ] Validation executed (typechecks/tests) and results recorded. (Blocked: workspace dependencies missing during typecheck; see Surprises.)

## Surprises & Discoveries

- Observation: pnpm typecheck for @hierarchidb/location-plugin fails early because multiple workspace packages cannot be resolved (e.g., @hierarchidb/util, @hierarchidb/tabular-source, plugin worker bundles). This appears to be an environment/dependency linking gap rather than the new changes.
  Evidence: `pnpm --filter @hierarchidb/location-plugin typecheck` returned TS2307 module resolution errors for shared packages and generated worker loaders.

## Decision Log

- Decision: Route vector tile build requires existing lineGeometry data; startBatch keeps the flow simple by using the drafted geometry directly and persisting vector tiles/metadata from that payload.
  Rationale: Avoids introducing additional location resolution calls in this iteration while enabling Stage 1 (GeoJSON) + Stage 2 (vector tiles) end-to-end when geometry is present.
  Date/Author: 2025-12-31 / Codex

## Outcomes & Retrospective

Pending.

## Context and Orientation

Location plugin current steps live in `plugins/location-plugin/src/ui/components/steps-provider.tsx` with step components under `plugins/location-plugin/src/ui/components/steps/`. The batch settings step (`LocationBatchParametersStep.tsx`) already exposes download concurrency and tile zooms; the build step (`LocationBuildStep.tsx`) triggers `LocationVectorTileService.startSession`, which delegates to `UnifiedLocationBatchManager` and `LocationSessionController` for point-to-MVT conversion. Metadata preview is inside `LocationMapPreviewStep.tsx` using `DataGridPreview` and `EphemeralLocationDB`.

Route plugin steps are defined in `plugins/route-plugin/src/ui/components/steps-provider.tsx` and components under `plugins/route-plugin/src/ui/components/steps/`. Build/startBatch is currently a stub that only notifies. Batch logic lives in `plugins/route-plugin/src/services/RouteBatchSession.ts`, `RouteBatchManager.ts`, and `RouteBatchSessionOrchestrator.ts`, but no vector tile generation exists yet.

Shape plugin provides the reference behavior: Settings, vector tile build stages, and metadata preview (`plugins/shape-plugin/src/ui/components/steps-provider.tsx`, `ShapeBuildStep.tsx`, `ShapePreviewStep.tsx`, `useShapeBuildStep.ts`, and vector tile adapters under `plugins/shape-plugin/src/services/batch`). Runtime worker adapters for vector tiles are already wired via `RuntimeWorkerVectorTileAdapter` and `RuntimeTileClient`.

Tabular metadata is persisted via `@hierarchidb/tabular-store` with `TabularWriter` in the batch controllers (e.g., `LocationSessionController.ts`, `RouteBatchSession.ts`). Vector tiles are stored in plugin-specific ephemeral Dexie DBs (`plugins/location-plugin/src/database/EphemeralLocationDB.ts`, `plugins/route-plugin/src/worker/*` once implemented).

## Plan of Work

Milestone 1: Step 4 settings parity
  - Add vector tile generation settings (worker concurrency and zoom range) to Step 4 for both plugins. For Location, align labels and validation with Shape’s processing config while preserving existing download controls. For Route, introduce a processing/settings step that feeds new batch config fields used by the build pipeline. Update i18n keys.
  - Ensure settings flow through draft data to the worker-side batch configs (e.g., extend `UnifiedLocationBatchConfig` and Route batch config).

Milestone 2: Step 5 build (Stage1 GeoJSON + Stage2 vector tiles)
  - Location: adjust build pipeline to respect the new Step 4 settings (tile worker concurrency and zoom range) and ensure Stage 1 generates point GeoJSON, Stage 2 delegates to runtime-worker vector tile generation similar to Shape’s `RuntimeWorkerVectorTileAdapter`. Confirm session metadata and tile persistence remain compatible with `LocationMapPreviewStep`.
  - Route: implement a new two-stage build that (a) materializes LineString GeoJSON from Route entities (start/end points and generated waypoints) and (b) delegates vector tile generation using the same runtime-worker adapter pattern as Shape. Persist tiles and metadata into Route DB for preview.
  - Wire Step 5 build UI to launch the batch, show progress, and subscribe to batch events (reuse Shape/Location progress hooks as templates).

Milestone 3: Step 6 metadata preview
  - Add a metadata preview step mirroring Shape’s preview step. For Location, reuse existing grid but align column definitions with the new pipeline; for Route, add grid/table rendering with columns suitable for routes (start/end, mode, distance, etc.). Ensure zoom/summary info mirrors Shape’s presentation.

Milestone 4: Validation
  - Run focused checks: `pnpm --filter @hierarchidb/location-plugin typecheck`, `pnpm --filter @hierarchidb/route-plugin typecheck`, and any affected shared packages/tests. Record outputs and note any skipped tests with reasons.

## Concrete Steps

1) Add Step 4 settings:
   - Location: extend `LocationBatchParametersStep` and step config to surface tile worker concurrency and zoom range explicitly for vector tile generation; ensure defaults and clamping mirror Shape processing config where applicable.
   - Route: create/update a processing/settings step to include tile worker concurrency and zoom range; ensure draft persistence and validation in `steps-provider.tsx`.

2) Implement Step 5 build:
   - Location: thread new settings into `startLocationBatch` and `LocationVectorTileService`/`UnifiedLocationBatchManager` so Stage 1 GeoJSON (points) and Stage 2 vector tiles honor worker counts and zoom ranges; align progress stages with Shape naming.
   - Route: build Stage 1 LineString GeoJSON generation and Stage 2 vector tile generation using runtime-worker vector tile adapter (similar to Shape’s `RuntimeWorkerVectorTileAdapter`), persisting tiles/metadata to Route DB. Update `RouteBatchManager`/`RouteBatchSession` as needed and wire UI `RouteBuildStep`.

3) Add Step 6 metadata preview:
   - Location: align metadata tab with Shape’s preview pattern (column definitions, summary copy) while keeping location-specific columns.
   - Route: add metadata preview step and hook to the new tabular data; provide columns for route-specific fields (start/end, mode, distance, etc.).

4) Validation:
   - Run plugin typechecks and any targeted tests; capture command outputs for the final report and note gaps if tests are skipped.

## Validation and Acceptance

Execute from repo root:
  - pnpm --filter @hierarchidb/location-plugin typecheck
  - pnpm --filter @hierarchidb/route-plugin typecheck
  - pnpm test (or targeted suites if available) when feasible

Acceptance criteria:
  1) Step 4 in both plugins exposes tile worker concurrency and zoom range settings, persisted through draft data and validated.
  2) Step 5 builds run two-stage pipelines (GeoJSON then vector tile generation) and store vector tiles/metadata accessible via previews.
  3) Step 6 previews show metadata tables with plugin-appropriate columns, similar UX to Shape.
  4) Typechecks/tests pass or documented with justified skips.

## Idempotence and Recovery

Changes are additive and use existing managers/services. If a batch build fails, clearing pending sessions/vector tiles in the plugin’s Ephemeral DB and re-running the batch should recover. Reverting the commits restores prior behavior without schema changes.

## Artifacts and Notes

Record validation outputs and any runtime-worker adapter changes in `TASKS.md` and this plan’s Progress section. Document any discovered worker feature gaps in the Decision Log.

## Interfaces and Dependencies

- UI steps: `plugins/location-plugin/src/ui/components/steps-*`, `plugins/route-plugin/src/ui/components/steps-*`.
- Batch pipelines: `plugins/location-plugin/src/services/batch/*`, `plugins/route-plugin/src/services/*`.
- Runtime worker vector tile adapters: reference `plugins/shape-plugin/src/services/batch/RuntimeWorkerVectorTileAdapter.ts` and `RuntimeTileClient.ts`.
- Metadata storage: `@hierarchidb/tabular-store`, plugin Ephemeral DBs, `DataGridPreview` in `@hierarchidb/ui-grid`.
