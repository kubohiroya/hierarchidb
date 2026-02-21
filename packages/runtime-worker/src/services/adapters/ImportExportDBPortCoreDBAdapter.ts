import type { NodeId } from '@hierarchidb/core-types';
import type { TreeNode } from '@hierarchidb/tree-api';
import type { ImportExportDBPort, VectorTileRecord } from '@hierarchidb/import-export';
import type { ShapeVectorTileRecord, ShapeDB } from '@hierarchidb/shape-store';
import type { CoreDB } from '~/services/CoreDB';

export class ImportExportDBPortCoreDBAdapter implements ImportExportDBPort {
  constructor(
    private coreDB: CoreDB,
    private shapeDB: ShapeDB
  ) {}

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

  async listVectorTileRecords(nodeIds: NodeId[]): Promise<VectorTileRecord[]> {
    if (nodeIds.length === 0) return [];
    const rows = await this.shapeDB.vectorTiles.where('nodeId').anyOf(nodeIds).toArray();
    return rows.map((row: ShapeVectorTileRecord) => ({
      tileId: row.tileId,
      nodeId: row.nodeId,
      z: row.z,
      x: row.x,
      y: row.y,
      data_Uint8Array: row.data_Uint8Array,
      size: row.size,
      features: row.features,
      generatedAt: row.generatedAt,
    }));
  }
}
