import type { NodeId, NodeType, PluginIntegrated } from '@hierarchidb/common-type';
import type { FolderEntity } from '../types/index';
import { FolderEntityHandler } from '../handlers/FolderEntityHandler';
import { FolderValidation } from '../shared/metadata';

export const FolderDefinition: PluginIntegrated = {
  nodeType: 'folder' as NodeType,
  name: 'folder',
  displayName: 'Folder',
  icon: {
    muiIconName: 'folder',
    color: '#FFA726',
  },
  database: {
    dbName: 'folders',
    schema: {
      '&id': 'EntityId',
      nodeId: 'NodeId',
      'name, description': '',
      'createdAt, updatedAt, version': '',
    },
    version: 1,
  },
  entityHandler: new FolderEntityHandler(),
  lifecycle: {
    afterCreate: async (nodeId: NodeId, _entity: FolderEntity) => {
      console.log(`Folder node created: ${nodeId}`);
    },
    beforeDelete: async (nodeId: NodeId) => {
      console.log(`Cleaning up folder node: ${nodeId}`);
      const handler = new FolderEntityHandler();
      await handler.cleanup();
    },
  },
  validation: {
    namePattern: new RegExp(FolderValidation.namePattern),
    maxChildren: FolderValidation.maxChildren,
    customValidators: [],
  },
};
