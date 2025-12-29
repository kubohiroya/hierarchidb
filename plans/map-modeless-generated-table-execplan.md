# Add generated data tables to map modeless dialogs

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan is governed by `PLANS.md` in the repository root and must be maintained accordingly.

## Purpose / Big Picture

After this change, the map page can show generated outputs for shape, location, and route as virtualized tables inside a new modeless dialog. A user can open `/map/<nodeId>`, bring up a “Data Table” window, switch between Shape/Location/Route tabs, and search within each table using the built-in table search field. This makes it possible to inspect generated data without leaving the map.

## Progress

- [x] 2025-12-29 14:05 JST Added the task to `TASKS.md` with DoD, rollback, and a start log entry.
- [x] 2025-12-29 14:15 JST Drafted this ExecPlan file in `plans/map-modeless-generated-table-execplan.md`.
- [x] 2025-12-29 14:35 JST Implemented the new modeless dialog content and data loading hooks.
- [x] 2025-12-29 14:50 JST Added pagination controls for shape/route tables when more than 1000 rows are loaded.
- [ ] Validate manually on `/map/<nodeId>` and record results in `TASKS.md`.

## Surprises & Discoveries

No surprises yet.

## Decision Log

- Decision: Use `@hierarchidb/ui-grid`’s `GenericDataGrid` to provide virtualization and the built-in search field.
  Rationale: The grid already renders a search input and supports virtualization without extra UI work, which aligns with the requirement to add a search field over each table.
  Date/Author: 2025-12-29 / Codex

- Decision: Source Shape data from `shapeDB.features`, Route data from `RouteDatabase.lineStrings`, and Location data from the tabular store via `TabularQueryService` with the session’s `tableId`.
  Rationale: These are the existing persisted artifacts for each plugin and can be accessed in the UI without adding new worker APIs.
  Date/Author: 2025-12-29 / Codex

- Decision: Show footer pagination for Shape and Route when more than 1000 rows are loaded, using `GenericDataGrid` pagination (non-virtualized mode).
  Rationale: The requirement asks for page navigation after 1000 rows; `GenericDataGrid` already renders a footer paginator when `onPageChange` is supplied.
  Date/Author: 2025-12-29 / Codex

## Outcomes & Retrospective

Pending. This will be updated once the work is complete.

## Context and Orientation

The map page lives at `app/src/router/routes/map.tsx` and renders the modeless dialog manager from `app/src/router/routes/modeless/ModelessDialogManager.tsx`. The modeless dialog content blocks are in `app/src/router/routes/modeless/modelessDialogContent.tsx`. Modeless dialogs are built with `ModelessDialogFrame` and `PluginDialogHeader`, which already render a draggable, resizable window with a consistent header style.

The UI grid package `@hierarchidb/ui-grid` (source in `packages/ui/data-grid/src`) provides `GenericDataGrid`, a table component with built-in search input and optional virtualization via `enableVirtualization`. It expects an array of column definitions and an array of row objects.

The shape plugin’s generated features are stored in IndexedDB via Dexie in `packages/features/shape-store/src/ShapeDB.ts`, exposed as the singleton `shapeDB`. The route plugin’s generated line strings are stored in `packages/features/route-store/src/RouteDatabase.ts` under the `lineStrings` table. The location plugin writes tabular data into the tabular store (RowStoreDB + metadata) via `TabularWriter` with filenames like `location-<nodeId>.json` and persists the `tableId` into `EphemeralLocationDB.sessions` (see `packages/features/location-store/src/EphemeralLocationDB.ts`). The tabular store can be queried from the UI with `TabularQueryService` and `SimpleTableMetadataManager` in `@hierarchidb/tabular-store`.

“Virtualized table” means the UI only renders rows visible in the scroll viewport, improving performance for large datasets. In this repository, that is provided by `GenericDataGrid` with `enableVirtualization` set to true.

## Plan of Work

First, add a new modeless dialog definition in `app/src/router/routes/modeless/ModelessDialogManager.tsx` called “Data Table” (or similar) with an appropriate icon (for example `TableView`). This dialog should render a new content component placed alongside existing content blocks in `app/src/router/routes/modeless/modelessDialogContent.tsx`.

Next, implement a `MapGeneratedDataContent` component that renders MUI Tabs for Shape, Location, and Route. Each tab should render a `GenericDataGrid` with the built-in search field. For Shape and Route, use non-virtualized mode with pagination (1000 rows per page) so the footer pager appears after 1000 rows. Location can remain virtualized.

Then, implement small data-loading helpers or hooks inside the same file (or a new `useMapGeneratedData.ts` file if the content grows too large) to gather rows and columns for each dataset. Use a shared `MAX_ROWS` limit (for example 1000) and a “data truncated” note when the limit is hit.

For Shape, query `shapeDB.features.where('nodeId').equals(nodeId).limit(MAX_ROWS)` and map to lightweight rows. Avoid embedding full geometry; instead include summary columns like `id`, `name`, `countryCode`, `adminLevel`, `area`, `population`, and `geometryType` (derived from `geometry.type`).

For Route, create a `RouteDatabase` instance once (memoized) and call `db.lineStrings.where('nodeId').equals(nodeId).limit(MAX_ROWS).toArray()`. Map to rows with columns such as `id`, `name`, `routeMode`, `startName`, `endName`, `distance`, `speed`, and `featureId`. Use safe fallbacks for missing fields.

For Location, read the latest session from `getEphemeralLocationDB().sessions.where('nodeId').equals(nodeId)` and take the most recent `createdAt`. If `tableId` is available, use `SimpleTableMetadataManager(getDBName('location-metadata-db'))` to load column names and `TabularQueryService('location').query(tableId, [], MAX_ROWS)` to fetch rows. If no `tableId` is available, render an empty state that explains the table will appear after a batch run. This location table is independent from the map’s highlight search.

Finally, wire the new content component into the modeless dialog definitions and ensure the dialog size is larger than the map info dialogs (for example 720×420). Keep the behavior independent of the map search UI by not reusing `mapSearchTextAtom` or any of the map highlight state.

## Concrete Steps

1) Create the new dialog content component and data hooks.
   - File: `app/src/router/routes/modeless/modelessDialogContent.tsx` (or a new file `app/src/router/routes/modeless/useMapGeneratedData.ts` if it becomes too large).
   - Implement `MapGeneratedDataContent` with Tabs and `GenericDataGrid`.
   - Add local data loaders for shape, route, and location.

2) Add a new dialog definition.
   - File: `app/src/router/routes/modeless/ModelessDialogManager.tsx`.
   - Add a new `MapDialogDefinition` entry with the content component and a larger default size.

3) Confirm that the dialog renders and that the table search works.
   - No code changes are required for the existing map search; the table search is local to `GenericDataGrid`.

Expected snippet for manual verification (example):

  On `/map/<nodeId>`, open the “Data Table” dialog. The dialog shows three tabs: Shape, Location, Route. The table toolbar includes a “Search…” input and the row count chip. Typing a keyword filters the visible rows.

## Validation and Acceptance

Run the app and verify in the browser. From the repo root, execute `pnpm dev` and open `/map/<nodeId>` for a folder that contains generated shape/location/route layers. Confirm that the “Data Table” modeless dialog is available, that each tab renders a virtualized grid, and that typing in the search field filters rows. For Location, ensure that if no batch has run, the dialog shows an empty-state message rather than crashing.

If you cannot run the app, record that limitation in `TASKS.md` and at least confirm the component renders by reading the code paths in `app/src/router/routes/map.tsx`, `app/src/router/routes/modeless/ModelessDialogManager.tsx`, and `app/src/router/routes/modeless/modelessDialogContent.tsx`.

## Idempotence and Recovery

All changes are additive. Re-running the steps should not change behavior beyond the intended new dialog. To recover, revert the edits to `ModelessDialogManager.tsx` and `modelessDialogContent.tsx` and the map will return to the previous modeless dialog set. No persistent data migrations are involved.

## Artifacts and Notes

If the data queries are limited by `MAX_ROWS`, show a short notice in the UI such as “Showing first 1000 rows.” This keeps the UI responsive and signals truncation clearly to the user.

## Interfaces and Dependencies

The dialog content depends on `GenericDataGrid` from `@hierarchidb/ui-grid`, which must be imported from `@hierarchidb/ui-grid` in the app layer. The shape data loader uses `shapeDB` from `@hierarchidb/shape-store`, the route data loader uses `RouteDatabase` from `@hierarchidb/route-store`, and the location data loader uses `getEphemeralLocationDB` from `@hierarchidb/location-store` plus `SimpleTableMetadataManager` and `TabularQueryService` from `@hierarchidb/tabular-store`. The modeless dialog manager must include the new definition with an icon such as `TableView` from `@mui/icons-material` and pass `nodeId` into the content component.
