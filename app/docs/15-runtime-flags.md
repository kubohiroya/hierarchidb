# Runtime Flags (Plugins)

Tiny, practical flags to tweak plugin runtime without code changes. Set via `localStorage`, `globalThis`, or `.env`.

- LOCATION_RUNTIME_WORKER: `0|1` (default `0`)
  - Enables Location plugin’s worker-backed adapters.
- ROUTE_RUNTIME_WORKER: `0|1` (default `0`)
  - Enables Route plugin’s worker-backed adapters.
- LOCATION_PER_HOST_CONCURRENCY: number (default `4`)
  - Per-host concurrent downloads (Location).
- ROUTE_PER_HOST_CONCURRENCY: number (default `4`)
  - Per-host concurrent downloads (Route).

Quick enable (DevTools console):
- `localStorage.setItem('LOCATION_RUNTIME_WORKER','1')`
- `localStorage.setItem('ROUTE_RUNTIME_WORKER','1')`
- `localStorage.setItem('LOCATION_PER_HOST_CONCURRENCY','8')`
- `localStorage.setItem('ROUTE_PER_HOST_CONCURRENCY','8')`

Notes
- app/src/worker.ts reads these before bootstrapping services.
- Auth prompts propagate via a global `AuthNotificationRegistry` if present.
