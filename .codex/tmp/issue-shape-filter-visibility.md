# fix/shape-plugin/task-filter-visibility

## Summary
- Fix TaskProgressBar filter logic to control task visibility instead of opacity
- When "Failed status only" filter is on, only failed tasks should be visible (not dimmed)

## Background
- Current implementation uses `fillOpacity` to dim filtered-out tasks
- Users expect filtered tasks to be completely hidden from the visualization
- The filter logic in `buildTaskProgressSegments` needs to exclude segments instead of dimming them

## Scope (In / Out)
- In:
  - Modify `buildTaskProgressSegments` in `useTaskProgressBarComputation.ts` to filter out segments based on filter state
  - Remove `fillOpacity` dimming logic
  - Ensure `failedMode`, `skippedMode`, and `completedMode` work with OR logic when multiple filters are active
  - Maintain correct `viewWidth` and `stageOffsets` calculation after filtering
- Out:
  - Changes to filter UI components
  - Changes to other progress visualization components

## Dependencies
- None

## Acceptance Criteria (DoD)
- [ ] `failedMode: true` の場合、failed タスクのみを segments に含め、それ以外のタスク（completed, recycled, running, paused, waiting）は segments から除外する
- [ ] `skippedMode: true` の場合、skipped タスクのみを segments に含め、それ以外は除外する
- [ ] `completedMode: true` の場合、completed/recycled タスクのみを segments に含め、それ以外は除外する
- [ ] 複数のフィルターが同時に有効な場合は OR 条件で動作する（例: `failedMode && completedMode` なら failed または completed のタスクを表示）
- [ ] すべてのフィルターが false の場合は全タスクを表示する（現在の動作を維持）
- [ ] フィルター適用後も viewWidth や stageOffsets の計算が正しく動作する
- [ ] `fillOpacity` による dim 表示ロジックは削除する
- [ ] `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin` がエラーなく完了する
- [ ] `pnpm -w turbo run build --filter @hierarchidb/shape-plugin` がエラーなく完了する

## Rollback Plan
- Revert commit to restore opacity-based filtering logic

## Verification Commands
- `pnpm -w turbo run typecheck --filter @hierarchidb/shape-plugin`
- `pnpm -w turbo run build --filter @hierarchidb/shape-plugin`
- Expected: exit 0

## Notes
- User request: フィルター指定によって個々のタスクの表示・非表示を制御する
