# @hierarchidb/import-export

Last updated: 2026-04-05

Data import/export package for HierarchiDB. Provides serialization/deserialization of tree structures, node data export, and import with conflict resolution.

## Import Validation

`ImportExportService.validateImportData` validates JSON-like import payloads against the
`ImportData` JSON Schema from `@hierarchidb/import-export-api`. The validator runs with
no coercion, no defaults, and no removal of additional properties. The root and node
envelopes are strict, while `data` and `draftData` remain generic JSON values owned by
plugins.
The node envelope includes legacy placement metadata (`parentNodeId`) and top-level
`tags` because the import runtime still consumes those fields.

## Public Export Artifacts

JSON exports produced by `exportNodes({ format: 'json' })` use the `json-export-envelope`
schema. Vector tile archives validate `summary.json` with the
`vector-tile-archive-summary` schema and `metadata.json` with the
`vector-tile-archive-metadata` schema before the files are returned.

Export artifact validators use the same no-coercion policy as import validation. Contract
violations fail closed with `EXPORT_ARTIFACT_SCHEMA_INVALID:<artifact>`; validators do not
normalize, clamp, fill defaults, or remove unknown fields.

CSV export and canonical YAML ZIP validation are separate boundaries and are not covered
by these export artifact schemas.

## Dependencies

`@hierarchidb/core-types`, `@hierarchidb/import-export-api`, `@hierarchidb/tree-api`, `@hierarchidb/util`, `ajv`, `fflate`

## Related Packages

- [`@hierarchidb/import-export-api`](../import-export-api/) — Import/export API type definitions

## License

MIT
