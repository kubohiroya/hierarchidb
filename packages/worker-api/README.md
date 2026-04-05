# @hierarchidb/worker-api

Last updated: 2026-04-05

Worker API interface definitions for HierarchiDB. Defines the `WorkerAPI` interface for calling the Worker from the main thread via Comlink RPC. Includes methods for TreeNode CRUD, build session control, plugin operations, memory management, and more.

## Key Types

- `WorkerAPI` — Interface defining all Worker-side operations (`ping`, TreeNode CRUD, build control, etc.)
- `WorkerStorageAPI` — Worker-side storage operations (`getItem`, `setItem`, `removeItem`)

## Dependencies

`@hierarchidb/core-types`, `@hierarchidb/build-api`, `@hierarchidb/tree-api`, `@hierarchidb/plugin-base`, `@hierarchidb/memory`, etc.

## Related Packages

- [`@hierarchidb/runtime-worker`](../runtime-worker/) — WorkerAPI implementation
- [`@hierarchidb/ui-worker-provider`](../ui/worker-provider/) — Main thread Worker client

## License

MIT
