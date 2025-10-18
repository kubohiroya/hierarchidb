# Shape Plugin UI Refactor Plan

## Phase 0: Requirements Recon / Gap Analysis
- [ ] Re-read existing docs (`docs/WORKING_COPY_PATTERN.md`, `docs/DIALOG_FLOW_AND_STATE_TRANSITIONS.md`) and prior implementation to extract the expected behavior of Shape dialog + batch monitoring.
- [ ] Inspect latest `route-plugin` / `location-plugin` implementations to understand how multi-step dialog and batch UI should behave.
- [ ] Confirm worker/API contracts (shape worker public API, unified batch manager) and note discrepancies.

## Phase 1: Multi-step Dialog Reconstruction
- [ ] Reinstate `useWorkingCopy` integration with proper mapper to/from worker payloads.
- [ ] Rewire `ShapeDialog` to use headless multi-step dialog with Steps 2-5 components.
- [ ] Reconnect step validation and navigation logic (using summary utilities) to enable user flow.
- [ ] Restore `steps-provider.tsx` to register steps via `PluginStepRegistry`.
- [ ] Revive `useShapeAPI` / `useShapeBatchCommand` to call actual worker APIs.

## Phase 2: Batch UI Restoration
- [ ] Reimplement `useShapeProgress` to subscribe to batch progress via worker events.
- [ ] Rebuild `BatchProcessingDialog` with progress views, control buttons, and data tabs.
- [ ] Rebuild `BatchRecoveryDialog` to list sessions and allow resume/discard through worker API.
- [ ] Reinstate auxiliary components (`ShapeBatchProgressDisplay`, `TilePreview`, `ErrorDisplay`) to match original behavior.

## Phase 3: Type & Config Alignment
- [ ] Finalize `tsconfig.build.json` / `tsconfig.json` settings so both UI and service layer type-check cleanly.
- [ ] Ensure path aliases (base tsconfig) contain only the required entries and workspaces resolve.
- [ ] Update shared types (`types.ts`, etc.) so UI ↔ worker data contracts match the current API.

## Phase 4: Verification
- [ ] `pnpm --filter @hierarchidb/shape-plugin typecheck`
- [ ] Restore/Add unit/integration tests for dialog flow and batch controls (Vitest/Jest).
- [ ] Manual UI smoke test (dialog steps, notifications, batch workflow).
- [ ] Document progress and remaining risks in `TASKS.md`.
