# Map feature overlays and SSOT state for /map

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` (repository root). Keep this document compliant with those requirements as implementation advances.

## Purpose / Big Picture

After this change, the /map screen clearly distinguishes five feature states: (A) defined features persisted in Dexie, (B) features currently visible in the map viewport, (C) features matched by the map search keyword, (D) features selected by clicking in the map or table, and (E) features hovered in the map or table. The map and the data table show the same status overlays, with the table filtering to only the features visible in the map viewport. A user can verify the result by opening /map for a node, panning the map to change the visible features, typing a search keyword, and hovering/clicking either the map or table to see consistent highlight changes.

## Progress

- [x] (2025-12-29 13:45 JST) Create initial ExecPlan for /map overlay state and table integration.
- [x] (2025-12-29 14:01 JST) Extend Jotai map state atoms to include viewport feature IDs and layer metadata.
- [x] (2025-12-29 14:01 JST) Update /map route to populate layer metadata and viewport feature state, and enrich highlight entries with node info.
- [x] (2025-12-29 14:01 JST) Update modeless data table to filter by viewport state and apply match/hover/selection styles.
- [x] (2025-12-29 14:01 JST) Add row hover/leave callbacks to GenericDataGrid to sync hover state from table to map.
- [ ] (2025-12-29 14:01 JST) Manually verify map/table overlay behavior and record evidence in the linked GitHub Issue.

## Surprises & Discoveries

- Observation: None yet.
  Evidence: N/A.

## Decision Log

- Decision: Track viewport features as a Jotai atom keyed by nodeId and nodeType, with a separate atom for layer metadata.
  Rationale: The table needs nodeId + nodeType to map row IDs to the correct MapLibre source for feature-state updates.
  Date/Author: 2025-12-29 / Codex.

## Outcomes & Retrospective

- Pending.

## Context and Orientation

The /map route is implemented in `app/src/router/routes/map.tsx`. It renders a `ResourceLayerMap` from `@hierarchidb/ui-map`, creates vector layers per nodeId, and uses MapLibre feature-state keys (`hdbSearch`, `hdbHover`, `hdbSelected`) to draw search/hover/selection highlights. Jotai atoms for the search/hover/selection state live in `app/src/state/mapSearch.atoms.ts` and are used by `map.tsx` only.

The modeless data table is implemented in `app/src/router/routes/modeless/modelessDialogContent.tsx` using `GenericDataGrid` from `packages/ui/data-grid/src/GenericDataGrid.tsx`. The data tables pull rows from Dexie-backed stores (`shapeDB`, `RouteDatabase`, `getEphemeralLocationDB`) by nodeId. The GenericDataGrid already supports `matchedRows`, `selectedRows`, and `hoveredRows`, but it does not currently emit row hover events.

To satisfy the requirement, viewport-visible feature IDs (B) must be stored in Jotai and used to filter table rows. Search matches (C), selection (D), and hover (E) should be represented consistently in Jotai and visualized in both the map and table.

## Plan of Work

First, extend `app/src/state/mapSearch.atoms.ts` with new types for node types, layer metadata, and viewport-visible feature IDs. Add Jotai atoms to store the current layer metadata list and viewport feature IDs; keep existing search/hover/selection atoms but enrich their entry type with optional nodeId/nodeType/layerId fields.

Next, update `app/src/router/routes/map.tsx` to derive layer metadata from `vectorLayers` (layerId, sourceId, nodeId, nodeType) and store it in the new atom. Update the highlight entry builder to include nodeId/nodeType when available. Add a viewport tracking effect that queries `mapInstance.queryRenderedFeatures` over the visible canvas area (using the same layer IDs as the highlight system), derives per-nodeId feature ID sets, and writes the result into the viewport atom. Ensure this runs on map load and after map movements.

Then, update `app/src/router/routes/modeless/modelessDialogContent.tsx` to read the new atoms. Filter table data by viewport-visible IDs when the viewport atom has data; otherwise show all defined features. Compute matched/hovered/selected row sets from the Jotai highlight entries for the current nodeId and nodeType. Hook row hover and row click to update hover/selection atoms with the correct sourceId for the layer.

Finally, update `packages/ui/data-grid/src/GenericDataGrid.tsx` to call `onRowHover` and `onRowLeave` on row mouse enter/leave. Use the existing `rowSx` callback in the map table to add the visual styling described by the requirement: matched rows get a background tint, selected rows get a thicker colored outline, and hovered rows get a glow-like shadow. Adjust map hover/selection paint to strengthen the glow for hover without changing the search/selection color scheme.

## Concrete Steps

Work from the repository root (`/Users/hiroya/WebstormProjects/hierarchidb`).

1) Edit `app/src/state/mapSearch.atoms.ts` to add new types and atoms for layer metadata and viewport feature IDs.
2) Edit `app/src/router/routes/map.tsx` to compute and publish layer metadata and viewport feature IDs, and to enrich highlight entries with node metadata.
3) Edit `packages/ui/data-grid/src/GenericDataGrid.tsx` to emit row hover/leave events.
4) Edit `app/src/router/routes/modeless/modelessDialogContent.tsx` to:
   - derive viewport-visible ID sets for the current nodeId,
   - filter table rows based on viewport visibility,
   - compute matched/hovered/selected row ID sets from Jotai state,
   - update hover/selection atoms on row interactions,
   - apply row styling via `rowSx`.

## Validation and Acceptance

Manual verification steps (no automated tests required for this UI-only change):

- Start the app with `pnpm dev`, open `/map/<nodeId>` and confirm the data table appears.
- Pan or zoom the map; the table should update to show only the rows visible in the map viewport.
- Type a keyword in the map search field; matching rows should gain a background tint and matching map features should highlight.
- Hover a table row; the map should show a hover glow on the corresponding feature. Hover a map feature; the table row should reflect the hover styling.
- Click a table row; the map should show the selection outline, and clicking the same row again should clear it. Clicking a map feature should update the selected row.

If manual validation cannot be performed, record that in the linked GitHub Issue with the reason and suggested follow-up.

## Idempotence and Recovery

Changes are additive and safe to reapply. If the viewport filter hides data unexpectedly, disable the filtering by reverting the viewport atom usage in `modelessDialogContent.tsx`. Rollback can be performed by reverting the touched files: `app/src/state/mapSearch.atoms.ts`, `app/src/router/routes/map.tsx`, `packages/ui/data-grid/src/GenericDataGrid.tsx`, and `app/src/router/routes/modeless/modelessDialogContent.tsx`.

## Artifacts and Notes

No artifacts yet.

## Interfaces and Dependencies

- Jotai atoms in `app/src/state/mapSearch.atoms.ts` are the SSOT for map search/hover/selection and the new viewport-visible feature IDs.
- MapLibre feature-state keys remain `hdbSearch`, `hdbHover`, and `hdbSelected` as used in `app/src/router/routes/map.tsx`.
- `GenericDataGrid` must continue to accept `matchedRows`, `selectedRows`, and `hoveredRows` sets and now must emit hover events.

---

Plan created. Next update should record any deviations and progress changes.
