export {
  createDraftWorkingCopy,
  touchDraftById,
  touchDraftNode,
  touchDraftNodeIds,
} from './working-copy/draftOperations.js';

export { createNewName, getChildNames } from './working-copy/nameUtilities.js';

export { createWorkingCopyFromNode } from './working-copy/editOperations.js';

export {
  commitWorkingCopy as commitDraft,
  type CommitOk,
  type CommitConflict,
  type CommitResult,
  type NameConflict,
} from './working-copy/commitOperations.js';

export { discardWorkingCopy } from './working-copy/cleanupOperations.js';

export { checkDraftConflict, getDraft, updateDraft } from './working-copy/lookupOperations.js';
