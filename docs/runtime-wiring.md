# Plugin Runtime Wiring Overview

Runtime wiring is the set of side-effects that each plugin injects into the worker runtime on startup. During worker bootstrap (`app/src/worker.ts`), the loader dynamically imports every plugin module and passes it to `wirePluginsFromModules`. This helper reflects over the module exports and invokes optional hooks in the order below:

| Hook | Purpose | Typical implementations |
| --- | --- | --- |
| `registerAuthNotifier` | Attach authentication callbacks so that worker-driven fetches can trigger UI prompts. | `registerRouteAuthNotifier`, etc. |
| `registerRuntimeWorkerAdapters` | Register runtime worker adapters or Comlink stubs to communicate with dedicated workers. | `registerRouteRuntimeWorkerAdapters`, `registerShapeRuntimeWorkerAdapters` (often wraps `createStageWorkerClient`). |

### Worker adapters
- `registerRouteRuntimeWorkerAdapters`, `registerShapeRuntimeWorkerAdapters`, etc. call `register<Plugin>RuntimeWorkerClient` to store a provider that returns a Comlink proxy to a dedicated worker. This enables runtime switching between local mocks and real workers.
- They depend on the worker sandbox being ready (typically guarded by feature flags like `ROUTE_RUNTIME_WORKER`).

### Download services
- Plugins now construct download services on demand via `get<Location|Route>DownloadService`. Host applications can still inject factories through `register*DownloadServiceFactory`, but there is no longer a global registration hook executed during wiring.

### Moving work to the generator
To minimize runtime reflection, future iterations can have `scripts/generate-plugin-loader.mjs` emit per-plugin initialization code (calling the hooks) instead of relying on `wirePluginsFromModules` to discover them. This document captures the current responsibilities so that refactors can map each usage explicitly.
