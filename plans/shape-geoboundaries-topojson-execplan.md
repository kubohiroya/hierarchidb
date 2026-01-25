# Add geoBoundaries:TopoJSON Fetch/Transform Support

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repo at `PLANS.md`. This document must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, shape builds can select a new `geoBoundaries:TopoJSON` data source in Step2, run fetch and transform with TopoJSON-specific handling for Canada and Greenland, and still produce vector tiles the same way as before. The user-visible proof is that Step2 shows the new data source option, Step5 fetch stores TopoJSON+gzip for that option, transform converts it into flatgeobuf, and vt output remains unchanged.

## Progress

- [x] (2026-01-26 15:20 JST) Added `geoboundaries-topojson` data source config and selection wiring (type updates + UI configs).
- [x] (2026-01-26 15:40 JST) Implemented fetch-stage TopoJSON download, Canada/Greenland merge, zoom-based omission, and topojson+gzip cache storage.
- [x] (2026-01-26 15:55 JST) Extended transform-stage decoding for TopoJSON cache with zoom tolerance simplification and retry on vertex overflow.
- [x] (2026-01-26 16:05 JST) Ran pnpm install/build/typecheck updates and logged outcomes in TASKS.md.

## Surprises & Discoveries

- Observation: vt-orchestrator typecheck lacked topojson typings.
  Evidence: `tsc --noEmit` reported missing declarations for `topojson-client` and `topojson-simplify`.
  Resolution: Added `@types/topojson-client` and a local `topojson-simplify.d.ts` under `packages/vt-orchestrator/src/types`.

## Decision Log

- Decision: Use `geoboundaries-topojson` as the internal dataSource name while displaying `geoBoundaries:TopoJSON` in UI.
  Rationale: Colon is kept in display for clarity but avoided in internal identifiers for safer keying and routing.
  Date/Author: 2026-01-26 (Codex).
 - Decision: Implement TopoJSON fetch handling in `shapeFetchStage.ts` using geoBoundaries metadata URLs without introducing a new DataSourceStrategy id.
   Rationale: Keeps the existing strategy factory stable while enabling data-source specific fetch behavior.
   Date/Author: 2026-01-26 (Codex).

## Outcomes & Retrospective

- Not completed yet.

## Context and Orientation

The shape build pipeline uses three stages (fetch, transform, vt). Fetch stores per-country buffers in the ephemeral shape DB (`packages/features/shape-store/src/EphemeralShapeDB.ts`), transform reads these buffers and produces flatgeobuf per zoom band in `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, and vt generates tiles. Step2 data source options are in `plugins/shape-plugin/src/common/mock/data.ts` and used by `plugins/shape-plugin/src/ui/components/step2/useShapeDataSourceStep.ts`. Data source names are defined in `plugins/shape-plugin/src/common/types/data-source.ts` and referenced by metadata loader and fetch stage utilities.

TopoJSON support requires converting TopoJSON to GeoJSON (for counts and metadata) and vice versa (for merging and simplification). TopoJSON libraries (`topojson-client`, `topojson-server`, `topojson-simplify`) live in the shape plugin today, so the transform stage package (`@hierarchidb/vt-orchestrator`) must declare these dependencies to safely import them.

“Merge” here means combining multiple polygons for the same country boundary into one MultiPolygon, specifically for Canada and Greenland at ADM0 where the source data is split due to vertex counts. “Simplify by zoom tolerance” means using the existing zoom-based tolerance logic (area-based threshold) and applying it to TopoJSON arcs before converting to flatgeobuf.

## Plan of Work

First, add a new internal data source name and UI option. Update `plugins/shape-plugin/src/common/types/data-source.ts` to include `geoboundaries-topojson`, and add a matching config entry in `plugins/shape-plugin/src/common/mock/data.ts` and `plugins/shape-plugin/src/common/types/constants.ts` with display name `geoBoundaries:TopoJSON`. Update `plugins/shape-plugin/src/services/metadata/MetadataLoader.ts` so the new data source uses the same metadata loader as `geoboundaries`, and update `plugins/shape-plugin/src/services/utils/utils.ts` so URL generation supports the new data source.

Next, update fetch-stage strategy resolution in `plugins/shape-plugin/src/services/batch/strategies/resolveFetchStageStrategy.ts` to resolve the new data source. Parameterize `GeoBoundariesFetchStageStrategy` so it can emit either `geoboundaries` or `geoboundaries-topojson` payloads.

Then, implement fetch-stage TopoJSON handling in `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`. Add helper functions for gzip compression/decompression, TopoJSON parsing, TopoJSON->GeoJSON conversion, and merging for Canada/Greenland. For `geoboundaries-topojson`, download TopoJSON (using the geoBoundaries metadata to obtain `tjDownloadURL`), merge when needed, simplify by zoom on TopoJSON, gzip it, and store it in fetch cache with a format/compression marker. For `geoboundaries`, after GeoJSON is downloaded, perform a GeoJSON->TopoJSON merge->GeoJSON roundtrip for Canada/Greenland (ADM0 only), then continue with existing zoom-based filtering and flatgeobuf caching.

After that, extend the fetch cache record type in `packages/features/shape-store/src/EphemeralShapeDB.ts` with optional `format` and `compression` fields. Update fetch cache writes in `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts` to set `format: 'flatgeobuf'` for existing behavior and `format: 'topojson'` with `compression: 'gzip'` for the new data source. Update fetch-cache decoding in both shape fetch stage and transform stage to use these markers.

Finally, extend transform-stage decoding in `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`. If fetch cache format is TopoJSON, gunzip, parse TopoJSON, simplify by zoom tolerance using area-based threshold (two tolerance paths) and retry with an adjusted tolerance if vertex count is still above limits, then convert to flatgeobuf and proceed with the existing transform pipeline. Add required topojson dependencies to `packages/vt-orchestrator/package.json` and run `pnpm install`, `pnpm build`, and `pnpm typecheck` as required by the workflow.

## Concrete Steps

Run commands from repository root (`/Users/hiroya/WebstormProjects/hierarchidb`).

1) Add `geoboundaries-topojson` to data source types and config.
   - Edit `plugins/shape-plugin/src/common/types/data-source.ts` to include the new name.
   - Update `plugins/shape-plugin/src/common/mock/data.ts` and `plugins/shape-plugin/src/common/types/constants.ts` with a new config entry.

2) Update metadata loader and fetch-stage strategy resolution.
   - Edit `plugins/shape-plugin/src/services/metadata/MetadataLoader.ts` to map the new data source to `fetchGeoBoundariesMetadata`.
   - Update `plugins/shape-plugin/src/services/batch/strategies/GeoBoundariesFetchStageStrategy.ts` to be parameterized by dataSource.
   - Update `plugins/shape-plugin/src/services/batch/strategies/resolveFetchStageStrategy.ts` to add the new data source.

3) Implement TopoJSON fetch-stage behavior and cache format markers.
   - Update `packages/features/shape-store/src/EphemeralShapeDB.ts` with optional `format`/`compression` fields.
   - Edit `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts` to handle TopoJSON downloads, merge, simplify, gzip cache, and metadata generation.

4) Extend transform-stage decoding and add dependencies.
   - Update `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` with TopoJSON decode/simplify path.
   - Add `topojson-client`, `topojson-server`, and `topojson-simplify` to `packages/vt-orchestrator/package.json`.

5) Validation.
   - Run `pnpm install` (if dependencies changed).
   - Run `pnpm --filter @hierarchidb/shape-plugin typecheck`.
   - Run `pnpm --filter @hierarchidb/vt-orchestrator typecheck`.
   - Run `pnpm --filter @hierarchidb/vt-orchestrator build`.

## Validation and Acceptance

- In the UI, Step2 shows `geoBoundaries:TopoJSON` alongside `geoBoundaries` and it can be selected.
- When building with `geoBoundaries:TopoJSON`, fetch cache entries are stored as TopoJSON+gzip and contain Canada/Greenland merged polygons at ADM0.
- Transform stage accepts TopoJSON fetch cache and produces flatgeobuf transform cache entries without errors.
- The vt stage output and Step6 preview remain unchanged for non-TopoJSON data sources.

## Idempotence and Recovery

These steps are safe to repeat. If a change fails, revert the new data source or TopoJSON-specific paths and re-run typecheck/build. If fetch cache formats are mismatched, clear fetch cache for the node in Step2/Step4 and rerun the build.

## Artifacts and Notes

- Expected new data source id: `geoboundaries-topojson`.
- Expected display label: `geoBoundaries:TopoJSON`.

## Interfaces and Dependencies

- Data source names are declared in `plugins/shape-plugin/src/common/types/data-source.ts` and must include `geoboundaries-topojson`.
- Fetch cache records in `packages/features/shape-store/src/EphemeralShapeDB.ts` must include optional `format?: 'flatgeobuf' | 'topojson'` and `compression?: 'gzip' | 'none'`.
- Transform stage must accept a `FetchCacheRecord` where `format === 'topojson'` and handle gzip + TopoJSON simplification.
- `@hierarchidb/vt-orchestrator` must declare `topojson-client`, `topojson-server`, and `topojson-simplify` in `package.json` dependencies.


Updated 2026-01-26: initial ExecPlan drafted to capture data source additions, fetch/transform changes, and validation steps.
Updated 2026-01-26: progress, surprises, and decisions updated after implementation and validation steps.
