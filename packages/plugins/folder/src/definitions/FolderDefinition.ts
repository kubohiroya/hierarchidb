import type { NodeTypeDefinition, NodeId } from '@hierarchidb/00-core';
import type { FolderEntity, FolderEntityWorkingCopy } from '../types/index';
import { FolderEntityHandler } from '../handlers/FolderEntityHandler';
import { FolderValidation } from '../shared/metadata';

export const FolderDefinition: NodeTypeDefinition<FolderEntity, never, FolderEntityWorkingCopy> = {
  nodeType: 'folder',
  name: 'folder',
  displayName: 'Folder',
  icon: 'folder',
  color: '#FFA726',
  database: {
    entityStore: 'folders',
    schema: {
      '&id': 'EntityId',
      'nodeId': 'NodeId',
      'name, description': '',
      'createdAt, updatedAt, version': '',
    },
    version: 1
  },
  entityHandler: new FolderEntityHandler(),
  lifecycle: {
    afterCreate: async (nodeId: NodeId, _entity: FolderEntity) => {
      console.log(`Folder node created: ${nodeId}`);
    },
    beforeDelete: async (nodeId: NodeId) => {
      console.log(`Cleaning up folder node: ${nodeId}`);
      const handler = new FolderEntityHandler();
      await handler.cleanup(nodeId);
    }
  },
  validation: {
    namePattern: new RegExp(FolderValidation.namePattern),
    maxChildren: FolderValidation.maxChildren,
    customValidators: []
  }
};;