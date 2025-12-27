# Add map search UI, feature-state highlights, and navigation controls

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

Reference: `PLANS.md` in the repository root. Maintain this document in accordance with that file.

## Purpose / Big Picture

Users can now search visible map features by specific attributes, toggle which attributes are searched, and see clear visual highlighting for search matches, hover, and click selection. The map also exposes MapLibre’s navigation (+/− zoom) controls in the top-right corner. These behaviors are visible directly on `/map` once the app is running.

## Progress

- [x] (2025-12-27 06:45Z) Create the ExecPlan, establish file targets, and capture assumptions for search keys and MapLibre feature-state usage.
- [x] (2025-12-27 06:55Z) Implement Jotai atoms for search input and target selection.
- [x] (2025-12-27 07:05Z) Add the search UI (input + clear/settings buttons) and the settings dialog in `app/src/router/routes/map.tsx`.
- [x] (2025-12-27 07:10Z) Add MapLibre controls configuration in the map route.
- [x] (2025-12-27 07:20Z) Implement search matching, hover, and click selection logic using MapLibre feature-state.
- [x] (2025-12-27 07:25Z) Update vector layer paint to reflect highlight states across point/line/polygon layers.
- [ ] (2025-12-27 07:30Z) Record validation evidence in `TASKS.md` and finalize outcomes.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Use MapLibre feature-state keys `hdbSearch`, `hdbHover`, `hdbSelected` for highlight states.
  Rationale: Keeps highlight logic separate from existing styler feature-state (`value`) and allows independent styling.
  Date/Author: 2025-12-27 / Codex

## Outcomes & Retrospective

- Pending.

## Context and Orientation

`app/src/router/routes/map.tsx` renders the `/map` page using `ResourceLayerMap` from `@hierarchidb/ui-plugin-shell/ui-map`. The map currently draws basemap, shape, route, and location vector layers. `packages/ui/map/src/components/MapLibreMap.tsx` supports built-in MapLibre controls via a `controls` prop, but `/map` does not pass it today. Vector layers are created in `app/src/router/routes/map.tsx` and rendered via `packages/ui/map/src/components/VectorTileLayer.tsx`, which calls `map.setFeatureState` for per-feature state. Feature-state is already used by the styler plugin to set a `value` field; this plan adds separate keys to represent search/hover/selection states without clobbering existing state.

## Plan of Work

Edit `app/src/state/mapSearch.atoms.ts` (new file) to store search input text and checkbox selections using Jotai atoms. Update `app/src/router/routes/map.tsx` to render a search input in the top-left corner, with clear and settings buttons inside the input adornment. Implement a settings dialog with checkboxes for the user-specified search targets. When Enter is pressed, query currently rendered features, perform a case-insensitive prefix match against the selected fields, and mark matching features via `map.setFeatureState` with `hdbSearch: true`. On hover, update `hdbHover`, and on click update `hdbSelected`, using the existing MapLibre feature identification approach (queryRenderedFeatures around the pointer). Add MapLibre controls by passing `controls={{ navigation: { position: 'top-right' } }}` to the map component. Update vector layer paint to incorporate highlight states (search/hover/selected) with expressions that override the base color/outline and width/opacity when a highlight is active.

## Concrete Steps

From the repo root:

  - Create `app/src/state/mapSearch.atoms.ts` with Jotai atoms for input text and checkbox selections.
  - Update `packages/ui/map/src/components/ResourceLayerMap.tsx` (if needed) to allow highlight paint overrides to be applied last.
  - Update `app/src/router/routes/map.tsx` to render the search UI, the settings dialog, and to wire up feature-state updates for search, hover, and selection. Also enable MapLibre controls.

## Validation and Acceptance

Run `pnpm --filter @hierarchidb/app typecheck` and expect exit 0. Manually verify in the running app:

  - `/map` shows zoom controls at top-right.
  - Search input appears at top-left with clear/settings buttons.
  - Settings dialog lists the required search targets with checkboxes.
  - Entering a keyword highlights matching features in yellow; hovering brightens the highlight; clicking turns it to the primary color.

## Idempotence and Recovery

Edits are additive and can be re-run safely. To roll back, revert the changes in `app/src/router/routes/map.tsx`, `app/src/state/mapSearch.atoms.ts`, and any map component changes. If feature-state styling causes issues, remove the highlight paint expressions and the event handlers.

## Artifacts and Notes

None yet.

## Interfaces and Dependencies

Use MapLibre’s `queryRenderedFeatures` and `setFeatureState` APIs. Use Jotai `atom` and `useAtom` for search input and target selection state. Use MUI `TextField`, `IconButton`, `Dialog`, `FormGroup`, and `Checkbox` components for UI.

Plan updated 2025-12-27 by Codex: initial plan created for map search UI + feature highlight work.
Plan updated 2025-12-27 by Codex: marked implemented steps as complete and left validation outstanding.
