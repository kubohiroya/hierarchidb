# @hierarchidb/import-export-api

Last updated: 2026-04-05

Import/export API type definitions for HierarchiDB. Defines export format types, import options, conflict resolution strategies, etc.

## ImportData Schema

The package exports `importDataJsonSchema`, the canonical JSON Schema for JSON-like
`ImportData<T>` payloads. It defines the import envelope, node envelope, metadata,
draft metadata, recursive `children`, and version fields. Plugin-owned `data` and
`draftData` are intentionally constrained only to generic JSON values.

## Dependencies

`@hierarchidb/core-types`

## Related Packages

- [`@hierarchidb/import-export`](../import-export/) — Import/export implementation

## License

MIT
