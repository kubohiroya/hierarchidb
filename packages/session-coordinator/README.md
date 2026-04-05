# @hierarchidb/session-coordinator

Last updated: 2026-04-05

Session coordination package for HierarchiDB. Provides cross-tab session synchronization via BroadcastChannel, polling-based session tracking, and memory storage fallback.

## Key Features

- `createSessionBroadcastChannel` — BroadcastChannel-based cross-tab session notification
- `createSessionTabId` — Tab-unique session ID generation
- `createPollingTracker` — Polling-based session tracking
- `createMemoryStorage` — In-memory storage (SessionStorage fallback)
- `resolveStorage` — Automatic SessionStorage / memory storage selection

## Dependencies

No external dependencies.

## Related Packages

- [`@hierarchidb/runtime-worker`](../runtime-worker/) — Worker runtime
- [`@hierarchidb/ui-session-coordinator`](../ui/session-coordinator/) — UI-side session coordination

## License

MIT
