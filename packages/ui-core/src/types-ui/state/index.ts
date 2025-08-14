/**
 * @file Tree state types
 * @module features/tree-data/types/state
 */

// ITreeNodesDB moved to @hierarchidb/ui-client
export type { DescendantNodeJson } from './DescendantNodeJson';
export type { DescendantNodeJsonWithId } from './DescendantNodeJsonWithId';
export type { DescendantsState } from './DescendantsState';
export type { TrashManagerActionMode } from './TrashManagerActionMode';
export { TrashManagerActionModes } from './TrashManagerActionMode';
export { RootNodeIds } from './RootNodeIds';
// rootNodes is intentionally not exported here to avoid circular dependencies
// Import it directly from "./rootNodes" when needed
