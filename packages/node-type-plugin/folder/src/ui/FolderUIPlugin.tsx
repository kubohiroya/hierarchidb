import { FolderIcon } from '../components/FolderIcon';
import { FolderCreateDialog } from '../components/FolderCreateDialog';
import { FolderEditDialog } from '../components/FolderEditDialog';

/**
 * Simple UI plugin definition for folders
 */
export const FolderUIPlugin = {
  nodeType: 'folder',
  icon: FolderIcon,
  createDialog: FolderCreateDialog,
  editDialog: FolderEditDialog,
  label: 'Folder',
  displayName: 'Folder'
};

export default FolderUIPlugin;