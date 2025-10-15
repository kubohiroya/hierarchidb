import { FolderIcon } from '../components/FolderIcon.js';
import { FolderCreateDialog } from '../components/FolderCreateDialog.js';
import { FolderEditDialog } from '../components/FolderEditDialog.js';

/**
 * Simple UI plugin definition for folders
 */
export const FolderUIPlugin = {
  nodeType: 'folder',
  icon: FolderIcon,
  createDialog: FolderCreateDialog,
  editDialog: FolderEditDialog,
  label: 'Folder',
  displayName: 'Folder',
};