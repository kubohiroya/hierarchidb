import type { Timestamp } from '@hierarchidb/core-types';

/**
 * Event payload emitted when undo/redo availability changes.
 */
export interface UndoStateEvent {
  type: 'undo-atoms';
  canUndo: boolean;
  canRedo: boolean;
  timestamp: Timestamp;
}
