# Shape TopoJSON extract2/vectortile rebuild with zoom-grouped aggregation

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is maintained in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Rebuild the shape-plugin TopoJSON path so extract2 and vectortile follow a unified, zoom-grouped flow. The goal is to keep tile boundaries stable while scaling simplification based on zoom and to control the scope of TopoJSON aggregation (world, continent, country) by zoom ranges. Users can configure the tile-boundary expansion factor and margin in Step4 (processing settings). After this change, extract2 generates TopoJSON buffers by group, attaches tileId indexes, and vectortile consumes those buffers in a consistent way.

## Progress

- [x] (2026-01-04 15:35 JST) Review current TopoJSON/GeoJSON extract2 paths and the vectortile input builder to locate integration points.
- [x] (2026-01-04 16:10 JST) Define the new zoom grouping rules (z0 world, z1–4 continent, z5–9 country) and map them to zoom range segments.
- [x] (2026-01-04 16:10 JST) Add Step4 settings for tile expansion factor and margin, persist them in BatchConfig, and pass them into worker config.
- [x] (2026-01-04 16:10 JST) Implement the new TopoJSON extract2 pipeline: group by region, build TopoJSON, simplify, write flatgeobuf buffers, and record tileId relations.
- [x] (2026-01-04 16:10 JST) Update vectortile inputs to dedupe featureIds during tile assembly.
- [ ] Update/extend tests and record verification in TASKS.md.

## Surprises & Discoveries

- None observed yet.

## Decision Log

- Decision: Use zoom-grouped aggregation: z0 = world, z1–4 = continent groups, z5–9 = country groups, with tileBBox expansion to pull neighboring regions.
  Rationale: This balances boundary consistency (larger groups at lower zoom) with performance and data volume (smaller groups at higher zoom).
  Date/Author: 2026-01-04 / Codex

## Outcomes & Retrospective

- Pending (to be filled after completion).

## Context and Orientation

- Batch stage orchestration is in `plugins/shape-plugin/src/services/batch/SessionController.ts`.
- extract2 task building uses `plugins/shape-plugin/src/services/batch/session/extract2/resolveExtract2BuildStrategy.ts` and the task builders under `session/extract2/`.
- extract2 worker processing lives in `plugins/shape-plugin/src/services/batch/workers/shapeStageWorker.ts`.
- vectortile inputs use `plugins/shape-plugin/src/services/batch/session/stages/vectortile/buildVectorTileStageInputs.ts` and tileId relations in `shape-ephemeral`.
- UI Step4 is the processing configuration step, with tile settings in `plugins/shape-plugin/src/ui/components/steps/TileConfigSection.tsx`.

## Plan of Work

Add two Step4 controls for tileBBox expansion factor and margin, storing them in `BatchConfig.tileConfig`. Pass those values into `BatchSessionConfig.vectorTiles` (worker config). Replace the current TopoJSON extract2 logic with a zoom-grouped aggregator that builds TopoJSON buffers per group (world/continent/country) based on zoom ranges and tileBBox intersection using the configured expansion settings. For each extract2 task, produce a flatgeobuf buffer, store it in extractedBuffers, and register tileId relations for the tiles that intersect. Update vectortile stage inputs to consume tileId relations and the corresponding buffers without relying on the previous z0 exception.

## Concrete Steps

1. Extend `TileBatchConfig` and related processing config with `tileExpandFactor` and `tileExpandMargin` (number values) and default values in `plugins/shape-plugin/src/common/types/constants.ts`.
2. Update Step4 UI (`plugins/shape-plugin/src/ui/components/steps/TileConfigSection.tsx`) to expose sliders/inputs for expand factor and margin, and persist them to `BatchConfig.tileConfig`.
3. Map these fields into worker config in `plugins/shape-plugin/src/worker/api.ts` so they reach `BatchSessionConfig.vectorTiles`.
4. Implement a new TopoJSON extract2 path under `plugins/shape-plugin/src/services/batch/session/extract2/` that:
   - Builds zoom grouping rules (z0 / z1–4 / z5–9).
   - Derives group bounding boxes, expands them by `tileExpandFactor` and `tileExpandMargin` in WebMercator coordinates.
   - Collects features intersecting those expanded bboxes, builds TopoJSON, simplifies with zoom-scaled tolerance, and encodes to flatgeobuf.
   - Records tileId relations for each buffer using the configured zoom range segment and tile bbox intersection logic.
5. Ensure extract2 tasks and inputs include the zoom range metadata so tolerance scaling and tileId indexing are consistent.
6. Update vectortile stage inputs (`buildVectorTileStageInputs.ts`) if needed to avoid any reliance on the previous z0 exception and to consume the new relations.
7. Update or add tests for TopoJSON task generation and the new configuration fields.

## Validation and Acceptance

- Manual: In Step4, set expand factor and margin, start a build, and confirm extract2 tasks are created for the zoom ranges and TopoJSON grouping rules (world/continent/country). Confirm vectortile tasks start after extract2 and that tileId relations exist.
- Tests: Run `pnpm --filter @hierarchidb/shape-plugin test` and ensure updated tests pass.

## Idempotence and Recovery

- Re-running task generation is safe because task IDs include zoom-range labels and group keys.
- Rollback by reverting the new TopoJSON extract2 path and Step4 settings to restore the previous behavior.

## Artifacts and Notes

- None yet.

## Interfaces and Dependencies

- `BatchConfig.tileConfig` gains `tileExpandFactor` and `tileExpandMargin`.
- `BatchSessionConfig.vectorTiles` carries these values for worker-side processing.
- extract2 inputs carry zoom range metadata and per-task tolerance overrides.

Update Note (2026-01-04): Initial plan drafted for the TopoJSON extract2/vectortile rebuild and Step4 settings.\nUpdate Note (2026-01-04): Progress updated after implementing config wiring, TopoJSON grouping, and tile dedupe changes.
