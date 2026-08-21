# @hierarchidb/build

Last updated: 2026-08-21

Build system foundation package for HierarchiDB. Provides `BuildService` (chunk parallel processing), `AbstractBuildSession` (session lifecycle), `BaseBuildSessionManager` (session management), and lane semaphores. Batch processing in shape-plugin / location-plugin / route-plugin depends on this package.

## Key Features

- `BuildService` — Chunk-parallel mapping over async iterators
- `AbstractBuildSession` — Abstract base class for build sessions (state management, payload-free session update notification, abort control)
- `BaseBuildSessionManager` — Session registration and session update hook management
- `LaneSemaphoreRegistry` — Per-method concurrency control (lane policy)

Canonical Worker→UI events are produced by `@hierarchidb/build-runtime-services` after
the manager rereads session state and the plugin's canonical event source. The session
layer does not create or forward aggregate progress events.

The legacy progress adapter exports remain compatibility-only until their dedicated
follow-up removal; they are not used by the session/manager notification path.

## Dependencies

`@hierarchidb/build-api`, `@hierarchidb/core-types`, `@hierarchidb/download`

## Related Packages

- [`@hierarchidb/build-api`](../build-api/) — Build event and status type definitions
- [`@hierarchidb/build-runtime-services`](../build-runtime-services/) — Runtime event delivery
- [`@hierarchidb/build-session-ports`](../build-session-ports/) — Session control ports

## License

MIT
