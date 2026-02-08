# Geometry Engine Wrapper Rollout (turf/geos)

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is maintained in accordance with `PLANS.md` in the repository root. Follow its requirements when editing this document.

## Purpose / Big Picture

We need a single low-level GIS API that can switch between turf and geos-wasm for the entire application, not just the transform stage. After this change, the app will route all turf-like operations through one wrapper in `packages/gis-sdk`, allowing geometryEngine to select turf or geos. This enables consistent behavior across fetch/metadata/transform/VT paths while avoiding ad-hoc turf imports. The user can verify this by running typecheck and inspecting that no direct turf imports remain outside the GIS wrapper.

## Progress

- [x] (2026-02-08 15:43 JST) Drafted ExecPlan and identified the initial target list of turf usages to migrate into the GIS wrapper.
- [x] (2026-02-08 15:45 JST) Added `packages/gis-sdk/src/geometryEngine.ts` and exported it from `packages/gis-sdk/src/index.ts`.
- [ ] Implement turf-backed wrapper functions and move existing turf call sites to the wrapper.
- [ ] Implement geos-backed wrapper functions (using existing geos-wasm wrapper), including kinks → isValid replacement.
- [ ] Update geometryEngine plumbing so all call sites receive an engine selection (transform/fetch/metadata/VT/other).
- [ ] Run typechecks and update TASKS.md with the completed milestones.

## Surprises & Discoveries

- Observation: `@turf/unkink-polygon` is referenced in `packages/gis-sdk/src/processing/geometryExtract.ts` and previously caused install failures; this needs a replacement path or explicit error in geos mode.
  Evidence: `TASKS.md` entries around 2566 indicate `@turf/unlink` resolution failures.

## Decision Log

- Decision: Replace turf kinks usage with `geosIsValid` when geometryEngine is geos, because only validity checks are required in those paths.
  Rationale: Direct kink point extraction is not required for the behavior; validity is sufficient and aligns with geos API.
  Date/Author: 2026-02-08 (assistant)

## Outcomes & Retrospective

Pending.

## Context and Orientation

The application currently imports turf functions directly from various places, including `packages/vt-orchestrator`, `packages/gis-sdk`, and `plugins/shape-plugin`. The goal is to centralize these calls in a new wrapper in `packages/gis-sdk` so all callers can select a geometry engine. The wrapper will expose functions similar to turf functions (area, bbox, bboxClip, simplify, booleanValid, point-in-polygon, cleanCoords), and each function will implement two code paths: turf and geos. For geos, we use the existing geos-wasm wrapper in `packages/gis-sdk/src/geos/index.ts`. We must avoid fallback behavior; if geos lacks a feature, we throw a clear error or implement a geos-based equivalent.

Key files to read:

- `packages/gis-sdk/src/geos/index.ts` (existing geos-wasm wrapper and utilities)
- `packages/gis-sdk/src/config.ts` (geometryEngine type)
- `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`
- `packages/vt-orchestrator/src/transform/geometry.ts`
- `packages/vt-orchestrator/src/vt/vtStage.ts`
- `plugins/shape-plugin/src/services/vt/shapePipelineShared.ts`
- `plugins/shape-plugin/src/services/vt/shapeFetchStage.ts`
- `plugins/shape-plugin/src/services/vt/featureMetadataUtils.ts`
- `plugins/shape-plugin/src/services/vt/fetchGeometryFilters.ts`
- `packages/gis-sdk/src/processing/geometryExtract.ts`
- `packages/gis-sdk/src/processing/featureFiltering.ts`
- `packages/gis-sdk/src/vectorTiles.ts`
- `packages/gis-sdk/src/geocoding.ts`

Terms:

- Geometry engine: A selector (`'turf' | 'geos'`) that determines which implementation backs the GIS wrapper functions.
- GIS wrapper API: A set of functions in `packages/gis-sdk` that expose turf-like behavior and switch implementation based on geometryEngine.
- geos-wasm: The GEOS geometry engine compiled to WebAssembly and exposed by `packages/gis-sdk/src/geos/index.ts`.

## Plan of Work

First, define the GIS wrapper API in a new module (for example `packages/gis-sdk/src/geometryEngine.ts`). It should export functions like `geometryArea`, `geometryBbox`, `geometryBboxClip`, `geometrySimplify`, `geometryIsValid`, `geometryPointInPolygon`, and `geometryCleanCoords`. Each function accepts a `geometryEngine` argument and dispatches to turf or geos. For geos, use `geosArea`, `geosBbox`, `geosClip`, `geosSimplify`, `geosIsValid`, and `geosContains` (for point-in-polygon). For bboxPolygon, build the polygon in JS and pass it to geos functions as needed.

Second, update all direct turf imports across the repo to call this wrapper instead. This includes `packages/vt-orchestrator`, `packages/gis-sdk` internal modules, and `plugins/shape-plugin` VT-related helpers. Replace turf kinks usage with `geometryIsValid` when in geos mode. If any function has no geos equivalent, throw an explicit error in the geos path and document the limitation.

Third, ensure geometryEngine is propagated to all call sites, not only transform. For modules that already receive `TransformConfig`, use `transformConfig.geometryEngine`. For other modules, add a `geometryEngine` parameter or read from existing build config structures where available. Avoid implicit defaults beyond the current `geometryEngine ?? 'turf'` behavior.

Fourth, run typechecks for `@hierarchidb/gis-sdk`, `@hierarchidb/vt-orchestrator`, and `@hierarchidb/shape-plugin`, updating TASKS.md logs as you complete milestones.

## Concrete Steps

1) Create the GIS wrapper module.
   - Add `packages/gis-sdk/src/geometryEngine.ts` with the turf/geos dispatch functions.
   - Export the new wrapper functions from `packages/gis-sdk/src/index.ts`.

2) Replace turf imports at call sites.
   - Update the files listed in Context and Orientation to call the wrapper functions.
   - Remove direct `@turf/*` imports where possible.

3) Propagate geometryEngine across call sites.
   - Add parameters or thread config values to ensure every wrapper call receives a geometryEngine value.

4) Run the required checks.
   - Working directory: repository root.
   - Commands:
     - `pnpm --filter @hierarchidb/gis-sdk typecheck`
     - `pnpm --filter @hierarchidb/vt-orchestrator typecheck`
     - `pnpm --filter @hierarchidb/shape-plugin typecheck`

Expected output (short):

  > @hierarchidb/gis-sdk ... typecheck
  > tsc --noEmit ...

  > @hierarchidb/vt-orchestrator ... typecheck
  > tsc --noEmit ...

  > @hierarchidb/shape-plugin ... typecheck
  > tsc --noEmit ...

## Validation and Acceptance

Validation is complete when all direct turf imports in the listed files are replaced by the GIS wrapper, and the three typecheck commands succeed. Behaviorally, the app should run with geometryEngine set to turf (default) with no user-visible regression. In geos mode, the same operations should succeed unless explicitly noted as unsupported, in which case a clear error must be thrown.

## Idempotence and Recovery

All edits are safe to re-apply. If a step fails, revert the specific file and re-apply the wrapper call in smaller increments. For rollback, revert the wrapper module and restore direct turf imports.

## Artifacts and Notes

At each milestone, capture short diffs or command transcripts in TASKS.md to show the replacements and typecheck outputs.

## Interfaces and Dependencies

- New module: `packages/gis-sdk/src/geometryEngine.ts` exporting turf-compatible wrapper functions.
- Dependencies: existing `@turf/*` packages and `geos-wasm` (already present in `packages/gis-sdk/src/geos/index.ts`).
- Function signatures should accept `geometryEngine: 'turf' | 'geos'` and the minimum necessary GeoJSON types to avoid widening types.

Plan change note: Initial plan created to implement the geometryEngine wrapper and replace direct turf usage across the app, with kinks replaced by geos validity checks.
