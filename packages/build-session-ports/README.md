# @hierarchidb/build-session-ports

Last updated: 2026-04-05

Port (interface) definitions for HierarchiDB build sessions. Provides abstract ports for build session control, artifact storage, task registry, and stage controls. Corresponds to the port layer in Hexagonal Architecture.

## Key Ports

| Port | Description |
| --- | --- |
| `BuildSessionControlPort` | Session start, pause, resume, and subscription |
| `ArtifactStorePort` | Inter-stage artifact (buffer) persistence and retrieval |
| `TaskRegistryPort` | Task registration, per-stage resolution, and input loading |
| `StageControls` | Stage execution control interface |
| `ProgressInfoBase` | Base type for progress information |

## Dependencies

`@hierarchidb/core-types` only.

## Related Packages

- [`@hierarchidb/build`](../build/) — Build foundation that uses these ports
- [`@hierarchidb/build-api`](../build-api/) — Event type definitions

## License

MIT
