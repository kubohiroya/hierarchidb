# Runtime Flags (Plugins)

Tiny, practical flags to tweak plugin runtime without code changes. Mostフラグは `localStorage` で切り替えられますが、Fetch 並列数はホスト側の初期化コードで明示的に設定してください。

- LOCATION_RUNTIME_WORKER: `0|1` (default `0`)
  - Enables Location plugin’s worker-backed adapters.
- ROUTE_RUNTIME_WORKER: `0|1` (default `0`)
  - Enables Route plugin’s worker-backed adapters.
- LOCATION_PER_HOST_CONCURRENCY: number (default `4`)
  - Per-host concurrent fetches (Location). Overwrite via `configureLocationDownloadDefaults({ perHostConcurrency: 8 })` during app bootstrap.
- ROUTE_PER_HOST_CONCURRENCY: number (default `4`)
  - Per-host concurrent fetches (Route). Overwrite via `registerRouteDownloadServiceFactory` or by calling a helper that passes `perHostConcurrency` explicitly.

Quick enable (DevTools console):
- `localStorage.setItem('LOCATION_RUNTIME_WORKER','1')`
- `localStorage.setItem('ROUTE_RUNTIME_WORKER','1')`

Notes
- `app/src/worker.ts` resolves worker flags via `localStorage`. Fetch concurrency overridesはプラグインのレジストリ API に注入した defaults から参照されます。
- Auth prompts propagate via a global `AuthNotificationRegistry` if present.
