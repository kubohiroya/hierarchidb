# Testing Strategy (2025-09-03)

This package prioritizes Node-based integration tests using `fake-indexeddb` over browser E2E. Once headless tests pass, UI E2E acts as a smoke check for rendering and basic interactions.

- Headless First:
  - Run with Vitest in Node. IndexedDB is provided by `fake-indexeddb/auto` (see `vitest.setup.base.ts`).
  - Target flows: create/update/move/remove/recover, policy-C, working-copy lifecycle.
  - Example specs:
    - `src/e2e/__tests__/cp-routing-wc.headless.test.ts`
    - `src/e2e/__tests__/policy-c.headless.test.ts`

- UI E2E Second:
  - Minimal Playwright specs to validate app boot and basic path parity.
  - See `e2e/cp-routing-wc-flow.spec.ts` at repo root.

## How to Run

- Headless (this package only):

  pnpm --filter @hierarchidb/runtime-worker test -- --run

  Note: In sandboxed CI, Vitest worker teardown may throw `EPERM` on process kill after passing tests. Treat as an environment quirk; individual tests still pass. Use per-package filtering to avoid unrelated failures.

- UI E2E (later phase):

  pnpm e2e

## CI Gating

Gate on headless tests first; enable UI E2E gating after smoke scenarios are stable.

