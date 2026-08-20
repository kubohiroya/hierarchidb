# @hierarchidb/runtime-worker

Last updated: 2026-08-20

Worker-side database and processing foundation for HierarchiDB. The `WorkerService` singleton initializes the Worker environment, managing CoreDB (TreeNode CRUD), per-plugin FeatureStore / VectorTileStore, and build session recovery. Communicates with the main thread's `WorkerAPI` via Comlink RPC.

## Key Features

- `WorkerService` — Worker environment singleton (plugin registration, CoreDB initialization, build session recovery)
- CoreDB — TreeNode CRUD, draft management, payload persistence
- Per-plugin FeatureStore / VectorTileStore creation and management
- Comlink RPC communication with the main thread

## Dormant YAML storage activation contract

`@hierarchidb/runtime-worker/yaml-storage-activation` is an independent, pure subpath that models the future YAML storage activation phases and fail-closed publication decisions. It has no connection to `WorkerService`, application bootstrap, database opening, or production query and mutation routes. Importing the subpath cannot activate migration or change current legacy behavior.

The model keeps legacy and canonical readers and writers unavailable from quiescing through initialization. Only a committed upgrade followed by successful initialization can publish canonical access. A blocked target open can advance only by resuming the same open request; a different request produces a terminal rejection. The separate YamlDB domain is denied in every phase. This dormant artifact must remain unreachable from production entry points until the single activation release described in the canonical specification.

## Dormant YAML legacy runtime fence protocol

`@hierarchidb/runtime-worker/yaml-storage-legacy-fence` is a separate pure subpath for collecting explicit quiescence acknowledgements from a fixed snapshot of legacy tabs and workers. Every expected participant must match the caller-supplied activation and quiescence request identifiers, revoke its legacy YAML entry points, and close its owned storage handles before the protocol reports `readyForPreflight`.

The quiescence request identifier is not the target IndexedDB `openRequestId`. A successful quiescence decision always reports `actualFenceEstablished: false`; only the later `versionchanging` phase in the single activation release can establish the actual storage fence. The protocol has no production imports, I/O, timeout, retry, participant discovery, database access, or connection to the existing maintenance flow.

## CoreDB YAML read-only inventory

`WorkerService.getYamlCoreDbReadOnlyInventory()` is an on-demand production endpoint for the pre-activation YAML inventory. It uses the already-open CoreDB instance, reads the `nodes` snapshot in a Dexie `r` transaction, selects exact `yaml-file` records, and delegates all record and slot classification to `@hierarchidb/yaml-api/migration`.

An accepted report contains only node, slot, and classification counts. A rejected report contains the number of distinct invalid source records, the total error count, and the planner's sanitized typed errors; it never exposes YAML content, payloads, migration postimages, journal values, digests, or raw exception messages. A storage or unexpected planning failure is a separate stable failure and is never reported as zero invalid records.

The endpoint does not call `CoreDB.getSingleton()` or `initialize()`, write or repair either CoreDB or YamlDB, change a schema version, publish canonical access, or run automatically during worker startup. Its tests do not satisfy the operational activation gate: a deployed production release must invoke the endpoint separately and record exact zero invalid records and errors before the single activation work starts.

## Dependencies

Depends on many `@hierarchidb/*` packages (shape-store, location-store, route-store, styler-store, tree-api, build-api, chunk-store, tabular-store, etc.).

## Related Packages

- [`@hierarchidb/worker-api`](../worker-api/) — WorkerAPI interface definitions
- [`@hierarchidb/build`](../build/) — Build session foundation
- [`@hierarchidb/session-coordinator`](../session-coordinator/) — Session coordination

## License

MIT
