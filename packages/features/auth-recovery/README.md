@hierarchidb/auth-recovery
==========================

401 復帰フローを共通化する feature。`AuthNotificationRegistry` を介して UI と Worker/Feature を接続し、トークン更新→再試行までを一元化します。

## Directory layout
```
AuthRecoveryService.ts  Facade (token store, fetchWithAuth, headers)
ports.ts                Token provider hooks
capability.ts           Feature capability manifest
index.ts                Public exports + FeatureDefinition
```

## Key exports
- `AuthRecoveryService` — singleton facade: `setToken`, `getAuthHeaders`, `fetchWithAuth` (emits `AuthRequired`, waits for `AuthSuccess`/`AuthCancelled`, retries).
- Ports: token provider types for integration.
- Capability: `FeatureDefinition.manifest` (`provides: ['auth-recovery']`).

## Consumers / usage
- UI auth layer (`packages/ui/auth`) registers `AuthNotificationRegistry` handlers and calls `setToken` on login/refresh.
- Worker/feature HTTP paths wrap `fetch` with `fetchWithAuth` (plugins: shape, spreadsheet, styler, etc.).
- `@hierarchidb/download` pairs via `createAuthAwareNetworkPort` to inject Authorization headers and auto-retry on 401.

## Notes
- If UI does not reply with `AuthSuccess/AuthCancelled`, `fetchWithAuth` fails after timeout.
- Set token proactively to avoid 401; override retries with `ctx.maxRetries` when needed.
