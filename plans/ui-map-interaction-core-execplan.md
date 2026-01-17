# Unify ui-map interaction core and shared preview lists for shape/route

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repo at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

Users should get the same map interaction capabilities (FitScreen, search, hover/nearby, selection, highlighting, snackbars, box selection, and Enter-to-fit) everywhere that uses ui-map, not just the /map page. Shape and Route previews should both use ui-map-provided list screens with built-in error columns (Completed/Failed, error counts, messages) rather than bespoke tables. After this change, shape-plugin and route-plugin supply data and configuration only; ui-map owns the layout, interaction state, and list UI, with feature flags on props to enable or disable each behavior.

## Progress

- [x] (2026-01-19 00:30 JST) Reviewed current shape Step6 preview and route preview implementations to confirm where list UI and interaction wiring live.
- [x] (2026-01-19 00:35 JST) Defined shared list screen APIs in ui-map for Shape (Polygon/MultiPolygon) and Route (LineString/MultiLineString) previews, including error column integration.
- [x] (2026-01-19 00:35 JST) Moved shape Step6 list-table logic into ui-map list screens and reduced shape-plugin to minimal data wiring.
- [x] (2026-01-19 00:35 JST) Added route preview list screen wiring using the ui-map shared list component with error columns.
- [x] (2026-01-19 01:25 JST) Updated shared list screens to render in floating windows and ensured error-only rows are included in the Shape feature list.
- [ ] Ensure interaction toggles (search/hover/selection/fit/snackbar/box select/Enter-fit) are wired and configurable from ui-map props for preview screens.
- [x] (2026-01-19 01:10 JST) Ran `pnpm typecheck` and recorded results in TASKS.md.

## Surprises & Discoveries

None yet.

## Decision Log

- Decision: Keep list UI and interaction logic in ui-map, with shape/route providing only data and configuration.
  Rationale: The user explicitly wants ui-map to be the single implementation for FitScreen/search/hover/selection and for shared preview list screens.
  Date/Author: 2026-01-19 (assistant)

## Outcomes & Retrospective

Not completed yet.

## Context and Orientation

The ui-map package lives in `packages/ui/map/src`. It already provides `ResourceLayerMap` for map rendering and `MapPreviewFloatingTable` for floating table UI with optional error/status columns. The shape preview Step6 currently lives in `plugins/shape-plugin/src/ui/components/step6/ShapePreviewStep.tsx` and uses ui-map’s floating table but constructs columns and selection logic locally in `useVectorTilePreviewTable` and `useShapePreviewStep`. The route preview is implemented in `plugins/route-plugin/src/ui/components/steps/RoutePreviewStep.tsx` with a map and custom hover behavior, and it does not use shared list UI today.

The task is to move list screens and interaction wiring into ui-map so that both shape and route previews consume them with minimal configuration. “List screen” here means the floating preview table with search, selection, sorting, and error columns (Completed/Failed status, error count, error message). The error information should be passed in as summary data keyed by feature ID, and the list UI should render the error columns as a built-in option.

## Plan of Work

First, define new ui-map preview list components for shape and route. These components should wrap `MapPreviewFloatingTable` and expose props tailored to each domain: rows, loading/error states, search state, selection state, and error summaries. The goal is to keep the list layout and column definitions inside ui-map rather than duplicating them in each plugin.

Second, move the shape Step6 list-table logic from `plugins/shape-plugin/src/ui/components/step6/useVectorTilePreviewTable.ts` (and any related table formatting) into the new ui-map component. Update shape Step6 to use the ui-map list component and pass only the data and selection/search state. Ensure the error columns are still rendered using the ui-map error summary API.

Third, introduce a route preview list screen in ui-map that can render LineString/MultiLineString metadata and error columns. Update the route preview step to use this ui-map component. Keep any route-specific map toggle UI in route-plugin, but the list should be the shared ui-map component.

Finally, validate that interaction toggles are available through ui-map props for preview screens. The preview list should integrate with the ui-map interaction state so that selection/searching in the list can drive map highlighting and FitScreen when enabled.

## Concrete Steps

1) Add new ui-map preview list components under `packages/ui/map/src/preview/`, for example:
   - `ShapePreviewList.tsx` (Polygon/MultiPolygon list) and
   - `RoutePreviewList.tsx` (LineString/MultiLineString list).

   Each component should wrap `MapPreviewFloatingTable`, define its own columns, and accept a minimal configuration object that includes rows, loading/error flags, search config, selection config, and `errorSummaryById`.

2) Move the shape preview table formatting into `ShapePreviewList`:
   - Port the column definitions and formatting from `plugins/shape-plugin/src/ui/components/step6/useVectorTilePreviewTable.ts`.
   - Keep internationalized labels by accepting a `t` function or by passing labels as props so the plugin can provide translation strings.

3) Update shape Step6 to use `ShapePreviewList` from ui-map:
   - Replace the local `MapPreviewFloatingTable` usage with the new ui-map component.
   - Remove or simplify `useVectorTilePreviewTable.ts` so that shape-plugin no longer owns the column definitions.

4) Create a route preview list screen:
   - Define route list columns that match the line metadata available in route preview (or introduce metadata loader if needed).
   - Ensure it can display the error/status columns using the same `errorSummaryById` API.
   - Update `plugins/route-plugin/src/ui/components/steps/RoutePreviewStep.tsx` to render the list component and connect selection/search state.

5) Ensure the ui-map interaction core can be toggled via props in preview screens:
   - FitScreen, search, hover/nearby list, selection, box selection, snackbar, and Enter-to-fit should remain ui-map responsibilities.
   - Shape/route preview components should pass config flags, not custom event wiring.

6) Run `pnpm typecheck` from the repo root and record the results in `TASKS.md`.

## Validation and Acceptance

Run `pnpm typecheck` in the repository root and confirm exit 0. Manually verify in the UI that:

- Shape Step6 shows the shared ui-map list screen with error columns (Completed/Failed, error count, error message) and continues to reflect selection/search correctly.
- Route preview now shows the shared ui-map list screen for LineString/MultiLineString with the same error column group.
- FitScreen/search/hover/selection/highlight/box selection/snackbar/Enter-to-fit are controlled by ui-map props on preview screens and work without bespoke plugin wiring.

## Idempotence and Recovery

The changes are additive and safe to re-run. If issues are found, revert the ui-map list components and the plugin wiring changes to return to the previous per-plugin list UI and interaction wiring.

## Artifacts and Notes

Record any short command output relevant to validation, including the `pnpm typecheck` success line and any warnings.

## Interfaces and Dependencies

- ui-map will continue to use `MapPreviewFloatingTable` and `GenericDataGrid` for list UI.
- Shape/route previews should pass `errorSummaryById` maps keyed by feature ID to allow error columns in the shared list screens.
- Translation should remain in the plugin layer, so the shared list components should accept label strings or a `t` callback instead of hardcoding UI strings.

Revision note: This ExecPlan was updated to focus on ui-map-owned list screens for Shape and Route previews and to remove the previous Step6 tab-specific assumptions.
Revision note: Progress was updated after shared list screens and a successful typecheck run.
