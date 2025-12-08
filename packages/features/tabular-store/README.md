# @hierarchidb/tabular-store

Shared tabular persistence used by plugins (location/shape/route). Stores chunked rows in IndexedDB/Dexie with optional per-column indexes and simple query APIs.

## Directory layout
```
TabularWriter.ts        Chunked writer
TabularQueryService.ts  Query with optional indexes
indexes/                Inverted index helpers
metadata/               Table metadata helpers
index.ts                Public exports
```

## Key exports
- `TabularWriter` — `begin`, `writeRows`, `commit`, `abort`; supports indexColumns.
- `TabularQueryService` — `query(tableId, filters, limit?)` with lazy-built `eq` indexes.
- Types/helpers for table metadata and row chunk storage.

## Consumers / usage
- Spreadsheet and tabular plugins ingest via `@hierarchidb/tabular-source` then persist/query with this store.
- Location/route/shape plugins use it to keep parsed table data for filtering/search.

## Notes
- Indexes build lazily on first `eq` query; non-`eq` currently scans chunks.
- Intended for local search/preview; use project-level import/export for full backups.
