# Shape Raw Buffer Pipeline and Naming Cleanup

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Users should be able to download shape source data, cache it with the correct format and compression per data source, and see consistent naming and behavior that aligns with the current pipeline vocabulary. After this change, the “raw download cache” is treated as a first-class data source buffer with explicit conversion steps (for example, GeoBoundaries is cached as FlatGeobuf), and downstream transforms will decode the cached format properly. This also removes the confusing “DownloadBuffersForNode” wording in favor of a name that reflects “raw data source buffers.”

## Progress

- [x] (2026-01-10 22:10 JST) Create ExecPlan and align naming/pipeline decisions across shape raw cache, data source strategies, and transform stage.
- [x] (2026-01-10 22:55 JST) Implement raw buffer naming changes and new raw data pipeline hooks.
- [x] (2026-01-10 22:55 JST) Implement GeoBoundaries pipeline conversion and GADM GeoJSON pipeline conversion for cached raw data.
- [x] (2026-01-10 22:55 JST) Update transform-source pre-processing to decode cached raw formats before stage processing.
- [ ] (2026-01-10 22:10 JST) Validate with targeted tests and add verification notes.

## Surprises & Discoveries

- Observation: GADM currently downloads gpkg zip but the pipeline cannot process it (processGeoPackage is empty).
  Evidence: `plugins/shape-plugin/src/services/datasources/GADMStrategy.ts` has `processGeoPackage` returning an empty FeatureCollection.

## Decision Log

- Decision: GADM downloads are standardized on GeoJSON endpoints (admin0 `.json`, admin1+ `.json.zip`), and gpkg/shp paths are removed.
  Rationale: Current gpkg/shp paths are unused in the pipeline and conflict with the requested raw cache rules.
  Date/Author: 2026-01-10 / Codex

## Outcomes & Retrospective

TBD after implementation.

## Context and Orientation

The shape plugin downloads raw data for each data source and caches it using a Dexie-based chunk store. The key paths today are:

- `plugins/shape-plugin/src/services/utils/chunkStore.ts` defines `storeRawDataDataSourceBufferForNode`, `countRawDataDataSourceBuffersForNode`, and helpers around the chunk store.
- `packages/runtime-worker/src/services/shapeChunkStore.ts` mirrors those helpers for the worker-side API.
- Each data source strategy (`plugins/shape-plugin/src/services/datasources/*.ts`) uses either `getOrFetchWithRetry` or the raw pipeline helper to fetch and cache raw downloads, then parses the cached buffer into a source-specific raw structure (GeoJSON, zipped JSON, etc.).
- The VT shape pipeline (`plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`) uses the data source strategy to fetch raw data, process it into `ShapeEntity[]`, then encodes FlatGeobuf and stores it in `stage1Buffers` (`packages/vt-shape-store`).

Terms used in this plan:

- Raw data source buffer: the cached “downloaded from source” bytes for a shape data source. This is currently named “download buffer” in code; this plan renames it to `rawDataDataSourceBuffer` or `rawDataDataSourceBuffers` for clarity.
- Stage1 buffer: the post-processed FlatGeobuf stored in `packages/vt-shape-store` and used by downstream `transform` and `vt` stages.
- Pipeline: a sequence of stream transforms applied to the raw download data before it is cached, to convert formats or compress data.

## Plan of Work

Rename download buffer helpers to the new “raw data source buffer” terminology.

1) Update helper function names and call sites.
   - In `plugins/shape-plugin/src/services/utils/chunkStore.ts`, rename:
     - `storeDownloadBufferForNode` -> `storeRawDataDataSourceBufferForNode`
     - `countDownloadBuffersForNode` -> `countRawDataDataSourceBuffersForNode`
     - `listDownloadMetadataForNode` -> `listRawDataDataSourceMetadataForNode`
     - `deleteDownloadBuffersForDataSource` -> `deleteRawDataDataSourceBuffersForDataSource`
     - `readDownloadBuffer` -> `readRawDataDataSourceBuffer`
   - Mirror the same renames in `packages/runtime-worker/src/services/shapeChunkStore.ts`.
   - Update call sites in `ShapeBatchApiClient`, `ShapeQueryService`, and any UI utilities that reference these helpers.
   - Keep identifiers in English but ensure UI text remains “fetch cache” as already standardized.

Introduce a raw download pipeline that supports stream transforms, with hashing at the stream entrance.

2) Extend the data source strategy contract with a raw pipeline hook.
   - Add a new optional interface in `plugins/shape-plugin/src/services/datasources/DataSourceStrategy.ts`, for example:
     - `createRawDataPipeline?(ctx): RawDataPipeline` where `RawDataPipeline` defines:
       - `prepareRequest(options): { url, headers, cacheKey, contentType }`
       - `transformStream(stream): ReadableStream<Uint8Array>` to apply conversions or compression
       - `decodeBuffer(buffer, metadata): RawData` for the inverse on read (used before processData)
   - This pipeline is responsible for:
       - Computing a hash immediately after download (before transform).
       - Transforming the raw stream to the cached format.
       - Providing decode logic for transformSource to restore the expected raw structure.

3) Add a stream-capable raw download helper.
   - Create a helper in `plugins/shape-plugin/src/services/utils/rawDataPipeline.ts` (or similar) that:
     - Uses `FetchNetworkPort` to fetch a `Response`.
     - Reads the response body as a `ReadableStream<Uint8Array>`.
     - Computes a content hash from the raw bytes before any transform.
     - Pipes the stream through the data-source transform.
     - Collects or stores the transformed output in the chunk store.
   - Use `Response.arrayBuffer()` as the raw ingress, then wrap it with a `ReadableStream` so the pipeline can still expose stream transforms.
   - Use DexieChunkStore `setForNode` to store the transformed output with `sourceHash` metadata.

4) Store source hash metadata on cached entries.
   - Add optional `sourceHash` and `sourceHashAlgorithm` fields to `ChunkStoreMetadata` and `FileRecord` in `packages//src/index.ts`.
   - Ensure `storeRawDataDataSourceBufferForNode` (or the new helper) persists these fields in the metadata record.
   - Keep the existing `hash` field aligned with the stored buffer when using hash-based identities. The raw source hash should be stored separately to preserve the “hash at stream entrance” requirement.

Implement data source-specific raw pipeline conversions.

5) GeoBoundaries pipeline.
   - In `plugins/shape-plugin/src/services/datasources/GeoBoundariesStrategy.ts`, implement the raw pipeline so that:
     - Raw GeoJSON from the API is converted to FlatGeobuf before caching.
     - `decodeBuffer` reverses to a GeoJSON `FeatureCollection` for `processData`.
   - Use the existing `encodeFlatGeobufFromFeatureCollection` and decoding helpers already used in the fetch stage (or add new ones if needed).

6) GADM pipeline.
   - In `plugins/shape-plugin/src/services/datasources/GADMStrategy.ts`, change the fetch URLs to GeoJSON endpoints:
     - admin0: `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_{ISO3}_0.json`
     - admin1+: `https://geodata.ucdavis.edu/gadm/gadm4.1/json/gadm41_{ISO3}_{level}.json.zip`
   - Remove gpkg/shp fetch and parsing paths.
   - The pipeline should:
     - For admin0, zip the JSON payload before caching.
     - For admin1+, store the zipped JSON as-is.
     - `decodeBuffer` must unwrap zip vs plain JSON and return the expected GeoJSON `FeatureCollection`.

Update transform-source decoding before processing.

7) Add a pre-processing step in the transformSource stage.
   - Ensure any code path that reads cached raw buffers calls the data source strategy’s `decodeBuffer` (or equivalent) to unpack or convert the cached buffer into the raw structure expected by `processData`.
   - Keep this decode step in the data source strategy to avoid spreading format-specific logic across the pipeline.

## Concrete Steps

All commands should be run from the repository root (`/Users/hiroya/WebstormProjects/hierarchidb`).

1) Search for download buffer helpers and call sites.
   - Run `rg -n "DownloadBuffers|download buffer|countRawDataDataSourceBuffersForNode|storeRawDataDataSourceBufferForNode" plugins packages`
   - Note each usage site and update to the new naming once the helper functions are renamed.

2) Implement the raw pipeline interfaces and helper.
   - Edit `plugins/shape-plugin/src/services/datasources/DataSourceStrategy.ts` to add the raw pipeline interface and optional hook.
   - Add the raw pipeline helper module to `plugins/shape-plugin/src/services/utils/`.
   - Update `FetchNetworkPort` and `ResponseLike` only if streaming is required by the pipeline implementation.

3) Update data source strategies to use the raw pipeline.
   - Modify `GeoBoundariesStrategy.fetchData` and `GADMStrategy.fetchData` to call the new pipeline helper rather than `getOrFetchWithRetry` directly.
   - Ensure `processData` receives decoded data.

4) Update transformSource pre-processing.
   - Find the entry point where cached raw data is read before `processData`, and add a `strategy.decodeBuffer(...)` step.

5) Update runtime-worker utilities to match naming changes.
   - Refactor `packages/runtime-worker/src/services/shapeChunkStore.ts` to use the new helper names and metadata fields.

6) Update any tests that assume old names or raw cache formats.

## Validation and Acceptance

1) Run targeted tests for data source strategies:
   - `pnpm --filter @hierarchidb/shape-plugin test -- --run DataSourceIntegration`
   - Expect the data source integration tests to pass and no TypeScript errors related to the renamed helpers.

2) Manual validation (if tests are not available):
   - Start the app and run a GeoBoundaries fetch; confirm the raw cache entry in the chunk store reports `contentType` as FlatGeobuf and includes a `sourceHash`.
   - Run a GADM admin0 fetch and confirm the raw cache entry is zipped (content type indicates zip, or payload has zip signature).
   - Build pipeline step should successfully decode cached raw buffers and produce stage1 buffers as before.

Acceptance is met when the raw cache terminology is consistent, the raw pipeline is data source-specific, and downstream processing (transform stage) still produces correct stage1 buffers with no regressions.

## Idempotence and Recovery

Renames and pipeline updates are safe to re-apply. If a fetch fails after these changes, revert the raw pipeline helper and restore the old `getOrFetchWithRetry` calls to return to the previous behavior. Use `git revert` on the relevant commit(s) to roll back.

## Artifacts and Notes

Expected evidence to capture during implementation:

  - A brief diff summary showing renamed helper functions and updated call sites.
  - A log snippet showing the raw pipeline reporting `sourceHash` and content type for GeoBoundaries and GADM.

## Interfaces and Dependencies

Required interfaces and types at the end of the change:

- `RawDataPipeline` (new):
  - `prepareRequest(options): { url: string; headers?: Record<string, string>; cacheKey: string; contentType?: string }`
  - `transformStream(stream: ReadableStream<Uint8Array>): ReadableStream<Uint8Array>`
  - `decodeBuffer(buffer: ArrayBuffer, metadata: ChunkStoreMetadata): RawData`

- `DataSourceStrategy` additions:
  - Optional `createRawDataPipeline?(ctx): RawDataPipeline`

- `ChunkStoreMetadata` additions:
  - `sourceHash?: string`
  - `sourceHashAlgorithm?: HashAlgorithm`

These changes should be implemented in a way that does not require consumers to set the raw pipeline for every data source; only GeoBoundaries and GADM need overrides initially.

---
Plan update note (2026-01-10 22:10 JST): Initial ExecPlan drafted for raw buffer naming and data source pipeline conversion requirements.
Plan update note (2026-01-10 22:35 JST): GADM fetch is standardized to GeoJSON endpoints; gpkg/shp paths are removed.
Plan update note (2026-01-10 22:55 JST): Raw buffer naming and pipeline helper implemented; GeoBoundaries/GADM pipeline changes applied.
