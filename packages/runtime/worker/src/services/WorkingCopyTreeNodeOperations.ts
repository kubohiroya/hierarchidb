export {
  createDraftWorkingCopyGetOrCreate,
  createNewDraftWorkingCopy,
  createWorkingCopyNodeHolderName,
  createWorkingCopyNodeHolderParentId,
  touchWorkingCopyById,
  touchWorkingCopyByRecord,
  touchWorkingCopyNodes,
} from './working-copy/draftOperations.js';

export { createNewName, getChildNames } from './working-copy/nameUtilities.js';

export { createWorkingCopyFromNode } from './working-copy/editOperations.js';

export {
  commitWorkingCopy,
  commitWorkingCopyV2,
  type CommitOk,
  type CommitConflict,
  type CommitResultV2,
  type NameConflict,
} from './working-copy/commitOperations.js';

export { discardWorkingCopy } from './working-copy/cleanupOperations.js';

export {
  checkWorkingCopyConflict,
  getWorkingCopy,
  updateWorkingCopy,
} from './working-copy/lookupOperations.js';
