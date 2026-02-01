# Align route build pipeline with shape fetch/transform/vt stages

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

The plan must be maintained in accordance with `PLANS.md` at the repository root.

## Purpose / Big Picture

Route builds should behave like shape builds: a clear fetch/transform/vt pipeline with the same stage semantics. After this change, a user can run a route build and observe fetch/transform/vt progress with the IDE-GSM import happening inside fetch, a transform stage that builds inverted indexes for routing lookups, and a vt stage that actually generates vector tiles used for preview. This ensures route lines appear in every tile they cross, even when the start/end points are outside the tile.

## Progress

- [x] (2026-01-31 07:46Z) Draft ExecPlan with concrete pipeline changes, stage mapping, and verification steps.
- [x] (2026-01-31 08:02Z) Implement route fetch stage to run fetch/parse/waypoints/save as a single stage without zoom-band splitting.
- [x] (2026-01-31 08:08Z) Implement route transform stage to build inverted indexes only.
- [x] (2026-01-31 08:10Z) Implement route vt stage to generate vector tiles and persist them for preview.
- [x] (2026-01-31 08:15Z) Update UI stage labels and progress mapping to fetch/transform/vt.
- [x] (2026-01-31 08:17Z) Run required typecheck/tests and document outputs.

## Surprises & Discoveries

- Observation: runtime-worker typecheck failed after adding bulkGet to RouteDatabaseHandle because RouteDB bulkGet expects NodeId[].
  Evidence: tsc error in @hierarchidb/runtime-worker typecheck, resolved by updating RouteDatabaseHandle bulkGet to NodeId[] and rebuilding route-store.

## Decision Log

- Decision: Use the existing route IDE-GSM import pipeline for fetch and generate vector tiles inside RouteMutationService via StageProcessingService.
  Rationale: Keeping both fetch and vt in the worker avoids large data transfers and aligns with shared vector tile storage.
  Date/Author: 2026-01-31 / Codex
- Decision: Persist a per-tile inverted index (tile -> line IDs) in RouteDB and use it in RouteQueryService.
  Rationale: This satisfies the transform-stage requirement and accelerates nearest-line queries without changing feature storage.
  Date/Author: 2026-01-31 / Codex
- Decision: Generate vector tiles inside RouteMutationService via StageProcessingService and preview them via RouteQueryAPI.
  Rationale: Keeping tile generation in the worker avoids large data transfers and aligns with existing vector tile storage.
  Date/Author: 2026-01-31 / Codex

## Outcomes & Retrospective

- Implemented a fetch/transform/vt pipeline for route builds with tile index and vector tile generation, and updated preview to read vector tiles. Typechecks for route-api, route-store, runtime-worker, and route-plugin succeeded after fixing a bulkGet type mismatch. Remaining work is to confirm behavior in the UI (build stage progression and tile rendering) with an IDE-GSM dataset.

## Context and Orientation

Routes are currently built via an IDE-GSM import flow that reports phases `fetch`, `parse`, `waypoints`, and `save` inside `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`. The runtime worker `packages/runtime-worker/src/services/RouteMutationService.ts` imports the CSV, resolves locations, generates waypoints for air/sea, and persists features. There is also a route vector tile generator in `plugins/route-plugin/src/services/RouteVectorTileService.ts`, but the build step does not invoke it. The preview UI `plugins/route-plugin/src/ui/components/steps/RoutePreviewStep.tsx` currently draws GeoJSON from `draftData.lineGeometry` rather than vector tiles.

This plan aligns route stages with shape by introducing explicit fetch/transform/vt stages within the route build flow. The fetch stage will encompass IDE-GSM download, parsing, waypoint generation, and saving. The transform stage will build inverted indexes (route search accelerators) without any geometry simplification. The vt stage will invoke vector tile generation so tiles contain segmented lines. This will use the existing vector tile runtime worker (`@hierarchidb/runtime-worker` vectortile client) and store tiles in the ephemeral route DB for preview.

Definitions:
- Fetch stage: downloading and parsing IDE-GSM CSV plus deriving waypoints and storing features.
- Transform stage: creating inverted indexes (data structures that map lookup keys to route features).
- VT stage: generating map vector tiles (MVT) so route lines are cut at tile boundaries and rendered in any tile they cross.

## Plan of Work

First, introduce a route-specific stage runner or pipeline coordinator that mirrors shape’s fetch/transform/vt progression but without zoom-band splitting. The fetch stage should call the existing IDE-GSM import function and treat its phases as internal sub-steps; the UI stage should show a single fetch stage with a sub-status label (fetch/parse/waypoints/save). The transform stage should build inverted indexes only. Identify where route indexes are computed today (likely in route query or storage services) and extract or reuse that logic. The vt stage should invoke `RouteVectorTileService.startSession` using route line geometries and build config settings; it should persist tiles for preview and update build progress.

Next, rewire `RouteBuildStep` progress mapping to use the three stages: fetch, transform, vt. Ensure UI labels match and the new stage IDs are used by progress events. Introduce a route build orchestrator in the runtime worker or route plugin services that coordinates these stages, similar to shape’s pipeline but simplified (single batch). If possible, reuse `@hierarchidb/vt-orchestrator` for tile generation, but avoid zoom-band splitting.

Finally, ensure preview reads from vector tiles when available. If a tile preview layer already exists in ui-map, connect route preview to it. If not, keep GeoJSON as fallback only if requested; otherwise replace the preview to use vector tiles to guarantee tile boundary segmentation.

## Concrete Steps

1) Inspect current route build execution paths and identify the correct insertion point for a fetch/transform/vt coordinator.
   - Files: `plugins/route-plugin/src/ui/components/steps/RouteBuildStep.tsx`, `packages/runtime-worker/src/services/RouteMutationService.ts`, `plugins/route-plugin/src/services/RouteVectorTileService.ts`.

2) Add a route pipeline controller that emits stage progress for fetch/transform/vt. Use stage IDs `fetch`, `transform`, `vt` to align with shape conventions. Ensure internal sub-phases (fetch/parse/waypoints/save) are mapped to fetch stage progress only.

3) Implement transform stage with inverted index generation only. If a route index builder exists, call it here. If not, add a new function in route services (e.g., `plugins/route-plugin/src/services/RouteIndexService.ts`) that can build and persist the index from stored route features.

4) Implement vt stage by calling `RouteVectorTileService.startSession` with route line geometries, using build config vt settings. Persist the session summary and mark the stage as complete.

5) Update the UI progress mapping and stage labels in `RouteBuildStep` to show fetch/transform/vt. Update any stage-specific messaging to match.

6) Update preview to read tiles from the ephemeral route DB or vectortile runtime worker rather than only GeoJSON. Ensure tiles display even when they do not contain start/end points.

7) Run `pnpm --filter @hierarchidb/route-plugin typecheck` and any targeted tests. Record command outputs in TASKS.md.

## Validation and Acceptance

- Run a route build with IDE-GSM data and observe the build panel showing stages `fetch`, `transform`, `vt` in that order.
- Confirm that during fetch, the sub-status (fetch/parse/waypoints/save) updates but the stage remains `fetch`.
- Confirm that transform stage completes without geometry simplification (no decimation of points, only index build).
- Confirm that vector tiles are generated and stored (check RouteVectorTileService logs or tile counts).
- Open the preview and verify that a line crossing a tile boundary appears in tiles even if start/end are not within the tile.

Expected commands:
- From repo root: `pnpm --filter @hierarchidb/route-plugin typecheck` (expect exit 0)

## Idempotence and Recovery

Edits are safe to re-run; rebuilding the route pipeline should overwrite prior stage wiring. If the vt stage introduces regressions, revert the new pipeline coordinator and re-enable the prior IDE-GSM-only build path. If vector tile generation fails, the fetch stage results remain stored and can be reused once the vt stage is fixed.

## Artifacts and Notes

- Record any stage-progress logs or tile generation summaries here after implementation.

## Interfaces and Dependencies

Use existing modules to minimize risk:
- `RouteMutationService.importIdeGsmRoutes` for fetch+parse+waypoints+save.
- `RouteVectorTileService.startSession` for vt generation (MVT).
- `RouteBuildStep` for UI stage progression and error dialogs.
- Any inverted index builder should be placed in `plugins/route-plugin/src/services` and invoked from the transform stage.

If a new worker API is needed, extend `RouteMutationAPI` or add a new route-specific service that can be called from the UI build step. Keep data flow within the worker to avoid large payloads crossing the UI bridge.

Note on plan maintenance: update `Progress`, `Decision Log`, and `Surprises & Discoveries` after each milestone. At completion, fill `Outcomes & Retrospective` with the final status and lessons learned.

Plan update note (2026-01-31): Updated Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective to reflect implementation and verification status after completing the route fetch/transform/vt alignment.
