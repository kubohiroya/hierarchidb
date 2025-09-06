# @hierarchidb/tabular-store

Shared tabular persistence for plugin tables (location/shape/route). Provides chunked row storage, simple query API, and optional index-assisted lookups.

## Concepts
- Row chunks: JSON-encoded rows stored in IndexedDB (`rowChunks`), keyed by `(pluginId, tableId)`.
- Table metadata: stored via `@hierarchidb/table-metadata` (columns, totalRows, etc.).
- Inverted index (optional): `rowIndexes` maps `(pluginId, tableId, column, value)` to `rowIds[]` for fast `eq` filters (built lazily).

## APIs

```ts
import { TabularWriter, TabularQueryService } from '@hierarchidb/tabular-store';

// Write
const writer = new TabularWriter('location', { indexColumns: ['type','countryCode'] });
const tableId = await writer.begin({ filename: 'location-table.json', columns: ['id','lon','lat','type','countryCode'] });
await writer.writeRows(rows); // can be called multiple times
await writer.commit();

// Query
const svc = new TabularQueryService('location');
const out = await svc.query(tableId, [
  { column: 'type', op: 'eq', value: 'airport' },
  { column: 'countryCode', op: 'eq', value: 'JPN' },
], 1000);
```

## Notes
- Indexes are built lazily per column on the first `eq` filter. Initial query may cost more; subsequent queries speed up.
- Non-`eq` ops (contains/gt/gte/lt/lte/neq) currently fall back to scanning row chunks.
- Intended for search/inspection. Use node-level Import/Export to serialize entire projects.

