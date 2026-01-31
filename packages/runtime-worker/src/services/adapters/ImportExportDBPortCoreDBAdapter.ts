import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { ImportExportDBPort } from '@hierarchidb/import-export';
import type { CoreDB } from '../CoreDB.js';

export class ImportExportDBPortCoreDBAdapter implements ImportExportDBPort {
  constructor(private coreDB: CoreDB) {}

  getCoreDB(): CoreDB {
    return this.coreDB;
  }

  bulkCreateNodes(nodes: TreeNode[]): Promise<void> {
    return this.coreDB.bulkCreateNodes(nodes);
  }

  listChildren(parentId: NodeId): Promise<TreeNode[]> {
    return this.coreDB.listChildren(parentId);
  }

  getNode(nodeId: NodeId): Promise<TreeNode | undefined> {
    return this.coreDB.getNode(nodeId);
  }
}
