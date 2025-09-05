import type { NodeId, NodeType, PluginIntegrated, PluginRoutingConfig } from '@hierarchidb/common-type';
import type { EntityHandler } from '@hierarchidb/common-type';
import type { FolderEntity } from '../types/index';
import { FolderEntityHandler } from '../handlers/FolderEntityHandler';
import { FolderValidation } from '../shared/metadata';

const folderHandler = new FolderEntityHandler();

// Adapter to conform to EntityHandler's undefined-return contract
const entityHandlerAdapter: EntityHandler = {
  createEntity: folderHandler.createEntity.bind(folderHandler) as any,
  getEntity: async (nodeId: NodeId) => {
    const e = await (folderHandler as any).getEntity(nodeId);
    return e ?? undefined;
  },
  updateEntity: folderHandler.updateEntity.bind(folderHandler) as any,
  deleteEntity: folderHandler.deleteEntity.bind(folderHandler) as any,
  createWorkingCopy: folderHandler.createWorkingCopy.bind(folderHandler) as any,
  commitWorkingCopy: folderHandler.commitWorkingCopy.bind(folderHandler) as any,
  discardWorkingCopy: folderHandler.discardWorkingCopy.bind(folderHandler) as any,
};

export const FolderDefinition: PluginIntegrated = {
  nodeType: 'folder' as NodeType,
  name: 'folder',
  displayName: 'Folder',
  icon: {
    muiIconName: 'folder',
    color: '#FFA726',
  },
  // Required PluginDefinition fields
  category: { treeId: '*', menuGroup: 'container' },
  dependencies: [],
  priority: 0,
  version: '1.0.0',
  database: {
    dbName: 'folder-db',
    // Dexie schema: storeName -> schema string
    schema: {
      folders: '&id, nodeId, name, description, createdAt, updatedAt, version',
    },
    version: 1,
  },
  entityHandler: entityHandlerAdapter as any,
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
  // Minimal routing config to satisfy PluginIntegrated
  routing: {
    actions: {},
    defaultAction: 'view',
  } as PluginRoutingConfig,
  validation: {
    namePattern: new RegExp(FolderValidation.namePattern),
    maxChildren: FolderValidation.maxChildren,
    customValidators: [],
  },
};
