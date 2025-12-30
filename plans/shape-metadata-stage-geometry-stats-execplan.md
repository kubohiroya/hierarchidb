# Stage Geometry Stats in Shape Metadata

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Users need to understand how vertex and polygon counts change from raw downloads through extraction and into vector tiles. After this change, the Step6 metadata table shows one row per origin dataset (the downloaded file unit) with vertex and polygon totals for four stages: raw, extract1, extract2, and vector tiles. A user can build a dataset and immediately see those four pairs of numbers for each origin in the metadata table, instead of relying on a single per-feature statistic whose stage was unclear.

## Progress

- [x] (2025-12-30 12:44 JST) Confirmed the relevant metadata storage and UI entry points for Step6 and located where per-feature vertex/polygon counts are currently generated.
- [x] (2025-12-30 12:46 JST) Created the initial ExecPlan document.
- [ ] Maintain this ExecPlan while implementing the change end-to-end.
- [ ] Define and store stage-level geometry aggregates per origin dataset in the shape metadata DB.
- [ ] Update vector tile stage to compute aggregates from tile contents grouped by origin.
- [ ] Update Step6 metadata table to display the new stage-level columns and labels.
- [ ] Validate manually (and with a targeted test if feasible) that the new aggregates appear after a build.

## Surprises & Discoveries

- Observation: The existing `ShapeTileMetadataDB.featureMetadata` rows are created from extract2 feature buffers inside `plugins/shape-plugin/src/services/batch/SessionController.ts` (`ensureTileFeatureIndex`), not from raw downloads or vector tiles.
  Evidence: `ensureTileFeatureIndex` decodes extract2 buffers and writes `vertexCount`/`polygonCount` to `featureMetadata`.

## Decision Log

- Decision: Treat the “origin dataset” as the unit described by a download output (data source + country/admin level, plus optional feature group identifiers when present).
  Rationale: Download outputs are the only stable, existing unit shared across stages; they align with the user’s request to aggregate by the downloaded file rather than per-feature.
  Date/Author: 2025-12-30 / Codex

## Outcomes & Retrospective

Pending. This section will be updated after the first milestone and again on completion.

## Context and Orientation

Step6 metadata currently comes from `ShapeTileMetadataDB.featureMetadata` and is rendered by `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts` and `plugins/shape-plugin/src/ui/hooks/preview/useVectorTilePreviewTable.ts`. The feature metadata rows are created in `plugins/shape-plugin/src/services/batch/SessionController.ts` by `ensureTileFeatureIndex`, which reads extract2 buffers and computes vertex/polygon counts per feature. Vector tile generation lives in `packages/features/gis-sdk/src/vectorTiles.ts`, which can also emit per-feature metadata when `metadataEnabled` is true, but the shape pipeline currently disables that.

The requested change is to add a new per-origin aggregate table in `plugins/shape-plugin/src/services/database/ShapeTileMetadataDB.ts`. Each row represents one downloaded origin dataset (typically keyed by data source + country code + admin level, with an optional feature group key when present). Each row stores vertex and polygon totals for four stages. The UI should load this new table and display those totals in Step6.

“Origin dataset” means the unit derived from `DownloadStageOutput` in `plugins/shape-plugin/src/services/batch/strategies/DownloadStageStrategy.ts`. Each output corresponds to a raw buffer ID and carries `dataSource`, `countryCode`, and `adminLevel`. Some strategies may also set `featureGroupId`/`featureLabel`; those should be part of the origin key when present.

“Vertex” and “polygon” counts are computed from GeoJSON geometries. In the shape pipeline, this logic already exists in `SessionController.extractGeometryStats`, which counts vertices and polygons in a feature. We will reuse that logic to aggregate totals.

## Plan of Work

First, extend `plugins/shape-plugin/src/services/database/ShapeTileMetadataDB.ts` with a new table, for example `sourceMetadata`, with a new `ShapeSourceMetadataRow` interface. The row should include identifying fields (`originKey`, `dataSource`, `countryCode`, `countryName`, `adminLevel`, optional `featureGroupId`/`featureLabel`) plus `createdAt`, `updatedAt`, and eight numeric counters: raw/extract1/extract2/vectorTile vertex and polygon totals.

Next, add origin key and label logic to the batch session. In `plugins/shape-plugin/src/services/batch/SessionController.ts`, define a helper that converts `DownloadStageOutput` into a stable origin key string and a user-facing label. Use this to:

1) Compute raw-stage totals by decoding each output’s raw buffer.
2) Ensure extract1 and extract2 buffers can be traced back to the same origin key.

To make vector tile aggregation possible, add a small metadata property on features so the origin survives through the tiling pipeline. Update `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` to set a property like `__hdbOriginKey` on every feature when writing extract1 outputs (and keep it when extracting). This property will survive into extract2 outputs and vector tiles via GeoJSON-VT.

After extract1 and extract2 stages complete, compute totals by reading the corresponding extracted buffers and summing geometry stats per origin key. Store the totals by updating the `sourceMetadata` table.

After vector tile generation completes, decode the vector tiles from `TilesDB` and sum geometry stats per origin key by reading the `__hdbOriginKey` property from each tile feature. Then write those totals to the `sourceMetadata` table. Use `@mapbox/vector-tile` and `pbf` for decoding (already available in the shape-plugin dependencies).

Finally, update Step6 UI. In `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts`, load the new `sourceMetadata` rows instead of (or in addition to) `featureMetadata`. Update `plugins/shape-plugin/src/ui/hooks/preview/useVectorTilePreviewTable.ts` to render the new columns for the four stages. Add the corresponding labels to `plugins/shape-plugin/src/ui/locales/ja.json` and `plugins/shape-plugin/src/ui/locales/en.json`. Ensure the selection filters still behave sensibly by using `countryCode`/`countryName` and `adminLevel` from the new rows.

## Concrete Steps

1) Update `plugins/shape-plugin/src/services/database/ShapeTileMetadataDB.ts`:
   - Add `ShapeSourceMetadataRow` interface.
   - Add `sourceMetadata` table in a new version (bump to version 4).
   - Ensure previous tables remain intact.

2) Add origin key handling and stage aggregation in `plugins/shape-plugin/src/services/batch/SessionController.ts`:
   - Add a helper to build `originKey` and `originLabel` from `DownloadStageOutput`.
   - After download postprocess, compute raw totals per output and write to `sourceMetadata`.
   - After extract1 and extract2, compute totals from extracted buffers and update `sourceMetadata`.
   - After vector tile stage, decode tiles and update vector tile totals.

3) Preserve origin info in feature properties in `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`:
   - When constructing extract1 outputs, set `properties.__hdbOriginKey` to the origin key passed via task config.
   - Ensure extract2 uses the property already present; only set if missing.

4) Update UI data loading and table columns:
   - `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts`: load `sourceMetadata` rows for the active node.
   - `plugins/shape-plugin/src/ui/hooks/preview/useVectorTilePreviewTable.ts`: map source rows to columns for raw/extract1/extract2/vector tile vertex/polygon counts.
   - `plugins/shape-plugin/src/ui/locales/ja.json` and `plugins/shape-plugin/src/ui/locales/en.json`: add column labels.

5) Keep this ExecPlan updated with progress, decisions, and surprises as the implementation proceeds.

## Validation and Acceptance

Run the UI and perform a shape build on a small selection. In Step6, open the metadata tab and confirm that each origin dataset shows all four stages’ vertex/polygon totals. The values should be non-zero when the build produced output for that stage. If a stage was skipped, the totals should remain zero or blank.

If tests are added, run them from the repo root:

  pnpm --filter @hierarchidb/shape-plugin test

## Idempotence and Recovery

All changes are additive: a new metadata table, new aggregation logic, and new UI columns. Re-running the build should overwrite or update the same `sourceMetadata` rows for a node, because they are keyed by origin and node ID. If a rollback is required, revert the changes in `ShapeTileMetadataDB`, `SessionController`, `shapeStageWorker`, and the UI table files; existing per-feature metadata remains untouched.

## Artifacts and Notes

Expected metadata table column additions in Step6 (example labels):

  Raw Vertices, Raw Polygons, Extract1 Vertices, Extract1 Polygons, Extract2 Vertices, Extract2 Polygons, Tile Vertices, Tile Polygons

## Interfaces and Dependencies

Use `plugins/shape-plugin/src/services/database/ShapeTileMetadataDB.ts` for storage. Use `getEphemeralShapeDB()` to access raw and extracted buffers. Use `TilesDB` from `@hierarchidb/gis-sdk` to read vector tiles for the final stage. Decode vector tiles with `@mapbox/vector-tile` and `pbf` (already listed in `plugins/shape-plugin/package.json`). Keep the origin key string stable across stages so UI rows remain consistent.

Plan Update Note (2025-12-30 12:46 JST): Marked ExecPlan creation as complete and split the maintenance step into its own ongoing progress item so later updates can track it.
