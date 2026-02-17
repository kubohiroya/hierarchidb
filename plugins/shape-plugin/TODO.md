# Shape Plugin UI Refactor Plan

## Phase 0: Requirements Recon / Gap Analysis
- [ ] Re-read existing docs (`docs/WORKING_COPY_PATTERN.md`, `../../packages/runtime-worker/docs/build-session-orchestrator-state-transitions.md`) and prior implementation to extract the expected behavior of Shape dialog + build monitoring.
- [ ] Inspect latest `route-plugin` / `location-plugin` implementations to understand how multi-step dialog and build UI should behave.
- [ ] Confirm worker/API contracts (shape worker public API, unified build manager) and note discrepancies.

## Phase 1: Multi-step Dialog Reconstruction
- [ ] Reinstate `useDraft` integration with proper mapper to/from worker payloads.
- [ ] Rewire `ShapeDialog` to use headless multi-step dialog with Steps 2-5 components.
- [ ] Reconnect step validation and navigation logic (using summary utilities) to enable user flow.
- [ ] Restore `steps-provider.tsx` to register steps via `PluginStepRegistry`.
- [ ] Revive `useShapeAPI` / `useBuildCommand` to call actual worker APIs.

## Phase 2: Build UI Restoration
- [ ] Reimplement `useShapeProgress` to subscribe to build progress via worker events.
- [ ] Rebuild Build Progress view with control buttons and data tabs.
- [ ] Rebuild build recovery dialog to list sessions and allow resume/discard through worker API.
- [ ] Reinstate auxiliary components (`TilePreview`, `ErrorDisplay`) to match original behavior.

## Phase 3: Type & Config Alignment
- [ ] Finalize `tsconfig.build.json` / `tsconfig.json` settings so both UI and service layer type-check cleanly.
- [ ] Ensure path aliases (base tsconfig) contain only the required entries and workspaces resolve.
- [ ] Update shared types (`build-types.ts`, etc.) so UI ↔ worker data contracts match the current API.

## Phase 4: Verification
- [ ] `pnpm --filter @hierarchidb/shape-plugin typecheck`
- [ ] Restore/Add unit/integration tests for dialog flow and build controls (Vitest/Jest).
- [ ] Manual UI smoke test (dialog steps, notifications, build workflow).
- [ ] Document progress and remaining risks in `TASKS.md`.
