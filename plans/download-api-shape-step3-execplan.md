# Rationalize download APIs, remove any types, and cache Step3 country metadata

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` in the repository root.

## Purpose / Big Picture

Users should be able to open the Shape plugin Step3 (country selection) without CORS failures while still downloading fresh country metadata when it changes. The `@hierarchidb/download` package should no longer expose a confusing set of entry points or rely on `any` types. `packages/fetch-save-metadata` should no longer maintain a redundant fetch-with-retry helper. After this work, Step3 metadata fetches will go through the download service layer with conditional requests and caching, the fetch-save-metadata flow will use `@hierarchidb/download`, and the download package will present a cleaner, typed API surface that matches actual usage in the repo.

## Progress

- [x] (2026-01-03 17:19 JST) Drafted ExecPlan for download API cleanup and Step3 metadata caching.
- [x] (2026-01-03 17:41 JST) Inventory `any` usage in `packages/` and define replacement types.
- [x] (2026-01-03 17:41 JST) Define the target public API surface for `@hierarchidb/download` based on active repo use cases.
- [x] (2026-01-03 17:41 JST) Implement typed download service and caching helpers with conditional requests.
- [x] (2026-01-03 17:41 JST) Migrate callers to the cleaned API exports and remove redundant public exports.
- [x] (2026-01-03 17:41 JST) Update Shape Step3 metadata availability fetching to use download caching + content negotiation.
- [x] (2026-01-03 17:41 JST) Replace `packages/fetch-save-metadata/src/utils/fetchWithRetry.ts` with `@hierarchidb/download` usage and delete the redundant file.
- [x] (2026-01-03 18:37 JST) Run package and plugin typechecks; capture outcomes.
- [ ] Update this plan’s Decision Log and Outcomes with results.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Implement Step3 metadata fetching via the download service layer using conditional GET headers (ETag/Last-Modified) and JSON Accept headers.
  Rationale: This provides explicit content negotiation and cache validation while keeping traffic inside the download service abstraction.
  Date/Author: 2026-01-03 / Codex

- Decision: Replace `any` usage in download package with explicit typed records (e.g., `Record<string, unknown>`, `Dexie` table generics, or named interfaces).
  Rationale: Requirement is to remove `any` across the package; explicit types also make API clean-up safer.
  Date/Author: 2026-01-03 / Codex

- Decision: Trim the root `@hierarchidb/download` exports to only the APIs used in this repository (service, registry, auth helpers, core adapters, CORS proxy accessors).
  Rationale: Reduces redundant entry points while keeping existing use cases intact and documented.
  Date/Author: 2026-01-03 / Codex

- Decision: Extend `downloadJson` with a `cache: 'conditional'` option rather than introducing a new public helper.
  Rationale: Keeps the public surface smaller while enabling Step3 metadata caching and content negotiation.
  Date/Author: 2026-01-03 / Codex

- Decision: Replace `fetch-save-metadata` retry helper with `FetchNetworkPort` to reuse download retry semantics.
  Rationale: Avoids duplicating retry logic and consolidates network behavior under `@hierarchidb/download`.
  Date/Author: 2026-01-03 / Codex

## Outcomes & Retrospective

Implemented typed storage metadata, trimmed public download exports, and added conditional caching to `downloadJson` for Step3 availability fetches. Replaced `fetch-save-metadata` retry helper with `FetchNetworkPort` and removed the redundant file. Validation completed: download typecheck/build:types and shape-plugin typecheck succeeded; no functional UI verification performed yet.

## Context and Orientation

`@hierarchidb/download` lives at `packages/`. It currently exports many modules from `packages//src/index.ts`, including low-level ports, adapters, helpers, and registry utilities. Callers across plugins and runtime-worker import a mix of `FetchNetworkPort`, `DownloadService`, `downloadJson`, `downloadArrayBuffer`, `getPluginDownloadService`, `authFetch`, and `resolveNetworkUrl`.

`packages/fetch-save-metadata` includes `src/utils/fetchWithRetry.ts`, which re-implements retrying fetch logic that overlaps `@hierarchidb/download`. That helper should be removed and callers should use the download package instead.

Shape Step3 country selection uses `plugins/shape-plugin/src/ui/hooks/useCountryMetadata.ts` and an availability worker at `plugins/shape-plugin/src/ui/workers/countryAvailability.worker.ts`. The worker uses `plugins/shape-plugin/src/services/datasources/CountryAvailabilityResolver.ts`, which calls GeoBoundaries strategy methods that hit `https://www.geoboundaries.org/api/current/available/`. That fetch currently goes through `downloadJson`, but does not apply explicit cache validation or content negotiation. The UI displays “Loading country metadata...” while this availability fetch runs.

The download package contains `any` usage in `index.ts`, `ports.ts`, `adapters/FetchNetworkPort.ts`, and `adapters/DexieChunkStoragePort.ts`. These need to be fully typed.

## Plan of Work

First, audit and list every `any` usage inside `packages/`. Replace each with a named interface or `Record<string, unknown>` and tighten Dexie table types. Update `StoragePort.commit` to use a typed metadata interface rather than `Record<string, any>`. Update FetchNetworkPort retry logic to track `unknown` rather than `any` errors.

Second, inventory current import sites of `@hierarchidb/download` and group them into concrete use cases: (1) plugin download registry usage, (2) direct port usage in runtime-worker and tools, and (3) auth-aware network calls. Based on that inventory, define a target public API surface and update `packages//src/index.ts` to export only those intended entry points. Move or rename helper exports as needed, then update all imports across the repo to the new API names. Keep the API surface minimal and match real usage; document any migration steps in this plan.

Third, introduce a cached JSON fetch helper in `@hierarchidb/download` that uses `FetchNetworkPort` (or a compatible `NetworkPort`) and stores metadata (ETag, Last-Modified, content type, fetched timestamp) in a typed cache record. The helper should send `Accept: application/json` and add `If-None-Match` / `If-Modified-Since` when cached metadata is available. When a 304 is returned, it should reuse cached bytes and avoid re-downloading the body. Store cached bytes using the existing Dexie chunk storage or Cache API adapter, and ensure the metadata is keyed by URL.

Fourth, remove `packages/fetch-save-metadata/src/utils/fetchWithRetry.ts` and update its call sites to use `@hierarchidb/download` instead. Keep behavior parity by configuring retries and headers on the download service, and document any minor differences in this plan.

Finally, update Shape Step3 to use the new cached JSON helper for geoboundaries availability (and any country metadata download path) so that UI metadata loading benefits from caching and content negotiation. Remove any direct fetch paths in that flow. Ensure failures fall back to bundled metadata as before, but report the correct source in logs. Update related tests or add new ones if needed.

## Concrete Steps

1. From repo root, list `any` usage in `@hierarchidb/download` and note files:

   rg -n "\\bany\\b" packages/

2. For each `any`, introduce explicit types in the following files:

   - `packages//src/ports.ts`
   - `packages//src/index.ts`
   - `packages//src/adapters/FetchNetworkPort.ts`
   - `packages//src/adapters/DexieChunkStoragePort.ts`

3. Inventory import sites and categorize use cases:

   rg -n "@hierarchidb/download" -S

4. Update `packages//src/index.ts` to export only the target public APIs and update call sites accordingly.

5. Add a cached JSON helper in `@hierarchidb/download` that uses conditional GET headers and stores ETag/Last-Modified metadata. Ensure the helper uses a typed cache record keyed by URL.

6. Update Shape Step3 availability/metadata fetch path to use the cached JSON helper via the download service layer.

7. Replace `packages/fetch-save-metadata/src/utils/fetchWithRetry.ts` with `@hierarchidb/download` usage and remove the file; update imports.

8. Run targeted checks:

   pnpm --filter @hierarchidb/download typecheck
   pnpm --filter @hierarchidb/shape-plugin typecheck

## Validation and Acceptance

- Step3 country metadata loads without CORS errors in the browser, and the network log shows conditional requests with `If-None-Match` or `If-Modified-Since` headers when cached.
- The response for a cached request should return 304 or a cache hit without re-downloading the body, and the UI should still render country data.
- `pnpm --filter @hierarchidb/download typecheck` succeeds with no TypeScript errors after removing `any` types.
- All imports from `@hierarchidb/download` continue to resolve after API cleanup, and any deprecated entry points are removed or replaced.

## Idempotence and Recovery

All edits are source changes and can be re-run safely. If a change breaks a caller, revert the corresponding import updates and restore the prior export in `packages//src/index.ts`. If the cache helper misbehaves, fall back to the previous `downloadJson` path and log the decision in the linked GitHub Issue.

## Artifacts and Notes

Capture:

- A short excerpt of the updated download API exports.
- A snippet of conditional request headers from browser devtools.
- The typecheck command outputs (exit code and summary lines).

## Interfaces and Dependencies

Use these modules explicitly:

- `packages//src/adapters/FetchNetworkPort.ts` for HTTP access with retry/throttle.
- `packages//src/DownloadService.ts` for file download orchestration.
- `packages//src/pluginDownloadRegistry.ts` for plugin-scoped service creation.
- `packages//src/ports.ts` for typed `NetworkPort`, `StoragePort`, and metadata interfaces.
- `plugins/shape-plugin/src/ui/workers/countryAvailability.worker.ts` and `plugins/shape-plugin/src/services/datasources/CountryAvailabilityResolver.ts` for Step3 availability fetching.

Ensure that the caching helper accepts a `NetworkPort` and a storage/cache adapter to keep the download layer portable across UI and worker environments.

---

Plan change note: Initial draft created on 2026-01-03 to cover API cleanup, any removal, and Step3 metadata caching requirements.
Plan change note: 2026-01-03 added fetch-save-metadata replacement requirement and execution steps per user request.
