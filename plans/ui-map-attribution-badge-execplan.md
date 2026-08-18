# Add Map Attribution Badges Across ui-map

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repo at `PLANS.md`. Maintain this ExecPlan in accordance with that file.

## Purpose / Big Picture

Users who preview vector tiles from shape, location, or route sources must see the required attribution and license statements on the map. After this change, any screen using `@hierarchidb/ui-map` can render MapLibre’s standard attribution badge with the correct sources, so `/map` and the Step6 previews show the same copyright/license information. This is observable by opening a map view that uses those datasets and seeing the attribution badge appear with the expected sources and license links.

## Progress

- [x] (2026-01-11 05:30 JST) Draft ExecPlan for ui-map attribution badge.
- [x] (2026-01-11 06:10 JST) Review ui-map control points and data source definitions for attribution mapping.
- [x] (2026-01-11 06:35 JST) Implement ui-map attribution helper and control wiring.
- [x] (2026-01-11 06:55 JST) Wire attribution items in shape/location/route previews and `/map`.

## Surprises & Discoveries

- Observation: Location data source IDs used in the UI (`openstreetmap`, `overpass`, `manual`, etc.) do not exist in `LocationDataSourceDefinitions`, which only includes `openstreetmap-overpass` and `openstreetmap-nominatim` plus a subset of sources.
  Evidence: `plugins/location-plugin/src/common/datasources/LocationDataSourceDefinitions.ts` defines `LocationDataSources` without `openstreetmap` or `overpass`.

## Decision Log

- Decision: Implement attribution badges as a standard `@hierarchidb/ui-map` control using MapLibre’s `AttributionControl`, with custom attribution strings built from data source configs.
  Rationale: MapLibre already renders the standard attribution UI; supplying `customAttribution` keeps us within expected MapLibre UX while enabling plugin-specific data sources.
  Date/Author: 2026-01-11 / Codex
- Decision: Add a `resolveLocationAttribution` helper with alias/fallback mappings to cover location data sources that are selectable in the UI but absent from the core definition list.
  Rationale: The map preview and `/map` need attribution for all selectable sources, including `openstreetmap`, `overpass`, `custom`, and `manual`.
  Date/Author: 2026-01-11 / Codex

## Outcomes & Retrospective

Not complete yet. Outcomes will be recorded after implementation.

## Context and Orientation

`@hierarchidb/ui-map` is the shared map UI package. Its `MapLibreMap` component (`packages/ui/map/src/components/MapLibreMap.tsx`) wraps `@vis.gl/react-maplibre` and currently adds navigation/scale/fullscreen/geolocate controls. `ResourceLayerMap` (`packages/ui/map/src/components/ResourceLayerMap.tsx`) composes base maps and vector layers and is the main map used by `/map` and plugin previews. The `/map` page (`app/src/router/routes/map/MapPage.tsx`) obtains vector layers from `useFolderLayers` (`app/src/router/routes/map/useFolderLayers.ts`), which reads tree nodes and supplies `ResourceVectorLayer` entries. The Shape Step6 preview (`plugins/shape-plugin/src/ui/components/steps/ShapePreviewStep.tsx`), the Location Step preview (`plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`), and the Route Step preview (`plugins/route-plugin/src/ui/components/steps/RoutePreviewStep.tsx`) also use `ResourceLayerMap`.

Data source definitions already include attribution and license fields:

- Shape sources are in `plugins/shape-plugin/src/common/types/constants.ts` as `SHAPE_DATA_SOURCES`.
- Location sources are in `plugins/location-plugin/src/common/datasources/LocationDataSourceDefinitions.ts` and adapted into `LOCATION_DATA_SOURCES` in `plugins/location-plugin/src/common/datasources/configs.ts`.
- Route sources are in `plugins/route-plugin/src/common/datasource/configs.ts` as `ROUTE_DATA_SOURCES`.

A “data source” in this plan means the dataset provider selected in the plugin UI (for example `naturalearth` or `openstreetmap`). A “MapLibre attribution badge” means the standard `AttributionControl` UI provided by MapLibre GL JS (the small “i” badge that expands into a list of attributions).

## Plan of Work

First, extend `@hierarchidb/ui-map` with a small attribution API. Add a `MapAttributionItem` type and a helper that formats items into MapLibre `customAttribution` strings. This helper should accept a list of items, remove duplicates by a stable key, and format each entry as a human-readable string with optional links. The formatting rule will be: use `item.attribution` if provided, otherwise `item.label`; if `item.url` exists, render the label as an `<a>` link; if `item.license` exists, append ` (License: <a ...>license</a>)` when `licenseUrl` is provided, otherwise append ` (License: license)`.

Second, add attribution control support to `MapLibreMap`. Extend `controls` to include an optional `attribution` entry with position/compact flags and a list of `MapAttributionItem` entries. In `handleMapLoad`, if `controls.attribution` is enabled, load `maplibre-gl` and attach `new AttributionControl({ compact, customAttribution })`. If the React MapLibre component injects a default attribution control, set `attributionControl={false}` on `ReactMapLibreMap` so we only show the explicit control. This change makes attribution a standard ui-map capability.

Third, thread attribution through `ResourceLayerMap` by adding an `attributionItems` prop (or by passing `controls.attribution.items` directly). This keeps the API consistent with `MapLibreMap` and allows any caller to opt into attribution without custom map wiring.

Fourth, build attribution items for shape, location, and route previews. In each plugin preview step, read the selected data source from the draft (`previewDraft.batchConfig?.dataSource` in shape, `draft.dataSource` in location, `draft.draftData?.dataSourceName` in route) and resolve it to a data source config entry. Convert that config to a `MapAttributionItem` and pass it to `ResourceLayerMap` via the new prop.

Fifth, update `/map` to include attribution for the layers shown. Extend `ResourceVectorLayer` to optionally carry `dataSourceName` (string). In `useFolderLayers`, when building `shapeEntries`, `locationEntries`, and `routeEntries`, read the data source name from the node’s data (`batchConfig?.dataSource`, `dataSource`, and `dataSourceName` respectively) and attach it to each layer. Then in `MapPage`, derive a list of data source names from `vectorLayers`, resolve them to configs using the three data source lists above, and pass the resulting `MapAttributionItem[]` to `ResourceLayerMap`.

Finally, add unit-level guardrails. If no data source can be resolved, omit attribution items (the badge can still render, but should not show empty content). Ensure attribution items are deduplicated across layers and sources.

## Concrete Steps

Run these commands from the repo root (`/Users/hiroya/WebstormProjects/hierarchidb`) as you implement:

1) Inspect and adjust ui-map types and components.
   - Edit `packages/ui/map/src/components/MapLibreMap.tsx` to add attribution control handling and disable default attribution if required.
   - Add a new type file such as `packages/ui/map/src/types/attribution.ts` and export it from `packages/ui/map/src/index.ts`.
   - Update `packages/ui/map/src/components/ResourceLayerMap.tsx` and `packages/ui/map/src/types/unified-map-props.ts` as needed to accept attribution items.

2) Update plugin previews to supply attribution items.
   - `plugins/shape-plugin/src/ui/components/steps/ShapePreviewStep.tsx`
   - `plugins/location-plugin/src/ui/components/steps/LocationMapPreviewStep.tsx`
   - `plugins/route-plugin/src/ui/components/steps/RoutePreviewStep.tsx`

3) Update `/map` layer construction to carry and render attribution.
   - `app/src/router/routes/map/useFolderLayers.ts`
   - `app/src/router/routes/map/MapPage.tsx`

Suggested local validation commands (choose the smallest relevant subset if time-constrained):

- `pnpm --filter @hierarchidb/ui-map typecheck`
- `pnpm --filter @hierarchidb/app typecheck`
- `pnpm --filter @hierarchidb/shape-plugin typecheck`
- `pnpm --filter @hierarchidb/location-plugin typecheck`
- `pnpm --filter @hierarchidb/route-plugin typecheck`

## Validation and Acceptance

Open `/map/<nodeId>` and confirm the attribution badge appears. The badge should list the data sources backing the visible layers, with license text and links where available. Then open the Shape, Location, and Route Step6 previews and verify the badge also appears with the selected data source. For a minimal manual check, pick one dataset with a well-known attribution such as OpenStreetMap and verify “© OpenStreetMap contributors” appears in the badge.

If automated tests are added, run the project’s typecheck commands listed above and confirm they pass. If any test fails due to unrelated workspace state, document the failure in the linked GitHub Issue as `blocked` with the command and error summary.

## Idempotence and Recovery

These changes are additive and safe to re-run. If attribution strings are incorrect or duplicated, adjust the deduplication rule in the helper and rerun validation. Roll back by reverting the ui-map attribution control additions and removing the attribution props from callers.

## Artifacts and Notes

No artifacts yet. Capture short before/after screenshots or console logs when validation is performed.

## Interfaces and Dependencies

The MapLibre attribution control is provided by the `maplibre-gl` module already used by `MapLibreMap`. The new `MapAttributionItem` type should include fields needed to render text and optional links: `id` (string key), `label` (display name), `attribution` (optional override string), `url` (optional), `license` (optional), and `licenseUrl` (optional). The `controls.attribution` option should accept `position` (MapLibre control positions), `compact` (boolean), and `items` (MapAttributionItem[]). Call sites should build items by mapping existing data source config objects into this shape and pass them down; no ui-map component should import plugin data source configs directly.

Plan last updated: 2026-01-11 06:55 JST. Reason: record implementation progress and location attribution discovery.
