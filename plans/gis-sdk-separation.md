# Extract GIS SDK and Decouple Runtime Worker

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `PLANS.md` at repository root. Maintain this document in accordance with that file.

## Purpose / Big Picture

Users of the shape, location, and route plugins should see the same end-to-end behavior as today, but the GIS-specific processing (GeoJSON normalization, vector tile generation, and metadata enrichment) should no longer live inside the generic runtime worker. After this change, GIS plugins share a common SDK that owns the GIS implementation details, while runtime-worker becomes a coordinator that calls into that SDK. The change is visible by running the same UI flows as before and verifying that the plugins still generate vector tiles, but the GIS code resides in a new shared package instead of runtime-worker.

The SDK effort should treat the code currently under `plugins/shape-plugin/src/services` as the primary source of shared GIS logic. Wherever feasible, extract those utilities into the SDK and generalize them so location/route can reuse the same pipeline. Plugin-specific code should become thin: it should mainly map plugin configuration into SDK inputs, select strategy implementations, and wire UI/worker flow, while the SDK owns the GIS processing details.

## Progress

- [x] (2025-12-21 21:05) Draft plan created; no implementation yet.
- [ ] (2025-12-21 21:30) GIS SDK package scaffolded with vector-tile generation, TilesDB, and shared
      feature filtering/extraction utilities; runtime-worker begins delegating tile generation to SDK.
- [ ] (2025-12-21 21:45) Ephemeral DB schema and lifecycle helpers moved into GIS SDK and re-used by shape-plugin
      via a thin wrapper.

## Surprises & Discoveries

No surprises yet. Update this section as investigation proceeds.

## Decision Log

- 2025-12-21: GIS SDK owns vector tile generation and metadata persistence (`TilesDB`), while runtime-worker
  only coordinates buffer access and delegates tile generation to the SDK.
- 2025-12-21: Shared GIS utilities (feature filtering, geometry extraction) are moved into the SDK with
  SDK-defined configuration types to decouple from shape-plugin constants.
- 2025-12-21: Ephemeral DB schema and lifecycle operations are centralized in GIS SDK (`EphemeralGisDB`),
  and plugins use thin wrappers to bind plugin-specific DB names and config types.

## Outcomes & Retrospective

No outcomes yet. Summarize what shipped and what remains at completion.

## Context and Orientation

The current GIS flow spans multiple plugins and the runtime worker. `packages/runtime-worker/src/services/StageProcessingService.ts` currently contains vector tile generation logic and decodes GeoJSON/FlatGeobuf input to produce tiles and optional feature metadata. The shape plugin invokes this via `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts`, while the location plugin uses a similar pattern in `plugins/location-plugin/src/services/batch/LocationSessionController.ts`. The route plugin intends to follow the same pattern for vector tile generation in the future. These GIS details do not belong in the shared runtime-worker package, which should remain generic. The goal is to move GIS-specific processing into a new shared SDK package so all GIS plugins can reuse it and runtime-worker only orchestrates execution.

Terms used in this plan:

GIS SDK: A new shared library package that exposes GIS processing helpers (decoding input buffers, normalizing GeoJSON, generating vector tiles, and attaching metadata) used by shape, location, and route plugins. It contains the concrete GIS algorithms and data transformations.

Runtime worker: The shared worker package at `packages/runtime-worker` that provides cross-plugin worker services. It should only coordinate the invocation of processing steps and host generic services, but not contain GIS-specific data logic.

Vector tile generation: Converting GeoJSON feature collections into Mapbox Vector Tiles (MVT) and optionally storing feature metadata. In this repo, this currently happens inside `StageProcessingService`.

## Plan of Work

First, create a new package `packages/` (name to be confirmed) that holds GIS-specific logic. The SDK should include a module that can take a FeatureCollection (or a buffer plus an adapter) and generate vector tiles plus optional metadata. Move the relevant algorithms from `packages/runtime-worker/src/services/StageProcessingService.ts` into the SDK. Keep runtime-worker limited to calling SDK functions and storing results, with no GIS algorithms in runtime-worker.

Second, update `plugins/shape-plugin`, `plugins/location-plugin`, and `plugins/route-plugin` to call the GIS SDK directly (or through a thin adapter) instead of relying on runtime-worker internals. The adapters should pass FeatureCollection-like data and configuration to the SDK. Ensure that the runtime-worker still provides a generic worker client, but the GIS SDK does the actual GIS processing.

Third, align type definitions and dependencies. The GIS SDK should own dependencies like `geojson-vt`, `@turf/area`, and any GeoJSON-related helpers. The runtime-worker should not depend on GIS-specific libraries. Where possible, move imports from runtime-worker into the GIS SDK or into the plugins that use the SDK. This keeps the dependency graph clean and avoids forcing runtime-worker to ship GIS dependencies.

Fourth, prioritize shared logic under `plugins/shape-plugin/src/services` and migrate it into the SDK with abstractions so that location/route can reuse it. This includes build-stage helpers, storage ports, data normalization utilities, and tile-generation helpers. The goal is to keep plugin-specific code small and focused on configuration rather than implementation.

Finally, update tests and validation. Add or update tests in the GIS SDK package or in the plugins so that vector tile generation still works. Verify that shape/location/route plugin flows still behave as before.

## Concrete Steps

1) Inspect current GIS processing logic and list the functions that must move.

   - Read `packages/runtime-worker/src/services/StageProcessingService.ts` and identify the GeoJSON decoding, normalization, tile generation, and metadata extraction blocks.
   - Read the adapter entrypoints in `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts` and `plugins/location-plugin/src/services/batch/LocationSessionController.ts` to understand how they invoke runtime-worker today.

2) Create a new GIS SDK package.

   - Create `packages//package.json`, `packages//src/index.ts`, and any module files needed for tile generation and metadata.
   - Export a small API surface, for example:
     - `createVectorTileGenerator(config): VectorTileGenerator`
     - `generateTiles(input: FeatureCollection, options): VectorTileResult`
     - `buildFeatureMetadata(features, context): FeatureMetadataRow[]`

   The exact names should be chosen to be descriptive and stable.

3) Move GIS logic into the SDK.

   - Move or copy the logic from `StageProcessingService` into the SDK. Keep runtime-worker free of GIS processing details. Any helper types should live in the SDK package.
   - Ensure the SDK is responsible for decoding and normalizing GeoJSON, if needed. If decode belongs in plugins (for example, shape uses FlatGeobuf), provide helpers or accept FeatureCollection input only.

4) Update runtime-worker to use the SDK.

   - Replace GIS logic in `packages/runtime-worker/src/services/StageProcessingService.ts` with calls into the SDK.
   - Remove GIS-specific imports from runtime-worker package.json and from the code. The runtime-worker should rely on the SDK for GIS operations.

5) Update plugins to call the SDK or the new worker entrypoint.

   - Update `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerVectorTileAdapter.ts` to ensure it passes properly normalized GeoJSON to the SDK or via runtime-worker.
   - Update `plugins/location-plugin/src/services/batch/LocationSessionController.ts` to match the new SDK pipeline.
   - For route plugin, add the SDK wiring where vector tile generation is intended.

6) Verify compile and runtime paths.

   - Run typechecks for affected packages.
   - Run unit or integration tests that cover vector tile generation or stage processing.
   - Perform a manual check that a shape plugin preview still generates tiles.

## Validation and Acceptance

Acceptance is confirmed when:

1) A developer can run the same UI flow as before for shape and location plugins and see vector tiles produced.
2) runtime-worker no longer contains GIS algorithms; the GIS SDK package contains them instead.
3) Typechecks for `@hierarchidb/runtime-worker`, `@hierarchidb/shape-plugin`, and `@hierarchidb/location-plugin` pass or only fail for known, unrelated reasons.

Suggested commands, run from the repository root:

  pnpm --filter @hierarchidb/runtime-worker typecheck
  pnpm --filter @hierarchidb/shape-plugin typecheck
  pnpm --filter @hierarchidb/location-plugin typecheck

If route plugin changes are made, also run:

  pnpm --filter @hierarchidb/route-plugin typecheck

## Idempotence and Recovery

The steps are safe to re-run. If a step fails, revert the modified files and rerun the commands. Keep the GIS SDK package additive until all plugins have migrated, then remove old GIS code from runtime-worker after validation. If any part of the SDK integration fails, roll back to the prior runtime-worker implementation and leave the SDK package unused until the issues are resolved.

## Artifacts and Notes

Include short diffs or logs for moved GIS functions and dependency changes as evidence when the plan is executed. Keep records of test outputs in the linked GitHub Issue under the relevant worklog entry.

## Interfaces and Dependencies

The GIS SDK must own GIS dependencies such as `geojson-vt`, `@turf/area`, and any GeoJSON utilities. runtime-worker must not depend on these libraries. Plugins may depend on the SDK, but only through its public API. The SDK should export clear, typed functions for tile generation and metadata collection. Any worker communication should be handled at a higher layer, outside of the SDK, so the SDK can be used in both worker and direct-call contexts.

Plan changes: Initial draft created to describe extraction of GIS SDK and runtime-worker decoupling for shape/location/route plugins. Future updates should record concrete APIs and final package naming.
