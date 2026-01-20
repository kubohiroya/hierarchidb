# Rebuild shape Step6 metadata stage stats for fetch/transform/vt

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Shape Step6 currently shows per-origin metadata rows with vertex and polygon counts tied to the old stage naming (raw/extract1/extract2/vector tiles). After this change, the metadata table reflects the current pipeline stages: fetch, transform, and vt. Users will be able to build a shape dataset and immediately see how geometry counts evolve from fetch outputs to transform buffers and finally to vt tiles. The change is visible in Step6: the column headers match fetch/transform/vt, and the numbers update after a build.

## Progress

- [x] (2026-01-14 10:20 JST) Confirmed Step6 metadata flow, storage tables, and the current vt pipeline entry points.
- [x] (2026-01-14 11:05 JST) Updated this ExecPlan with fetch/transform/vt stage definitions and storage strategy.
- [x] (2026-01-14 11:30 JST) Implemented stage-level aggregation for fetch/transform/vt and persisted results to source metadata rows.
- [x] (2026-01-14 11:35 JST) Updated Step6 UI columns and labels to show fetch/transform/vt counts.
- [ ] Validate that a build produces the new metadata rows and they render in Step6.

## Surprises & Discoveries

- Observation: the source metadata table exists in `packages/features/vectortile-store/src/tilesDb.ts`, but there is no current writer path in the shape vt pipeline.
  Evidence: `ShapeMutationService.putSourceMetadata` exists, yet no code calls it during `runShapePipeline`.
- Observation: stage1 and transform buffers store `featureCount` and `vertexCount` only; polygon counts must be computed and added.
  Evidence: `packages/vt-shape-store/src/types.ts` only defines `vertexCount` and `featureCount`.
- Observation: transform outputs are per-band, and each buffer includes boundary features; transform totals must be defined carefully to avoid ambiguity.
  Evidence: `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` adds boundary features per input.

## Decision Log

- Decision: Use the origin key format `${dataSource}:${sourceKey}` where `sourceKey` is the existing `ISO2:adminLevel` key from fetch tasks.
  Rationale: it is stable across stages, already available in fetch/transform buffers, and avoids collisions across data sources.
  Date/Author: 2026-01-14 / Codex
- Decision: Define transform totals as the sum of per-band transform buffers for a given origin key.
  Rationale: per-band outputs are the actual persisted transform artifacts used for vt generation; summing them matches “total transform output size” even if features are duplicated across bands.
  Date/Author: 2026-01-14 / Codex
- Decision: Compute vt totals by decoding vt tile pbf data and aggregating geometry stats by `__hdbOriginKey` embedded in feature properties.
  Rationale: vt output is the user-visible result, and the origin key must survive tiling to attribute counts accurately.
  Date/Author: 2026-01-14 / Codex

## Outcomes & Retrospective

Pending.

## Context and Orientation

Step6 metadata is rendered in `plugins/shape-plugin/src/ui/hooks/useShapePreviewStep.ts` and `plugins/shape-plugin/src/ui/hooks/preview/useVectorTilePreviewTable.ts`. The UI calls `ShapeQueryAPI.listSourceMetadata` and displays columns based on `ShapeSourceMetadataRow` from `packages/plugin-service-api/src/types/shapeBuildTypes.ts`.

The vt pipeline is executed by `plugins/shape-plugin/src/worker/api.ts` through `runShapePipeline` in `plugins/shape-plugin/src/services/vt/shapePipeline.ts`. Fetch outputs are stored in `@hierarchidb/vt-shape-store` (`stage1Buffers`), transform outputs are stored in `transformBandBuffers`, and final vt tiles are stored in `@hierarchidb/vt-store` (`vtTiles`). The metadata tables are defined by `VectorTileDbBase` in `packages/features/vectortile-store/src/tilesDb.ts` and exposed through `@hierarchidb/shape-store`.

“Origin” means one fetched dataset unit keyed by the fetch task’s `sourceKey`. For shape, `sourceKey` is `ISO2:adminLevel`. The origin key used in metadata will be `${dataSource}:${sourceKey}` and will be embedded into feature properties as `__hdbOriginKey` so that vt tiles can be attributed back to the origin.

## Plan of Work

First, update the metadata type definitions. In `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, replace the old raw/extract1/extract2/vectorTile fields with fetch/transform/vt fields. Update any dependent imports, and keep the table indexes in `packages/features/vectortile-store/src/tilesDb.ts` unchanged unless new indexed fields are required (they should not be).

Second, add polygon counts to stage1 and transform buffers. Update `packages/vt-shape-store/src/types.ts` and the `putStage1Buffer` and `putTransformBuffer` helpers to include `polygonCount`. In `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`, compute both vertex and polygon counts from the fetched FeatureCollection and store them in the stage1 buffer. In `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, compute polygon counts from the transform output features and store them in the transform buffers.

Third, preserve origin keys through the pipeline. In `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`, inject `__hdbOriginKey` into each feature’s properties before encoding stage1 buffers. This value must be the same origin key that will be used in the metadata rows.

Fourth, implement metadata aggregation and persistence in the shape vt pipeline. Add a new helper module under `plugins/shape-plugin/src/services/vt/` (for example `shapeStageMetadata.ts`) that:

- Builds a map from `sourceKey` to `{ originKey, originLabel, countryName }` using `metadataLoader` and the fetch payloads.
- Aggregates fetch counts from `stage1Buffers` (vertex/polygon totals per origin).
- Aggregates transform counts by summing over `transformBandBuffers` per origin.
- Aggregates vt counts by decoding `VtDb.vtTiles` and summing geometry stats per `__hdbOriginKey` in each tile feature’s properties.
- Writes `ShapeSourceMetadataRow` entries through `ShapeMutationAPI.putSourceMetadata` (or `shapeDB.sourceMetadata.bulkPut`) with updated timestamps.

Call this aggregation helper in `runShapePipeline` after each stage completes, or at least once after the vt stage completes. If the data is written only once, ensure that rows include all three stages’ totals at that time.

Finally, update the Step6 UI to read and display the new fields. In `plugins/shape-plugin/src/ui/hooks/preview/useVectorTilePreviewTable.ts`, replace `raw/extract1/extract2/vectorTile` columns with fetch/transform/vt columns, update field mapping, and adjust column labels in `plugins/shape-plugin/src/ui/locales/en.json` and `plugins/shape-plugin/src/ui/locales/ja.json`.

## Concrete Steps

All commands are run from the repository root.

1) Update type definitions and stage buffer schema changes.
   - Edit `packages/plugin-service-api/src/types/shapeBuildTypes.ts`.
   - Edit `packages/vt-shape-store/src/types.ts`, `packages/vt-shape-store/src/mutation/stage1Mutation.ts`, and `packages/vt-shape-store/src/mutation/transformMutation.ts`.

2) Add polygon counts and origin key propagation.
   - Edit `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`.
   - Edit `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`.

3) Implement aggregation and persistence.
   - Add `plugins/shape-plugin/src/services/vt/shapeStageMetadata.ts` (or similar) and call it from `plugins/shape-plugin/src/services/vt/shapePipeline.ts`.

4) Update UI columns and labels.
   - Edit `plugins/shape-plugin/src/ui/hooks/preview/useVectorTilePreviewTable.ts`.
   - Edit `plugins/shape-plugin/src/ui/locales/en.json` and `plugins/shape-plugin/src/ui/locales/ja.json`.

## Validation and Acceptance

Run a small shape build and open Step6. You should see fetch/transform/vt columns populated per origin row. If a stage has not run, its counts should be zero or empty. The counts should change after a rebuild.

If running type checks, use:

  pnpm --filter @hierarchidb/shape-plugin typecheck

## Idempotence and Recovery

The aggregation is safe to re-run. The origin key is stable, and rows are updated in place using the same `originKey`. If a rollback is required, revert the changes in the aggregation helper, stage buffers, and UI columns, and the system will fall back to the old metadata schema (though any new fields will be ignored).

## Artifacts and Notes

Not applicable yet. Record any notable diffs or validation output here once implemented.

## Interfaces and Dependencies

The key interfaces are `ShapeSourceMetadataRow` in `packages/plugin-service-api/src/types/shapeBuildTypes.ts`, stage buffer types in `packages/vt-shape-store/src/types.ts`, and vector tile decode helpers from `@mapbox/vector-tile` and `pbf`. The aggregation helper should export a function like `updateShapeStageMetadata(params: { nodeId: NodeId; dataSource: DataSourceName; shapeStore: VtShapeDb; vtStore: VtDb; })` and be called from `runShapePipeline`.

Plan Update Note (2026-01-14 10:20 JST): Rewrote the ExecPlan to align with the fetch/transform/vt pipeline and the PLANS.md formatting requirements, and to describe the new aggregation, storage, and UI updates.

Plan Update Note (2026-01-14 11:35 JST): Marked implementation steps as complete after updating aggregation logic, metadata storage, and UI columns; left validation pending until a build is run.
