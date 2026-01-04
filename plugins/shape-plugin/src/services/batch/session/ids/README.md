# session/ids

This folder contains small, pure helpers that define ID conventions used by the shape-plugin batch session.

- `processingIds.ts`
  - `buildProcessingTaskId(nodeId, stage, details)` (details can include zoom range labels)
  - `normalizeTaskIdSegment(value)`
  - `buildFeatureId(base, index, ...)`

These functions are intentionally side-effect free and easy to unit test.
