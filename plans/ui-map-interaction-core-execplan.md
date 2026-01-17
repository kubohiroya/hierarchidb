# Unify ui-map interaction core for previews and map pages

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repo at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

Users will be able to use the same map interactions in preview screens that they already expect on the /map page: searching, hover proximity lists, selection and box-selection, highlight styling, snackbar hover info, and FitScreen behavior. The goal is that these are first-class ui-map capabilities, not bespoke per-screen logic. After this change, any preview that uses `@hierarchidb/ui-map` can enable or disable each interaction through props, and the Step6 Shape preview will inherit those behaviors without custom wiring. Error rows from Step5 Transform processing will be persisted with the information needed for the Step6 error list, including country/continent names and accurate polygon/ring error counts, and selecting error rows will auto-fit the map view.

## Progress

- [ ] (2026-01-18 14:45 JST) Create interaction-core types, atoms, and hooks in `packages/ui/map/src/preview` that manage hover/search/selection state via Jotai.
- [ ] (2026-01-18 14:45 JST) Add configurable FitScreen/search UI overlays in `ResourceLayerMap` and wire them to the interaction state.
- [ ] (2026-01-18 14:45 JST) Migrate /map route to use the ui-map interaction core and remove the ad-hoc map search atoms.
- [ ] (2026-01-18 14:45 JST) Persist transform error details needed by Step6 and correct error counts and country/continent display using ISO-3166-2.
- [ ] (2026-01-18 14:45 JST) Auto-fit map view on Step6 error selection, then run `pnpm typecheck` and record results.

## Surprises & Discoveries

None yet.

## Decision Log

- Decision: Place the interaction state and atoms inside `@hierarchidb/ui-map`, and expose props to opt in/out of each interaction.
  Rationale: The user wants ui-map to provide these behaviors as a basic feature, with preview screens toggling them on and off.
  Date/Author: 2026-01-18 (assistant)

## Outcomes & Retrospective

Not completed yet.

## Context and Orientation

The /map page currently wires interactions manually in `app/src/router/routes/map/MapPage.tsx`. It uses ui-map hooks like `useMapFeatureSearch`, `useMapFeatureHoverCandidates`, `useMapFeatureSelectionGestures`, and `useMapFeatureHighlights`, plus app-owned Jotai atoms in `app/src/state/mapSearch.atoms.ts`. The Shape Step6 preview uses `ResourceLayerMap` directly but contains its own FitScreen/search UI and error list logic in `plugins/shape-plugin/src/ui/components/step6/ShapePreviewStep.tsx` and `plugins/shape-plugin/src/ui/components/step6/useShapePreviewStep.ts`.

The ui-map package lives in `packages/ui/map/src`. `ResourceLayerMap` is the main component for vector/geojson rendering and already accepts `hoveredFeatures` and a snackbar configuration but does not own the interaction state. The preview hooks in `packages/ui/map/src/preview` implement the low-level interaction behaviors. The error list rows come from `ShapeTransformErrorRecord`, defined in `packages/plugin-service-api/src/types/shapeBuildTypes.ts` and persisted in `packages/features/shape-store/src/EphemeralShapeDB.ts`. Transform errors are collected and stored in `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts`.

## Plan of Work

First, introduce a ui-map interaction core that owns Jotai state for hover candidates (ordered by proximity), search matches, and selection sets. Add a small set of helper utilities that translate MapLibre features into stable keys (source + id) so sets can be stored consistently. Implement a new hook in `packages/ui/map/src/preview` that wires the existing `useMapFeatureSearch`, `useMapFeatureHoverCandidates`, `useMapFeatureSelectionGestures`, and `useMapFeatureHighlights` hooks together, and populates Jotai atoms for hover candidates, hover matches, search matches, and selected matches. Ensure the hook can be enabled or disabled by flags so preview screens can opt in to each interaction.

Next, update `ResourceLayerMap` to optionally render the search field and FitScreen button as ui-map built-ins. The search field should render in the top-left of the map container and execute a search on Enter. The FitScreen button should render below the MapLibre top-right controls, with a vertical offset of 16px from the control group bottom. Both should be configurable through props and work across /map and preview screens. The FitScreen action should fit the map to the bounding box of the currently selected or search-matched features. The search operation should compute the bounding box of matched features and fit the map automatically when Enter is pressed.

Then, migrate `app/src/router/routes/map/MapPage.tsx` to use the new ui-map interaction core and remove dependence on `app/src/state/mapSearch.atoms.ts`. The /map page should rely on ui-map-provided atoms and callbacks for hover/selection/search, and continue to render search settings as needed. Ensure the /map page still highlights hovered/selected/search-matched features and shows its snackbar content.

Finally, improve the Shape Step6 error list and error persistence. Expand `ShapeTransformErrorRecord` in `packages/plugin-service-api/src/types/shapeBuildTypes.ts` to include the data needed to render the error list without loss (country name, continent name, admin name if needed, and accurate error/total counts). Update the transform error persistence in `packages/vt-orchestrator/src/transform/createTransformByBandHandler.ts` so that if error counts are missing or zero during failure, they fall back to total counts. On the UI side, use `@hierarchidb/gen-iso3166-2` to resolve country and continent names from `countryCode` and display them in the error list. Update Step6 preview so that when one or more error rows are selected, the map auto-fits the bounding box of the selected error geometries; this should occur immediately on selection change.

## Concrete Steps

1) Add a new interaction state module under `packages/ui/map/src/preview/`, for example `mapInteractionStore.ts`, that defines:
   - A `MapFeatureKey` string format such as `${source}:${id}`.
   - Jotai atoms for hover candidates, hover match keys, search match keys, selected match keys, and optionally raw features.
   - Helper functions to convert MapLibre features into keys and highlight entries.

2) Implement `useMapInteractionCore` in `packages/ui/map/src/preview` that:
   - Accepts a MapLibre instance, highlight layer IDs, and enable/disable flags.
   - Wires the existing hooks to maintain the atoms.
   - Exposes callbacks and derived values (e.g., fitBounds for matched/selected features).

3) Extend `packages/ui/map/src/components/ResourceLayerMap.tsx` props with an `interaction` section. When enabled, it should:
   - Render a search field overlay in the top-left.
   - Render a FitScreen button below the top-right control group using container-relative positioning.
   - Use `useMapInteractionCore` to manage hover/search/selection and highlight states.
   - Provide a default snackbar renderer that uses feature properties (`name`, `NAME`, `label`, `id`) unless overridden.

4) Update `app/src/router/routes/map/MapPage.tsx` to:
   - Remove direct use of the map search atoms in `app/src/state/mapSearch.atoms.ts`.
   - Adopt the ui-map interaction core and read state from the ui-map atoms or exposed hooks.
   - Keep the search settings dialog in /map but connect it to the ui-map search state.

5) Update transform error persistence:
   - Extend `ShapeTransformErrorRecord` with new optional fields for `countryName`, `continentName`, and admin info if required.
   - Update `createTransformByBandHandler.ts` to populate these fields from available inputs (countryCode, adminLevel, sourceKey) and fix error counts (fallback to totals when errors are present).

6) Update Step6 error table and preview map:
   - Resolve country/continent names using `@hierarchidb/gen-iso3166-2` browser API.
   - Ensure the error counts displayed are consistent with the persisted values.
   - Add a selection effect that auto-fits the map to the selected error geometries.

7) Run `pnpm typecheck` from the repo root and record the exit code in TASKS.

## Validation and Acceptance

Run `pnpm typecheck` in the repository root and confirm exit 0. Manually verify in the UI that:

- /map shows the search field in the top-left and the FitScreen button below the top-right controls with 16px vertical offset.
- Hovering features updates highlights and snackbar content.
- Box selection (modifier + drag) selects features.
- Pressing Enter in the search field fits the map to the matched features.
- Step6 error list displays country/continent names and accurate polygon/ring error counts.
- Selecting error rows auto-fits the Step6 preview map to those geometries.

## Idempotence and Recovery

The changes are additive and can be safely re-run. If issues are found, revert the ui-map interaction core and Step6 changes to return to the previous behavior. No destructive migrations are required.

## Artifacts and Notes

Record in this section any short command output relevant to validation, such as the `pnpm typecheck` success line and any warnings.

## Interfaces and Dependencies

The ui-map package must add Jotai as a peer and dev dependency. The new interaction core should consume:

- `useMapFeatureHoverCandidates`
- `useMapFeatureSearch`
- `useMapFeatureHighlights`
- `useMapFeatureSelectionGestures`

The Shape error persistence must extend `ShapeTransformErrorRecord` and the EphemeralShapeDB stored record. The ISO-3166-2 data must be loaded through `@hierarchidb/gen-iso3166-2` browser helpers so the UI can resolve names without server calls.

Revision note: This initial ExecPlan was created after the user requested ui-map to own FitScreen/search/interaction features and to propagate the behaviors across preview screens.
