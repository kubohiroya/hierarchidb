# Refactor vector tile storage to per-plugin DBs and keep vectortile-store

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

This document must be maintained in accordance with PLANS.md at the repository root (PLANS.md).

## Purpose / Big Picture

After this change, vector tiles and their metadata are stored inside each plugin’s own database (shapeDB, locationDB, routeDB) instead of a shared TilesDB. Deleting a TreeNode will therefore clean up its vector tiles without relying on a separate database. The vectortile-store package is kept as the shared home for the VectorTileDbBase and shared metadata table schema, while per-plugin DBs own the actual tile storage. You can see this working by running a shape build, confirming the tiles are stored in shapeDB, and verifying that deletion of the node removes the tiles and metadata from that same DB.

## Progress

- [ ] (2026-01-04 18:05 JST) Draft this ExecPlan with full context and validation steps.
- [ ] Move TilesDB schema and vector tile metadata tables into a shared base class used by shapeDB/locationDB/routeDB (completed: design; remaining: implement and migrate tables).
- [ ] Refactor gis-sdk and runtime-worker to stop using TilesDB and instead write/read via the plugin DBs (completed: none; remaining: update vector tile generation and list/get/summary paths).
- [ ] Keep @hierarchidb/vectortile-store and migrate the shared VectorTileDbBase there, updating all package.json dependencies/imports.
- [ ] Validate behavior manually and document results and remaining gaps.

## Surprises & Discoveries

- Observation: TilesDB appears in two places (packages/features/vectortile-store and packages/features/gis-sdk/src/TilesDB.ts) and shape-plugin also has a separate VectorTileDB/VectorTileDB2 file. This implies multiple overlapping “vector tile DB” definitions that are currently inconsistent.
  Evidence: packages/features/gis-sdk/src/TilesDB.ts and packages/features/vectortile-store/src/tilesDb.ts plus plugins/shape-plugin/src/services/database/VectorTileDB.ts

## Decision Log

- Decision: Create a shared base class for vector tile storage and metadata inside vectortile-store, then update shapeDB/locationDB/routeDB to extend it and store tiles/metadata per plugin, removing TilesDB usage while keeping vectortile-store.
  Rationale: The user requirement prioritizes TreeNode lifecycle cleanup while avoiding a separate TilesDB package; vectortile-store remains as the shared schema home.
  Date/Author: 2026-01-04 / Codex

## Outcomes & Retrospective

- Pending. This section will be updated once milestones complete.

## Context and Orientation

Vector tile data is currently written by gis-sdk into TilesDB (packages/features/gis-sdk/src/TilesDB.ts) and queried through runtime-worker’s VectorTileWorkerAPI (getTile/listTiles/getSummary). Shape UI and services also reference TilesDB via runtime-worker for summaries, and shape-plugin has a separate VectorTileDB class for metadata display. Meanwhile, shape/location/route DBs each already contain vectorTiles tables but are not the primary storage location. The plan below consolidates these responsibilities into the per-plugin DBs.

Key files to know:

- packages/features/gis-sdk/src/vectorTiles.ts: vector tile generation, currently stores tiles and metadata in TilesDB.
- packages/runtime-worker/src/types.ts and packages/runtime-worker/src/services/StageProcessingService.ts: vector tile worker API.
- packages/runtime-worker/src/services/vectorTileStageRunner.ts: writes inputs and triggers generateTiles/listTiles.
- packages/features/shape-store/src/ShapeDB.ts: shapeDB schema (currently has vectorTiles but no metadata tables).
- packages/features/location-store/src/LocationDB.ts: locationDB schema (vectorTiles table).
- packages/features/route-store/src/RouteDB.ts: routeDB schema (vectorTiles table).
- plugins/shape-plugin/src/services/database/VectorTileDB.ts: duplicate VectorTileDB and VectorTileDB2 definitions to be consolidated.
- packages/features/vectortile-store: shared base class and metadata schema for per-plugin DBs.

VectorTileDB2 (shape-plugin) currently defines meta, sources, and tileIndex tables for tile indexing. These table definitions will be moved to a shared base class so that all three plugin DBs can provide the same structure.

## Plan of Work

First, define a shared base class that includes the vector tile metadata tables (FeatureMetadataRow, SourceMetadataRow) and the VectorTileDB2 tables (meta, sources, tileIndex). Place this base class in a shared package (to be selected during implementation; avoid circular dependencies). Ensure it exposes strongly typed tables and helper utilities for creating consistent schema names.

Second, update shapeDB, locationDB, and routeDB to extend that base class. Each DB should include a vectorTiles table (existing), plus the new metadata tables. Add schema version bumps and upgrade routines as needed, keeping data loss minimal. Update any code that reads from the old VectorTileDB or TilesDB to read from the per-plugin DB tables instead.

Third, refactor gis-sdk vector tile generation to stop writing to TilesDB. Instead, return generated tiles and feature metadata records to the caller or accept a storage interface passed in via config. Update runtime-worker vector tile worker APIs to use the new path and store tiles via the per-plugin DBs in shape/location/route services or adapters. Update summary/list/get paths to use the per-plugin DB.

Fourth, keep the vectortile-store package as the shared base class and remove only the legacy TilesDB usage and redundant VectorTileDB classes in shape-plugin, repointing them to the new base class tables in shapeDB.

Finally, validate by running a shape build (or minimal unit tests), confirming that tiles and metadata are stored in shapeDB and that deletion of the shape node cleans up the tiles.

## Concrete Steps

All commands should be run from /Users/hiroya/WebstormProjects/hierarchidb unless noted.

1) Inspect current DB definitions and usages.
   - Command: rg "TilesDB|VectorTileDB" -n packages plugins
   - Expected: references in gis-sdk, runtime-worker, shape-plugin VectorTileDB, and vectortile-store package.

2) Implement shared base class and update DB schemas.
   - Edit the chosen shared package file to define the base class and types.
   - Update ShapeDB, LocationDB, RouteDB to extend it and add new tables.
   - Bump schema versions and handle upgrades to avoid data loss where possible.

3) Refactor gis-sdk generation and runtime-worker APIs.
   - Update vectorTiles.ts to remove TilesDB usage.
   - Adjust VectorTileWorkerAPI and StageProcessingService to use the new storage path.
   - Update shape/location/route adapters to write vector tiles into their DBs.

4) Keep vectortile-store and update dependencies.
   - Ensure packages/features/vectortile-store exports the shared base class/types.
   - Remove TilesDB references from package.json and code imports.

## Validation and Acceptance

Run at least one of these validation paths:

- Manual check: run the app, execute a shape build that produces vector tiles, then inspect shapeDB to confirm vectorTiles, featureMetadata, and sourceMetadata are populated. Delete the node and verify these rows are removed.
- Automated check: run pnpm --filter @hierarchidb/shape-plugin typecheck and pnpm --filter @hierarchidb/runtime-worker typecheck to ensure the refactor compiles.

Success criteria:

- Tiles and metadata are stored in shapeDB/locationDB/routeDB and no code references TilesDB.
- vectortile-store package remains and exports the shared base class/types; no TilesDB imports remain.
- TreeNode deletion removes tiles via the per-plugin DBs.

## Idempotence and Recovery

Schema changes should be additive and versioned so they can be re-run safely. If a regression is found, revert the schema changes and restore TilesDB usage; ensure the rollback notes are recorded in TASKS.md.

## Artifacts and Notes

Record any command output for schema migrations or typecheck failures here as they occur.

## Interfaces and Dependencies

The shared base class must expose:

- featureMetadata table: rows matching the existing ShapeFeatureMetadataRow structure.
- sourceMetadata table: rows matching ShapeSourceMetadataRow structure.
- meta, sources, tileIndex tables matching VectorTileDB2 tables.

VectorTileWorkerAPI should continue to expose generateTiles/listTiles/getTile/getSummary, but must now operate on the per-plugin DBs. If a new storage interface is introduced, document its methods and how runtime-worker and plugins supply it.

---
Plan created and awaiting implementation. This ExecPlan will be updated as work proceeds.
