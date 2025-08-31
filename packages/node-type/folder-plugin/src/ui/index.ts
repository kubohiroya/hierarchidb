/**
 * @file ui/index.ts
 * @description UI-side exports for Folder plugin
 */

export { FolderIcon } from '../components/FolderIcon';
export { FolderCreateDialog } from '../components/FolderCreateDialog';
export { FolderEditDialog } from '../components/FolderEditDialog';

// Export type definitions for UI
export type {
  FolderEntity,
  FolderEntityWorkingCopy,
  FolderSettings,
  FolderBookmark,
  FolderTemplate,
} from '../types';