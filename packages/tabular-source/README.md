@hierarchidb/tabular-source
===========================

Tabular parsing/ingest capability (CSV/TSV/JSONL; XLSX optional). Provides a parser registry, processors, and StorePort abstraction so plugins can profile/ingest rows into their own stores.

## Directory layout
```
TabularService.ts   Facade (detect/parse/ingest)
registry.ts         Parser registry (CSV/TSV/JSONL built-in)
parsers/            Built-in parsers
processors/         ColumnRename/NumberCoerce/RequiredColumns
processor.ts        Processor pipeline helpers
store.ts            StorePort helpers
ports.ts            StorePort/ParserPort contracts
capability.ts       Capability helpers
batch-types.ts            Tabular types (schema/chunks)
index.ts            Public exports
```

## Key exports
- `TabularService` — `detect`, `parse`, `ingest`.
- Registry: `registerParser`, built-ins for CSV/TSV/JSONL.
- Processors: `ColumnRenameProcessor`, `NumberCoerceProcessor`, `RequiredColumnsValidator`.
- Ports/types: `TabularStorePort`, `TabularParser`, `TabularChunk`, `TabularSchema`.

## XLSX
- Optional via `@hierarchidb/tabular-source-xlsx` → call `installTabularXlsx()` (runtime-worker will dynamically import when available).

## Consumers / usage
- Spreadsheet/location/timeline plugins ingest preview data via `TabularService`.
- Stores implemented in `@hierarchidb/tabular-store` or plugin-specific ports.

## Notes / roadmap
- `parse()` streams chunks; pick `chunkSize` for your throughput.
- Schema inference is heuristic; enforce strict typing in processors/store.
- Future: richer processor registry and streaming XLSX improvements.
