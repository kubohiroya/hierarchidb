# Timeline Plugin Follow-up Plan

Timeline plugin should align with the shared dialog and worker infrastructure.

## Phase 0: Requirements Review
- [ ] Review timeline plugin docs/code to capture expected dialog/preview interactions and worker dependencies.
- [ ] Compare with refactored route/shape implementations to identify missing pieces.

## Phase 1: Dialog Integration
- [ ] Reintegrate working copy handling and step registration if the plugin uses multi-step dialogs.
- [ ] Ensure validation logic matches timeline-specific requirements.

## Phase 2: Processing/Preview UI
- [ ] Confirm timeline preview/progress components connect to real worker outputs; replace placeholders.

## Phase 3: Types & Config
- [ ] Bring tsconfig/path settings in line with unified configuration.
- [ ] Update timeline-specific types to match worker API payloads.

## Phase 4: Verification
- [ ] `pnpm --filter @hierarchidb/timeline-plugin typecheck`
- [ ] Reinstate tests covering dialog/preview flows.
- [ ] Document progress in the linked GitHub Issue.
