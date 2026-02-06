# Unify location/route types into feature APIs and decouple plugin-service-api

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

PLANS.md is checked into the repo at `PLANS.md`. This document must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, the definitive type definitions for location and route live in feature-scoped API packages (`@hierarchidb/location-api` and `@hierarchidb/route-api`). The feature stores (`@hierarchidb/location-store`, `@hierarchidb/route-store`) depend on those API packages instead of defining duplicate types. UI code in `plugins/location-plugin` and `plugins/route-plugin` depends only on the API packages and no longer imports store types. Plugins no longer decide which DBs are created or registered; the app owns store selection and DB initialization. You can confirm this by running typechecks and by verifying that location/route types are imported from the API packages only, and by checking that DB initialization is driven by the app.

## Progress

- [x] 2026-01-28 20:35 JST Drafted initial ExecPlan for type split.
- [x] 2026-01-30 10:35 JST Unified-API plan applied to this ExecPlan.
- [x] 2026-01-30 10:35 JST Created `@hierarchidb/location-api` and `@hierarchidb/route-api` packages with unified types.
- [x] 2026-01-30 10:35 JST Updated location-store and route-store to import types from the new API packages.
- [x] 2026-01-30 10:35 JST Updated UI imports in location/route plugins to use API packages only.
- [x] 2026-01-30 10:35 JST `plugin-service-api` re-exports API packages and local duplicates removed.
- [x] 2026-01-30 10:35 JST Moved DB initialization/registration selection to the app and removed plugin auto-registration side effects.
- [x] 2026-01-30 10:35 JST Aligned `*-api` (schema + API) vs `*-store` (DB init) responsibilities per new policy.
- [x] 2026-01-30 12:05 JST Ran `pnpm --filter @hierarchidb/app typecheck` (tsdown define warning noted) and updated TASKS.md.

## Surprises & Discoveries

- Observation: `packages//src/locationTypes.ts` already defines location types that overlap with `plugin-service-api`.
  Evidence: `packages//src/locationTypes.ts` and `packages/plugin-service-api/src/types/locationTypes.ts` both define `LocationPointProperties`-like shapes.

## Decision Log

- Decision: Treat `@hierarchidb/location-api` and `@hierarchidb/route-api` as the single sources of truth for location/route API types, and re-point store packages to them.
  Rationale: Avoid dual definitions and make API boundaries explicit, per user request.
  Date/Author: 2026-01-28 / Codex

- Decision: Keep `plugin-service-api` as a transitional re-export layer while consumers are migrated, then plan removal in a later phase.
  Rationale: Reduce disruption while we swap imports across the repo.
  Date/Author: 2026-01-28 / Codex

- Decision: The app defines which `*-store` packages are included and is solely responsible for DB initialization/registration; plugins do not decide DB presence or perform DB registration.
  Rationale: Store selection is app-scoped and must be consistent across plugins; plugins should remain feature logic only.
  Date/Author: 2026-01-30 / Codex

## Outcomes & Retrospective

- Not completed yet.

## Context and Orientation

`packages/plugin-service-api` is a shared API bundle exporting many contract types. It currently defines `locationTypes.ts` and `routeTypes.ts` in `packages/plugin-service-api/src/types/` and re-exports them from `packages/plugin-service-api/src/index.ts`.

`packages/` and `packages/` are feature-specific persistence layers. Today, location and route types are duplicated between the store packages and `plugin-service-api`, which creates ambiguity and dependency cycles.

The plan is to create two new feature API packages (`packages/` and `packages/`) and move the authoritative types there. Store packages will import types from their API packages. UI code will import only from API packages. `plugin-service-api` will re-export from API packages as a temporary compatibility layer. Separately, DB initialization and registration must move to the app so that plugins do not own DB selection.

## Plan of Work

First, create `packages/` and `packages/` packages that define the unified types for location and route. Use `tsdown` for build configuration and mirror the structure used by other feature packages.

Second, consolidate the type definitions. For location, merge the overlapping fields between `packages//src/locationTypes.ts` and `packages/plugin-service-api/src/types/locationTypes.ts` into a single `packages//src/locationTypes.ts`. The unified definition must preserve the richer shape (for example, keep both admin code/name and centroid fields). If a field only exists in one source and is still relevant, include it. Remove the old `locationTypes.ts` in `location-store` and update `location-store` exports to reference the API package instead.

For route, move `packages/plugin-service-api/src/types/routeTypes.ts` into `packages//src/routeTypes.ts`. If `route-store` has overlapping definitions, merge them similarly so the API package is authoritative. Update `route-store` to import its route types from `route-api`.

Third, update `plugin-service-api` to re-export the new API types instead of defining them locally. Remove local `locationTypes.ts` and `routeTypes.ts` from `plugin-service-api`, and update `LocationQueryAPI.ts`, `RouteQueryAPI.ts`, and `RouteMutationAPI.ts` to import from `@hierarchidb/location-api` / `@hierarchidb/route-api`.

Fourth, shift DB initialization/registration to the app layer. The app should explicitly depend on the `*-store` packages it needs and initialize their databases in a centralized app-owned registry or bootstrap module. Plugins must not declare or register DB schemas or create DB instances. Store packages continue to own DB initialization logic, but the app is the only caller that decides which stores to initialize.

Fifth, update UI imports in `plugins/location-plugin` and `plugins/route-plugin` so they depend only on the API packages. Remove any `@hierarchidb/location-store` / `@hierarchidb/route-store` dependency from UI package.json files if no longer used on the UI side. If worker-side code still needs store packages, keep those dependencies scoped to worker modules only.

Finally, run typechecks for the new API packages and the affected consumers. Document results and any deviations in TASKS.md.

## Concrete Steps

All commands run from repository root: `/Users/hiroya/WebstormProjects/hierarchidb`.

1) Create `packages/`:

   - `packages//package.json` (use `tsdown` build; dependencies on `@hierarchidb/core-types`, `@hierarchidb/shape-store` if required by unified types).
   - `packages//tsconfig.json` (pattern from other feature packages).
   - `packages//src/locationTypes.ts` (unified definition).
   - `packages//src/index.ts` exporting `locationTypes`.

2) Create `packages/`:

   - `packages//package.json` (dependencies only on `@hierarchidb/core-types` if needed).
   - `packages//tsconfig.json`.
   - `packages//src/routeTypes.ts` (unified definition).
   - `packages//src/index.ts` exporting `routeTypes`.

3) Update store packages:

   - `packages//src/locationTypes.ts`: remove or replace with re-exports from `@hierarchidb/location-api`.
   - Update any imports in `packages//src/**` to use `@hierarchidb/location-api`.
   - `packages//src/**`: update imports to `@hierarchidb/route-api` where route types are needed.
   - Update package.json dependencies for both stores to include their API packages.

4) Update plugin-service-api:

   - Remove `packages/plugin-service-api/src/types/locationTypes.ts` and `routeTypes.ts`.
   - Change `packages/plugin-service-api/src/types/LocationQueryAPI.ts` to import from `@hierarchidb/location-api`.
   - Change `packages/plugin-service-api/src/types/RouteQueryAPI.ts` and `RouteMutationAPI.ts` to import from `@hierarchidb/route-api`.
   - Update `packages/plugin-service-api/src/index.ts` to re-export from the new API packages with a short transitional comment.
   - Update `packages/plugin-service-api/package.json` to depend on the new API packages.

5) Update UI consumers:

   - `plugins/location-plugin` UI modules: replace `@hierarchidb/location-store` imports with `@hierarchidb/location-api` as needed.
   - `plugins/route-plugin` UI modules: replace `@hierarchidb/route-store` or `@hierarchidb/plugin-service-api` route type imports with `@hierarchidb/route-api`.
   - Adjust package.json dependencies accordingly.

6) Move DB initialization/registration to the app:

   - Identify the current DB registry/initialization entry point in the app (or create a new dedicated module).
   - Add explicit app-level dependencies on `@hierarchidb/location-store` and `@hierarchidb/route-store` (and any other required stores).
   - Call the store-level initialization/registration APIs from the app bootstrap, not from plugins.
   - Ensure plugins do not define or register DB schema or create DB instances.

7) Run typechecks:

   - `pnpm --filter @hierarchidb/location-api typecheck`
   - `pnpm --filter @hierarchidb/route-api typecheck`
   - `pnpm --filter @hierarchidb/location-store typecheck`
   - `pnpm --filter @hierarchidb/route-store typecheck`
   - `pnpm --filter @hierarchidb/plugin-service-api typecheck`
   - `pnpm --filter @hierarchidb/location-plugin typecheck`
   - `pnpm --filter @hierarchidb/route-plugin typecheck`

Expected output is exit 0 for each command. Capture failures and update this plan and TASKS.md before proceeding.

## Validation and Acceptance

Validation is complete when:

- The API packages compile and expose unified location/route types.
- Store packages import types from API packages and no longer define duplicate types.
- UI code in location/route plugins imports only from API packages for those types.
- `plugin-service-api` re-exports the types from API packages without local duplicates.
- DB initialization/registration is performed only by the app, and plugins no longer control DB selection or registration.
- Typechecks for all affected packages succeed.

## Idempotence and Recovery

All steps are safe to repeat. If a step fails, revert the last set of edits and re-run the relevant typechecks. Rollback is a `git revert` for the commit or manually restoring the prior imports/exports.

## Artifacts and Notes

- Sources for unification:
  - `packages//src/locationTypes.ts`
  - `packages/plugin-service-api/src/types/locationTypes.ts`
  - `packages/plugin-service-api/src/types/routeTypes.ts`

- Example target import:
  - `import type { RouteNearestLineQuery } from '@hierarchidb/route-api';`

## Interfaces and Dependencies

The API packages must export these public types:

- `@hierarchidb/location-api`: `LocationPointKind`, `LocationPointMetadata`, `LocationPointId`, `LocationPointProperties`, `LocationGroupItemData`, `LocationRelationMeta`, plus any fields that were previously unique to `location-store` types (such as admin codes, centroid fields, or morton-related metadata) in the unified definition.

- `@hierarchidb/route-api`: `RouteNearestLineQuery`, `RouteNearestEndpoint`, `RouteNearestLine`, `RouteNearestLineMatch`, `RouteNearestLineResponse`, `RouteWaypointPoint`, `RouteWaypointInput`, `RouteWaypointResult`.

`@hierarchidb/location-store` and `@hierarchidb/route-store` must depend on their respective API packages and must not define duplicate type shapes.

The app must explicitly depend on the store packages it needs and initialize them at startup; plugins must not import store initialization or register DB schemas.

Plan update note: ExecPlan rewritten on 2026-01-28 to incorporate unified API types, store-to-API dependencies, and UI-only API imports per user request. Updated on 2026-01-30 to include app-owned DB initialization/registration responsibilities.
