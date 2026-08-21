# @hierarchidb/build-api

Last updated: 2026-04-05

API type definitions for the HierarchiDB build system. Provides the canonical build-session event types, session state types, task summaries, and strict task-count contracts.

## Key Types

- `SessionStatusUpdatedEvent` — Session phase change event
- `StageSnapshotUpdatedEvent` — Stage snapshot update event
- `TaskProgressUpdatedEvent` — Task progress update event
- `HeartbeatEvent` — Heartbeat event
- `BuildSessionState` / `BuildSessionStatus` — Session state and status
- `BuildStatus` — Canonical task/session status vocabulary
- `BuildTaskCountSummary` — Canonical task-count aggregation
- `ResourceUsage` — Build-session resource usage

The package does not expose aggregate progress events, compatibility adapters, or
status-normalization fallbacks. Canonical event consumers reject unknown status and
invalid numeric values at the boundary.

## Dependencies

`@hierarchidb/core-types` only.

## Related Packages

- [`@hierarchidb/build`](../build/) — Build system foundation
- [`@hierarchidb/build-runtime-services`](../build-runtime-services/) — Runtime event delivery

## License

MIT
