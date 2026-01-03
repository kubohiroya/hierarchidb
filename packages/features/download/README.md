# @hierarchidb/download

Download foundation with pluggable network/storage/integrity ports. Ships capability hooks and default adapters for browser environments.

## Directory layout
```
DownloadService.ts         Download orchestration
ports.ts                   Internal port contracts
capability.ts              Internal download enablement flag
createDownloadService.ts   Helper to build a service with defaults
cas/                       Internal content-addressable storage helpers
adapters/                  FetchNetworkPort, Dexie ports, cache helpers
helpers/auth.ts            Auth-aware network port helper
helpers/authFetch.ts       Auth recovery fetch helper
helpers/resolveNetworkUrl.ts  CORS proxy + local proxy resolution (exports only get/set for proxy)
index.ts                   Public exports + FeatureDefinition manifest
```

## Key exports
- `DownloadService` — orchestrates download with retries and integrity.
- `FetchNetworkPort` — HTTP adapter with retries, throttling, and optional CORS proxy.
- `DexieChunkStoragePort` — IndexedDB-backed chunk storage.
- `createDownloadService` — builds a default service bundle (auth-aware network + Dexie storage).
- Plugin registry helpers: `configurePluginDownloadDefaults`, `getPluginDownloadService`, `downloadArrayBuffer`, `downloadJson`, `postJson`.
- Auth helpers: `authFetch`, `createAuthAwareNetworkPort`.
- CORS proxy helpers: `setCorsProxyBaseURL`, `getCorsProxyBaseURL`.
- Capability: `FeatureDefinition.manifest` (`provides: ['download','cas','net.port']`); `FeatureDefinition.init` optionally provides default `net.port`.

## Consumers / usage
- Worker runtime and plugins (shape/route/location/etc.) compose `DownloadService` with Fetch + Dexie ports for offline persistence.
- `@hierarchidb/auth-recovery` pairs via `createAuthAwareNetworkPort` to attach Authorization and auto-retry on 401.
- App dev server can proxy CORS with `HDB_LOCAL_PROXY=1` (`/proxy`).

## Notes
- `downloadJson` supports conditional caching when `cache: 'conditional'` is set; it sends `Accept: application/json` and revalidates with ETag/Last-Modified.
- Serial downloads by default; range/resume and bandwidth controls are on the roadmap.
