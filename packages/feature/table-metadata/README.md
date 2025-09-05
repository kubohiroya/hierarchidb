@hierarchidb/table-metadata

Purpose
- Shared IndexedDB/Dexie manager for CSV table metadata used by multiple plugins (Spreadsheet, Styler).

API
- `class SimpleTableMetadataManager(dbName?: string)`
  - Defaults to `getDBName('spreadsheet-metadata-db')`.
  - Core: `create()`, `get()`, `list()`, `findByHash()`, `addReference()`, `removeReference()` (deletes on zero), `update()`, `getStatistics()`, `cleanupOrphanedTables()`, `forceDelete()`.
  - Compatibility (Styler-style): `store()`, `getAll()`, `delete()`, `findByContentHash()`, `clear()`, `close()`.

Usage
- Spreadsheet plugin wrapper:
  - `new SimpleTableMetadataManager(getDBName('spreadsheet-metadata-db'))`
- Styler plugin wrapper:
  - `new SimpleTableMetadataManager(getDBName('styler-metadata-db'))`

Notes
- DB names follow kebab-case and shared prefix via `getDBName()`.
- The manager is intentionally schema-light to avoid coupling with UI packages.

