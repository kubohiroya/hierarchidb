# @hierarchidb/build

Last updated: 2026-04-05

Build system foundation package for HierarchiDB. Provides `BuildService` (chunk parallel processing), `AbstractBuildSession` (session lifecycle), `BaseBuildSessionManager` (session management), lane semaphores, and progress adapters. Batch processing in shape-plugin / location-plugin / route-plugin depends on this package.

## Key Features

- `BuildService` — Chunk-parallel mapping over async iterators
- `AbstractBuildSession` — Abstract base class for build sessions (state management, progress tracking, abort control)
- `BaseBuildSessionManager` — Session registration, progress, and status change hook management
- `LaneSemaphoreRegistry` — Per-method concurrency control (lane policy)
- `useBuildProgress` / `useBuildSessionTiming` — React hooks (progress display, timing calculation)
- Progress adapters (`progressEventToUnified`, `createAdapterFromProgressSubscribe`)

## Dependencies

`@hierarchidb/build-api`, `@hierarchidb/core-types`, `@hierarchidb/download`

## Related Packages

- [`@hierarchidb/build-api`](../build-api/) — Build event and status type definitions
- [`@hierarchidb/build-runtime-services`](../build-runtime-services/) — Runtime event delivery
- [`@hierarchidb/build-session-ports`](../build-session-ports/) — Session control ports

## License

MIT
