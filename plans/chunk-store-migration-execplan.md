# Introduce @hierarchidb/chunk-store and migrate download responsibilities

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan must be maintained in accordance with `PLANS.md` in the repository root.

## Purpose / Big Picture

Plugins need a reusable, URL-keyed chunk storage that can be configured with custom Dexie databases/tables and custom serializers/deserializers. That storage must be separate from `@hierarchidb/download` so download stays simple, while `@hierarchidb/chunk-store` composes download internally. After this change, plugins explicitly inject their serialization logic and storage targets, making responsibilities clear and reducing `@hierarchidb/download` API complexity.

## Progress

- [x] (2026-01-03 19:35 JST) Created ExecPlan and task entry.
- [x] Define the `@hierarchidb/chunk-store` API surface and internal model (interfaces, serializer hooks, storage adapter contract).
- [x] Create the new package and implement Dexie-backed chunk storage with injectable DB/table and serializers.
- [x] Simplify `@hierarchidb/download` to focus on network/auth helpers and drop plugin-level caching/registry APIs.
- [x] Move CAS adapters (`HashPort`, `ContentIndexPort`, etc.) from download into chunk-store.
- [x] Add relation management (nodeId + metadataId) and dedupe identity selection (url/etag/url+etag/hash).
- [x] Update plugin call sites to use chunk-store injection (serializer/deserializer), removing higher-level responsibilities from download helpers.
- [x] Update docs/tests and capture outcomes.
- [ ] Run typechecks (blocked by missing node_modules).

## Surprises & Discoveries

- `pnpm --filter @hierarchidb/chunk-store typecheck` failed because node_modules were missing and @hierarchidb/download/@hierarchidb/util types could not resolve.

## Decision Log

- Decision: Name the new package `@hierarchidb/chunk-store`.
  Rationale: Reflects the reusable chunk storage role without implying download ownership.
  Date/Author: 2026-01-03 / Codex

- Decision: `@hierarchidb/chunk-store` will compose a simplified `@hierarchidb/download` internally rather than the other way around.
  Rationale: Keeps download small and lets chunk-store own URL-keyed caching and serialization concerns.
  Date/Author: 2026-01-03 / Codex

- Decision: CAS interfaces/adapters are hosted in chunk-store and reused for hash-based identity and dedupe.
  Rationale: Consolidates content-addressable features with storage and avoids download owning lifecycle concerns.
  Date/Author: 2026-01-03 / Codex

- Decision: chunk-store requires nodeId when creating/deleting chunk sets and keeps a relation table for lifecycle cleanup.
  Rationale: Aligns with TreeNode-driven lifecycle and enables safe cleanup when references drop to zero.
  Date/Author: 2026-01-03 / Codex

## Outcomes & Retrospective

- Implemented `@hierarchidb/chunk-store` with serializer/deserializer injection, relation management, and conditional GET support.
- Moved CAS helpers (`ContentAddressableStore`, DexieContentIndexPort, CacheAPICachePort, NobleSha3HashPort) into chunk-store for hash-based dedupe.
- Simplified `@hierarchidb/download` to network/auth helpers (`FetchNetworkPort`, `authFetch`, `postJson`, auth notifications).
- Migrated shape/route/runtime-worker/spreadsheet call sites to chunk-store with explicit serializers and nodeId association.
- Typechecks remain blocked until workspace node_modules are installed and download/util types resolve.

## Context and Orientation

`@hierarchidb/download` currently exports `DownloadService`, `FetchNetworkPort`, `DexieChunkStoragePort`, and plugin-level helpers such as `downloadJson`. Dexie chunk storage is used both by download and by unrelated features (e.g., vector tile generation), which blurs responsibilities. Plugins like spreadsheet and styler need URL-keyed chunk storage that can store structured content via custom serialization.

This plan introduces `packages/features/chunk-store` as a standalone package with a clear API for chunk storage, serialization, and URL-key mapping. `@hierarchidb/download` will become a smaller package focused on network orchestration and will be used internally by `chunk-store` when network fetching is needed.

## Plan of Work

First, define a `ChunkStore` interface in the new package that accepts:

- a Dexie database or table reference (so callers can decide storage location),
- a key strategy (URL or derived key), and
- serializer/deserializer functions (generic types to allow typed content).

Second, implement a Dexie-backed chunk store adapter in `@hierarchidb/chunk-store` that stores raw `ArrayBuffer` chunks plus metadata (etag, last-modified, content-type) and a URL index. Provide helper methods to `get`, `put`, and `getOrFetch` that use download’s network layer to populate storage when missing or stale.

Third, simplify `@hierarchidb/download` so that Dexie-specific storage and plugin-level caching helpers are removed. Keep download focused on `NetworkPort` + retry + auth helpers, and let chunk-store own persistence. CAS adapters move to chunk-store.

Fourth, update plugin call sites (spreadsheet, styler, and any other chunk-store consumers) so they inject serializer/deserializer functions into chunk-store rather than relying on download helpers to parse or cache content. The plugin code should explicitly handle serialization boundaries.

Finally, update docs (download and chunk-store READMEs), run typechecks, and log results in `TASKS.md`.

## Concrete Steps

1. Create `packages/features/chunk-store` with package.json, tsconfig, and README describing purpose and API.
2. Implement `src/index.ts` exporting the chunk-store interfaces and adapters.
3. Implement a Dexie adapter that accepts injected DB/table names and serializer/deserializer functions.
4. Refactor download helpers to remove plugin-level caching/registry APIs; update exports accordingly.
5. Update plugin code to call chunk-store with explicit serializers/deserializers.
6. Run:

   pnpm --filter @hierarchidb/chunk-store typecheck
   pnpm --filter @hierarchidb/download typecheck
   pnpm --filter @hierarchidb/spreadsheet-plugin typecheck
   pnpm --filter @hierarchidb/styler-plugin typecheck

## Validation and Acceptance

- Plugins using URL-keyed chunk storage compile without relying on download helper caching logic.
- Serialization boundaries are explicit in plugin code (custom serializer/deserializer provided to chunk-store).
- `@hierarchidb/download` no longer owns Dexie-specific storage responsibilities.
- Typechecks for chunk-store, download, and affected plugins succeed.

## Idempotence and Recovery

Changes are reversible by reverting the new chunk-store package and restoring the prior download storage path. If plugin migrations break, revert the specific plugin updates and keep chunk-store unused until ready.

## Artifacts and Notes

Capture:

- The new chunk-store public API definition.
- Example plugin usage showing serializer/deserializer injection.
- Typecheck command outputs.

## Interfaces and Dependencies

- `@hierarchidb/chunk-store` should depend on Dexie and reuse simplified `@hierarchidb/download` network ports.
- `@hierarchidb/download` should keep `NetworkPort` and auth helpers, but remove Dexie-specific caching logic.

---

Plan change note: Initial draft created on 2026-01-03 to cover chunk-store extraction and download simplification.
