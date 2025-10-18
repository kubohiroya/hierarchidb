# Linker Plugin Follow-up Plan

The linker plugin (if present) may participate in the shared dialog/worker architecture. Document necessary follow-up.

## Phase 0: Requirements Review
- [ ] Confirm the linker plugin’s expected dialog or batch workflows and worker interactions.
- [ ] Determine overlap with route/shape components that need refactoring.

## Phase 1: Dialog Integration
- [ ] Implement or realign working copy handling if the plugin uses dialog steps.
- [ ] Ensure any step provider registrations are active and validated.

## Phase 2: Processing UI
- [ ] Validate progress/preview UI (if applicable) with real worker APIs.

## Phase 3: Types & Config
- [ ] Update tsconfig/path aliases to follow the unified conventions.
- [ ] Synchronize shared types with worker contracts.

## Phase 4: Verification
- [ ] `pnpm --filter @hierarchidb/linker-plugin typecheck`
- [ ] Add/restore tests for dialog and integration points.
- [ ] Record status in TASKS.md.
