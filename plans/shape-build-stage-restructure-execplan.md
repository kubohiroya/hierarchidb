# Restructure shape build stages (fetch filters + band thinning, transform simplify + inverted index, vt tile generation)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md lives at `PLANS.md` in the repository root. This ExecPlan must be maintained in accordance with that document.

## Purpose / Big Picture

Users need a simpler, faster shape build pipeline that produces stable intermediate artifacts by zoom band and avoids the current transform complexity. After this change, a user can run a shape build where fetch tasks perform filtering and zoom-band thinning, transform tasks only simplify polygons and build a persistent inverted index, and vt tasks generate vector tiles (including child and grandchild tiles) using the inverted index. The result is a clearer separation of concerns with reproducible FlatGeobuf outputs per feature and zoom band, and faster VT generation that reuses the band index rather than re-scanning full collections.

## Progress

- [x] 2026-01-19 14:30 JST: Created the initial ExecPlan outlining the new fetch/transform/vt pipeline and storage changes.
- [ ] Milestone 1: Define configuration + storage schema + feature flag for the new pipeline.
- [ ] Milestone 2: Implement fetch stage band-thinning and persist per-feature/per-band FlatGeobuf output.
- [ ] Milestone 3: Implement transform stage simplification and persistent inverted index by tile ID.
- [ ] Milestone 4: Implement vt stage tile generation using the inverted index and create child/grandchild tiles.
- [ ] Milestone 5: Wire the pipeline selection flag, remove deprecated code paths, and validate behavior end-to-end.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Store new per-feature/per-band FlatGeobuf outputs in `@hierarchidb/vt-shape-store` as persistent caches, and store the inverted tile index in `@hierarchidb/shape-store`.
  Rationale: `vt-shape-store` already owns persistent fetch/transform caches; `shape-store` already hosts shape-centric indexes and is a natural home for tile-level inverted indexes.
  Date/Author: 2026-01-19, Codex
- Decision: Use the band “high zoom” boundary (band.zMax) as the index zoom for tile IDs in the inverted index.
  Rationale: The requirement is explicit about using the higher zoom side; indexing at the high zoom gives a tighter tile set and reduces false positives when gathering overlapping features.
  Date/Author: 2026-01-19, Codex
- Decision: Use a default-off pipeline flag to gate the new stages and allow safe rollback.
  Rationale: Project policy requires default-off staged rollout and explicit rollback steps.
  Date/Author: 2026-01-19, Codex

## Outcomes & Retrospective

- Not started.

## Context and Orientation

The current shape build pipeline is orchestrated by `plugins/shape-plugin/src/services/vt/shapePipeline.ts`. It runs fetch tasks via `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`, transform tasks via `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, and vt tasks via `packages/vt-orchestrator/src/vt/vtStage.ts`. Fetch outputs are stored in `@hierarchidb/vt-shape-store` (`fetchCache`), transform outputs and tile relations are stored in `@hierarchidb/shape-store`’s `EphemeralShapeDB` (`transformCache` and `tileIdToBufferRelations`), and vector tiles are stored in `@hierarchidb/vt-store` (`vtTiles`).

In this plan, a “zoom band” means a continuous range of zoom levels described by `buildZoomBandRanges` and `transformConfig.zoomBandBoundaries` (see `plugins/shape-plugin/src/services/vt/shapePipeline.ts`). The “high zoom side” of a band refers to the band’s maximum zoom (zMax). “Fast small polygon thinning” means discarding polygons whose bounding box size, vertex count, and area are below configured thresholds.

The new pipeline keeps the same three stages (fetch, transform, vt) but reassigns responsibilities and changes the intermediate storage:

- Fetch stage performs filtering and band-specific thinning, producing a FlatGeobuf for each feature per band.
- Transform stage simplifies those per-band features and builds a persistent inverted index from tile ID to feature IDs.
- VT stage scans the inverted index, gathers overlapping features per tile, and emits PBF tiles for the tile plus its child (1/4) and grandchild (1/8) tiles.

## Plan of Work

Start by defining the configuration and storage changes. Add new config fields for band-thinning thresholds (bbox size, vertex count, area) and a pipeline selector flag. The thresholds should live under `fetchConfig` so the fetch stage can apply them. The pipeline flag should live in `config/feature-flags.ts` (default off) and the `ShapeBuildConfig` should allow choosing the new pipeline when enabled. Add new Dexie tables to persist per-feature/per-band FlatGeobuf outputs and the inverted tile index. Define the record types in `packages/vt-shape-store/src/types.ts` and `packages/features/shape-store/src/ShapeDB.ts` (or a new file under `packages/features/shape-store/src/` if it is clearer).

Then update the fetch stage to perform the full filtering and thinning workflow. After `strategy.processData`, compute a feature list and iterate zoom bands from high to low. For each band, apply “fast small polygon thinning”: keep polygons only if all three conditions meet configurable thresholds (bbox size >= threshold, vertex count >= threshold, area >= threshold). The thinning must be applied progressively from high to low bands so that the lower zoom band starts from the already-thinned set of polygons. For each remaining polygon, write a FlatGeobuf per feature and band and persist it. Use a deterministic feature ID (the same ID logic used in the pipeline today, such as `buildFeatureId` in `shapePipeline.ts`) so downstream stages can refer to it. Persist per-band outputs in `vt-shape-store` using a new table such as `fetchBandFeatures`, keyed by `[nodeId+bandIndex+featureId]` and carrying bbox/area/vertex counts for indexing.

Next, implement a new transform handler in `packages/vt-orchestrator/src/transform/` that reads the per-feature/per-band FlatGeobuf records, simplifies each feature’s polygons, and persists the simplified FlatGeobuf to a new persistent transform table. The simplification should be a single-pass polygon simplify operation without the current quantize-centered preprocessing. Capture the simplified feature’s bbox and the tile ID for the band’s high zoom (band.zMax). Persist an inverted index that maps `[nodeId+bandIndex+tileId]` to the feature ID and the transform output buffer ID. This index must be durable and queryable by tile ID. Ensure task progress reflects feature counts rather than polygon preprocessing phases.

Then rework the VT stage to use the inverted index. For each zoom band, list tile IDs from the inverted index, and for each tile ID load the referenced transform outputs (FlatGeobuf), collect overlapping features, and build a GeoJSON FeatureCollection. Run `geojson-vt` on the collection and emit vector tiles for the tile and its child (+1 zoom, 1/4) and grandchild (+2 zoom, 1/8). Persist generated PBFs in `@hierarchidb/vt-store` as today. Make sure tile generation is deterministic (stable ordering of features and tile IDs).

Finally, wire the new pipeline into `shapePipeline.ts` behind a default-off flag. When the flag is off, keep the existing behavior (legacy pipeline). When the flag is on, run the new stage handlers and use the new storage tables. Update any cleanup logic (`cleanupConfig`) to delete the new persistent tables when requested. Validate that Step5 still shows the three stages and that Step6 renders tiles generated by the new pipeline. Record and document rollback steps: turn off the flag, delete new tables if needed, and revert code.

## Milestones

Milestone 1 adds the configuration and storage foundations. Add new config fields for band-thinning thresholds under `fetchConfig` and add a pipeline selector flag in `config/feature-flags.ts` with a default of false. Extend `ShapeBuildConfig` and related types so the new values are required when the new pipeline is enabled. Add new Dexie tables for per-band fetch outputs and per-band transform outputs in `@hierarchidb/vt-shape-store`, and add a new inverted index table in `@hierarchidb/shape-store`. Finish by updating schema versions and adding helper query/mutation functions for these tables. Acceptance: `pnpm lint && pnpm format && pnpm typecheck` succeeds, and the new tables are accessible in the worker runtime without runtime errors.

Milestone 2 implements the new fetch stage behavior. Update `shapeFetchStage.ts` so each fetch task applies data-source filtering, then performs band-thinning from high zoom to low zoom. Emit a FlatGeobuf per feature per band, persist each record in the new fetch-band table, and record feature stats (bbox, area, vertex count) for downstream use. Ensure thinning criteria are configurable and documented. Acceptance: a fetch task produces per-band outputs for at least one sample dataset, and the persisted record counts match the expected band count.

Milestone 3 implements the new transform stage. Add a transform handler (or replace the current band handler behind the new pipeline flag) to load per-band feature FlatGeobuf records, simplify polygons, and persist per-band simplified outputs. Build the inverted index keyed by `nodeId`, `bandIndex`, and the tile ID derived from each feature’s bbox at the band’s high zoom. Acceptance: transform tasks complete without quantize preprocessing, simplified outputs are persisted, and the inverted index contains expected entries for a known sample tile.

Milestone 4 implements the vt stage changes. Replace or fork `vtStage.ts` so it iterates tile IDs from the inverted index, gathers the referenced features, runs `geojson-vt`, and persists tiles for the parent, child (+1), and grandchild (+2) tiles via `vt-pbf`. Ensure the tile fan-out is deterministic and only stores tiles that have features. Acceptance: for a sample build, tile counts increase by the expected 1 + 4 + 16 pattern per indexed tile when features exist, and tiles render correctly in Step6.

Milestone 5 wires everything together and validates. Update `shapePipeline.ts` to select between legacy and new pipeline paths based on the default-off flag. Update cleanup logic and UI messages to mention the new pipeline. Remove dead code only after validation is complete. Acceptance: with the flag off, legacy pipeline runs unchanged; with the flag on, the new pipeline runs end-to-end, and `pnpm lint && pnpm format && pnpm typecheck && pnpm test` all exit 0.

## Concrete Steps

All commands run from `/Users/hiroya/WebstormProjects/hierarchidb`.

Identify pipeline and storage touch points:

  rg -n "shapePipeline|shapeFetchStage|createTransformByBandHandler|vtStage" plugins/shape-plugin packages
  rg -n "vt-shape-store|EphemeralShapeDB|tileIdToBufferRelations" packages

After schema updates and stage changes, run the standard checks:

  pnpm lint
  pnpm format
  pnpm typecheck
  pnpm test

If a specific package needs rebuilding for types, run:

  pnpm --filter @hierarchidb/vt-shape-store build
  pnpm --filter @hierarchidb/vt-orchestrator build
  pnpm --filter @hierarchidb/shape-plugin build

## Validation and Acceptance

Validation must prove the new pipeline works, not just that it compiles. With the pipeline flag off, the build flow should behave exactly as before. With the flag on, the fetch stage should persist per-feature/per-band FlatGeobufs, the transform stage should persist simplified outputs and an inverted index, and the vt stage should generate tiles for parent/child/grandchild. Verify by running a sample build in the UI: observe the fetch/transform/vt stage logs, confirm that Stage5 progresses through all stages, and confirm Step6 renders tiles. Run `pnpm lint && pnpm format && pnpm typecheck && pnpm test` and require exit 0 for acceptance.

## Idempotence and Recovery

The new pipeline must be safe to re-run. Re-running with the same inputs should overwrite or upsert per-band feature buffers and index rows without duplication. If a run fails, the retry should reuse existing per-band outputs and only recompute missing items. Rollback is achieved by turning the pipeline flag off and reverting code changes. If persistent tables need cleanup, delete the new table contents for the affected `nodeId` using Dexie queries in a controlled maintenance script.

## Artifacts and Notes

Add brief notes here during implementation, such as sample tile counts or performance observations. Keep entries short and tied to evidence.

## Interfaces and Dependencies

Key interfaces to update or add:

- `packages/features/gis-sdk/src/config.ts`: add fetch-stage thinning config and pipeline selector metadata.
- `config/feature-flags.ts`: add a default-off flag to enable the new pipeline.
- `packages/vt-shape-store/src/db/schema.ts` and `packages/vt-shape-store/src/types.ts`: define new per-feature/per-band FlatGeobuf cache records.
- `packages/features/shape-store/src/ShapeDB.ts`: add an inverted index table and record types.
- `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`: implement band thinning and persistence.
- `packages/vt-orchestrator/src/transform/`: add a simplified transform handler for per-band features and inverted index writes.
- `packages/vt-orchestrator/src/vt/vtStage.ts`: update tile generation to use the inverted index and emit parent/child/grandchild tiles.
- `plugins/shape-plugin/src/services/vt/shapePipeline.ts`: select legacy vs new pipeline based on the feature flag and wire the new handlers.

Dependencies to reuse:

- `encodeFlatGeobufFromFeatureCollection` from `@hierarchidb/gis-sdk` for serialization.
- `geojson-vt` and `@maplibre/vt-pbf` for tile building.
- `turf.bbox` and `turf.area` for bbox and area metrics in thinning and indexing.

## Change Log

2026-01-19: Initial ExecPlan drafted to capture the staged redesign requirements and pipeline responsibilities.
