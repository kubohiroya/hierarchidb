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

## Dependencies

Depends on many `@hierarchidb/*` packages (shape-store, location-store, route-store, styler-store, tree-api, build-api, chunk-store, tabular-store, etc.).

## Related Packages

- [`@hierarchidb/worker-api`](../worker-api/) — WorkerAPI interface definitions
- [`@hierarchidb/build`](../build/) — Build session foundation
- [`@hierarchidb/session-coordinator`](../session-coordinator/) — Session coordination

## License

MIT
