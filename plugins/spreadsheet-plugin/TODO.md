# Spreadsheet Plugin Follow-up Plan

Spreadsheet plugin inherits shared dialog/batch infrastructure similar to Route/Location/Shape. Actions to realign it with the refactored architecture:

## Phase 0: Requirements Review
- [ ] Audit docs/code to confirm expected Spreadsheet multi-step workflow (CSV/DataSource/Filter steps) and integration points with worker APIs.
- [ ] Compare with Shape refactor outcomes to identify gaps in shared components.

## Phase 1: Dialog & Steps Alignment
- [ ] Re-enable `useWorkingCopy` integration for spreadsheet working copies (ensure CSV metadata mapping works with worker API).
- [ ] Reconnect step provider registrations for BasicInfo/CSVUpload/DataSource/Filtering steps.
- [ ] Validate step-level state transitions and error handling.

## Phase 2: Batch/Processing UI
- [ ] Confirm spreadsheet batch execution hooks are calling real worker APIs (no legacy placeholders).
- [ ] Restore progress/recovery dialogs to display real session data similar to route plugin.

## Phase 3: Type & Config Updates
- [ ] Update tsconfig so UI/service code type-check cleanly with the shared settings.
- [ ] Ensure shared types align with worker contracts (table metadata, CSV processing, etc.).

## Phase 4: Verification
- [ ] `pnpm --filter @hierarchidb/spreadsheet-plugin typecheck`
- [ ] Reinstate/add tests for dialog flow and batch orchestration.
- [ ] Record progress/risk notes in TASKS.md.
