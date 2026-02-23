# Build a Neighbor-Graph & Tolerance-Optimization Pipeline for geoBoundaries Shapes

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repo at `PLANS.md`. This document must be maintained in accordance with that file.

## Purpose / Big Picture

Enable a deterministic pipeline that starts from geoBoundaries source geometry and produces vector-tile stages with minimal shape collapse while preserving seam continuity across borders. After implementation, users can generate country geometries, border adjacency relationships, and per-zoom outputs with tunable simplification. The result should allow running tasks with per-task config overrides that automatically reduce overflow and deformation risk instead of requiring manual trial-and-error.

This plan also produces a machine-generated seed for per-data-source and per-zoom tolerance strategy, so the same border always simplifies consistently when retried.

## Progress

- [ ] (2026-02-23 10:00 JST) Drafted API and storage design for country geometry catalog, tile inversion index, border-arc catalog, and neighbor graph construction.
- [ ] (2026-02-23 10:20 JST) Added implementation ownership decisions for existing vs new modules and Dexie schema extension points.
- [ ] (2026-02-23 10:40 JST) Added quality-gate and candidate-filter milestone for symmetry checks, endpoint handling, and arc simplification validation.
- [ ] (2026-02-23 11:00 JST) Added incremental migration plan to consume generated tolerance recommendations and apply minimal task overrides.
- [ ] (2026-02-23 11:30 JST) Added validation and acceptance criteria plus safe rollback steps.

## Surprises & Discoveries

- Observation: geoBoundaries preprocessing currently optimizes for transform/vt throughput, not globally shared-border consistency.
  Evidence: existing flow has no explicit border-arc identity or shared boundary canonical source.
  Planned response: add arc-level persistence and shared-reference links before simplification.

- Observation: many existing utilities can read/write geometry and manage caches, but no API composes boundary graph lifecycle with quality gates.
  Planned response: introduce an orchestration module dedicated to "country boundary graph + arc catalog + inverse tile index".

## Decision Log

- Decision: Place the new APIs in a dedicated geometry utility package under `packages` and expose only deterministic pure functions at the package boundary.
  Rationale: keeps CLI/UI logic independent from border topology details and allows reuse by future shape data sources.
  Date/Author: 2026-02-23 (Codex)

- Decision: Store only canonicalized arc IDs and neighbor refs, never duplicate simplified border coordinates per country side.
  Rationale: guarantees seam continuity and minimises storage growth.
  Date/Author: 2026-02-23 (Codex)

- Decision: Add strict optional validation flags on simplification API (`validateNoSelfIntersection`, `validateNoNeighborIntersection`) with a fail mode strategy.
  Rationale: pipeline needs explicit safety policy before writing finalized cache records.
  Date/Author: 2026-02-23 (Codex)

## Outcomes & Retrospective

- Not completed yet.

## Context and Orientation

This repository already has:
- shape fetch/transform/vt stages (`plugins/shape-plugin` and `packages/vt-orchestrator`)
- existing caches in Dexie wrappers for stage results
- multiple utilities for geometry decode, topology handling, and persistence.

There is no consolidated API layer that accepts `(dataSource, adminLevel, countrySet, format, fn)` and returns a typed per-country processing stream, and no authoritative arc-level catalog that ties together:
- country boundaries
- shared-border pairs
- tile intersection indexes
- simplification versions with cross-reference metadata.

The plan below adds this layer and connects it to a candidate-tolerance evaluator and task override applier.

## Proposed Functions

1. `iterateCountryGeometriesBySource`
   Brief: Iterate countries filtered by data source, administrative level, country codes, and format, and execute a callback with country shape geometry.
   Status: to implement

2. `saveCountryGeometryArtifact`
   Brief: Persist country geometry as an artifact keyed by data source/admin-level/country code/format.
   Status: to implement

3. `loadCountryGeometryArtifact`
   Brief: Resolve persisted country geometry artifact by data source/admin-level/country code/format.
   Status: to implement

4. `buildTileInvertedIndexForCountries`
   Brief: Generate inverted indexes for each tile at each zoom, listing intersecting country feature IDs.
   Status: to implement

5. `getMinCoveringZoomTileForCountry`
   Brief: Return the minimal zoom tile coordinate that encloses a country's geometry.
   Status: to implement

6. `getCountriesByTile`
   Brief: Return all country codes intersecting a tile coordinate.
   Status: to implement

7. `listCandidateAdjacentCountries`
   Brief: Return countries that are geographically near or adjacent (candidate set, not strict boundary test).
   Status: to implement

8. `listDirectAdjacentCountries`
   Brief: Return countries that actually share boundary length > 0 with the target country.
   Status: to implement

9. `extractBoundaryArcsByCountry`
   Brief: Emit minimal arc sets for coastlines and shared borders, then persist each arc ID and geometry.
   Status: to implement

10. `simplifyBoundaryArc`
   Brief: Simplify arc geometry excluding endpoints using a tolerance and optionally keep peer references when already simplified on the opposite side.
   Status: to implement

11. `assembleCountryGeometryFromArcs`
   Brief: Recompose each country polygon from simplified coastline and border arcs.
   Status: to implement

## Implementation-Reuse Mapping (✅ existing / ⭕️ external / 🚧 new)

- `iterateCountryGeometriesBySource`: 🚧
- `saveCountryGeometryArtifact`: 🚧
- `loadCountryGeometryArtifact`: 🚧
- `buildTileInvertedIndexForCountries`: 🚧
- `getMinCoveringZoomTileForCountry`: 🚧 (use existing tile-utils concepts as reference)
- `getCountriesByTile`: 🚧
- `listCandidateAdjacentCountries`: 🚧 (use bbox-index optimization from existing geometry helpers)
- `listDirectAdjacentCountries`: 🚧
- `extractBoundaryArcsByCountry`: 🚧
- `simplifyBoundaryArc`: ⭕️/🚧
  - `@turf/simplify` and similar topology helpers can be leveraged, but cross-country seam retention logic and validation are new.
- `assembleCountryGeometryFromArcs`: 🚧

## Dexie Schema Plan (✅ reusable / 🚧 new or modified)

- Reuse existing cache infrastructure for raw artifacts only if existing key model supports compound keys for `(dataSource, adminLevel, countryCode, format, zoomBand, tileCoord)`; otherwise add tables.
- Add or modify schema for border-aware storage:
  - `countryShapeArtifacts` table
  - `countryTileIndex` table (tile -> country codes)
  - `countryToTileRange` table (country -> covering zoom range)
  - `countryNeighbors` table
  - `arcCatalog` table
  - `arcGeometries` table
  - `countryArcs` table (country -> arc IDs + role tags)
  - `simplifiedArcs` table (arc version, tolerance, validations, source references)
  - `countryAssembledShape` table (assembled geometry snapshots + provenance)

- If only a subset exists and can be reused safely, schema extension is minimal:
  - add `sourceKind`, `adminLevel`, `format`, `zoomBand`, `tileZ`, `tileX`, `tileY` indexes.
  - keep raw caches immutable and add `materialized` tables for derived indexes.

## Plan of Work

Phase 1: API and storage definition.
Define the new package surface, DTOs, and Dexie schema by concrete file name. Start with pure functions that do not mutate worker state. Ensure every function signature is versioned with clear return shapes and error contracts.

Phase 2: Ingestion and indexing.
Implement `iterateCountryGeometriesBySource`, artifact save/load, and tile inversion index builders. Ensure tile coverage is deterministic across repeated runs of the same source and zoom band.

Phase 3: Adjacency and arc extraction.
Build border extraction for candidate and strict adjacency with topology checks. Persist arc IDs with canonical orientation and endpoint normalization, including foreign-country attribution for cross-border arcs.

Phase 4: Simplification with seam constraints.
Implement `simplifyBoundaryArc` with options:
- `validateNoSelfIntersection`
- `validateNoNeighborIntersection`
- `onValidationFail` strategy (`throw`, `skip`, `fallback`)
Generate recommended tolerance candidates per `(dataSource, adminLevel, country, zoomBand)` and store evaluation metadata.

Phase 5: Assembly and override feedback.
Build `assembleCountryGeometryFromArcs` and collect acceptance metrics (`max vertex count`, `self-intersection count`, `topology mismatch`, `coverage gap`) before writing final stage-ready payloads.
Then feed metrics into task-level override generator to emit minimum changes for completed tasks.

Phase 6: Integration dry-run and rollout.
Add a dry-run path that compares current pipeline output quality before/after simplification and emits a report sorted by task impact.

## Concrete Steps

Run commands from repository root `/Users/hiroya/WebstormProjects/hierarchidb`.

1. Create library scaffolding:
   - Add a new package module under `packages/` for boundary graph APIs.
   - Add exports only through package top-level entry points.

2. Define DTOs and schemas:
   - Add type files and Dexie schema definitions for the tables above.
   - Add migration-safe schema versioning.

3. Implement ingestion and indexing functions:
   - Implement iterate/save/load plus tile inversion in incremental batches.
   - Add deterministic dedup by country+source+format+version hash.

4. Implement adjacency and simplification functions:
   - Implement candidate adjacency and strict adjacency separately.
   - Implement arc extraction and simplified arc persistence with validation options.

5. Implement assembler and evaluator:
   - Rebuild polygon from arc slices.
   - Emit validation report and preferred tolerance suggestions.

6. Wire to task overrides:
   - Add a utility to propose per-task override maps with minimal edits.
   - Apply only for eligible tasks with a feature flag and write rollback metadata.

7. Add docs and acceptance harness:
   - Add docs for API functions, expected storage format, and validation outputs.
   - Add smoke checks that prove:
     - no seam gaps in sampled adjacent country pairs
     - no self-intersection in simplified arcs when strict mode enabled
     - no cross-arc intersections for immediate neighbors in strict mode

8. Run checks after implementation:
   - `pnpm lint`
   - `pnpm typecheck`
   - `pnpm test`

## Validation and Acceptance

- Given a small set of countries with known adjacency (e.g. Japan, US, Canada), generate an arc catalog.
- With strict validation enabled, simplification runs should reject candidate tolerances that create self-intersections.
- Rebuilding from arcs should produce polygons whose seam coverage for direct neighbors has zero unmatched shared segments.
- Generated recommendations should reduce overflowed transform/vt tasks and lower deformation metrics without reducing tile completion rates.
- The override output should mark only completed tasks as affected when run in dry-run first.

## Idempotence and Recovery

All outputs are content-addressed by `(source, adminLevel, countrySet, format, zoomBand, tolerance profile, validation policy)` hash. Re-running with same inputs must produce identical artifact IDs. If schema migration fails, stop and fallback to read-only mode for old tables.

## Artifacts and Notes

- Keep raw country geometry immutable.
- Persist simplified arc versions separately to avoid mutating source geometries.
- Avoid lossy rounding until final vector-tile export stage.

## Interfaces and Dependencies

- Input types: `dataSource`, `adminLevel`, `countryCode`, `format`, `zoomBand`, `tileCoord`, `tolerance`, `validationPolicy`.
- Core dependency candidates: shapely-like geometry ops (`@turf/*`) and robust line simplification + topology checks (external where available), but border identity and seam reconciliation logic remain first-party.
- Storage contract: Dexie tables must support both direct lookup and reverse lookup to avoid expensive scans on task override generation.

Updated 2026-02-23: Added to plan by integrating adjacency-graph and tolerance-optimization proposals for geoBoundaries-driven shape pipeline.
