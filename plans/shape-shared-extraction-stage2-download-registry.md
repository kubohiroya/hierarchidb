# Stage 2: Unify Download Service Registry and Auth Fetch

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repository root at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, all geographic plugins use a single download registry that handles shared concerns: CORS proxy resolution, auth recovery notification, retry configuration, and download caching. A developer can configure download behavior once and see consistent behavior in shape, location, and route. The change is verified by running plugin typechecks and confirming that plugin download logic imports the shared registry helper instead of local copies.

## Progress

- [ ] (2025-12-26 10:55 JST) Draft plan created; implementation not started.
- [ ] (2025-12-26 11:41 JST) Review update drafted; cache/auth/CORS responsibilities clarified.

## Surprises & Discoveries

- Observation: The shape plugin has a bespoke download helper, while location and route each define their own registry patterns with similar capabilities.
  Evidence: `plugins/shape-plugin/src/services/utils/downloadService.ts`, `plugins/location-plugin/src/services/download/registry.ts`, `plugins/route-plugin/src/services/download/registry.ts`.
- Observation: Shape caches a single `DownloadServiceBundle`, while location/route instantiate per request via a factory, meaning unified caching rules must be explicit.
  Evidence: `plugins/shape-plugin/src/services/utils/downloadService.ts` (cached promise), registry factories in location/route.

## Decision Log

- Decision: Move shared registry logic into `packages/` rather than a UI package.
  Rationale: The helper is runtime-agnostic and already depends on `@hierarchidb/download` internals.
  Date/Author: 2025-12-26 / Codex
- Decision: Define a per-plugin cache policy (default: cache by pluginId + resolved options signature).
  Rationale: Shape’s behavior relies on a cached service, while location/route allow per-call options; the unified registry must preserve both behaviors.
  Date/Author: 2025-12-26 / Codex

## Outcomes & Retrospective

Pending. This section will summarize what was achieved and any remaining gaps after implementation.

## Context and Orientation

Download services are created via `@hierarchidb/download` and can be customized with options such as `dbPrefix`, `perHostConcurrency`, and CORS proxy handling. The shape plugin maintains `downloadArrayBuffer` and `downloadJson` helpers, whereas location and route use a registry abstraction that supports injection and auth notifications. Auth recovery hooks live in `@hierarchidb/auth-recovery` and `@hierarchidb/common-auth`.

Shape’s helper resolves a CORS proxy base and uses `resolveNetworkUrl`, while location/route registries provide auth notifier fallbacks and allow host injection via a factory. The unified registry must reconcile these behaviors by (1) encoding how URLs are resolved, (2) describing when a cached service is reused, and (3) declaring the priority order for auth notifications.

Key files:

- `plugins/shape-plugin/src/services/utils/downloadService.ts`
- `plugins/location-plugin/src/services/download/registry.ts`
- `plugins/route-plugin/src/services/download/registry.ts`
- `plugins/shape-plugin/src/services/utils/authFetch.ts`
- `plugins/location-plugin/src/services/utils/authFetch.ts`
- `packages//src/index.ts`
- `packages//src/helpers/resolveNetworkUrl.ts`

A “download registry” in this plan means a small module that creates or returns a `DownloadServiceBundle` and provides auth notification hooks.

## Plan of Work

Create a new module in `packages/` that owns the plugin download registry. It should expose factory registration, option defaults, and helpers for array-buffer and JSON downloads. Consolidate the CORS proxy resolution and auth fetch logic into the same package. Then replace the plugin-specific registry and helper modules in shape, location, and route to use the shared module. Preserve plugin-specific defaults like dbPrefix and concurrency via parameters to the shared helper.

The registry must explicitly define its cache key. The planned default is: `pluginId + json(options)` where `options` is the merged configuration (`dbPrefix`, `perHostConcurrency`, `corsProxyBaseURL`). If `options` are omitted, the helper returns a cached instance per plugin. This preserves shape’s single cached instance while still allowing location/route to override concurrency in a deterministic way.

Auth notification should follow a consistent precedence: (1) explicit registry callback registered by the plugin host, (2) `AuthNotificationRegistry.getInstance()` if present, (3) legacy globals (`authNotificationRegistry`, `authRegistry`). This precedence must be captured in the new helper to avoid silent divergence.

## Concrete Steps

1) Add a new module `packages//src/pluginDownloadRegistry.ts` exporting:

   - `registerPluginDownloadServiceFactory(pluginId, factory)`
   - `getPluginDownloadService(pluginId, options)`
   - `configurePluginDownloadDefaults(pluginId, options)`
   - `registerPluginAuthNotifier(pluginId, callback)`
   - `notifyPluginAuthRequired(pluginId, payload)`
   - `downloadArrayBuffer(pluginId, url, prefix, retryOptions)`
   - `downloadJson(pluginId, url, prefix, retryOptions)`

   The helper should internally manage per-plugin defaults and share a single implementation for CORS proxy resolution and retry logic.

2) Create a shared `authFetch` helper in `packages//src/helpers/authFetch.ts` that uses `AuthRecoveryService` and `resolveNetworkUrl`. It should accept a `pluginType` string and pass it to `fetchWithAuth`.

3) Add a shared URL resolver helper (for example `resolveDownloadUrl`) that applies the CORS proxy policy in one place, and use it in both `authFetch` and the download helpers.

4) Update `packages//src/index.ts` to export the new registry and helper functions.

5) Replace the shape download helper with calls to the new registry, and delete or deprecate `plugins/shape-plugin/src/services/utils/downloadService.ts` if unused after migration. Preserve the shape-specific `dbPrefix: 'shape'` default in the registry.

6) Update `plugins/location-plugin/src/services/download/registry.ts` and `plugins/route-plugin/src/services/download/registry.ts` to thin wrappers that call the shared registry with `pluginId` and defaults. Keep existing export names to minimize downstream changes.

7) Fix `plugins/location-plugin/src/services/utils/authFetch.ts` (currently sets pluginType to shape) by routing to the shared helper and passing the correct plugin type string.

8) Document the pluginType naming convention as a string literal union (e.g. `'shape' | 'location' | 'route'`) within the new helper to prevent mismatches.

## Validation and Acceptance

- Run `pnpm --filter @hierarchidb/download typecheck` and expect exit code 0.
- Run `pnpm --filter @hierarchidb/shape-plugin typecheck`, `pnpm --filter @hierarchidb/location-plugin typecheck`, and `pnpm --filter @hierarchidb/route-plugin typecheck` and expect exit code 0.
- Verify that the shared registry exports are used in all three plugins and no duplicate registry logic remains.
- If possible, confirm that a 401 download triggers the same auth notification path as before by exercising a protected URL in a dev environment.

## Idempotence and Recovery

The migration is safe to re-run. To rollback, revert the shared registry additions and restore the plugin-specific modules to their prior content, then re-run the typecheck commands for the affected plugins.

## Artifacts and Notes

Expected usage example in a plugin wrapper:

  export async function getLocationDownloadService(opts?: LocationDownloadOptions) {
    return getPluginDownloadService('location', opts);
  }

## Interfaces and Dependencies

- New module: `packages//src/pluginDownloadRegistry.ts`.
- Depends on: `createDownloadService`, `resolveNetworkUrl`, `AuthRecoveryService`.
- No new external dependencies.

Revision note (2025-12-26): 精査指摘（キャッシュ戦略、auth通知順序、CORS責務、pluginType定義）を反映するため、Plan of Work/Concrete Steps/Validation を具体化して追記。
