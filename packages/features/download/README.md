# @hierarchidb/download

Download foundation with pluggable network/integrity ports and auth helpers. Ships capability hooks and default adapters for browser environments.

## Directory layout
```
DownloadService.ts           Download orchestration
ports.ts                     Internal port contracts
capability.ts                Internal download enablement flag
adapters/                    FetchNetworkPort helpers
helpers/auth.ts              Auth-aware network port helper
helpers/authFetch.ts         Auth recovery fetch helper
helpers/resolveNetworkUrl.ts CORS proxy + local proxy resolution (exports only get/set for proxy)
authNotifications.ts         Auth-required notifications
postJson.ts                  Auth-aware JSON POST helper
index.ts                     Public exports
```

## Key exports
- `DownloadService` — orchestrates download with retries and integrity.
- `FetchNetworkPort` — HTTP adapter with retries, throttling, and optional CORS proxy.
- `postJson` — auth-aware JSON POST helper.
- Auth notifications: `registerPluginAuthNotifier`, `notifyPluginAuthRequired`.
- Auth helpers: `authFetch`, `createAuthAwareNetworkPort`.
- CORS proxy helpers: `setCorsProxyBaseURL`, `getCorsProxyBaseURL`.

## Consumers / usage
- Worker runtime and plugins (shape/route/location/etc.) compose `DownloadService` with Fetch + storage ports for persistence.
- `@hierarchidb/auth-recovery` pairs via `createAuthAwareNetworkPort` to attach Authorization and auto-retry on 401.
- App dev server can proxy CORS with `HDB_LOCAL_PROXY=1` (`/proxy`).

## Notes
- Serial downloads by default; range/resume and bandwidth controls are on the roadmap.
