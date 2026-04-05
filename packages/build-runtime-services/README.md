# @hierarchidb/build-runtime-services

Last updated: 2026-04-05

Runtime services package for the HierarchiDB build system. Provides Worker→UI event delivery (`UnconditionalEventStreamer`), task progress event emission (`emitTaskProgressUpdated`), stage checkpoint execution (`runWithStageCheckpoint`), and memory snapshot capture.

## Key Features

- `UnconditionalEventStreamer` — Unconditional Worker→UI event delivery (subscribe/emit pattern)
- `emitTaskProgressUpdated` — Task progress update event emission
- `emitHeartbeat` — Heartbeat event emission
- `runWithStageCheckpoint` — Stage execution wrapper with checkpointing
- `createMemorySnapshot` — Memory usage snapshot capture

## Dependencies

`@hierarchidb/build`, `@hierarchidb/build-api`, `@hierarchidb/core-types`, `@hierarchidb/download`

## Related Packages

- [`@hierarchidb/build`](../build/) — Build system foundation
- [`@hierarchidb/build-api`](../build-api/) — Event type definitions

## License

MIT
