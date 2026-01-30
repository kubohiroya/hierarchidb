# shape-plugin src cleanup inventory (2025-12-21)

This document summarizes candidates for removal in `plugins/shape-plugin/src`.
Candidates are based on repository-wide `rg` searches. If a symbol is exported
from `plugins/shape-plugin/src/index.ts`, verify external usage before removal.

## Unused file candidates (no repo references found)

- `plugins/shape-plugin/src/services/datasources/__tests__/demo.ts`
  - Evidence: `rg` hits only within this file; excluded from Vitest by path
- `plugins/shape-plugin/src/services/datasources/__tests__/manual-test.ts`
  - Evidence: `rg` hits not found
- `plugins/shape-plugin/src/services/RecoveryStrategy.ts`
  - Evidence: `rg` hits only within this file; referenced only in docs
- `plugins/shape-plugin/src/services/auth/index.ts`
  - Evidence: `rg` hits only within this file
- `plugins/shape-plugin/src/services/auth/WorkerAuthHandler.ts`
  - Evidence: `rg` hits only within this file
- `plugins/shape-plugin/src/services/batch/adapters/RuntimeWorkerExtractAdapters.ts`
  - Evidence: `rg` hits only within this file
- `plugins/shape-plugin/src/services/tiles/RuntimeTileClient.ts`
  - Evidence: `rg` hits only within this file
  - Note: exported in `plugins/shape-plugin/src/index.ts`, check external usage
- `plugins/shape-plugin/src/ui/components/BatchRecoveryDialog.tsx`
  - Evidence: `rg` hits only within this file
- `plugins/shape-plugin/src/ui/components/ErrorDisplay.tsx`
  - Evidence: `rg` hits only within this file
- `plugins/shape-plugin/src/ui/__tests__/mocks/useWorkerAPIClient.ts`
  - Evidence: `rg` hits only within this file
- `plugins/shape-plugin/src/ui/hooks/useBatchCommand.ts`
  - Evidence: exported from `ui/hooks/index.ts`, but no call sites found

## Unused function/class candidates (no repo references found)

- `plugins/shape-plugin/src/common/mock/data.ts`
  - `generateMockDownloadTasks`
  - `generateMockExtractTasks`
  - `generateMockVectorTileTasks`
  - `generateSampleCheckboxMatrix`
  - `calculateEstimatedProcessingTime` (docs-only reference)
- `plugins/shape-plugin/src/common/types/ShapeErrorHierarchy.ts`
  - `ShapeErrorFactory`
- `plugins/shape-plugin/src/common/types/category-types.ts`
  - `getCategoryLabel`
  - `getCategoryColor`
- `plugins/shape-plugin/src/services/batch/UnifiedShapeBatchManager.ts`
  - `isShapeBatchAPIV2Enabled`
- `plugins/shape-plugin/src/services/utils/utils.ts`
  - `validateShapeName`
- `plugins/shape-plugin/src/services/tiles/RuntimeTileClient.ts`
  - `getTileSummary`
- `plugins/shape-plugin/src/services/auth/index.ts`
  - `getShapeAuthHandler`
  - `resetShapeAuthHandler`
- `plugins/shape-plugin/src/services/auth/WorkerAuthHandler.ts`
  - `getShapeAuthHandler`
  - `disposeShapeAuthHandler`

## Notes

- `plugins/shape-plugin/src/index.ts` exports `AuthRuntimeBridge` and `onRegister`.
  These are part of the plugin runtime wiring interface, so they are not marked
  as unused here.
- If a candidate is exported in `plugins/shape-plugin/src/index.ts`, confirm
  external usage before removal.
