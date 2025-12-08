# @hierarchidb/download

Download foundation with pluggable network/storage/integrity ports. Ships capability hooks and default adapters for browser environments.

## Directory layout
```
DownloadService.ts         Facade (progress, retries, integrity hook)
ports.ts                   NetworkPort / StoragePort / IntegrityPort contracts
capability.ts              Enable/disable download capability
createDownloadService.ts   Helper to build a service with defaults
cas/                       Content-addressable storage helpers (hashing)
adapters/                  FetchNetworkPort, CacheAPICachePort, Dexie ports, NobleSha3 hash
helpers/auth.ts            Auth-aware network port helper
index.ts                   Public exports + FeatureDefinition manifest
```

## Key exports
- `DownloadService` — orchestrates download with progress; accepts ports.
- Ports: `NetworkPort`, `StoragePort`, `IntegrityPort`.
- Adapters: `FetchNetworkPort`, `CacheAPICachePort`, `DexieChunkStoragePort`, `DexieContentIndexPort`, `NobleSha3HashPort`.
- Helpers: `createDownloadService`, `createAuthAwareNetworkPort`.
- Capability: `FeatureDefinition.manifest` (`provides: ['download','cas','net.port']`); `FeatureDefinition.init` optionally provides default `net.port`.

## Consumers / usage
- Worker runtime and plugins (shape/route/location/etc.) compose `DownloadService` with Fetch + Dexie ports for offline persistence.
- `@hierarchidb/auth-recovery` pairs via `createAuthAwareNetworkPort` to attach Authorization and auto-retry on 401.
- App dev server can proxy CORS with `HDB_LOCAL_PROXY=1` (`/proxy`).

## Notes
- Currently serial downloads; range/resume and bandwidth controls are on the roadmap.
- Integrity verification pluggable (e.g., WebCrypto SHA-256 via `NobleSha3HashPort`).
