# Styler Plugin Follow-up Plan

Styler plugin builds on the same extensible dialog pattern. Coordinate refactor steps with spreadsheet plugin to keep shared components in sync.

## Phase 0: Requirements Review
- [ ] Revisit Styler dialog requirements (style map extension steps, table previews) and verify with current docs.
- [ ] Identify dependencies on Shape/Spreadsheet components to reuse or generalize.

## Phase 1: Dialog Integration
- [ ] Rewire Styler multi-step dialog using the shared `useDraft` hook, mapping StylerDraft fields correctly.
- [ ] Restore step provider registration for style configuration steps and ensure validation works.

## Phase 2: Batch/Preview UI
- [ ] Reconnect preview components (StylerView, Table preview) to fetch data from worker APIs rather than placeholders.
- [ ] Ensure batch processing/preview flows share the same progress monitoring infrastructure once rebuilt.

## Phase 3: Types & Config
- [ ] Update tsconfig/path aliases to align with the shared refactor strategy.
- [ ] Confirm shared types (`StylerEntity`, metadata) align with worker outputs.

## Phase 4: Verification
- [ ] `pnpm --filter @hierarchidb/styler-plugin typecheck`
- [ ] Reinstate unit/integration tests for dialog flow and preview rendering.
- [ ] Document progress in the linked GitHub Issue alongside spreadsheet plugin updates.
