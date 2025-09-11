import type { NodeType, PluginDefinition } from '@hierarchidb/common-type';
import { FolderValidation } from '../shared/metadata';

// CoreDB.nodes is the source of truth for folders.
// This definition provides UI metadata, validation, and exposure policy only.
export const FolderDefinition: PluginDefinition = {
  nodeType: 'folder' as NodeType,
  name: 'folder',
  displayName: 'Folder',
  icon: {
    muiIconName: 'folder',
    color: '#FFA726',
  },
  category: { treeId: '*', menuGroup: 'container' },
  dependencies: [],
  priority: 0,
  version: '1.0.0',
  database: {
    dbName: 'CoreDB',
    entityStore: 'folders',
    // metadata only
    schema: { folders: '&id, nodeId, name' },
    version: 1,
  },
  validation: {
    namePattern: new RegExp(FolderValidation.namePattern),
    maxChildren: FolderValidation.maxChildren,
    customValidators: [],
  },
};
