# Repair location-plugin with viewport queries (non-VT)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into this repository at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, a user can build a location node from CSV sources and preview points directly on a MapLibre map without generating vector tiles. The map queries only the points inside the viewport (plus a prefetch margin) from Dexie and renders them as circle or icon markers, so the preview stays fast even with large datasets. A user can verify success by running the app, creating a location node, choosing a CSV source and country/type selections, running build in Step5, and seeing Step6 render points inside the current map view with a small margin beyond the edges.

## Progress

- [x] (2026-01-09 09:40 JST) Drafted the ExecPlan structure and captured the current file locations and APIs.
- [ ] Implement the new LocationQueryAPI viewport search and remove vector-tile reads.
- [ ] Update the LocationMutationAPI and build flow to persist points and search indexes used by viewport queries.
- [ ] Update Step2–Step6 UI to match the non-VT CSV pipeline and MapLibre preview.
- [ ] Validate with typecheck/tests and a manual preview run.

## Surprises & Discoveries

No surprises recorded yet.

## Decision Log

- Decision: Use the existing LocationQueryAPI/MutationAPI as the integration points for UI and Worker, and extend them for viewport queries instead of adding a parallel API.
  Rationale: The UI already calls `getLocationQueryAPI` and `getLocationMutationAPI` via the worker bridge; extending these interfaces keeps the change localized and testable.
  Date/Author: 2026-01-09 / Codex

## Outcomes & Retrospective

Not completed yet. This will be updated after implementation milestones are finished.

## Context and Orientation

The location plugin currently stores LocationPoint data as GroupEntity records and generates vector tiles for preview. Querying for hover and preview uses `LocationQueryService` in `packages/runtime-worker/src/services/LocationQueryService.ts`, which reads from `LocationDB.vectorTiles`. The UI entry for the dialog steps is `plugins/location-plugin/src/ui/components/steps-provider.tsx`, which includes Step2–Step6 components under `plugins/location-plugin/src/ui/components/steps/`. The preview UI is `plugins/location-plugin/src/ui/components/batch/LocationMapPreview.tsx`, which currently renders a custom map and uses `getLocationQueryAPI().findNearestLocationPoint` for hover.

The terms used in this plan are defined as follows. “Viewport” is the current visible map bounding box (bbox) in longitude/latitude degrees. “Prefetch margin” is a small expansion of the bbox used to pre-load points slightly outside the viewport to avoid pop-in during small pans. “Morton key” is a Z-order value derived from normalized lon/lat that preserves spatial locality; the plan stores it as a fixed-length hex string and uses Dexie range queries to select prefixes. “Dexie” is the IndexedDB wrapper used by this repo (in `@hierarchidb/location-store`). “MapLibre” is the map rendering library used by the app and ui-map layer components.

The plan updates the worker API definitions in `packages/plugin-service-api/src/types/LocationQueryAPI.ts` and `packages/plugin-service-api/src/types/LocationMutationAPI.ts`, the implementations in `packages/runtime-worker/src/services/LocationQueryService.ts` and `packages/runtime-worker/src/services/LocationMutationService.ts`, the storage schema in `packages//src/LocationDB.ts`, the store registrations in `plugins/location-plugin/src/worker/factory/registerLocationWorkerStores.ts`, and the preview UI in `plugins/location-plugin/src/ui/components/batch/LocationMapPreview.tsx`.

## Plan of Work

This plan replaces the vector-tile preview path with viewport-based point queries. The work is split into four milestones that are independently verifiable.

Milestone 1 defines the storage and API surface. Update `packages/plugin-service-api/src/types/LocationQueryAPI.ts` to add `queryByViewport` and `queryByMortonPrefixes` signatures that accept `bbox`, `zoom`, optional `kinds`, and the prefetch margin options defined in `docs/location-plugin-design.md`. Update `packages/plugin-service-api/src/types/LocationMutationAPI.ts` to add a bulk point upsert method if needed for CSV import results. Update `packages//src/LocationDB.ts` to store a Morton key for each point and index it by `[nodeId+mortonKey]` and `[nodeId+kind+mortonKey]`. Ensure the `LocationDB` migration clears old vector tile data and no longer registers a vector-tile table. Update `plugins/location-plugin/src/worker/locationGroupStore.dexie.ts` and `plugins/location-plugin/src/worker/normalizers.ts` so that each stored point includes its Morton key and kind, and define a consistent normalization function for lon/lat to Morton key.

Milestone 2 implements viewport queries in the worker. Replace `packages/runtime-worker/src/services/LocationQueryService.ts` logic that reads MVT data with a new path that queries the location feature store by Morton key ranges. Implement the bbox-to-prefix conversion described in `docs/location-plugin-design.md`, apply prefetch margin expansion, and then filter by the original bbox. Keep `findNearestLocationPoint` working by searching the same point store instead of vector tiles. Update any dependent code (such as `packages/runtime-worker/src/services/route/ideGsmRouteCsv.ts`) to use the new query APIs if needed.

Milestone 3 aligns Step2–Step5 build flow with CSV-only sources. Update `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx` to expose the CSV sources (OurAirports, OpenFlights, World Port Index, IDE-GSM) and hide unsupported sources. Update `plugins/location-plugin/src/ui/components/steps-provider.tsx` so that Step3 selection determines the search configs and so that Step5 uses `LocationMutationAPI` to persist points and store build configuration instead of vector tiles. Ensure Step4’s zoom range caps at 11 and stores the display settings for circle/icon ranges and size functions.

Milestone 4 replaces the preview rendering with MapLibre and viewport queries. Update `plugins/location-plugin/src/ui/components/batch/LocationMapPreview.tsx` and `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx` to use MapLibre map state, compute bbox and zoom, call `LocationQueryAPI.queryByViewport` with `prefetchMarginPx`, and render circle/icon layers from the returned points. Apply the size function and temporary color mapping defined in `docs/location-plugin-design.md`. Remove dependencies on vector tiles and ensure hover lookup continues to work using the new query API.

## Concrete Steps

All commands are run from the repository root `/Users/hiroya/WebstormProjects/hierarchidb`.

Step 1 is to locate and update the API definitions. Edit `packages/plugin-service-api/src/types/LocationQueryAPI.ts` and `packages/plugin-service-api/src/types/LocationMutationAPI.ts` to add viewport query and bulk point mutation signatures. If type generation is required, run:

  pnpm --filter @hierarchidb/plugin-service-api build:types

Step 2 is to update the location storage schema and store adapters. Edit `packages//src/LocationDB.ts` to add Morton-key indexes and remove or stop `vectorTiles` usage. Edit `plugins/location-plugin/src/worker/locationGroupStore.dexie.ts` and related normalizers so each stored point includes its Morton key.

Step 3 is to implement worker query logic. Edit `packages/runtime-worker/src/services/LocationQueryService.ts` to compute Morton prefixes from bbox and query the feature store instead of `vectorTiles`. Ensure the API supports prefetch margin options and returns points filtered by the original bbox.

Step 4 is to update the build pipeline in the UI. Edit `plugins/location-plugin/src/ui/components/steps-provider.tsx` so Step5 persists points via `LocationMutationAPI` and stores build settings. Edit `plugins/location-plugin/src/ui/components/steps/LocationDataSourceStep.tsx` and `LocationSelectionStep.tsx` to ensure CSV-only sources and country/type selection align to the design.

Step 5 is to update the preview UI. Edit `plugins/location-plugin/src/ui/components/batch/LocationMapPreview.tsx` and `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx` to query viewport points and render MapLibre layers for circle/icon modes. Apply `prefetchMarginPx` and the default size and color values from `docs/location-plugin-design.md`.

## Validation and Acceptance

Run at least the following commands and confirm success. The expected outcome is a zero exit code for each.

  pnpm --filter @hierarchidb/location-plugin typecheck
  pnpm --filter @hierarchidb/runtime-worker typecheck

Manual validation proceeds as follows. Start the app with `pnpm dev`. Create a location node, select a CSV data source and country/type selection in Step3, and run Step5 build. Confirm that Step5 reports completion without vector tile artifacts. Open Step6 and confirm the map renders points inside the viewport and slightly beyond the edges (prefetch margin). Zooming or panning should update the points without a full-page reload.

Acceptance is met when the map renders points based on viewport queries, vector tile storage is no longer used, and the build pipeline relies only on CSV parsing and point persistence.

## Idempotence and Recovery

All changes are code-only and can be repeated safely. If a migration or Dexie schema change causes issues, revert the schema changes and remove the new Morton indexes, then clear the location IndexedDB database in the browser to reset state. To roll back the full change, revert the commits that remove vector-tile usage and restore the `LocationQueryService` implementation that reads from `vectorTiles`.

## Artifacts and Notes

No artifacts yet. Once implementation begins, record short terminal transcripts for typecheck results and the manual preview confirmation here.

## Interfaces and Dependencies

This plan depends on the `LocationQueryAPI` and `LocationMutationAPI` types in `packages/plugin-service-api/src/types/`, which must include the viewport query operations and any required mutation entry points. It also depends on `LocationQueryService` in `packages/runtime-worker/src/services/LocationQueryService.ts`, which must implement those methods and avoid vector-tile reads, and on `LocationMutationService` in `packages/runtime-worker/src/services/LocationMutationService.ts`, which must persist points with Morton keys in the location feature store. The `LocationDB` schema in `packages//src/LocationDB.ts` must include indexes for Morton keys and must no longer store `vectorTiles` for location. The `LocationMapPreview` component in `plugins/location-plugin/src/ui/components/batch/LocationMapPreview.tsx` must query viewport points and render them using MapLibre layers for circle/icon modes.

Plan change note: Initial ExecPlan created on 2026-01-09 to align implementation milestones with the non-VT location design in `docs/location-plugin-design.md`.
