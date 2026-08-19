# @hierarchidb/yaml-store

Last updated: 2026-08-20

This package currently provides the legacy Dexie-based YamlDB v1 and its CRUD helpers. It is not the authoritative store for YAML domain data.

## Storage authority

The canonical contract is [`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md):

- CoreDB `TreeNode.metadata/data` owns committed YAML state.
- CoreDB `TreeNode.draftMetadata/draftData` owns draft YAML state.
- YamlDB v1 is a frozen, non-authoritative legacy recovery source. It must not be used as a cache or dual-write destination.
- CoreDB and YamlDB are separate IndexedDB databases and cannot participate in one transaction. CoreDB migration and YamlDB inventory/recovery therefore remain separate issues and atomic boundaries.

The source still exposes `getYamlDB()` and mutation helpers until the follow-up recovery and retirement issues are complete. Those APIs are legacy-only: canonical dialog, ZIP, simulation, and Step 4 runtime paths must not call them. The current [folder YAML import](../../plugins/folder-plugin/README.md#legacy-yaml-snapshot-boundary) still writes YamlDB-only rows and is a non-canonical implementation blocked from cutover. Missing names, empty schema IDs, orphan rows, and conflicts must be reported by read-only inventory; they must not be inferred, copied, merged, or deleted automatically.

Physical YamlDB deletion is a separate destructive operation. YamlDB remains unchanged during the rollback observation and recovery window for at least 30 days after the production CoreDB migration and through acceptance of one subsequent stable release, whichever is later. The inverse CoreDB migration neither reads nor modifies YamlDB; YamlDB is not the source of CoreDB rollback.

## Dependencies

`@hierarchidb/core-types`, `@hierarchidb/util`, `@hierarchidb/yaml-api`

## Related Packages

- [`@hierarchidb/yaml-api`](../yaml-api/) — YAML API type definitions
- [`@hierarchidb/core-types`](../core-types/) — Shared type definitions
- [`Canonical storage contract`](../../docs/yaml-plugin-ide-gsm-step4-spec.md) — authority, migration, recovery, and rollback rules

## License

MIT
