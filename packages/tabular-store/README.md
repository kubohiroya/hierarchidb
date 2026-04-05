# @hierarchidb/tabular-store

Last updated: 2026-04-05

Tabular data persistence package for HierarchiDB. Provides `TabularWriter` (chunk writing), `RowStoreDB` (Dexie row store), `TabularDatabaseManager` (metadata management), `TabularQueryService` (filter queries), and `TabularIndexer` (column indexing). Shared by spreadsheet-plugin, styler-plugin, shape-plugin, location-plugin, and route-plugin.

## Key Features

- `TabularWriter` — Chunk-based table data writing (begin → writeRows → flush/commit)
- `RowStoreDB` — Dexie-based row data store (persisted in chunks)
- `TabularDatabaseManager` — Table metadata CRUD and reference count management
- `TabularQueryService` — Row data query with filter conditions
- `TabularIndexer` — Column value equality index (lazy creation)

## Dependencies

`@hierarchidb/util`

## Related Packages

- [`@hierarchidb/tabular-source`](../tabular-source/) — Tabular data parsing and ingestion
- [`@hierarchidb/chunk-store`](../chunk-store/) — Chunk store foundation

## License

MIT
