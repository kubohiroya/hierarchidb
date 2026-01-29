# Consolidate location/route store APIs for host access

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This plan follows `PLANS.md` in the repository root and must be maintained in accordance with it.

## Purpose / Big Picture

Host-side code should refer to location and route Query/Mutation APIs via store packages rather than plugin-service-api or plugin modules. After this change, runtime-worker and common API types import Location/Route Query/Mutation interfaces from `@hierarchidb/location-store` and `@hierarchidb/route-store`, and plugin DB entrypoints remain thin re-exports. You can verify success by confirming that host-side imports no longer pull Location/Route API types from `@hierarchidb/plugin-service-api` and that the plugin database entrypoints remain re-exports of store implementations.

## Progress

- [x] (2025-12-28 12:20 JST) Define store-first import usage for Location/Route Query/Mutation APIs in host packages.
- [x] (2025-12-28 12:26 JST) Update runtime-worker and common API type imports to use store packages.
- [x] (2025-12-28 12:26 JST) Verify plugin DB entrypoints remain store re-exports and update documentation/logs.
- [ ] (2025-12-28 12:26 JST) Run targeted typechecks and record results.

## Surprises & Discoveries

- None yet.

## Decision Log

- Decision: Keep Query/Mutation interface definitions in `@hierarchidb/plugin-service-api` and import them via store re-exports in host packages.
  Rationale: This preserves the existing API source of truth while enforcing a store-first dependency direction for host usage.
  Date/Author: 2025-12-28 / Codex

## Outcomes & Retrospective

Host-side imports for Location/Route Query/Mutation APIs now go through store packages, but validation is still pending. Run the targeted typechecks to confirm there are no lingering type errors.

## Context and Orientation

Location and route API interfaces are defined under `packages/plugin-service-api/src/types` and are re-exported by store packages. Host-side packages such as `packages/runtime-worker` and `packages/common/api` currently import these types directly from `@hierarchidb/plugin-service-api`. Location and route database helpers already live in `packages/features/location-store` and `packages/features/route-store`, with plugin database entrypoints re-exporting those implementations. The goal is to make host code import API types through the store packages to align dependencies.

## Plan of Work

Update host-side imports to use `@hierarchidb/location-store` and `@hierarchidb/route-store` for Query/Mutation API types. Keep the actual type definitions in `@hierarchidb/plugin-service-api` and rely on store re-exports to avoid breaking existing code. Adjust runtime-worker service files, WorkerService, and common WorkerAPI type declarations. Confirm that plugin database entrypoints still re-export store implementations. Update TASKS and record validation results.

## Concrete Steps

Work from the repo root.

1) Update runtime-worker imports.
   - Replace Location/Route Query/Mutation type imports with store package exports in:
     - `packages/runtime-worker/src/WorkerService.ts`
     - `packages/runtime-worker/src/services/RouteMutationService.ts`
     - `packages/runtime-worker/src/services/RouteQueryService.ts`
     - `packages/runtime-worker/src/services/route/ideGsmCsv.ts`
     - `packages/runtime-worker/src/services/LocationMutationService.ts`
     - `packages/runtime-worker/src/e2e/test-worker.entry.ts`

2) Update common API type imports.
   - Replace Location/Route Query/Mutation type imports with store package exports in:
     - `packages/common/api/src/WorkerAPI.ts`

3) Confirm plugin database entrypoints remain re-exports.
   - `plugins/location-plugin/src/database/LocationDB.ts`
   - `plugins/route-plugin/src/services/database/RouteDB.ts`

4) Run typechecks and log results.

## Validation and Acceptance

Run the following commands from the repo root and expect no errors:

  - `pnpm --filter @hierarchidb/runtime-worker typecheck`
  - `pnpm --filter @hierarchidb/common-api typecheck`

Acceptance is confirmed when host-side imports no longer reference Location/Route Query/Mutation types from `@hierarchidb/plugin-service-api` and the above typechecks pass.

## Idempotence and Recovery

These edits are safe to reapply. If a change breaks compilation, revert the affected import changes and rerun the relevant typechecks.

## Artifacts and Notes

- Expected evidence: host packages import `LocationQueryAPI`, `LocationMutationAPI`, `RouteQueryAPI`, and `RouteMutationAPI` from store packages.

## Interfaces and Dependencies

Store packages re-export Query/Mutation interface types while plugin-service-api remains the source of truth for their definitions. Host packages depend on store packages to keep the dependency direction consistent with store-first access.

Plan update note: Initial plan created to align host-side Location/Route API imports with store packages while retaining plugin-service-api as the source of truth.
