# @hierarchidb/build-api

Last updated: 2026-04-05

API type definitions for the HierarchiDB build system. Provides build session event types (`SessionStatusUpdatedEvent`, `TaskProgressUpdatedEvent`, `StageSnapshotUpdatedEvent`, `HeartbeatEvent`), session state types, progress payload types, and task status normalization utilities.

## Key Types

- `SessionStatusUpdatedEvent` — Session phase change event
- `StageSnapshotUpdatedEvent` — Stage snapshot update event
- `TaskProgressUpdatedEvent` — Task progress update event
- `HeartbeatEvent` — Heartbeat event
- `BuildSessionState` / `BuildSessionStatus` — Session state and status
- `BuildProgressPayload` / `ResourceUsage` — Progress payload and resource usage
- `normalizeProgressPhase` / `mapProgressPhaseToBuildStatus` — Status normalization

## Dependencies

`@hierarchidb/core-types` only.

## Related Packages

- [`@hierarchidb/build`](../build/) — Build system foundation
- [`@hierarchidb/build-runtime-services`](../build-runtime-services/) — Runtime event delivery

## License

MIT
