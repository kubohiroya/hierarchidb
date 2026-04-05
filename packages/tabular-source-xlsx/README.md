# @hierarchidb/tabular-source-xlsx

Last updated: 2026-04-05

XLSX (Excel) data source extension for HierarchiDB. Adds an XLSX parser to the `tabular-source` parser registry. Call `installTabularXlsx()` to enable XLSX file ingestion.

## Key Features

- `installTabularXlsx()` — Register the XLSX parser (run once)
- `isTabularXlsxInstalled()` — Check if already registered

## Dependencies

`@hierarchidb/tabular-source`, `@hierarchidb/tabular-store`

## Related Packages

- [`@hierarchidb/tabular-source`](../tabular-source/) — Parser registry (registration target)
- [`@hierarchidb/tabular-store`](../tabular-store/) — Tabular data store

## License

MIT
