
# Testing Strategy (Headless First)

This package prioritizes Node-based integration tests using fake-indexeddb. Once headless tests pass, UI E2E acts as a smoke check.

- Headless (Node + fake-indexeddb):
    - Scenarios: create/update/move/remove/recover, undo/redo, policy checks
    - Example: src/e2e/__tests__/undo-redo.headless.test.ts
    - Example: src/e2e/__tests__/undo-redo.headless.test.ts
- 
UI E2E (later / smoke):
    - Basic boot + minimal interaction parity
    - Runs in a separate workflow

How to run (package only):

pnpm --filter @hierarchidb/runtime-worker test -- --run --reporter=dot

Note: In sandboxed CI, Vitest teardown might throw EPERM on process kill; individual tests still pass. Treat as environment quirk.
