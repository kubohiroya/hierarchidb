
# Testing Strategy (Headless First)

This package prioritizes Node-based integration tests using fake-indexeddb. Once headless tests pass, UI E2E acts as a smoke check.

- Headless (Node + fake-indexeddb):
    - Scenarios: create/update/move/remove/recover, undo/redo, policy checks
    - Files live under `src/__tests__/headless/*.headless.test.ts`
    - Example: `src/__tests__/headless/undo-command-history.headless.test.ts`

- WFL (Worker Flow Lab via Comlink + fake-indexeddb):
    - Covers TreeConsole flows (create/rename/trash/restore, import/export)
    - Files live under `src/__tests__/wfl/*.wfl.test.ts`
    - Example: `src/__tests__/wfl/undo-folder-operations.wfl.test.ts`

UI E2E (later / smoke):
    - Basic boot + minimal interaction parity
    - Runs in a separate workflow

How to run (package only):

pnpm --filter @hierarchidb/runtime-worker test -- --run --reporter=dot

Note: In sandboxed CI, Vitest teardown might throw EPERM on process kill; individual tests still pass. Treat as environment quirk.
