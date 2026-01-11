import type { Timestamp } from './primitive-types.js';

/**
 * Event payload emitted when undo/redo availability changes.
 */
export interface UndoStateEvent {
  type: 'undo-atoms';
  canUndo: boolean;
  canRedo: boolean;
  timestamp: Timestamp;
}
