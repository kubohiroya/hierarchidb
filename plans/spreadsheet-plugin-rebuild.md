# Rebuild Spreadsheet Plugin on Shared Tabular Stack

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds. Maintain this plan in accordance with `PLANS.md`.

## Purpose / Big Picture

We are replacing the legacy spreadsheet plugin with a new implementation that sits on the shared tabular ingestion stack (`@hierarchidb/tabular-source`, `@hierarchidb/tabular-store`, `@hierarchidb/ui/tabular-extract`). After this work, users can upload or download CSV/TSV data inside the generic multi-step dialog, reuse the resulting tables across plugins (Styler, etc.), and preview/filter rows without bespoke Dexie tables. Success is demonstrated by the spreadsheet dialog wiring into folder/styler flows, `SpreadsheetTabularApiDriver` matching existing test coverage, and the worker/UI manifests exposing the same public API under the modern storage scheme.

## Progress

- [x] (2025-11-20 00:26Z) Captured requirements, audited existing spreadsheet/styler consumers, and drafted this ExecPlan referencing PLANS.md.
- [x] (2025-11-20 09:55Z) Implemented shared table services (`SpreadsheetMetadataManager`, `SpreadsheetStorePort`, `SpreadsheetCsvApiDriver`, `createSpreadsheetCSVApi`) and utility helpers under `plugins/spreadsheet-plugin/src/services/`.
- [x] (2025-11-20 10:05Z) Built UI steps backed by `@hierarchidb/ui-tabular-extract` and registered them via `src/ui/components/steps-provider.tsx`.
- [x] (2025-11-20 10:20Z) Wired manifest/index/worker/icon exports so the plugin exposes the same surface area as before (peer store only).
- [x] (2025-11-20 11:02Z) Added README/ExecPlan docs plus `SpreadsheetCsvApiDriver` vitest coverage; `pnpm --filter @hierarchidb/spreadsheet-plugin typecheck` and `pnpm --filter @hierarchidb/spreadsheet-plugin test -- run` now pass (styler dependence still pending follow-up).
- [x] (2025-11-20 13:29Z) Updated styler plugin to extend the new spreadsheet types, wire TreeNode payloads via `createNodePayloadPeerStore`, reuse shared steps, and green its vitest suite with the refreshed mocks.

## Surprises & Discoveries

- Observation: `@hierarchidb/tabular-source` selects the JSONL parser when ingest input lacks a Blob `name/type` signal. Evidence: passing plain strings during tests produced zero columns and JSON parsing exceptions. Resolution: keep ingest source as a real `File`/`Blob` (after patching Vitest to use Node's Blob implementation) so CSV detection receives the `.csv` extension.

## Decision Log

- Decision: Use `@hierarchidb/tabular-source` + a custom `SpreadsheetStorePort` wrapping `TabularWriter` for ingestion instead of porting the legacy Dexie schema.
  Rationale: Reuses the new shared chunk/index infra and keeps payloads on core `TreeNode`, simplifying persistence.
  Date/Author: 2025-11-20 / Codex.

## Outcomes & Retrospective

- To be filled once the new plugin ships (cover verification status, remaining risks).

## Context and Orientation

- `plugins/deprecated-spreadsheet-plugin/` holds the old implementation (bespoke Dexie DB, custom steps) and now lives under the `@hierarchidb/deprecated-spreadsheet-plugin` package for reference only.
- `plugins/spreadsheet-plugin/` currently contains only `package.json` and empty `src/` folders. We must add TS configs, manifests, services, UI, and worker wiring here.
- Shared ingestion lives under `packages/features/tabular-source` (parsers/tabular service) and `packages/features/tabular-store` (metadata manager, `TabularWriter`, `TabularQueryService`). These are the new persistence primitives.
- UI helpers for the dialog exist under `packages/ui/tabular-extract` (file upload step, filtering step, hooks/context) and rely on a `TabularDataApi` implementation that we must provide.
- Styler plugin (`plugins/styler-plugin`) consumes `SpreadsheetTabularApiDriver`, `TabularDataSourceStep`, `TabularDataFilterStep`, and plugin manifests directly, so the new package must keep these exports ABI-compatible.

## Plan of Work

1. **Scaffold project configs**
   - Add `tsconfig.json`, `vitest.config.ts`, and optional `README.md` under `plugins/spreadsheet-plugin/`, mirroring the structure used by other plugins (extend `../../tsconfig.base.json`, wire `paths`, and configure vitest with jsdom + fake-indexeddb for driver tests).
   - Create `src/preconnect.ts`, `src/plugin-manifest.ts`, and folder stubs (`common`, `icon`, `services`, `ui`, `worker`) to host the new code.

2. **Define spreadsheet domain types**
   - Under `src/common/types/SpreadsheetEntity.ts`, describe `DataSourceConfig`, `SpreadsheetDialogData`, `SpreadsheetWorkingCopy`, and `SpreadsheetPeerData`. Keep them free of `Record<string, unknown>` by spelling out fields (metadata id, filters, file info, etc.).
   - Add `src/common/constants.ts` with plugin id/version strings and node-type metadata reused by manifest/steps.

3. **Implement shared tabular services**
   - Add `src/services/SpreadsheetMetadataManager.ts` (thin wrapper around `StylerMetadataManager` with DB name `spreadsheet-metadata-db`).
   - Implement `src/services/SpreadsheetStorePort.ts`:
     - Accept constructor options `{ pluginId, metadataManager, filename, fileSizeBytes, contentHash }`.
     - On `beginIngest`, instantiate `TabularWriter(pluginId)` and `await writer.begin({ filename, columns })`, tracking session state (writer, derived column stats, sample values).
     - On `writeChunk`, normalize each row (trim, coerce numbers/booleans/dates) while updating per-column stats (type inference, null flags, sample values), then forward to `writer.writeRows`.
     - On `commit`, flush the writer and call `metadataManager.create` with `CSVTableMetadataLike` containing computed columns, `contentHash`, size, and chunk counts; return that metadata.
     - On `abort`, drop session state (best-effort).
   - Build `src/services/SpreadsheetTabularApiDriver.ts` that implements `TabularDataApi`:
     - Methods `uploadCSVFile`, `downloadCSVFromUrl`, `getFilteredPreview`, `getFilteredData`, `listTables`, `deleteTable`, `addTableReference`, `removeTableReference`, `getTableMetadata`.
     - Deduplicate uploads by hashing (`crypto.subtle.digest('SHA-256', arrayBuffer)`) and calling `metadataManager.findByContentHash` before ingest; ensure `addTableReference` runs when reusing.
     - Use `TabularService.ingest(file, new SpreadsheetStorePort(...))` for uploads.
     - For filtering, stream chunks from `getRowStoreDB().rowChunks.where('[pluginId+tableId]').equals([pluginId, tableId])`, apply the rule engine (support equals/not_equals/contains/not_contains/starts_with/ends_with/gt/gte/lt/lte/is_null/is_not_null/regex) and cap preview rows by `rowCount` while counting matches.
     - `getFilteredData` should honor `CSVSelectionConfig` by limiting columns to `selection.valueColumns` (fall back to all columns) and reusing the same rule engine.
     - `listTables` should support filtering by pluginId via `referencingPlugins` and paginate with `offset/limit`.
     - `deleteTable` and auto-delete on `removeTableReference` must also purge row chunks/indexes associated with `[pluginId, tableId]` in `RowStoreDB`.
     - Expose helper `toCsvMetadata` to convert `CSVTableMetadataLike` (Dexie) into the full `CSVTableMetadata` structure expected by UI/tests.
   - Export a simple facade `createSpreadsheetCSVApi(pluginId)` under `src/services/preconnect.ts` that memoizes the driver and returns a `TabularDataApi`.

4. **UI components built on shared steps**
   - Within `src/ui/components/steps`, implement:
     - `TabularDataSourceStep.tsx`: wraps `CSVFileUploadStep` from `@hierarchidb/ui/tabular-extract` inside a `CSVProvider` created with `createSpreadsheetCSVApi`, updates `SpreadsheetDialogData` (`spreadsheetMetadataId`, `dataSource`, `file`) via `onChange`, and calls `setValid` when metadata + dataSource is present.
     - `TabularDataFilterStep.tsx`: uses `useCSVData` to load metadata by id and renders `CSVFilterStep` plus wiring to persist `filters` and preview payload inside the dialog data.
   - Add `src/ui/components/steps-provider.tsx` registering the spreadsheet step configs (Data Source + Filtering) with `PluginStepRegistry`. Ensure BasicInfo isn’t redefined (honors the shared stepper).
   - Provide `src/ui/preconnect.ts` to re-export `TabularDataSourceStep`, `TabularDataFilterStep`, and `createSpreadsheetCSVApi` for downstream consumers (Styler).

5. **Manifest, worker, icon, and package entry**
   - Copy the AssessmentIcon export into `src/icon/preconnect.ts`.
   - Author `src/plugin-manifest.ts` mirroring the original manifest but drop unused DB prewarm entries (we no longer preload bespoke Dexie DBs). Keep worker preload referencing the new registration function.
   - Implement `src/worker/factory/registerSpreadsheetWorkerStores.ts` that only registers a peer store via `createNodePayloadPeerStore` (no group/relation Dexie) and exports `loadSpreadsheetEntitiesDbModule` as a no-op (or remove entirely if unused).
   - Update `src/preconnect.ts` to export the manifest, common types, services, UI components, and worker entry points so existing imports continue to resolve.

6. **Docs and verification**
   - Add/update `plugins/spreadsheet-plugin/README.md` (or section in `docs/plugins/working-copy-initial-payloads.md`) to explain the new architecture, ingestion flow, and how other plugins consume the API.
   - Create at least one focused vitest under `plugins/spreadsheet-plugin/src/__tests__/` that exercises `SpreadsheetTabularApiDriver` (upload + filter + references) using `fake-indexeddb`.
   - Update `package.json` scripts/exports if needed (e.g., add `typesVersions` entries for new subpaths).

## Concrete Steps

1. Author config and type files (`tsconfig.json`, vitest config, README skeleton) with `apply_patch` or `tee`.
2. Implement services (`SpreadsheetMetadataManager`, `SpreadsheetStorePort`, `SpreadsheetTabularApiDriver`, facade) and export barrels.
3. Build UI steps and provider, ensuring they import shared components instead of bespoke ones.
4. Wire manifest/index/worker/icon exports.
5. Add vitest suites plus any necessary fixtures under `plugins/spreadsheet-plugin/src/__tests__`.
6. Run:
   - `pnpm --filter @hierarchidb/spreadsheet-plugin typecheck`
   - `pnpm --filter @hierarchidb/spreadsheet-plugin test -- run`
   - `pnpm --filter @hierarchidb/styler-plugin test -- run` (ensures downstream reuse still passes).
   Record command logs in `TASKS.md` per project policy.

## Validation and Acceptance

- Upload/URL steps in the folder/styler dialogs must accept a CSV file, persist metadata, and advance to Filtering without errors.
- `SpreadsheetTabularApiDriver` must pass its new vitest suite plus the existing Styler CSV workflow tests (proof that filtering, dedup, and reference management behave).
- `pnpm --filter @hierarchidb/{spreadsheet,styler}-plugin typecheck` and `test` exit 0.
- No plugin still references the deprecated Dexie tables (verify via `rg` for `SpreadsheetDatabase` or `peerEntities` within the new plugin).

## Idempotence and Recovery

- Re-running the ingestion/upload logic is safe: `CSVTableMetadata` deduplication by content hash prevents duplicates and just increments references.
- Dexie schema changes are localized to new DB names; deleting IndexedDB (`indexedDB.deleteDatabase(...)`) restores a clean state for manual testing if necessary.
- Source edits are additive; if a step fails, re-run the corresponding `pnpm` command after fixing the code. Worker-store registration is idempotent (guards on `registry.getPeer`).

## Artifacts and Notes

- Capture any notable vitest output or Dexie debug logs here once available (e.g., a snippet showing `SpreadsheetTabularApiDriver` returning filtered rows).
- Note any generated assets or needed manual IndexedDB cleanup instructions for QA.

## Interfaces and Dependencies

- Public API surface retained:
  - `SpreadsheetTabularApiDriver` class and `createSpreadsheetCSVApi(pluginId)` factory (under `@hierarchidb/spreadsheet-plugin/services`).
  - `TabularDataSourceStep` and `TabularDataFilterStep` React components (under `@hierarchidb/spreadsheet-plugin/ui`).
  - Worker exports `registerSpreadsheetWorkerStores`, `loadSpreadsheetEntitiesDbModule`.
  - Manifest export `SpreadsheetPluginManifest`.
- Internal dependencies:
  - `@hierarchidb/tabular-source` (`TabularService`, `TabularStorePort` types).
  - `@hierarchidb/tabular-store` (`TabularWriter`, `StylerMetadataManager`, `TabularQueryService`, `getRowStoreDB`).
  - `@hierarchidb/ui/tabular-extract` (`CSVProvider`, `CSVFileUploadStep`, `CSVFilterStep`, hooks).
  - Dexie (already available via `TabularWriter`/RowStore) and `fake-indexeddb` for tests.

---
Revision note (2025-11-20): Initial ExecPlan drafted after auditing requirements and shared tabular assets.
