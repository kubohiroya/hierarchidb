# Secure IndexedDB Maintenance URL With Explicit User Consent

This ExecPlan is a living document. The sections `Progress`, `Surprises & Discoveries`, `Decision Log`, and `Outcomes & Retrospective` must be kept up to date as work proceeds.

This document follows `/Users/hiroya/WebstormProjects/hierarchidb/PLANS.md` and must be maintained in accordance with that file.

## Purpose / Big Picture

After this change, users can open a dedicated maintenance URL that is valid only when initiated from the in-app user menu. On that page, they must complete explicit consent before destructive operations run. The maintenance execution then shuts down active worker clients, prevents new worker initialization during the operation, deletes app IndexedDB databases with blocked-state handling, and re-initializes the worker runtime so database upgrades can run cleanly.

The behavior is observable: open the user menu, start maintenance, confirm on `/maintenance`, and verify that deletion succeeds (or shows blocked databases with actionable guidance) and worker re-initialization completes.

## Progress

- [x] (2026-02-13 00:56Z) Investigated current clear-data behavior in `@hierarchidb/ui-usermenu` and confirmed it deletes IndexedDB directly without a dedicated maintenance route.
- [x] (2026-02-13 01:02Z) Confirmed worker lifecycle controls available via `WorkerAPI.shutdown()` and `WorkerProvider.reset()` (`app/src/contexts/WorkerProvider.tsx`, `packages/worker-api/src/WorkerAPI.ts`).
- [x] (2026-02-13 01:05Z) Confirmed route wiring points in `app/src/router/index.tsx` and top-level user-menu consumers in home/tree layouts.
- [x] (2026-02-13 01:24Z) Implemented maintenance session issuance/validation utilities under `app/src/maintenance/maintenanceSession.ts`.
- [x] (2026-02-13 01:26Z) Implemented maintenance lock and enforced it in `app/src/worker-runtime/client.ts`.
- [x] (2026-02-13 01:28Z) Implemented maintenance execution orchestration (`maintenanceExecution.ts`, `maintenanceChannel.ts`, `runtimeShutdown.ts`).
- [x] (2026-02-13 01:31Z) Added `/maintenance` route and page with explicit consent UI (`maintenanceRoute.tsx`, `MaintenancePage.tsx`).
- [x] (2026-02-13 01:33Z) Added user-menu entry and app callbacks to open maintenance URL from home/tree layouts.
- [x] (2026-02-13 01:34Z) Added localization strings for maintenance entry in app/package locale bundles.
- [x] (2026-02-13 01:36Z) Added unit tests for session, lock, and execution blocked/success behavior.
- [x] (2026-02-13 01:38Z) Ran test/typecheck commands, updated the retired local task log, and documented external blockers.
- [x] (2026-02-13 01:57Z) Fixed router unit-test mock compatibility (`configure-router-mode`) for `maintenanceRoute` addition and re-ran targeted app tests.

## Surprises & Discoveries

- Observation: There are two clear-data implementations (`packages/ui/auth` legacy and active `packages/ui/usermenu` path). The app uses `UserLoginButton` from `ui-usermenu`.
  Evidence: `app/src/router/pages/home/HomePage.tsx` and `app/src/router/routes/t.($treeId).($pageNodeId).tsx` import `@hierarchidb/ui-plugin-shell/ui-usermenu`.
- Observation: A developer-only IndexedDB reset path already exists and uses plugin-aware clearing (`app/src/router/pages/tree/console/useIndexedDbReset.ts`, `app/src/plugin-runtime/clearIndexedDb.ts`).
  Evidence: existing `clearAppIndexedDBsViaPlugins()` implementation and toolbar integration.
- Observation: localStorage/sessionStorage can be unavailable in test/runtime contexts, causing lock/session writes to no-op.
  Evidence: Vitest output included `--localstorage-file` warnings and initial lock test failed until memory fallback was added.
- Observation: Turbo typecheck graph currently fails in unrelated packages even when filtering app/runtime-worker in this worktree.
  Evidence: `@hierarchidb/spreadsheet-store#build:types` cannot resolve `@hierarchidb/ui-grid` and `@hierarchidb/ui-modal-select`.
- Observation: `configure-router-mode` test used a full mock for `@tanstack/react-router`, which broke `Link` export resolution after route graph changes.
  Evidence: Vitest error `No "Link" export is defined on the "@tanstack/react-router" mock` until partial mock (`importOriginal`) was applied.

## Decision Log

- Decision: Keep the existing “Clear All Data” path untouched and add a separate maintenance flow entry.
  Rationale: We need a safer gated path without regressing existing user behavior.
  Date/Author: 2026-02-13 / Codex
- Decision: Implement short-lived session token validation in browser storage for maintenance route access control.
  Rationale: This blocks direct-link execution unless the flow was initiated intentionally in-app.
  Date/Author: 2026-02-13 / Codex
- Decision: Enforce a maintenance lock in worker initialization (`client.ts`) so new worker DB usage is blocked during destructive operations.
  Rationale: Requirement explicitly asks to terminate worker usage and prevent DB re-open races while deleting.
  Date/Author: 2026-02-13 / Codex
- Decision: Show maintenance menu only for authenticated users.
  Rationale: Reduces accidental/unauthenticated invocation and aligns with user-identity confirmation intent.
  Date/Author: 2026-02-13 / Codex
- Decision: Add in-memory fallback for maintenance lock/session storage.
  Rationale: Keeps behavior deterministic when browser storage is unavailable or restricted.
  Date/Author: 2026-02-13 / Codex

## Outcomes & Retrospective

Implemented the full maintenance URL flow with explicit consent and one-time session gating, integrated from avatar menu to a new `/maintenance` route. The route now validates short-lived session credentials, requires typed destructive confirmation (and email confirmation when available), executes worker shutdown/reset plus IndexedDB deletion with blocked handling, and re-initializes the worker runtime to trigger upgrades.

New unit tests (`maintenanceSession`, `maintenanceLock`, `maintenanceExecution`) all pass, and router compatibility test (`configure-router-mode`) also passes after mock adjustment. Runtime-worker and ui-usermenu typechecks pass. Full `@hierarchidb/app` turbo typecheck remains blocked by pre-existing `@hierarchidb/shape-plugin` readonly/mutable mismatch (`tileEmitConfig.debug.tiles`), which was logged in the retired local task log.

## Context and Orientation

The active user menu is implemented in `packages/ui/usermenu/src/components/UserLoginButton.tsx` and `packages/ui/usermenu/src/components/useUserMenu.ts`. Today it exposes a dialog that directly clears caches, IndexedDB, and localStorage. The app mounts this menu in `app/src/router/pages/home/HomePage.tsx` and `app/src/router/routes/t.($treeId).($pageNodeId).tsx`.

The worker runtime is globally managed by `app/src/contexts/WorkerProvider.tsx` using `WorkerAPIClient` and state helpers in `app/src/worker-runtime/`. Worker APIs include `shutdown()` (`packages/worker-api/src/WorkerAPI.ts`), and `WorkerService.shutdown()` closes DB handles in the worker (`packages/runtime-worker/src/WorkerService.ts`).

Routing is manually assembled in `app/src/router/index.tsx` from route modules in `app/src/router/routes/`. A new route must be added there.

Localization strings for user menu are duplicated in both app and package locale bundles (`app/public/locales/{en,ja}/common.json`, `packages/ui/i18n/public/locales/{en,ja}/common.json`) and should be updated consistently.

## Plan of Work

First, add maintenance domain utilities under `app/src/maintenance/`:

- `maintenanceSession.ts`: create short-lived one-time sessions using cryptographically random values, persist in `sessionStorage`, and validate against URL parameters.
- `maintenanceLock.ts`: set/check/clear a lock record in `localStorage` with expiration so the app can reject new worker initialization during maintenance.
- `maintenanceExecution.ts`: orchestrate shutdown/reset, IndexedDB deletion with blocked retries, and worker re-initialization.

Second, wire lock enforcement in worker bootstrap (`app/src/worker-runtime/client.ts`) so `initializeWorker()` fails fast while maintenance lock is active.

Third, add a maintenance route and page:

- `app/src/router/routes/maintenanceRoute.tsx` for `/maintenance`.
- `app/src/router/pages/maintenance/MaintenancePage.tsx` to validate session URL params, show explicit consent form (typed confirmation text and optional email confirmation if authenticated), execute maintenance, and display outcome.
- Register route in `app/src/router/index.tsx`.

Fourth, integrate menu entry:

- Extend `UserLoginButton`/`UserMenu` in `packages/ui/usermenu` with an optional callback for “Open DB Maintenance”.
- In app-level consumers (`HomePage.tsx` and tree layout route), pass a callback that creates a maintenance session and navigates to `/maintenance` with session credentials.

Fifth, add tests:

- Session utility tests (valid, expired, mismatch token, consumed cases).
- Lock utility or worker-init guard test ensuring lock blocks initialization behavior.

Finally, run required checks and update tracking logs.

## Concrete Steps

Run from `/Users/hiroya/WebstormProjects/hierarchidb-maintenance-url`.

1. Implement utilities and route/page files as described in Plan of Work.
2. Wire user-menu callback and app route registration.
3. Add tests under `app/src/maintenance/__tests__/`.
4. Execute:
   - `pnpm -w turbo run typecheck --filter @hierarchidb/app --filter @hierarchidb/runtime-worker`
   - `pnpm -w turbo run test --filter @hierarchidb/app --filter @hierarchidb/runtime-worker`
5. Record results in GitHub Issue #239.

Expected terminal signals (abridged): successful commands exit with code `0`; failing command output must be captured and logged as blocked if unrelated external failures appear.

## Validation and Acceptance

Acceptance is behavioral and test-based.

- Behavioral:
  - Opening `/maintenance` directly without a valid session token shows an invalid-session state and does not run deletion.
  - Starting maintenance from user menu generates a valid short-lived URL.
  - Executing maintenance with valid explicit consent runs worker shutdown/reset, IndexedDB delete attempts, then worker re-initialization.
  - If DB delete is blocked, UI reports blocked DB names and does not claim success.
- Tests:
  - New tests for session and lock behavior pass.
  - `app` and `runtime-worker` typecheck/test commands complete with exit `0` (or clearly documented pre-existing blockers).

## Idempotence and Recovery

Session creation is idempotent by design (new session overwrites stale ones). Expired sessions are rejected and can be recreated from user menu. Maintenance lock includes expiration so stale lock records self-heal. If deletion is blocked, rerunning after closing other tabs is safe because shutdown/reset + delete are repeatable.

Rollback path is straightforward: remove the maintenance route integration and menu callback, and revert lock enforcement in worker init. Existing clear-data path remains available throughout.

## Artifacts and Notes

Key files expected to change:

- `plans/indexeddb-maintenance-url-execplan.md`
- `app/src/maintenance/maintenanceSession.ts` (new)
- `app/src/maintenance/maintenanceLock.ts` (new)
- `app/src/maintenance/maintenanceExecution.ts` (new)
- `app/src/router/pages/maintenance/MaintenancePage.tsx` (new)
- `app/src/router/routes/maintenanceRoute.tsx` (new)
- `app/src/router/index.tsx`
- `app/src/worker-runtime/client.ts`
- `packages/ui/usermenu/src/components/UserLoginButton.tsx`
- `packages/ui/usermenu/src/components/UserMenu.tsx`
- `app/src/router/pages/home/HomePage.tsx`
- `app/src/router/routes/t.($treeId).($pageNodeId).tsx`
- localization files under app/package `common.json`

## Interfaces and Dependencies

The feature relies on existing interfaces:

- `WorkerAPI.shutdown()` (`packages/worker-api/src/WorkerAPI.ts`)
- `WorkerProvider` context methods `reset()` / `initialize()` and client access (`app/src/contexts/WorkerProvider.tsx`)
- Browser IndexedDB APIs (`indexedDB.databases()`, `indexedDB.deleteDatabase()`)

New interfaces to introduce:

- `createMaintenanceSession()` returning URL-safe session credentials.
- `validateMaintenanceSessionFromUrl()` returning validated session metadata or structured failure reason.
- `executeIndexedDbMaintenance()` returning structured step-by-step result with blocked/failed DB lists.

Revision note: Updated after implementation to record completed milestones, storage fallback discovery, authenticated-menu decision, test outcomes, and current typecheck blockers.
