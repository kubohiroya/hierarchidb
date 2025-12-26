# Stage 3: Unify Tabular API Creation and Metadata Managers

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repository root at `PLANS.md`. This ExecPlan must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, all plugins use the same tabular API factory and metadata manager base, with only plugin id and database names varying. This removes repeated code in shape, location, and route while keeping plugin-specific behavior (such as CORS proxy handling) configurable. The change is verified by typechecks and by confirming that each plugin’s tabular factory is a thin wrapper around a shared helper.

## Progress

- [ ] (2025-12-26 10:55 JST) Draft plan created; implementation not started.
- [ ] (2025-12-26 11:41 JST) Review update drafted; dependency direction clarified.

## Surprises & Discoveries

- Observation: Shape, location, and route each define almost identical metadata manager classes and tabular API factory functions.
  Evidence: `plugins/shape-plugin/src/services/tabular/createShapeTabularApi.ts`, `plugins/location-plugin/src/common/tabular/createLocationTabularApi.ts`, `plugins/route-plugin/src/common/tabular/createRouteTabularApi.ts`.
- Observation: The current plan places a factory in `packages/plugin-ui-sdk`, but that would introduce a package → plugin dependency because the driver lives in `@hierarchidb/spreadsheet-plugin`.
  Evidence: `SpreadsheetTabularApiDriver` is imported from `@hierarchidb/spreadsheet-plugin` in the plugin factories.

## Decision Log

- Decision: Host the shared factory in `plugins/spreadsheet-plugin` to avoid package → plugin dependency inversion.
  Rationale: The driver already lives in the spreadsheet plugin; other plugins already depend on it, so keeping the helper there avoids reversing dependency direction.
  Date/Author: 2025-12-26 / Codex

## Outcomes & Retrospective

Pending. This section will summarize what was achieved and any remaining gaps after implementation.

## Context and Orientation

Each plugin creates a `TabularDataApi` by instantiating a `SpreadsheetTabularApiDriver` and a plugin-specific `SimpleTableMetadataManager`. Location and route add CORS proxy handling in a subclass. The database names are derived from `getDBName` and a plugin-specific prefix.

Package dependencies should not point from `packages/*` into `plugins/*`. The prior plan violated this by placing a factory in `packages/plugin-ui-sdk` that required `@hierarchidb/spreadsheet-plugin`. The revised plan keeps shared logic inside the spreadsheet plugin so other plugins can import it without introducing an inversion.

Key files:

- `plugins/shape-plugin/src/services/tabular/createShapeTabularApi.ts`
- `plugins/shape-plugin/src/services/tabular/ShapeTabularMetadataManager.ts`
- `plugins/location-plugin/src/common/tabular/createLocationTabularApi.ts`
- `plugins/location-plugin/src/common/tabular/LocationTabularMetadataManager.ts`
- `plugins/route-plugin/src/common/tabular/createRouteTabularApi.ts`
- `plugins/route-plugin/src/common/tabular/RouteTabularMetadataManager.ts`
- `plugins/spreadsheet-plugin/src` (new shared factory location)

A “tabular API” in this plan is a `TabularDataApi` used by UI steps to ingest and process tabular datasets.

## Plan of Work

Create a shared helper in `plugins/spreadsheet-plugin` that can build a tabular API for any plugin based on three inputs: plugin id, metadata database name prefix, and an optional download URL transformer (for CORS proxy use). Also create a shared metadata manager base that is parameterized by the database name. Then, update the plugin-specific factory functions to call the shared helper and remove redundant metadata manager classes where possible.

Align the CORS proxy behavior with Stage 2. If a shared download registry provides a URL resolver, the tabular factory should accept it as `downloadUrlTransformer` rather than re-implementing proxy logic.

## Concrete Steps

1) Add `plugins/spreadsheet-plugin/src/shared/createPluginTabularApi.ts` exporting a function like:

   - `createPluginTabularApi({ pluginId, metadataDbName, downloadUrlTransformer })`

   The helper should instantiate `SimpleTableMetadataManager` with the provided database name and then create a `SpreadsheetTabularApiDriver` with the plugin id. If `downloadUrlTransformer` is provided, wrap the driver method `downloadTabularFromUrl` to apply the transform.

2) Add a small helper `createPluginTabularMetadataManager(metadataDbName)` in the same module, or inline the manager instantiation. Keep it exported so plugins can share naming consistency.

3) Export the new helper from `plugins/spreadsheet-plugin/src/index.ts` (or a dedicated public entrypoint) so other plugins can import it without deep path access.

4) Update shape’s `createShapeTabularApi` to call the shared helper with `pluginId: 'shape'` and `metadataDbName` equal to `getDBName('shape-tabular-metadata-db')`.

5) Update location and route `create*TabularApi` to call the shared helper with their plugin ids, and pass a CORS proxy transformer function instead of subclassing. Prefer to use a resolver from Stage 2 if available.

6) Delete or deprecate the plugin-specific metadata manager classes if no longer used; otherwise keep them as thin wrappers.

7) Remove the plan to update `packages/plugin-ui-sdk`, since the shared helper now lives in the spreadsheet plugin.

## Validation and Acceptance

- Run `pnpm --filter @hierarchidb/spreadsheet-plugin typecheck` and expect exit code 0.
- Run `pnpm --filter @hierarchidb/shape-plugin typecheck`, `pnpm --filter @hierarchidb/location-plugin typecheck`, and `pnpm --filter @hierarchidb/route-plugin typecheck` and expect exit code 0.
- Verify that the plugin-specific factories are minimal wrappers around the shared helper.

## Idempotence and Recovery

The steps are safe to repeat. To rollback, restore plugin-specific factory implementations and remove the new shared helper from `plugins/spreadsheet-plugin`, then re-run typechecks.

## Artifacts and Notes

Expected usage example in a plugin:

  export function createShapeTabularApi(): TabularDataApi {
    return createPluginTabularApi({
      pluginId: 'shape',
      metadataDbName: getDBName('shape-tabular-metadata-db'),
    });
  }

## Interfaces and Dependencies

- New helper: `createPluginTabularApi` in `plugins/spreadsheet-plugin`.
- Depends on: `SimpleTableMetadataManager`, `SpreadsheetTabularApiDriver`, `TabularDataApi`.
- Optional input: `downloadUrlTransformer` for CORS proxy needs.

Revision note (2025-12-26): 依存方向（packages → plugins）の問題を避けるため、共有 factory の配置を `plugins/spreadsheet-plugin` に変更し、手順と検証を更新した。
