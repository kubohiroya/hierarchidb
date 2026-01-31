# @hierarchidb/import-export

Import/export feature facade for tree nodes. Provides a storage-agnostic service plus DB port and capability helpers used by worker/runtime.

## Directory layout
```
ImportExportService.ts  Facade implementing ImportExportAPI
ports.ts                DB port definition (bulk create/list/get)
capability.ts           Enable/disable import/export per node type
index.ts                Public exports
__tests__/              Unit tests
```

## Key exports
- `ImportExportService` — `ImportExportAPI` implementation with progress/cancel support; static `getSingleton(dbPort)`.
- Ports: `ImportExportDBPort` (`bulkCreateNodes`, `listChildren`, `getNode`).
- Capability helpers: `enableImporter/disableImporter`, `enableExporter/disableExporter`.

## Consumers / usage
- Worker runtime wires `ImportExportService` to CoreDB via an adapter; UI calls go through `@hierarchidb/import-export-api` contracts.
- Feature plugins and tooling use the capability helpers to opt-out specific node types.
- Used by spreadsheet/location/route plugins when importing/exporting tree data.

## Notes
- Supports JSON/CSV/XML inputs with simple conflict strategies (`skip/replace/rename`); validation optional.
- Designed to be storage-agnostic: DB changes are isolated behind `ImportExportDBPort`.
