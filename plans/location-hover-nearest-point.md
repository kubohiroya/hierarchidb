# Location hover nearest point (Location plugin)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked in at `PLANS.md`. This document must be maintained in accordance with `PLANS.md`.

## Purpose / Big Picture

Enable the Location plugin map preview to show a Snackbar on mouse hover with the nearest location point’s type, name, region, and coordinates. The nearest point is computed using the vector-tile data by finding the current hover tile and searching within the surrounding 3x3 tiles. The LocationQueryAPI returns both the cursor position and the distance to the nearest point so the UI can display contextual feedback. Users can verify the change by opening the location map preview, moving the mouse over the map, and seeing the Snackbar update as the pointer moves.

## Progress

- [x] (2025-12-27 10:36 JST) Added task entry 1916 in `TASKS.md` and recorded start log.
- [x] (2025-12-27 11:02 JST) Implemented LocationQueryAPI nearest-point request/response types and method signature.
- [x] (2025-12-27 11:15 JST) Implemented nearest-point lookup and tile cache in `LocationQueryService` using per-tile BTree and LRUMap.
- [x] (2025-12-27 11:22 JST) Added UI hover handling and Snackbar display in `LocationMapPreview`.
- [ ] Update any affected tests or mocks if type changes require it.
- [ ] Record verification evidence (typecheck or test command) and update `TASKS.md` with progress/done/rollback notes.

## Surprises & Discoveries

None yet.

## Decision Log

- Decision: Implement nearest-point lookup inside `LocationQueryService` using EphemeralLocationDB vector tiles and a local LRUMap+BTree cache.
  Rationale: LocationQueryAPI already routes through the worker and EphemeralLocationDB is available there; this keeps map hover queries fast and centralized.
  Date/Author: 2025-12-27 / Codex

## Outcomes & Retrospective

Pending.

## Context and Orientation

The location map preview lives in `plugins/location-plugin/src/ui/components/batch/LocationMapPreview.tsx`. The preview currently renders markers and summary UI but does not respond to hover. Vector tiles for location data are stored in `plugins/location-plugin/src/database/LocationDB.ts` under the `vectorTiles` table with tile IDs formatted as `loc-mvt-<sessionId>-<z>-<x>-<y>`. The worker exposes `LocationQueryAPI` (defined in `packages/plugin-service-api/src/types/LocationQueryAPI.ts`) and the runtime-worker implementation is `packages/runtime-worker/src/services/LocationQueryService.ts`. The UI can reach the worker via `getWorkerBridge()` and `getLocationQueryAPI()` from `packages/ui/worker-client/src/workerBridge.ts`.

Key terms:

Tile coordinates (z/x/y) are Web Mercator tile indices derived from latitude/longitude and zoom. The hover logic uses the tile containing the cursor and the eight surrounding tiles (3x3 search).

BTree is a binary search tree keyed by longitude, used to locate nearest longitude candidates efficiently. LRUMap is a fixed-size map that evicts the least-recently-used entries to limit memory.

## Plan of Work

Update `LocationQueryAPI` to include a new request/response type for nearest-point queries and a method `findNearestLocationPoint`. The response includes the cursor coordinates and the distance in meters to the nearest point, if found. Implement this method in `LocationQueryService` by loading the latest session for the node from `EphemeralLocationDB`, decoding vector tiles for the 3x3 neighborhood, and caching each tile’s points as a BTree keyed by longitude. Use the BTree to find the nearest longitude candidate and then refine the search by checking points within a longitude range implied by the current best distance to ensure the nearest point is accurate. Expose the result to the UI.

In the Location map preview component, add a pointer-move handler that converts mouse position to latitude/longitude based on the preview bounds, then calls the new `LocationQueryAPI.findNearestLocationPoint`. Use a small debounce to avoid flooding the worker. When a nearest point exists, render a MUI Snackbar with type, name, region, and coordinates. Close the Snackbar when the pointer leaves the map or when no point is found.

## Concrete Steps

From repository root:

1) Edit `packages/plugin-service-api/src/types/LocationQueryAPI.ts` to add the new types and method signature.

2) Edit `packages/runtime-worker/src/services/LocationQueryService.ts`:
   - Import the new types.
   - Add helper functions for tile coordinate conversion, vector tile decoding, distance calculation, BTree, and LRUMap.
   - Implement `findNearestLocationPoint`.

3) Edit `plugins/location-plugin/src/ui/components/batch/LocationMapPreview.tsx`:
   - Add hover state, debounced pointer move handling, and a Snackbar.
   - Use `getWorkerBridge().getLocationQueryAPI()` to call the new worker method.

4) Run targeted verification (if possible):
   - `pnpm --filter @hierarchidb/location-plugin typecheck`

## Validation and Acceptance

After changes, open the Location plugin map preview and move the mouse across the map. A Snackbar should appear and update with the nearest point’s type, name, region, and coordinates. If vector tiles are available, the response should track the cursor. If no tiles exist, the Snackbar should remain hidden. If running commands, `pnpm --filter @hierarchidb/location-plugin typecheck` should succeed.

## Idempotence and Recovery

Edits are additive and safe to reapply. If a step fails, revert the modified files (`LocationQueryAPI.ts`, `LocationQueryService.ts`, `LocationMapPreview.tsx`) and re-run typecheck. The LRUMap cache is in-memory only and does not affect persistent data.

## Artifacts and Notes

Expected user-visible result: a Snackbar appears on hover in the Location map preview with the nearest point details.

## Interfaces and Dependencies

The new method signature in `LocationQueryAPI` is:

  `findNearestLocationPoint(query: LocationNearestPointQuery): Promise<LocationNearestPointResponse>`

The response includes:

  - `cursor`: `{ longitude, latitude }`
  - `nearest`: `{ name?, kind?, region?, longitude, latitude, properties? } | null`
  - `distanceMeters`: `number | null`

LocationQueryService uses `EphemeralLocationDB` from `@hierarchidb/location-plugin` to read vector tiles and the `@mapbox/vector-tile` + `pbf` decoder to extract point geometries.
