# @hierarchidb/tabular-source

Last updated: 2026-04-05

Tabular data parsing and ingestion package for HierarchiDB. Provides `TabularService` (detect → parse → ingest), CSV/TSV/JSONL parsers, processors (column rename, number coercion, required column validation), and data source registration.

## Key Features

- `TabularService` — Unified service for file format detection, parsing, and ingestion
- CSV / TSV / JSONL parsers (`TabularParserPort` implementations)
- Processors: `createColumnRenameProcessor`, `createNumberCoerceProcessor`, `createRequiredColumnsValidator`
- `registerTabularSource` / `isTabularSource` — Per-nodeType data source registration and detection

## Row Schema

`tabularRowJsonSchema` validates parsed JSON-like rows as object maps of JSON values. The
validator uses Ajv strict mode with no coercion, defaults, or additional-property removal.
Column-level constraints remain processor-owned; the row schema intentionally does not
declare required columns.

## Dependencies

`@hierarchidb/util`, `ajv`

## Related Packages

- [`@hierarchidb/tabular-store`](../tabular-store/) — Persistence target for parsed results
- [`@hierarchidb/tabular-source-xlsx`](../tabular-source-xlsx/) — XLSX parser extension

## License

MIT
