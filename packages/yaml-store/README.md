# @hierarchidb/yaml-store

Last updated: 2026-08-22

This package preserves the frozen legacy Dexie-based YamlDB v1 for separately reviewed read-only inventory, retention, and retirement work. It is not an authoritative runtime store.

## Production boundary

The canonical contract is [`docs/yaml-plugin-ide-gsm-step4-spec.md`](../../docs/yaml-plugin-ide-gsm-step4-spec.md):

- CoreDB `TreeNode.metadata/data` owns committed YAML state.
- CoreDB `TreeNode.draftMetadata/draftData` owns draft YAML state.
- YamlDB is not a cache, dual-write destination, fallback reader, or CoreDB rollback source.
- The package root exposes no runtime database or mutation API.
- `@hierarchidb/yaml-store/legacy-close` exposes only the idempotent activation-time revocation/close operation.
- `@hierarchidb/yaml-store/readonly-inventory` exposes only the legacy YamlDB v1 read-only inventory entrypoint. It reports aggregate counts, stable codes, deterministic #1341 accounting classifications, row-level stable identifiers, optional aggregate target-comparison counts, and a deterministic source digest.

The underlying v1 implementation remains solely so #1341 successor work can read and account historical rows without upgrading or mutating the database. No canonical dialog, ZIP, Simulation, Worker, or Step 4 route imports it. Physical deletion is a separate destructive operation and is outside the single activation change.

YamlDB remains unchanged for at least 30 days after production CoreDB migration and through acceptance of one subsequent stable release, whichever is later. Missing names, empty schema IDs, orphan rows, absent targets, and conflicts must be reported by read-only inventory and never inferred, copied, repaired, merged, discarded, recovered, or deleted automatically. Any future historical write path requires a separate explicit contract issue.

## #1341 accounting classifications

Read-only inventory accounts every row into exactly one of these classifications:

- `duplicate/no-op`: the CoreDB target has the same node ID, `nodeType: "yaml-file"`, parent ID, metadata name, subtype, schemaId, and byte-for-byte content.
- `recoverable`: the target node is absent, no node ID or sibling collision exists, and the recovery parent exists as a folder.
- `orphan/blocked`: the recovery parent is missing or is not a folder.
- `conflict`: the target node or same-parent sibling exists but is not an exact duplicate.
- `invalid`: row shape, key, registry tuple, or canonical payload validation fails.
- `explicitly-discarded`: a separate user approval record names the node ID and reason.

These classifications are accounting evidence only. `recoverable` does not authorize a write, and `explicitly-discarded` does not delete the source row. Row-level evidence exposes only the classification and a stable digest identifier; it does not expose node IDs, parent IDs, filenames, schema IDs, YAML content, credentials, or native errors.

## License

MIT
