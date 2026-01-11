# Shape download/postprocess strategy split

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` from the repository root.

## Purpose / Big Picture

Users will be able to run shape-plugin batch builds where each data source controls how download tasks are created, how downloaded data is post-processed, and how the next-stage tasks are generated. The common batch pipeline will only call the selected strategy and will not assume a 1:1 relationship between download tasks and extract tasks. This enables data sources like GADM/GeoBoundaries to keep their 1:1 mapping, while OSM/NaturalEarth can download broader datasets and split them into country/admin-level outputs after download.

## Progress

- [x] 2025-12-22 10:25 JST: Create ExecPlan for strategy-driven download/postprocess flow.
- [x] 2025-12-22 11:05 JST: Implement strategy interface and fixed map; refactor SessionController to delegate download task creation and postprocessing.
- [x] 2025-12-22 11:05 JST: Implement data-source strategies (GADM, GeoBoundaries, NaturalEarth, OSM) with pass-through or split outputs.
- [x] 2025-12-22 11:36 JST: Add/adjust tests for strategy behavior and country/admin-level extraction, and run targeted vitest command.
- [x] 2025-12-22 11:36 JST: Record test command outcomes in TASKS.md logs.

## Surprises & Discoveries

- Observation: The current download stage builds tasks from `urlMetadata` and assumes one output buffer per download task. This implicitly forces a 1:1 mapping, which is incompatible with OSM/NaturalEarth requirements.
  Evidence: `plugins/shape-plugin/src/services/batch/SessionController.ts` (download stage task build + extract1 stage uses `urlMetadata` indices), `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerDownloadAdapter.ts` (writes one buffer per download task).
- Observation: Running `pnpm --filter @hierarchidb/shape-plugin test -- <file>` still executed `shape-batch-progress.headless.test.ts` which hit the GeoBoundaries API and failed without network access.
  Evidence: vitest run output shows `fetch failed` for `https://www.geoboundaries.org/api/current/gbOpen/JPN/ADM0/`.
- Observation: FlatGeobuf serialization rejects features with `geometry: null`.
  Evidence: `encodeFlatGeoJson` failed with `Cannot read properties of null (reading 'type')` until tests used Point geometries.

## Decision Log

- Decision: Introduce a data-source-specific strategy for download task creation, postprocessing, and next-stage task generation, and have the shared batch pipeline invoke it without knowing the details.
  Rationale: Different data sources have different download granularity and postprocessing requirements, and the pipeline should not assume 1:1 task mapping.
  Date/Author: 2025-12-22 / Codex
- Decision: Resolve strategies with a fixed in-plugin map keyed by dataSource without normalization.
  Rationale: The plugin does not require dynamic registration for this scope, and direct keys avoid unnecessary normalization rules.
  Date/Author: 2025-12-22 / Codex

## Outcomes & Retrospective

- Pending. This section will be updated after implementation milestones.

## Context and Orientation

The shape-plugin batch pipeline lives under `plugins/shape-plugin/src/services/batch/`. The current download stage is implemented in `SessionController.processDownloadStage`, which builds `DownloadTask` entries directly from `urlMetadata`. The download adapter `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerDownloadAdapter.ts` executes these tasks by resolving a `DataSourceStrategy` and calling `fetchData` + `processData`, then writes a single FlatGeobuf buffer to `EphemeralShapeDB` per task. Extract tasks are created in `SessionController.processExtract1Stage` by mapping the same `urlMetadata` to the buffer ids created by the download stage. This assumes a 1:1 mapping between download tasks and extract tasks.

Data source implementations exist at:

- `plugins/shape-plugin/src/services/datasources/NaturalEarthStrategy.ts`
- `plugins/shape-plugin/src/services/datasources/OpenStreetMapStrategy.ts`
- `plugins/shape-plugin/src/services/datasources/GADMStrategy.ts`
- `plugins/shape-plugin/src/services/datasources/GeoBoundariesStrategy.ts`

Country metadata (including `bbox`, `iso2`, `iso3`, `adminLevels`) is loaded via `plugins/shape-plugin/src/services/metadata/MetadataLoader.ts` from `packages/features/fetch-save-metadata/output/*.json`. The batch pipeline currently ignores country metadata when building download tasks.

The goal is to let each data source decide its own download task structure and how to derive country/admin-level outputs from downloaded data.

## Plan of Work

Introduce a new `FetchStageStrategy` interface under `plugins/shape-plugin/src/services/batch/strategies/` that encapsulates:

1. Building download tasks from `urlMetadata` and session config.
2. Postprocessing after download completion, including country/admin-level extraction.
3. Producing the list of next-stage tasks (extract1 or later) and their input buffer ids.

Add a strategy registry that resolves an implementation based on `dataSource` (normalized name). The shared `SessionController` will:

1. Resolve the strategy for the current data source.
2. Call `buildDownloadTasks(...)` to get the download tasks.
3. Execute download tasks via the adapter (the adapter remains a pure executor and does not know about the per-source mapping).
4. After all downloads are completed, call `postprocessDownloadOutputs(...)` on the strategy to perform any splitting/aggregation and to return the next-stage tasks.
5. Use the returned tasks to continue the pipeline (extract1 and onward).

For GADM and GeoBoundaries, the strategy will maintain the current 1:1 mapping. For NaturalEarth and OSM, the strategy will:

- Download broader data (based on current URL/endpoint).
- Use country metadata (`iso2`/`iso3` plus `bbox`) to filter features into per-country/per-level buffers.
- Create a task per resulting country/admin-level output.

The strategies should write the per-country/per-level outputs into `EphemeralShapeDB.rawBuffers` under predictable ids. The returned next-stage tasks should reference those buffer ids. This ensures downstream stages can remain unchanged.

Add tests for the strategy behavior. Use fixture GeoJSON and metadata to verify that:

- GADM/GeoBoundaries produce one output buffer per download task.
- NaturalEarth/OSM can produce multiple buffers from a single download task.
- The generated extract tasks match the produced buffers and include the correct `countryCode`/`adminLevel`.

Update TASKS.md logs with start/progress/done, and add rollback steps referencing the touched files.

## Concrete Steps

1. Create strategy interfaces and registry.

   Edit `plugins/shape-plugin/src/services/batch/strategies/FetchStageStrategy.ts` (new file) to define the interface and supporting types. Include a `createDownloadTasks(...)` method and a `postprocessDownloadOutputs(...)` method that returns next-stage tasks and any derived metadata.

2. Implement data-source strategies.

   Add files under `plugins/shape-plugin/src/services/batch/strategies/`:

   - `GadmDownloadStrategy.ts`
   - `GeoBoundariesDownloadStrategy.ts`
   - `NaturalEarthDownloadStrategy.ts`
   - `OsmDownloadStrategy.ts`

   Each strategy will implement the interface and handle its own mapping and extraction logic.

3. Wire strategies into the pipeline.

   Update `plugins/shape-plugin/src/services/batch/SessionController.ts` to:

   - Resolve the strategy by `dataSource`.
   - Build download tasks via the strategy.
   - After `downloadAdapter.process(...)` completes, call `postprocessDownloadOutputs(...)`.
   - Use the returned tasks in `processExtract1Stage`.

4. Ensure `RuntimeWorkerDownloadAdapter` only executes download tasks and writes buffers.

   Confirm it does not assume 1:1 mapping beyond its own task output. If it currently encodes ids that conflict with strategy outputs, update it to accept externally supplied buffer ids or allow the strategy to name outputs.

5. Tests.

   Add tests under `plugins/shape-plugin/src/services/batch/strategies/__tests__/` using small fixture GeoJSON and metadata. Cover:

   - 1:1 mapping for GADM/GeoBoundaries.
   - 1:n mapping for NaturalEarth/OSM.
   - Next-stage task creation reflecting the derived buffer ids and per-country/admin-level metadata.

## Validation and Acceptance

Run these commands from the repo root:

  pnpm --filter @hierarchidb/shape-plugin typecheck
  pnpm --filter @hierarchidb/shape-plugin test -- src/services/batch/strategies

Acceptance is met when:

- The strategy tests pass and demonstrate correct mapping.
- The download stage produces buffers for each country/admin-level as defined by the selected strategy.
- Extract tasks consume the derived buffers and no longer assume a fixed 1:1 mapping.

## Idempotence and Recovery

Edits are additive and can be retried safely. If a step fails, revert the changed files and re-run the tests to return to the prior state. The rollback path is to revert the strategy files and the `SessionController` changes, then run `pnpm --filter @hierarchidb/shape-plugin typecheck`.

## Artifacts and Notes

Example: expected task mapping summary (informal) for NaturalEarth

  Input: 1 download task (50m admin_0 + admin_1)
  Output: N buffers (country/admin-level pairs) and N extract1 tasks

This example must be replaced by real test evidence as implementation progresses.

## Interfaces and Dependencies

The strategy interface must expose:

- A method to build download tasks from `urlMetadata` and session config.
- A method to postprocess downloaded outputs, returning the list of next-stage tasks and any derived metadata.
- Access to `CountryMetadata` for bbox/iso-based filtering when needed.

Dependencies and files:

- `plugins/shape-plugin/src/services/batch/SessionController.ts`
- `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerDownloadAdapter.ts`
- `plugins/shape-plugin/src/services/metadata/MetadataLoader.ts`
- `plugins/shape-plugin/src/services/datasources/*.ts`
- `plugins/shape-plugin/src/services/database/EphemeralShapeDB.ts`

If any changes are made to the interface or file layout, update this ExecPlan and the Decision Log to capture the new structure and rationale.

Plan change log: Initial plan authored to support per-data-source download/postprocess/next-stage task strategies and to remove 1:1 mapping assumptions. Updated to record the fixed dataSource->strategy map decision and reflect initial implementation progress.
