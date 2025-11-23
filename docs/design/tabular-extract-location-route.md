# Tabular Extract Flow for Location/Route

## Scope
- Location (GeoNames as spike) and Route (CSV/GeoJSON as spike) dialogs should support:
  - Download/ingest large tabular sources via tabular-source → tabular-store
  - Define include/exclude rules (value match, regex) on columns
  - Preview extracted rows (ui-tabular-extract) and iteratively refine rules
  - Materialize extracted rows into normalized tables (location-point / route-point/segment)
- TreeNode `data/draftData` holds only config (source settings + extractConfig). Actual rows live in tabular-store and plugin-specific tables.

## Data Model Additions
- `tabularSourceId?: string` — handle for tabular-store data
- `extractConfig?: TabularExtractConfig` — column filters/projection used for extraction
- LocationEntity: add above fields; keep `features` lightweight or omit (points live in point table)
- RouteEntity: add above fields; route geometry lives in route tables

### TabularExtractConfig (sketch)
```ts
interface TabularExtractConfig {
  projection?: string[]; // columns to include
  includes?: Array<{ column: string; value?: string | number | boolean; regex?: string }>;
  excludes?: Array<{ column: string; value?: string | number | boolean; regex?: string }>;
  limit?: number;
  sample?: number; // preview row limit
}
```

## Worker API (to be implemented)
- `ensureTabularSource(config) -> { tabularSourceId, schema, stats }`
  - Streams source via tabular-source, persists to tabular-store
- `extractTabularRows(tabularSourceId, extractConfig) -> AsyncIterable<Row[]> | { rows, schema }`
  - Uses ui-tabular-extract for projection/filter/limit/sample
- `materializeLocationPoints(nodeId, tabularSourceId, extractConfig)`
  - extract → normalize → write to location-point table; update LocationEntity
- `materializeRouteSegments(nodeId, tabularSourceId, extractConfig)`
  - extract → normalize → write to route tables; update RouteEntity
- GC: refcount/TTL for tabularSourceId when no nodes reference it

## UI Flow (Dialog Steps)
1) Source config step (existing): choose dataSource/URL/query, set base filters.
2) Download step: trigger ensureTabularSource; show progress.
3) Extract rules & preview step (new):
   - Fetch schema from tabular-store
   - Edit include/exclude rules (value/regex) and projection
   - Call extractTabularRows with `sample` to show preview
   - Iterate until satisfied; persist extractConfig
4) Commit step: invoke materialize* with tabularSourceId + extractConfig → normalized tables; TreeNode data stores only the config.

## Storage
- CoreDB `nodes`: TreeNode meta + entity `data` with tabularSourceId/extractConfig (no bulk rows)
- tabular-store: raw tabular chunks by tabularSourceId
- location-point / route-* tables: normalized rows linked by nodeId

## Spike Targets
- Location: GeoNames
- Route: CSV or GeoJSON catalog
- Feature flag gate for new path; legacy path can remain as fallback during spike

## Open Items
- Decide AND/OR semantics for include/exclude (start with AND on includes and excludes applied after includes)
- Schema introspection UI (column names/types from tabular-store)
- Error/timeout handling for large extracts
- Test coverage: download→extract→materialize, preview cycle, GC of unused tabularSourceId
