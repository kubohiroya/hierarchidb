# @hierarchidb/runtime-worker

Last updated: 2026-04-05

Worker-side database and processing foundation for HierarchiDB. The `WorkerService` singleton initializes the Worker environment, managing CoreDB (TreeNode CRUD), per-plugin FeatureStore / VectorTileStore, and build session recovery. Communicates with the main thread's `WorkerAPI` via Comlink RPC.

## Key Features

- `WorkerService` — Worker environment singleton (plugin registration, CoreDB initialization, build session recovery)
- CoreDB — TreeNode CRUD, draft management, payload persistence
- Per-plugin FeatureStore / VectorTileStore creation and management
- Comlink RPC communication with the main thread

## Dependencies

Depends on many `@hierarchidb/*` packages (shape-store, location-store, route-store, styler-store, tree-api, build-api, chunk-store, tabular-store, etc.).

## Related Packages

- [`@hierarchidb/worker-api`](../worker-api/) — WorkerAPI interface definitions
- [`@hierarchidb/build`](../build/) — Build session foundation
- [`@hierarchidb/session-coordinator`](../session-coordinator/) — Session coordination

## License

MIT
