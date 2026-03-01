# Add layered vector tile sets for map and shape preview

This ExecPlan is a living document. The sections Progress, Surprises & Discoveries, Decision Log, and Outcomes & Retrospective must be kept up to date as work proceeds.

This ExecPlan must be maintained in accordance with PLANS.md at PLANS.md.

## Purpose / Big Picture

Users need layer sets that do not depend on admin level names, can be toggled in the UI, and apply to both /map and shape preview. A layer set groups multiple layers (for example admin boundaries and fills) and renders them in a defined order so higher priority entries draw on top. The same priority must drive hover and selection so the topmost logical layer wins. After this change, the map page and the shape preview both let the user toggle which layer sets are visible, and both show a grouped list of active layer entries organized by kind and hierarchy. The user can verify the behavior by opening /map and shape preview, toggling layer sets, and seeing the list and hover/selection follow the expected priority.

## Progress

- [x] (2026-01-22 20:05 JST) Draft ExecPlan and confirm target files and data flow.
- [x] (2026-01-22 20:23 JST) Update plan to include UI toggles for /map and shape preview plus grouped list.
- [ ] Implement layer set definitions, resolution utilities, and priority ordering.
- [ ] Add layer set toggle UI and grouped list UI to /map and shape preview.
- [ ] Run pnpm typecheck and record results in TASKS.md.

## Surprises & Discoveries

- Observation: None yet.
  Evidence: N/A

## Decision Log

- Decision: Use tileEmitConfig.layerSetName as the logical selector for shape layer set definitions rather than requiring admin0/admin1 names.
  Rationale: Decouples UI configuration from admin level names while preserving the existing tileEmitConfig field as the selector.
  Date/Author: 2026-01-22 / Codex
- Decision: Apply layer set priority to hover and selection by sorting candidate features with a layer priority map rather than relying only on MapLibre render order.
  Rationale: Ensures consistent priority even when point-distance sorting is used or layer order differs.
  Date/Author: 2026-01-22 / Codex

## Outcomes & Retrospective

- Pending. This will be updated after implementation.

## Context and Orientation

The shape preview is implemented in plugins/shape-plugin/src/ui/components/step6/ShapePreviewStep.tsx and useShapePreviewStepView.ts. It renders a ResourceLayerMap from packages/ui/map, which accepts a list of ResourceVectorLayer entries. Each ResourceVectorLayer defines a layerConfig with sourceLayer, layerType, and styling. The current implementation resolves admin0/admin1 from tileLayerNames and uses tilesLayer as a fallback; this couples the preview to admin-level names.

The map page (/map) renders ResourceLayerMap in app/src/router/routes/map/MapPage.tsx. Modeless dialogs in app/src/router/routes/modeless/ModelessDialogManager.tsx and modelessDialogContent.tsx show layer lists and toggles. useFolderLayers.ts builds ResourceVectorLayer entries for shape and route and GeoJSON layers for location.

A layer set in this plan means: a logical group (location/route/shape) with an ordered list of entries. For shape, entries map to admin{N} and admin{N}-boundary layers. For route and location, entries map to the route vector layer and location GeoJSON layers. The order controls render priority and interaction priority. The grouped list UI must show items grouped by kind (location/route/shape) and by hierarchy level where available (for shape: ADM0/ADM1/ADM2).

## Plan of Work

First, introduce a shared layer set definition module in packages/ui/map that defines layer sets and can resolve concrete sourceLayer names from tileLayerNames. It will expose a resolver that returns ordered entries with layerType, boundary flag, and resolved sourceLayer names. The resolver must accept tileLayerNames and return the expected admin layer names even when tileLayerNames are not yet discovered.

Second, add layer set metadata to ResourceVectorLayer and ResourceGeoJsonLayer so each map layer knows which layer set it belongs to and its hierarchy level. Update ResourceLayerMap ordering logic to sort by layer set priority first, then path.

Third, update map interaction hooks (useMapFeatureHoverCandidates and useMapFeatureSelectionGestures) to accept an optional layerPriority map (layerId -> priority) and sort candidate features by priority before applying distance sorting. Update ResourceLayerMap to build that map from vector/geojson layers and pass it to the interaction hooks.

Fourth, implement UI toggles for layer sets on /map and shape preview. On /map, add a modeless dialog section for layer set visibility and a grouped list of active layer entries. On shape preview, add a small floating panel near the map that offers layer set visibility toggles (at minimum the "shape" set) and shows the grouped list for the active entries.

Finally, update the vector layer construction in useShapePreviewStepView.ts to use the layer set resolver and respect the visibility toggles so the layer set does not depend on admin level names. Ensure existing preview behavior (metadata list, selection, hover) still functions.

## Concrete Steps

1) Add layer set definitions and resolver.
   - Create packages/ui/map/src/preview/layerSetDefinitions.ts and export it from packages/ui/map/src/index.ts.
   - Define layer sets for location, route, and shape with ordered entries. For shape, include admin0/admin1/admin2 boundary and fill entries.
   - Add a resolver function that maps entries to concrete sourceLayer names using tileLayerNames when available, or the expected admin layer names when not.

2) Extend layer models with layer set metadata and priority.
   - Update ResourceVectorLayer and ResourceGeoJsonLayer types to include layerSetId, hierarchyLevel (optional), and layerPriority.
   - Update ResourceLayerMap ordering so it sorts by layerPriority first, then path.
   - Build a layerPriority map keyed by layerId for interaction hooks.

3) Apply layer priority to hover and selection.
   - Update useMapFeatureHoverCandidates and useMapFeatureSelectionGestures to accept an optional layerPriority map and sort resolved features accordingly (priority first, then distance for point layers within the same priority).
   - Wire this through ResourceLayerMap when interaction is enabled.

4) Add layer set toggle UI and grouped list UI.
   - In app/src/router/routes/modeless/modelessDialogContent.tsx, add a new panel or extend MapLayerContent to include layer set toggles and a grouped list of active entries.
   - In app/src/router/routes/modeless/ModelessDialogManager.tsx, pass the layer set visibility state and handlers.
   - In plugins/shape-plugin/src/ui/components/step6/ShapePreviewStep.tsx, add a small floating panel with layer set toggles and a grouped list of resolved entries.

5) Update shape preview layer generation.
   - Update plugins/shape-plugin/src/ui/components/step6/useShapePreviewStepView.ts to read layerSetName from buildConfig.tileEmitConfig.layerSetName (default to "shape" only if missing).
   - Use the layer set resolver to build ResourceVectorLayer entries in the defined order and respect visibility toggles.

6) Run pnpm typecheck and record the results in TASKS.md.

## Validation and Acceptance

- /map shows a UI control for layer set visibility and a grouped list of active entries (location/route/shape, with ADM0/ADM1/ADM2 for shape).
- Shape preview shows the same toggle and grouped list UI and renders vector tiles without needing layerSetName to be admin0/admin1.
- Hover and selection prioritize higher layers (location > route > shape) consistently.
- pnpm typecheck exits 0.

## Idempotence and Recovery

The changes are additive and can be re-run safely. To rollback, revert the layer set module, the metadata fields on ResourceVectorLayer/ResourceGeoJsonLayer, and the UI additions, restoring the previous admin0/admin1 resolution behavior.

## Artifacts and Notes

- Example grouped list entries:
  - Location: points
  - Route: line
  - Shape: ADM0 boundary, ADM0 fill, ADM1 boundary, ADM1 fill, ADM2 boundary, ADM2 fill

## Interfaces and Dependencies

- New exported types from packages/ui/map/src/preview/layerSetDefinitions.ts:
  - LayerSetDefinition: { id: string; label: string; priority: number; entries: LayerSetEntry[] }
  - LayerSetEntry: { id: string; adminLevel?: number; boundary?: boolean; layerType: 'line' | 'fill' | 'circle' | 'symbol' }
  - ResolvedLayerSetEntry: { id: string; layerSetId: string; hierarchyLevel?: number; sourceLayer?: string; layerType: 'line' | 'fill' | 'circle' | 'symbol'; boundary?: boolean; priority: number; label: string }
  - resolveLayerSetEntries(tileLayerNames: string[], layerSet: LayerSetDefinition): ResolvedLayerSetEntry[]

- ResourceVectorLayer and ResourceGeoJsonLayer must include optional layerSetId, hierarchyLevel, and layerPriority to drive ordering and UI grouping.

Change Log: Updated on 2026-01-22 to include UI toggles for /map and shape preview, grouped list UI, and hover/selection priority requirements.
