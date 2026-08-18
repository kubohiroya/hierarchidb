# Resolver Plugin Follow-up Plan

The resolver plugin leverages the same extensible dialog framework. Track required work to keep it aligned with the latest architecture.

## Phase 0: Requirements Review
- [ ] Revisit resolver dialog specs (e.g. step flow, validation) and worker API contracts.
- [ ] Identify shared components reused from route/shape that must be updated.

## Phase 1: Dialog Integration
- [ ] Verify resolver dialog uses `useDraft` correctly with current worker payloads.
- [ ] Ensure step provider registrations and validation pipelines are active.

## Phase 2: Batch/Processing UI (if applicable)
- [ ] Confirm any batch or preview dialogs are wired to live data; remove mocks.

## Phase 3: Types & Config
- [ ] Align tsconfig/path aliases with refactored standards.
- [ ] Update resolver-specific types to match worker outputs.

## Phase 4: Verification
- [ ] `pnpm --filter @hierarchidb/resolver-plugin typecheck`
- [ ] Restore tests for dialog/worker integration.
- [ ] Update the linked GitHub Issue with progress and remaining risks.
