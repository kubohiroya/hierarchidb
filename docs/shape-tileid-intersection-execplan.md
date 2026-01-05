# Extract2 tileId relations with geometry intersection (lightweight)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` at the repository root. Keep this document in sync with those requirements.

## Purpose / Big Picture

The goal is to reduce the number of “empty” vector tiles generated in the vectortile stage by making extract2’s tileId relations more precise. After this change, the system should only schedule vectortile tasks for tiles that actually intersect the geometry, not just tiles whose bounding box overlaps the geometry’s bounding box. This should reduce unnecessary tile generation work without changing the overall stage structure. You will be able to observe fewer “tilesWithoutFeatures” during vectortile generation and shorter `tiles built` timings in logs.

## Progress

- [ ] (2026-01-11 03:55 JST) Confirm current tileId relation flow and add profiling baseline for extract2 tileId construction.
- [ ] (2026-01-11 03:55 JST) Implement lightweight geometry-vs-tile intersection checks and integrate into extract2 tileId relations.
- [ ] (2026-01-11 03:55 JST) Validate with a known dataset and record before/after tileCandidates vs tilesWithFeatures ratios.
- [ ] (2026-01-11 03:55 JST) Document performance results and update decision log.

## Surprises & Discoveries

No surprises recorded yet.

## Decision Log

- Decision: Use lightweight, conservative geometry-vs-tile intersection checks that avoid false negatives.
  Rationale: We must not drop tiles that should contain geometry. A conservative check reduces empty tiles while preserving correctness.
  Date/Author: 2026-01-11, assistant

## Outcomes & Retrospective

Not completed yet.

## Context and Orientation

This project’s shape pipeline uses extract2 to produce buffers and a tileId relation table used to schedule vectortile tasks. The tileId relations are stored in the ephemeral database and later queried to build vectortile inputs.

Key files:

- `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` creates tileId relations in `buildTileIdRelations()` and stores them via `ephemeral.putTileIdRelations()`.
- `plugins/shape-plugin/src/services/batch/session/stages/vectortile/buildVectorTileStageInputs.ts` consumes tileId relations to schedule vectortile tasks.
- `packages/features/gis-sdk/src/vectorTiles.ts` generates tiles and logs `tilesWithoutFeatures`, which reflects how many scheduled tiles were empty.

Terminology used in this plan:

- “tileId relation”: a mapping from a vector tile identifier (z/x/y packed into a string) to the extract2 output buffer that may contain geometry for that tile.
- “lightweight intersection”: a conservative geometry-vs-tile intersection check that is more precise than bbox overlap but cheaper than full polygon clipping.

## Plan of Work

First, confirm the current tileId relation construction is bbox-based and only uses per-feature bounding boxes. Then implement a lightweight intersection helper that checks whether a geometry intersects a tile’s bounding box without expensive polygon clipping. Use this helper inside `buildTileIdRelations()` to filter out tiles that do not intersect the geometry.

The intersection helper must avoid false negatives. It should return true if any of these conditions are met:

1) Any vertex is inside the tile bbox.
2) Any edge segment intersects the tile bbox.
3) The tile bbox center is inside the polygon (for polygons and multipolygons).

This check is conservative and relatively lightweight compared to full polygon clipping. It can still be more expensive than pure bbox overlap, but should meaningfully reduce empty tile candidates.

The stage structure must remain unchanged. Only the tileId relation construction should be modified.

## Concrete Steps

1) Read the existing tileId relation implementation in `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` to confirm bbox-based logic and identify the insertion point for the new intersection helper.

2) Implement geometry-vs-tile intersection helpers in a new utility module:

   - Create `plugins/shape-plugin/src/services/utils/geometry-tile-intersects.ts`.
   - Provide a function `geometryIntersectsTile(geometry, tileBbox)` that supports Point, MultiPoint, LineString, MultiLineString, Polygon, and MultiPolygon.
   - Include:
     - `pointInBbox()`
     - `segmentIntersectsBbox()` using a cheap line-rectangle intersection check
     - `pointInPolygon()` using ray casting for polygon and multipolygon
   - Keep this code free of non-ASCII characters and add only minimal English comments where needed.

3) Update `buildTileIdRelations()` in `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`:

   - After computing candidate tiles from `buildTileCoordinates(bbox, zoomLevels)`, filter them with `geometryIntersectsTile(feature.geometry, tileBbox)`.
   - Construct the tile bbox from z/x/y (tile bounds).
   - Keep the bbox short-circuit (if no geometry or no zoom levels) unchanged.

4) Add debug logging (temporary) to summarize:

   - Candidate tile count before filtering
   - Tile count after filtering
   - Feature count and zoom levels used

5) Run the same dataset and compare:

   - `tilesWithFeatures` vs `tilesWithoutFeatures` in `packages/features/gis-sdk/src/vectorTiles.ts` logs
   - Overall vectortile time (`tiles built`, `generateFromJson`)

6) Record observations and decisions in `Surprises & Discoveries` and `Decision Log`.

## Validation and Acceptance

Run the app in dev mode and execute a known shape build with the same dataset as before. Validate:

- The number of empty tiles (`tilesWithoutFeatures`) is lower than before for the same input.
- Vectortile generation time is reduced or unchanged, but not significantly worse.
- No missing tiles or regressions are observed in the preview (manual visual check).

If the tile count drops but visual coverage is incomplete, the intersection check is too aggressive and must be revised.

## Idempotence and Recovery

This change is safe to re-run. If any regression appears, revert the changes in `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts` and remove the helper module. The system will return to bbox-only tile relations.

## Artifacts and Notes

Example expected log (approximate, for comparison):

  [ShapeTileRelations] candidates=1395 filtered=412 features=326 zooms=0..5
  [VectorTiles] Feature reduction summary tilesWithFeatures=380 tilesWithoutFeatures=32

## Interfaces and Dependencies

No new external dependencies are required. All intersection math should be implemented locally in `plugins/shape-plugin/src/services/utils/geometry-tile-intersects.ts` to keep the change lightweight and controllable. Use only standard Math and geometry utilities already present in the repo.
