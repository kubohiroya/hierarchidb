# Base Map Plugin Follow-up Plan

Ensure the base-map plugin remains compatible with the evolving dialog/batch infrastructure.

## Phase 0: Requirements Review
- [ ] Review base map plugin documentation and existing code to understand required dialog flow and worker interactions.
- [ ] Identify dependencies on shared Shape/Route components that may need updates.

## Phase 1: Dialog Integration
- [ ] Audit current multi-step dialogs (if any) and align with the shared `useDraft` pattern.
- [ ] Reintroduce or extract step registrations so base map configuration steps behave as expected.

## Phase 2: Processing/Preview UI
- [ ] Validate progress dialogs or preview components against actual worker APIs; remove temporary placeholders if present.

## Phase 3: Types & Config
- [ ] Ensure tsconfig/path aliases align with the newer standard (UI + services type-checked together).
- [ ] Update shared types so worker responses match UI assumptions.

## Phase 4: Verification
- [ ] `pnpm --filter @hierarchidb/base-map-plugin typecheck`
- [ ] Reinstate tests around dialog and preview operations.
- [ ] Log outcomes/risks in the linked GitHub Issue.
