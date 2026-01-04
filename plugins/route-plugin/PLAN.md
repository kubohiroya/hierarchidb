# Route Plugin — Batch Processing Implementation Plan

Status: Draft (to be refined with reviewer input)
Target Branch: `feat/route/batch-processing-implementation`
Last Updated: 2025-09-06

## 1. Goals / Non‑Goals

- Goals:
  - Add a robust, resumable batch processing foundation to the Route plugin, reusing existing extracted features: `@hierarchidb/batch`, `@hierarchidb/download`.
  - Support large sets of route computations (e.g., bulk re-routing, distance/duration calculations, segment enrichment, route smoothing) with progress reporting, cancellation, retry, and export.
  - Keep work off the main thread via Runtime Worker; persist job state and outputs; expose UI affordances for launching and monitoring jobs.
  - Provide idempotent APIs so the same batch spec doesn’t duplicate work when retried.

- Non‑Goals:
  - Building new routing algorithms from scratch (we will integrate existing engines/services or shared compute building blocks when available).
  - New server/BFF functionality beyond minimal passthrough/proxy if absolutely necessary.
  - Replacing `feature/*` job/execution model; we will compose it.
  - Duplicating utilities/components already present in the workspace. Prefer promotion/reuse over re‑implementation.

## 1.B De‑duplication Strategy (Important)

- Throttling/Backoff: promote the lightweight RateLimiter currently embedded in `runtime-ui/datasource` into a shared module (e.g., `runtime-shared/batch-processor` or `@hierarchidb/util`) and reuse. Do not create a new limiter.
- Storage/Schema: use `feature/batch` Dexie stores for jobs/tasks/results. For route outputs, extend existing route stores or add a small route‑specific table; avoid parallel bespoke stores.
- Geometry/Encoding/Extraction: reuse capabilities from the refactored `shape-plugin` services (quantization, TopoJSON extraction, geobuf, pako). Wire through shared compute steps (TBD) instead of re‑writing.
- Vector Tiles: if MVT generation exists in shape pipeline (or documented as planned), factor common parts into shared steps; otherwise keep tiler as optional follow‑up, not a blocker for the first delivery.
- Engine adapters: check for existing `feature/route-searoute` and any OSRM client. Implement thin adapters that conform to a common engine interface.

## 1.B.1 Cross-Plugin Sharing

The route batch processing implementation prioritizes shared infrastructure to reduce duplication and ensure consistency across plugins:

### Progress Management (Shared)
- **ProgressEmitter/Store**: Use `@hierarchidb/runtime-shared-batch-processor` for unified progress tracking across all plugins (route, shape, location)
- **UI Components**: Progress bars and live progress indicators should reference shared progress types
- **Elimination**: Remove local progress implementations in route-plugin to prevent divergence

### Batch Session Architecture (Shared)
- **AbstractBatchSession**: Base class from `@hierarchidb/runtime-shared-batch-processor` provides session lifecycle, pause/resume, and persistence
- **Lane Management**: Session-level concurrency control with configurable lane caps (osrm=1, searoute=3, local=64)
- **Download Service**: Unified `@hierarchidb/download` with auth recovery for external API calls

### Engine Architecture (Route-Specific)
- **RouteGenerator**: Maintains plugin-specific routing logic with injected engine dependencies
- **Engine Providers**: Abstract interfaces (RouteEnginesProvider) allow mock testing and implementation swapping
- **Integration**: Wire external services (OSRM, searoute) through dependency injection rather than hard-coded clients

## 1.C Project Alignment (Concrete Anchors)

- Route batch orchestration must extend existing scaffolding:
  - Use `packages/plugins/route-plugin/src/services/RouteBatchManager.ts` as the primary entry point. Replace current shim usage with the shared batch processor once promotion is ready; keep the surface compatible.
  - Keep task types aligned with current placeholders: `location_resolution` → `route_generation` → `validation` → `optimization` stages.
- Route engines must sit behind the existing service:
  - Implement engines inside `packages/plugins/route-plugin/src/services/RouteGenerator.ts` by adding concrete branches for `osm_route` and `searoute` instead of new modules. Reuse existing `direct` and `great_circle` implementations.
  - Add thin adapters that call feature services (see below) rather than hardcoding HTTP in the generator.
- Feature registry wiring:
  - Register engine capabilities via `@hierarchidb/feature-registry` at worker bootstrap. Provide caps such as `route.engine.osrm`, `route.engine.searoute` and consume them from `RouteGenerator`.
- Reuse/promote shared utilities:
  - Move the simple RateLimiter from `packages/runtime-ui/datasource/src/services/DataSourceManager.ts` into a shared module (e.g., `packages/runtime-shared/batch-processor/src/RateLimiter.ts` or `packages/util/src/rateLimiter.ts`). Import it in Route scheduler; remove duplicate implementations.
  - Geometry encoding/extraction should reuse shape-plugin workers/utilities; do not build a new TopoJSON/MVT stack under route.

Deliverables MUST reference these files/paths to avoid drift.

## 2. User Stories (Representative)

- As a user, I can select N route candidates and run “Recompute routes with profile X” as a background job; I can close the tab and later resume.
- As a user, I can compute a distance/duration matrix for many origin/destination pairs and export the results as CSV/Parquet.
- As a user, I can batch-enrich routes (e.g., add elevation, snap to network, smooth geometry) and track per-item success/failure with retry.
- As a user, I can cancel a running batch job, later resume it, or re-run only failed items.

## 3. Architecture Overview

- Job Model (reuse `@hierarchidb/batch`):
  - Entities: `BatchJob`, `BatchTask`, `BatchResult` with statuses: `queued` → `running` → `succeeded | failed | cancelled`.
  - Idempotency: `jobKey` derived from job spec hash (inputs + parameters + plugin version + compute profile).
  - Persistence: Dexie stores via runtime worker; job progress events via worker postMessage channel.

- Execution (shared compute pipeline; TBD):
  - Compose a pipeline from small, pure steps (e.g., decode input → chunk → compute → persist result → emit progress).
  - Concurrency controls: pool size, per-domain rate limits (to avoid API throttling), backpressure to storage.
  - Retry policy: exponential backoff up to N attempts; permanent failure classification (4xx, validation, invariant violations).

- Export (reuse `@hierarchidb/download`):
  - Stream results that meet a filter (all, succeeded only, failed only) to file; formats: CSV (default), JSON Lines; extensible to Parquet if present.

- Route Plugin Integration:
  - Provide high-level job types:
    - `route/recompute`: recompute geometry/attributes under a routing profile.
    - `route/matrix`: origin-destination distance/duration matrix.
    - `route/enrich`: smoothing, elevation, snap-to-network, segment stats, etc.
  - Each job type defines its task mapper (input → tasks) and compute step(s) wired through a shared compute pipeline (TBD).

### 3.A End‑to‑End Flow (Stage Pipeline)

1) Job Ingest
- Persist OD pairs and route type (straight/great‑circle/osrm/searoute + mode) to IndexedDB as durable jobs via `@hierarchidb/batch`.
- Example schema (conceptual):
  - `jobs{ id, startId, endId, type, mode, priority, regionKey, lengthKmApprox, status, attempts }`
  - `regionKey`: geospatial bucketing (geohash/S2/Morton) for locality.
  - `lengthKmApprox`: coarse great‑circle estimate for downstream binning.

2) Scheduler (Fair + Throttled)
- Lane partitioning with different default caps:
  - `LANE_OSRM`: RPS=1, concurrency=1 (respect public API limits).
  - `LANE_SEAROUTE`: CPU‑intensive; concurrency=2–4.
  - `LANE_LOCAL`: straight/great‑circle; concurrency=16–64.
- Weighted‑fair queue: round‑robin across lanes; per‑lane internal throttler governs RPS/concurrency/exponential backoff.
- Block by geography/distance: batch by `regionKey × lengthBin` (short/medium/long) to increase I/O locality and tile cache hit rate.

3) Routing Workers (WebWorker/Comlink)
- OSRM Worker: enforce 1 RPS / 1 concurrency; use throttler for retries.
- Searoute Worker: parallel workers at 2–4 concurrency; CPU‑bound.
- Local Worker: straight/great‑circle; large parallelism acceptable.
- Output stream: each computed item yields a `RouteFeature` with distance, optional duration, and metadata; append to store.

4) Route Store (IndexedDB/Dexie)
- `routes{ routeId, odId, type, mode, distance_km, duration_min?, bbox, geom }`
- `geom` uses compact binary encoding: quantized (1e5) Int32 Δ‑encoding or geobuf; pako compression optional.

5) Tile Index (Streaming)
- For each route, compute candidate tile set for [minZ,maxZ].
- First pass: bbox→tile range; second pass (tiler) does precise segment clipping.
- `tile_index{ tileKey(z/x/y), routeId }` append‑only to enable external‑memory processing per tile.

6) Tiler (Offline/Background)
- Process tiles in tileKey order; write `tiles{ tileKey, zxy, mvtPbf, stats }`.
- Steps: read routeIds for tileKey → decode geom → clip to tile bounds → extract by zoom tolerance → `geojson‑vt`‑like slicing → `vt‑pbf` encode → persist.
- Design avoids holding all data in memory; streaming/page through Dexie.

7) UI Progress & Control
- Show cursors: `jobsDone / routesDone / tilesDone` and per‑lane RPS/errors.
- Support pause/resume/cancel via batch job status + checkpoint cursors.

8) Blocking Strategy (High‑yield ordering)
- Use small batches (e.g., 200–1000) per `lane × region × distanceBin`.
- Benefits: fairness for OSRM, smooth CPU load for searoute/great‑circle, higher tile locality.
- Region bucketing: geohash 5–6 or S2 level 6–8; distance bins: `<200km / <1500km / ≥1500km`.

## 4. Data Model Additions (Route Domain)

- Extend (or add) Route batch metadata types:
  - `RouteBatchSpec`: inputs (route ids, waypoints, OD pairs), options (profile, constraints, chunkSize, concurrency), output schema selection.
  - `RouteBatchOutput`: per-task output schema including core metrics, geometry, errors.
  - `RouteEntity` soft-link fields for provenance: `lastBatchJobId`, `lastBatchAt`, `profileUsed`.

No breaking changes to existing Route entities; batch writes will use upserts on computed targets (either updating the source route entities or writing to a dedicated result collection depending on job type).

## 5. Worker/Plugin Wiring

- Use Runtime Worker bootstrap to register a `RouteBatchWorker` that implements the `@hierarchidb/batch` JobExecutor interface for the three job types.
- Job definitions exported by route-plugin so the UI can discover capabilities (via Feature Registry).
- Progress events throttled (e.g., 10/s) and memoized to reduce UI noise; final snapshot on completion.

## 6. API Surfaces

- Command API (Worker-bound):
  - `startRouteBatch(spec: RouteBatchSpec): Promise<BatchJobId>`
  - `getRouteBatch(jobId): Promise<BatchJob>`
  - `cancelRouteBatch(jobId): Promise<void>`
  - `resumeRouteBatch(jobId): Promise<void>`
  - `exportRouteBatch(jobId, filters, format): Promise<DownloadHandle>`

- UI Hooks (in route-plugin UI or runtime-ui plugin-dialog):
  - `useRouteBatchLauncher()` returns submit + validation helpers.
  - `useRouteBatchProgress(jobId)` returns progress totals, ETA, failure sample, export options.

### 6.A Library‑Level Engines and Properties
- Engines supported: `straight` (Euclidean), `great_circle` (spherical), `osrm`, `searoute`.
- Modes: `road_general`, `road_express`, `rail`, `rail_highspeed` etc., mapped to engine profiles (e.g., OSRM car/bicycle/foot or custom; searoute parameters).
- Output per route feature:
  - `properties.distance_m` (always present; computed or taken from engine response).
  - `properties.duration_s` (OSRM and engines that supply or can infer from speed; optional/derived in others).
  - `properties.engine`, `properties.mode`, `properties.profile`, `properties.specHash`.
- TopoJSON bundling: line features aggregated under a single Topology; optional GeoJSON output switch.

Implementation notes in this repo:
- Extend `RouteGenerationConfig` and ensure its union keys match `RouteGenerationMethod` in `src/entities/RouteEntity.ts` (already: `direct | osm_route | great_circle | searoute | custom`).
- `RouteGenerator.generate()` already switches on these methods. Fill `generateOSMRoute()` and `generateSeaRoute()` by delegating to Feature Registry provided services.
- Distance/duration properties map directly to `distance`/`duration` fields on `RouteEntity` and to feature.properties in exported TopoJSON.

## 7. Job Types and Pipelines

### 7.1 route/recompute
- Input: route ids or waypoint arrays.
- Steps: fetch inputs → chunk → compute route (profile) via shared compute pipeline (TBD) → persist route geometries/attrs → emit metrics.
- Edge cases: unreachable segments; fallback profile; partial path success.

### 7.2 route/matrix
- Input: arrays of origins/destinations (points, snapped nodes, or route endpoints).
- Steps: enumerate OD pairs (cartesian or sampled) → chunk → compute distance/duration → persist matrix rows → export-friendly schema.
- Optimizations: symmetric matrices, caching last N pair results by profile, avoid duplicate pairs via canonical keying.

### 7.3 route/enrich
- Input: route ids or geometries.
- Steps: fetch → run one or more enrichment steps (smoothing, elevation, segment stats) via shared compute pipeline (TBD) → write back enriched attributes.
- Config: step list, tolerances, sources (DEM, network), fail-strategy (skip/stop).

## 8. Concurrency, Chunking, and Limits

- Defaults (configurable via env/UI):
  - `chunkSize`: 100 tasks; `concurrency`: 4; `maxRetries`: 3; `retryBackoffMs`: 500 → 2000.
  - Per-service rate limiter tokens (if calling external routing backends).
  - Memory cap: periodically flush to IndexedDB; avoid keeping all results in RAM.

### 8.A Built‑in Throttler (Overridable)
- Per‑lane throttles with defaults, overridable via options/env:
  - OSRM: `rps=1`, `concurrency=1`, `backoffBaseMs=500`, `backoffFactor=2`, `backoffMaxMs=10000`.
  - Searoute: `rps=5`, `concurrency=2–4`, `backoffBaseMs=300`, `factor=2`.
  - Local: `rps=20`, `concurrency=16–64` (cap by CPU), minimal backoff.
- Expose overrides in public API and in batch job spec; persist effective values in job metadata for auditability.

Project placement:
- Add lane scheduler and limiter usage inside `RouteBatchManager.processTaskGroup()` batching, not in UI. Keep maxConcurrent from config, but gate each engine call through shared RateLimiter instances keyed per lane.

## 9. Reliability & Idempotency

- `jobKey = hash(spec + pluginVersion)`; starting a job with the same key returns the existing job.
- Checkpoint after each chunk: persisted cursor and counts to support resume after crash.
- Distinguish permanent vs transient errors to avoid retry storms.

## 10. Observability

- Metrics: total tasks, done, failed, skipped, avg latency, p95 latency, retries, bytes exported.
- Logs: per-chunk summary; error samples capped; attach lastError to failed tasks.
 - Per‑lane metrics: current RPS, concurrency, throttled time, backoff counts; tile throughput (tiles/sec) during tiling.

## 11. UI/UX

- New entry points:
  - Navigator/toolbar action: “Batch → Recompute Routes…”, “Batch → Matrix…”, “Batch → Enrich…”.
  - Dialog (runtime-ui plugin-dialog) to configure spec; validate counts and estimated compute time.
  - Progress panel: stacked bar of statuses; list failed samples with ‘retry failed only’ action; export buttons.

## 12. Testing Strategy

- Unit: pipeline step functions (pure), idempotency hashing, retry classifier.
- Worker Integration: fake-indexeddb; simulate cancellation/resume; large N with small chunkSize to exercise checkpoints.
- UI: dialog spec validation; progress hook state transitions.
- Performance: 10k tasks in CI-light profile; memory checks (no growth beyond threshold).

## 13. Migration & Backward Compatibility

- No schema-breaking changes; route entities get optional provenance fields.
- Jobs stored in dedicated `batch` stores (already provided by `feature/batch`).

## 14. Rollout & Flags

- Feature flag: `ROUTE_BATCH_ENABLED` (default ON for dev, OFF for prod until validated).
- Gradual enablement per job type; matrix job can ship behind `ROUTE_MATRIX_ENABLED` if needed.

## 15. Work Breakdown (Milestones)

M1: Scaffolding (1–2 days)
- [ ] Add route-plugin job type descriptors for `recompute`, `matrix`, `enrich`.
- [ ] Wire `RouteBatchWorker` that conforms to `@hierarchidb/batch` executor interface.
- [ ] Add provenance fields to route entity typings (optional fields only).
- [ ] De-dup groundwork: inventory existing engines (route-searoute, OSRM client), batch-processor, geometry utilities; decide promotion targets (RateLimiter → shared).
 - [ ] Align types and options: `RouteGenerationConfig` vs `RouteGenerationMethod`; verify properties on `RouteEntity` and TopoJSON export schema.

M2: Pipelines (3–5 days)
- [ ] Implement task mappers for each job type.
- [ ] Compose compute chains using the shared compute pipeline (TBD) (routing call, smoothing, etc.).
- [ ] Implement checkpointing and idempotent jobKey logic.
- [x] Implement per‑lane semaphores (OSRM/SEA/LOCAL) to cap concurrency regardless of batch size.
  - Defaults: osm_route=1, searoute=3, direct=64, great_circle=64, custom=8.
  - Overrides:
    - Config: `RouteBatchConfig.laneCaps` (e.g. `{ osm_route: 1, searoute: 4 }`).
    - Env: `ROUTE_LANE_CAPS` as JSON string (e.g. `{"osm_route":1,"searoute":4}`).
    - Global flag: `globalThis.FEATURE_FLAGS.ROUTE_LANE_CAPS` (object with numeric caps)。※ 2025-10-25 時点で FEATURE_FLAGS は撤廃済み。必要なら環境変数ベースの設定に置き換えること。
  - Placement: enforced in `RouteBatchSession` around `RouteGenerator.generate()`.
  - Tests: session-level gating test ensures `osm_route` max concurrency stays 1 even with high `maxConcurrent`.
  - Note: Fair queue + shared throttler remain optional; can be promoted from shared download `RateLimiter` later.
- [ ] Add regionKey and lengthKmApprox computation; binning strategy and batch builder.
- [ ] Extract/promote RateLimiter to shared and replace local usages.
- [ ] Engine adapters reuse: wrap `feature/route-searoute`; implement OSRM adapter against existing HTTP client/bff proxy if available.
 - [ ] Replace `batch-shim` with `runtime-shared/batch-processor` (or keep shim behind a compat interface) to run the session lifecycle.
 - [ ] Implement lane scheduling inside `RouteBatchManager` using shared RateLimiter.

M3: UI (2–3 days)
- [ ] Dialogs for three job types; client-side validation and estimation.
- [ ] Progress view with live updates and ‘retry failed only’ action.
- [ ] Export buttons integrated with `@hierarchidb/download`.
 - [ ] Lane metrics panel (RPS, concurrency, throttled %, errors), global cursors (jobs/routes/tiles).

M4: Observability & Hardening (2–3 days)
- [ ] Add metrics counters; throttle progress events.
- [ ] Robust retry classification; cancellation tests; large-N soak test.
- [ ] Tiler pipeline with external‑memory streaming; tile_index builder; MVT writer.
- [ ] Dedup check: ensure no duplicate stores/schemas/utils; document shared module boundaries.
 - [ ] Feature Registry integration tests: engines are discoverable and required by `RouteGenerator`.

M5: Docs & Examples (1 day)
- [ ] README/usage for batch jobs in route-plugin.
- [ ] Example scripts to create common specs (recompute, matrix).

Exit Criteria
- [ ] All three job types run to completion for 10k items with resume and ‘retry failed only’ validated.
- [ ] UI shows correct progress and supports export.
- [ ] No main-thread blocking; memory stays bounded; policy checks and CI green.
 - [ ] Tile pipeline generates MVTs for configured z‑range with bounded memory and measured throughput.

## 16. Dependencies & Risks

- Dependencies: `@hierarchidb/batch`, `@hierarchidb/download`, Runtime Worker bootstrap, Feature Registry.
- Risks: external routing API rate limits; large geometry write performance; IndexedDB quotas.
- Mitigations: rate limiter, chunking, incremental flush, output size caps, export-first workflows.

## 17. Open Questions / To Confirm

- Preferred routing backends/profiles and quota constraints.
- Matrix symmetry assumptions and caching window.
- Whether enrichment writes should mutate original routes or write parallel result collections.
 - Exact mapping table: modes → OSRM/searoute profiles; defaults and validation rules.
- TopoJSON vs GeoJSON default in public API; output size limits and compression choices.
 - Batch shim replacement timeline: when to depend on `runtime-shared/batch-processor` directly from route-plugin.
 - Exact file path for the promoted RateLimiter module and its API shape.
