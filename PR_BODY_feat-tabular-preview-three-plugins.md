Title: Add shared Tabular Store + Table Preview tabs for location/shape/route

Summary
- Introduces a shared tabular row store (@hierarchidb/tabular-store) to persist normalized, column-wise data for search.
- Adds a reusable UI component (TabularPreview) in @hierarchidb/ui-core to browse/filter rows.
- Wires table creation and preview into three plugins:
  - location: SessionController persists rows; BatchProgressDialog shows “データテーブル”.
  - shape: ShapeBatchOrchestrator persists rows; BatchProcessingDialog gets a new “Data Table” tab.
  - route: RouteBatchSession persists rows; RoutePanel shows a “データテーブル” card.

Motivation
- Allow column-wise search and inspection of downloaded/processed data across plugins while maximizing code sharing.

Key Changes
- New package: packages/feature/tabular-store
  - TabularWriter: chunked row writer + metadata integration
  - TabularQueryService: simple column filters (eq/neq/contains/gt/gte/lt/lte)
  - RowStoreDB (Dexie): shared row chunk table keyed by [pluginId+tableId]
- UI: TabularPreview (packages/ui/core)
  - Reads table metadata, fetches rows via TabularQueryService, renders with @hierarchidb/ui-data-grid
- location-plugin
  - SessionController: writes rows when LOCATION_TABULAR is enabled
  - BatchProgressDialog: “データテーブル” tab renders TabularPreview using sessions.tableId
- shape-plugin
  - ShapeBatchOrchestrator: writes rows during simplify1 when SHAPE_TABULAR is enabled
  - BatchProcessingDialog: Tabs(Progress/Data Table) + TabularPreview using sessions.tableId
- route-plugin
  - RouteBatchSession: writes one row per generated route when ROUTE_TABULAR is enabled; stores tableId in routeCursors
  - RoutePanel: adds “データテーブル” card with TabularPreview

Feature Flags (default OFF)
- LOCATION_TABULAR=1
- SHAPE_TABULAR=1
- ROUTE_TABULAR=1
Alternatively in runtime: globalThis.FEATURE_FLAGS.{LOCATION_TABULAR|SHAPE_TABULAR|ROUTE_TABULAR} = true

How To Test (smoke)
1) location
   - Enable LOCATION_TABULAR=1
   - Start a session (points→MVT). Open BatchProgressDialog → “データテーブル” tab shows rows.
2) shape
   - Enable SHAPE_TABULAR=1
   - Run batch (download→simplify1). Open BatchProcessingDialog → “Data Table” tab shows rows.
3) route
   - Enable ROUTE_TABULAR=1
   - Launch route batch. RoutePanel displays a “データテーブル” card with rows for generated routes.

Acceptance Criteria
- Each plugin persists rows with a stable tableId retrievable from its session/cursor record.
- TabularPreview loads columns/rows and supports basic contains filter.
- No change in default behavior when flags are OFF.

Risk / Rollback
- Risk: Large tables may be slow to scan (current implementation scans row chunks in-memory).
- Mitigation: This is behind flags; can be disabled per plugin.
- Rollback: Remove @hierarchidb/tabular-store dependency + TabularPreview usage and revert small dialog/panel additions.

Follow-ups (not in this PR)
- Add lightweight per-column index projection for frequent filters (e.g., type, countryCode, name).
- CSV/JSON export from TabularPreview.
- Virtualized grid + server-side pagination when tables grow large.

