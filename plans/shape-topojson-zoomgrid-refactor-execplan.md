# Consolidate TopoJSON grid quantization and zoom band settings

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repository root at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, the codebase will have a single reusable utility for quantizing TopoJSON vertices onto a global grid based on zoom level, and a single reusable set of helpers for zoom band settings that accounts for both the globally persisted “common zoom bands” and per-ShapeEntity overrides. This reduces duplication across the shape pipeline and UI while keeping TopoJSON processing consistent wherever it is invoked. Success can be observed by the TopoJSON transform path using the shared quantization utility, and by all zoom band consumers resolving through the unified helper without re-implementing boundary normalization.

## Progress

- [x] (2026-01-26 17:38 JST) Draft ExecPlan and identify all call sites for zoom band boundaries, tree console settings, and TopoJSON decoding.
- [x] (2026-01-26 17:43 JST) Create shared zoom band helper module in `packages/util/src/zoomBandSettings.ts`, update `packages/util/src/treeConsoleSettings.ts`, and rewire shape-plugin imports.
- [x] (2026-01-26 17:43 JST) Implement TopoJSON grid quantization utility in `packages/vt-orchestrator/src/transform/topojsonGrid.ts`, export it, and apply it in `createTransformByBandHandler`.
- [x] (2026-01-26 17:50 JST) Add a local `topojson-server` type shim in `packages/vt-orchestrator/src/types` to unblock TypeScript builds.
- [ ] Run required builds/typechecks (`pnpm typecheck`, plus package builds if needed) and record outcomes (blocked by ui-map unused variables).
- [x] (2026-01-26 17:50 JST) Update this ExecPlan with outcomes, decisions, and retrospective.

## Surprises & Discoveries

- Observation: `pnpm typecheck` fails due to unused variables in ui-map, unrelated to this refactor.
  Evidence: `packages/ui/map/src/components/ResourceLayerMap.tsx` unused imports/vars (`FloatingWindow`, `statsDisplay`, `statsWindowTitle`, `statsWindowState`, `statsWindowProps`).

## Decision Log

- Decision: Centralize zoom band helpers in `packages/util/src/zoomBandSettings.ts` and adapt tree console settings to use aliases.
  Rationale: util is already the shared dependency for persisted UI settings and shape-plugin defaults, so it avoids new package dependencies while removing duplicated normalization logic.
  Date/Author: 2026-01-26 (assistant).

- Decision: Implement TopoJSON grid quantization in `@hierarchidb/vt-orchestrator` and invoke it during transform decode.
  Rationale: vt-orchestrator already depends on topojson-client/server and owns the transform stage, allowing reuse from shape-plugin without adding new external dependencies to util or gis-sdk.
  Date/Author: 2026-01-26 (assistant).

- Decision: Align `ZOOM_BAND_MIN_RANGES` with the shape pipeline requirement (minimum 1 range).
  Rationale: shape-plugin validation previously required at least one range; keeping the minimum at 1 avoids producing empty band sets that would break transform scheduling.
  Date/Author: 2026-01-26 (assistant).

- Decision: Add a local `topojson-server` ambient module declaration for vt-orchestrator.
  Rationale: `topojson-server` does not ship types; local shim avoids polluting global types while keeping builds green.
  Date/Author: 2026-01-26 (assistant).

## Outcomes & Retrospective

- Implemented shared zoom band helpers in `@hierarchidb/util` and rewired shape UI and defaults to use them.
- Added a TopoJSON grid quantization helper and applied it during transform decode before simplification.
- `pnpm --filter @hierarchidb/util build`, `pnpm --filter @hierarchidb/gis-sdk build`, `pnpm --filter @hierarchidb/vt-orchestrator build`, and `pnpm --filter @hierarchidb/shape-plugin typecheck` completed with tsdown warnings only.
- `pnpm typecheck` is still blocked due to pre-existing ui-map unused variable errors; needs resolution outside this task before workspace-wide green.

## Context and Orientation

The shape plugin’s build pipeline is driven by `plugins/shape-plugin/src/services/vt/shapePipeline.ts`, which calls the fetch, transform, and vt stages in order. Zoom band boundaries are currently normalized in two separate places: `plugins/shape-plugin/src/common/config/zoomBands.ts` for shape-specific usage and `packages/util/src/treeConsoleSettings.ts` for globally persisted UI settings. TopoJSON decoding and simplify logic for transform runs inside `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`, which currently does not apply a shared grid-snap utility for TopoJSON before simplification.

Key files involved:

- `plugins/shape-plugin/src/common/config/zoomBands.ts` (zoom band boundary normalization for shape plugin).
- `packages/util/src/treeConsoleSettings.ts` (persisted common zoom band settings for UI).
- `plugins/shape-plugin/src/ui/components/step4/ZoomBandConfigSection.tsx` and `plugins/shape-plugin/src/ui/components/step4/useShapeBuildConfigStep.ts` (apply common zoom bands and defaults).
- `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` (TopoJSON decode and simplify during transform).
- `packages/vt-orchestrator/src/transform/geometry.ts` (grid snap helpers, currently internal).

“Common zoom bands” means the globally persisted zoom band boundaries stored in `localStorage` via `packages/util/src/treeConsoleSettings.ts`. “Per-ShapeEntity zoom bands” refers to the `transformConfig.zoomBandBoundaries` stored in each Shape entity’s build config.

## Plan of Work

Create a new shared zoom band settings module at `packages/util/src/zoomBandSettings.ts` that includes constants, normalization, range building, and a resolver that can combine common (persisted) boundaries with per-entity overrides. Update `packages/util/src/treeConsoleSettings.ts` to reuse this helper and keep its existing public constants as aliases to the shared constants. Replace shape-plugin imports so that `plugins/shape-plugin/src/common/config/zoomBands.ts` is no longer the source of truth; migrate its consumers to import from `@hierarchidb/util` instead. Use the resolver helper in `ZoomBandConfigSection` and `useShapeBuildConfigStep` so the common-vs-entity relationship is expressed consistently.

Implement a TopoJSON grid-quantization utility in `packages/vt-orchestrator/src/transform/topojsonGrid.ts`. This helper should accept a Topology plus a zoom target and quantize factor, convert each TopoJSON object to a FeatureCollection, snap each geometry onto the zoom-dependent grid via `snapGeometryToGrid`, and re-emit a Topology with `topojson-server`. Export this helper from `packages/vt-orchestrator/src/index.ts`. Update `createTransformByBandHandler.ts` so that `decodeTopoJsonFetchCache` quantizes the topology before running `simplifyTopoJsonByZoom`.

Finally, run the project’s typecheck and any necessary builds. Record outputs and update the ExecPlan’s progress, decision log, and outcomes.

## Concrete Steps

Run all commands from the repo root ` /Users/hiroya/WebstormProjects/hierarchidb `.

1) Create `packages/util/src/zoomBandSettings.ts` and add constants, normalization functions, range builders, and a resolver returning `{ boundaries, source }` for common vs per-entity settings.

2) Update `packages/util/src/treeConsoleSettings.ts` to import the new shared constants and normalization helpers. Keep existing `TREE_CONSOLE_*` exports as aliases so external imports remain stable.

3) Update `packages/util/src/index.ts` to export the new zoom band helpers.

4) Replace shape-plugin imports of `plugins/shape-plugin/src/common/config/zoomBands.ts` with the new utility exports, and update `ZoomBandConfigSection` / `useShapeBuildConfigStep` to use the resolver helper.

5) Add `packages/vt-orchestrator/src/transform/topojsonGrid.ts` implementing TopoJSON grid quantization, export it from `packages/vt-orchestrator/src/index.ts`, and integrate it into `decodeTopoJsonFetchCache` in `createTransformByBandHandler.ts`.

6) Run:

   - `pnpm typecheck`

Record output in the ExecPlan.

## Validation and Acceptance

Acceptance is achieved when:

- TopoJSON transform decoding applies a shared grid-quantization utility before simplification (verified by reading `createTransformByBandHandler.ts` and the new utility file).
- Zoom band boundaries are normalized through a single shared module and the UI uses the resolver helper for common vs per-entity settings.
- `pnpm typecheck` exits 0. Log the command output and any warnings.

## Idempotence and Recovery

All changes are additive refactors. Re-running the normalization or quantization logic is safe and should not mutate stored data. If any import change breaks runtime, revert to the prior imports and re-run `pnpm typecheck` to isolate the failure.

## Artifacts and Notes

Capture short command transcripts for `pnpm typecheck` and any warnings about `tsdown` or peer dependencies.

## Interfaces and Dependencies

The new zoom band helper module should export:

- `ZOOM_BAND_MIN_ZOOM`, `ZOOM_BAND_MAX_ZOOM`, `ZOOM_BAND_MIN_RANGES`, `ZOOM_BAND_MAX_RANGES`, `DEFAULT_ZOOM_BAND_BOUNDARIES`.
- `normalizeZoomBandBoundaries(boundaries, minZoom?, maxZoom?, maxRanges?)`.
- `buildEvenZoomBandBoundaries(rangeCount, minZoom?, maxZoom?)`.
- `buildZoomBandRanges(boundaries, minZoom?, maxZoom?)`.
- `resolveZoomBandSettings({ commonBoundaries, entityBoundaries, preferCommon?, fallbackBoundaries? })` returning `{ boundaries, source }`.
- `areZoomBandBoundariesEqual(a, b)` for UI comparisons.

The TopoJSON grid utility should expose:

- `quantizeTopoJsonToGrid(topology, { zTarget, quantize? })` returning a Topology with snapped vertices.

No new runtime dependencies beyond existing `topojson-client` and `topojson-server` in `@hierarchidb/vt-orchestrator` are required.

## Plan Updates

This plan was created to consolidate TopoJSON grid quantization and zoom band helpers into reusable modules. Update the Progress and Decision Log as implementation proceeds.
